"""R231：/llms.txt 站点导览（llmstxt.org）契约。"""


def test_llms_txt_ok(client):
    r = client.get("/llms.txt")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/markdown")
    body = r.text
    assert body.startswith("# 错题邦公考题库")
    assert "\n> " in body
    for path in ("/tiku/", "/tiku/papers/", "/tiku/daily/", "/tiku/discuss/", "/sitemap.xml"):
        assert f"https://kaogong.zalize.com{path}" in body
    for mod in ("ziliao", "shuliang", "yanyu", "panduan", "changshi"):
        assert f"/tiku/{mod}/" in body
