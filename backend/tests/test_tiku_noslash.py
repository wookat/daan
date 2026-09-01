from .conftest import seed_questions


def test_tiku_noslash_redirects(client):
    seed_questions()
    r = client.get("/tiku", follow_redirects=False)
    assert (r.status_code, r.headers["location"]) == (301, "/tiku/")
    r = client.get("/tiku/changshi", follow_redirects=False)
    assert (r.status_code, r.headers["location"]) == (301, "/tiku/changshi/")


def test_tiku_unknown_module_noslash_stays_404(client):
    assert client.get("/tiku/whatever", follow_redirects=False).status_code == 404


def test_tiku_paper_detail_slash_redirects(client):
    r = client.get("/tiku/papers/5/", follow_redirects=False)
    assert (r.status_code, r.headers["location"]) == (301, "/tiku/papers/5")


def test_tiku_daily_archive_noslash_redirects(client):
    r = client.get("/tiku/daily/2026-08-28", follow_redirects=False)
    assert (r.status_code, r.headers["location"]) == (301, "/tiku/daily/2026-08-28/")
