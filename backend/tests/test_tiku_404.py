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


def test_sitemap_shard_404_stays_non_html(client):
    seed_questions()
    r = client.get("/sitemap-questions-999.xml")
    assert r.status_code == 404
    assert not r.headers["content-type"].startswith("text/html")
