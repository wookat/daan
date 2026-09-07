"""R397 scripts/build_zhenti_papers.py：只补缺——已成卷 source 跳过、标题即 source 原文、超量疑似混装跳过；
_paper_by_psource 只看 zhenti（mock 卷不参与归卷）。"""
import importlib.util
import json
import os

from app import db
from tests.test_paper_psource import _seed_paper, _seed_src_questions

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "scripts", "build_zhenti_papers.py")
_spec = importlib.util.spec_from_file_location("build_zhenti_papers", SCRIPT)
assert _spec and _spec.loader
bz = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bz)


def _collect(min_q: int, max_q: int = bz.MAX_QUESTIONS):
    db._papers_cache.clear()
    conn = db.get_conn()
    try:
        return bz.collect(conn, min_q, max_q)
    finally:
        conn.close()


def test_title_is_source_verbatim_so_same_year_region_papers_stay_distinct():
    assert bz.paper_title("2025年国考行测真题（地市级）", 2025, "国考") == "2025年国考行测真题（地市级）"
    assert bz.paper_title("2025年国考行测真题（副省级）", 2025, "国考") == "2025年国考行测真题（副省级）"
    assert bz.paper_title("  2012年四川公务员《行测》真题试卷（下半年） ", 2012, "四川") == "2012年四川公务员《行测》真题试卷（下半年）"
    assert bz.paper_title("", 2020, "浙江") == "2020年浙江行测真题卷"


def test_collect_skips_sources_already_in_a_paper_and_keeps_new_ones(client):
    old = _seed_src_questions("2024r397已成卷source", 21)
    pid = _seed_paper("r397 已成卷", old)
    fresh = _seed_src_questions("2024r397待成卷source", 21)
    papers, skipped = _collect(21)
    by_src = {p["source"]: p for p in papers}
    assert "2024r397已成卷source" not in by_src
    assert any(s == "2024r397已成卷source" and f"id={pid}" in why for s, why in skipped)
    p = by_src["2024r397待成卷source"]
    assert p["title"] == "2024r397待成卷source"
    assert sorted(p["ids"]) == sorted(fresh)
    assert p["per_mod"]["yanyu"] == 21


def test_collect_skips_oversized_source_and_taken_title(client):
    _seed_src_questions("2024r397超量source", 25)
    _seed_paper("2024r397撞名source", _seed_src_questions("2024r397撞名占位卷", 21))
    _seed_src_questions("2024r397撞名source", 21)
    papers, skipped = _collect(21, max_q=24)
    srcs = {p["source"] for p in papers}
    assert "2024r397超量source" not in srcs and "2024r397撞名source" not in srcs
    why = dict(skipped)
    assert "25 题 > 24" in why["2024r397超量source"]
    assert "已被别的卷占用" in why["2024r397撞名source"]


def test_upsert_then_rerun_is_idempotent(client):
    qids = _seed_src_questions("2024r397幂等source", 21)
    papers, _ = _collect(21)
    p = next(x for x in papers if x["source"] == "2024r397幂等source")
    pid = db.upsert_exam_paper(p["title"], "zhenti", p["year"], p["region"], p["ids"], p["duration"])
    papers2, skipped2 = _collect(21)
    assert all(x["source"] != "2024r397幂等source" for x in papers2)
    assert dict(skipped2)["2024r397幂等source"] == f"已成卷 id={pid}"
    conn = db.get_conn()
    row = conn.execute("SELECT question_ids FROM exam_papers WHERE id=?", (pid,)).fetchone()
    conn.close()
    assert sorted(json.loads(row["question_ids"])) == sorted(qids)


def test_paper_by_psource_ignores_mock_kind(client):
    qids = _seed_src_questions("2024r397mock不归卷source", 21)
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        ("r397 mock 卷", "mock", None, None, json.dumps(qids), 30),
    )
    conn.commit()
    db._papers_cache.clear()
    assert "2024r397mock不归卷source" not in db._paper_by_psource(conn)
    conn.close()
    pid = _seed_paper("r397 同题真题卷", qids)
    conn = db.get_conn()
    assert db._paper_by_psource(conn)["2024r397mock不归卷source"]["pid"] == pid
    conn.close()
