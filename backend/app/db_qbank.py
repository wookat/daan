"""py 拆分之 qbank 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import random
import threading
import time

from . import db, difficulty

__all__ = ["_draw", "_pick_invalidate", "_pick_pools", "_pick_rebuild", "_pick_scan", "export_questions", "get_explain_cache", "grouped_ziliao_questions", "question_counts", "questions_by_ids", "random_questions", "rate_explain", "rate_question_hs", "real_filters", "save_explain_cache", "set_question_hs_explanation", "submodule_counts"]


def _pick_rebuild(module, submodule, tag3, year, region):
    key = (module, submodule, tag3, year, region)
    try:
        conn = db.get_conn()
        pools = _pick_scan(conn, module, submodule, tag3, year, region)
        conn.close()
        with db._pick_lock:
            db._pick_cache[key] = (time.time(), pools)
    except Exception:
        pass
    finally:
        with db._pick_lock:
            db._pick_refreshing.discard(key)


def _pick_pools(conn, module, submodule, tag3, year, region) -> dict:
    """按筛选维度缓存候选 id 池（按 is_real×has_hs 分层），使每次抽题只读 limit 行，
    不再每请求全索引 ORDER BY RANDOM() 扫描（页缓存被挤出时单次扫描可达秒级）。"""
    key = (module, submodule, tag3, year, region)
    with db._pick_lock:
        ent = db._pick_cache.get(key)
        if ent:
            if time.time() - ent[0] < db._PICK_TTL:
                return ent[1]
            if key not in db._pick_refreshing:
                # 过期先返回旧池（stale-while-revalidate），后台重建，避免用户请求承担秒级重扫
                db._pick_refreshing.add(key)
                threading.Thread(
                    target=_pick_rebuild, args=(module, submodule, tag3, year, region), daemon=True
                ).start()
            return ent[1]
    # 冷 miss：单线程构建，并发请求等锁后直接吃缓存，避免同键多请求各自全表扫描（惊群）
    with db._pick_build_lock:
        with db._pick_lock:
            ent = db._pick_cache.get(key)
            if ent:
                return ent[1]
        pools = _pick_scan(conn, module, submodule, tag3, year, region)
        with db._pick_lock:
            if len(db._pick_cache) >= 512:
                db._pick_cache.clear()
            db._pick_cache[key] = (time.time(), pools)
        return pools


def _pick_scan(conn, module, submodule, tag3, year, region) -> dict:
    where = ["disabled=0"]
    args: list = []
    for col, val in (
        ("module", module),
        ("submodule", submodule),
        ("tag3", tag3),
        ("exam_year", year),
        ("exam_region", region),
    ):
        if val:
            where.append(f"{col}=?")
            args.append(val)
    src = "questions INDEXED BY idx_q_tag3_pick" if tag3 else "questions INDEXED BY idx_q_pick"
    pools: dict = {(1, 1): [], (1, 0): [], (0, 1): [], (0, 0): []}
    for r in conn.execute(
        f"SELECT id, is_real, COALESCE(has_hs,0) hs FROM {src} WHERE {' AND '.join(where)}", args
    ):
        pools[(1 if r["is_real"] else 0, 1 if r["hs"] else 0)].append(r["id"])
    return pools


def _pick_invalidate(module, submodule, tag3, year, region):
    with db._pick_lock:
        db._pick_cache.pop((module, submodule, tag3, year, region), None)


def _draw(tiers: list[list[int]], n: int, exclude: set) -> list[int]:
    """依次从各层随机抽样（层间保序 = 原 has_hs DESC 优先级），排除 exclude。"""
    out: list[int] = []
    for tier in tiers:
        if len(out) >= n:
            break
        cand = [i for i in tier if i not in exclude]
        take = min(n - len(out), len(cand))
        picked = random.sample(cand, take)
        out += picked
        exclude.update(picked)
    return out


def random_questions(
    module: str | None = None,
    limit: int = 10,
    submodule: str | None = None,
    real_only: bool = False,
    year: int | None = None,
    region: str | None = None,
    uid: str | None = None,
    adaptive: bool = False,
    tag3: str | None = None,
) -> list[dict]:
    # limit<=0 是「不抽题」语义：混真题分层的 max(1, round(limit*0.6)) 地板在 limit=0 时会漏出 1 题
    if limit <= 0:
        return []
    conn = db.get_conn()
    where = []
    args: list = []
    done: list[int] = []
    order = "has_hs DESC, RANDOM()"
    if adaptive and uid and (module or submodule or tag3):
        db._ensure_answer_log(conn)
        if tag3:
            acl = "a.uid=? AND q.tag3=?"
            aargs: list = [uid, tag3]
            asrc = "answer_log a JOIN questions q ON q.id = a.question_id"
        else:
            acl = "uid=?"
            aargs = [uid]
            asrc = "answer_log"
            if submodule:
                acl += " AND submodule=?"
                aargs.append(submodule)
            elif module:
                acl += " AND module=?"
                aargs.append(module)
        st = conn.execute(
            f"SELECT COUNT(*) n, SUM(correct) c FROM (SELECT correct FROM {asrc} WHERE {acl} ORDER BY {'a.' if tag3 else ''}id DESC LIMIT 60)",
            aargs,
        ).fetchone()
        if st and (st["n"] or 0) >= 5:
            target = max(20, min(90, round(100 * (st["c"] or 0) / st["n"]) - 10))
            order = (
                "has_hs DESC, CASE WHEN correct_ratio IS NULL THEN 1 ELSE 0 END, "
                f"ABS(correct_ratio - {target}) + ABS(RANDOM()) % 15"
            )
    if uid:
        db._ensure_answer_log(conn)
        done = [
            r["question_id"]
            for r in conn.execute(
                "SELECT DISTINCT question_id FROM (SELECT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL ORDER BY id DESC LIMIT 3000)",
                (uid,),
            )
        ]
        if done:
            where.append(f"id NOT IN ({','.join('?' * len(done))})")
            args.extend(done)
    if module:
        where.append("module=?")
        args.append(module)
    if submodule:
        where.append("submodule=?")
        args.append(submodule)
    if tag3:
        where.append("tag3=?")
        args.append(tag3)
    if real_only:
        where.append("is_real=1")
    if year:
        where.append("exam_year=?")
        args.append(year)
    if region:
        where.append("exam_region=?")
        args.append(region)
    where.append("disabled=0")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    # 默认随机抽题只取 id，强制走 covering 索引避免回表读大行（冷启动 10s+ → 亚秒）；
    # tag3 筛选时 idx_q_pick 不含 tag3，走 tag3 covering 索引避免回表读大行；
    # adaptive 排序引用 correct_ratio 不在索引内，保持默认计划
    if adaptive:
        src = "questions"
    elif tag3:
        src = "questions INDEXED BY idx_q_tag3_pick"
    else:
        src = "questions INDEXED BY idx_q_pick"
    ids: list[int] = []
    if not adaptive:
        pools = _pick_pools(conn, module, submodule, tag3, year, region)
        real_tiers = [pools[(1, 1)], pools[(1, 0)]]
        any_tiers = [pools[(1, 1)] + pools[(0, 1)], pools[(1, 0)] + pools[(0, 0)]]
        exclude: set = set(done)
        if real_only:
            ids = _draw(real_tiers, limit, exclude)
        else:
            ids = _draw(real_tiers, max(1, round(limit * 0.6)), exclude)
            ids += _draw(any_tiers, limit - len(ids), exclude)
        if len(ids) < limit and done:
            ids += _draw(real_tiers if real_only else any_tiers, limit - len(ids), set(ids))
    else:
        if not real_only:
            want_real = max(1, round(limit * 0.6))
            ids = [
                r["id"]
                for r in conn.execute(
                    f"SELECT id FROM {src} {clause} AND is_real=1 ORDER BY {order} LIMIT ?",
                    (*args, want_real),
                )
            ]
        if len(ids) < limit:
            placeholders = ",".join("?" * len(ids)) or "0"
            ids += [
                r["id"]
                for r in conn.execute(
                    f"SELECT id FROM {src} {clause} AND id NOT IN ({placeholders}) "
                    f"ORDER BY {order} LIMIT ?",
                    (*args, *ids, limit - len(ids)),
                )
            ]
        if uid and len(ids) < limit:
            where2 = [w for w in where if not w.startswith("id NOT IN")]
            base_args = []
            if module:
                base_args.append(module)
            if submodule:
                base_args.append(submodule)
            if tag3:
                base_args.append(tag3)
            if year:
                base_args.append(year)
            if region:
                base_args.append(region)
            clause2 = "WHERE " + " AND ".join(where2)
            placeholders = ",".join("?" * len(ids)) or "0"
            ids += [
                r["id"]
                for r in conn.execute(
                    f"SELECT id FROM questions INDEXED BY {'idx_q_tag3_pick' if tag3 else 'idx_q_pick'} {clause2} AND id NOT IN ({placeholders}) "
                    "ORDER BY has_hs DESC, RANDOM() LIMIT ?",
                    (*base_args, *ids, limit - len(ids)),
                )
            ]
    random.shuffle(ids)
    rows = (
        conn.execute(
            f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))}) AND disabled=0",
            ids,
        ).fetchall()
        if ids
        else []
    )
    if len(rows) < len(ids):
        _pick_invalidate(module, submodule, tag3, year, region)
    conn.close()
    by_id = {}
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        by_id[d["id"]] = d
    return [by_id[i] for i in ids if i in by_id]


def questions_by_ids(ids: list[int]) -> list[dict]:
    if not ids:
        return []
    conn = db.get_conn()
    rows = conn.execute(
        f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))})", ids
    ).fetchall()
    conn.close()
    by_id = {}
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        # B3：全站正确率 → 难度分档（1 最易…5 最难，样本不足 → None=待校准）
        d["difficulty"] = difficulty.band(d.get("correct_ratio"), d.get("attempt_count"))
        d["difficulty_label"] = difficulty.label(d["difficulty"])
        by_id[d["id"]] = d
    out = [by_id[i] for i in ids if i in by_id]
    out.sort(key=lambda q: (q.get("module") or "", q.get("submodule") or ""))
    return out


def grouped_ziliao_questions(limit: int = 10, uid: str | None = None) -> list[dict]:
    """资料分析材料题组：选若干材料，同材料题连续出，标注 组内序号/组题数。"""
    conn = db.get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "material_hash" not in cols:
        conn.close()
        return random_questions("ziliao", limit, uid=uid)
    out: list[dict] = []
    done: set[int] = set()
    if uid:
        done = {
            r["question_id"]
            for r in conn.execute(
                "SELECT DISTINCT question_id FROM (SELECT question_id FROM answer_log WHERE uid=? AND question_id IS NOT NULL ORDER BY id DESC LIMIT 3000)",
                (uid,),
            )
        }
    hashes = [r["material_hash"] for r in db._ziliao_material_hashes(conn, 24)]
    for h in hashes:
        if len(out) >= limit:
            break
        rows = conn.execute(
            "SELECT * FROM questions WHERE module='ziliao' AND material_hash=? "
            "AND disabled=0 ORDER BY id LIMIT 5",
            (h,),
        ).fetchall()
        if len(rows) < 2:
            continue
        if done and any(r["id"] in done for r in rows):
            continue
        for i, r in enumerate(rows):
            d = dict(r)
            d["options"] = json.loads(d.get("options") or "{}")
            d["group_seq"] = f"{i + 1}/{len(rows)}"
            out.append(d)
    conn.close()
    if len(out) < limit:
        seen = {d["id"] for d in out}
        out += [q for q in random_questions("ziliao", limit - len(out), uid=uid) if q["id"] not in seen]
    return out


def question_counts() -> list[dict]:
    """各模块在架题量（/api/questions 每个响应都附带），进程内 60s 缓存。"""
    now = time.time()
    if db._QCOUNTS_CACHE[1] is not None and now - db._QCOUNTS_CACHE[0] < db._DIM_CACHE_TTL:
        return db._QCOUNTS_CACHE[1]
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT module, COUNT(*) n FROM questions WHERE disabled=0 GROUP BY module ORDER BY n DESC"
    ).fetchall()
    conn.close()
    out = [dict(r) for r in rows]
    db._QCOUNTS_CACHE[0] = now
    db._QCOUNTS_CACHE[1] = out
    return out


def submodule_counts(module: str) -> list[dict]:
    """模块下题型组题量（/api/submodules），进程内 60s 缓存（按 module 分桶）。"""
    now = time.time()
    ent = db._SUBMOD_COUNTS_CACHE.get(module)
    if ent is not None and now - ent[0] < db._DIM_CACHE_TTL:
        return ent[1]
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT submodule, COUNT(*) n FROM questions WHERE module=? AND disabled=0 AND submodule IS NOT NULL AND submodule!='' "
        "GROUP BY submodule HAVING n >= 8 OR submodule='图形推理' ORDER BY n DESC LIMIT 30",
        (module,),
    ).fetchall()
    conn.close()
    out = [dict(r) for r in rows]
    if len(db._SUBMOD_COUNTS_CACHE) >= 16:
        db._SUBMOD_COUNTS_CACHE.clear()
    db._SUBMOD_COUNTS_CACHE[module] = (now, out)
    return out


def real_filters() -> dict:
    """真题可用的年份/地区筛选项及题量（/api/real_filters），进程内 60s 缓存。"""
    now = time.time()
    if db._REAL_FILTERS_CACHE[1] is not None and now - db._REAL_FILTERS_CACHE[0] < db._DIM_CACHE_TTL:
        return db._REAL_FILTERS_CACHE[1]
    conn = db.get_conn()
    years = [
        dict(r)
        for r in conn.execute(
            "SELECT exam_year y, COUNT(*) n FROM questions WHERE is_real=1 AND exam_year IS NOT NULL "
            "GROUP BY exam_year ORDER BY exam_year DESC"
        )
    ]
    regions = [
        dict(r)
        for r in conn.execute(
            "SELECT exam_region r, COUNT(*) n FROM questions WHERE is_real=1 AND exam_region IS NOT NULL AND exam_region!='' "
            "GROUP BY exam_region HAVING n >= 20 ORDER BY n DESC"
        )
    ]
    conn.close()
    out = {"years": years, "regions": regions}
    db._REAL_FILTERS_CACHE[0] = now
    db._REAL_FILTERS_CACHE[1] = out
    return out


def get_explain_cache(key: str) -> dict | None:
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM explain_cache WHERE key=?", (key,)).fetchone()
    if row:
        conn.execute("UPDATE explain_cache SET hits=hits+1 WHERE key=?", (key,))
        conn.commit()
    conn.close()
    return dict(row) if row else None


def save_explain_cache(key: str, meta: dict, explanation: str):
    conn = db.get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO explain_cache (key, created_at, module, question_type, question_text, user_answer, explanation, qid, hits, up, down) "
        "VALUES (?,?,?,?,?,?,?,?, COALESCE((SELECT hits FROM explain_cache WHERE key=?),0), "
        "COALESCE((SELECT up FROM explain_cache WHERE key=?),0), COALESCE((SELECT down FROM explain_cache WHERE key=?),0))",
        (
            key,
            time.time(),
            meta.get("module"),
            meta.get("question_type"),
            meta.get("question_text"),
            meta.get("user_answer"),
            explanation,
            meta.get("qid") if isinstance(meta.get("qid"), int) else None,
            key,
            key,
            key,
        ),
    )
    conn.commit()
    conn.close()


def rate_explain(key: str, up: bool):
    conn = db.get_conn()
    col = "up" if up else "down"
    conn.execute(f"UPDATE explain_cache SET {col}={col}+1 WHERE key=?", (key,))
    conn.commit()
    conn.close()


def rate_question_hs(qid: int, up: bool):
    conn = db.get_conn()
    col = "hs_up" if up else "hs_down"
    conn.execute(f"UPDATE questions SET {col}={col}+1 WHERE id=?", (qid,))
    db.rescore_question(conn, qid)
    conn.commit()
    conn.close()


def set_question_hs_explanation(qid: int, text: str):
    conn = db.get_conn()
    conn.execute(
        "UPDATE questions SET hs_explanation=?, has_hs=?, updated_at=? WHERE id=?",
        (text, 1 if text else 0, time.time(), qid),
    )
    db.rescore_question(conn, qid)
    conn.commit()
    conn.close()


def export_questions(offset: int = 0, limit: int = 200, module: str | None = None, missing_only: bool = True) -> list[dict]:
    conn = db.get_conn()
    where = []
    args: list = []
    if module:
        where.append("module=?")
        args.append(module)
    if missing_only:
        where.append("(hs_explanation IS NULL OR hs_explanation='')")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = conn.execute(
        f"SELECT id, module, submodule, question_type, question, options, answer, explanation FROM questions {clause} ORDER BY id LIMIT ? OFFSET ?",
        (*args, limit, offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


