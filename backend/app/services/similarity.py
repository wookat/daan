"""题目文本相似度引擎：simhash（字符 n-gram）+ 分带候选检索 + 重复簇构建。

纯本地实现，无外部 API 依赖。索引存 SQLite 辅助表：
  - question_simhash(qid, simhash, b0..b3)  分带倒排（4×16bit band）
  - dup_clusters(cluster_id, qid, similarity, status)  重复/近重复簇
"""
import hashlib
import json
import re
import time

NGRAM = 3
HAM_THRESHOLD = 3        # 64bit simhash 海明距离阈值（候选）
JACCARD_THRESHOLD = 0.72  # n-gram Jaccard 验证阈值（定簇）
_BUCKET_CAP = 500         # 单 band 桶内最多参与两两比较的成员数（防倾斜桶爆炸）

_ws_re = re.compile(r"\s+")
_punct_re = re.compile("[，。！？；：、\u201c\u201d\u2018\u2019（）()《》〈〉【】\\[\\]{}<>—…·,.!?;:'\"-]")


def normalize(question: str, options=None) -> str:
    """题干 + 选项拼接后归一化：去空白/标点、小写。"""
    parts = [question or ""]
    if options:
        if isinstance(options, str):
            try:
                options = json.loads(options)
            except Exception:
                options = None
        if isinstance(options, dict):
            parts.extend(str(options[k]) for k in sorted(options))
    text = "".join(parts).lower()
    text = _punct_re.sub("", text)
    return _ws_re.sub("", text)


def ngrams(text: str, n: int = NGRAM):
    if len(text) < n:
        return {text} if text else set()
    return {text[i:i + n] for i in range(len(text) - n + 1)}


def _hash64(s: str) -> int:
    return int.from_bytes(hashlib.blake2b(s.encode("utf-8"), digest_size=8).digest(), "big")


def simhash64(grams) -> int:
    if not grams:
        return 0
    v = [0] * 64
    for g in grams:
        h = _hash64(g)
        for i in range(64):
            v[i] += 1 if (h >> i) & 1 else -1
    out = 0
    for i in range(64):
        if v[i] > 0:
            out |= 1 << i
    return out


_MASK64 = (1 << 64) - 1


def to_signed(sh: int) -> int:
    """64bit 无符号 → 有符号（SQLite INTEGER 为签名 64bit）。"""
    return sh - (1 << 64) if sh >= (1 << 63) else sh


def bands(sh: int):
    sh &= _MASK64
    return ((sh >> 48) & 0xFFFF, (sh >> 32) & 0xFFFF, (sh >> 16) & 0xFFFF, sh & 0xFFFF)


def hamming(a: int, b: int) -> int:
    return ((a ^ b) & _MASK64).bit_count()


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def ensure_tables(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS question_simhash (
            qid INTEGER PRIMARY KEY,
            simhash INTEGER NOT NULL,
            b0 INTEGER, b1 INTEGER, b2 INTEGER, b3 INTEGER,
            built_at REAL
        )"""
    )
    for i in range(4):
        conn.execute(f"CREATE INDEX IF NOT EXISTS idx_sim_b{i} ON question_simhash(b{i})")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS dup_clusters (
            cluster_id INTEGER NOT NULL,
            qid INTEGER NOT NULL,
            similarity REAL,
            status TEXT DEFAULT 'open',
            PRIMARY KEY (cluster_id, qid)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dup_qid ON dup_clusters(qid)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sim_meta (
            key TEXT PRIMARY KEY, value TEXT
        )"""
    )


def _iter_questions(conn):
    return conn.execute(
        "SELECT id, question, options FROM questions WHERE disabled IS NOT 1"
    )


def build_index(conn, log=None) -> dict:
    """全量重建 simhash 索引。返回性能统计。"""
    ensure_tables(conn)
    t0 = time.time()
    rows = _iter_questions(conn).fetchall()
    batch = []
    for i, r in enumerate(rows):
        sh = simhash64(ngrams(normalize(r["question"], r["options"])))
        b = bands(sh)
        batch.append((r["id"], to_signed(sh), *b, t0))
        if log and (i + 1) % 20000 == 0:
            log(f"  simhash {i + 1}/{len(rows)} ({time.time() - t0:.1f}s)")
    conn.execute("DELETE FROM question_simhash")
    conn.executemany(
        "INSERT OR REPLACE INTO question_simhash (qid, simhash, b0, b1, b2, b3, built_at) VALUES (?,?,?,?,?,?,?)",
        batch,
    )
    conn.execute(
        "INSERT OR REPLACE INTO sim_meta (key, value) VALUES ('index_built_at', ?)", (str(t0),)
    )
    conn.commit()
    return {"n": len(rows), "seconds": round(time.time() - t0, 2)}


