"""py 拆分之 mastery 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import time

from . import db, difficulty, taxonomy

__all__ = ["_answered_qids", "_avail_new_count", "_due_by_tag3", "_ensure_reinforce_log", "_mastery_level", "_mastery_value", "_reinforce_log_add", "_score_skill", "mastery_snapshot", "mastery_topic", "recommend_stats", "reinforce_candidates", "reinforce_done_today", "reinforce_questions", "today_skill_count"]


def _score_skill(seq: list[int], last: float, mod: str, now: float) -> tuple[float, float, str]:
    n = len(seq)
    c = sum(seq)
    acc = (c + 3 * 0.6) / (n + 3)
    trend = 0.0
    if n >= 10:
        recent = seq[-20:]
        prev = seq[-40:-20] or seq[:-20]
        if prev:
            trend = sum(recent) / len(recent) - sum(prev) / len(prev)
    days = (now - last) / 86400
    stab = min(60.0, max(2.0, 2 + 0.6 * c))
    forget = 1 - (1 + 19 / 81 * days / stab) ** -0.5
    freq = db.FREQ_WEIGHT.get(mod, 0.5)
    w = 0.45 * (1 - acc) + 0.2 * max(0.0, -trend) + 0.2 * forget + 0.15 * freq
    reason = (
        "近期退步" if trend < -0.1 else
        "正确率偏低" if acc < 0.6 else
        "久未练习" if forget > 0.4 else "巩固提升"
    )
    return w, trend, reason


def recommend_stats(uid: str, top: int = 3) -> dict:
    """规则版查漏补缺：按三级考点（tag3）算弱项分数，样本不足回退二级题型。

    分数 = 平滑正确率 + 近期趋势 + 遗忘 + 考频。tag3 取题库当前值（join questions），
    同一考点作答 >= TAG3_MIN_N 才单独成项，其余作答归入所属二级题型项。
    """
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.module, a.submodule, a.correct, a.created_at, q.tag3
           FROM answer_log a LEFT JOIN questions q ON q.id = a.question_id
           WHERE a.uid=? AND a.submodule IS NOT NULL AND a.submodule!=''
           ORDER BY a.created_at""",
        (uid,),
    ).fetchall()
    conn.close()
    tidx = taxonomy.topic_index()
    topics: dict = {}
    for r in rows:
        tag3 = r["tag3"] if r["tag3"] and r["tag3"] != "UNKNOWN" and r["tag3"] in tidx else None
        k = (r["module"] or "", r["submodule"], tag3)
        topics.setdefault(k, []).append((r["created_at"], 1 if r["correct"] else 0))
    skills: dict = {}
    for (mod, sub, tag3), recs in topics.items():
        if tag3 and len(recs) >= db.TAG3_MIN_N:
            skills[(mod, sub, tag3)] = recs
        else:
            skills.setdefault((mod, sub, None), []).extend(recs)
    now = time.time()
    out = []
    for (mod, sub, tag3), recs in skills.items():
        recs.sort()
        seq = [c for _, c in recs]
        n = len(seq)
        if n < 3:
            continue
        c = sum(seq)
        w, _trend, reason = _score_skill(seq, recs[-1][0], mod, now)
        item = {
            "module": mod, "submodule": sub, "n": n,
            "acc": round(c / n, 3), "weakness": round(w, 3), "reason": reason,
        }
        if tag3:
            t = tidx[tag3]
            item["tag3"] = tag3
            item["tag3_name"] = t["name"]
            item["label"] = f"{t['module_name']}·{t['name']}"
        out.append(item)
    out.sort(key=lambda x: -x["weakness"])
    return {"items": out[:top], "total_skills": len(out)}


def _mastery_value(n: int, c: int, last: float, now: float) -> float:
    """掌握度 = 贝叶斯平滑正确率 × 时间衰减分量（久不练最多打 6 折）。"""
    acc_s = (c + db.MASTERY_PRIOR_K * db.MASTERY_PRIOR_ACC) / (n + db.MASTERY_PRIOR_K)
    decay = 0.5 ** ((now - last) / 86400 / db.MASTERY_HALF_LIFE_DAYS)
    return acc_s * (0.6 + 0.4 * decay)


