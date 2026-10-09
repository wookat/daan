from .conftest import seed_questions


def _assert_html_404(r):
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("text/html")
    assert '<meta name="robots" content="noindex">' in r.text
    assert 'rel="canonical"' not in r.text
    assert 'href="/tiku/"' in r.text


def test_missing_question_html_404(client):
    seed_questions()
    _assert_html_404(client.get("/tiku/q/999999"))


def test_unknown_module_html_404(client):
    _assert_html_404(client.get("/tiku/whatever/"))
    _assert_html_404(client.get("/tiku/whatever"))


def test_unknown_topic_and_paper_html_404(client):
    seed_questions()
    _assert_html_404(client.get("/tiku/t/NOPE/"))
    _assert_html_404(client.get("/tiku/papers/999999"))


def test_page_out_of_range_html_404(client):
    seed_questions()
    _assert_html_404(client.get("/tiku/changshi/?page=999"))


def test_malformed_params_html_404(client):
    seed_questions()
    _assert_html_404(client.get("/tiku/changshi/?page=abc"))
    _assert_html_404(client.get("/tiku/q/abc"))
    _assert_html_404(client.get("/tiku/papers/abc/"))
    _assert_html_404(client.get("/tiku/y/abcd/changshi/"))


def test_empty_module_hub_html_404(client):
    seed_questions()
    r = client.get("/tiku/shenlun/")
    _assert_html_404(r)
    assert 'href="/app/#/pkgA/shenlun/shenlun"' in r.text
    assert '申论专区' in r.text
    assert client.get("/tiku/changshi/").status_code == 200


def test_generic_404_has_no_shenlun_outlet(client):
    r = client.get("/tiku/whatever/")
    _assert_html_404(r)
    assert 'pkgA/shenlun' not in r.text


def test_api_malformed_params_stay_json_422(client):
    r = client.get("/api/questions", params={"limit": "abc"})
    assert r.status_code == 422
    assert r.headers["content-type"].startswith("application/json")
    assert "detail" in r.json()


def test_sitemap_shard_404_stays_non_html(client):
    seed_questions()
    r = client.get("/sitemap-questions-999.xml")
    assert r.status_code == 404
    assert not r.headers["content-type"].startswith("text/html")
