"""SEO & GEO 优化回归：/llms.txt、/llms-full.txt、AI 搜索爬虫放行、Sitemap 根路径与 lastmod、
单题 LearningResource/考点速记、考点 DefinedTerm/FAQPage/prev-next、子题型横向内链与 PK OG 图修复。"""
import importlib.util
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from urllib.parse import quote

from app import db
from app.seo import pages

from .conftest import seed_pk, seed_questions
from .test_shenlun_hub import _clear_shenlun, _seed_shenlun


def test_llms_txt_and_llms_full_txt_structure(client):
    seed_questions(3, modules=("ziliao", "yanyu", "panduan"))
    r1 = client.get("/llms.txt")
    assert r1.status_code == 200
    assert r1.headers["content-type"].startswith("text/markdown")
    assert "## 核心数据与特色" in r1.text
    assert "https://kaogong.zalize.com/llms-full.txt" in r1.text
    assert "https://kaogong.zalize.com/" in r1.text

    r2 = client.get("/llms-full.txt")
    assert r2.status_code == 200
    assert r2.headers["content-type"].startswith("text/markdown")
    body = r2.text
    assert body.startswith("# 答岸（kaogong.zalize.com）完整站点与公考知识索引")
    assert "## 站点规模总览" in body
    assert "## 公务员行测五大模块与三级考点方法速查" in body
    assert "/tiku/t/ZL-JQ-01/" in body and "方法要点：" in body
    assert "## 常见问题（FAQ）" in body
    assert "/tiku/shenlun/" not in body

    _seed_shenlun(2)
    try:
        r3 = client.get("/llms-full.txt")
        assert r3.status_code == 200
        assert "## 申论真题库与写作素材" in r3.text
        assert "https://kaogong.zalize.com/tiku/shenlun/" in r3.text
    finally:
        _clear_shenlun()
    assert "/tiku/shenlun/" not in client.get("/llms-full.txt").text


def test_robots_txt_allows_ai_search_and_blocks_scrapers(client):
    r = client.get("/robots.txt")
    assert r.status_code == 200
    txt = r.text
    for bot in (
        "OAI-SearchBot",
        "ChatGPT-User",
        "PerplexityBot",
        "Perplexity-User",
        "Claude-SearchBot",
        "Claude-User",
        "DuckAssistBot",
    ):
        assert f"User-agent: {bot}\nAllow: /\nAllow: /tiku/\nAllow: /llms.txt\nAllow: /llms-full.txt" in txt
    for blocked in (
        "GPTBot",
        "Reflectionbot",
        "ClaudeBot",
        "Bytespider",
        "CCBot",
        "Amazonbot",
        "Meta-ExternalAgent",
    ):
        assert f"User-agent: {blocked}\nDisallow: /" in txt
    assert "# LLMs: https://kaogong.zalize.com/llms.txt" in txt
    assert "# LLMs-Full: https://kaogong.zalize.com/llms-full.txt" in txt


def test_sitemap_includes_root_and_index_lastmod(client):
    seed_questions()
    idx = client.get("/sitemap.xml")
    assert idx.status_code == 200
    root = ET.fromstring(idx.content)
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    maps = root.findall(f"{ns}sitemap")
    assert maps
    for sm in maps:
        assert sm.find(f"{ns}lastmod") is not None
        assert re.match(r"^\d{4}-\d{2}-\d{2}$", sm.find(f"{ns}lastmod").text or "")

    pages_xml = client.get("/sitemap-pages.xml").text
    assert "<loc>https://kaogong.zalize.com/</loc>" in pages_xml


