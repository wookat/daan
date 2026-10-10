"""py 拆分之 exam 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import hashlib
import json
import secrets
import sqlite3
import threading
import time

from . import db

__all__ = ["_answer_state", "_compose_paper", "_dominant_paper_source", "_ensure_exam_progress", "_ensure_exam_tables", "_list_exam_papers_base", "_paper_by_psource", "_paper_module_counts", "_refresh_papers_cache", "claim_paper_submit", "clear_exam_progress", "create_mock_paper", "create_template_paper", "exam_active_qids", "exam_paper_filters", "exam_paper_social", "finish_exam_attempt", "get_exam_attempt", "get_exam_paper", "get_paper_export", "latest_exam_progress", "list_exam_attempts", "list_exam_papers", "list_papers", "paper_picks_hash", "paper_questions", "paper_submitted_pages", "save_exam_progress", "save_paper_export", "start_exam_attempt", "upsert_exam_paper", "weak_tag3s"]


def list_papers() -> list[dict]:
    """从真题 source 派生真题套卷列表（≥40 题视为整卷）。"""
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT source, COUNT(*) n, MAX(exam_year) y, MAX(exam_region) rg
           FROM questions
           WHERE is_real=1 AND disabled=0 AND source IS NOT NULL AND source!=''
           GROUP BY source HAVING n>=40
           ORDER BY y DESC, n DESC"""
    ).fetchall()
    conn.close()
    papers = []
    seen = set()
    for r in rows:
        m = db._PAPER_TITLE_RE.search(r["source"] or "")
        if not m:
            continue
        title = m.group(1)
        if title in seen:
            continue
        seen.add(title)
        papers.append({"title": title, "source": r["source"], "n": r["n"], "year": r["y"], "region": r["rg"]})
    return papers[:120]


def _answer_state(conn, uid: str) -> tuple[set[int], set[int]]:
    """本人作答状态：(已作答题 id 集, 最近一次答错题 id 集)。correct 非 0 视为非错（fail-closed）。"""
    db._ensure_answer_log(conn)
    latest: dict[int, int | None] = {}
    for r in conn.execute(
        "SELECT question_id, correct FROM answer_log"
        " WHERE uid=? AND question_id IS NOT NULL ORDER BY created_at, id",
        (uid,),
    ):
        latest[r["question_id"]] = r["correct"]
    return set(latest), {q for q, c in latest.items() if c == 0}


def paper_questions(source: str, limit: int = 140, uid: str | None = None,
                    pid: int | None = None) -> list[dict]:
    conn = db.get_conn()
    rows: list[sqlite3.Row] = []
    if pid:
        paper = get_exam_paper(pid)
        qids: list[int] = (paper or {}).get("question_ids") or []
        if qids:
            by_id: dict[int, sqlite3.Row] = {}
            for chunk_start in range(0, len(qids), 900):
                chunk = qids[chunk_start:chunk_start + 900]
                for r in conn.execute(
                    f"SELECT * FROM questions WHERE disabled=0 AND id IN ({','.join('?' * len(chunk))})",
                    chunk,
                ):
                    by_id[r["id"]] = r
            rows = [by_id[i] for i in qids if i in by_id]
    if not rows:
        rows = conn.execute(
            """SELECT * FROM questions
               WHERE source=? AND is_real=1 AND disabled=0
               ORDER BY id LIMIT ?""",
            (source, limit),
        ).fetchall()
    done_qids: set[int] = set()
    wrong_qids: set[int] = set()
    if uid and rows:
        done_qids, wrong_qids = _answer_state(conn, uid)
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        if uid:
            d["done"] = d["id"] in done_qids
            d["wrong"] = d["id"] in wrong_qids
        out.append(d)
    return out


