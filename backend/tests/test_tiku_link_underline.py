"""R210：/tiku 列表链接非颜色区分（link-in-text-block，qlist 列表项链接下划线）。"""


def test_papers_list_links_underlined(client):
    r = client.get("/tiku/papers/")
    assert r.status_code == 200
    assert ".qlist li>a{text-decoration:underline}" in r.text
