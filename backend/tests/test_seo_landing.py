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


def test_home_truncated_topics_have_more_link(client):
    from app import db, taxonomy

    seed_questions()
    db._TAG3_COUNTS_CACHE[1] = None
    t3counts = db.tag3_counts()
    n = sum(
        1
        for m in taxonomy.tree()["modules"]
        if m["key"] == "changshi"
        for g in m["groups"]
        for t in g["topics"]
        if t3counts.get(t["code"])
    )
    r = client.get("/tiku/")
    assert r.status_code == 200
    link = f'<a href="/tiku/changshi/">全部 {n} 个考点 →</a>'
    assert (link in r.text) == (n > 12)


def test_tiku_copy_claims_xingce_only(client):
    """题库计数只含行测题（申论 0 题），文案不得把计数说成含申论题目。"""
    seed_questions()
    r = client.get("/tiku/")
    assert r.status_code == 200
    assert "行测申论题目" not in r.text
    assert "行测/申论题目" not in r.text
    assert "道行测题目" in r.text
    r2 = client.get("/tiku/discuss/")
    assert r2.status_code == 200
    assert "行测/申论题目" not in r2.text


def test_indexnow_page_urls_cover_sitemap_families(client):
    # R255：IndexNow 页族提交集合 = 首页 + 三个非题目 sitemap 的全部 URL
    from app import seo

    seed_questions()
    urls = set(seo._indexnow_page_urls())
    assert seo._url("/") in urls
    for u, _ts in seo._sitemap_page_urls():
        assert u in urls
    for u, _ts in seo._sitemap_topic_urls():
        assert u in urls
    for u, _ts in seo._sitemap_year_urls():
        assert u in urls
    assert not any("/tiku/q/" in u for u in urls)  # 题目页走既有游标通道


def test_indexnow_submit_pages_hash_dedup(client, monkeypatch):
    # 集合未变化不重复提交；变化后（hash 不同）重新提交
    from app import db as adb
    from app import seo

    seed_questions()
    calls = []
    monkeypatch.setattr(seo, "_indexnow_post", lambda urls: calls.append(list(urls)) or True)
    conn = adb.get_conn()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS seo_meta (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        seo._indexnow_submit_pages(conn)
        assert len(calls) == 1 and seo._url("/tiku/") in calls[0]
        seo._indexnow_submit_pages(conn)
        assert len(calls) == 1  # hash 命中，零提交
        conn.execute(
            "UPDATE seo_meta SET value='stale' WHERE key='indexnow_pages_hash'"
        )
        conn.commit()
        seo._indexnow_submit_pages(conn)
        assert len(calls) == 2
    finally:
        conn.close()
