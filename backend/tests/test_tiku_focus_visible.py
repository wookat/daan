"""R197：/tiku SSR 页族键盘焦点可见性（focus-visible 焦点环对齐 SPA 约定）。"""


def test_tiku_has_focus_visible_ring(client):
    r = client.get("/tiku/")
    assert r.status_code == 200
    assert ":focus-visible{outline:2px solid var(--link);outline-offset:2px" in r.text


def test_tiku_search_input_keeps_mouse_focus_quiet(client):
    r = client.get("/tiku/")
    assert ".hdr-s input:focus:not(:focus-visible){outline:none}" in r.text
    assert "outline:none}" + ".hdr-s input:focus{" not in r.text
