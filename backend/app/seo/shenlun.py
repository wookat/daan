"""申论 SSR 页族：hub、年份、题型、套卷详情。"""
from urllib.parse import quote

from fastapi import HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from .. import db
from .common import (
    _EMPTY_MODULE_OUTLET,
    PAGE_SIZE,
    _collection_ld,
    _crumb,
    _e,
    _not_found,
    _page,
    _pager,
    _shenlun_paper_path,
    _sub_path,
    _year_path,
    router,
)


def _shenlun_q_items(items) -> str:
    lis = []
    for it in items:
        text = (it["question"] or "").strip().replace("\n", " ")
        if len(text) > 80:
            text = text[:80] + "…"
        meta = " · ".join(
            s for s in (
                f'{it["exam_year"]}年' if it["exam_year"] else "",
                it["exam_region"] or "",
                it["qtype"] or "",
            ) if s
        )
        paper_link = (
            f'<a href="{_e(_shenlun_paper_path(it["paper"]))}">{_e(it["paper"])}</a> '
            if it["paper"] else ""
        )
        lis.append(
            f'<li><span class="meta">【{_e(meta)}】</span>{paper_link}{_e(text)} '
            f'<a href="/#/pkgA/shenlun/shenlun?id={it["id"]}">去作答 →</a></li>'
        )
    return "".join(lis)


def _render_shenlun_paper(paper: str) -> str:
    """申论按套卷详情页：给定资料一次呈现 + 全部小题与参考解析；未知套卷回落 404。"""
    items = db.shenlun_paper_questions(paper)
    if not items:
        raise HTTPException(404, "套卷不存在")
    first = items[0]
    material_html = _e((first["material"] or "").strip()).replace("\n", "<br>")
    q_cards = "".join(
        f'<div class="card"><h2>第{i}题{(" · " + _e(q["qtype"])) if q["qtype"] else ""}</h2>'
        f'<p>{_e((q["question"] or "").strip()).replace(chr(10), "<br>")}</p>'
        + (
            '<details class="ans"><summary>参考解析</summary>'
            f'<p>{_e((q["reference"] or "").strip()).replace(chr(10), "<br>")}</p></details>'
            if (q["reference"] or "").strip() else ""
        )
        + f'<p><a href="/#/pkgA/shenlun/shenlun?id={q["id"]}">去作答本题 →</a></p></div>'
        for i, q in enumerate(items, 1)
    )
    other_papers = [pc for pc in db.shenlun_paper_counts() if pc[0] != paper]
    other_papers.sort(key=lambda pc: (pc[1] != first["exam_year"], -(pc[1] or 0)))
    others = "".join(
        f'<a href="{_e(_shenlun_paper_path(p))}">{_e(p)}（{n}）</a>'
        for p, _y, _rg, n in other_papers[:12]
    )
    meta = " · ".join(
        s for s in (
            f'{first["exam_year"]}年' if first["exam_year"] else "",
            first["exam_region"] or "",
        ) if s
    )
    body = (
        _crumb([("题库", "/tiku/"), ("申论", "/tiku/shenlun/"), (paper, None)])
        + f"<h1>{_e(paper)}申论真题（{len(items)} 题）</h1>"
        + f'<p class="meta">{_e(meta)} · 给定资料 + {len(items)} 道小题，附参考解析，可在 App 申论专区在线作答</p>'
        + f'<div class="card"><h2>给定资料</h2><p>{material_html}</p></div>'
        + q_cards
        + (f'<div class="card"><h2>其他套卷申论真题</h2><div class="tags">{others}</div></div>' if others else "")
        + f'<a class="cta" href="/#/pkgA/shenlun/shenlun?id={first["id"]}">进入申论专区在线作答本套真题 →</a>'
    )
    return _page(
        f"{paper}申论真题_给定资料与参考解析_错题邦",
        f"{paper}申论真题共 {len(items)} 题，含完整给定资料与参考解析，可在线作答。",
        _shenlun_paper_path(paper),
        body,
        _collection_ld(
            f"{paper}申论真题",
            f"{paper}申论真题 {len(items)} 题，含给定资料与参考解析。",
            _shenlun_paper_path(paper),
            [("题库", "/tiku/"), ("申论", "/tiku/shenlun/"), (paper, _shenlun_paper_path(paper))],
        ),
    )


