"""题库聚合统计查询计划回归（R149）：三条 GROUP BY 聚合必须走覆盖索引，不回表；W2 mistakes(uid, created_at)。"""
from app import db


def _plan(sql: str) -> str:
    conn = db.get_conn()
    rows = conn.execute("EXPLAIN QUERY PLAN " + sql).fetchall()
    conn.close()
    return " | ".join(r["detail"] for r in rows)


def test_question_counts_uses_covering_index():
    plan = _plan(
        "SELECT module, COUNT(*) n FROM questions WHERE disabled=0 GROUP BY module"
    )
    assert "COVERING INDEX idx_q_disabled_module" in plan
    assert "TEMP B-TREE" not in plan


def test_tag3_counts_uses_covering_index():
    plan = _plan(
        "SELECT tag3, COUNT(*) n FROM questions WHERE tag3 IS NOT NULL AND tag3!='' "
        "AND disabled=0 GROUP BY tag3"
    )
    assert "COVERING INDEX idx_q_disabled_tag3_upd" in plan
    assert "TEMP B-TREE" not in plan


def test_tag3_lastmod_uses_covering_index():
    plan = _plan(
        "SELECT tag3, MAX(updated_at) mu FROM questions WHERE tag3 IS NOT NULL AND tag3!='' "
        "AND disabled=0 GROUP BY tag3"
    )
    assert "COVERING INDEX idx_q_disabled_tag3_upd" in plan
    assert "TEMP B-TREE" not in plan


def test_real_regions_uses_covering_index():
    plan = _plan(
        "SELECT exam_region r, COUNT(*) n FROM questions WHERE is_real=1 "
        "AND exam_region IS NOT NULL AND exam_region!='' GROUP BY exam_region HAVING n >= 20"
    )
    assert "COVERING INDEX idx_q_real_region" in plan


def test_year_module_counts_uses_covering_index():
    plan = _plan(
        "SELECT exam_year y, module m, COUNT(*) n, MAX(updated_at) mu FROM questions "
        "WHERE is_real=1 AND disabled=0 AND exam_year IS NOT NULL GROUP BY exam_year, module"
    )
    assert "COVERING INDEX idx_q_real_year" in plan
    assert "TEMP B-TREE" not in plan


def test_admin_batches_uses_covering_index():
    plan = _plan(
        "SELECT import_batch AS batch, COUNT(*) AS n, "
        "SUM(CASE WHEN disabled=2 THEN 1 ELSE 0 END) AS pending, SUM(is_real) AS real_n "
        "FROM questions WHERE import_batch IS NOT NULL "
        "GROUP BY import_batch ORDER BY import_batch DESC LIMIT 50"
    )
    assert "COVERING INDEX idx_q_batch" in plan
    assert "TEMP B-TREE" not in plan


def test_batch_answer_dist_uses_covering_index():
    plan = _plan(
        "SELECT UPPER(SUBSTR(TRIM(answer),1,1)) a, COUNT(*) n FROM questions "
        "WHERE import_batch='b1' GROUP BY a"
    )
    assert "COVERING INDEX idx_q_batch" in plan


def test_list_mistakes_uses_uid_index_no_sort():
    """list_mistakes: WHERE m.uid=? ORDER BY m.created_at DESC → idx_mist_uid 同时承担过滤与排序。"""
    plan = _plan(
        "SELECT m.*, q.tag3 FROM mistakes m LEFT JOIN questions q ON q.id=m.question_id "
        "WHERE 1=1 AND m.uid='u' ORDER BY m.created_at DESC LIMIT 500"
    )
    assert "USING INDEX idx_mist_uid (uid=?)" in plan
    assert "TEMP B-TREE" not in plan


def test_mistake_count_by_uid_uses_index():
    plan = _plan("SELECT COUNT(*) FROM mistakes WHERE uid='u'")
    assert "COVERING INDEX idx_mist_uid" in plan