def _mastery_level(n: int, m: float) -> tuple[str, str]:
    if n <= 0:
        return "untouched", "未接触"
    for key, name, hi in db.MASTERY_LEVELS:
        if m < hi:
            return key, name
    return "jingtong", "精通"


def _due_by_tag3(conn, uid: str | None) -> dict:
    """各三级考点当前到期错题数（uid 严格隔离）。"""
    db._ensure_mistake_uid(conn)
    cl, args = db._uid_clause(uid)
    rows = conn.execute(
        f"""SELECT q.tag3 t3, COUNT(*) n FROM mistakes m
            JOIN questions q ON q.id=m.question_id
            WHERE (m.mastered IS NULL OR m.mastered=0)
              AND (m.next_review IS NULL OR m.next_review<=?)
              AND q.tag3 IS NOT NULL AND q.tag3!=''{cl}
            GROUP BY q.tag3""",
        (time.time(), *args),
    ).fetchall()
    return {r["t3"]: r["n"] for r in rows}


def mastery_snapshot(uid: str, fresh: bool = False) -> dict:
    """考点掌握度地图：模块 → 二级题型分组 → 三级考点（tag3）三级树。

    掌握度口径与 recommend_stats 共用平滑正确率 + 时间衰减分量；
    未接触（n==0）不参与上级均值。60s 进程内缓存。
    """
    now = time.time()
    hit = db._MASTERY_CACHE.get(uid)
    if hit and not fresh and now - hit[0] < db.MASTERY_CACHE_TTL:
        return hit[1]
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.module, a.submodule, a.correct, a.created_at, a.secs,
                  q.tag3, q.correct_ratio, q.attempt_count
           FROM answer_log a LEFT JOIN questions q ON q.id = a.question_id
           WHERE a.uid=? AND a.module IS NOT NULL AND a.module!=''
           ORDER BY a.created_at""",
        (uid,),
    ).fetchall()
    due3 = _due_by_tag3(conn, uid)
    conn.close()
    tidx = taxonomy.topic_index()
    counts = db.tag3_counts()
    # 按 tag3 / 二级分组聚合原始作答
    t3_stat: dict = {}
    grp_stat: dict = {}
    # B3 画像两维：按全站难度分档的正确率 + 答对/答错均时
    diff_stat: dict[int | None, list[int]] = {}
    secs_c: list[float] = []
    secs_w: list[float] = []
    total_n = len(rows)
    for r in rows:
        c = 1 if r["correct"] else 0
        b = difficulty.band(r["correct_ratio"], r["attempt_count"])
        bs = diff_stat.setdefault(b, [0, 0])
        bs[0] += 1
        bs[1] += c
        if r["secs"] and r["secs"] > 0:
            (secs_c if c else secs_w).append(float(r["secs"]))
        tag3 = r["tag3"] if r["tag3"] and r["tag3"] != "UNKNOWN" and r["tag3"] in tidx else None
        ts = r["created_at"]
        if tag3:
            s = t3_stat.setdefault(tag3, [0, 0, 0.0])
            s[0] += 1
            s[1] += c
            s[2] = max(s[2], ts)
            gcode = None  # tag3 行已计入 t3_stat，分组聚合时再合并，避免重复
        else:
            gcode = None
            if r["submodule"]:
                gs = taxonomy.alias_index().get((r["module"], r["submodule"].strip()))
                if gs:
                    gcode = gs[0]["code"]
        if gcode:
            g = grp_stat.setdefault(gcode, [0, 0, 0.0])
            g[0] += 1
            g[1] += c
            g[2] = max(g[2], ts)
    practiced = {t3 for t3 in t3_stat if counts.get(t3)}
    total_t3 = sum(1 for code in tidx if counts.get(code))
    modules = []
    for m in taxonomy.tree()["modules"]:
        subs = []
        m_n = 0
        m_num = 0.0
        m_den = 0
        for g in m["groups"]:
            t3s = []
            for t in g["topics"]:
                code = t["code"]
                qn = counts.get(code, 0)
                if qn <= 0:
                    continue  # 题库无题的考点不进地图
                s = t3_stat.get(code)
                n, c, last = (s[0], s[1], s[2]) if s else (0, 0, 0.0)
                mv = _mastery_value(n, c, last, now) if n else 0.0
                lv, lv_name = _mastery_level(n, mv)
                t3s.append({
                    "code": code, "name": t["name"], "n": n,
                    "acc": round(c / n, 3) if n else 0,
                    "mastery": round(mv, 3), "level": lv, "level_name": lv_name,
                    "due_mistakes": due3.get(code, 0), "qn": qn,
                })
            if not t3s:
                continue
            gn = sum(t3_stat[x["code"]][0] for x in t3s if x["code"] in t3_stat)
            gc = sum(t3_stat[x["code"]][1] for x in t3s if x["code"] in t3_stat)
            glast = 0.0
            gs = grp_stat.get(g["code"])
            if gs:
                gn += gs[0]
                gc += gs[1]
                glast = gs[2]
            for s3 in (t3_stat.get(x["code"]) for x in t3s):
                if s3:
                    glast = max(glast, s3[2])
            gm = _mastery_value(gn, gc, glast, now) if gn else 0.0
            glv, glv_name = _mastery_level(gn, gm)
            subs.append({
                "code": g["code"], "submodule": g["name"], "n": gn,
                "acc": round(gc / gn, 3) if gn else 0,
                "mastery": round(gm, 3), "level": glv, "level_name": glv_name,
                "tag3s": t3s,
            })
            if gn:
                m_n += gn
                m_num += gm * gn
                m_den += gn
        if not subs:
            continue
        mm = m_num / m_den if m_den else 0.0
        mlv, mlv_name = _mastery_level(m_n, mm)
        modules.append({
            "module": m["key"], "name": m["name"], "n": m_n,
            "mastery": round(mm, 3), "level": mlv, "level_name": mlv_name,
            "subs": subs,
        })
    out = {
        "n_total": total_n,
        "cold": total_n < db.MASTERY_COLD_START_N,
        "need": db.MASTERY_COLD_START_N,
        "coverage": {
            "practiced": len(practiced),
            "total": total_t3,
            "pct": round(100 * len(practiced) / total_t3) if total_t3 else 0,
        },
        # B3：画像两维——难度分档正确率（含未校准桶）+ 答对/答错均时
        "by_difficulty": [
            {
                "band": b,
                "label": difficulty.label(b) or "待校准",
                "n": s[0],
                "acc": round(s[1] / s[0], 3) if s[0] else 0,
            }
            for b, s in sorted(diff_stat.items(), key=lambda kv: (kv[0] is None, kv[0]))
        ],
        "by_secs": {
            "correct_avg": round(sum(secs_c) / len(secs_c), 1) if secs_c else 0,
            "wrong_avg": round(sum(secs_w) / len(secs_w), 1) if secs_w else 0,
            "n_correct": len(secs_c),
            "n_wrong": len(secs_w),
        },
        "modules": modules,
    }
    db._MASTERY_CACHE[uid] = (now, out)
    return out


def mastery_topic(uid: str, tag3: str) -> dict:
    """单考点详情：近 20 次作答序列、到期错题、可练新题数（吸底条 / 强化前后对比用）。"""
    now = time.time()
    tidx = taxonomy.topic_index()
    t = tidx.get(tag3)
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.correct, a.created_at FROM answer_log a
           JOIN questions q ON q.id=a.question_id
           WHERE a.uid=? AND q.tag3=? ORDER BY a.created_at""",
        (uid, tag3),
    ).fetchall()
    n = len(rows)
    c = sum(1 if r["correct"] else 0 for r in rows)
    last = rows[-1]["created_at"] if rows else 0.0
    seq = [1 if r["correct"] else 0 for r in rows]
    trend = 0.0
    if n >= 10:
        recent = seq[-20:]
        prev = seq[-40:-20] or seq[:-20]
        if prev:
            trend = sum(recent) / len(recent) - sum(prev) / len(prev)
    db._ensure_mistake_uid(conn)
    cl, args = db._uid_clause(uid)
    due = conn.execute(
        f"""SELECT m.id, m.question_text FROM mistakes m
            JOIN questions q ON q.id=m.question_id
            WHERE q.tag3=? AND (m.mastered IS NULL OR m.mastered=0)
              AND (m.next_review IS NULL OR m.next_review<=?){cl}
            ORDER BY m.next_review LIMIT 20""",
        (tag3, time.time(), *args),
    ).fetchall()
    avail = _avail_new_count(conn, uid, tag3=tag3)
    conn.close()
    mv = _mastery_value(n, c, last, now) if n else 0.0
    lv, lv_name = _mastery_level(n, mv)
    return {
        "tag3": tag3,
        "name": t["name"] if t else tag3,
        "module": t["module"] if t else None,
        "module_name": t["module_name"] if t else None,
        "submodule": t["group_name"] if t else None,
        "n": n,
        "acc": round(c / n, 3) if n else 0,
        "mastery": round(mv, 3),
        "level": lv,
        "level_name": lv_name,
        "trend": round(trend, 3),
        "recent": seq[-20:],
        "due_mistakes": [{"id": r["id"], "brief": (r["question_text"] or "")[:60]} for r in due],
        "avail_new": avail,
    }


