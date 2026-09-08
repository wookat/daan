"""P0 A 组功能：能力预测分 / 模考排名 / 全局搜索。

独立 router，main.py 仅需 include_router，尽量不动既有文件。
"""
import json
import re
import sqlite3
import time

from fastapi import APIRouter, HTTPException

from . import db, qcode, taxonomy

router = APIRouter()

# ---------- 能力预测分 ----------
#
# 满分权重取 2026 国考地市级卷面结构（130 题）折算的百分制常用口径：
#   常识判断 20 题 ≈ 10 分、言语理解 40 题 ≈ 30 分、数量关系 15 题 ≈ 12 分、
#   判断推理 35 题 ≈ 28 分、资料分析 20 题 ≈ 20 分，合计 100 分。
# 与设计稿 predict-score.html 的分模块满分（10/30/12/28/20）一致。
MOD_MAX = {"changshi": 10.0, "yanyu": 30.0, "shuliang": 12.0, "panduan": 28.0, "ziliao": 20.0}
MOD_NAMES = {"changshi": "常识判断", "yanyu": "言语理解", "shuliang": "数量关系", "panduan": "判断推理", "ziliao": "资料分析"}

COLD_START_N = 30       # 全量作答 < 30 题视为冷启动，不出分
PRIOR_ACC = 0.55        # 贝叶斯平滑先验：新手平均正确率经验值
PRIOR_K = 12            # 先验伪计数：作答越少越向先验收缩，防小样本极端分
GUESS_FLOOR = 0.25      # 四选一盲猜底线
RECENT_DAYS = 30        # 近期窗口：近 30 天作答反映当前水平
COVERAGE_FULL = 60      # 单模块作答 >= 60 题视为覆盖充分


def _smooth(c: int, n: int) -> float:
    """贝叶斯平滑正确率：小样本向先验收缩。"""
    return (c + PRIOR_K * PRIOR_ACC) / (n + PRIOR_K)


def _module_frac(rows: list, now: float, exam_acc: float | None) -> tuple[float, dict]:
    """单模块预测得分率。

    加权口径（权重依据注释）：
    - 近 30 天正确率 0.5：最能代表当前水平；
    - 全量正确率 0.3：抑制近期小样本波动；
    - 真题正确率 0.2：真题难度更贴近考试，有真题作答时计入；
    - 模考表现 0.3（外层混入）：整卷限时作答最接近实考状态。
    各分量缺失时权重按比例归一到其余分量。
    """
    n = len(rows)
    c = sum(r[1] for r in rows)
    since = now - RECENT_DAYS * 86400
    recent = [r for r in rows if r[0] >= since]
    real = [r for r in rows if r[2]]
    parts = [(0.5, _smooth(sum(r[1] for r in recent), len(recent))) if len(recent) >= 5 else None,
             (0.3, _smooth(c, n)),
             (0.2, _smooth(sum(r[1] for r in real), len(real))) if len(real) >= 5 else None]
    parts = [p for p in parts if p]
    wsum = sum(w for w, _ in parts)
    frac = sum(w * v for w, v in parts) / wsum
    if exam_acc is not None:
        frac = 0.7 * frac + 0.3 * exam_acc
    frac = max(frac, GUESS_FLOOR)
    # 近期趋势：近 20 题 vs 前 20 题
    seq = [r[1] for r in rows]
    trend = 0.0
    if n >= 10:
        cur, prev = seq[-20:], (seq[-40:-20] or seq[:-20])
        if prev:
            trend = sum(cur) / len(cur) - sum(prev) / len(prev)
    meta = {
        "n": n,
        "acc": round(c / n, 3) if n else 0,
        "trend": round(trend, 3),
        "coverage": round(min(1.0, n / COVERAGE_FULL), 2),
    }
    return frac, meta


