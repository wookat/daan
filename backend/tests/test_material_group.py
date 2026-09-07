import json

from app import db

from .conftest import seed_questions


def _seed_group(n=3, h="mh-test-group"):
    conn = db.get_conn()
    ids = []
    for i in range(n):
        cur = conn.execute(
            "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer,"
            " explanation, is_real, disabled, material_hash) VALUES (?,?,?,?,?,?,1,0,?)",
            (
                "ziliao",
                "单选题",
                f"同材料组测试题 {i}：根据材料，下列说法正确的是？",
                json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False),
                "A",
                "测试解析：选 A。",
                h,
            ),
        )
        if cur.lastrowid:
            ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    return ids


def test_material_group_section_rendered(client):
    ids = _seed_group()
    r = client.get(f"/tiku/q/{ids[0]}")
    assert r.status_code == 200
    assert f"同材料题组（共 {len(ids)} 题）" in r.text
    assert "<b>本题</b>" in r.text
    for other in ids[1:]:
        assert f'href="/tiku/q/{other}"' in r.text


def test_no_group_section_without_material_hash(client):
    seed_questions()
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer,"
        " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,1,0)",
        (
            "ziliao",
            "单选题",
            "无材料组测试题：以下说法正确的是？",
            json.dumps({"A": "甲", "B": "乙"}, ensure_ascii=False),
            "A",
            "测试解析：选 A。",
        ),
    )
    qid = cur.lastrowid
    conn.commit()
    conn.close()
    r = client.get(f"/tiku/q/{qid}")
    assert r.status_code == 200
    assert "同材料题组" not in r.text


def _plan(conn, sql, args=()):
    return " | ".join(r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + sql, args))


def test_material_hash_partial_index_exists_and_used(client):
    """R381：material_hash 无索引时同材料题组/资料分析拉题按 disabled 扫全表（生产 15.6 万行 2–3 s）。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_q_material'"
    ).fetchone()
    assert row and "WHERE material_hash IS NOT NULL" in row["sql"]

    seo = _plan(
        conn,
        "SELECT id, question FROM questions WHERE material_hash=? AND disabled=0",
        ("h",),
    )
    assert "idx_q_material (material_hash=? AND disabled=?)" in seo

    pick = _plan(conn, db._ZILIAO_HASHES_SQL.format(indexed=" INDEXED BY idx_q_material"), (24,))
    assert "COVERING INDEX idx_q_material" in pick
    # 索引名写错/缺失 → OperationalError → 回退普通计划，不抛给调用方
    assert db._ziliao_material_hashes(conn, 3) is not None

    siblings = _plan(
        conn,
        "SELECT * FROM questions WHERE module='ziliao' AND material_hash=? AND disabled=0 ORDER BY id LIMIT 5",
        ("h",),
    )
    assert "idx_q_material (material_hash=? AND disabled=? AND module=?)" in siblings
    conn.close()


def test_grouped_ziliao_unchanged_with_index(client):
    """同材料题连续出、组内序号 i/n；索引只改执行计划不改结果形态。"""
    _seed_group(3, h="mh-test-index-group")
    items = db.grouped_ziliao_questions(3)
    assert len(items) >= 3
    grouped = [it for it in items if it.get("group_seq")]
    assert grouped, "至少一组材料题被选中"
    seqs = [it["group_seq"] for it in grouped[:3]]
    assert seqs[0].startswith("1/")
    ids = [it["id"] for it in grouped[:3]]
    assert ids == sorted(ids)


def test_ziliao_hashes_fallback_without_index():
    import sqlite3

    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    c.execute("CREATE TABLE questions (id INTEGER PRIMARY KEY, module TEXT, material_hash TEXT, disabled INTEGER)")
    c.executemany(
        "INSERT INTO questions (module, material_hash, disabled) VALUES ('ziliao', ?, 0)",
        [("h1",), ("h1",), ("h2",)],
    )
    rows = db._ziliao_material_hashes(c, 5)
    assert [r["material_hash"] for r in rows] == ["h1"]


def test_paper_source_partial_index_covers_list_papers(client):
    """R382：/api/papers 按 source 聚合 is_real=1 走 idx_q_real_year 回表翻 ~79 MB 冷页；覆盖索引免回表。"""
    conn = db.get_conn()
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_q_paper_src'"
    ).fetchone()
    assert row and "WHERE is_real=1" in row["sql"]
    plan = _plan(
        conn,
        """SELECT source, COUNT(*) n, MAX(exam_year) y, MAX(exam_region) rg FROM questions
           WHERE is_real=1 AND disabled=0 AND source IS NOT NULL AND source!=''
           GROUP BY source HAVING n>=40 ORDER BY y DESC, n DESC""",
    )
    assert "COVERING INDEX idx_q_paper_src" in plan
    conn.close()
    assert isinstance(db.list_papers(), list)


def test_active_src_index_covers_exam_papers_qid_lookup(client):
    """R383：卷库按卷内 qid 批量取 source/is_real 原走主键逐题回表（~64 MB 冷页）；
    (disabled, id, is_real, source) 覆盖索引由规划器自动选中，无需 INDEXED BY。"""
    conn = db.get_conn()
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='questions'")}
    assert "idx_q_active_src" in names
    assert "idx_q_disabled_id" not in names  # (disabled,id) 是 idx_q_sitemap 前缀，已收编
    plan = _plan(
        conn,
        "SELECT id, source, is_real FROM questions WHERE disabled=0 AND id IN (?,?,?)",
        (1, 2, 3),
    )
    assert "COVERING INDEX idx_q_active_src" in plan
    # sitemap 的 (disabled, id, updated_at) 扫描不受影响
    assert "idx_q_sitemap" in _plan(
        conn, "SELECT id, updated_at FROM questions WHERE disabled=0 AND id>? ORDER BY id LIMIT 10", (0,)
    )
    conn.close()
    assert isinstance(db.list_exam_papers(kind="zhenti"), list)


def test_admin_stats_counts_use_partial_indexes(client):
    """R383：管理台 stats 的 hs_done / hs_down 两个 COUNT 原本各全表扫 ~264 MB 宽行。"""
    conn = db.get_conn()
    assert "idx_q_hs_done" in _plan(
        conn, "SELECT COUNT(*) FROM questions WHERE hs_explanation IS NOT NULL AND hs_explanation!=''"
    )
    assert "idx_q_hs_down" in _plan(conn, "SELECT COUNT(*) FROM questions WHERE hs_down>0")
    conn.close()
    stats = db._admin_stats_uncached()
    assert stats["hs_done"] >= 0 and stats["hs_down_total"] >= 0