def _answered_qids(conn, uid: str) -> set:
    return {
        r["question_id"]
        for r in conn.execute(
            "SELECT DISTINCT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL",
            (uid,),
        )
    }


def _avail_new_count(conn, uid: str, tag3: str | None = None, submodule: str | None = None) -> int:
    """该考点/题型下该 uid 未作答过的可用新题数。"""
    db._ensure_answer_log(conn)
    if tag3:
        cond, args = "tag3=?", [tag3]
    elif submodule:
        cond, args = "submodule=?", [submodule]
    else:
        return 0
    return conn.execute(
        f"""SELECT COUNT(*) FROM questions
            WHERE {cond} AND disabled=0
              AND id NOT IN (SELECT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL)""",
        (*args, uid),
    ).fetchone()[0]


def _ensure_reinforce_log(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS reinforce_log (
            uid TEXT NOT NULL, day TEXT NOT NULL, skill TEXT NOT NULL,
            created_at REAL, PRIMARY KEY (uid, day, skill))"""
    )


def reinforce_done_today(uid: str) -> set:
    conn = db.get_conn()
    _ensure_reinforce_log(conn)
    rows = conn.execute(
        "SELECT skill FROM reinforce_log WHERE uid=? AND day=?", (uid, db._today_str())
    ).fetchall()
    conn.close()
    return {r["skill"] for r in rows}


def _reinforce_log_add(conn, uid: str, skill: str):
    _ensure_reinforce_log(conn)
    conn.execute(
        "INSERT OR IGNORE INTO reinforce_log (uid, day, skill, created_at) VALUES (?,?,?,?)",
        (uid, db._today_str(), skill, time.time()),
    )


def reinforce_candidates(uid: str, include_done: bool = False) -> dict:
    """今日强化候选：今日复习中答错 / 自评「方法不会/概念不清」的错题聚合考点，
    取掌握度最低者（spec-02 口径）；并列取到期错题多者。频控：每日每考点 1 组。"""
    conn = db.get_conn()
    db._ensure_review_log(conn)
    db._ensure_mistake_uid(conn)
    rows = conn.execute(
        """SELECT r.correct, m.error_reason, m.module mmod, m.question_type,
                  q.tag3, q.module qmod, q.submodule
           FROM review_log r JOIN mistakes m ON m.id=r.mistake_id
           LEFT JOIN questions q ON q.id=m.question_id
           WHERE r.uid=? AND r.created_at>=?""",
        (uid, db._day_start()),
    ).fetchall()
    tidx = taxonomy.topic_index()
    agg: dict = {}
    for r in rows:
        if r["correct"] and (r["error_reason"] or "") not in db.REINFORCE_REASONS:
            continue
        tag3 = r["tag3"] if r["tag3"] and r["tag3"] != "UNKNOWN" and r["tag3"] in tidx else None
        if tag3:
            key = ("tag3", tag3)
        else:
            # 无 tag3 的老错题回退二级题型口径
            module = r["qmod"] or r["mmod"]
            sub = r["submodule"] or (r["question_type"] or "").split("-")[-1] or None
            if not module or not sub:
                continue
            key = ("sub", module, sub)
        a = agg.setdefault(key, {"wrong_today": 0})
        a["wrong_today"] += 1
    if not agg:
        conn.close()
        return {"items": [], "picked": None}
    snap = mastery_snapshot(uid)
    m_map: dict = {}
    s_map: dict = {}
    for m in snap["modules"]:
        for g in m["subs"]:
            s_map[(m["module"], g["submodule"])] = g
            for t3 in g["tag3s"]:
                m_map[t3["code"]] = t3
    done = set() if include_done else reinforce_done_today(uid)
    items = []
    for key, a in agg.items():
        if key[0] == "tag3":
            code = key[1]
            skill = code
            t = tidx[code]
            node = m_map.get(code)
            avail = _avail_new_count(conn, uid, tag3=code)
            avail_total = avail
            if avail < db.REINFORCE_N:
                # tag3 不足时同二级题型补足
                avail_total = avail + _avail_new_count(conn, uid, submodule=t["group_name"])
            item = {
                "kind": "tag3", "skill": skill,
                "tag3": code, "tag3_name": t["name"],
                "module": t["module"], "module_name": t["module_name"],
                "submodule": t["group_name"],
                "mastery": node["mastery"] if node else 0.0,
                "level_name": node["level_name"] if node else "未接触",
                "due": node["due_mistakes"] if node else 0,
                "wrong_today": a["wrong_today"], "avail_n": avail_total,
            }
        else:
            _, module, sub = key
            skill = f"{module}|{sub}"
            node = s_map.get((module, sub))
            avail_total = _avail_new_count(conn, uid, submodule=sub)
            item = {
                "kind": "sub", "skill": skill,
                "tag3": None, "tag3_name": None,
                "module": module, "module_name": db.MODULE_NAMES.get(module, module),
                "submodule": sub,
                "mastery": node["mastery"] if node else 0.0,
                "level_name": node["level_name"] if node else "未接触",
                "due": 0,
                "wrong_today": a["wrong_today"], "avail_n": avail_total,
            }
        if item["avail_n"] < db.REINFORCE_N:
            continue  # 抽不满一组不出卡
        if skill in done:
            continue  # 频控：每日每考点最多 1 组
        items.append(item)
    conn.close()
    items.sort(key=lambda x: (x["mastery"], -x["due"], -x["wrong_today"]))
    return {"items": items[:4], "picked": items[0] if items else None}


def reinforce_questions(uid: str, tag3: str | None = None, module: str | None = None,
                        submodule: str | None = None, limit: int = db.REINFORCE_N) -> list[dict]:
    """同考点强化取题：同 tag3（回退 submodule）、该 uid 未作答过、未下架，
    按 |全站正确率-60| 升序优先中等难度；资料分析优先同材料成组；不足同二级题型补足。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    limit = min(max(limit, 1), 10)
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    order = (
        "CASE WHEN correct_ratio IS NULL THEN 1 ELSE 0 END, ABS(COALESCE(correct_ratio,60) - 60), RANDOM()"
        if "correct_ratio" in qcols else "RANDOM()"
    )

    def _pick(cond: str, args: list, n: int, exclude: set) -> list[dict]:
        ph = ",".join("?" * len(exclude)) or "0"
        # 两阶段：先用 covering 索引只读排序列完成选取，再回表取 limit 行，
        # 避免排序阶段读全部候选大行（页缓存被挤出时冷触可达秒级）。
        # 主路径（tag3）保留中等难度优先排序；submodule/module 回退是补足路径，
        # 候选集大（可达数万），排序改随机并走 idx_q_pick 纯索引扫描，杜绝逐行回表。
        if cond.startswith("tag3=") and "correct_ratio" in qcols:
            src, pick_order = "questions INDEXED BY idx_q_reinforce", order
        else:
            src, pick_order = "questions INDEXED BY idx_q_pick", "RANDOM()"
        ids = [
            r["id"]
            for r in conn.execute(
                f"""SELECT id FROM {src}
                    WHERE {cond} AND disabled=0
                      AND id NOT IN ({ph})
                      AND id NOT IN (SELECT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL)
                    ORDER BY {pick_order} LIMIT ?""",
                (*args, *exclude, uid, n),
            )
        ]
        if not ids:
            return []
        rows = {
            r["id"]: dict(r)
            for r in conn.execute(
                f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))})", ids
            )
        }
        return [rows[i] for i in ids if i in rows]

    out: list[dict] = []
    seen: set = set()
    if tag3:
        got = _pick("tag3=?", [tag3], limit, seen)
        # 资料分析：优先把同材料的题成组带上
        if got and (module == "ziliao" or (got[0].get("module") == "ziliao")):
            cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
            if "material_hash" in cols:
                regrouped: list[dict] = []
                for q in got:
                    if len(regrouped) >= limit:
                        break
                    if q["id"] in seen:
                        continue
                    regrouped.append(q)
                    seen.add(q["id"])
                    h = q.get("material_hash")
                    if h and h != "-":
                        sibs = _pick("tag3=? AND material_hash=?", [tag3, h], limit - len(regrouped), seen)
                        for s in sibs:
                            regrouped.append(s)
                            seen.add(s["id"])
                got = regrouped
        out = got[:limit]
        seen = {q["id"] for q in out}
    if len(out) < limit and submodule:
        # 同名二级题型跨模块存在（如「逻辑判断」也散在常识/言语），带 module 既保同模块也走 idx_q_pick 前缀
        sub_cond, sub_args = ("module=? AND submodule=?", [module, submodule]) if module else ("submodule=?", [submodule])
        for q in _pick(sub_cond, sub_args, limit - len(out), seen):
            out.append(q)
            seen.add(q["id"])
    if len(out) < limit and module:
        for q in _pick("module=?", [module], limit - len(out), seen):
            out.append(q)
            seen.add(q["id"])
    if len(out) >= limit:
        skill = tag3 or (f"{module}|{submodule}" if module and submodule else None)
        if skill:
            _reinforce_log_add(conn, uid, skill)
            conn.commit()
    conn.close()
    for q in out:
        q["options"] = json.loads(q.get("options") or "{}")
    return out[:limit]


def today_skill_count(uid: str, tag3: str | None = None, submodule: str | None = None) -> int:
    """今日该考点（tag3 或二级题型）作答数：reinforce 任务 done 判定用。"""
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    if tag3:
        n = conn.execute(
            """SELECT COUNT(*) FROM answer_log a JOIN questions q ON q.id=a.question_id
               WHERE a.uid=? AND a.created_at>=? AND q.tag3=?""",
            (uid, db._day_start(), tag3),
        ).fetchone()[0]
    elif submodule:
        n = conn.execute(
            "SELECT COUNT(*) FROM answer_log WHERE uid=? AND created_at>=? AND submodule=?",
            (uid, db._day_start(), submodule),
        ).fetchone()[0]
    else:
        n = 0
    conn.close()
    return n


