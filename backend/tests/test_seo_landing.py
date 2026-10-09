import json
import re

from .conftest import seed_pk, seed_questions, seed_share


def test_question_page_jsonld_learning_resource_and_breadcrumb(client):
    """题目页不是 Q&A 社区页：Google QAPage 准则把「站方单一答案、用户不能补答」列为无效用例，
    整站 10.9 万页一律不得再输出 QAPage；改为 LearningResource ⊃ Question(选择题)。"""
    qids = seed_questions()
    r = client.get(f"/tiku/q/{qids[0]}")
    assert r.status_code == 200
    assert "QAPage" not in r.text
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', r.text, re.DOTALL)
    assert m
    ld = json.loads(m.group(1))
    types = {d["@type"] for d in ld}
    assert types == {"LearningResource", "BreadcrumbList"}
    lr = next(d for d in ld if d["@type"] == "LearningResource")
    assert lr["url"].endswith(f"/tiku/q/{qids[0]}")
    assert lr["learningResourceType"] in {"真题", "练习题"}
    q = lr["hasPart"]
    assert q["@type"] == "Question" and q["eduQuestionType"] == "Multiple choice"
    # 选项一一对应 suggestedAnswer（与页面可见内容一致），正确答案在 acceptedAnswer
    opts_html = re.findall(r'<a class="opt" [^>]*><b>([A-Z])\.</b>', r.text)
    assert [a["text"][0] for a in q["suggestedAnswer"]] == opts_html
    assert q["acceptedAnswer"]["text"].startswith("正确答案：")
    assert "answerCount" not in q and "mainEntity" not in lr
    bc = next(d for d in ld if d["@type"] == "BreadcrumbList")
    items = bc["itemListElement"]
    assert items[0]["name"] == "题库"
    assert items[0]["item"].endswith("/tiku/")
    assert "item" not in items[-1]  # 末项（当前页）无链接


def test_question_page_cta_deeplinks_same_question(client):
    """搜索访客的意图是「这道题」：CTA 必须带 qid 且来源 seo_q，有无考点标签两支都不回首页。"""
    from app import db
    from app.seo import pages

    qids = seed_questions()
    conn = db.get_conn()
    conn.execute("UPDATE questions SET tag3='ZL-PJ-04' WHERE id=?", (qids[0],))
    conn.execute("UPDATE questions SET tag3=NULL WHERE id=?", (qids[1],))
    conn.commit()
    conn.close()
    pages._render_question.cache_clear()

    html = client.get(f"/tiku/q/{qids[0]}").text
    m = re.search(r'class="cta cta-w" href="([^"]+)">([^<]+)</a>', html)
    assert m
    href, label = m.group(1), m.group(2)
    assert f"/#/pages/practice/practice?qid={qids[0]}&tag3=ZL-PJ-04&module=ziliao&source=seo_q" in href
    assert label == "做这道题，再来五道同考点 ›"

    html = client.get(f"/tiku/q/{qids[1]}").text
    m = re.search(r'class="cta cta-w" href="([^"]+)">([^<]+)</a>', html)
    assert m
    assert f"/#/pages/practice/practice?qid={qids[1]}&module=ziliao&source=seo_q" in m.group(1)
    assert m.group(2) == "去练习页做这道题 ›"
    assert "继续刷题" not in html


def test_question_page_first_fold_funnel(client):
    """首屏就能做题：选项是带 pick 的深链（首屏唯一动作，不再叠一个 CTA）；答案/解析默认折叠但仍在 DOM（供收录），
    看完解析后才出唯一一个「再来几道」CTA。"""
    from app.seo import pages

    qids = seed_questions()
    pages._render_question.cache_clear()
    html = client.get(f"/tiku/q/{qids[0]}").text

    opts = re.findall(r'<a class="opt" href="([^"]+)" rel="nofollow"><b>([A-D])\.</b>', html)
    assert [k for _, k in opts] == ["A", "B", "C", "D"]
    for href, k in opts:
        assert f"qid={qids[0]}" in href and "source=seo_q" in href and href.endswith(f"&pick={k}")
    assert '<div class="opt">' not in html

    assert "<details open" not in html
    assert '<details class="ans"><summary>先想一想，再看答案与解析' in html
    assert "正确答案：" in html and "测试解析" in html
    # 提示→选项→答案→解析→CTA 的页面顺序；CTA 全页只有一个
    ans_at = html.index("<b>正确答案：")
    assert html.index("点选项就能作答") < html.index('class="opt"') < ans_at < html.index("测试解析", ans_at) < html.index('class="cta cta-w"')
    assert html.count('class="cta cta-w"') == 1
    assert "· 免费无需注册 ·" not in html
    assert "返回「" not in html
    assert f"题目 #{qids[0]}" not in html


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
    assert "/app/#/pkgA/share/pk-result?rid=TSTPK1" in html


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


def test_tiku_footer_count_claim_matches_home(client):
    """W2：/tiku 页族页脚题量口径与 H5 首页一致，不再出现过时的「13万+」。"""
    qids = seed_questions()
    for path in ("/tiku/", "/tiku/yanyu/", f"/tiku/q/{qids[0]}", "/tiku/discuss/"):
        r = client.get(path)
        assert r.status_code == 200, path
        assert "10万+ 行测题 · 1.5万+ 历年真题" in r.text, path
        assert "13万+" not in r.text, path


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
    monkeypatch.setattr(
        seo.sitefiles, "_indexnow_post", lambda urls: calls.append(list(urls)) or True
    )
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