def save_paper_export(code: str, question_ids: list[int], title: str, inline_n: int = 0) -> None:
    """inline_n：卷内无题库 id 的内联题（时政/手录）数，不占答题卡槽位、不参与机读判分；
    供 paper/{code}、paper_answers、scan_sheet 回包向用户说明「卷有 N+M 题、只判 N 题」。"""
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS paper_exports (
            code TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            title TEXT,
            question_ids TEXT NOT NULL
        )"""
    )
    db.add_column_if_missing(conn, "paper_exports", "inline_n", "INTEGER DEFAULT 0")
    conn.execute(
        "INSERT OR REPLACE INTO paper_exports (code, created_at, title, question_ids, inline_n) VALUES (?,?,?,?,?)",
        (code, time.time(), title, json.dumps(question_ids), int(inline_n or 0)),
    )
    conn.commit()
    conn.close()


def paper_picks_hash(items: list[dict]) -> str:
    """同一 uid 对同一卷同一页提交的「有效作答集合」指纹（question_id + 归一后 picked）；
    空白/多涂行不落库故不入指纹。"""
    parts = sorted(f"{it.get('question_id')}:{db.normalize_answer(it.get('picked'))}" for it in items)
    return hashlib.sha1("|".join(parts).encode()).hexdigest()


def claim_paper_submit(uid: str, code: str, page: int, picks_hash: str) -> float | None:
    """记一次判分提交；同 (uid, code, page, 指纹) 已存在时不写并返回首次提交时刻，供调用方跳过重复落库。
    同卷同页但答案不同视为新一次作答（正常返回 None）。"""
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS paper_submits (
            uid TEXT NOT NULL,
            code TEXT NOT NULL,
            page INTEGER NOT NULL,
            picks_hash TEXT NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (uid, code, page, picks_hash)
        )"""
    )
    now = time.time()
    cur = conn.execute(
        "INSERT OR IGNORE INTO paper_submits (uid, code, page, picks_hash, created_at) VALUES (?,?,?,?,?)",
        (uid, code, int(page), picks_hash, now),
    )
    claimed = cur.rowcount == 1
    if claimed:
        conn.commit()
        conn.close()
        return None
    prev = conn.execute(
        "SELECT created_at FROM paper_submits WHERE uid=? AND code=? AND page=? AND picks_hash=?",
        (uid, code, int(page), picks_hash),
    ).fetchone()
    conn.close()
    return float(prev["created_at"]) if prev else now


def paper_submitted_pages(uid: str, code: str) -> list[dict]:
    """该 uid 对该卷已判过分的页（手动录入整卷 page 0、扫描答题卡 1..P）：每页首次/最近提交时刻与不同作答次数；表未建（从未有人判过分）返回空。"""
    if not uid or not code:
        return []
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT page, MIN(created_at) AS first_at, MAX(created_at) AS last_at, COUNT(*) AS n "
            "FROM paper_submits WHERE uid=? AND code=? GROUP BY page ORDER BY page",
            (uid, code),
        ).fetchall()
    except sqlite3.OperationalError:
        rows = []
    conn.close()
    return [
        {"page": int(r["page"]), "first_at": float(r["first_at"]), "last_at": float(r["last_at"]), "n": int(r["n"])}
        for r in rows
    ]


def get_paper_export(code: str) -> dict | None:
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM paper_exports WHERE code=?", (code,)
        ).fetchone()
    except sqlite3.OperationalError:
        row = None
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["question_ids"] = json.loads(d["question_ids"] or "[]")
    d["inline_n"] = int(d.get("inline_n") or 0)
    return d


def _paper_by_psource(conn) -> dict[str, dict]:
    """真题卷 psource → {pid, title, psource}；同 source 多卷取 id 最大（最新）一张。
    只看 kind=zhenti（mock 卷随机组题无主 source），与 H5 卷库 `kind=zhenti` 共用同一缓存键。"""
    _ensure_exam_tables(conn)
    out: dict[str, dict] = {}
    for p in _list_exam_papers_base(conn, "zhenti", None, None):
        src = p.get("psource")
        if not src:
            continue
        cur = out.get(src)
        if cur is None or p["id"] > cur["pid"]:
            out[src] = {"pid": p["id"], "title": p["title"], "psource": src}
    return out


