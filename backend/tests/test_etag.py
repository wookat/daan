"""公开小文本响应 ETag + If-None-Match 304 语义（R178）。"""


def test_etag_stable_and_304(client):
    r1 = client.get("/tiku/")
    r2 = client.get("/tiku/")
    etag = r1.headers.get("etag")
    assert etag and etag.startswith('"')
    assert etag == r2.headers.get("etag")
    r3 = client.get("/tiku/", headers={"If-None-Match": etag})
    assert r3.status_code == 304
    r4 = client.get("/tiku/", headers={"If-None-Match": f"W/{etag}"})
    assert r4.status_code == 304
    assert r3.content == b""
    assert r3.headers.get("etag") == etag


def test_etag_mismatch_returns_full(client):
    r = client.get("/tiku/", headers={"If-None-Match": '"nope"'})
    assert r.status_code == 200
    assert len(r.content) > 0


def test_api_json_has_no_etag(client):
    r = client.get("/api/stats")
    assert r.status_code == 200
    assert "etag" not in r.headers


def test_head_carries_etag(client):
    g = client.get("/robots.txt")
    h = client.head("/robots.txt")
    assert h.status_code == 200
    assert h.headers.get("etag") == g.headers.get("etag")
    assert h.content == b""
