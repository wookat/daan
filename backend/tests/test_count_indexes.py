"""题库聚合统计查询计划回归（R149）：三条 GROUP BY 聚合必须走覆盖索引，不回表。"""
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
    assert "COVERING INDEX idx_q_disabled_tag3" in plan
    assert "TEMP B-TREE" not in plan


def test_year_module_counts_uses_covering_index():
    plan = _plan(
        "SELECT exam_year y, module m, COUNT(*) n, MAX(updated_at) mu FROM questions "
        "WHERE is_real=1 AND disabled=0 AND exam_year IS NOT NULL GROUP BY exam_year, module"
    )
    assert "COVERING INDEX idx_q_real_year" in plan
    assert "TEMP B-TREE" not in plan
