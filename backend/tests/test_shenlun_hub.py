"""申论真题公开 hub：有语料时 200 呈现，语料清空回落品牌 404（R232 守卫不回退）。"""
import re
from urllib.parse import quote

from app import db

from .conftest import seed_questions


def _seed_shenlun(n: int = 3):
    conn = db.get_conn()
    for i in range(n):
        conn.execute(
            "INSERT OR IGNORE INTO shenlun_questions"
            " (exam_year, exam_region, paper, qtype, material, question, reference, disabled)"
            " VALUES (?,?,?,?,?,?,?,0)",
            (2023, "国考", "2023年国考申论（副省级）", "概括归纳",
             f"给定资料测试 {i}", f"测试申论题干 {i}：请概括给定资料的主要问题。", "参考解析：略。"),
        )
    conn.execute("UPDATE shenlun_questions SET disabled=0 WHERE question LIKE '测试申论题干%'")
    conn.commit()
    conn.close()


def _clear_shenlun():
    conn = db.get_conn()
    conn.execute("UPDATE shenlun_questions SET disabled=1")
    conn.commit()
    conn.close()


def test_shenlun_hub_materials_section(client):
    """R248：hub 首页外显素材库板块（类型计数 + mtype 深链）；无素材/分页页不渲染。"""
    seed_questions()
    _seed_shenlun()
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shenlun_materials (type, topic, content, source, disabled)"
        " VALUES ('金句', '测试素材金句', '测试素材内容', '', 0)"
    )
    conn.commit()
    conn.close()
    try:
        r = client.get("/tiku/shenlun/")
        assert "申论素材库（" in r.text
        # R264：板块类型链接指向素材 SSR 页族
        assert f'href="/tiku/shenlun/sucai/{quote("金句")}/"' in r.text
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM shenlun_materials WHERE topic LIKE '%测试素材%'")
        conn.commit()
        conn.close()
        # 素材清空后板块不渲染（真题 hub 本身不受影响）
        r2 = client.get("/tiku/shenlun/")
        assert r2.status_code == 200 and "申论素材库（" not in r2.text
        _clear_shenlun()


def test_material_discovery_copy_alignment(client):
    """R249：首页/llms.txt/hub 元信息补素材口径；素材清空自动回落纯真题口径。"""
    seed_questions()
    _seed_shenlun()
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shenlun_materials (type, topic, content, source, disabled)"
        " VALUES ('金句', '测试素材金句', '测试素材内容', '', 0)"
    )
    conn.commit()
    conn.close()
    try:
        home = client.get("/tiku/")
        assert "另收录申论写作素材" in home.text and "金句" in home.text
        assert "按套卷（含给定资料与参考解析）、年份、题型" in home.text  # R254
        llms = client.get("/llms.txt")
        assert "条写作素材" in llms.text
        assert "按套卷（含给定资料与参考解析）、年份、题型归档" in llms.text  # R254
        assert "年份/地区归档" not in llms.text  # 地区无 SSR 页族，旧口径不实
        hub = client.get("/tiku/shenlun/")
        assert "另有写作素材" in hub.text  # description + JSON-LD
        # 分页页 description 不带素材口径（板块也不渲染）
        p2 = client.get("/tiku/shenlun/?page=2")
        if p2.status_code == 200:
            assert "另有写作素材" not in p2.text
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM shenlun_materials WHERE topic LIKE '%测试素材%'")
        conn.commit()
        conn.close()
        assert "另收录申论写作素材" not in client.get("/tiku/").text
        assert "条写作素材" not in client.get("/llms.txt").text
        assert "另有写作素材" not in client.get("/tiku/shenlun/").text
        _clear_shenlun()


