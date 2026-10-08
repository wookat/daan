"""模块/子题型兜底路由：必须最后注册，避免吞掉具体路径。"""
from urllib.parse import quote

from fastapi import HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from .. import db, taxonomy
from .common import (
    _EMPTY_MODULE_OUTLET,
    SITE_BASE,
    _collection_ld,
    _count_questions,
    _crumb,
    _e,
    _list_questions,
    _module_name,
    _not_found,
    _page,
    _pager,
    _q_items,
    _sub_path,
    _topic_path,
    _year_path,
    root_router,
    router,
)
from .shenlun import _render_shenlun_qtype, _tiku_shenlun


@router.get("/{module}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_module(module: str, page: int = 1):
    name = _module_name(module)
    if not name:
        return _not_found("模块不存在")
    page = max(1, page)
    if module == "shenlun":
        return _tiku_shenlun(page)
    total = _count_questions(module)
    if not total:
        outlet = _EMPTY_MODULE_OUTLET.get(module, "")
        return _not_found("该模块暂无题目", outlet)
    rows = _list_questions(module, None, page)
    if not rows and page > 1:
        return _not_found("页码超出范围")
    subs = db.submodule_counts(module)
    sub_links = "".join(
        f'<a href="{_e(_sub_path(module, s["submodule"]))}">{_e(s["submodule"])}（{s["n"]}）</a>' for s in subs
    )
    t3counts = db.tag3_counts()
    topic_links = "".join(
        f'<a href="{_e(_topic_path(t["code"]))}">{_e(t["name"])}（{t3counts[t["code"]]}）</a>'
        for m in taxonomy.tree()["modules"]
        if m["key"] == module
        for g in m["groups"]
        for t in g["topics"]
        if t3counts.get(t["code"])
    )
    year_links = "".join(
        f'<a href="{_e(_year_path(y, module))}">{y}年（{n}）</a>'
        for (y, mk), (n, _mu) in sorted(db.year_module_counts().items(), reverse=True)
        if mk == module
    )
    body = (
        _crumb([("题库", "/tiku/"), (name, None)])
        + f"<h1>{_e(name)}题库（{total} 题）</h1>"
        + (f'<div class="card"><h2>按题型刷题</h2><div class="tags">{sub_links}</div></div>' if sub_links else "")
        + (f'<div class="card"><h2>按考点刷题</h2><div class="tags">{topic_links}</div></div>' if topic_links else "")
        + (f'<div class="card"><h2>按年份刷真题</h2><div class="tags">{year_links}</div></div>' if year_links else "")
        + '<div class="card">'
        + _q_items(rows)
        + "</div>"
        + _pager(f"/tiku/{module}/", page, total)
        + f'<a class="cta" href="{_e(SITE_BASE)}/">进入主站刷{_e(name)} →</a>'
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    return _page(
        f"{name}题库{suffix}_行测{name}真题及答案解析_答岸",
        f"{name}题库共 {total} 题（含历年真题），按题型分类，附答案与花生十三方法解析，支持在线刷题。{suffix}",
        f"/tiku/{module}/" + (f"?page={page}" if page > 1 else ""),
        body,
        _collection_ld(
            f"{name}题库",
            f"{name}题库共 {total} 题（含历年真题），按题型分类，附答案与解析。",
            f"/tiku/{module}/",
            [("题库", "/tiku/"), (name, f"/tiku/{module}/")],
        ),
    )


@router.get("/{module}/{submodule}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_submodule(module: str, submodule: str, page: int = 1):
    name = _module_name(module)
    if not name:
        return _not_found("模块不存在")
    page = max(1, page)
    if module == "shenlun":
        try:
            return HTMLResponse(_render_shenlun_qtype(submodule, page))
        except HTTPException as e:
            return _not_found(e.detail)
    total = _count_questions(module, submodule)
    if not total:
        return _not_found("题型不存在")
    rows = _list_questions(module, submodule, page)
    if not rows and page > 1:
        return _not_found("页码超出范围")
    body = (
        _crumb([("题库", "/tiku/"), (name, f"/tiku/{module}/"), (submodule, None)])
        + f"<h1>{_e(name)}·{_e(submodule)}题库（{total} 题）</h1>"
        + '<div class="card">'
        + _q_items(rows)
        + "</div>"
        + _pager(_sub_path(module, submodule), page, total)
        + f'<a class="cta" href="{_e(SITE_BASE)}/">进入主站刷{_e(submodule)} →</a>'
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    return _page(
        f"{submodule}题库{suffix}_{name}{submodule}真题及答案解析_答岸",
        f"{name}{submodule}专项题库共 {total} 题（含历年真题），附答案与解析，在线刷题提升正确率。{suffix}",
        _sub_path(module, submodule) + (f"?page={page}" if page > 1 else ""),
        body,
        _collection_ld(
            f"{name}·{submodule}题库",
            f"{name}{submodule}专项题库共 {total} 题（含历年真题），附答案与解析。",
            _sub_path(module, submodule),
            [("题库", "/tiku/"), (name, f"/tiku/{module}/"), (submodule, _sub_path(module, submodule))],
        ),
    )


@root_router.get("/tiku", include_in_schema=False)
def tiku_index_noslash():
    return RedirectResponse("/tiku/", status_code=301)


@router.get("/{module}", include_in_schema=False)
def tiku_module_noslash(module: str):
    if not _module_name(module):
        return _not_found("模块不存在")
    return RedirectResponse(f"/tiku/{quote(module)}/", status_code=301)


@router.get("/{module}/{submodule}", include_in_schema=False)
def tiku_submodule_noslash(module: str, submodule: str):
    if not _module_name(module):
        return _not_found("模块不存在")
    if module == "shenlun" and not dict(db.shenlun_qtype_counts()).get(submodule):
        return _not_found("题型不存在")
    return RedirectResponse(_sub_path(module, submodule), status_code=301)


# ---------- sitemap / robots ----------
