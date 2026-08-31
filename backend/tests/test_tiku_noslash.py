from .conftest import seed_questions


def test_tiku_noslash_redirects(client):
    seed_questions()
    r = client.get("/tiku", follow_redirects=False)
    assert (r.status_code, r.headers["location"]) == (301, "/tiku/")
    r = client.get("/tiku/changshi", follow_redirects=False)
    assert (r.status_code, r.headers["location"]) == (301, "/tiku/changshi/")


def test_tiku_unknown_module_noslash_stays_404(client):
    assert client.get("/tiku/whatever", follow_redirects=False).status_code == 404