def test_shenlun_year_pages(client):
    """R250：申论按年份真题页；hub 年份链接、sitemap-years 收录；无语料年份 404。"""
    seed_questions()
    _seed_shenlun()
    try:
        r = client.get("/tiku/y/2023/shenlun/")
        assert r.status_code == 200
        assert "2023年申论真题（3 题）" in r.text
        assert "测试申论题干 0" in r.text
        assert re.search(r'href="/#/pkgA/shenlun/shenlun\?id=\d+">去作答', r.text)
        assert 'rel="canonical"' in r.text and "/tiku/y/2023/shenlun/" in r.text
        # 无斜杠 301
        r301 = client.get("/tiku/y/2023/shenlun", follow_redirects=False)
        assert r301.status_code == 301 and r301.headers["location"].endswith("/tiku/y/2023/shenlun/")
        # 年份页 CTA 带 ?year 深链（R252）
        assert 'href="/#/pkgA/shenlun/shenlun?year=2023"' in r.text
        # hub 年份 chips 为链接、地区 chips 为 ?region 深链（R252）
        hub = client.get("/tiku/shenlun/")
        assert 'href="/tiku/y/2023/shenlun/"' in hub.text
        assert f'href="/#/pkgA/shenlun/shenlun?region={quote("国考")}"' in hub.text
        # sitemap-years 收录
        sm = client.get("/sitemap-years.xml")
        assert "/tiku/y/2023/shenlun/" in sm.text
        # 无语料年份/越界页码 404
        assert client.get("/tiku/y/1999/shenlun/").status_code == 404
        assert client.get("/tiku/y/2023/shenlun/?page=999").status_code == 404
    finally:
        _clear_shenlun()
    assert client.get("/tiku/y/2023/shenlun/").status_code == 404
    assert "/tiku/y/2023/shenlun/" not in client.get("/sitemap-years.xml").text


def test_shenlun_qtype_pages(client):
    """R251：申论按题型真题页；hub 题型链接、sitemap-pages 收录；未知题型 404。"""
    seed_questions()
    _seed_shenlun()
    path = f"/tiku/shenlun/{quote('概括归纳')}/"
    try:
        r = client.get(path)
        assert r.status_code == 200
        assert "申论·概括归纳真题（3 题）" in r.text
        assert "测试申论题干 0" in r.text
        assert re.search(r'href="/#/pkgA/shenlun/shenlun\?id=\d+">去作答', r.text)
        assert 'rel="canonical"' in r.text and path in r.text
        # App CTA 带类型深链
        assert f'href="/#/pkgA/shenlun/shenlun?qtype={quote("概括归纳")}"' in r.text
        # 无斜杠 301
        r301 = client.get(path.rstrip("/"), follow_redirects=False)
        assert r301.status_code == 301 and r301.headers["location"].endswith(path)
        # hub 题型 chips 为链接
        hub = client.get("/tiku/shenlun/")
        assert f'href="{path}"' in hub.text
        # sitemap-pages 收录
        sm = client.get("/sitemap-pages.xml")
        assert path in sm.text
        # 未知题型/越界页码 404
        assert client.get("/tiku/shenlun/不存在题型/").status_code == 404
        assert client.get("/tiku/shenlun/不存在题型", follow_redirects=False).status_code == 404
        assert client.get(f"{path}?page=999").status_code == 404
    finally:
        _clear_shenlun()
    assert client.get(path).status_code == 404
    assert path not in client.get("/sitemap-pages.xml").text


def test_shenlun_paper_pages(client):
    """R253：申论按套卷详情页；材料+逐题解析、hub 套卷链接、sitemap 收录；未知套卷 404。"""
    seed_questions()
    _seed_shenlun()
    path = f"/tiku/shenlun/p/{quote('2023年国考申论（副省级）')}/"
    try:
        r = client.get(path)
        assert r.status_code == 200
        assert "2023年国考申论（副省级）申论真题（3 题）" in r.text
        assert "给定资料" in r.text and "给定资料测试 0" in r.text
        assert "参考解析" in r.text and "参考解析：略。" in r.text
        assert re.search(r'href="/#/pkgA/shenlun/shenlun\?id=\d+">去作答本题', r.text)
        assert 'class="cta" href="/#/pkgA/shenlun/shenlun?paper=' in r.text
        assert 'rel="canonical"' in r.text and path in r.text
        # 无斜杠 301（未知套卷无斜杠直接 404，不产生 301→404 链）
        r301 = client.get(path.rstrip("/"), follow_redirects=False)
        assert r301.status_code == 301 and r301.headers["location"].endswith(path)
        assert client.get("/tiku/shenlun/p/不存在套卷", follow_redirects=False).status_code == 404
        assert client.get("/tiku/shenlun/p/不存在套卷/").status_code == 404
        # hub 套卷板块链接 + 列表项卷名链接
        hub = client.get("/tiku/shenlun/")
        assert f'href="{path}"' in hub.text
        assert "按套卷刷题" in hub.text
        # 分页页不渲染套卷板块
        p2 = client.get("/tiku/shenlun/?page=2")
        if p2.status_code == 200:
            assert "按套卷刷题" not in p2.text
        # sitemap-pages 收录
        sm = client.get("/sitemap-pages.xml")
        assert path in sm.text
    finally:
        _clear_shenlun()
    assert client.get(path).status_code == 404
    assert path not in client.get("/sitemap-pages.xml").text


