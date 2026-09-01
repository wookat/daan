"""R156：/tiku/search 重定向 + 首页 SearchAction + 头部搜索表单。"""


def test_tiku_search_redirects_to_spa(client):
    r = client.get("/tiku/search", params={"q": "隧道"}, follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"] == "/#/pkgA/search/search?q=%E9%9A%A7%E9%81%93"


def test_tiku_search_empty_q_falls_back_to_search_page(client):
    r = client.get("/tiku/search", follow_redirects=False)
    assert r.status_code == 302
    assert r.headers["location"] == "/#/pkgA/search/search"


def test_tiku_index_has_search_action_and_form(client):
    r = client.get("/tiku/")
    assert r.status_code == 200
    assert "SearchAction" in r.text
    assert "/tiku/search?q={search_term_string}" in r.text
    assert 'action="/tiku/search"' in r.text