def _ensure_exam_tables(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS exam_papers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT UNIQUE NOT NULL,
            kind TEXT NOT NULL DEFAULT 'zhenti',
            year INTEGER,
            region TEXT,
            question_ids TEXT NOT NULL,
            duration_min INTEGER NOT NULL DEFAULT 120,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS exam_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            paper_id INTEGER NOT NULL,
            started_at REAL NOT NULL,
            submitted_at REAL,
            answers TEXT,
            score REAL,
            per_module TEXT
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ep_kind ON exam_papers(kind, year, region)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ea_uid ON exam_attempts(uid, paper_id, id)")
    db.add_column_if_missing(conn, "exam_attempts", "secs", "TEXT")
    db.add_column_if_missing(conn, "exam_attempts", "marks", "TEXT")
    db.add_column_if_missing(conn, "exam_attempts", "probe", "INTEGER")
    db.add_column_if_missing(conn, "exam_attempts", "question_ids", "TEXT")


def upsert_exam_paper(title: str, kind: str, year: int | None, region: str | None,
                      question_ids: list[int], duration_min: int) -> int:
    """按 title 幂等落卷（重跑成卷脚本不产生重复卷）。"""
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    conn.execute(
        """INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(title) DO UPDATE SET
             kind=excluded.kind, year=excluded.year, region=excluded.region,
             question_ids=excluded.question_ids, duration_min=excluded.duration_min""",
        (title, kind, year, region, json.dumps(question_ids), duration_min, time.time()),
    )
    conn.commit()
    pid = conn.execute("SELECT id FROM exam_papers WHERE title=?", (title,)).fetchone()["id"]
    conn.close()
    db._papers_cache.clear()
    return pid


def _refresh_papers_cache(key: tuple) -> None:
    conn = db.get_conn()
    try:
        _list_exam_papers_base(conn, *key, force=True)
    finally:
        conn.close()
        with db._papers_lock:
            db._papers_refreshing.discard(key)


def _dominant_paper_source(qids: list[int], src_by_qid: dict[int, str]) -> str | None:
    """卷内活跃真题占多数的 source；不足 _PSOURCE_MIN_N 题回 None（fail-closed）。"""
    counts: dict[str, int] = {}
    for i in qids:
        s = src_by_qid.get(i)
        if s:
            counts[s] = counts.get(s, 0) + 1
    if not counts:
        return None
    src, n = max(counts.items(), key=lambda kv: kv[1])
    return src if n >= db._PSOURCE_MIN_N else None


def _paper_module_counts(qids: list[int], mod_by_qid: dict[int, str]) -> dict[str, int]:
    """卷内活跃题按行测五模块计数（只含 >0 的模块，按标准模块顺序）；让卷卡如实外显回忆版卷的构成/缺项。"""
    counts = {m: 0 for m in db.MODULE_ORDER}
    for i in qids:
        m = mod_by_qid.get(i)
        if m:
            counts[m] += 1
    return {m: n for m, n in counts.items() if n}


def _list_exam_papers_base(conn, kind: str | None, year: int | None,
                           region: str | None, force: bool = False) -> list[dict]:
    """uid 无关的卷列表（含活跃题数 n / takers），按筛选键 TTL 缓存；
    过期后返回旧值并起后台线程刷新（stale-while-revalidate）。"""
    key = (kind, year, region)
    hit = db._papers_cache.get(key)
    if hit and not force:
        if time.time() - hit[0] >= db._PAPERS_CACHE_TTL:
            with db._papers_lock:
                if key not in db._papers_refreshing:
                    db._papers_refreshing.add(key)
                    threading.Thread(target=_refresh_papers_cache, args=(key,), daemon=True).start()
        return hit[1]
    where = ["1=1"]
    args: list = []
    if kind:
        where.append("kind=?")
        args.append(kind)
    if year:
        where.append("year=?")
        args.append(year)
    if region:
        where.append("region=?")
        args.append(region)
    rows = conn.execute(
        f"""SELECT id, title, kind, year, region, question_ids, duration_min, created_at
            FROM exam_papers WHERE {' AND '.join(where)}
            ORDER BY year DESC, id DESC LIMIT 500""",
        args,
    ).fetchall()
    takers: dict[int, dict] = {}
    if rows:
        for t in conn.execute(
            f"""SELECT paper_id, COUNT(*) n, ROUND(AVG(s), 1) avg FROM (
                 SELECT paper_id, uid, MAX(score) s FROM exam_attempts
                 WHERE submitted_at IS NOT NULL AND {db.REAL_TRAFFIC} GROUP BY paper_id, uid
               ) GROUP BY paper_id"""
        ):
            takers[t["paper_id"]] = {"n": t["n"], "avg": t["avg"]}
    qids_by_paper = {r["id"]: json.loads(r["question_ids"] or "[]") for r in rows}
    all_ids = list({i for ids in qids_by_paper.values() for i in ids})
    active: set[int] = set()
    src_by_qid: dict[int, str] = {}
    mod_by_qid: dict[int, str] = {}
    for chunk_start in range(0, len(all_ids), 900):
        chunk = all_ids[chunk_start:chunk_start + 900]
        for q in conn.execute(
            f"SELECT id, source, is_real FROM questions WHERE disabled=0 AND id IN ({','.join('?' * len(chunk))})",
            chunk,
        ):
            active.add(q["id"])
            if q["is_real"] and q["source"]:
                src_by_qid[q["id"]] = q["source"]
    # module 单独查走 idx_q_disabled_module 覆盖索引（每次 IN 整段扫，尽量一次带全，不回宽行表）
    for chunk_start in range(0, len(all_ids), 30000):
        chunk = all_ids[chunk_start:chunk_start + 30000]
        for q in conn.execute(
            f"SELECT id, module FROM questions WHERE disabled=0 AND id IN ({','.join('?' * len(chunk))})",
            chunk,
        ):
            if q["module"] in db.MODULE_ORDER:
                mod_by_qid[q["id"]] = q["module"]
    base = []
    for r in rows:
        d = dict(r)
        d.pop("question_ids")
        d["_qids"] = [i for i in qids_by_paper[d["id"]] if i in active]
        d["n"] = len(d["_qids"])
        d["mods"] = _paper_module_counts(d["_qids"], mod_by_qid)
        d["psource"] = _dominant_paper_source(qids_by_paper[d["id"]], src_by_qid)
        soc = takers.get(d["id"])
        if soc and soc["n"] >= db._SOCIAL_MIN_N:
            d["takers"], d["avg_score"] = soc["n"], soc["avg"]
        else:
            d["takers"], d["avg_score"] = 0, None
        base.append(d)
    db._papers_cache[key] = (time.time(), base)
    return base


def list_exam_papers(kind: str | None = None, year: int | None = None,
                     region: str | None = None, uid: str | None = None) -> list[dict]:
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    base = _list_exam_papers_base(conn, kind, year, region)
    best: dict[int, dict] = {}
    if uid and base:
        for b in conn.execute(
            """SELECT paper_id, id, score FROM exam_attempts
               WHERE uid=? AND submitted_at IS NOT NULL""",
            (uid,),
        ):
            cur = best.get(b["paper_id"])
            if cur is None:
                best[b["paper_id"]] = {
                    "best_score": b["score"], "attempt_count": 1,
                    "best_attempt_id": b["id"],
                }
            else:
                cur["attempt_count"] += 1
                s = b["score"] if b["score"] is not None else 0
                bs = cur["best_score"] if cur["best_score"] is not None else 0
                if s > bs or (s == bs and b["id"] > cur["best_attempt_id"]):
                    cur["best_score"] = b["score"]
                    cur["best_attempt_id"] = b["id"]
    done_qids: set[int] = set()
    wrong_qids: set[int] = set()
    if uid and base:
        done_qids, wrong_qids = _answer_state(conn, uid)
    conn.close()
    out = []
    for d in base:
        d = dict(d)
        qids = d.pop("_qids", [])
        d["practiced"] = sum(1 for i in qids if i in done_qids) if done_qids else 0
        d["wrong"] = sum(1 for i in qids if i in wrong_qids) if wrong_qids else 0
        d.update(best.get(d["id"], {
            "best_score": None, "attempt_count": 0, "best_attempt_id": None,
        }))
        out.append(d)
    return out


def exam_active_qids(question_ids: list[int]) -> list[int]:
    active = {q["id"] for q in db.questions_by_ids(question_ids) if not q.get("disabled")}
    return [i for i in question_ids if i in active]


def exam_paper_filters(kind: str = 'zhenti') -> dict:
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    years = [dict(r) for r in conn.execute(
        "SELECT year y, COUNT(*) n FROM exam_papers WHERE kind=? AND year IS NOT NULL "
        "GROUP BY year ORDER BY year DESC", (kind,))]
    regions = [dict(r) for r in conn.execute(
        "SELECT region r, COUNT(*) n FROM exam_papers WHERE kind=? AND region IS NOT NULL AND region!='' "
        "GROUP BY region ORDER BY n DESC", (kind,))]
    conn.close()
    return {"years": years, "regions": regions}


def exam_paper_social(pid: int) -> dict:
    """同卷全体用户社会证明：每人取最高分（与模考排名口径一致，只算真人）。"""
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    rows = conn.execute(
        f"""SELECT uid, MAX(score) s FROM exam_attempts
           WHERE paper_id=? AND submitted_at IS NOT NULL AND {db.REAL_TRAFFIC} GROUP BY uid""",
        (pid,),
    ).fetchall()
    conn.close()
    n = len(rows)
    avg = round(sum(r["s"] for r in rows) / n, 1) if n else 0
    return {"n": n, "avg": avg}


def get_exam_paper(pid: int) -> dict | None:
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    row = conn.execute("SELECT * FROM exam_papers WHERE id=?", (pid,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["question_ids"] = json.loads(d["question_ids"] or "[]")
    return d


def create_mock_paper(n: int = 30, duration_min: int = 30) -> int:
    """迷你模考：随机组 n 题（按行测模块顺序），kind=mock 即时生成。"""
    share = {"changshi": 0.15, "yanyu": 0.3, "shuliang": 0.1, "panduan": 0.3, "ziliao": 0.15}
    counts = {mod: max(1, round(n * share[mod])) for mod in db.MODULE_ORDER}
    return _compose_paper("迷你模考", counts, n, duration_min)


def _compose_paper(title_prefix: str, counts: dict, total: int, duration_min: int,
                   weak: set | None = None) -> int:
    """按模块题量分布抽题组卷（kind=mock）；weak（薄弱考点 tag3 集）非空时，
    每模块先抽薄弱考点题（至多六成名额），再随机补齐——显著抬高薄弱占比同时保住卷型结构。"""
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    weak = weak or set()
    ids: list[int] = []
    for mod in db.MODULE_ORDER:
        want = max(0, int(counts.get(mod) or 0))
        if not want:
            continue
        picked: list[int] = []
        if weak:
            marks = ",".join("?" * len(weak))
            picked = [r["id"] for r in conn.execute(
                f"SELECT id FROM questions WHERE module=? AND disabled=0 AND tag3 IN ({marks}) "
                "ORDER BY RANDOM() LIMIT ?", (mod, *weak, max(1, round(want * 0.6))))]
        left = want - len(picked)
        if left > 0:
            ph = ",".join("?" * len(picked)) or "0"
            picked += [r["id"] for r in conn.execute(
                f"SELECT id FROM questions WHERE module=? AND disabled=0 AND id NOT IN ({ph}) "
                "ORDER BY has_hs DESC, RANDOM() LIMIT ?", (mod, *picked, left))]
        ids += picked[:want]
    if len(ids) < total:
        placeholders = ",".join("?" * len(ids)) or "0"
        ids += [r["id"] for r in conn.execute(
            f"SELECT id FROM questions WHERE disabled=0 AND id NOT IN ({placeholders}) "
            "ORDER BY RANDOM() LIMIT ?", (*ids, total - len(ids)))]
    ids = ids[:total]
    title = title_prefix + " " + time.strftime("%m-%d %H:%M:%S") + " #" + secrets.token_hex(3)
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (title, "mock", None, None, json.dumps(ids), duration_min, time.time()),
    )
    conn.commit()
    pid = conn.execute("SELECT id FROM exam_papers WHERE title=?", (title,)).fetchone()["id"]
    conn.close()
    db._papers_cache.clear()
    return pid


def create_template_paper(name: str, counts: dict, duration_min: int,
                          weak: set | None = None, boost: bool = False) -> int:
    """省份卷型模板组卷：title 前缀体现模板与是否薄弱加权，题量严格按模板 counts。"""
    prefix = name + (" · 薄弱加权" if boost and weak else "")
    return _compose_paper(prefix, counts, sum(counts.values()), duration_min, weak if boost else None)


def weak_tag3s(uid: str, min_n: int = 3, max_acc: float = 0.6, limit: int = 15) -> set:
    """本人薄弱考点 tag3 集：作答 ≥min_n 且正确率 <max_acc，按正确率升序取前 limit。
    供组卷「按薄弱点加权」——样本不足时返回空集（不加权，退化为普通模板卷）。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT q.tag3, COUNT(*) n, SUM(a.correct) c
           FROM answer_log a JOIN questions q ON q.id = a.question_id
           WHERE a.uid=? AND q.tag3 IS NOT NULL AND q.tag3!='' AND q.tag3!='UNKNOWN'
           GROUP BY q.tag3 HAVING n>=? AND (c*1.0/n)<?
           ORDER BY (c*1.0/n) LIMIT ?""",
        (uid, min_n, max_acc, limit),
    ).fetchall()
    conn.close()
    return {r["tag3"] for r in rows}


def start_exam_attempt(uid: str, paper_id: int, probe: bool = False,
                       question_ids: list[int] | None = None) -> int:
    """开考建 attempt；顺带清掉本人过期未交卷的，以及同卷「进过页面但一题未答」的空场次（连同进度行）。
    probe=True 标记探针场次：同卷人数/均分/排行榜/分数池等跨用户聚合剔除，本人报告不受影响。
    question_ids 为下发题序快照，判分/报告按它对位，不受事后禁题影响。"""
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    _ensure_exam_progress(conn)
    stale = [r[0] for r in conn.execute(
        """SELECT a.id FROM exam_attempts a
           WHERE a.uid=? AND a.submitted_at IS NULL
             AND (a.started_at<? OR (a.paper_id=? AND NOT EXISTS (
                   SELECT 1 FROM exam_progress g
                   WHERE g.attempt_id=a.id AND g.picks IS NOT NULL AND g.picks NOT IN ('', '{}'))))""",
        (uid, time.time() - 86400, paper_id),
    ).fetchall()]
    if stale:
        marks = ",".join("?" * len(stale))
        conn.execute(f"DELETE FROM exam_progress WHERE attempt_id IN ({marks})", stale)
        conn.execute(f"DELETE FROM exam_attempts WHERE id IN ({marks})", stale)
    cur = conn.execute(
        "INSERT INTO exam_attempts (uid, paper_id, started_at, probe, question_ids) VALUES (?,?,?,?,?)",
        (uid, paper_id, time.time(), 1 if probe else 0,
         json.dumps(question_ids) if question_ids else None),
    )
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return aid


def finish_exam_attempt(attempt_id: int, answers: dict, score: float, per_module: dict,
                        secs: dict | None = None, marks: list | None = None) -> bool:
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    cur = conn.execute(
        "UPDATE exam_attempts SET submitted_at=?, answers=?, score=?, per_module=?, secs=?, marks=? "
        "WHERE id=? AND submitted_at IS NULL",
        (time.time(), json.dumps(answers, ensure_ascii=False), score,
         json.dumps(per_module, ensure_ascii=False),
         json.dumps({str(k): v for k, v in (secs or {}).items()}) if secs else None,
         json.dumps(marks) if marks else None, attempt_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def get_exam_attempt(attempt_id: int) -> dict | None:
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    row = conn.execute("SELECT * FROM exam_attempts WHERE id=?", (attempt_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["answers"] = json.loads(d["answers"] or "{}")
    d["per_module"] = json.loads(d["per_module"] or "{}")
    d["secs"] = json.loads(d.get("secs") or "{}")
    d["marks"] = json.loads(d.get("marks") or "[]")
    d["question_ids"] = json.loads(d.get("question_ids") or "[]")
    return d


def _ensure_exam_progress(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS exam_progress (
            attempt_id INTEGER PRIMARY KEY,
            uid TEXT NOT NULL,
            picks TEXT NOT NULL,
            idx INTEGER NOT NULL DEFAULT 0,
            updated_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_egp_uid ON exam_progress(uid)")
    gcols = {r["name"] for r in conn.execute("PRAGMA table_info(exam_progress)")}
    if "marks" not in gcols:
        conn.execute("ALTER TABLE exam_progress ADD COLUMN marks TEXT")
    if "secs" not in gcols:
        conn.execute("ALTER TABLE exam_progress ADD COLUMN secs TEXT")
    if "excl" not in gcols:
        conn.execute("ALTER TABLE exam_progress ADD COLUMN excl TEXT")


def save_exam_progress(attempt_id: int, uid: str, picks: dict, idx: int,
                       marks: list | None = None, secs: dict | None = None,
                       excl: dict | None = None) -> None:
    conn = db.get_conn()
    _ensure_exam_progress(conn)
    conn.execute(
        """INSERT INTO exam_progress (attempt_id, uid, picks, idx, marks, secs, excl, updated_at)
           VALUES (?,?,?,?,?,?,?,?)
           ON CONFLICT(attempt_id) DO UPDATE SET
             picks=excluded.picks, idx=excluded.idx, marks=excluded.marks,
             secs=excluded.secs, excl=excluded.excl, updated_at=excluded.updated_at""",
        (attempt_id, uid, json.dumps(picks), idx,
         json.dumps(marks) if marks else None,
         json.dumps(secs) if secs else None,
         json.dumps(excl) if excl else None, time.time()),
    )
    conn.commit()
    conn.close()


def clear_exam_progress(attempt_id: int) -> None:
    conn = db.get_conn()
    _ensure_exam_progress(conn)
    conn.execute("DELETE FROM exam_progress WHERE attempt_id=?", (attempt_id,))
    conn.commit()
    conn.close()


def latest_exam_progress(uid: str) -> dict | None:
    """最近一场未交卷且未超时、有进度行的模考（供跨设备续考）。"""
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    _ensure_exam_progress(conn)
    row = conn.execute(
        """SELECT g.attempt_id, g.picks, g.idx, g.marks, g.secs, g.excl, a.paper_id, a.started_at, p.duration_min
           FROM exam_progress g
           JOIN exam_attempts a ON a.id = g.attempt_id
           JOIN exam_papers p ON p.id = a.paper_id
           WHERE g.uid=? AND a.submitted_at IS NULL AND a.started_at + p.duration_min * 60 > ?
           ORDER BY g.attempt_id DESC LIMIT 1""",
        (uid, time.time()),
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["picks"] = json.loads(d["picks"] or "{}")
    d["marks"] = json.loads(d.get("marks") or "[]")
    d["secs"] = json.loads(d.get("secs") or "{}")
    d["excl"] = json.loads(d.get("excl") or "{}")
    return d


def list_exam_attempts(uid: str, paper_id: int | None = None, limit: int = 50) -> list[dict]:
    conn = db.get_conn()
    _ensure_exam_tables(conn)
    where = "a.uid=? AND a.submitted_at IS NOT NULL"
    args: list = [uid]
    if paper_id:
        where += " AND a.paper_id=?"
        args.append(paper_id)
    rows = conn.execute(
        f"""SELECT a.id, a.paper_id, a.started_at, a.submitted_at, a.score, a.per_module,
                   p.title, p.kind, p.year, p.region, p.duration_min
            FROM exam_attempts a JOIN exam_papers p ON p.id=a.paper_id
            WHERE {where} ORDER BY a.id DESC LIMIT ?""",
        (*args, min(max(limit, 0), 100)),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["per_module"] = json.loads(d["per_module"] or "{}")
        out.append(d)
    return out