def find_similar(conn, qid: int, limit: int = 10) -> list[dict]:
    """基于分带候选 + n-gram Jaccard 精排，返回 top-N 相似题。"""
    ensure_tables(conn)
    me = conn.execute("SELECT * FROM question_simhash WHERE qid=?", (qid,)).fetchone()
    src = conn.execute("SELECT id, question, options FROM questions WHERE id=?", (qid,)).fetchone()
    if not src:
        return []
    src_grams = ngrams(normalize(src["question"], src["options"]))
    if me is None:
        sh = simhash64(src_grams)
        b = bands(sh)
    else:
        sh = me["simhash"]
        b = (me["b0"], me["b1"], me["b2"], me["b3"])
    cand = conn.execute(
        "SELECT DISTINCT qid, simhash FROM question_simhash "
        "WHERE (b0=? OR b1=? OR b2=? OR b3=?) AND qid!=? "
        "UNION "
        "SELECT s.qid, s.simhash FROM question_simhash s "
        "WHERE s.qid IN (SELECT d2.qid FROM dup_clusters d JOIN dup_clusters d2 "
        "ON d2.cluster_id=d.cluster_id WHERE d.qid=? AND d2.qid!=?)",
        (*b, qid, qid, qid),
    ).fetchall()
    scored = []
    for c in cand:
        row = conn.execute(
            "SELECT id, module, submodule, question, options, answer, explanation, "
            "is_real, disabled, source, tag3, quality_score FROM questions WHERE id=?",
            (c["qid"],),
        ).fetchone()
        if not row:
            continue
        j = jaccard(src_grams, ngrams(normalize(row["question"], row["options"])))
        if j <= 0:
            continue
        d = dict(row)
        d["options"] = json.loads(d.get("options") or "{}")
        d["similarity"] = round(j, 4)
        d["hamming"] = hamming(sh, c["simhash"])
        scored.append(d)
    scored.sort(key=lambda x: -x["similarity"])
    return scored[:limit]


class _DSU:
    def __init__(self):
        self.p = {}

    def find(self, x):
        p = self.p
        while p.setdefault(x, x) != x:
            p[x] = p[p[x]]
            x = p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.p[rb] = ra


def build_clusters(conn, log=None) -> dict:
    """基于索引产出全库重复/近重复簇（跨模块）。返回性能统计。"""
    ensure_tables(conn)
    t0 = time.time()
    rows = conn.execute(
        "SELECT s.qid, s.simhash, s.b0, s.b1, s.b2, s.b3, q.question, q.options "
        "FROM question_simhash s JOIN questions q ON q.id=s.qid WHERE q.disabled IS NOT 1"
    ).fetchall()
    grams = {}
    sh = {}
    buckets = [{} for _ in range(4)]
    for r in rows:
        grams[r["qid"]] = ngrams(normalize(r["question"], r["options"]))
        sh[r["qid"]] = r["simhash"]
        for i, key in enumerate((r["b0"], r["b1"], r["b2"], r["b3"])):
            buckets[i].setdefault(key, []).append(r["qid"])
    dsu = _DSU()
    pair_sim = {}
    checked = set()
    comparisons = 0
    for bmap in buckets:
        for members in bmap.values():
            if len(members) < 2:
                continue
            members = members[:_BUCKET_CAP]
            for i in range(len(members)):
                for k in range(i + 1, len(members)):
                    a, b = members[i], members[k]
                    key = (a, b) if a < b else (b, a)
                    if key in checked:
                        continue
                    checked.add(key)
                    if hamming(sh[a], sh[b]) > HAM_THRESHOLD * 4:
                        continue
                    comparisons += 1
                    j = jaccard(grams[a], grams[b])
                    if j >= JACCARD_THRESHOLD:
                        dsu.union(a, b)
                        pair_sim[key] = j
    groups = {}
    for a, b in pair_sim:
        groups.setdefault(dsu.find(a), set()).update((a, b))
    conn.execute("DELETE FROM dup_clusters WHERE status='open'")
    resolved_qids = {
        r["qid"] for r in conn.execute("SELECT qid FROM dup_clusters WHERE status!='open'")
    }
    next_id = (conn.execute("SELECT COALESCE(MAX(cluster_id),0) FROM dup_clusters").fetchone()[0] or 0) + 1
    n_clusters = 0
    for members in sorted(groups.values(), key=lambda m: -len(m)):
        members = sorted(members)
        if any(q in resolved_qids for q in members):
            continue
        root = members[0]
        for q in members:
            best = max(
                (pair_sim.get((min(q, o), max(q, o)), 0.0) for o in members if o != q),
                default=1.0,
            )
            conn.execute(
                "INSERT OR REPLACE INTO dup_clusters (cluster_id, qid, similarity, status) VALUES (?,?,?,'open')",
                (next_id, q, round(best if q != root else 1.0, 4)),
            )
        next_id += 1
        n_clusters += 1
    conn.execute(
        "INSERT OR REPLACE INTO sim_meta (key, value) VALUES ('clusters_built_at', ?)", (str(time.time()),)
    )
    conn.commit()
    return {
        "n": len(rows),
        "clusters": n_clusters,
        "pairs": len(pair_sim),
        "comparisons": comparisons,
        "seconds": round(time.time() - t0, 2),
    }
