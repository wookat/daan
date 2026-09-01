"""申论真题公开 hub：有语料时 200 呈现，语料清空回落品牌 404（R232 守卫不回退）。"""
import re

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
    conn.commit()
    conn.close()


def _clear_shenlun():
    conn = db.get_conn()
    conn.execute("UPDATE shenlun_questions SET disabled=1")
    conn.commit()
    conn.close()


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
