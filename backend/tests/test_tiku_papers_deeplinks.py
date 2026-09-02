"""R278：真题卷 SSR 页族卷库 year/region 深链契约。"""
import json
from urllib.parse import quote

from app import db
from app.seo.common import SITE_BASE

from .conftest import seed_questions


def _seed_paper(title: str, year: int | None, region: str | None, qids: list[int]) -> int:
    conn = db.get_conn()
    db._ensure_exam_tables(conn)
    cur = conn.execute(
        "INSERT INTO exam_papers (title, kind, year, region, question_ids, duration_min, created_at)"
        " VALUES (?,?,?,?,?,?,strftime('%s','now'))",
        (title, "zhenti", year, region, json.dumps(qids), 120),
    )
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    return cur.lastrowid


def test_papers_hub_year_region_chips(client):
    qids = seed_questions()
    _seed_paper("2023年江苏公务员考试《行测》真题", 2023, "江苏", qids[:3])
    html = client.get("/tiku/papers/").text
    assert "按年份筛卷" in html and 'href="/#/pkgA/exam/list?year=2023"' in html
    assert "按地区筛卷" in html and f'href="/#/pkgA/exam/list?region={quote("江苏")}"' in html


def test_paper_detail_cta_carries_year_region(client):
    qids = seed_questions()
    pid = _seed_paper("2024年上海公务员考试《行测》真题", 2024, "上海", qids[:3])
    html = client.get(f"/tiku/papers/{pid}").text
    assert f'href="{SITE_BASE}/#/pkgA/exam/list?year=2024&region={quote("上海")}">在线模考本卷' in html


def test_paper_detail_cta_omits_missing_fields(client):
    qids = seed_questions()
    pid = _seed_paper("无年份地区测试卷", None, None, qids[:3])
    html = client.get(f"/tiku/papers/{pid}").text
    assert f'href="{SITE_BASE}/#/pkgA/exam/list">在线模考本卷' in html