def test_question_page_geo_schema_and_topic_note(client):
    long_exp = "截位直除速算解析。" * 80
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO questions (module, submodule, tag3, question_type, question, options, answer, "
        "explanation, is_real, exam_year, exam_region, disabled, updated_at) "
        "VALUES ('ziliao', '基期与现期', 'ZL-JQ-01', '单选题', ?, ?, 'A', ?, 1, 2025, '国考', 0, ?)",
        (
            "GEO 测试真题：2024 年某省 GDP 同比增量估算最接近哪项？",
            json.dumps({"A": "100", "B": "200", "C": "300", "D": "400"}, ensure_ascii=False),
            long_exp,
            time.time(),
        ),
    )
    qid = cur.lastrowid
    conn.commit()
    conn.close()
    pages._render_question.cache_clear()

    try:
        r = client.get(f"/tiku/q/{qid}")
        assert r.status_code == 200
        html = r.text
        assert "<title>" in html and "2025年国考资料分析真题及答案解析_答岸</title>" in html
        assert "考点速记（基期量计算）：" in html
        assert 'name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"' in html
        assert 'property="og:locale" content="zh_CN"' in html
        assert 'name="twitter:image"' in html

        m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.DOTALL)
        assert m
        ld = json.loads(m.group(1))
        assert {d["@type"] for d in ld} == {"LearningResource", "BreadcrumbList"}
        lr = next(d for d in ld if d["@type"] == "LearningResource")
        assert lr["isAccessibleForFree"] is True
        assert lr["educationalUse"] == "练习与真题解析"
        assert lr["teaches"]
        assert "dateModified" in lr and re.match(r"^\d{4}-\d{2}-\d{2}$", lr["dateModified"])
        assert "基期量计算" in lr["keywords"]
        assert len(lr["hasPart"]["acceptedAnswer"]["text"]) > 600
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM questions WHERE id=?", (qid,))
        conn.commit()
        conn.close()
        pages._render_question.cache_clear()


def test_topic_page_has_defined_term_faq_and_rel_links(client):
    conn = db.get_conn()
    opts = json.dumps({"A": "10", "B": "20", "C": "30", "D": "40"}, ensure_ascii=False)
    inserted = []
    for i in range(55):
        cur = conn.execute(
            "INSERT INTO questions (module, submodule, tag3, question_type, question, options, answer, explanation, is_real, exam_year, disabled, updated_at) "
            "VALUES ('ziliao', '基期与现期', 'ZL-JQ-01', '单选题', ?, ?, 'A', '解析。', 1, 2025, 0, ?)",
            (f"SEO分页测试基期题 #{i}", opts, time.time() - i),
        )
        inserted.append(cur.lastrowid)
    conn.commit()
    conn.close()
    db._TAG3_COUNTS_CACHE[1] = None
    db._TAG3_LASTMOD_CACHE[1] = None
    db._YEAR_MODULE_CACHE[1] = None
    pages._render_topic.cache_clear()

    try:
        r1 = client.get("/tiku/t/ZL-JQ-01/")
        assert r1.status_code == 200
        h1 = r1.text
        assert '<link rel="next" href="https://kaogong.zalize.com/tiku/t/ZL-JQ-01/?page=2">' in h1
        assert '<link rel="prev"' not in h1
        assert "常见考点问答" in h1
        assert "按年份刷资料分析真题" in h1

        m = re.search(r'<script type="application/ld\+json">(.*?)</script>', h1, re.DOTALL)
        assert m
        ld = json.loads(m.group(1))
        assert {d["@type"] for d in ld} == {"CollectionPage", "DefinedTerm", "FAQPage"}
        dt = next(d for d in ld if d["@type"] == "DefinedTerm")
        assert dt["termCode"] == "ZL-JQ-01"
        faq = next(d for d in ld if d["@type"] == "FAQPage")
        assert len(faq["mainEntity"]) == 3
        for item in faq["mainEntity"]:
            assert item["name"] in h1
            assert item["acceptedAnswer"]["text"] in h1

        r2 = client.get("/tiku/t/ZL-JQ-01/?page=2")
        assert r2.status_code == 200
        assert '<link rel="prev" href="https://kaogong.zalize.com/tiku/t/ZL-JQ-01/">' in r2.text
    finally:
        conn = db.get_conn()
        conn.execute(
            f"DELETE FROM questions WHERE id IN ({','.join('?' * len(inserted))})",
            inserted,
        )
        conn.commit()
        conn.close()
        db._TAG3_COUNTS_CACHE[1] = None
        db._TAG3_LASTMOD_CACHE[1] = None
        db._YEAR_MODULE_CACHE[1] = None


