"""HEAD 请求语义：与 GET 同状态同响应头、空 body（R177）。"""


def test_head_matches_get_on_public_pages(client):
    for url in ["/tiku/", "/robots.txt", "/sitemap.xml", "/api/stats"]:
        g = client.get(url)
        h = client.head(url)
        assert h.status_code == g.status_code == 200, url
        assert h.headers.get("content-type") == g.headers.get("content-type"), url
        assert h.content == b"", url


def test_head_unknown_path_still_404(client):
    assert client.head("/no/such/path").status_code == 404


def test_post_unaffected(client):
    r = client.post("/api/track", json={"event": "boot", "uid": "uheadchk"})
    assert r.status_code == 200
