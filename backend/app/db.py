"""错题本存储（SQLite）。"""
import hashlib
import json
import os
import random
import re
import secrets
import sqlite3
import threading
import time
from datetime import date, timedelta

from . import quality, similarity, taxonomy
from .tagging import classify_question

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "data.db"))


_local = threading.local()


class _ConnProxy:
    """线程内复用底层连接：close() 仅回滚未提交事务（与真实 close 语义一致），
    连接与其堆内页缓存常驻，避免同机邻居 I/O 挤出 OS 页缓存后每请求重读索引。"""

    __slots__ = ("_conn",)

    def __init__(self, conn):
        self._conn = conn

    def close(self):
        try:
            self._conn.rollback()
        except Exception:
            pass

    def __getattr__(self, name):
        return getattr(self._conn, name)


def get_conn():
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA cache_size=-32768")
        conn.execute("PRAGMA mmap_size=268435456")
        _local.conn = conn
    return _ConnProxy(conn)


def init_db():
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            module TEXT,
            question_type TEXT,
            question_text TEXT,
            user_answer TEXT,
            correct_answer TEXT,
            methods TEXT,
            error_reason TEXT,
            explanation TEXT
        )"""
    )
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mistakes)")}
    for col, ddl in [
        ("review_count", "ALTER TABLE mistakes ADD COLUMN review_count INTEGER DEFAULT 0"),
        ("review_streak", "ALTER TABLE mistakes ADD COLUMN review_streak INTEGER DEFAULT 0"),
        ("next_review", "ALTER TABLE mistakes ADD COLUMN next_review REAL"),
        ("mastered", "ALTER TABLE mistakes ADD COLUMN mastered INTEGER DEFAULT 0"),
        ("mastered_at", "ALTER TABLE mistakes ADD COLUMN mastered_at REAL"),
        ("times", "ALTER TABLE mistakes ADD COLUMN times INTEGER DEFAULT 1"),
        ("source", "ALTER TABLE mistakes ADD COLUMN source TEXT"),
    ]:
        if col not in cols:
            conn.execute(ddl)
    # 历史 question_type 混存「模块名-细分」与「细分」两种格式，统一回填为细分题型名（幂等）
    conn.execute(
        "UPDATE mistakes SET question_type = trim(substr(question_type, instr(question_type,'-')+1)) "
        "WHERE question_type LIKE '%-%' AND trim(substr(question_type, 1, instr(question_type,'-')-1)) "
        "IN ('资料分析','数量关系','言语理解','判断推理','常识判断','常识','时政')"
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT,
            question_type TEXT,
            question TEXT UNIQUE,
            options TEXT,
            answer TEXT,
            explanation TEXT,
            source TEXT
        )"""
    )
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    for col, ddl in [
        ("submodule", "ALTER TABLE questions ADD COLUMN submodule TEXT"),
        ("hs_explanation", "ALTER TABLE questions ADD COLUMN hs_explanation TEXT"),
        ("hs_up", "ALTER TABLE questions ADD COLUMN hs_up INTEGER DEFAULT 0"),
        ("hs_down", "ALTER TABLE questions ADD COLUMN hs_down INTEGER DEFAULT 0"),
        ("is_real", "ALTER TABLE questions ADD COLUMN is_real INTEGER DEFAULT 0"),
        ("exam_year", "ALTER TABLE questions ADD COLUMN exam_year INTEGER"),
        ("exam_region", "ALTER TABLE questions ADD COLUMN exam_region TEXT"),
        ("disabled", "ALTER TABLE questions ADD COLUMN disabled INTEGER DEFAULT 0"),
        ("import_batch", "ALTER TABLE questions ADD COLUMN import_batch TEXT"),
        ("image", "ALTER TABLE questions ADD COLUMN image TEXT"),
        ("image_credit", "ALTER TABLE questions ADD COLUMN image_credit TEXT"),
        ("xp_explanation", "ALTER TABLE questions ADD COLUMN xp_explanation TEXT"),
        ("xp_school", "ALTER TABLE questions ADD COLUMN xp_school TEXT"),
        ("has_hs", "ALTER TABLE questions ADD COLUMN has_hs INTEGER DEFAULT 0"),
        ("tag3", "ALTER TABLE questions ADD COLUMN tag3 TEXT"),
        ("quality_score", "ALTER TABLE questions ADD COLUMN quality_score INTEGER"),
        ("updated_at", "ALTER TABLE questions ADD COLUMN updated_at REAL"),
        ("material_hash", "ALTER TABLE questions ADD COLUMN material_hash TEXT"),
    ]:
        if col not in qcols:
            conn.execute(ddl)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS backups (
            code TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_module ON questions(module, submodule)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_real ON questions(is_real)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_tag3 ON questions(tag3)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_tag3_disabled ON questions(tag3, disabled)")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_tag3_pick ON questions(tag3, disabled, is_real, has_hs, id)"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_quality ON questions(quality_score)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_q_disabled_id ON questions(disabled, id)")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_sitemap ON questions(disabled, id, updated_at)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_disabled_module ON questions(disabled, module)"
    )
    conn.execute("DROP INDEX IF EXISTS idx_q_disabled_tag3")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_disabled_tag3_upd ON questions(disabled, tag3, updated_at)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_real_region ON questions(is_real, exam_region)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_batch ON questions(import_batch, disabled, is_real, answer)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_real_year ON questions(is_real, disabled, exam_year, module, updated_at)"
    )
    if "correct_ratio" in qcols:
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_q_reinforce ON questions(tag3, disabled, correct_ratio, id)"
        )
    similarity.ensure_tables(conn)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS tag3_review (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            question_id INTEGER NOT NULL,
            tag3 TEXT,
            confidence REAL,
            reason TEXT,
            status TEXT DEFAULT 'open'
        )"""
    )
    if "has_hs" not in qcols:
        conn.execute("UPDATE questions SET has_hs=(hs_explanation IS NOT NULL AND hs_explanation!='')")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_q_pick ON questions"
        "(module, submodule, is_real, disabled, has_hs, exam_year, exam_region, id)"
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS explain_cache (
            key TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            module TEXT,
            question_type TEXT,
            question_text TEXT,
            user_answer TEXT,
            explanation TEXT,
            hits INTEGER DEFAULT 0,
            up INTEGER DEFAULT 0,
            down INTEGER DEFAULT 0
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_year INTEGER,
            exam_region TEXT,
            paper TEXT,
            qtype TEXT,
            material TEXT,
            question TEXT UNIQUE,
            reference TEXT,
            notes TEXT,
            import_batch TEXT,
            disabled INTEGER
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_materials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            topic TEXT,
            content TEXT UNIQUE,
            source TEXT,
            import_batch TEXT,
            disabled INTEGER
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shizheng_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            question TEXT UNIQUE,
            options TEXT,
            answer TEXT,
            explanation TEXT,
            source_note TEXT,
            created_at REAL
        )"""
    )
    conn.commit()
    conn.close()
    _seed_questions()
    _seed_shizheng()


def _seed_questions():
    """启动时从 knowledge/questions_bank.jsonl 导入题库（按题干去重）。"""
    path = os.path.join(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".",
                        "knowledge", "questions_bank.jsonl")
    alt = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "questions_bank.jsonl")
    path = path if os.path.exists(path) else alt
    if not os.path.exists(path):
        return
    conn = get_conn()
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except json.JSONDecodeError:
                continue
            cur = conn.execute(
                "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    q.get("module"),
                    q.get("question_type"),
                    q.get("question"),
                    json.dumps(q.get("options", {}), ensure_ascii=False),
                    q.get("answer"),
                    q.get("explanation"),
                    q.get("source"),
                    q.get("submodule"),
                    time.time(),
                ),
            )
            if cur.rowcount:
                _enrich_new_question(conn, cur.lastrowid, "seed")
            if q.get("submodule"):
                conn.execute(
                    "UPDATE questions SET submodule=? WHERE question=? AND (submodule IS NULL OR submodule='')",
                    (q["submodule"], q.get("question")),
                )
    conn.commit()
    conn.close()


def _seed_shizheng():
    """启动时从 knowledge/shizheng_bank.jsonl 导入时政题库（按题干去重）。"""
    path = os.path.join(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".",
                        "knowledge", "shizheng_bank.jsonl")
    alt = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", "shizheng_bank.jsonl")
    path = path if os.path.exists(path) else alt
    if not os.path.exists(path):
        return
    conn = get_conn()
    now = time.time()
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not q.get("question") or not q.get("answer"):
                continue
            conn.execute(
                "INSERT OR IGNORE INTO shizheng_questions (date, question, options, answer, explanation, source_note, created_at) VALUES (?,?,?,?,?,?,?)",
                (
                    q.get("date"),
                    q.get("question"),
                    json.dumps(q.get("options", {}), ensure_ascii=False),
                    q.get("answer"),
                    q.get("explanation"),
                    q.get("source_note"),
                    now,
                ),
            )
    conn.commit()
    conn.close()


def shizheng_daily(day: str, n: int = 10) -> list[dict]:
    """按日期取每日一组时政题：以日期为随机种子从底池确定性抽取，同一天所有人相同。"""
    conn = get_conn()
    ids = [r["id"] for r in conn.execute("SELECT id FROM shizheng_questions ORDER BY id")]
    if not ids:
        conn.close()
        return []
    rng = random.Random(day)
    picked = rng.sample(ids, min(n, len(ids)))
    rows = conn.execute(
        f"SELECT * FROM shizheng_questions WHERE id IN ({','.join('?' * len(picked))})", picked
    ).fetchall()
    conn.close()
    by_id = {r["id"]: r for r in rows}
    items = []
    for qid in picked:
        r = by_id.get(qid)
        if not r:
            continue
        try:
            options = json.loads(r["options"] or "{}")
        except json.JSONDecodeError:
            options = {}
        items.append({
            "id": r["id"],
            "date": r["date"],
            "question": r["question"],
            "options": options,
            "answer": r["answer"],
            "explanation": r["explanation"],
            "source_note": r["source_note"],
            "module": "时政",
            "question_type": "单选",
        })
    return items


def shizheng_count() -> int:
    conn = get_conn()
    n = conn.execute("SELECT COUNT(*) FROM shizheng_questions").fetchone()[0]
    conn.close()
    return n


_PICK_TTL = 600
_pick_cache: dict[tuple, tuple[float, dict]] = {}
_pick_lock = threading.Lock()
_pick_refreshing: set = set()
_pick_build_lock = threading.Lock()


def _pick_rebuild(module, submodule, tag3, year, region):
    key = (module, submodule, tag3, year, region)
    try:
        conn = get_conn()
        pools = _pick_scan(conn, module, submodule, tag3, year, region)
        conn.close()
        with _pick_lock:
            _pick_cache[key] = (time.time(), pools)
    except Exception:
        pass
    finally:
        with _pick_lock:
            _pick_refreshing.discard(key)


def _pick_pools(conn, module, submodule, tag3, year, region) -> dict:
    """按筛选维度缓存候选 id 池（按 is_real×has_hs 分层），使每次抽题只读 limit 行，
    不再每请求全索引 ORDER BY RANDOM() 扫描（页缓存被挤出时单次扫描可达秒级）。"""
    key = (module, submodule, tag3, year, region)
    with _pick_lock:
        ent = _pick_cache.get(key)
        if ent:
            if time.time() - ent[0] < _PICK_TTL:
                return ent[1]
            if key not in _pick_refreshing:
                # 过期先返回旧池（stale-while-revalidate），后台重建，避免用户请求承担秒级重扫
                _pick_refreshing.add(key)
                threading.Thread(
                    target=_pick_rebuild, args=(module, submodule, tag3, year, region), daemon=True
                ).start()
            return ent[1]
    # 冷 miss：单线程构建，并发请求等锁后直接吃缓存，避免同键多请求各自全表扫描（惊群）
    with _pick_build_lock:
        with _pick_lock:
            ent = _pick_cache.get(key)
            if ent:
                return ent[1]
        pools = _pick_scan(conn, module, submodule, tag3, year, region)
        with _pick_lock:
            if len(_pick_cache) >= 512:
                _pick_cache.clear()
            _pick_cache[key] = (time.time(), pools)
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
    with _pick_lock:
        _pick_cache.pop((module, submodule, tag3, year, region), None)


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
    conn = get_conn()
    where = []
    args: list = []
    done: list[int] = []
    order = "has_hs DESC, RANDOM()"
    if adaptive and uid and (module or submodule or tag3):
        _ensure_answer_log(conn)
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
        _ensure_answer_log(conn)
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
    conn = get_conn()
    rows = conn.execute(
        f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))})", ids
    ).fetchall()
    conn.close()
    by_id = {}
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        by_id[d["id"]] = d
    out = [by_id[i] for i in ids if i in by_id]
    out.sort(key=lambda q: (q.get("module") or "", q.get("submodule") or ""))
    return out


def _material_key(text: str) -> str | None:
    """提取资料分析题的材料指纹（用于同材料题组）。"""
    t = text or ""
    if "【资料】" in t:
        t = t.split("【资料】", 1)[1]
    m = re.split(r"问题\s*[：:]", t, maxsplit=1)
    mat = m[0] if len(m) > 1 else t
    mat = re.sub(r"\s+", "", mat)
    if len(mat) < 120:
        return None
    return hashlib.md5(mat[:400].encode()).hexdigest()


def refresh_material_hash(batch: int = 20000) -> int:
    conn = get_conn()
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    if "material_hash" not in cols:
        conn.execute("ALTER TABLE questions ADD COLUMN material_hash TEXT")
    rows = conn.execute(
        "SELECT id, question FROM questions WHERE module='ziliao' AND material_hash IS NULL LIMIT ?",
        (batch,),
    ).fetchall()
    n = 0
    for r in rows:
        conn.execute(
            "UPDATE questions SET material_hash=? WHERE id=?",
            (_material_key(r["question"]) or "-", r["id"]),
        )
        n += 1
    conn.commit()
    conn.close()
    return n


def grouped_ziliao_questions(limit: int = 10, uid: str | None = None) -> list[dict]:
    """资料分析材料题组：选若干材料，同材料题连续出，标注 组内序号/组题数。"""
    conn = get_conn()
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
    hashes = [
        r["material_hash"]
        for r in conn.execute(
            """SELECT material_hash FROM questions
               WHERE module='ziliao' AND material_hash IS NOT NULL AND material_hash!='-'
                 AND disabled=0
               GROUP BY material_hash HAVING COUNT(*)>=2
               ORDER BY RANDOM() LIMIT 24"""
        )
    ]
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


def import_shenlun(questions: list[dict], materials: list[dict], batch: str) -> dict:
    """申论数据导入：进待审（disabled=2），按内容去重。"""
    conn = get_conn()
    qn = mn = 0
    for q in questions or []:
        qt = (q.get("qtype") or "").split("(")[0].split("（")[0] or None
        cur = conn.execute(
            """INSERT OR IGNORE INTO shenlun_questions
               (exam_year, exam_region, paper, qtype, material, question, reference, notes, import_batch, disabled)
               VALUES (?,?,?,?,?,?,?,?,?,2)""",
            (q.get("exam_year"), q.get("exam_region"), q.get("paper"), qt,
             q.get("material"), q.get("question"), q.get("reference"), q.get("notes"), batch),
        )
        qn += cur.rowcount
    for m in materials or []:
        cur = conn.execute(
            """INSERT OR IGNORE INTO shenlun_materials
               (type, topic, content, source, import_batch, disabled)
               VALUES (?,?,?,?,?,2)""",
            (m.get("type"), m.get("topic"), m.get("content"), m.get("source"), batch),
        )
        mn += cur.rowcount
    conn.commit()
    conn.close()
    return {"questions": qn, "materials": mn, "batch": batch}


