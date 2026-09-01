import json
import re

from .conftest import seed_pk, seed_questions, seed_share


def test_question_page_jsonld_qapage_and_breadcrumb(client):
    qids = seed_questions()
    r = client.get(f"/tiku/q/{qids[0]}")
    assert r.status_code == 200
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', r.text, re.DOTALL)
    assert m
    ld = json.loads(m.group(1))
    types = {d["@type"] for d in ld}
    assert types == {"QAPage", "BreadcrumbList"}
    bc = next(d for d in ld if d["@type"] == "BreadcrumbList")
    items = bc["itemListElement"]
    assert items[0]["name"] == "题库"
    assert items[0]["item"].endswith("/tiku/")
    assert "item" not in items[-1]  # 末项（当前页）无链接


def test_share_landing_valid(client):
    qids = seed_questions()
    seed_share("tstsid01", qids[0], from_name="测试考友")
    r = client.get("/s/tstsid01", follow_redirects=False)
    assert r.status_code == 200
    html = r.text
    assert "测试考友分享了一道" in html
    assert 'property="og:title"' in html
    assert 'name="robots" content="noindex"' in html
    assert "测试解析" not in html  # 不泄露解析


def test_share_landing_unknown_redirects_home(client):
    r = client.get("/s/nosuchsid", follow_redirects=False)
    assert r.status_code == 302


def test_pk_landing_finished(client):
    seed_pk("TSTPK1", status="finished", creator_score=120, opponent_score=90)
    r = client.get("/p/TSTPK1", follow_redirects=False)
    assert r.status_code == 200
    html = r.text
    assert "测试甲 120 : 90 测试乙" in html
    assert 'property="og:title"' in html
    assert 'name="robots" content="noindex"' in html
    assert "/#/pkgA/share/pk-result?rid=TSTPK1" in html


def test_pk_landing_lowercase_code_normalized(client):
    seed_pk("TSTPK2")
    r = client.get("/p/tstpk2", follow_redirects=False)
    assert r.status_code == 200


def test_pk_landing_waiting_redirects_home(client):
    seed_pk("TSTPKW", status="waiting")
    r = client.get("/p/TSTPKW", follow_redirects=False)
    assert r.status_code == 302


def test_pk_landing_invalid_redirects_home(client):
    for rid in ("NOPE99", "%27%20OR%201%3D1"):
        r = client.get(f"/p/{rid}", follow_redirects=False)
        assert r.status_code == 302


def test_module_page_topic_and_year_links(client):
    from app import db

    seed_questions()
    conn = db.get_conn()
    conn.execute(
        "UPDATE questions SET tag3='CS-FL-01', is_real=1, exam_year=2025 "
        "WHERE module='changshi' AND id=(SELECT id FROM questions WHERE module='changshi' LIMIT 1)"
    )
    conn.commit()
    conn.close()
    db._TAG3_COUNTS_CACHE[1] = None
    db._YEAR_MODULE_CACHE[1] = None
    r = client.get("/tiku/changshi/")
    assert r.status_code == 200
    assert 'href="/tiku/t/CS-FL-01/"' in r.text
    assert 'href="/tiku/y/2025/changshi/"' in r.text