def test_submodule_page_has_topics_siblings_and_years(client):
    opts = json.dumps({"A": "1", "B": "2", "C": "3", "D": "4"}, ensure_ascii=False)
    conn = db.get_conn()
    c1 = conn.execute(
        "INSERT INTO questions (module, submodule, tag3, question_type, question, options, answer, explanation, is_real, exam_year, disabled) "
        "VALUES ('ziliao', '基期与现期', 'ZL-JQ-01', '单选题', '子题型独立测试基期题', ?, 'A', '解析。', 1, 2025, 0)",
        (opts,),
    ).lastrowid
    c2 = conn.execute(
        "INSERT INTO questions (module, submodule, question_type, question, options, answer, explanation, is_real, disabled) "
        "VALUES ('ziliao', '增长率', '单选题', '子题型独立测试增长率题', ?, 'A', '解析。', 0, 0)",
        (opts,),
    ).lastrowid
    conn.commit()
    conn.close()
    db._TAG3_COUNTS_CACHE[1] = None
    db._YEAR_MODULE_CACHE[1] = None

    try:
        r = client.get(f"/tiku/ziliao/{quote('基期与现期')}/")
        assert r.status_code == 200
        html = r.text
        assert "本题型高频考点" in html
        assert 'href="/tiku/t/ZL-JQ-01/"' in html
        assert "同模块其他题型" in html
        assert f'/tiku/ziliao/{quote("增长率")}/' in html
        assert "按年份刷资料分析真题" in html
        assert 'href="/tiku/y/2025/ziliao/"' in html
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM questions WHERE id IN (?, ?)", (c1, c2))
        conn.commit()
        conn.close()
        db._TAG3_COUNTS_CACHE[1] = None
        db._YEAR_MODULE_CACHE[1] = None


def test_pk_landing_uses_lp_assets_og_card_and_dims(client):
    seed_pk("SEOPK1", status="finished", creator_score=100, opponent_score=80)
    r = client.get("/p/SEOPK1", follow_redirects=False)
    assert r.status_code == 200
    html = r.text
    assert "https://kaogong.zalize.com/lp-assets/og-card.png" in html
    assert "/static/og-card.png" not in html
    assert 'property="og:locale" content="zh_CN"' in html
    assert 'property="og:image:width" content="1200"' in html
    assert 'name="twitter:image" content="https://kaogong.zalize.com/lp-assets/og-card.png"' in html


def test_crawler_stats_recognizes_ai_search_bots():
    script = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "crawler_stats.py")
    spec = importlib.util.spec_from_file_location("crawler_stats_seo", script)
    assert spec and spec.loader
    cs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cs)

    now = 1788524000.0
    lines = [
        json.dumps(
            {
                "ts": now - 10,
                "status": 200,
                "request": {
                    "uri": "/llms-full.txt",
                    "headers": {"User-Agent": ["OAI-SearchBot/1.0"], "X-Kg-Ip": ["23.98.142.176"]},
                },
            }
        ),
        json.dumps(
            {
                "ts": now - 8,
                "status": 200,
                "request": {
                    "uri": "/tiku/q/1",
                    "headers": {"User-Agent": ["Mozilla/5.0 AppleWebKit/537.36 (compatible; PerplexityBot/1.0)"], "X-Kg-Ip": ["107.20.1.1"]},
                },
            }
        ),
        json.dumps(
            {
                "ts": now - 6,
                "status": 200,
                "request": {
                    "uri": "/tiku/",
                    "headers": {"User-Agent": ["Claude-SearchBot/1.0"], "X-Kg-Ip": ["34.192.1.1"]},
                },
            }
        ),
    ]
    res = cs.aggregate(iter(lines), days=7, now=now)
    assert set(res["engines"]) == {"OpenAI-Search", "Perplexity", "Claude-Search"}
    assert sum(res["engines"]["OpenAI-Search"]["sitemap"].values()) == 1
    assert sum(res["engines"]["Perplexity"]["tiku"].values()) == 1
    assert res["humans"]["page"] == {}
