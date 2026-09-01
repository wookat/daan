from .conftest import seed_questions


def test_question_page_has_print_styles(client):
    seed_questions()
    r = client.get("/tiku/q/1")
    assert r.status_code == 200
    assert "@media print" in r.text
    assert "break-inside:avoid" in r.text


def test_question_page_noise_sections_marked_noprint(client):
    seed_questions()
    r = client.get("/tiku/q/1")
    assert ".hdr-cta,.hdr-s,.cta,.pager,.crumb,.tags,.ftr,.noprint{display:none!important}" in r.text
