from app.seo import PAGE_SIZE, _pager


def test_middle_page_window_with_gaps():
    html = _pager("/tiku/panduan/", 50, 459 * PAGE_SIZE)
    assert '<a href="/tiku/panduan/?page=49" rel="prev">上一页</a>' in html
    assert '<a href="/tiku/panduan/?page=51" rel="next">下一页</a>' in html
    assert '<a href="/tiku/panduan/">1</a>' in html
    assert html.count('<span class="gap">…</span>') == 2
    for p in (48, 49, 51, 52):
        assert f'<a href="/tiku/panduan/?page={p}">{p}</a>' in html
    assert '<span aria-current="page">50</span>' in html
    assert '<a href="/tiku/panduan/?page=459">459</a>' in html


def test_first_page_no_prev_no_page1_query():
    html = _pager("/tiku/panduan/", 1, 459 * PAGE_SIZE)
    assert 'rel="prev"' not in html
    assert "?page=1" not in html
    assert '<span aria-current="page">1</span>' in html
    assert '<a href="/tiku/panduan/?page=2" rel="next">下一页</a>' in html
    assert '<a href="/tiku/panduan/?page=459">459</a>' in html


def test_last_page_no_next():
    html = _pager("/tiku/panduan/", 459, 459 * PAGE_SIZE)
    assert 'rel="next"' not in html
    assert '<span aria-current="page">459</span>' in html
    assert '<a href="/tiku/panduan/?page=458" rel="prev">上一页</a>' in html
    assert '<a href="/tiku/panduan/">1</a>' in html


def test_page2_prev_links_clean_base_path():
    html = _pager("/tiku/panduan/", 2, 459 * PAGE_SIZE)
    assert '<a href="/tiku/panduan/" rel="prev">上一页</a>' in html
    assert "?page=1" not in html


def test_single_page_no_links():
    html = _pager("/tiku/x/", 1, 3)
    assert "<a " not in html
    assert '<span aria-current="page">1</span>' in html


def test_small_page_count_no_gaps():
    html = _pager("/tiku/x/", 2, 4 * PAGE_SIZE)
    assert "gap" not in html
    assert '<span aria-current="page">2</span>' in html
    for p in (3, 4):
        assert f'<a href="/tiku/x/?page={p}">{p}</a>' in html