def shenlun_questions(qtype: str | None = None, year: int | None = None, region: str | None = None, limit: int = 20, offset: int = 0) -> dict:
    conn = get_conn()
    where = ["(disabled IS NULL OR disabled=0)"]
    args: list = []
    if qtype:
        where.append("qtype LIKE ? || '%'")
        args.append(qtype)
    if year:
        where.append("exam_year=?")
        args.append(year)
    if region:
        where.append("exam_region=?")
        args.append(region)
    rows = conn.execute(
        f"""SELECT id, exam_year, exam_region, paper, qtype, question,
                   LENGTH(material) material_len
            FROM shenlun_questions WHERE {' AND '.join(where)}
            ORDER BY exam_year DESC, id LIMIT ? OFFSET ?""",
        (*args, min(limit, 50), offset),
    ).fetchall()
    total = conn.execute(
        f"SELECT COUNT(*) FROM shenlun_questions WHERE {' AND '.join(where)}", args
    ).fetchone()[0]
    conn.close()
    return {"items": [dict(r) for r in rows], "total": total}


def search_shenlun(q: str, limit: int = 5) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT id, exam_year, exam_region, paper, qtype, question
            FROM shenlun_questions
            WHERE (disabled IS NULL OR disabled=0)
              AND (question LIKE '%' || ? || '%' OR paper LIKE '%' || ? || '%')
            ORDER BY exam_year DESC, id LIMIT ?""",
        (q, q, min(max(limit, 1), 10)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def search_shenlun_materials(q: str, limit: int = 5) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT id, type, topic, content, source
            FROM shenlun_materials
            WHERE (disabled IS NULL OR disabled=0)
              AND (topic LIKE '%' || ? || '%' OR content LIKE '%' || ? || '%' OR source LIKE '%' || ? || '%')
            ORDER BY id LIMIT ?""",
        (q, q, q, min(max(limit, 1), 10)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def shenlun_filters() -> dict:
    conn = get_conn()
    years = [r[0] for r in conn.execute(
        "SELECT DISTINCT exam_year FROM shenlun_questions WHERE (disabled IS NULL OR disabled=0) AND exam_year IS NOT NULL ORDER BY exam_year DESC")]
    regions = [r[0] for r in conn.execute(
        "SELECT exam_region FROM shenlun_questions WHERE (disabled IS NULL OR disabled=0) AND exam_region IS NOT NULL "
        "GROUP BY exam_region ORDER BY COUNT(*) DESC")]
    conn.close()
    return {"years": years, "regions": regions}


def shenlun_year_counts() -> list[tuple[int, int]]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT exam_year, COUNT(*) n FROM shenlun_questions
           WHERE (disabled IS NULL OR disabled=0) AND exam_year IS NOT NULL
           GROUP BY exam_year ORDER BY exam_year DESC"""
    ).fetchall()
    conn.close()
    return [(r["exam_year"], r["n"]) for r in rows]


def shenlun_qtype_counts() -> list[tuple[str, int]]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT qtype, COUNT(*) n FROM shenlun_questions
           WHERE (disabled IS NULL OR disabled=0) AND qtype IS NOT NULL AND qtype != ''
           GROUP BY qtype ORDER BY n DESC"""
    ).fetchall()
    conn.close()
    return [(r["qtype"], r["n"]) for r in rows]


