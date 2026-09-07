"""R394：百度自适应标注——SSR 页 head 的 applicable-device 与 sitemap 每条 URL 的 mobile type。

背景：Baiduspider 经边缘的抓取 27 天为 0（09-04 那条 /tiku/q/297391 来自探针网段自测），
无账号无法主动提交；先把百度识别自适应页所需的两处标注补齐，抓到即按自适应页处理。
"""
import re
import xml.etree.ElementTree as ET

from app.seo.common import BAIDU_ADAPT_META
from app.seo.sitefiles import BAIDU_MOBILE_TAG

from .conftest import seed_questions

SM_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
BD_NS = "{http://www.baidu.com/schemas/sitemap-mobile/1/}"


def test_applicable_device_follows_viewport_on_ssr_pages(client):
    ids = seed_questions()
    for path in ("/tiku/", "/tiku/changshi/", f"/tiku/q/{ids[0]}", "/tiku/q/999999"):
        html = client.get(path).text
        head = html.split("</head>", 1)[0]
        assert head.count(BAIDU_ADAPT_META) == 1, path
        # 紧随 viewport（百度文档要求放在 viewport 标签之下）
        assert re.search(r'<meta name="viewport"[^>]*>' + re.escape(BAIDU_ADAPT_META), head), path


def test_sitemap_urls_carry_baidu_mobile_type(client):
    seed_questions()
    # 种子题无年份，/sitemap-years.xml 为空 urlset，走同一 _urlset 不单测
    for path in ("/sitemap-pages.xml", "/sitemap-topics.xml", "/sitemap-questions-1.xml"):
        r = client.get(path)
        assert r.status_code == 200, path
        root = ET.fromstring(r.content)  # 命名空间声明齐全才能解析
        assert root.tag == f"{SM_NS}urlset"
        urls = root.findall(f"{SM_NS}url")
        assert urls, path
        for u in urls:
            children = [c.tag for c in u]
            assert children[0] == f"{SM_NS}loc"
            mob = u.find(f"{BD_NS}mobile")
            assert mob is not None and mob.get("type") == "pc,mobile", path
            # 扩展元素放在核心元素（loc/lastmod）之后
            assert children[-1] == f"{BD_NS}mobile"
        assert r.text.count(BAIDU_MOBILE_TAG) == len(urls)


def test_sitemap_index_untouched(client):
    seed_questions()
    root = ET.fromstring(client.get("/sitemap.xml").content)
    assert root.tag == f"{SM_NS}sitemapindex"
    assert BAIDU_MOBILE_TAG not in client.get("/sitemap.xml").text