def _render_shenlun_year(year: int, page: int) -> str:
    """申论按年份真题页：与行测 /y/{year}/{module}/ 同 URL 家族；该年份无语料回落 404。"""
    counts = db.shenlun_year_counts()
    total = dict(counts).get(year, 0)
    if not total:
        raise HTTPException(404, "页面不存在")
    res = db.shenlun_questions(year=year, limit=PAGE_SIZE, offset=(page - 1) * PAGE_SIZE)
    items = res["items"]
    if not items and page > 1:
        raise HTTPException(404, "页码超出范围")
    other_years = "".join(
        f'<a href="{_e(_year_path(y, "shenlun"))}">{y}年（{n}）</a>'
        for y, n in counts if y != year
    )
    body = (
        _crumb([("题库", "/tiku/"), ("申论", "/tiku/shenlun/"), (f"{year}年真题", None)])
        + f"<h1>{year}年申论真题（{total} 题）</h1>"
        + f'<p class="meta">{year}年国考/省考申论真题（概括、对策、公文、大作文等题型），附参考解析</p>'
        + '<div class="card"><ul class="qlist">'
        + _shenlun_q_items(items)
        + "</ul></div>"
        + _pager(_year_path(year, "shenlun"), page, total)
        + (f'<div class="card"><h2>其他年份申论真题</h2><div class="tags">{other_years}</div></div>' if other_years else "")
        + f'<a class="cta" href="/#/pkgA/shenlun/shenlun?year={year}">进入申论专区在线作答{year}年申论真题 →</a>'
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    return _page(
        f"{year}年申论真题{suffix}_{year}年公务员考试申论真题及参考解析_错题邦",
        f"{year}年公务员考试申论真题共 {total} 题，覆盖概括、对策、公文、大作文等题型，附参考解析，可在线作答。{suffix}",
        _year_path(year, "shenlun") + (f"?page={page}" if page > 1 else ""),
        body,
        _collection_ld(
            f"{year}年申论真题",
            f"{year}年公务员考试申论真题 {total} 题，附参考解析。",
            _year_path(year, "shenlun"),
            [("题库", "/tiku/"), ("申论", "/tiku/shenlun/"), (f"{year}年真题", _year_path(year, "shenlun"))],
        ),
    )


def _render_shenlun_qtype(qtype: str, page: int) -> str:
    """申论按题型真题页：与行测 /tiku/{module}/{子题型}/ 同 URL 家族；未知题型/清空回落 404。"""
    counts = db.shenlun_qtype_counts()
    total = dict(counts).get(qtype, 0)
    if not total:
        raise HTTPException(404, "题型不存在")
    res = db.shenlun_questions(qtype=qtype, limit=PAGE_SIZE, offset=(page - 1) * PAGE_SIZE)
    items = res["items"]
    if not items and page > 1:
        raise HTTPException(404, "页码超出范围")
    other_types = "".join(
        f'<a href="{_e(_sub_path("shenlun", t))}">{_e(t)}（{n}）</a>'
        for t, n in counts if t != qtype
    )
    body = (
        _crumb([("题库", "/tiku/"), ("申论", "/tiku/shenlun/"), (qtype, None)])
        + f"<h1>申论·{_e(qtype)}真题（{total} 题）</h1>"
        + f'<p class="meta">历年国考/省考申论{_e(qtype)}题型真题，附参考解析</p>'
        + '<div class="card"><ul class="qlist">'
        + _shenlun_q_items(items)
        + "</ul></div>"
        + _pager(_sub_path("shenlun", qtype), page, total)
        + (f'<div class="card"><h2>其他题型申论真题</h2><div class="tags">{other_types}</div></div>' if other_types else "")
        + f'<a class="cta" href="/#/pkgA/shenlun/shenlun?qtype={quote(qtype)}">进入申论专区在线作答{_e(qtype)}真题 →</a>'
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    return _page(
        f"申论{qtype}真题{suffix}_历年申论{qtype}题型真题及参考解析_错题邦",
        f"申论{qtype}题型真题共 {total} 题，附参考解析，可在线作答。{suffix}",
        _sub_path("shenlun", qtype) + (f"?page={page}" if page > 1 else ""),
        body,
        _collection_ld(
            f"申论·{qtype}真题",
            f"历年申论{qtype}题型真题 {total} 题，附参考解析。",
            _sub_path("shenlun", qtype),
            [("题库", "/tiku/"), ("申论", "/tiku/shenlun/"), (qtype, _sub_path("shenlun", qtype))],
        ),
    )


@router.get("/shenlun/p/{paper}", include_in_schema=False)
def tiku_shenlun_paper_noslash(paper: str):
    if not db.shenlun_paper_questions(paper):
        return _not_found("套卷不存在")
    return RedirectResponse(_shenlun_paper_path(paper), status_code=301)


@router.get("/shenlun/p/{paper}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_shenlun_paper(paper: str):
    try:
        return HTMLResponse(_render_shenlun_paper(paper))
    except HTTPException as e:
        return _not_found(e.detail)


def _tiku_shenlun(page: int):
    """申论真题 hub：以 shenlun_questions 真实语料呈现；语料清空时回落品牌 404。"""
    res = db.shenlun_questions(limit=PAGE_SIZE, offset=(page - 1) * PAGE_SIZE)
    total = res["total"]
    if not total:
        return _not_found("该模块暂无题目", _EMPTY_MODULE_OUTLET.get("shenlun", ""))
    items = res["items"]
    if not items and page > 1:
        return _not_found("页码超出范围")
    filters = db.shenlun_filters()
    year_chips = "".join(
        f'<a href="{_e(_year_path(y, "shenlun"))}">{y}年（{n}）</a>'
        for y, n in db.shenlun_year_counts()
    )
    region_chips = "".join(
        f'<a href="/#/pkgA/shenlun/shenlun?region={quote(r)}">{_e(r)}</a>'
        for r in filters["regions"][:12]
    )
    qtype_chips = "".join(
        f'<a href="{_e(_sub_path("shenlun", t))}">{_e(t)}（{n}）</a>'
        for t, n in db.shenlun_qtype_counts()
    )
    paper_chips = "".join(
        f'<a href="{_e(_shenlun_paper_path(p))}">{_e(p)}（{n}）</a>'
        for p, _y, _rg, n in db.shenlun_paper_counts()
    ) if page == 1 else ""
    mat_html = ""
    mat_desc = ""
    if page == 1:
        mat_counts = db.shenlun_material_type_counts()
        if mat_counts:
            mat_total = sum(n for _, n in mat_counts)
            mat_desc = f"另有写作素材 {mat_total} 条。"
            mat_links = "".join(
                f'<a href="/#/pkgA/shenlun/shenlun?tab=m&amp;mtype={quote(t)}">{_e(t)}（{n} 条）</a> '
                for t, n in mat_counts
            )
            mat_html = (
                f'<div class="card"><h2>申论素材库（{mat_total} 条）</h2>'
                "<p>政策理论、金句、案例、范文等写作素材，可在 App 申论专区按类型浏览、收藏与分享：</p>"
                f'<p class="tags">{mat_links}</p></div>'
            )
    body = (
        _crumb([("题库", "/tiku/"), ("申论", None)])
        + f"<h1>申论真题库（{total} 题）</h1>"
        + "<p>历年公务员考试申论真题（概括、对策、公文、大作文等题型），附参考解析，可在 App 申论专区在线作答。</p>"
        + (f'<div class="card"><h2>按题型刷题</h2><div class="tags">{qtype_chips}</div></div>' if qtype_chips else "")
        + (f'<div class="card"><h2>覆盖年份</h2><div class="tags">{year_chips}</div></div>' if year_chips else "")
        + (f'<div class="card"><h2>覆盖地区</h2><div class="tags">{region_chips}</div></div>' if region_chips else "")
        + (f'<div class="card"><h2>按套卷刷题（含给定资料与解析）</h2><div class="tags">{paper_chips}</div></div>' if paper_chips else "")
        + '<div class="card"><ul class="qlist">'
        + _shenlun_q_items(items)
        + "</ul></div>"
        + mat_html
        + _pager("/tiku/shenlun/", page, total)
        + '<a class="cta" href="/#/pkgA/shenlun/shenlun">进入申论专区在线作答（真题 + 素材范文）→</a>'
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    return _page(
        f"申论真题库{suffix}_历年申论真题及参考解析_错题邦",
        f"申论真题库共 {total} 题，覆盖概括、对策、公文、大作文等题型，附参考解析，可在线作答。{mat_desc}{suffix}",
        "/tiku/shenlun/" + (f"?page={page}" if page > 1 else ""),
        body,
        _collection_ld(
            "申论真题库",
            f"申论真题库共 {total} 题，覆盖概括、对策、公文、大作文等题型，附参考解析。{mat_desc}",
            "/tiku/shenlun/",
            [("题库", "/tiku/"), ("申论", "/tiku/shenlun/")],
        ),
    )