def _ensure_shenlun_answers(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            qid INTEGER NOT NULL,
            answer TEXT NOT NULL,
            result TEXT,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_sa_uid ON shenlun_answers(uid, qid, id)")


def _ensure_mat_favs(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS shenlun_mat_favs (
            uid TEXT NOT NULL,
            mid INTEGER NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (uid, mid)
        )"""
    )


def mat_fav_ids(uid: str) -> list[int]:
    conn = get_conn()
    _ensure_mat_favs(conn)
    ids = [r[0] for r in conn.execute(
        "SELECT mid FROM shenlun_mat_favs WHERE uid=? ORDER BY created_at DESC", (uid,))]
    conn.close()
    return ids


def mat_fav_set(uid: str, mid: int, on: bool):
    conn = get_conn()
    _ensure_mat_favs(conn)
    if on:
        conn.execute(
            "INSERT OR IGNORE INTO shenlun_mat_favs (uid, mid, created_at) VALUES (?,?,?)",
            (uid, mid, time.time()))
    else:
        conn.execute("DELETE FROM shenlun_mat_favs WHERE uid=? AND mid=?", (uid, mid))
    conn.commit()
    conn.close()


def mat_fav_items(uid: str) -> list[dict]:
    conn = get_conn()
    _ensure_mat_favs(conn)
    rows = conn.execute(
        """SELECT m.* FROM shenlun_mat_favs f
           JOIN shenlun_materials m ON m.id=f.mid AND (m.disabled IS NULL OR m.disabled=0)
           WHERE f.uid=? ORDER BY f.created_at DESC LIMIT 200""",
        (uid,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_shenlun_answer(uid: str, qid: int, answer: str, result: str) -> int:
    conn = get_conn()
    _ensure_shenlun_answers(conn)
    cur = conn.execute(
        "INSERT INTO shenlun_answers (uid, qid, answer, result, created_at) VALUES (?,?,?,?,?)",
        (uid, qid, answer, result, time.time()),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid


def shenlun_answer_history(uid: str, qid: int | None = None, limit: int = 20) -> list[dict]:
    conn = get_conn()
    _ensure_shenlun_answers(conn)
    where = "uid=?"
    args: list = [uid]
    if qid:
        where += " AND qid=?"
        args.append(qid)
    rows = conn.execute(
        f"""SELECT a.id, a.qid, a.answer, a.result, a.created_at,
                   q.qtype, q.question
            FROM shenlun_answers a LEFT JOIN shenlun_questions q ON q.id=a.qid
            WHERE {where} ORDER BY a.id DESC LIMIT ?""",
        (*args, min(limit, 50)),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _shenlun_issue_lines(result: str, section: str, limit: int = 3) -> list[str]:
    m = re.search(rf"【{section}】(.*?)(?=【|$)", result or "", re.DOTALL)
    if not m:
        return []
    lines = []
    for ln in m.group(1).splitlines():
        ln = re.sub(r"^[\s\-•·*\d．．.、)）]+", "", ln).strip()
        if 4 <= len(ln) <= 60:
            lines.append(ln)
    return lines[:limit]


def shenlun_stats(uid: str) -> dict:
    conn = get_conn()
    _ensure_shenlun_answers(conn)
    total, last = conn.execute(
        "SELECT COUNT(*), MAX(created_at) FROM shenlun_answers WHERE uid=?", (uid,)
    ).fetchone()
    by_type = [
        {"qtype": r[0] or "其他", "n": r[1]}
        for r in conn.execute(
            """SELECT q.qtype, COUNT(*) FROM shenlun_answers a
               LEFT JOIN shenlun_questions q ON q.id=a.qid
               WHERE a.uid=? GROUP BY q.qtype ORDER BY COUNT(*) DESC""",
            (uid,),
        )
    ]
    issues = []
    for (res, qtype) in conn.execute(
        """SELECT a.result, q.qtype FROM shenlun_answers a
           LEFT JOIN shenlun_questions q ON q.id=a.qid
           WHERE a.uid=? AND a.result IS NOT NULL ORDER BY a.id DESC LIMIT 10""",
        (uid,),
    ):
        for sec in ("遗漏要点", "提升建议"):
            for ln in _shenlun_issue_lines(res, sec, 2):
                issues.append({"qtype": qtype or "申论", "kind": sec, "text": ln})
        if len(issues) >= 8:
            break
    conn.close()
    return {"total": total, "last_at": last, "by_type": by_type, "issues": issues[:8]}


def shenlun_question(qid: int) -> dict | None:
    conn = get_conn()
    r = conn.execute(
        "SELECT * FROM shenlun_questions WHERE id=? AND (disabled IS NULL OR disabled=0)", (qid,)
    ).fetchone()
    conn.close()
    return dict(r) if r else None


def shenlun_material_type_counts() -> list[tuple[str, int]]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT type, COUNT(*) n FROM shenlun_materials
           WHERE (disabled IS NULL OR disabled=0) AND type IS NOT NULL AND type<>''
           GROUP BY type ORDER BY n DESC"""
    ).fetchall()
    conn.close()
    return [(r["type"], r["n"]) for r in rows]


def shenlun_materials(topic: str | None = None, mtype: str | None = None, limit: int = 20, offset: int = 0,
                      mid: int | None = None) -> list[dict]:
    conn = get_conn()
    where = ["(disabled IS NULL OR disabled=0)"]
    args: list = []
    if mid is not None:
        where.append("id=?")
        args.append(mid)
    if topic:
        where.append("topic=?")
        args.append(topic)
    if mtype:
        where.append("type=?")
        args.append(mtype)
    rows = conn.execute(
        f"SELECT * FROM shenlun_materials WHERE {' AND '.join(where)} ORDER BY id LIMIT ? OFFSET ?",
        (*args, min(limit, 50), offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def question_counts() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT module, COUNT(*) n FROM questions WHERE disabled=0 GROUP BY module ORDER BY n DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


_DAILY_SET_MODULES = ["yanyu", "panduan", "shuliang", "ziliao", "changshi"]
_daily_set_cache: dict[str, list[int]] = {}
_daily_set_lock = threading.Lock()


def _ensure_daily_set(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS daily_set_entries (
            day TEXT NOT NULL,
            uid TEXT NOT NULL,
            right INTEGER NOT NULL,
            total INTEGER NOT NULL,
            secs REAL,
            created_at REAL NOT NULL,
            PRIMARY KEY (day, uid)
        )"""
    )
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(daily_set_entries)").fetchall()}
    if "nickname" not in cols:
        conn.execute("ALTER TABLE daily_set_entries ADD COLUMN nickname TEXT")


def cn_day() -> str:
    """中国时区（UTC+8）当日日期 YYYY-MM-DD。"""
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))


def daily_archive_day(date: str | None) -> str | None:
    """校验往期每日一练日期：仅接受今天之前 7 天内的 ISO 日期，否则 None。"""
    if not date:
        return None
    try:
        d = time.strptime(str(date)[:10], "%Y-%m-%d")
    except ValueError:
        return None
    day = time.strftime("%Y-%m-%d", d)
    today = cn_day()
    if day >= today:
        return None
    earliest = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600 - 7 * 86400))
    return day if day >= earliest else None


def daily_set_ids(day: str) -> list[int]:
    """全站同题每日一练选题：每模块 2 题共 10 题，md5(day:qid) 最小者优先。

    哈希选择对题库增删稳定（新增题最多顶掉一题），重启重算结果一致。
    """
    with _daily_set_lock:
        if day in _daily_set_cache:
            return _daily_set_cache[day]
        conn = get_conn()
        ids: list[int] = []
        for mod in _DAILY_SET_MODULES:
            pool = [
                r["id"]
                for r in conn.execute(
                    "SELECT id FROM questions INDEXED BY idx_q_pick WHERE module=? AND disabled=0 AND is_real=1",
                    (mod,),
                )
            ]
            if len(pool) < 2:
                pool = [
                    r["id"]
                    for r in conn.execute(
                        "SELECT id FROM questions INDEXED BY idx_q_pick WHERE module=? AND disabled=0",
                        (mod,),
                    )
                ]
            pool.sort(key=lambda q: hashlib.md5(f"{day}:{q}".encode()).hexdigest())
            ids.extend(pool[:2])
        conn.close()
        if len(_daily_set_cache) >= 16:
            _daily_set_cache.clear()
        _daily_set_cache[day] = ids
        return ids


def daily_set_questions(day: str) -> list[dict]:
    ids = daily_set_ids(day)
    if not ids:
        return []
    conn = get_conn()
    rows = conn.execute(
        f"SELECT * FROM questions WHERE id IN ({','.join('?' * len(ids))}) AND disabled=0",
        ids,
    ).fetchall()
    conn.close()
    by_id = {}
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        by_id[d["id"]] = d
    return [by_id[i] for i in ids if i in by_id]


def daily_set_stats(day: str) -> dict:
    conn = get_conn()
    _ensure_daily_set(conn)
    row = conn.execute(
        "SELECT COUNT(*) n, AVG(right) a FROM daily_set_entries WHERE day=?", (day,)
    ).fetchone()
    conn.close()
    return {"participants": row["n"] or 0, "avg_right": round(row["a"], 1) if row["a"] is not None else None}


def daily_set_submit(
    day: str, uid: str, right: int, total: int, secs: float | None, nickname: str | None = None
) -> dict:
    conn = get_conn()
    _ensure_daily_set(conn)
    cur = conn.execute(
        "INSERT OR IGNORE INTO daily_set_entries(day, uid, right, total, secs, nickname, created_at)"
        " VALUES(?,?,?,?,?,?,?)",
        (day, uid, right, total, secs, nickname, time.time()),
    )
    already = cur.rowcount == 0
    conn.commit()
    mine = conn.execute(
        "SELECT right FROM daily_set_entries WHERE day=? AND uid=?", (day, uid)
    ).fetchone()
    my_right = mine["right"] if mine else right
    row = conn.execute(
        "SELECT COUNT(*) n, SUM(CASE WHEN right < ? THEN 1 ELSE 0 END) b, "
        "SUM(CASE WHEN right > ? THEN 1 ELSE 0 END) a FROM daily_set_entries WHERE day=?",
        (my_right, my_right, day),
    ).fetchone()
    days = {
        r["day"]
        for r in conn.execute(
            "SELECT day FROM daily_set_entries WHERE uid=? ORDER BY day DESC LIMIT 60", (uid,)
        ).fetchall()
    }
    conn.close()
    streak = 0
    d = date.fromisoformat(day)
    while d.isoformat() in days:
        streak += 1
        d -= timedelta(days=1)
    participants = row["n"] or 0
    beat_pct = round(100 * (row["b"] or 0) / (participants - 1)) if participants > 1 else None
    # 名次只按答对数（比我分高的人数 + 1），同分并列不计用时
    my_rank = (row["a"] or 0) + 1 if participants else None
    return {
        "participants": participants,
        "beat_pct": beat_pct,
        "my_right": my_right,
        "my_rank": my_rank,
        "already": already,
        "streak": streak,
    }


def daily_set_board(day: str, limit: int = 20) -> list[dict]:
    conn = get_conn()
    _ensure_daily_set(conn)
    rows = conn.execute(
        "SELECT uid, nickname, right, total, secs FROM daily_set_entries WHERE day=? "
        "ORDER BY right DESC, COALESCE(secs, 9e9) ASC, created_at ASC LIMIT ?",
        (day, limit),
    ).fetchall()
    conn.close()
    return [
        {
            "rank": i + 1,
            "name": (r["nickname"] or "").strip()[:20] or r["uid"][:6] + "***",
            "right": r["right"],
            "total": r["total"],
            "secs": r["secs"],
        }
        for i, r in enumerate(rows)
    ]


def submodule_counts(module: str) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT submodule, COUNT(*) n FROM questions WHERE module=? AND disabled=0 AND submodule IS NOT NULL AND submodule!='' "
        "GROUP BY submodule HAVING n >= 8 OR submodule='图形推理' ORDER BY n DESC LIMIT 30",
        (module,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


_TAG3_COUNTS_CACHE: list = [0.0, None]
TAG3_COUNTS_TTL = 300


def tag3_counts() -> dict:
    """各三级考点 code 的题目数（不含已下架），进程内 5 分钟缓存。"""
    now = time.time()
    if _TAG3_COUNTS_CACHE[1] is not None and now - _TAG3_COUNTS_CACHE[0] < TAG3_COUNTS_TTL:
        return _TAG3_COUNTS_CACHE[1]
    conn = get_conn()
    rows = conn.execute(
        "SELECT tag3, COUNT(*) n FROM questions WHERE tag3 IS NOT NULL AND tag3!='' "
        "AND disabled=0 GROUP BY tag3"
    ).fetchall()
    conn.close()
    out = {r["tag3"]: r["n"] for r in rows}
    _TAG3_COUNTS_CACHE[0] = now
    _TAG3_COUNTS_CACHE[1] = out
    return out


_YEAR_MODULE_CACHE: list = [0.0, None]


def year_module_counts() -> dict:
    """各（年份, 模块）的在架真题数与最新 updated_at，进程内 5 分钟缓存。"""
    now = time.time()
    if _YEAR_MODULE_CACHE[1] is not None and now - _YEAR_MODULE_CACHE[0] < TAG3_COUNTS_TTL:
        return _YEAR_MODULE_CACHE[1]
    conn = get_conn()
    rows = conn.execute(
        "SELECT exam_year y, module m, COUNT(*) n, MAX(updated_at) mu FROM questions "
        "WHERE is_real=1 AND disabled=0 AND exam_year IS NOT NULL GROUP BY exam_year, module"
    ).fetchall()
    conn.close()
    out = {(r["y"], r["m"]): (r["n"], r["mu"]) for r in rows}
    _YEAR_MODULE_CACHE[0] = now
    _YEAR_MODULE_CACHE[1] = out
    return out


_TAG3_LASTMOD_CACHE: list = [0.0, None]


def tag3_lastmod() -> dict:
    """各三级考点最新 updated_at（在架），进程内 5 分钟缓存，用于 sitemap lastmod。"""
    now = time.time()
    if _TAG3_LASTMOD_CACHE[1] is not None and now - _TAG3_LASTMOD_CACHE[0] < TAG3_COUNTS_TTL:
        return _TAG3_LASTMOD_CACHE[1]
    conn = get_conn()
    rows = conn.execute(
        "SELECT tag3, MAX(updated_at) mu FROM questions WHERE tag3 IS NOT NULL AND tag3!='' "
        "AND disabled=0 GROUP BY tag3"
    ).fetchall()
    conn.close()
    out = {r["tag3"]: r["mu"] for r in rows}
    _TAG3_LASTMOD_CACHE[0] = now
    _TAG3_LASTMOD_CACHE[1] = out
    return out


def questions_by_tag3(code: str, offset: int = 0, limit: int = 20) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, module, submodule, tag3, question, options, answer, explanation, is_real, exam_year, exam_region "
        "FROM questions WHERE tag3=? AND disabled=0 ORDER BY id DESC LIMIT ? OFFSET ?",
        (code, min(limit, 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def tag3_review_add(question_id: int, tag3: str | None, confidence: float | None, reason: str):
    conn = get_conn()
    conn.execute(
        "DELETE FROM tag3_review WHERE question_id=? AND status='open'", (question_id,)
    )
    conn.execute(
        "INSERT INTO tag3_review (created_at, question_id, tag3, confidence, reason) VALUES (?,?,?,?,?)",
        (time.time(), question_id, tag3, confidence, reason),
    )
    conn.commit()
    conn.close()


def tag3_review_list(limit: int = 100, module: str | None = None) -> dict:
    conn = get_conn()
    cond = "r.status='open'"
    args: list = []
    if module:
        cond += " AND q.module=?"
        args.append(module)
    total = conn.execute(
        f"SELECT COUNT(*) FROM tag3_review r LEFT JOIN questions q ON q.id=r.question_id WHERE {cond}",
        args,
    ).fetchone()[0]
    rows = conn.execute(
        f"""SELECT r.id, r.created_at, r.question_id, r.tag3, r.confidence, r.reason, r.status,
                  q.module, q.submodule, q.question, q.options, q.explanation, q.answer, q.tag3 AS cur_tag3
           FROM tag3_review r LEFT JOIN questions q ON q.id=r.question_id
           WHERE {cond} ORDER BY r.id DESC LIMIT ?""",
        args + [min(limit, 300)],
    ).fetchall()
    conn.close()
    return {"total": total, "items": [dict(r) for r in rows]}


def tag3_review_close(question_id: int):
    conn = get_conn()
    conn.execute("UPDATE tag3_review SET status='done' WHERE question_id=? AND status='open'", (question_id,))
    conn.commit()
    conn.close()


def real_filters() -> dict:
    """真题可用的年份/地区筛选项及题量。"""
    conn = get_conn()
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
    return {"years": years, "regions": regions}


def save_practice_result(module: str | None, n: int, correct: int, secs: int) -> dict:
    """保存一次刷题结果并返回正确率百分位（击败了多少历史记录）。"""
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS practice_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            module TEXT,
            n INTEGER,
            correct INTEGER,
            secs INTEGER
        )"""
    )
    acc = correct / n if n else 0
    conn.execute(
        "INSERT INTO practice_results (created_at, module, n, correct, secs) VALUES (?,?,?,?,?)",
        (time.time(), module, n, correct, secs),
    )
    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM practice_results WHERE n>0").fetchone()[0]
    beaten = conn.execute(
        "SELECT COUNT(*) FROM practice_results WHERE n>0 AND CAST(correct AS REAL)/n < ?", (acc,)
    ).fetchone()[0]
    conn.close()
    percentile = round(beaten / total * 100) if total >= 10 else None
    return {"percentile": percentile, "samples": total}


def _ensure_announcements(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            active INTEGER DEFAULT 1
        )"""
    )


def active_announcement() -> dict | None:
    conn = get_conn()
    _ensure_announcements(conn)
    row = conn.execute(
        "SELECT id, title, body FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def admin_list_announcements() -> list[dict]:
    conn = get_conn()
    _ensure_announcements(conn)
    rows = conn.execute(
        "SELECT id, created_at, title, body, active FROM announcements ORDER BY id DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_create_announcement(title: str, body: str) -> int:
    conn = get_conn()
    _ensure_announcements(conn)
    cur = conn.execute(
        "INSERT INTO announcements (created_at, title, body, active) VALUES (?,?,?,1)",
        (time.time(), title, body),
    )
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return aid


def _ensure_reports(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS question_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            question_id INTEGER,
            reason TEXT NOT NULL,
            detail TEXT,
            status TEXT DEFAULT 'open'
        )"""
    )
    rcols = {r["name"] for r in conn.execute("PRAGMA table_info(question_reports)")}
    for col, ddl in [
        ("uid", "ALTER TABLE question_reports ADD COLUMN uid TEXT"),
        ("note", "ALTER TABLE question_reports ADD COLUMN note TEXT"),
        ("handled_at", "ALTER TABLE question_reports ADD COLUMN handled_at REAL"),
    ]:
        if col not in rcols:
            conn.execute(ddl)


def add_report(question_id: int | None, reason: str, detail: str) -> int:
    conn = get_conn()
    _ensure_reports(conn)
    if question_id:
        dup = conn.execute(
            "SELECT id FROM question_reports WHERE question_id=? AND reason=? "
            "AND status='open' AND created_at > ? LIMIT 1",
            (question_id, reason, time.time() - 86400),
        ).fetchone()
        if dup:
            conn.close()
            return dup["id"]
    cur = conn.execute(
        "INSERT INTO question_reports (created_at, question_id, reason, detail) VALUES (?,?,?,?)",
        (time.time(), question_id, reason, detail),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid


def add_question_report(question_id: int, uid: str | None, rtype: str, detail: str) -> tuple[int, bool]:
    """同一 uid 对同一题重复提交时去重更新，返回 (id, 是否为更新)。"""
    conn = get_conn()
    _ensure_reports(conn)
    if uid:
        dup = conn.execute(
            "SELECT id FROM question_reports WHERE question_id=? AND uid=? LIMIT 1",
            (question_id, uid),
        ).fetchone()
        if dup:
            conn.execute(
                "UPDATE question_reports SET reason=?, detail=?, created_at=?, status='open', "
                "note=NULL, handled_at=NULL WHERE id=?",
                (rtype, detail, time.time(), dup["id"]),
            )
            conn.commit()
            conn.close()
            return dup["id"], True
    cur = conn.execute(
        "INSERT INTO question_reports (created_at, question_id, uid, reason, detail) VALUES (?,?,?,?,?)",
        (time.time(), question_id, uid, rtype, detail),
    )
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid, False


_REPORT_STATUS_ALIASES = {"fixed": ("fixed", "resolved"), "rejected": ("rejected", "dismissed"), "open": ("open",)}


def admin_list_reports(status: str = "open") -> list[dict]:
    conn = get_conn()
    _ensure_reports(conn)
    statuses = _REPORT_STATUS_ALIASES.get(status, (status,))
    ph = ",".join("?" for _ in statuses)
    rows = conn.execute(
        f"""SELECT r.id, r.created_at, r.question_id, r.uid, r.reason, r.detail, r.status,
                  r.note, r.handled_at,
                  q.question, q.options, q.module, q.submodule, q.answer, q.explanation,
                  q.hs_explanation, q.disabled
           FROM question_reports r LEFT JOIN questions q ON q.id = r.question_id
           WHERE r.status IN ({ph}) ORDER BY r.id DESC LIMIT 100""",
        statuses,
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_open_report_count() -> int:
    conn = get_conn()
    _ensure_reports(conn)
    n = conn.execute("SELECT COUNT(*) AS n FROM question_reports WHERE status='open'").fetchone()["n"]
    conn.close()
    return n


def admin_handle_report(rid: int, status: str, note: str | None = None) -> bool:
    conn = get_conn()
    _ensure_reports(conn)
    handled = time.time() if status in ("fixed", "rejected", "resolved", "dismissed") else None
    cur = conn.execute(
        "UPDATE question_reports SET status=?, note=COALESCE(?, note), handled_at=? WHERE id=?",
        (status, note, handled, rid),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_resolve_report(rid: int, status: str) -> bool:
    conn = get_conn()
    _ensure_reports(conn)
    cur = conn.execute("UPDATE question_reports SET status=? WHERE id=?", (status, rid))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_set_announcement(aid: int, active: bool) -> bool:
    conn = get_conn()
    _ensure_announcements(conn)
    cur = conn.execute("UPDATE announcements SET active=? WHERE id=?", (1 if active else 0, aid))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def admin_stats() -> dict:
    return _cached("stats", 300, _admin_stats_uncached)


def admin_stats_state() -> tuple[dict, str]:
    return _cached_state("stats", 300, _admin_stats_uncached)


def _admin_stats_uncached() -> dict:
    conn = get_conn()
    q = conn.execute
    stats = {
        "total": q("SELECT COUNT(*) FROM questions").fetchone()[0],
        "real": q("SELECT COUNT(*) FROM questions WHERE is_real=1").fetchone()[0],
        "disabled": q("SELECT COUNT(*) FROM questions WHERE disabled=1").fetchone()[0],
        "hs_done": q("SELECT COUNT(*) FROM questions WHERE hs_explanation IS NOT NULL AND hs_explanation!=''").fetchone()[0],
        "hs_down_total": q("SELECT COUNT(*) FROM questions WHERE hs_down>0").fetchone()[0],
        "by_module": [dict(r) for r in q("SELECT module, COUNT(*) n FROM questions GROUP BY module ORDER BY n DESC")],
        "cache_entries": q("SELECT COUNT(*) FROM explain_cache").fetchone()[0],
        "cache_hits": q("SELECT COALESCE(SUM(hits),0) FROM explain_cache").fetchone()[0],
        "cache_down": q("SELECT COUNT(*) FROM explain_cache WHERE down>0").fetchone()[0],
        "mistakes": q("SELECT COUNT(*) FROM mistakes").fetchone()[0],
    }
    try:
        stats["daily_usage"] = [
            dict(r)
            for r in q(
                """SELECT date(created_at, 'unixepoch') d,
                          COUNT(*) sessions, SUM(n) answered,
                          ROUND(SUM(correct)*100.0/SUM(n), 1) acc
                   FROM practice_results WHERE n>0
                     AND created_at > strftime('%s','now') - 14*86400
                   GROUP BY d ORDER BY d"""
            )
        ]
    except Exception:
        stats["daily_usage"] = []
    conn.close()
    return stats


def admin_search_questions(
    keyword: str | None = None,
    module: str | None = None,
    flagged: bool = False,
    disabled_only: bool = False,
    offset: int = 0,
    limit: int = 20,
    qid: int | None = None,
    min_score: int | None = None,
    max_score: int | None = None,
    sort: str | None = None,
) -> list[dict]:
    conn = get_conn()
    where = []
    args: list = []
    if qid:
        where.append("id=?")
        args.append(qid)
    if keyword:
        where.append("question LIKE ?")
        args.append(f"%{keyword}%")
    if module:
        where.append("module=?")
        args.append(module)
    if flagged:
        where.append("hs_down>0")
    if disabled_only:
        where.append("disabled=1")
    if min_score is not None:
        where.append("quality_score>=?")
        args.append(min_score)
    if max_score is not None:
        where.append("quality_score<=?")
        args.append(max_score)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    if sort == "score_asc":
        order = "quality_score IS NULL, quality_score ASC, id DESC"
    elif sort == "score_desc":
        order = "quality_score IS NULL, quality_score DESC, id DESC"
    elif flagged:
        order = "hs_down DESC, id DESC"
    else:
        order = "id DESC"
    rows = conn.execute(
        f"SELECT id, module, submodule, question, options, answer, explanation, hs_explanation, "
        f"hs_up, hs_down, is_real, exam_year, exam_region, source, disabled, tag3, quality_score "
        f"FROM questions {clause} ORDER BY {order} LIMIT ? OFFSET ?",
        (*args, min(limit, 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


ADMIN_EDITABLE = {"answer", "explanation", "hs_explanation", "submodule", "question", "disabled", "module", "exam_year", "exam_region", "is_real", "tag3", "options"}


def rescore_question(conn, qid: int):
    """按现行口径重算并回写单题 quality_score（内容变更后调用，防打分过期）。"""
    row = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    if row:
        conn.execute(
            "UPDATE questions SET quality_score=? WHERE id=?",
            (quality.score_question(dict(row)), qid),
        )


def admin_update_question(qid: int, fields: dict) -> bool:
    sets = {k: v for k, v in fields.items() if k in ADMIN_EDITABLE}
    if not sets:
        return False
    conn = get_conn()
    assignments = ", ".join(f"{k}=?" for k in sets)
    cur = conn.execute(
        f"UPDATE questions SET {assignments}, updated_at=? WHERE id=?",
        (*sets.values(), time.time(), qid),
    )
    rescore_question(conn, qid)
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def dup_cluster_list(offset: int = 0, limit: int = 20, status: str = "open") -> dict:
    conn = get_conn()
    total = conn.execute(
        "SELECT COUNT(DISTINCT cluster_id) FROM dup_clusters WHERE status=?", (status,)
    ).fetchone()[0]
    rows = conn.execute(
        """SELECT d.cluster_id, COUNT(*) n, MAX(d.similarity) max_sim,
                  COUNT(DISTINCT q.module) modules_n,
                  GROUP_CONCAT(DISTINCT q.module) modules,
                  COUNT(DISTINCT q.answer) answers_n,
                  MIN(q.question) sample
           FROM dup_clusters d JOIN questions q ON q.id=d.qid
           WHERE d.status=?
           GROUP BY d.cluster_id ORDER BY n DESC, d.cluster_id
           LIMIT ? OFFSET ?""",
        (status, min(limit, 100), offset),
    ).fetchall()
    conn.close()
    return {"total": total, "items": [dict(r) for r in rows]}


def dup_cluster_detail(cluster_id: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT q.id, q.module, q.submodule, q.question, q.options, q.answer,
                  q.explanation, q.hs_explanation, q.is_real, q.exam_year, q.exam_region,
                  q.source, q.disabled, q.tag3, q.quality_score, d.similarity, d.status
           FROM dup_clusters d JOIN questions q ON q.id=d.qid
           WHERE d.cluster_id=? ORDER BY q.quality_score DESC, q.id""",
        (cluster_id,),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def dup_cluster_resolve(cluster_id: int, keep_qid: int | None) -> dict:
    """一键保留最优：保留 keep_qid，下架簇内其余题；keep_qid 为 None 时仅标记忽略。"""
    conn = get_conn()
    qids = [r["qid"] for r in conn.execute(
        "SELECT qid FROM dup_clusters WHERE cluster_id=? AND status='open'", (cluster_id,)
    )]
    if not qids:
        conn.close()
        return {"ok": False, "error": "簇不存在或已处理"}
    disabled = []
    if keep_qid is not None:
        if keep_qid not in qids:
            conn.close()
            return {"ok": False, "error": "keep_qid 不在该簇内"}
        disabled = [q for q in qids if q != keep_qid]
        conn.executemany(
            "UPDATE questions SET disabled=1, updated_at=? WHERE id=?",
            [(time.time(), q) for q in disabled],
        )
    new_status = "resolved" if keep_qid is not None else "ignored"
    conn.execute("UPDATE dup_clusters SET status=? WHERE cluster_id=?", (new_status, cluster_id))
    conn.commit()
    conn.close()
    return {"ok": True, "kept": keep_qid, "disabled": disabled, "status": new_status}


def dup_cluster_stats() -> dict:
    conn = get_conn()
    row = conn.execute(
        """SELECT COUNT(DISTINCT CASE WHEN status='open' THEN cluster_id END) open_clusters,
                  COUNT(CASE WHEN status='open' THEN 1 END) open_questions,
                  COUNT(DISTINCT CASE WHEN status='resolved' THEN cluster_id END) resolved,
                  COUNT(DISTINCT CASE WHEN status='ignored' THEN cluster_id END) ignored
           FROM dup_clusters"""
    ).fetchone()
    meta = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM sim_meta")}
    conn.close()
    return {**dict(row), "meta": meta}


def admin_flagged_cache(limit: int = 30) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT key, module, question_type, question_text, user_answer, explanation, hits, up, down "
        "FROM explain_cache WHERE down>0 ORDER BY down DESC, hits DESC LIMIT ?",
        (min(limit, 100),),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_delete_cache(key: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM explain_cache WHERE key=?", (key,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def get_explain_cache(key: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM explain_cache WHERE key=?", (key,)).fetchone()
    if row:
        conn.execute("UPDATE explain_cache SET hits=hits+1 WHERE key=?", (key,))
        conn.commit()
    conn.close()
    return dict(row) if row else None


def save_explain_cache(key: str, meta: dict, explanation: str):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO explain_cache (key, created_at, module, question_type, question_text, user_answer, explanation, hits, up, down) "
        "VALUES (?,?,?,?,?,?,?, COALESCE((SELECT hits FROM explain_cache WHERE key=?),0), "
        "COALESCE((SELECT up FROM explain_cache WHERE key=?),0), COALESCE((SELECT down FROM explain_cache WHERE key=?),0))",
        (
            key,
            time.time(),
            meta.get("module"),
            meta.get("question_type"),
            meta.get("question_text"),
            meta.get("user_answer"),
            explanation,
            key,
            key,
            key,
        ),
    )
    conn.commit()
    conn.close()


def rate_explain(key: str, up: bool):
    conn = get_conn()
    col = "up" if up else "down"
    conn.execute(f"UPDATE explain_cache SET {col}={col}+1 WHERE key=?", (key,))
    conn.commit()
    conn.close()


def rate_question_hs(qid: int, up: bool):
    conn = get_conn()
    col = "hs_up" if up else "hs_down"
    conn.execute(f"UPDATE questions SET {col}={col}+1 WHERE id=?", (qid,))
    rescore_question(conn, qid)
    conn.commit()
    conn.close()


def set_question_hs_explanation(qid: int, text: str):
    conn = get_conn()
    conn.execute(
        "UPDATE questions SET hs_explanation=?, has_hs=?, updated_at=? WHERE id=?",
        (text, 1 if text else 0, time.time(), qid),
    )
    rescore_question(conn, qid)
    conn.commit()
    conn.close()


def export_questions(offset: int = 0, limit: int = 200, module: str | None = None, missing_only: bool = True) -> list[dict]:
    conn = get_conn()
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


VALID_MODULES = {"ziliao", "shuliang", "yanyu", "panduan", "changshi"}

_SUB_PREFIXES = (
    "数学运算-", "数量关系-", "资料分析-", "言语理解-", "言语理解与表达-",
    "判断推理-", "逻辑判断-", "常识判断-", "常识-", "综合题组-",
)
_SUB_SYNONYMS = {
    "溶液问题": "浓度问题",
    "经济利润问题": "经济利润",
    "行程": "行程问题",
    "工程": "工程问题",
    "排列组合与概率问题": "排列组合与概率",
    "排列组合": "排列组合与概率",
    "概率问题": "排列组合与概率",
    "概率": "排列组合与概率",
    "几何": "几何问题",
    "逻辑填空（实词/成语辨析）": "逻辑填空",
    "中心理解题": "中心理解",
    "主旨概括": "中心理解",
    "细节理解题": "细节理解",
    "细节判断": "细节理解",
    "法律常识": "法律",
    "科技常识": "科技",
    "政治常识": "政治",
    "经济常识": "经济",
    "地理常识": "地理",
    "人文": "历史人文",
    "人文常识": "历史人文",
    "历史常识": "历史人文",
    "理论政策": "政治",
    "理论": "政治",
}


_SUB_COLLAPSE = ("类比推理", "定义判断", "图形推理")

# 轮1 T3b 定案的 submodule 同义合并映射（module → {旧名: 新名}），
# 供 answer_log 写入归一与一次性迁移脚本共用。
SUBMODULE_MERGE = {
    "changshi": {
        "公文": "管理与公文", "应急": "管理与公文",
        "地理": "地理国情",
        "环保": "生态", "环境": "生态",
        "婚家": "婚姻",
        "消保": "消费",
        "个人信息": "个保",
        "未保": "未成年",
        "科技常识": "科技", "科技-物理": "科技", "物理": "科技",
        "网安": "网络",
        "道交": "交通",
    },
    "shuliang": {
        "钟表问题": "周期与日期", "敲钟问题": "周期与日期",
        "牛吃草问题": "工程问题",
        "抽屉原理": "最值问题", "最不利原则": "最值问题", "构造类问题": "最值问题",
        "和倍问题": "计算问题", "还原问题": "计算问题", "平均数问题": "计算问题",
        "不定方程": "计算问题", "盈亏问题": "计算问题", "鸡兔同笼": "计算问题",
        "植树问题": "植树与方阵", "方阵问题": "植树与方阵", "锯木问题": "植树与方阵",
        "数列问题": "数字推理", "数字推理-多重数列": "数字推理",
        "爬楼问题": "行程问题", "队列问题": "行程问题",
    },
    "yanyu": {
        "意图判断": "中心理解", "片段阅读": "中心理解",
        "词句理解": "细节理解",
        "语句排序": "语句表达", "语句填空": "语句表达", "接语选择": "语句表达",
    },
    "panduan": {"逻辑推理": "逻辑判断"},
    "ziliao": {
        "基期现期": "基期与现期", "基期量": "基期与现期", "现期量": "基期与现期",
        "增长问题": "增长率", "比重问题": "比重",
        "简单计算": "简单计算与读数",
        "平均数": "平均数与倍数", "倍数": "平均数与倍数",
    },
}


def merge_submodule(module: str | None, sub: str | None) -> str | None:
    """按轮1 T3b 定案映射把旧考点名归一为当前 taxonomy 名。"""
    if not sub:
        return sub
    return SUBMODULE_MERGE.get(module or "", {}).get(sub, sub)


def normalize_submodule(sub: str | None) -> str | None:
    if not sub:
        return sub
    s = str(sub).strip()
    for c in _SUB_COLLAPSE:
        if s.startswith((c + "-", c + "：")):
            return c
    for p in _SUB_PREFIXES:
        if s.startswith(p):
            s = s[len(p):]
            break
    return _SUB_SYNONYMS.get(s, s) or None


_RESIDUE_RE = re.compile(r"[一二三四五六七八九十]、|第[一二三四五]部分|共\d+题")


def _bad_options(opts: dict) -> bool:
    vals = [str(v).strip() for v in opts.values()]
    if len(vals) < 2 or any(not v for v in vals) or len(set(vals)) < len(vals):
        return True
    return any(len(v) > 120 or _RESIDUE_RE.search(v) for v in vals)


def _enrich_new_question(conn, qid: int, batch: str | None = None):
    """新题入库钩子：规则分类补 tag3/submodule、质量打分、记导入批次；

    无法分类的题进 tag3_review 抽审队列并转待审（disabled=2），不裸上架。"""
    row = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    if not row:
        return
    d = dict(row)
    tag3, conf = classify_question(d)
    score = quality.score_question(d)
    sub = merge_submodule(d.get("module"), d.get("submodule"))
    if not sub and tag3 != "UNKNOWN":
        t = taxonomy.topic_index().get(tag3)
        if t:
            sub = t["group_name"]
    conn.execute(
        "UPDATE questions SET tag3=?, quality_score=?, submodule=?, "
        "import_batch=COALESCE(import_batch,?) WHERE id=?",
        (tag3, score, sub, batch or "auto" + time.strftime("%Y%m%d"), qid),
    )
    if tag3 == "UNKNOWN":
        conn.execute(
            "UPDATE questions SET disabled=2 WHERE id=? AND (disabled IS NULL OR disabled=0)",
            (qid,),
        )
        conn.execute(
            "DELETE FROM tag3_review WHERE question_id=? AND status='open'", (qid,)
        )
        conn.execute(
            "INSERT INTO tag3_review (created_at, question_id, tag3, confidence, reason) VALUES (?,?,?,?,?)",
            (time.time(), qid, None, conf, "新题入库规则分类未命中"),
        )


def import_questions(items: list[dict], batch: str | None = None) -> dict:
    conn = get_conn()
    inserted = 0
    skipped = 0
    for q in items:
        opts = q.get("options") or {}
        if q.get("is_real") and (not q.get("source") or q.get("source") == "original"):
            q["is_real"] = False
        if (
            q.get("module") not in VALID_MODULES
            or not q.get("question")
            or not q.get("answer")
            or not isinstance(opts, dict)
            or q.get("answer") not in opts
            or _bad_options(opts)
        ):
            skipped += 1
            continue
        cur = conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule, is_real, exam_year, exam_region, disabled, import_batch, image, image_credit, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                q.get("module"),
                q.get("question_type"),
                q.get("question"),
                json.dumps(opts, ensure_ascii=False),
                q.get("answer"),
                q.get("explanation"),
                q.get("source"),
                normalize_submodule(q.get("submodule")),
                1 if q.get("is_real") else 0,
                q.get("exam_year"),
                q.get("exam_region"),
                2 if batch else 0,
                batch,
                q.get("image"),
                q.get("image_credit"),
                time.time(),
            ),
        )
        if cur.rowcount:
            inserted += 1
            _enrich_new_question(conn, cur.lastrowid, batch)
        else:
            skipped += 1
            if q.get("is_real"):
                conn.execute(
                    "UPDATE questions SET is_real=1, exam_year=COALESCE(exam_year,?), exam_region=COALESCE(exam_region,?), updated_at=? WHERE question=?",
                    (q.get("exam_year"), q.get("exam_region"), time.time(), q.get("question")),
                )
    conn.commit()
    conn.close()
    return {"inserted": inserted, "skipped": skipped, "batch": batch}


def mistakes_redo_questions(limit: int = 10, qtype: str | None = None, module: str | None = None, noqt: bool = False, uid: str | None = None) -> list[dict]:
    """把待掌握错题匹配回题库原题，供刷题页重练。"""
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, cargs = _uid_clause(uid)
    where = "mastered=0" + cl
    args: list = list(cargs)
    if qtype:
        where += " AND question_type=?"
        args.append(qtype)
    if module:
        where += " AND module=?"
        args.append(module)
    if noqt:
        where += " AND (question_type IS NULL OR question_type='')"
    rows = conn.execute(
        f"SELECT id, question_text, question_id FROM mistakes WHERE {where} ORDER BY COALESCE(next_review, created_at), created_at DESC LIMIT ?",
        (*args, limit * 2),
    ).fetchall()
    out = []
    seen = set()
    for r in rows:
        full = (r["question_text"] or "").strip()
        head = full.split("\n")[0].strip()
        key = re.sub(r"\s+", "", full)
        if not head or key in seen:
            continue
        seen.add(key)
        if r["question_id"]:
            byid = conn.execute(
                "SELECT * FROM questions WHERE id=? AND (disabled IS NULL OR disabled=0)",
                (r["question_id"],),
            ).fetchone()
            if byid:
                d = dict(byid)
                d["options"] = json.loads(d.get("options") or "{}")
                d["mistake_id"] = r["id"]
                out.append(d)
                if len(out) >= limit:
                    break
                continue
        esc = lambda s: s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        cands = conn.execute(
            "SELECT * FROM questions WHERE question LIKE ? ESCAPE '\\' AND (disabled IS NULL OR disabled=0) LIMIT 80",
            (esc(full) + "%",),
        ).fetchall()
        if not cands:
            lines = [ln.strip() for ln in full.split("\n") if ln.strip()]
            second = lines[1][:20] if len(lines) > 1 else ""
            pats = []
            if second:
                pats.append(esc(head) + "%" + esc(second) + "%")
            pats.append(esc(head) + "%")
            for p in pats:
                cands = conn.execute(
                    "SELECT * FROM questions WHERE question LIKE ? ESCAPE '\\' AND (disabled IS NULL OR disabled=0) LIMIT 80",
                    (p,),
                ).fetchall()
                if cands:
                    break
        norm = re.sub(r"\s+", "", full)
        q = None
        for c in cands:
            cn = re.sub(r"\s+", "", c["question"] or "")
            if cn == norm or cn.startswith(norm) or norm.startswith(cn):
                q = c
                break
        if not q:
            continue
        d = dict(q)
        d["options"] = json.loads(d.get("options") or "{}")
        d["mistake_id"] = r["id"]
        out.append(d)
        if len(out) >= limit:
            break
    conn.close()
    return out


def admin_batches() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT import_batch AS batch, COUNT(*) AS n,
                  SUM(CASE WHEN disabled=2 THEN 1 ELSE 0 END) AS pending,
                  SUM(is_real) AS real_n
           FROM questions WHERE import_batch IS NOT NULL
           GROUP BY import_batch ORDER BY import_batch DESC LIMIT 50"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def admin_batch_sample(batch: str, limit: int = 10) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM questions WHERE import_batch=? ORDER BY RANDOM() LIMIT ?",
        (batch, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d["options"] or "{}")
        out.append(d)
    return out


def admin_batch_decide(batch: str, approve: bool) -> int:
    conn = get_conn()
    if approve:
        cur = conn.execute(
            "UPDATE questions SET disabled=0, updated_at=? WHERE import_batch=? AND disabled=2",
            (time.time(), batch),
        )
    else:
        cur = conn.execute(
            "DELETE FROM questions WHERE import_batch=? AND disabled=2", (batch,)
        )
    conn.commit()
    n = cur.rowcount
    conn.close()
    return n


def import_hs_explanations(items: list[dict]) -> int:
    conn = get_conn()
    n = 0
    for it in items:
        qid = it.get("id")
        if not qid:
            continue
        text = (it.get("hs_explanation") or "").strip()
        xp = (it.get("xp_explanation") or "").strip()
        school = (it.get("xp_school") or "").strip()
        if text:
            n += conn.execute(
                "UPDATE questions SET hs_explanation=?, has_hs=1, updated_at=? WHERE id=?",
                (text, time.time(), int(qid)),
            ).rowcount
        if xp:
            n += conn.execute(
                "UPDATE questions SET xp_explanation=?, xp_school=?, updated_at=? WHERE id=?",
                (xp, school or None, time.time(), int(qid)),
            ).rowcount
        if text or xp:
            rescore_question(conn, int(qid))
    conn.commit()
    conn.close()
    return n


def _ensure_answer_log(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS answer_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            created_at REAL NOT NULL,
            question_id INTEGER,
            module TEXT,
            submodule TEXT,
            correct INTEGER,
            secs INTEGER
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_al_uid ON answer_log(uid, created_at)")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(answer_log)")}
    if "picked" not in cols:
        conn.execute("ALTER TABLE answer_log ADD COLUMN picked TEXT")
    if "source" not in cols:
        # 推荐埋点：进入练习的入口（reco/weak/reinforce），旧数据默认 NULL
        conn.execute("ALTER TABLE answer_log ADD COLUMN source TEXT")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_al_qid ON answer_log(question_id)")


def save_answer_log(uid: str, items: list[dict]) -> int:
    conn = get_conn()
    _ensure_answer_log(conn)
    now = time.time()
    n = 0
    for it in items:
        if not isinstance(it, dict):
            continue
        qid = it.get("qid") or it.get("question_id") or it.get("id")
        module, sub = it.get("module"), it.get("submodule")
        if qid and (not module or module in VALID_MODULES):
            # 时政等非行测模块的 qid 指向其它表，不能拿 questions 表覆盖
            qrow = conn.execute(
                "SELECT module, submodule FROM questions WHERE id=?", (qid,)
            ).fetchone()
            if qrow:
                module = qrow["module"] or module
                sub = qrow["submodule"] or sub
        sub = merge_submodule(module, sub)
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, submodule, correct, secs, picked, source) VALUES (?,?,?,?,?,?,?,?,?)",
            (
                uid,
                now,
                qid,
                module,
                sub,
                1 if it.get("correct") else 0,
                int(it.get("secs") or 0),
                str(it.get("picked") or "")[:2] or None,
                (str(it.get("source") or "")[:32] or None),
            ),
        )
        n += 1
    conn.commit()
    conn.close()
    return n


_HISTORY_SESSION_GAP = 1800  # 相邻作答间隔超过该秒数即切分为新一次练习


def practice_history(uid: str, limit: int = 50) -> list[dict]:
    """把 answer_log 按时间间隔切分为练习会话（倒序）。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        "SELECT created_at, module, correct, secs, source FROM answer_log WHERE uid=? ORDER BY created_at DESC LIMIT 2000",
        (uid,),
    ).fetchall()
    conn.close()
    sessions: list[dict] = []
    cur: dict | None = None
    for r in rows:  # 倒序遍历：r 比 cur['start'] 更早
        if cur is None or cur["start"] - r["created_at"] > _HISTORY_SESSION_GAP:
            if len(sessions) >= limit:
                break
            cur = {
                "start": r["created_at"],
                "end": r["created_at"],
                "n": 0,
                "correct": 0,
                "secs": 0,
                "modules": [],
                "source": r["source"],
            }
            sessions.append(cur)
        cur["start"] = r["created_at"]
        cur["n"] += 1
        cur["correct"] += 1 if r["correct"] else 0
        cur["secs"] += r["secs"] or 0
        if r["module"] and r["module"] not in cur["modules"]:
            cur["modules"].append(r["module"])
    return sessions


def practice_history_detail(uid: str, start: float, end: float) -> list[dict]:
    """某次练习的逐题记录，附题库原题（供回看与重练）。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.created_at, a.question_id, a.module, a.submodule, a.correct, a.secs, a.picked, q.id qid
           FROM answer_log a LEFT JOIN questions q
             ON q.id = a.question_id AND (q.disabled IS NULL OR q.disabled=0)
           WHERE a.uid=? AND a.created_at BETWEEN ? AND ?
           ORDER BY a.created_at LIMIT 100""",
        (uid, start - 0.001, end + 0.001),
    ).fetchall()
    out = []
    for r in rows:
        item = {
            "created_at": r["created_at"],
            "module": r["module"],
            "submodule": r["submodule"],
            "correct": bool(r["correct"]),
            "secs": r["secs"],
            "picked": r["picked"],
            "question": None,
        }
        if r["qid"]:
            qrow = conn.execute("SELECT * FROM questions WHERE id=?", (r["qid"],)).fetchone()
            if qrow:
                d = dict(qrow)
                d["options"] = json.loads(d.get("options") or "{}")
                item["question"] = d
        out.append(item)
    conn.close()
    return out


def refresh_question_stats() -> int:
    """聚合 answer_log 为每题刷新全站作答人次/正确率/易错项。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    qcols = {r["name"] for r in conn.execute("PRAGMA table_info(questions)")}
    for col, ddl in [
        ("attempt_count", "ALTER TABLE questions ADD COLUMN attempt_count INTEGER"),
        ("correct_ratio", "ALTER TABLE questions ADD COLUMN correct_ratio INTEGER"),
        ("most_wrong", "ALTER TABLE questions ADD COLUMN most_wrong TEXT"),
    ]:
        if col not in qcols:
            conn.execute(ddl)
    rows = conn.execute(
        """SELECT question_id qid, COUNT(*) n, SUM(correct) c
           FROM answer_log WHERE question_id IS NOT NULL GROUP BY question_id"""
    ).fetchall()
    wrong = {
        r["qid"]: r["p"]
        for r in conn.execute(
            """SELECT qid, p FROM (
                 SELECT question_id qid, picked p,
                        ROW_NUMBER() OVER (
                          PARTITION BY question_id
                          ORDER BY COUNT(*) DESC, picked ASC
                        ) rk
                 FROM answer_log
                 WHERE question_id IS NOT NULL AND correct=0 AND picked IS NOT NULL
                 GROUP BY question_id, picked
               ) WHERE rk=1"""
        )
    }
    n = 0
    for r in rows:
        conn.execute(
            "UPDATE questions SET attempt_count=?, correct_ratio=?, most_wrong=? WHERE id=?",
            (r["n"], round(100 * (r["c"] or 0) / r["n"]), wrong.get(r["qid"]), r["qid"]),
        )
        n += 1
    conn.commit()
    conn.close()
    return n


_PAPER_TITLE_RE = re.compile(r"(\d{4}年[^（(）).]{2,40}《行测》(?:真题|试卷|试题)?(?:（[^）]{1,8}）)?)")


def list_papers() -> list[dict]:
    """从真题 source 派生真题套卷列表（≥40 题视为整卷）。"""
    conn = get_conn()
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
        m = _PAPER_TITLE_RE.search(r["source"] or "")
        if not m:
            continue
        title = m.group(1)
        if title in seen:
            continue
        seen.add(title)
        papers.append({"title": title, "source": r["source"], "n": r["n"], "year": r["y"], "region": r["rg"]})
    return papers[:120]


def paper_questions(source: str, limit: int = 140) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT * FROM questions
           WHERE source=? AND is_real=1 AND disabled=0
           ORDER BY id LIMIT ?""",
        (source, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return out


def submodule_progress(uid: str, module: str | None = None) -> dict:
    conn = get_conn()
    _ensure_answer_log(conn)
    where = "uid=? AND submodule IS NOT NULL AND submodule!=''"
    args: list = [uid]
    if module:
        where += " AND module=?"
        args.append(module)
    rows = conn.execute(
        f"SELECT submodule, COUNT(*) n, SUM(correct) c FROM answer_log WHERE {where} GROUP BY submodule",
        args,
    ).fetchall()
    conn.close()
    return {r["submodule"]: {"n": r["n"], "c": r["c"] or 0} for r in rows}


def growth_stats(uid: str) -> dict:
    """按周（近 8 周）返回整体和各模块正确率成长曲线。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    since = time.time() - 8 * 7 * 86400
    rows = conn.execute(
        """SELECT strftime('%Y-%W', created_at, 'unixepoch') wk, module,
                  COUNT(*) n, SUM(correct) c
           FROM answer_log WHERE uid=? AND created_at>?
           GROUP BY wk, module ORDER BY wk""",
        (uid, since),
    ).fetchall()
    total = conn.execute(
        "SELECT COUNT(*) n, COALESCE(SUM(correct),0) c FROM answer_log WHERE uid=?", (uid,)
    ).fetchone()
    # 全量分模块：雷达等能力画像的服务端口径（按 uid，不依赖设备本地缓存）
    mod_rows = conn.execute(
        """SELECT module, COUNT(*) n, COALESCE(SUM(correct),0) c FROM answer_log
           WHERE uid=? AND module IN ('changshi','yanyu','shuliang','panduan','ziliao')
           GROUP BY module""",
        (uid,),
    ).fetchall()
    conn.close()
    weeks: dict = {}
    for r in rows:
        w = weeks.setdefault(r["wk"], {"week": r["wk"], "n": 0, "c": 0, "modules": {}})
        w["n"] += r["n"]
        w["c"] += r["c"]
        if r["module"]:
            w["modules"][r["module"]] = {"n": r["n"], "c": r["c"]}
    return {
        "total": {"n": total["n"], "c": total["c"]},
        "modules": {r["module"]: {"n": r["n"], "c": r["c"]} for r in mod_rows},
        "weeks": list(weeks.values()),
    }


def _ensure_user_state(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS user_state (
            uid TEXT NOT NULL, day TEXT NOT NULL, focus_module TEXT, note TEXT,
            created_at REAL, PRIMARY KEY (uid, day))"""
    )


def _today_str() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))


def set_user_state(uid: str, focus_module: str, note: str = "") -> None:
    conn = get_conn()
    _ensure_user_state(conn)
    conn.execute(
        "INSERT OR REPLACE INTO user_state (uid, day, focus_module, note, created_at) VALUES (?,?,?,?,?)",
        (uid, _today_str(), focus_module or None, (note or "")[:200] or None, time.time()),
    )
    conn.commit()
    conn.close()


def get_user_state(uid: str) -> dict | None:
    conn = get_conn()
    _ensure_user_state(conn)
    row = conn.execute(
        "SELECT focus_module, note FROM user_state WHERE uid=? AND day=?",
        (uid, _today_str()),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def daily_plan(uid: str) -> dict:
    """昨日学习摘要 + 今日推荐（规则版：待复习错题 + 弱项题型）。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    now = time.time()
    tz = 8 * 3600
    day0 = ((now + tz) // 86400) * 86400 - tz  # 今日 0 点（东八区）
    yest = conn.execute(
        """SELECT COUNT(*) n, COALESCE(SUM(correct),0) c, COALESCE(SUM(secs),0) s
           FROM answer_log WHERE uid=? AND created_at>=? AND created_at<?""",
        (uid, day0 - 86400, day0),
    ).fetchone()
    ymods = conn.execute(
        """SELECT module, COUNT(*) n, SUM(correct) c FROM answer_log
           WHERE uid=? AND created_at>=? AND created_at<? AND module IS NOT NULL
           GROUP BY module ORDER BY n DESC LIMIT 5""",
        (uid, day0 - 86400, day0),
    ).fetchall()
    uc, ua = _uid_clause(uid)
    due = conn.execute(
        f"""SELECT COUNT(*) n FROM mistakes
            WHERE (mastered IS NULL OR mastered=0)
              AND (next_review IS NULL OR next_review<=?){uc}""",
        (now, *ua),
    ).fetchone()
    conn.close()
    state = get_user_state(uid)
    focus = (state or {}).get("focus_module") or ""
    weak = recommend_stats(uid, top=6)["items"]
    if focus:
        weak.sort(key=lambda w: 0 if w.get("module") == focus else 1)
    return {
        "yesterday": {
            "n": yest["n"], "correct": yest["c"], "secs": yest["s"],
            "modules": [{"module": r["module"], "n": r["n"], "c": r["c"]} for r in ymods],
        },
        "due_mistakes": due["n"],
        "weak": weak[:2],
        "focus": focus,
    }


def question_attempts(uid: str, question_id: int, limit: int = 20) -> list[dict]:
    conn = get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT created_at, correct, secs, picked FROM answer_log
           WHERE uid=? AND question_id=? ORDER BY created_at DESC LIMIT ?""",
        (uid, question_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mistake_analysis_stats(uid: str) -> dict:
    """汇总错题分布与近期作答数据，供 AI 错题分析使用。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    uc, ua = _uid_clause(uid)
    types = conn.execute(
        f"""SELECT COALESCE(question_type, module, '其他') t, COUNT(*) n,
                   SUM(CASE WHEN times>=2 THEN 1 ELSE 0 END) rep
            FROM mistakes WHERE mastered=0{uc} GROUP BY t ORDER BY n DESC LIMIT 12""",
        ua,
    ).fetchall()
    reasons = conn.execute(
        f"""SELECT error_reason r, COUNT(*) n FROM mistakes
            WHERE mastered=0 AND error_reason IS NOT NULL AND error_reason!=''{uc}
            GROUP BY r ORDER BY n DESC LIMIT 8""",
        ua,
    ).fetchall()
    week = conn.execute(
        """SELECT COUNT(*) n, COALESCE(SUM(correct),0) c, COALESCE(AVG(secs),0) s
           FROM answer_log WHERE uid=? AND created_at>?""",
        (uid, time.time() - 7 * 86400),
    ).fetchone()
    slow = conn.execute(
        """SELECT COALESCE(submodule, module) t, COUNT(*) n, AVG(secs) s, SUM(correct) c
           FROM answer_log WHERE uid=? AND secs>0 GROUP BY t
           HAVING n>=5 ORDER BY s DESC LIMIT 5""",
        (uid,),
    ).fetchall()
    conn.close()
    return {
        "mistake_types": [dict(r) for r in types],
        "error_reasons": [dict(r) for r in reasons],
        "last7days": {"n": week["n"], "correct": week["c"], "avg_secs": round(week["s"], 1)},
        "slowest_types": [{"t": r["t"], "n": r["n"], "avg_secs": round(r["s"], 1), "correct": r["c"]} for r in slow],
    }


FREQ_WEIGHT = {
    "ziliao": 1.0, "panduan": 0.9, "yanyu": 0.9, "shuliang": 0.7, "changshi": 0.6,
}


TAG3_MIN_N = 5


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
    freq = FREQ_WEIGHT.get(mod, 0.5)
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
    conn = get_conn()
    _ensure_answer_log(conn)
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
        if tag3 and len(recs) >= TAG3_MIN_N:
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


def _ensure_mistake_uid(conn):
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(mistakes)")}
    if "uid" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN uid TEXT")
    if "question_id" not in cols:
        conn.execute("ALTER TABLE mistakes ADD COLUMN question_id INTEGER")


def _parse_options(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        d = json.loads(raw)
        return d if isinstance(d, dict) and d else None
    except (ValueError, TypeError):
        return None


def _uid_clause(uid: str | None) -> tuple[str, tuple]:
    """按 uid 严格隔离；无 uid 的调用只见无归属记录。"""
    if not uid:
        return " AND uid IS NULL", ()
    return " AND uid=?", (uid,)


def _ensure_reminder_prefs(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS reminder_prefs (
            uid TEXT NOT NULL,
            channel TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            hour INTEGER,
            updated_at REAL NOT NULL,
            PRIMARY KEY (uid, channel)
        )"""
    )


def set_reminder_pref(uid: str, channel: str, enabled: bool, hour: int | None = None):
    conn = get_conn()
    _ensure_reminder_prefs(conn)
    conn.execute(
        "INSERT OR REPLACE INTO reminder_prefs (uid, channel, enabled, hour, updated_at) VALUES (?,?,?,?,?)",
        (uid, channel, 1 if enabled else 0, hour, time.time()),
    )
    conn.commit()
    conn.close()


def get_reminder_prefs(uid: str) -> list[dict]:
    conn = get_conn()
    _ensure_reminder_prefs(conn)
    rows = conn.execute(
        "SELECT channel, enabled, hour, updated_at FROM reminder_prefs WHERE uid=?", (uid,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_paper_export(code: str, question_ids: list[int], title: str) -> None:
    conn = get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS paper_exports (
            code TEXT PRIMARY KEY,
            created_at REAL NOT NULL,
            title TEXT,
            question_ids TEXT NOT NULL
        )"""
    )
    conn.execute(
        "INSERT OR REPLACE INTO paper_exports (code, created_at, title, question_ids) VALUES (?,?,?,?)",
        (code, time.time(), title, json.dumps(question_ids)),
    )
    conn.commit()
    conn.close()


def get_paper_export(code: str) -> dict | None:
    conn = get_conn()
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
    return d


_QTYPE_MOD_PREFIXES = ("资料分析", "数量关系", "言语理解", "判断推理", "常识判断", "常识", "时政")


def norm_qtype(question_type) -> str | None:
    """题型统一为细分题型名：去掉「模块名-」前缀（模块归属已由 module 字段承担）。"""
    t = str(question_type or "").strip()
    if not t:
        return None
    head, sep, rest = t.partition("-")
    if sep and head in _QTYPE_MOD_PREFIXES and rest.strip():
        return rest.strip()
    return t


def save_mistake(rec: dict) -> int:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    qtext = rec.get("question_text")
    qid = rec.get("question_id")
    dup = None
    uc, ua = _uid_clause(rec.get("uid") or None)
    if qid:
        dup = conn.execute(
            f"SELECT id FROM mistakes WHERE question_id=?{uc} LIMIT 1", (qid, *ua)
        ).fetchone()
    if not dup and qtext:
        dup = conn.execute(
            f"SELECT id FROM mistakes WHERE question_text=?{uc} LIMIT 1", (qtext, *ua)
        ).fetchone()
    if dup:
        conn.execute(
            "UPDATE mistakes SET times=COALESCE(times,1)+1, mastered=0, mastered_at=NULL, review_streak=0, "
            "next_review=?, user_answer=COALESCE(?, user_answer), "
            "question_id=COALESCE(question_id, ?), source=COALESCE(source, ?) WHERE id=?",
            (time.time(), rec.get("user_answer"), qid, rec.get("source"), dup["id"]),
        )
        conn.commit()
        conn.close()
        return dup["id"]
    cur = conn.execute(
        """INSERT INTO mistakes
           (created_at, module, question_type, question_text, user_answer,
            correct_answer, methods, error_reason, explanation, uid, question_id, source)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            time.time(),
            rec.get("module"),
            norm_qtype(rec.get("question_type")),
            rec.get("question_text"),
            rec.get("user_answer"),
            rec.get("correct_answer"),
            json.dumps(rec.get("methods", []), ensure_ascii=False),
            rec.get("error_reason"),
            rec.get("explanation"),
            (rec.get("uid") or None),
            rec.get("question_id"),
            rec.get("source"),
        ),
    )
    conn.commit()
    rowid = cur.lastrowid
    conn.close()
    return rowid


def list_mistakes(limit: int = 500, uid: str | None = None) -> list[dict]:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl = " AND m.uid=?" if uid else " AND m.uid IS NULL"
    args = (uid,) if uid else ()
    rows = conn.execute(
        f"""SELECT m.*, q.tag3, q.options AS q_options FROM mistakes m
            LEFT JOIN questions q ON q.id=m.question_id
            WHERE 1=1{cl} ORDER BY m.created_at DESC LIMIT ?""",
        (*args, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["methods"] = json.loads(d.get("methods") or "[]")
        d["options"] = _parse_options(d.pop("q_options", None))
        out.append(d)
    return out


def update_mistake(mid: int, fields: dict, uid: str | None = None) -> bool:
    allowed = {"error_reason", "mastered"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return False
    conn = get_conn()
    _ensure_mistake_uid(conn)
    clause = ", ".join(f"{k}=?" for k in sets)
    vals = list(sets.values())
    if "mastered" in sets:
        if sets["mastered"]:
            clause += ", mastered_at=COALESCE(mastered_at, ?)"
            vals.append(time.time())
        else:
            clause += ", mastered_at=NULL"
    cl, args = _uid_clause(uid)
    cur = conn.execute(
        f"UPDATE mistakes SET {clause} WHERE id=?{cl}", (*vals, mid, *args)
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def delete_mistake(mid: int, uid: str | None = None) -> bool:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    cur = conn.execute(f"DELETE FROM mistakes WHERE id=?{cl}", (mid, *args))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30]


def due_review_count(uid: str | None = None, created_before: float | None = None) -> int:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    extra = ""
    if created_before is not None:
        extra = " AND created_at < ?"
        args = (*args, created_before)
    n = conn.execute(
        "SELECT COUNT(*) n FROM mistakes WHERE (mastered IS NULL OR mastered=0) "
        f"AND (next_review IS NULL OR next_review <= ?){cl}{extra}",
        (time.time(), *args),
    ).fetchone()["n"]
    conn.close()
    return n


def due_reviews(limit: int = 20, uid: str | None = None) -> list[dict]:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    rows = conn.execute(
        "SELECT m.*, q.options AS q_options FROM mistakes m "
        "LEFT JOIN questions q ON q.id=m.question_id "
        "WHERE (m.mastered IS NULL OR m.mastered=0) "
        f"AND (m.next_review IS NULL OR m.next_review <= ?){cl} "
        "ORDER BY m.next_review IS NOT NULL, m.next_review, m.created_at LIMIT ?",
        (time.time(), *args, limit),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["methods"] = json.loads(d.get("methods") or "[]")
        d["options"] = _parse_options(d.pop("q_options", None))
        out.append(d)
    return out


def _ensure_review_log(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS review_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT, mistake_id INTEGER, correct INTEGER, created_at REAL)"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rl_uid ON review_log(uid, created_at)")


def record_review(mid: int, correct: bool, uid: str | None = None) -> dict:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
    if not conn.execute(f"SELECT 1 FROM mistakes WHERE id=?{cl}", (mid, *args)).fetchone():
        conn.close()
        raise KeyError(mid)
    if uid:
        _ensure_review_log(conn)
        conn.execute(
            "INSERT INTO review_log (uid, mistake_id, correct, created_at) VALUES (?,?,?,?)",
            (uid, mid, 1 if correct else 0, time.time()),
        )
    row = conn.execute(
        f"SELECT review_streak FROM mistakes WHERE id=?{cl}", (mid, *args)
    ).fetchone()
    if not row:
        conn.close()
        raise KeyError(mid)
    streak = (row["review_streak"] or 0) + 1 if correct else 0
    days = REVIEW_INTERVALS_DAYS[min(streak - 1, len(REVIEW_INTERVALS_DAYS) - 1)] if correct else 1
    nxt = time.time() + days * 86400
    mastered = 1 if streak > len(REVIEW_INTERVALS_DAYS) else 0
    conn.execute(
        "UPDATE mistakes SET review_count=review_count+1, review_streak=?, next_review=?, "
        "mastered=?, mastered_at=CASE WHEN ? THEN COALESCE(mastered_at, ?) ELSE NULL END "
        f"WHERE id=?{cl}",
        (streak, nxt, mastered, mastered, time.time(), mid, *args),
    )
    conn.commit()
    conn.close()
    return {"streak": streak, "next_review_days": days, "mastered": bool(mastered)}


def stats(uid: str | None = None) -> dict:
    conn = get_conn()
    _ensure_mistake_uid(conn)
    uc, ua = _uid_clause(uid)
    by_module = conn.execute(
        f"SELECT module, COUNT(*) n FROM mistakes WHERE 1=1{uc} GROUP BY module ORDER BY n DESC",
        ua,
    ).fetchall()
    by_type = conn.execute(
        f"SELECT question_type, COUNT(*) n FROM mistakes WHERE 1=1{uc} GROUP BY question_type ORDER BY n DESC LIMIT 10",
        ua,
    ).fetchall()
    by_reason = conn.execute(
        "SELECT error_reason, COUNT(*) n FROM mistakes WHERE error_reason IS NOT NULL AND error_reason != ''"
        f"{uc} GROUP BY error_reason ORDER BY n DESC",
        ua,
    ).fetchall()
    conn.close()
    return {
        "by_module": [dict(r) for r in by_module],
        "by_type": [dict(r) for r in by_type],
        "by_reason": [dict(r) for r in by_reason],
    }


def save_backup(code: str | None, data: dict) -> str:
    conn = get_conn()
    if not code:
        code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    else:
        code = str(code).strip().upper()[:16]
    conn.execute(
        "INSERT INTO backups (code, data, updated_at) VALUES (?,?,?) "
        "ON CONFLICT(code) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (code, json.dumps(data, ensure_ascii=False)[:500000], time.time()),
    )
    conn.commit()
    conn.close()
    return code


def get_backup(code: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT data FROM backups WHERE code=?", (code,)).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["data"])

# ---------- 成套试卷 / 全真模考 ----------

MODULE_ORDER = ["changshi", "yanyu", "shuliang", "panduan", "ziliao"]


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


def upsert_exam_paper(title: str, kind: str, year: int | None, region: str | None,
                      question_ids: list[int], duration_min: int) -> int:
    """按 title 幂等落卷（重跑成卷脚本不产生重复卷）。"""
    conn = get_conn()
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
    _papers_cache.clear()
    return pid


_PAPERS_CACHE_TTL = 300
_papers_cache: dict[tuple, tuple[float, list[dict]]] = {}
_papers_refreshing: set[tuple] = set()
_papers_lock = threading.Lock()


def _refresh_papers_cache(key: tuple) -> None:
    conn = get_conn()
    try:
        _list_exam_papers_base(conn, *key, force=True)
    finally:
        conn.close()
        with _papers_lock:
            _papers_refreshing.discard(key)


def _list_exam_papers_base(conn, kind: str | None, year: int | None,
                           region: str | None, force: bool = False) -> list[dict]:
    """uid 无关的卷列表（含活跃题数 n / takers），按筛选键 TTL 缓存；
    过期后返回旧值并起后台线程刷新（stale-while-revalidate）。"""
    key = (kind, year, region)
    hit = _papers_cache.get(key)
    if hit and not force:
        if time.time() - hit[0] >= _PAPERS_CACHE_TTL:
            with _papers_lock:
                if key not in _papers_refreshing:
                    _papers_refreshing.add(key)
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
            ORDER BY year DESC, id DESC LIMIT 200""",
        args,
    ).fetchall()
    takers: dict[int, int] = {}
    if rows:
        for t in conn.execute(
            """SELECT paper_id, COUNT(DISTINCT uid) n FROM exam_attempts
               WHERE submitted_at IS NOT NULL GROUP BY paper_id"""
        ):
            takers[t["paper_id"]] = t["n"]
    qids_by_paper = {r["id"]: json.loads(r["question_ids"] or "[]") for r in rows}
    all_ids = list({i for ids in qids_by_paper.values() for i in ids})
    active: set[int] = set()
    for chunk_start in range(0, len(all_ids), 900):
        chunk = all_ids[chunk_start:chunk_start + 900]
        active.update(r["id"] for r in conn.execute(
            f"SELECT id FROM questions WHERE disabled=0 AND id IN ({','.join('?' * len(chunk))})",
            chunk,
        ))
    base = []
    for r in rows:
        d = dict(r)
        d.pop("question_ids")
        d["n"] = sum(1 for i in qids_by_paper[d["id"]] if i in active)
        d["takers"] = takers.get(d["id"], 0)
        base.append(d)
    _papers_cache[key] = (time.time(), base)
    return base


def list_exam_papers(kind: str | None = None, year: int | None = None,
                     region: str | None = None, uid: str | None = None) -> list[dict]:
    conn = get_conn()
    _ensure_exam_tables(conn)
    base = _list_exam_papers_base(conn, kind, year, region)
    best: dict[int, dict] = {}
    if uid and base:
        for b in conn.execute(
            """SELECT paper_id, MAX(score) s, COUNT(*) n FROM exam_attempts
               WHERE uid=? AND submitted_at IS NOT NULL GROUP BY paper_id""",
            (uid,),
        ):
            best[b["paper_id"]] = {"best_score": b["s"], "attempt_count": b["n"]}
    conn.close()
    out = []
    for d in base:
        d = dict(d)
        d.update(best.get(d["id"], {"best_score": None, "attempt_count": 0}))
        out.append(d)
    return out


def exam_active_qids(question_ids: list[int]) -> list[int]:
    active = {q["id"] for q in questions_by_ids(question_ids) if not q.get("disabled")}
    return [i for i in question_ids if i in active]


def exam_paper_filters() -> dict:
    conn = get_conn()
    _ensure_exam_tables(conn)
    years = [dict(r) for r in conn.execute(
        "SELECT year y, COUNT(*) n FROM exam_papers WHERE kind='zhenti' AND year IS NOT NULL "
        "GROUP BY year ORDER BY year DESC")]
    regions = [dict(r) for r in conn.execute(
        "SELECT region r, COUNT(*) n FROM exam_papers WHERE kind='zhenti' AND region IS NOT NULL AND region!='' "
        "GROUP BY region ORDER BY n DESC")]
    conn.close()
    return {"years": years, "regions": regions}


def get_exam_paper(pid: int) -> dict | None:
    conn = get_conn()
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
    conn = get_conn()
    _ensure_exam_tables(conn)
    share = {"changshi": 0.15, "yanyu": 0.3, "shuliang": 0.1, "panduan": 0.3, "ziliao": 0.15}
    ids: list[int] = []
    for mod in MODULE_ORDER:
        want = max(1, round(n * share[mod]))
        ids += [r["id"] for r in conn.execute(
            "SELECT id FROM questions WHERE module=? AND disabled=0 "
            "ORDER BY has_hs DESC, RANDOM() LIMIT ?", (mod, want))]
    if len(ids) < n:
        placeholders = ",".join("?" * len(ids)) or "0"
        ids += [r["id"] for r in conn.execute(
            f"SELECT id FROM questions WHERE disabled=0 AND id NOT IN ({placeholders}) "
            "ORDER BY RANDOM() LIMIT ?", (*ids, n - len(ids)))]
    ids = ids[:n]
    title = "迷你模考 " + time.strftime("%m-%d %H:%M:%S") + " #" + secrets.token_hex(3)
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (title, "mock", None, None, json.dumps(ids), duration_min, time.time()),
    )
    conn.commit()
    pid = conn.execute("SELECT id FROM exam_papers WHERE title=?", (title,)).fetchone()["id"]
    conn.close()
    _papers_cache.clear()
    return pid


def start_exam_attempt(uid: str, paper_id: int) -> int:
    conn = get_conn()
    _ensure_exam_tables(conn)
    conn.execute(
        "DELETE FROM exam_attempts WHERE uid=? AND submitted_at IS NULL AND started_at<?",
        (uid, time.time() - 86400),
    )
    cur = conn.execute(
        "INSERT INTO exam_attempts (uid, paper_id, started_at) VALUES (?,?,?)",
        (uid, paper_id, time.time()),
    )
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return aid


def finish_exam_attempt(attempt_id: int, answers: dict, score: float, per_module: dict) -> bool:
    conn = get_conn()
    _ensure_exam_tables(conn)
    cur = conn.execute(
        "UPDATE exam_attempts SET submitted_at=?, answers=?, score=?, per_module=? "
        "WHERE id=? AND submitted_at IS NULL",
        (time.time(), json.dumps(answers, ensure_ascii=False), score,
         json.dumps(per_module, ensure_ascii=False), attempt_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def get_exam_attempt(attempt_id: int) -> dict | None:
    conn = get_conn()
    _ensure_exam_tables(conn)
    row = conn.execute("SELECT * FROM exam_attempts WHERE id=?", (attempt_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["answers"] = json.loads(d["answers"] or "{}")
    d["per_module"] = json.loads(d["per_module"] or "{}")
    return d


def list_exam_attempts(uid: str, paper_id: int | None = None, limit: int = 50) -> list[dict]:
    conn = get_conn()
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
        (*args, min(limit, 100)),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["per_module"] = json.loads(d["per_module"] or "{}")
        out.append(d)
    return out


# ---------- 报考画像 & 学习计划数据 ----------

PROFILE_FIELDS = ("exam_type", "target_region", "exam_date", "target_score", "daily_minutes", "base_level")


def _ensure_user_profile(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS user_profile (
            uid TEXT PRIMARY KEY,
            exam_type TEXT,
            target_region TEXT,
            exam_date TEXT,
            target_score INTEGER,
            daily_minutes INTEGER,
            base_level TEXT,
            created_at REAL,
            updated_at REAL)"""
    )


def get_user_profile(uid: str) -> dict | None:
    conn = get_conn()
    _ensure_user_profile(conn)
    row = conn.execute("SELECT * FROM user_profile WHERE uid=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def save_user_profile(uid: str, fields: dict) -> dict:
    conn = get_conn()
    _ensure_user_profile(conn)
    now = time.time()
    existing = conn.execute("SELECT uid FROM user_profile WHERE uid=?", (uid,)).fetchone()
    vals = {k: fields.get(k) for k in PROFILE_FIELDS if k in fields}
    if existing:
        if vals:
            clause = ", ".join(f"{k}=?" for k in vals)
            conn.execute(
                f"UPDATE user_profile SET {clause}, updated_at=? WHERE uid=?",
                (*vals.values(), now, uid),
            )
    else:
        conn.execute(
            """INSERT INTO user_profile
               (uid, exam_type, target_region, exam_date, target_score, daily_minutes, base_level, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                uid,
                vals.get("exam_type"),
                vals.get("target_region"),
                vals.get("exam_date"),
                vals.get("target_score"),
                vals.get("daily_minutes"),
                vals.get("base_level"),
                now,
                now,
            ),
        )
    conn.commit()
    conn.close()
    return get_user_profile(uid) or {}


def _day_start(offset_days: int = 0) -> float:
    """东八区当日 0 点时间戳。"""
    tz = 8 * 3600
    now = time.time()
    return ((now + tz) // 86400 + offset_days) * 86400 - tz


def today_answer_counts(uid: str) -> dict:
    """今日（东八区）作答统计：总数 + 按模块/二级题型分组。"""
    conn = get_conn()
    _ensure_answer_log(conn)
    day0 = _day_start()
    rows = conn.execute(
        """SELECT module, submodule, COUNT(*) n, COALESCE(SUM(correct),0) c
           FROM answer_log WHERE uid=? AND created_at>=?
           GROUP BY module, submodule""",
        (uid, day0),
    ).fetchall()
    conn.close()
    total = 0
    correct = 0
    by_module: dict = {}
    by_sub: dict = {}
    for r in rows:
        total += r["n"]
        correct += r["c"]
        if r["module"]:
            m = by_module.setdefault(r["module"], {"n": 0, "c": 0})
            m["n"] += r["n"]
            m["c"] += r["c"]
        if r["submodule"]:
            s = by_sub.setdefault(r["submodule"], {"n": 0, "c": 0})
            s["n"] += r["n"]
            s["c"] += r["c"]
    return {"total": total, "correct": correct, "by_module": by_module, "by_sub": by_sub}


def reviews_today(uid: str) -> int:
    conn = get_conn()
    _ensure_review_log(conn)
    n = conn.execute(
        "SELECT COUNT(*) n FROM review_log WHERE uid=? AND created_at>=?",
        (uid, _day_start()),
    ).fetchone()["n"]
    conn.close()
    return n


def mock_done_this_week(uid: str) -> bool:
    """本周（东八区，周一起算）是否已交卷过一次模考/真题卷。"""
    tz = 8 * 3600
    now = time.time()
    weekday = int(((now + tz) // 86400 + 4) % 7)  # 1970-01-01 是周四
    week_start = _day_start() - ((weekday - 1) % 7) * 86400
    conn = get_conn()
    _ensure_exam_tables(conn)
    row = conn.execute(
        "SELECT 1 FROM exam_attempts WHERE uid=? AND submitted_at>=? LIMIT 1",
        (uid, week_start),
    ).fetchone()
    conn.close()
    return bool(row)


# ===== 管理后台 v3：看板统计 / 批次抽检 / 内容治理 / 用户运营 =====

_ADMIN_CACHE: dict = {}
_admin_cache_lock = threading.Lock()
_admin_refreshing: set = set()
_admin_build_lock = threading.Lock()


def _cached_refresh(key: str, fn):
    try:
        data = fn()
        with _admin_cache_lock:
            _ADMIN_CACHE[key] = (time.time(), data)
    except Exception:
        pass
    finally:
        with _admin_cache_lock:
            _admin_refreshing.discard(key)


def _cached(key: str, ttl: float, fn):
    return _cached_state(key, ttl, fn)[0]


def _cached_state(key: str, ttl: float, fn):
    """2G 小服务器上重查询的进程内缓存：过期先回旧值并后台单飞重算
    （stale-while-revalidate，对齐 _pick_pools），请求不承担秒级重查询。
    返回 (数据, 命中态)：hit=TTL 内命中，stale=过期回旧值，cold=进程启动后首次同步构建。"""
    with _admin_cache_lock:
        hit = _ADMIN_CACHE.get(key)
        if hit:
            if time.time() - hit[0] < ttl:
                return hit[1], "hit"
            if key not in _admin_refreshing:
                _admin_refreshing.add(key)
                threading.Thread(target=_cached_refresh, args=(key, fn), daemon=True).start()
            return hit[1], "stale"
    # 冷 miss（进程启动后首次）：单线程构建，同键并发等锁后直接吃缓存
    with _admin_build_lock:
        with _admin_cache_lock:
            hit = _ADMIN_CACHE.get(key)
            if hit:
                return hit[1], "cold"
        data = fn()
        with _admin_cache_lock:
            _ADMIN_CACHE[key] = (time.time(), data)
        return data, "cold"


def admin_dashboard() -> dict:
    return _cached("dashboard", 300, _admin_dashboard_uncached)


def admin_dashboard_state() -> tuple[dict, str]:
    return _cached_state("dashboard", 300, _admin_dashboard_uncached)


def _admin_dashboard_uncached() -> dict:
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_reports(conn)
    q = conn.execute
    day0 = _day_start()
    day_1 = _day_start(-1)
    day_14 = _day_start(-13)

    def day_kpis(start: float, end: float | None) -> dict:
        cond = "created_at>=?" + (" AND created_at<?" if end else "")
        args = (start, end) if end else (start,)
        row = q(
            f"SELECT COUNT(DISTINCT uid) au, COUNT(*) n, COALESCE(SUM(correct),0) c FROM answer_log WHERE {cond}",
            args,
        ).fetchone()
        return {"active": row["au"], "answered": row["n"], "correct": row["c"]}

    today = day_kpis(day0, None)
    yesterday = day_kpis(day_1, day0)
    firsts = q(
        "SELECT MIN(created_at) t FROM answer_log GROUP BY uid HAVING t>=?", (day_1,)
    ).fetchall()
    new_today = sum(1 for r in firsts if r["t"] >= day0)
    new_yesterday = len(firsts) - new_today

    trend = [
        dict(r)
        for r in q(
            """SELECT date(created_at, 'unixepoch', '+8 hours') d,
                      COUNT(*) answered, COUNT(DISTINCT uid) active,
                      ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*), 1) acc
               FROM answer_log WHERE created_at>=? GROUP BY d ORDER BY d""",
            (day_14,),
        )
    ]
    ai_trend = {
        r["d"]: r["n"]
        for r in q(
            """SELECT date(created_at, 'unixepoch', '+8 hours') d, COUNT(*) n
               FROM explain_cache WHERE created_at>=? GROUP BY d""",
            (day_14,),
        )
    }
    for row in trend:
        row["ai_calls"] = ai_trend.get(row["d"], 0)
    ai_today = q("SELECT COUNT(*) FROM explain_cache WHERE created_at>=?", (day0,)).fetchone()[0]
    ai_yesterday = q(
        "SELECT COUNT(*) FROM explain_cache WHERE created_at>=? AND created_at<?", (day_1, day0)
    ).fetchone()[0]

    total = q("SELECT COUNT(*) FROM questions").fetchone()[0]
    disabled = q("SELECT COUNT(*) FROM questions WHERE disabled=1").fetchone()[0]
    pending = q("SELECT COUNT(*) FROM questions WHERE disabled=2").fetchone()[0]
    flagged = q("SELECT COUNT(*) FROM questions WHERE hs_down>0 AND (disabled IS NULL OR disabled=0)").fetchone()[0]
    open_reports = q("SELECT COUNT(*) FROM question_reports WHERE status='open'").fetchone()[0]
    # 健康度口径：基于当前可运营题库（历史下架存量是治理成果，不计入分母惩罚）
    active = max(total - disabled - pending, 0)
    health = round(100.0 * max(active - flagged, 0) / active, 1) if active else 100.0

    todos = {
        "pending_batches": q(
            "SELECT COUNT(DISTINCT import_batch) FROM questions WHERE disabled=2 AND import_batch IS NOT NULL"
        ).fetchone()[0],
        "tag3_review": q("SELECT COUNT(*) FROM tag3_review WHERE status='open'").fetchone()[0],
        "open_reports": open_reports,
    }
    by_module = [
        dict(r)
        for r in q(
            "SELECT module, COUNT(*) n FROM questions WHERE (disabled IS NULL OR disabled=0) "
            "GROUP BY module ORDER BY n DESC"
        )
    ]
    acc7 = [
        dict(r)
        for r in q(
            """SELECT module, COUNT(*) n, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc
               FROM answer_log WHERE created_at>=? AND module IS NOT NULL
               GROUP BY module ORDER BY n DESC""",
            (_day_start(-6),),
        )
    ]
    conn.close()
    return {
        "today": {**today, "new_users": new_today, "ai_calls": ai_today},
        "yesterday": {**yesterday, "new_users": new_yesterday, "ai_calls": ai_yesterday},
        "health": {"pct": health, "total": total, "active": active, "disabled": disabled,
                   "pending": pending, "flagged": flagged, "open_reports": open_reports},
        "trend": trend,
        "todos": todos,
        "by_module": by_module,
        "acc7": acc7,
        "generated_at": time.time(),
    }


def _ensure_sample_reviews(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sample_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            batch TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            verdict TEXT NOT NULL,
            note TEXT,
            UNIQUE(batch, question_id)
        )"""
    )


def sample_review_set(batch: str, question_id: int, verdict: str, note: str | None) -> dict:
    conn = get_conn()
    _ensure_sample_reviews(conn)
    conn.execute(
        "INSERT INTO sample_reviews (created_at, batch, question_id, verdict, note) VALUES (?,?,?,?,?) "
        "ON CONFLICT(batch, question_id) DO UPDATE SET verdict=excluded.verdict, note=excluded.note, created_at=excluded.created_at",
        (time.time(), batch, question_id, verdict, note),
    )
    conn.commit()
    conn.close()
    return sample_review_summary(batch)


def sample_review_delete(batch: str, question_id: int) -> None:
    conn = get_conn()
    _ensure_sample_reviews(conn)
    conn.execute("DELETE FROM sample_reviews WHERE batch=? AND question_id=?", (batch, question_id))
    conn.commit()
    conn.close()


def sample_reviews(batch: str) -> list[dict]:
    conn = get_conn()
    _ensure_sample_reviews(conn)
    rows = conn.execute(
        "SELECT question_id, verdict, note, created_at FROM sample_reviews WHERE batch=? ORDER BY created_at",
        (batch,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def sample_review_summary(batch: str) -> dict:
    conn = get_conn()
    _ensure_sample_reviews(conn)
    rows = conn.execute(
        "SELECT verdict, COUNT(*) n FROM sample_reviews WHERE batch=? GROUP BY verdict", (batch,)
    ).fetchall()
    conn.close()
    out = {"ok": 0, "problem": 0}
    for r in rows:
        out[r["verdict"]] = r["n"]
    return out


def batch_answer_dist(batch: str) -> dict:
    conn = get_conn()
    rows = conn.execute(
        "SELECT UPPER(SUBSTR(TRIM(answer),1,1)) a, COUNT(*) n FROM questions "
        "WHERE import_batch=? GROUP BY a",
        (batch,),
    ).fetchall()
    conn.close()
    return {r["a"]: r["n"] for r in rows if r["a"]}


def admin_batches_v3() -> list[dict]:
    conn = get_conn()
    _ensure_sample_reviews(conn)
    rows = conn.execute(
        """SELECT import_batch AS batch, COUNT(*) AS n,
                  SUM(CASE WHEN disabled=2 THEN 1 ELSE 0 END) AS pending,
                  SUM(is_real) AS real_n
           FROM questions WHERE import_batch IS NOT NULL
           GROUP BY import_batch ORDER BY import_batch DESC LIMIT 50"""
    ).fetchall()
    reviews = {
        r["batch"]: dict(r)
        for r in conn.execute(
            """SELECT batch, SUM(CASE WHEN verdict='ok' THEN 1 ELSE 0 END) ok,
                      SUM(CASE WHEN verdict='problem' THEN 1 ELSE 0 END) problem
               FROM sample_reviews GROUP BY batch"""
        )
    }
    out = []
    for r in rows:
        d = dict(r)
        rv = reviews.get(d["batch"], {})
        d["review_ok"] = rv.get("ok", 0)
        d["review_problem"] = rv.get("problem", 0)
        d["answer_dist"] = batch_answer_dist(d["batch"])
        out.append(d)
    conn.close()
    return out


def tag3_review_reopen(question_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute(
        "UPDATE tag3_review SET status='open' WHERE question_id=? AND status='done'", (question_id,)
    )
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def governance_scan() -> dict:
    return _cached("governance", 600, _governance_scan_uncached)


def governance_scan_state() -> tuple[dict, str]:
    return _cached_state("governance", 600, _governance_scan_uncached)


def _governance_scan_uncached() -> dict:
    conn = get_conn()
    q = conn.execute
    broken: list[dict] = []
    rows = q(
        "SELECT id, module, question, options, answer FROM questions "
        "WHERE (disabled IS NULL OR disabled!=1) LIMIT 200000"
    ).fetchall()
    dist_all: dict = {}
    for r in rows:
        problems = []
        text = (r["question"] or "").strip()
        try:
            opts = json.loads(r["options"] or "{}")
        except ValueError:
            opts = None
        ans = (r["answer"] or "").strip().upper()[:1]
        if not text:
            problems.append("空题干")
        if opts is None:
            problems.append("选项 JSON 损坏")
        elif len(opts) < 2:
            problems.append("选项不足 2 个")
        else:
            vals = [str(v).strip() for v in opts.values()]
            if len(set(vals)) < len(vals):
                problems.append("选项内容重复")
            if ans and ans not in {str(k).strip().upper() for k in opts}:
                problems.append(f"答案 {ans} 越界")
        if not ans:
            problems.append("缺答案")
        elif ans:
            dist_all[ans] = dist_all.get(ans, 0) + 1
        if problems:
            broken.append({"id": r["id"], "module": r["module"],
                           "question": text[:80], "problems": problems})
        if len(broken) >= 100:
            break
    clones = [
        dict(r)
        for r in q(
            """SELECT SUBSTR(TRIM(question),1,40) prefix, COUNT(*) n,
                      GROUP_CONCAT(id) ids, COUNT(DISTINCT UPPER(SUBSTR(TRIM(answer),1,1))) answers
               FROM questions WHERE (disabled IS NULL OR disabled!=1)
                 AND LENGTH(TRIM(question))>=40
               GROUP BY prefix HAVING n>1
               ORDER BY answers DESC, n DESC LIMIT 50"""
        )
    ]
    batch_dists = []
    for b in q(
        "SELECT DISTINCT import_batch b FROM questions WHERE import_batch IS NOT NULL "
        "ORDER BY import_batch DESC LIMIT 12"
    ).fetchall():
        batch_dists.append({"batch": b["b"], "dist": batch_answer_dist(b["b"])})
    missing_expl = q(
        "SELECT COUNT(*) FROM questions WHERE (disabled IS NULL OR disabled=0) "
        "AND (explanation IS NULL OR explanation='') AND (hs_explanation IS NULL OR hs_explanation='')"
    ).fetchone()[0]
    conn.close()
    return {
        "broken": broken,
        "clones": clones,
        "answer_dist": {"overall": dist_all, "batches": batch_dists},
        "missing_explanation": missing_expl,
        "generated_at": time.time(),
    }


def admin_users(keyword: str | None = None, offset: int = 0, limit: int = 20,
                inactive_days: int | None = None) -> dict:
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    where = "uid IS NOT NULL AND uid!=''"
    args: list = []
    if keyword:
        where += " AND uid LIKE ?"
        args.append(f"%{keyword}%")
    having = ""
    if inactive_days:
        having = "HAVING MAX(created_at) < ?"
    total = conn.execute(
        f"SELECT COUNT(*) FROM (SELECT uid FROM answer_log WHERE {where} GROUP BY uid "
        f"{having})",
        args + ([_day_start(-inactive_days + 1)] if inactive_days else []),
    ).fetchone()[0]
    rows = conn.execute(
        f"""SELECT uid, COUNT(*) answered, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc,
                  MIN(created_at) first_seen, MAX(created_at) last_seen
           FROM answer_log WHERE {where} GROUP BY uid {having}
           ORDER BY last_seen DESC LIMIT ? OFFSET ?""",
        args + ([_day_start(-inactive_days + 1)] if inactive_days else []) + [min(limit, 50), offset],
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["mistakes"] = conn.execute(
            "SELECT COUNT(*) FROM mistakes WHERE uid=?", (d["uid"],)
        ).fetchone()[0]
        out.append(d)
    conn.close()
    return {"total": total, "items": out}


def admin_user_detail(uid: str) -> dict | None:
    conn = get_conn()
    _ensure_answer_log(conn)
    _ensure_mistake_uid(conn)
    row = conn.execute(
        """SELECT COUNT(*) answered, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc,
                  MIN(created_at) first_seen, MAX(created_at) last_seen
           FROM answer_log WHERE uid=?""",
        (uid,),
    ).fetchone()
    if not row or not row["answered"]:
        return None
    by_module = [
        dict(r)
        for r in conn.execute(
            """SELECT module, COUNT(*) n, ROUND(COALESCE(SUM(correct),0)*100.0/COUNT(*),1) acc
               FROM answer_log WHERE uid=? AND module IS NOT NULL GROUP BY module ORDER BY n DESC""",
            (uid,),
        )
    ]
    recent = [
        dict(r)
        for r in conn.execute(
            """SELECT date(created_at, 'unixepoch', '+8 hours') d, COUNT(*) n,
                      COALESCE(SUM(correct),0) c
               FROM answer_log WHERE uid=? AND created_at>=? GROUP BY d ORDER BY d""",
            (uid, _day_start(-13)),
        )
    ]
    mistakes = conn.execute("SELECT COUNT(*) FROM mistakes WHERE uid=?", (uid,)).fetchone()[0]
    conn.close()
    return {"uid": uid, **dict(row), "by_module": by_module, "recent": recent, "mistakes": mistakes}


def admin_shizheng(offset: int = 0, limit: int = 20) -> dict:
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM shizheng_questions").fetchone()[0]
    rows = conn.execute(
        "SELECT id, date, question, options, answer, explanation, source_note FROM shizheng_questions "
        "ORDER BY date DESC, id DESC LIMIT ? OFFSET ?",
        (min(limit, 50), offset),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["options"] = json.loads(d.get("options") or "{}")
        out.append(d)
    return {"total": total, "items": out}


def admin_shenlun_overview() -> dict:
    conn = get_conn()
    papers = [
        dict(r)
        for r in conn.execute(
            """SELECT exam_year, exam_region, paper, COUNT(*) n,
                      SUM(CASE WHEN reference IS NOT NULL AND reference!='' THEN 1 ELSE 0 END) with_ref,
                      SUM(COALESCE(disabled,0)) disabled_n
               FROM shenlun_questions
               GROUP BY exam_year, exam_region, paper
               ORDER BY exam_year DESC, exam_region LIMIT 100"""
        )
    ]
    materials = [
        dict(r)
        for r in conn.execute(
            "SELECT topic, type, COUNT(*) n FROM shenlun_materials GROUP BY topic, type ORDER BY n DESC LIMIT 50"
        )
    ]
    totals = {
        "questions": conn.execute("SELECT COUNT(*) FROM shenlun_questions").fetchone()[0],
        "materials": conn.execute("SELECT COUNT(*) FROM shenlun_materials").fetchone()[0],
    }
    conn.close()
    return {"papers": papers, "materials": materials, "totals": totals}


# ===== 考点掌握度地图（spec-02）/ 错题同考点强化（spec-03） =====

MASTERY_PRIOR_K = 12          # 与 insights.PRIOR_K 同参
MASTERY_PRIOR_ACC = 0.55      # 与 insights.PRIOR_ACC 同参
MASTERY_HALF_LIFE_DAYS = 30   # 时间衰减半衰期
MASTERY_COLD_START_N = 30     # 与 insights.COLD_START_N 同口径

MASTERY_LEVELS = [
    ("rumen", "入门", 0.55),
    ("gonggu", "巩固", 0.7),
    ("shulian", "熟练", 0.85),
    ("jingtong", "精通", 1.01),
]


def _mastery_value(n: int, c: int, last: float, now: float) -> float:
    """掌握度 = 贝叶斯平滑正确率 × 时间衰减分量（久不练最多打 6 折）。"""
    acc_s = (c + MASTERY_PRIOR_K * MASTERY_PRIOR_ACC) / (n + MASTERY_PRIOR_K)
    decay = 0.5 ** ((now - last) / 86400 / MASTERY_HALF_LIFE_DAYS)
    return acc_s * (0.6 + 0.4 * decay)


def _mastery_level(n: int, m: float) -> tuple[str, str]:
    if n <= 0:
        return "untouched", "未接触"
    for key, name, hi in MASTERY_LEVELS:
        if m < hi:
            return key, name
    return "jingtong", "精通"


def _due_by_tag3(conn, uid: str | None) -> dict:
    """各三级考点当前到期错题数（uid 严格隔离）。"""
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
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


_MASTERY_CACHE: dict = {}
MASTERY_CACHE_TTL = 60


def mastery_snapshot(uid: str, fresh: bool = False) -> dict:
    """考点掌握度地图：模块 → 二级题型分组 → 三级考点（tag3）三级树。

    掌握度口径与 recommend_stats 共用平滑正确率 + 时间衰减分量；
    未接触（n==0）不参与上级均值。60s 进程内缓存。
    """
    now = time.time()
    hit = _MASTERY_CACHE.get(uid)
    if hit and not fresh and now - hit[0] < MASTERY_CACHE_TTL:
        return hit[1]
    conn = get_conn()
    _ensure_answer_log(conn)
    rows = conn.execute(
        """SELECT a.module, a.submodule, a.correct, a.created_at, q.tag3
           FROM answer_log a LEFT JOIN questions q ON q.id = a.question_id
           WHERE a.uid=? AND a.module IS NOT NULL AND a.module!=''
           ORDER BY a.created_at""",
        (uid,),
    ).fetchall()
    due3 = _due_by_tag3(conn, uid)
    conn.close()
    tidx = taxonomy.topic_index()
    counts = tag3_counts()
    # 按 tag3 / 二级分组聚合原始作答
    t3_stat: dict = {}
    grp_stat: dict = {}
    total_n = len(rows)
    for r in rows:
        tag3 = r["tag3"] if r["tag3"] and r["tag3"] != "UNKNOWN" and r["tag3"] in tidx else None
        c = 1 if r["correct"] else 0
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
        "cold": total_n < MASTERY_COLD_START_N,
        "need": MASTERY_COLD_START_N,
        "coverage": {
            "practiced": len(practiced),
            "total": total_t3,
            "pct": round(100 * len(practiced) / total_t3) if total_t3 else 0,
        },
        "modules": modules,
    }
    _MASTERY_CACHE[uid] = (now, out)
    return out


def mastery_topic(uid: str, tag3: str) -> dict:
    """单考点详情：近 20 次作答序列、到期错题、可练新题数（吸底条 / 强化前后对比用）。"""
    now = time.time()
    tidx = taxonomy.topic_index()
    t = tidx.get(tag3)
    conn = get_conn()
    _ensure_answer_log(conn)
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
    _ensure_mistake_uid(conn)
    cl, args = _uid_clause(uid)
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
    _ensure_answer_log(conn)
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


REINFORCE_N = 5
REINFORCE_REASONS = ("方法不会", "概念不清")


def _ensure_reinforce_log(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS reinforce_log (
            uid TEXT NOT NULL, day TEXT NOT NULL, skill TEXT NOT NULL,
            created_at REAL, PRIMARY KEY (uid, day, skill))"""
    )


def reinforce_done_today(uid: str) -> set:
    conn = get_conn()
    _ensure_reinforce_log(conn)
    rows = conn.execute(
        "SELECT skill FROM reinforce_log WHERE uid=? AND day=?", (uid, _today_str())
    ).fetchall()
    conn.close()
    return {r["skill"] for r in rows}


def _reinforce_log_add(conn, uid: str, skill: str):
    _ensure_reinforce_log(conn)
    conn.execute(
        "INSERT OR IGNORE INTO reinforce_log (uid, day, skill, created_at) VALUES (?,?,?,?)",
        (uid, _today_str(), skill, time.time()),
    )


def reinforce_candidates(uid: str, include_done: bool = False) -> dict:
    """今日强化候选：今日复习中答错 / 自评「方法不会/概念不清」的错题聚合考点，
    取掌握度最低者（spec-02 口径）；并列取到期错题多者。频控：每日每考点 1 组。"""
    conn = get_conn()
    _ensure_review_log(conn)
    _ensure_mistake_uid(conn)
    rows = conn.execute(
        """SELECT r.correct, m.error_reason, m.module mmod, m.question_type,
                  q.tag3, q.module qmod, q.submodule
           FROM review_log r JOIN mistakes m ON m.id=r.mistake_id
           LEFT JOIN questions q ON q.id=m.question_id
           WHERE r.uid=? AND r.created_at>=?""",
        (uid, _day_start()),
    ).fetchall()
    tidx = taxonomy.topic_index()
    agg: dict = {}
    for r in rows:
        if r["correct"] and (r["error_reason"] or "") not in REINFORCE_REASONS:
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
            if avail < REINFORCE_N:
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
                "module": module, "module_name": MODULE_NAMES.get(module, module),
                "submodule": sub,
                "mastery": node["mastery"] if node else 0.0,
                "level_name": node["level_name"] if node else "未接触",
                "due": 0,
                "wrong_today": a["wrong_today"], "avail_n": avail_total,
            }
        if item["avail_n"] < REINFORCE_N:
            continue  # 抽不满一组不出卡
        if skill in done:
            continue  # 频控：每日每考点最多 1 组
        items.append(item)
    conn.close()
    items.sort(key=lambda x: (x["mastery"], -x["due"], -x["wrong_today"]))
    return {"items": items[:4], "picked": items[0] if items else None}


def reinforce_questions(uid: str, tag3: str | None = None, module: str | None = None,
                        submodule: str | None = None, limit: int = REINFORCE_N) -> list[dict]:
    """同考点强化取题：同 tag3（回退 submodule）、该 uid 未作答过、未下架，
    按 |全站正确率-60| 升序优先中等难度；资料分析优先同材料成组；不足同二级题型补足。"""
    conn = get_conn()
    _ensure_answer_log(conn)
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
        for q in _pick("submodule=?", [submodule], limit - len(out), seen):
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
    conn = get_conn()
    _ensure_answer_log(conn)
    if tag3:
        n = conn.execute(
            """SELECT COUNT(*) FROM answer_log a JOIN questions q ON q.id=a.question_id
               WHERE a.uid=? AND a.created_at>=? AND q.tag3=?""",
            (uid, _day_start(), tag3),
        ).fetchone()[0]
    elif submodule:
        n = conn.execute(
            "SELECT COUNT(*) FROM answer_log WHERE uid=? AND created_at>=? AND submodule=?",
            (uid, _day_start(), submodule),
        ).fetchone()[0]
    else:
        n = 0
    conn.close()
    return n


MODULE_NAMES = {
    "ziliao": "资料分析", "shuliang": "数量关系", "yanyu": "言语理解",
    "panduan": "判断推理", "changshi": "常识判断",
}