def _predict_at(rows_by_mod: dict, now: float, exam_by_mod: dict | None = None) -> tuple[float, list]:
    total = 0.0
    mods = []
    for mod, mx in MOD_MAX.items():
        rows = rows_by_mod.get(mod) or []
        if not rows:
            # 未练过的模块按盲猜底线计入，避免总分虚高
            total += mx * GUESS_FLOOR
            mods.append({"module": mod, "name": MOD_NAMES[mod], "score": round(mx * GUESS_FLOOR, 1),
                         "max": mx, "n": 0, "acc": 0, "trend": 0, "coverage": 0})
            continue
        frac, meta = _module_frac(rows, now, (exam_by_mod or {}).get(mod))
        total += mx * frac
        mods.append({"module": mod, "name": MOD_NAMES[mod], "score": round(mx * frac, 1), "max": mx, **meta})
    return round(total, 1), mods


def _load_answer_rows(uid: str):
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.created_at, a.correct, COALESCE(q.is_real, 0) is_real, a.module
           FROM answer_log a LEFT JOIN questions q ON q.id = a.question_id
           WHERE a.uid=? AND a.module IN ('changshi','yanyu','shuliang','panduan','ziliao')
           ORDER BY a.created_at""",
        (uid,),
    ).fetchall()
    exams = conn.execute(
        """SELECT per_module FROM exam_attempts
           WHERE uid=? AND submitted_at IS NOT NULL ORDER BY id DESC LIMIT 3""",
        (uid,),
    ).fetchall()
    conn.close()
    return rows, exams


@router.get("/api/predict")
def api_predict(uid: str):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rows, exams = _load_answer_rows(uid)
    total_n = len(rows)
    if total_n < COLD_START_N:
        return {"status": "cold", "n": total_n, "need": COLD_START_N}
    now = time.time()
    rows_by_mod: dict = {}
    for r in rows:
        rows_by_mod.setdefault(r["module"], []).append((r["created_at"], r["correct"] or 0, r["is_real"]))
    # 最近 3 次模考的分模块正确率（作答数加权合并）
    exam_by_mod: dict = {}
    agg: dict = {}
    for e in exams:
        pm = json.loads(e["per_module"] or "{}")
        for mod, s in pm.items():
            if mod in MOD_MAX and s.get("answered"):
                a = agg.setdefault(mod, {"answered": 0, "correct": 0})
                a["answered"] += s["answered"]
                a["correct"] += s.get("correct", 0)
    for mod, a in agg.items():
        exam_by_mod[mod] = a["correct"] / a["answered"]
    score, mods = _predict_at(rows_by_mod, now, exam_by_mod)
    # 历史曲线：近 12 周，每周分数用「截至该周末、往前 28 天窗口」内的作答计算
    history = []
    week_end = _week_start(now) + 7 * 86400
    for i in range(11, -1, -1):
        end = week_end - i * 7 * 86400
        start = end - 28 * 86400
        wnd = {m: [r for r in rs if start <= r[0] < end] for m, rs in rows_by_mod.items()}
        if sum(len(v) for v in wnd.values()) < 10:
            continue
        s, _ = _predict_at(wnd, end)
        history.append({"week_end": end, "label": time.strftime("%m/%d", time.gmtime(end - 86400 + 8 * 3600)), "score": s})
    delta = round(history[-1]["score"] - history[-2]["score"], 1) if len(history) >= 2 else None
    n_exam = len(exams)
    confidence = ("高" if total_n >= 800 and n_exam >= 3 else
                  "中高" if total_n >= 300 and n_exam >= 1 else
                  "中" if total_n >= 100 else "低")
    return {
        "status": "ok",
        "score": score,
        "n": total_n,
        "n_recent": sum(1 for r in rows if r["created_at"] >= now - RECENT_DAYS * 86400),
        "n_exam": n_exam,
        "confidence": confidence,
        "delta_week": delta,
        "modules": mods,
        "history": history,
    }


def _week_start(ts: float) -> float:
    """东八区本周一 0 点。"""
    tz = 8 * 3600
    day0 = db.cn_day_start(ts)
    weekday = int(((ts + tz) // 86400 + 4) % 7)  # 1970-01-01 是周四
    return day0 - ((weekday - 1) % 7) * 86400


# ---------- 模考排名 ----------

RANK_BUCKETS = 10


@router.get("/api/exam/rank/{attempt_id}")
def api_exam_rank(attempt_id: int, uid: str = ""):
    attempt = db.get_exam_attempt(attempt_id)
    if not attempt or not attempt["submitted_at"]:
        raise HTTPException(404, "成绩不存在")
    # attempt_id 自增可枚举，排名仅本人可查
    if attempt["uid"] != (uid.strip()[:64] or None):
        raise HTTPException(404, "成绩不存在")
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ea_paper ON exam_attempts(paper_id, submitted_at)")
    # 同卷全体用户：每人取该卷最高分（含历史作答者，冷启动分母）；探针场次剔除，本人始终在池内。
    # 迷你模考每场随机新卷（同为 30 题百分制），池按 kind=mock 全体场次，否则恒为 1/1
    paper = db.get_exam_paper(attempt["paper_id"])
    if paper and paper["kind"] == "mock":
        scope, scope_args = "paper_id IN (SELECT id FROM exam_papers WHERE kind='mock')", ()
    else:
        scope, scope_args = "paper_id=?", (attempt["paper_id"],)
    pool = f"{scope} AND submitted_at IS NOT NULL AND ({db.REAL_TRAFFIC} OR uid=?)"
    pool_args = (*scope_args, attempt["uid"])
    rows = conn.execute(
        f"SELECT uid, MAX(score) s, MIN(submitted_at) t FROM exam_attempts WHERE {pool} GROUP BY uid",
        pool_args,
    ).fetchall()
    top = sorted(rows, key=lambda r: (-r["s"], r["t"]))[:10]
    # 登录用户 uid 形如 u<id>，昵称在 users 表；匿名 uid 回落脱敏
    user_ids = [int(r["uid"][1:]) for r in top if re.fullmatch(r"u\d+", r["uid"])]
    names = {}
    if user_ids:
        marks = ",".join("?" * len(user_ids))
        try:
            names = {
                f"u{r['id']}": r["nickname"]
                for r in conn.execute(
                    f"SELECT id, nickname FROM users WHERE id IN ({marks})", user_ids
                ).fetchall()
            }
        except sqlite3.OperationalError:
            names = {}
    # 模块级全站均值：per-user-best attempt 的 per_module，按模块聚合各用户正确率均值
    pm_rows = conn.execute(
        f"""SELECT a.uid, a.per_module FROM exam_attempts a
           JOIN (SELECT uid u, MAX(score) s FROM exam_attempts
                 WHERE {pool} GROUP BY uid) b
             ON a.uid=b.u AND a.score=b.s
           WHERE a.{scope} AND a.submitted_at IS NOT NULL GROUP BY a.uid""",
        (*pool_args, *scope_args),
    ).fetchall()
    conn.close()
    mod_ratios: dict[str, list[float]] = {}
    for r in pm_rows:
        try:
            pm = json.loads(r["per_module"] or "{}")
        except (ValueError, TypeError):
            continue
        for mod, v in pm.items():
            if not isinstance(v, dict):
                continue
            qn, correct = v.get("n"), v.get("correct")
            if (isinstance(qn, (int, float)) and isinstance(correct, (int, float))
                    and not isinstance(qn, bool) and not isinstance(correct, bool) and qn > 0):
                mod_ratios.setdefault(mod, []).append(min(1.0, max(0.0, correct / qn)))
    module_avg = {
        mod: {"pct": round(100 * sum(rs) / len(rs)), "n_users": len(rs)}
        for mod, rs in mod_ratios.items()
        if len(rs) >= 2
    }
    board = [
        {
            "rank": i + 1,
            "name": db.display_alias(r["uid"], names.get(r["uid"])),
            "score": r["s"],
            "me": r["uid"] == attempt["uid"],
        }
        for i, r in enumerate(top)
    ]
    scores = sorted((r["s"] for r in rows), reverse=True)
    n = len(scores)
    my = attempt["score"]
    below = sum(1 for s in scores if s < my)
    rank = sum(1 for s in scores if s > my) + 1
    beaten = round(100 * below / n) if n > 1 else 100
    avg = round(sum(scores) / n, 1) if n else 0
    # 分数分布直方图（0-100 均分 10 桶）
    dist = [0] * RANK_BUCKETS
    for s in scores:
        dist[min(RANK_BUCKETS - 1, int(s // (100 / RANK_BUCKETS)))] += 1
    my_bucket = min(RANK_BUCKETS - 1, int(my // (100 / RANK_BUCKETS)))
    return {
        "attempt_id": attempt_id,
        "paper_id": attempt["paper_id"],
        "score": my,
        "rank": rank,
        "total": n,
        "beaten_pct": beaten,
        "avg": avg,
        "distribution": dist,
        "my_bucket": my_bucket,
        "small_sample": n < 100,
        "board": board,
        "module_avg": module_avg,
    }


# ---------- 全局搜索 ----------
#
# 13.5 万题 + 2G 服务器：LIKE 全表扫描单次 ~ 数百 ms 且占内存，改用 SQLite FTS5
# trigram 分词虚表（支持中文子串匹配，>= 3 字用索引）。外部内容表模式 + 触发器
# 增量同步（导入/更新/下架题目自动维护），首次建表在后台线程分批回填，避免阻塞启动。

_FTS_OK: bool | None = None


def _fts_ready(conn) -> bool:
    global _FTS_OK
    if _FTS_OK is False:
        return False
    try:
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS question_fts USING fts5("
            "question, content='questions', content_rowid='id', tokenize='trigram')"
        )
        # 注意：外部内容表的非 MATCH 查询（COUNT/MAX(rowid)）读的是 content 表而非索引，
        # 回填进度必须单独记在 fts_sync。
        conn.execute("CREATE TABLE IF NOT EXISTS fts_sync (k TEXT PRIMARY KEY, last_id INTEGER NOT NULL)")
        # 短词（1–2 字）搜索：trigram MATCH 仅支持 ≥3 字，单字空格分词 + phrase
        # 查询覆盖短词。contentless（content=''）：题干文本生产中不会 UPDATE，
        # 下架/删除由 JOIN questions 过滤，无需触发器，后台线程分批回填。
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS question_fts_cjk USING fts5("
            "question, content='')"
        )
        for name, ddl in [
            ("question_fts_ai", ("CREATE TRIGGER question_fts_ai AFTER INSERT ON questions BEGIN "
                                 "INSERT INTO question_fts(rowid, question) VALUES (new.id, new.question); END")),
            ("question_fts_ad", ("CREATE TRIGGER question_fts_ad AFTER DELETE ON questions BEGIN "
                                 "INSERT INTO question_fts(question_fts, rowid, question) VALUES ('delete', old.id, old.question); END")),
            ("question_fts_au", ("CREATE TRIGGER question_fts_au AFTER UPDATE OF question ON questions BEGIN "
                                 "INSERT INTO question_fts(question_fts, rowid, question) VALUES ('delete', old.id, old.question); "
                                 "INSERT INTO question_fts(rowid, question) VALUES (new.id, new.question); END")),
        ]:
            if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?", (name,)).fetchone():
                conn.execute(ddl)
        conn.commit()
        _FTS_OK = True
        return True
    except Exception:
        _FTS_OK = False
        return False


def fts_backfill(batch: int = 5000) -> int:
    """把 question_fts 尚未收录的题目分批回填；返回本次回填条数（0 = 已同步完）。"""
    conn = db.get_conn()
    if not _fts_ready(conn):
        conn.close()
        return 0
    row = conn.execute("SELECT last_id FROM fts_sync WHERE k='questions'").fetchone()
    last = row["last_id"] if row else 0
    rows = conn.execute(
        "SELECT id, question FROM questions WHERE id>? ORDER BY id LIMIT ?", (last, batch)
    ).fetchall()
    for r in rows:
        conn.execute("INSERT INTO question_fts(rowid, question) VALUES (?,?)", (r["id"], r["question"]))
    if rows:
        conn.execute(
            "INSERT INTO fts_sync (k, last_id) VALUES ('questions', ?) "
            "ON CONFLICT(k) DO UPDATE SET last_id=excluded.last_id",
            (rows[-1]["id"],),
        )
        conn.commit()
        conn.close()
        return len(rows)
    row = conn.execute("SELECT last_id FROM fts_sync WHERE k='questions_cjk'").fetchone()
    last = row["last_id"] if row else 0
    rows = conn.execute(
        "SELECT id, question FROM questions WHERE id>? ORDER BY id LIMIT ?", (last, batch)
    ).fetchall()
    for r in rows:
        conn.execute(
            "INSERT INTO question_fts_cjk(rowid, question) VALUES (?,?)",
            (r["id"], _cjk_pad(r["question"] or "")),
        )
    if rows:
        conn.execute(
            "INSERT INTO fts_sync (k, last_id) VALUES ('questions_cjk', ?) "
            "ON CONFLICT(k) DO UPDATE SET last_id=excluded.last_id",
            (rows[-1]["id"],),
        )
    conn.commit()
    conn.close()
    return len(rows)


def _cjk_pad(s: str) -> str:
    """逐字空格分隔，供 unicode61 单字分词；原有空白压缩丢弃。"""
    return " ".join(ch for ch in s if not ch.isspace())


_QCODE_RE = re.compile(r"^[A-Za-z]{2}(-[A-Za-z0-9]{1,6})*-\d{1,6}$")


def _q_brief(d: dict) -> dict:
    return {
        "id": d["id"],
        "code": qcode.build_code(d),
        "question": (d.get("question") or "")[:120],
        "module": d.get("module"),
        "submodule": d.get("submodule"),
        "is_real": d.get("is_real") or 0,
        "exam_year": d.get("exam_year"),
        "exam_region": d.get("exam_region"),
        "correct_ratio": d.get("correct_ratio"),
    }


def _search_topics(q: str, limit: int = 5) -> list[dict]:
    out = []
    counts = db.tag3_counts()
    for code, t in taxonomy.topic_index().items():
        if q in t["name"] or q in (t.get("desc") or ""):
            out.append({
                "code": code, "name": t["name"], "module": t["module"],
                "module_name": t["module_name"], "group_name": t["group_name"],
                "n": counts.get(code, 0),
            })
    out.sort(key=lambda x: (-(q in x["name"]), -x["n"]))
    return out[:limit]


@router.get("/api/search")
def api_search(q: str, type: str = "all", limit: int = 20, offset: int = 0):
    q = (q or "").strip()
    if not q:
        raise HTTPException(400, "缺少关键词")
    q = q[:80]
    limit = min(max(limit, 1), 50)
    out: dict = {"q": q}
    # 题号语义码（如 ZL-JQ-2024-000914）或纯数字 id 直达
    if _QCODE_RE.match(q) or q.isdigit():
        qid = qcode.parse_qid(q)
        if qid:
            hit = db.questions_by_ids([qid])
            if hit:
                out["code_hit"] = _q_brief(hit[0])
                return out
    if type in ("all", "topic"):
        out["topics"] = _search_topics(q)
    if type in ("all", "paper"):
        conn = db.get_conn()
        db._ensure_exam_tables(conn)
        rows = conn.execute(
            "SELECT id, title, kind, year, region FROM exam_papers "
            "WHERE title LIKE '%' || ? || '%' ORDER BY year DESC LIMIT 10",
            (q,),
        ).fetchall()
        conn.close()
        out["papers"] = [dict(r) for r in rows]
    if type in ("all", "question"):
        out["questions"] = _search_questions(q, limit, offset)
    if type in ("all", "shenlun"):
        out["shenlun"] = db.search_shenlun(q)
        out["shenlun_mats"] = db.search_shenlun_materials(q)
    return out


@router.get("/api/search/question/{qid}")
def api_search_question(qid: int):
    hit = db.questions_by_ids([qid])
    if not hit:
        raise HTTPException(404, "题目不存在")
    d = hit[0]
    return {**_q_brief(d), "question": d.get("question"), "options": d.get("options"),
            "answer": d.get("answer"), "explanation": d.get("explanation"), "tag3": d.get("tag3")}


def _search_questions(q: str, limit: int, offset: int) -> dict:
    conn = db.get_conn()
    use_fts = _fts_ready(conn)
    if use_fts:
        # 回填未完成时 FTS 结果不全，剩余部分仍走 LIKE 兜底
        sync_key = "questions" if len(q) >= 3 else "questions_cjk"
        row = conn.execute("SELECT last_id FROM fts_sync WHERE k=?", (sync_key,)).fetchone()
        total_q = conn.execute("SELECT COALESCE(MAX(id),0) FROM questions").fetchone()[0]
        use_fts = bool(row) and row["last_id"] >= total_q
    try:
        if use_fts:
            if len(q) >= 3:
                tbl = "question_fts"
                match = '"' + q.replace('"', '""') + '"'
            else:
                # trigram MATCH 仅支持 ≥3 字；短词走单字分词表 phrase 查询
                tbl = "question_fts_cjk"
                match = '"' + _cjk_pad(q).replace('"', '""') + '"'
            total = conn.execute(
                f"""SELECT COUNT(*) FROM {tbl} f JOIN questions x ON x.id=f.rowid
                   WHERE {tbl} MATCH ? AND (x.disabled IS NULL OR x.disabled=0)""",
                (match,),
            ).fetchone()[0]
            rows = conn.execute(
                f"""SELECT x.* FROM {tbl} f JOIN questions x ON x.id=f.rowid
                   WHERE {tbl} MATCH ? AND (x.disabled IS NULL OR x.disabled=0)
                   ORDER BY x.is_real DESC, x.id DESC LIMIT ? OFFSET ?""",
                (match, limit, offset),
            ).fetchall()
        else:
            raise RuntimeError("fts unavailable")
    except Exception:
        # 兜底：LIKE 扫描（短词/无 FTS 时），限制返回量
        rows = conn.execute(
            """SELECT * FROM questions WHERE question LIKE '%' || ? || '%'
               AND disabled=0
               ORDER BY is_real DESC LIMIT ? OFFSET ?""",
            (q, limit, offset),
        ).fetchall()
        total = offset + len(rows) + (1 if len(rows) == limit else 0)
    conn.close()
    return {"total": total, "items": [_q_brief(dict(r)) for r in rows]}


# ---------- 考点掌握度地图（spec-02）----------


@router.get("/api/mastery/map")
def api_mastery_map(uid: str):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.mastery_snapshot(uid)


@router.get("/api/mastery/topic")
def api_mastery_topic(uid: str, tag3: str):
    uid = uid.strip()[:64]
    tag3 = tag3.strip()[:32]
    if not uid or not tag3:
        raise HTTPException(400, "缺少 uid 或 tag3")
    if tag3 not in taxonomy.topic_index():
        raise HTTPException(404, "考点不存在")
    return db.mastery_topic(uid, tag3)


# ---------- 错题 → 同考点强化（spec-03）----------


@router.get("/api/reinforce/suggest")
def api_reinforce_suggest(uid: str):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.reinforce_candidates(uid)