def test_shenlun_sucai_pages(client):
    """R264：申论素材按类型聚合 SSR 页；正文/出处外显、hub 链接、sitemap 收录；未知/清空类型 404。"""
    seed_questions()
    _seed_shenlun()
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shenlun_materials (type, topic, content, source, disabled)"
        " VALUES ('金句', '测试素材金句', '测试素材内容第一行\n第二行', '测试出处文献', 0)"
    )
    conn.commit()
    conn.close()
    path = f"/tiku/shenlun/sucai/{quote('金句')}/"
    try:
        r = client.get(path)
        assert r.status_code == 200
        assert "申论写作素材·金句（1 条）" in r.text
        assert "测试素材金句" in r.text
        assert "测试素材内容第一行<br>第二行" in r.text
        assert "出处：测试出处文献" in r.text
        assert 'rel="canonical"' in r.text and path in r.text
        # 逐条 App 深链（mid+mtype）与 CTA
        assert re.search(r'href="/#/pkgA/shenlun/shenlun\?tab=m&amp;mid=\d+&amp;mtype=', r.text)
        assert f'class="cta" href="/#/pkgA/shenlun/shenlun?tab=m&amp;mtype={quote("金句")}"' in r.text
        # 无斜杠 301；未知类型无斜杠直接 404（不产生 301→404 链）
        r301 = client.get(path.rstrip("/"), follow_redirects=False)
        assert r301.status_code == 301 and r301.headers["location"].endswith(path)
        assert client.get("/tiku/shenlun/sucai/不存在类型", follow_redirects=False).status_code == 404
        assert client.get("/tiku/shenlun/sucai/不存在类型/").status_code == 404
        # hub 素材板块链接改为 SSR 页
        hub = client.get("/tiku/shenlun/")
        assert f'href="{path}"' in hub.text
        # sitemap-pages 收录
        sm = client.get("/sitemap-pages.xml")
        assert path in sm.text
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM shenlun_materials WHERE topic LIKE '%测试素材%'")
        conn.commit()
        conn.close()
        # 类型清空后 404 + sitemap 消失
        assert client.get(path).status_code == 404
        assert path not in client.get("/sitemap-pages.xml").text
        _clear_shenlun()


def test_shenlun_hub_renders_with_corpus_and_falls_back_when_empty(client):
    seed_questions()
    _seed_shenlun()
    try:
        r = client.get("/tiku/shenlun/")
        assert r.status_code == 200
        assert 'rel="canonical"' in r.text and "/tiku/shenlun/" in r.text
        assert "noindex" not in r.text
        assert "申论真题库（3 题）" in r.text
        assert "测试申论题干 0" in r.text
        assert 'href="/#/pkgA/shenlun/shenlun"' in r.text
        # 逐题深链直达 App 详情（R242）
        assert re.search(r'href="/#/pkgA/shenlun/shenlun\?id=\d+">去作答', r.text)
        # 首页与 sitemap 出现入口
        home = client.get("/tiku/")
        assert 'href="/tiku/shenlun/"' in home.text
        sm = client.get("/sitemap-pages.xml")
        assert "/tiku/shenlun/" in sm.text
        # 越界页码 404
        assert client.get("/tiku/shenlun/?page=999").status_code == 404
    finally:
        _clear_shenlun()
    # 语料清空后守卫回落：品牌 404 + 专区 CTA，入口消失
    r404 = client.get("/tiku/shenlun/")
    assert r404.status_code == 404
    assert 'href="/#/pkgA/shenlun/shenlun"' in r404.text
    assert 'href="/tiku/shenlun/"' not in client.get("/tiku/").text
    assert "/tiku/shenlun/" not in client.get("/sitemap-pages.xml").text


def test_shenlun_questions_paper_filter(client):
    """R260：/api/shenlun/questions 支持 paper 精确筛选；未知套卷空结果。"""
    _seed_shenlun()
    try:
        r = client.get("/api/shenlun/questions", params={"paper": "2023年国考申论（副省级）"})
        assert r.status_code == 200
        d = r.json()
        assert d["total"] >= 1
        assert all(it["paper"] == "2023年国考申论（副省级）" for it in d["items"])
        r = client.get("/api/shenlun/questions", params={"paper": "不存在的套卷"})
        assert r.json()["total"] == 0
    finally:
        _clear_shenlun()
