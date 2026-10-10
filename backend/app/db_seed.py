"""py 拆分之 seed 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import glob
import gzip
import hashlib
import json
import os
import re
import sqlite3
import time

from . import db, quality, taxonomy
from .tagging import classify_question

__all__ = ["_enrich_new_question", "_ensure_seed_tables", "_material_key", "_open_seed", "_seed_bank_path", "_seed_bank_paths", "_seed_questions", "_seed_questions_file", "_seed_shizheng", "_ziliao_material_hashes", "import_hs_explanations", "import_questions", "merge_submodule", "refresh_material_hash"]


def _seed_bank_path(name: str) -> str | None:
    path = os.path.join(os.path.dirname(db.DB_PATH) if os.path.dirname(db.DB_PATH) else ".", "knowledge", name)
    alt = os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", name)
    path = path if os.path.exists(path) else alt
    return path if os.path.exists(path) else None


def _seed_bank_paths() -> list[str]:
    """knowledge/questions_bank*.jsonl(.gz) 全量种子文件（主库在前，外部库分文件便于重生成覆盖）。"""
    out = []
    for pat in ("questions_bank*.jsonl", "questions_bank*.jsonl.gz"):
        for p in glob.glob(os.path.join(os.path.dirname(db.DB_PATH) if os.path.dirname(db.DB_PATH) else ".", "knowledge", pat)) + glob.glob(
            os.path.join(os.path.dirname(__file__), "..", "..", "knowledge", pat)
        ):
            p = os.path.normpath(p)
            if p not in out:
                out.append(p)
    out.sort(key=lambda p: (not p.endswith("questions_bank.jsonl"), p))
    return out


def _open_seed(path: str):
    """种子文件读取：.gz 走 gzip，其余按 utf-8 文本。"""
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8")
    return open(path, encoding="utf-8")


def _ensure_seed_tables(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS seed_index (stem_hash TEXT PRIMARY KEY, question_id INTEGER)")
    conn.execute("CREATE TABLE IF NOT EXISTS seed_runs (path TEXT PRIMARY KEY, fingerprint TEXT, ran_at REAL)")


def _seed_questions(path: str | None = None) -> int:
    """启动时从 knowledge/questions_bank*.jsonl 导入题库，返回本次新插入条数。

    去重键是 seed_index（题干原文 sha1 → 首次导入的 id），不是 questions.question 当前值：
    种子题之后被改写/下线/删除都视为已导入，不再重插；文件内容指纹未变则整体跳过。
    path 传参时只导该文件（测试/工具用）；默认循环 _seed_bank_paths() 全部文件。
    """
    paths = [path] if path else _seed_bank_paths()
    total = 0
    for p in paths:
        total += _seed_questions_file(p)
    return total


def _seed_questions_file(path: str | None) -> int:
    if not path:
        return 0
    with open(path, "rb") as f:
        fp = hashlib.sha1(f.read()).hexdigest()
    conn = db.get_conn()
    _ensure_seed_tables(conn)
    prev = conn.execute("SELECT fingerprint FROM seed_runs WHERE path=?", (path,)).fetchone()
    if prev is not None and prev["fingerprint"] == fp:
        conn.close()
        return 0
    known = {r["stem_hash"] for r in conn.execute("SELECT stem_hash FROM seed_index")}
    inserted = 0
    with _open_seed(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                q = json.loads(line)
            except json.JSONDecodeError:
                continue
            stem = q.get("question")
            if not stem:
                continue
            h = hashlib.sha1(stem.encode("utf-8")).hexdigest()
            if h in known:
                continue
            cur = conn.execute(
                "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule, is_real, exam_year, exam_region, import_batch, image, image_credit, correct_ratio, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    q.get("module"),
                    q.get("question_type"),
                    stem,
                    db.options_json(q.get("options", {})),
                    q.get("answer"),
                    q.get("explanation"),
                    q.get("source"),
                    q.get("submodule"),
                    # 源名带模考/模拟/大赛等字样的按练习题处理，不是真题
                    1 if (q.get("is_real") and not db._MOCK_SRC_RE.search(q.get("source") or "")) else 0,
                    q.get("exam_year"),
                    q.get("exam_region"),
                    q.get("import_batch") or "seed",
                    q.get("image"),
                    q.get("image_credit"),
                    q.get("correct_ratio"),
                    time.time(),
                ),
            )
            if cur.rowcount:
                qid = cur.lastrowid
                inserted += 1
                _enrich_new_question(conn, qid, "seed")
            else:
                row = conn.execute("SELECT id FROM questions WHERE question=?", (stem,)).fetchone()
                qid = row["id"] if row else None
                if qid is not None and q.get("is_real") and not db._MOCK_SRC_RE.search(q.get("source") or ""):
                    # 既有题命中真题源：升级 is_real 并补来源维度（与 import_questions 同口径）
                    conn.execute(
                        "UPDATE questions SET is_real=1, exam_year=COALESCE(exam_year,?), exam_region=COALESCE(exam_region,?), source=COALESCE(NULLIF(source,'original'),?), correct_ratio=COALESCE(correct_ratio,?), image=COALESCE(image,?), updated_at=? WHERE id=?",
                        (q.get("exam_year"), q.get("exam_region"), q.get("source"), q.get("correct_ratio"), q.get("image"), time.time(), qid),
                    )
            if qid is None:
                continue
            if q.get("submodule"):
                conn.execute(
                    "UPDATE questions SET submodule=? WHERE id=? AND (submodule IS NULL OR submodule='')",
                    (q["submodule"], qid),
                )
            conn.execute("INSERT OR IGNORE INTO seed_index (stem_hash, question_id) VALUES (?,?)", (h, qid))
            known.add(h)
    conn.execute(
        "INSERT OR REPLACE INTO seed_runs (path, fingerprint, ran_at) VALUES (?,?,?)", (path, fp, time.time())
    )
    conn.commit()
    conn.close()
    return inserted


def _seed_shizheng():
    """启动时从 knowledge/shizheng_bank.jsonl 导入时政题库（按题干去重）。"""
    path = _seed_bank_path("shizheng_bank.jsonl")
    if not path:
        return
    conn = db.get_conn()
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
                    db.options_json(q.get("options", {})),
                    q.get("answer"),
                    q.get("explanation"),
                    q.get("source_note"),
                    now,
                ),
            )
    conn.commit()
    conn.close()


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
    conn = db.get_conn()
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


def _ziliao_material_hashes(conn, n: int) -> list:
    """无 sqlite_stat1 时规划器对 GROUP BY material_hash 偏向 (disabled,module) 索引回表 4.7k 行，
    显式走部分覆盖索引；索引缺失（极旧库）回退普通计划。"""
    try:
        return conn.execute(
            db._ZILIAO_HASHES_SQL.format(indexed=" INDEXED BY idx_q_material"), (n,)
        ).fetchall()
    except sqlite3.OperationalError:
        return conn.execute(db._ZILIAO_HASHES_SQL.format(indexed=""), (n,)).fetchall()


def merge_submodule(module: str | None, sub: str | None) -> str | None:
    """按轮1 T3b 定案映射把旧考点名归一为当前 taxonomy 名。"""
    if not sub:
        return sub
    return db.SUBMODULE_MERGE.get(module or "", {}).get(sub, sub)


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
    conn = db.get_conn()
    inserted = 0
    skipped = 0
    for q in items:
        opts = q.get("options") or {}
        if q.get("is_real") and (not q.get("source") or q.get("source") == "original"):
            q["is_real"] = False
        answer = db.normalize_answer(q.get("answer"), opts) if isinstance(opts, dict) else ""
        if (
            q.get("module") not in db.VALID_MODULES
            or not q.get("question")
            or not answer
            or not isinstance(opts, dict)
            or db._bad_options(opts)
        ):
            skipped += 1
            continue
        cur = conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer, explanation, source, submodule, is_real, exam_year, exam_region, disabled, import_batch, image, image_credit, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                q.get("module"),
                q.get("question_type"),
                q.get("question"),
                db.options_json(opts),
                answer,
                q.get("explanation"),
                q.get("source"),
                db.normalize_submodule(q.get("submodule")),
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


def import_hs_explanations(items: list[dict]) -> int:
    conn = db.get_conn()
    n = 0
    for it in items:
        qid = it.get("id")
        if not qid:
            continue
        text = quality.sanitize_hs(it.get("hs_explanation"))
        if text is None:
            continue
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
            db.rescore_question(conn, int(qid))
    conn.commit()
    conn.close()
    return n


