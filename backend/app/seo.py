"""SEO 题库落地页：服务端渲染 HTML（/tiku/*）+ sitemap/robots，承接搜索长尾流量导流主站。"""
import html
import json
import math
import os
import time
from functools import lru_cache
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from fastapi.responses import (
    HTMLResponse,
    PlainTextResponse,
    RedirectResponse,
    Response,
)

from . import db, kb, taxonomy

SITE_BASE = os.environ.get("SITE_BASE_URL", "https://kaogong.zalize.com").rstrip("/")
INDEXNOW_KEY = os.environ.get("INDEXNOW_KEY", "")
PAGE_SIZE = 50
SITEMAP_SHARD = 10000
BRAND = "#2E5BFF"

router = APIRouter(prefix="/tiku")
root_router = APIRouter()


def _e(s) -> str:
    return html.escape(str(s or ""))


def _url(path: str) -> str:
    return SITE_BASE + path


def _sub_path(module: str, submodule: str) -> str:
    return f"/tiku/{quote(module)}/{quote(submodule)}/"


def _topic_path(code: str) -> str:
    return f"/tiku/t/{quote(code)}/"


def _year_path(year: int, module: str) -> str:
    return f"/tiku/y/{year}/{quote(module)}/"


_CSS = (
    "*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',"
    "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#1f2329;background:#f7f8fa;"
    "line-height:1.7;font-size:16px}a{color:" + BRAND + ";text-decoration:none}a:hover{text-decoration:underline}"
    ".wrap{max-width:860px;margin:0 auto;padding:16px}"
    ".hdr{background:" + BRAND + ";color:#fff;padding:14px 0}.hdr a{color:#fff;font-weight:600;font-size:18px}"
    ".hdr .wrap{padding-top:0;padding-bottom:0}"
    ".card{background:#fff;border-radius:10px;padding:16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.06)}"
    ".crumb{font-size:13px;color:#666;margin:10px 0}.crumb a{color:#666}"
    "h1{font-size:22px;margin:10px 0}h2{font-size:17px;margin:8px 0}"
    ".qlist{list-style:none;padding:0;margin:0}.qlist li{border-bottom:1px solid #eee;padding:10px 0}"
    ".qlist li:last-child{border-bottom:none}"
    ".tags{display:flex;flex-wrap:wrap;gap:8px}.tags a{background:#eef3ff;border-radius:16px;padding:4px 12px;"
    "font-size:14px;white-space:nowrap}"
    ".meta{color:#8a919f;font-size:13px}"
    ".opt{margin:6px 0;padding:8px 12px;border:1px solid #e5e8ef;border-radius:8px}"
    ".ans{background:#f0f7f0;border-radius:8px;padding:12px;margin-top:10px}"
    ".cta{display:inline-block;background:" + BRAND + ";color:#fff!important;border-radius:8px;"
    "padding:10px 22px;font-weight:600;margin:14px 0}"
    ".pager{display:flex;gap:12px;justify-content:center;margin:16px 0}.pager a,.pager span{padding:6px 14px;"
    "background:#fff;border-radius:8px;border:1px solid #e5e8ef}"
    ".ftr{color:#8a919f;font-size:13px;text-align:center;padding:20px 0}"
    "details summary{cursor:pointer;font-weight:600}"
    "@media(max-width:480px){.wrap{padding:12px}h1{font-size:19px}}"
)


def _page(title: str, description: str, canonical_path: str, body: str, jsonld: dict | None = None) -> str:
    ld = (
        '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
        if jsonld
        else ""
    )
    return (
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{_e(title)}</title>"
        f'<meta name="description" content="{_e(description)}">'
        f'<link rel="canonical" href="{_e(_url(canonical_path))}">'
        f"<style>{_CSS}</style>{ld}</head><body>"
        f'<header class="hdr"><div class="wrap"><a href="/tiku/">考公题库</a></div></header>'
        f'<main class="wrap">{body}</main>'
        f'<footer class="ftr"><a href="{_e(SITE_BASE)}/">错题邦</a> · 13万+行测真题在线刷题'
        f' · <a href="/tiku/papers/">真题卷</a>'
        f' · <a href="https://career.zalize.com/privacy/">隐私政策</a>'
        f' · <a href="https://career.zalize.com/terms/">服务条款</a>'
        f' · <a href="mailto:support@zalize.com">联系我们</a></footer></body></html>'
    )


def _crumb(items: list[tuple[str, str | None]]) -> str:
    parts = []
    for name, href in items:
        parts.append(f'<a href="{_e(href)}">{_e(name)}</a>' if href else _e(name))
    return '<nav class="crumb">' + " › ".join(parts) + "</nav>"


def _pager(base_path: str, page: int, total: int) -> str:
    pages = max(1, math.ceil(total / PAGE_SIZE))
    out = []
    if page > 2:
        out.append(f'<a href="{_e(base_path)}">首页</a>')
    if page > 1:
        out.append(f'<a href="{_e(base_path)}?page={page - 1}" rel="prev">上一页</a>')
    out.append(f"<span>{page} / {pages}</span>")
    if page < pages:
        out.append(f'<a href="{_e(base_path)}?page={page + 1}" rel="next">下一页</a>')
    if page < pages - 1:
        out.append(f'<a href="{_e(base_path)}?page={pages}">末页</a>')
    return '<div class="pager">' + "".join(out) + "</div>"


def _q_items(rows) -> str:
    lis = []
    for r in rows:
        text = (r["question"] or "").strip().replace("\n", " ")
        if len(text) > 80:
            text = text[:80] + "…"
        tag = "真题" if r["is_real"] else "练习"
        yr = f'{r["exam_year"]}年' if r["exam_year"] else ""
        lis.append(
            f'<li><a href="/tiku/q/{r["id"]}">{_e(text)}</a>'
            f'<div class="meta">{_e(yr)}{_e(r["exam_region"] or "")}{_e(tag)} · {_e(r["submodule"] or "")}</div></li>'
        )
    return '<ul class="qlist">' + "".join(lis) + "</ul>"


def _module_name(module: str) -> str | None:
    m = kb.MODULES.get(module)
    return m["name"] if m else None


def _count_questions(module: str, submodule: str | None = None) -> int:
    conn = db.get_conn()
    if submodule:
        n = conn.execute(
            "SELECT COUNT(*) FROM questions WHERE module=? AND submodule=? AND disabled=0",
            (module, submodule),
        ).fetchone()[0]
    else:
        n = conn.execute(
            "SELECT COUNT(*) FROM questions WHERE module=? AND disabled=0",
            (module,),
        ).fetchone()[0]
    conn.close()
    return n


def _list_questions(module: str, submodule: str | None, page: int) -> list:
    conn = db.get_conn()
    cond = "module=? AND disabled=0"
    args: list = [module]
    if submodule:
        cond += " AND submodule=?"
        args.append(submodule)
    rows = conn.execute(
        f"SELECT id, question, submodule, is_real, exam_year, exam_region FROM questions "
        f"WHERE {cond} ORDER BY id LIMIT ? OFFSET ?",
        args + [PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ).fetchall()
    conn.close()
    return rows


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
def tiku_index():
    counts = {r["module"]: r["n"] for r in db.question_counts()}
    t3counts = db.tag3_counts()
    ycounts = db.year_module_counts()
    sections = []
    for m in taxonomy.tree()["modules"]:
        key, name = m["key"], m["name"]
        if not counts.get(key):
            continue
        subs = db.submodule_counts(key)
        sub_links = "".join(
            f'<a href="{_e(_sub_path(key, s["submodule"]))}">{_e(s["submodule"])}（{s["n"]}）</a>'
            for s in subs
        )
        topic_links = []
        for g in m["groups"]:
            for t in g["topics"]:
                if t3counts.get(t["code"]):
                    topic_links.append(
                        f'<a href="{_e(_topic_path(t["code"]))}">{_e(t["name"])}</a>'
                    )
        topics = "".join(topic_links[:12])
        years = "".join(
            f'<a href="{_e(_year_path(y, key))}">{y}年（{n}）</a>'
            for (y, m), (n, _mu) in sorted(ycounts.items(), reverse=True)
            if m == key
        )
        sections.append(
            f'<section class="card"><h2><a href="/tiku/{_e(key)}/">{_e(name)}</a>'
            f'<span class="meta">（{counts[key]} 题）</span></h2>'
            f'<div class="tags">{sub_links}</div>'
            + (f'<p class="meta">按考点刷题：</p><div class="tags">{topics}</div>' if topics else "")
            + (f'<p class="meta">按年份刷真题：</p><div class="tags">{years}</div>' if years else "")
            + "</section>"
        )
    total = sum(counts.values())
    body = (
        "<h1>公务员考试题库</h1>"
        f"<p>收录 {total} 道行测/申论题目（含历年真题），按模块、题型、考点分类，可在线刷题并查看花生十三方法讲解。</p>"
        + "".join(sections)
        + f'<a class="cta" href="{_e(SITE_BASE)}/">进入刷题主站 →</a>'
    )
    return _page(
        "公务员考试题库_行测真题在线刷题_错题邦",
        f"免费公务员考试题库，收录 {total} 道行测申论题目与历年真题，覆盖资料分析、数量关系、言语理解、判断推理、常识判断，附答案解析。",
        "/tiku/",
        body,
    )


@router.get("/papers", include_in_schema=False)
def tiku_papers_noslash():
    return RedirectResponse("/tiku/papers/", status_code=301)


@router.get("/papers/", response_class=HTMLResponse, include_in_schema=False)
def tiku_papers():
    papers = db.list_exam_papers(kind="zhenti")
    lis = "".join(
        f'<li><a href="/tiku/papers/{p["id"]}">{_e(p["title"])}</a>'
        f'<div class="meta">{_e(p["year"] or "")} {_e(p["region"] or "")} · {p["n"]} 题'
        f'{" · 限时 " + str(p["duration_min"]) + " 分钟" if p["duration_min"] else ""}</div></li>'
        for p in papers
    )
    body = (
        _crumb([("题库", "/tiku/"), ("真题卷", None)])
        + f"<h1>历年公务员考试真题卷（{len(papers)} 套）</h1>"
        + '<div class="card"><ul class="qlist">'
        + lis
        + "</ul></div>"
        + f'<a class="cta" href="{_e(SITE_BASE)}/">进入主站全真模考 →</a>'
    )
    return _page(
        "历年公务员考试真题卷_国考省考真题在线模考_错题邦",
        f"{len(papers)} 套历年国考/省考行测真题卷，在线全真模考并生成成绩报告，附逐题答案解析。",
        "/tiku/papers/",
        body,
    )


@router.get("/papers/{pid}", response_class=HTMLResponse, include_in_schema=False)
def tiku_paper_detail(pid: int):
    p = db.get_exam_paper(pid)
    if not p or p.get("kind") != "zhenti":
        raise HTTPException(404, "试卷不存在")
    qids = p["question_ids"]
    rows = []
    if qids:
        conn = db.get_conn()
        placeholders = ",".join("?" * len(qids))
        got = {
            r["id"]: r
            for r in conn.execute(
                f"SELECT id, question, module, submodule, is_real, exam_year, exam_region FROM questions "
                f"WHERE id IN ({placeholders}) AND disabled=0",
                qids,
            )
        }
        conn.close()
        rows = [got[i] for i in qids if i in got]
    title = p["title"]
    mod_dist: dict[str, int] = {}
    for r in rows:
        if _module_name(r["module"]):
            mod_dist[r["module"]] = mod_dist.get(r["module"], 0) + 1
    dist_links = "".join(
        f'<a href="/tiku/{quote(m)}/">{_e(_module_name(m))} {n} 题</a>'
        for m, n in sorted(mod_dist.items(), key=lambda kv: -kv[1])
    )
    dist_text = "、".join(
        f"{_module_name(m)}{n}题" for m, n in sorted(mod_dist.items(), key=lambda kv: -kv[1])
    )
    siblings = [
        sp for sp in db.list_exam_papers(kind="zhenti", year=p["year"]) if sp["id"] != pid
    ][:10] if p["year"] else []
    sib_links = "".join(
        f'<a href="/tiku/papers/{sp["id"]}">{_e(sp["title"])}</a>' for sp in siblings
    )
    year_links = "".join(
        f'<a href="{_e(_year_path(p["year"], m))}">{p["year"]}年{_e(_module_name(m))}真题</a>'
        for m in mod_dist
        if db.year_module_counts().get((p["year"], m))
    ) if p["year"] else ""
    body = (
        _crumb([("题库", "/tiku/"), ("真题卷", "/tiku/papers/"), (title, None)])
        + f"<h1>{_e(title)}</h1>"
        + f'<p class="meta">{_e(p["year"] or "")} {_e(p["region"] or "")} · 共 {len(rows)} 题'
        + (f' · 限时 {p["duration_min"]} 分钟' if p["duration_min"] else "")
        + "</p>"
        + (f'<div class="card"><h2>模块分布</h2><div class="tags">{dist_links}</div></div>' if dist_links else "")
        + f'<a class="cta" href="{_e(SITE_BASE)}/#/pkgA/exam/list">在线模考本卷 →</a>'
        + '<div class="card">'
        + _q_items(rows)
        + "</div>"
        + (f'<div class="card"><h2>按模块刷{p["year"]}年真题</h2><div class="tags">{year_links}</div></div>' if year_links else "")
        + (f'<div class="card"><h2>{p["year"]}年其他真题卷</h2><div class="tags">{sib_links}</div></div>' if sib_links else "")
    )
    jsonld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": title,
        "description": f"{title}，共 {len(rows)} 题，在线全真模考并查看逐题答案解析。",
        "url": _url(f"/tiku/papers/{pid}"),
        "isPartOf": {"@type": "WebSite", "name": "错题邦", "url": SITE_BASE},
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "题库", "item": _url("/tiku/")},
                {"@type": "ListItem", "position": 2, "name": "真题卷", "item": _url("/tiku/papers/")},
                {"@type": "ListItem", "position": 3, "name": title, "item": _url(f"/tiku/papers/{pid}")},
            ],
        },
    }
    return _page(
        f"{title}_真题卷在线模考_错题邦",
        f"{title}，共 {len(rows)} 题（{dist_text}），在线全真模考并生成成绩报告，附逐题答案解析。" if dist_text
        else f"{title}，共 {len(rows)} 题，在线全真模考并查看逐题答案解析。",
        f"/tiku/papers/{pid}",
        body,
        jsonld,
    )


@router.get("/q/{qid}", response_class=HTMLResponse, include_in_schema=False)
def tiku_question(qid: int):
    return HTMLResponse(_render_question(qid))


@router.get("/y/{year}/{module}", include_in_schema=False)
def tiku_year_noslash(year: int, module: str):
    return RedirectResponse(_year_path(year, module), status_code=301)


@router.get("/y/{year}/{module}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_year(year: int, module: str, page: int = 1):
    return HTMLResponse(_render_year(year, module, max(1, page)))


@lru_cache(maxsize=512)
def _render_year(year: int, module: str, page: int) -> str:
    mod_name = _module_name(module)
    total = db.year_module_counts().get((year, module), (0, None))[0]
    if not mod_name or not total:
        raise HTTPException(404, "页面不存在")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, question, submodule, is_real, exam_year, exam_region FROM questions "
        "WHERE module=? AND is_real=1 AND exam_year=? AND disabled=0 ORDER BY id DESC LIMIT ? OFFSET ?",
        (module, year, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    conn.close()
    if not rows and page > 1:
        raise HTTPException(404, "页码超出范围")
    counts = db.year_module_counts()
    other_years = "".join(
        f'<a href="{_e(_year_path(y, module))}">{y}年（{n}）</a>'
        for (y, m), (n, _mu) in sorted(counts.items(), reverse=True)
        if m == module and y != year
    )
    cta = (
        f'<a class="cta" href="{_e(SITE_BASE)}/#/pages/practice/practice?module={quote(module)}'
        f'&real=1&year={year}&source=seo">在线刷{year}年{_e(mod_name)}真题（免费）→</a>'
    )
    body = (
        _crumb([("题库", "/tiku/"), (mod_name, f"/tiku/{module}/"), (f"{year}年真题", None)])
        + f"<h1>{year}年{_e(mod_name)}真题题库（{total} 题）</h1>"
        + f'<p class="meta">{year}年国考/省考{_e(mod_name)}模块历年真题，附答案解析与方法讲解</p>'
        + cta
        + '<div class="card">'
        + _q_items(rows)
        + "</div>"
        + _pager(_year_path(year, module), page, total)
        + (f'<div class="card"><h2>其他年份{_e(mod_name)}真题</h2><div class="tags">{other_years}</div></div>' if other_years else "")
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    jsonld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{year}年{mod_name}真题题库",
        "description": f"{year}年公务员考试{mod_name}模块真题 {total} 题，附答案解析。",
        "url": _url(_year_path(year, module)),
        "isPartOf": {"@type": "WebSite", "name": "错题邦", "url": SITE_BASE},
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "题库", "item": _url("/tiku/")},
                {"@type": "ListItem", "position": 2, "name": mod_name, "item": _url(f"/tiku/{module}/")},
                {"@type": "ListItem", "position": 3, "name": f"{year}年真题", "item": _url(_year_path(year, module))},
            ],
        },
    }
    return _page(
        f"{year}年{mod_name}真题题库{suffix}_{year}年公务员考试{mod_name}真题及答案解析_错题邦",
        f"{year}年公务员考试{mod_name}模块真题共 {total} 题，附答案与花生十三方法讲解，可在线按年份刷真题。{suffix}",
        _year_path(year, module) + (f"?page={page}" if page > 1 else ""),
        body,
        jsonld,
    )


@router.get("/t/{code}", include_in_schema=False)
def tiku_topic_noslash(code: str):
    return RedirectResponse(_topic_path(code), status_code=301)


@router.get("/t/{code}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_topic(code: str, page: int = 1):
    return HTMLResponse(_render_topic(code, max(1, page)))


def _sibling_topics(code: str, topic: dict) -> str:
    counts = db.tag3_counts()
    links = "".join(
        f'<a href="{_e(_topic_path(c))}">{_e(t["name"])}（{counts[c]}）</a>'
        for c, t in taxonomy.topic_index().items()
        if t["group_code"] == topic["group_code"] and c != code and counts.get(c)
    )
    if not links:
        return ""
    return f'<div class="card"><h2>同类考点（{_e(topic["group_name"])}）</h2><div class="tags">{links}</div></div>'


@lru_cache(maxsize=1024)
def _render_topic(code: str, page: int) -> str:
    topic = taxonomy.topic_index().get(code)
    total = db.tag3_counts().get(code, 0)
    if not topic or not total:
        raise HTTPException(404, "考点不存在")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, question, submodule, is_real, exam_year, exam_region FROM questions "
        "WHERE tag3=? AND disabled=0 ORDER BY id DESC LIMIT ? OFFSET ?",
        (code, PAGE_SIZE, (page - 1) * PAGE_SIZE),
    ).fetchall()
    conn.close()
    if not rows and page > 1:
        raise HTTPException(404, "页码超出范围")
    name = topic["name"]
    mod_key, mod_name = topic["module"], topic["module_name"]
    intro = "".join(
        filter(
            None,
            [
                f'<p>{_e(topic["desc"])}</p>' if topic["desc"] else "",
                f'<p><b>方法要点：</b>{_e(topic["usage"])}</p>' if topic["usage"] else "",
            ],
        )
    )
    cta = (
        f'<a class="cta" href="{_e(SITE_BASE)}/#/pages/practice/practice?tag3={quote(code)}'
        f'&module={quote(mod_key)}&source=seo">在线练习「{_e(name)}」（免费）→</a>'
    )
    body = (
        _crumb([("题库", "/tiku/"), (mod_name, f"/tiku/{mod_key}/"), (name, None)])
        + f"<h1>{_e(name)}考点题库（{total} 题）</h1>"
        + f'<p class="meta">{_e(mod_name)} · {_e(topic["group_name"])} · 考点代码 {_e(code)}</p>'
        + (f'<div class="card"><h2>考点介绍</h2>{intro}</div>' if intro else "")
        + cta
        + '<div class="card">'
        + _q_items(rows)
        + "</div>"
        + _pager(_topic_path(code), page, total)
        + _sibling_topics(code, topic)
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    jsonld = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": f"{name}考点题库",
        "description": (topic["desc"] or f"{mod_name}{name}考点真题练习")[:200],
        "url": _url(_topic_path(code)),
        "isPartOf": {"@type": "WebSite", "name": "错题邦", "url": SITE_BASE},
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "题库", "item": _url("/tiku/")},
                {"@type": "ListItem", "position": 2, "name": mod_name, "item": _url(f"/tiku/{mod_key}/")},
                {"@type": "ListItem", "position": 3, "name": name, "item": _url(_topic_path(code))},
            ],
        },
    }
    return _page(
        f"{name}考点题库{suffix}_{mod_name}{name}真题及解题方法_错题邦",
        f"{name}考点专项题库共 {total} 题：{(topic['desc'] or '')[:60]}附答案解析与花生十三方法讲解，可在线按考点刷题。{suffix}",
        _topic_path(code) + (f"?page={page}" if page > 1 else ""),
        body,
        jsonld,
    )


@lru_cache(maxsize=4096)
def _render_question(qid: int) -> str:
    conn = db.get_conn()
    r = conn.execute(
        "SELECT id, module, submodule, tag3, question, options, answer, explanation, hs_explanation, "
        "is_real, exam_year, exam_region, image, image_credit FROM questions WHERE id=? AND disabled=0",
        (qid,),
    ).fetchone()
    if not r:
        conn.close()
        raise HTTPException(404, "题目不存在")
    similar = []
    if r["tag3"]:
        similar = conn.execute(
            "SELECT id, question FROM questions WHERE tag3=? AND id!=? AND disabled=0 "
            "ORDER BY id DESC LIMIT 8",
            (r["tag3"], qid),
        ).fetchall()
    if len(similar) < 8:
        have = [qid] + [s["id"] for s in similar]
        placeholders = ",".join("?" * len(have))
        similar += conn.execute(
            f"SELECT id, question FROM questions WHERE module=? AND submodule IS ? AND id NOT IN ({placeholders}) "
            f"AND disabled=0 ORDER BY id DESC LIMIT ?",
            [r["module"], r["submodule"], *have, 8 - len(similar)],
        ).fetchall()
    conn.close()

    mod_name = _module_name(r["module"]) or r["module"] or ""
    topic = taxonomy.topic_index().get(r["tag3"] or "")
    qtext = (r["question"] or "").strip()
    try:
        options = json.loads(r["options"] or "{}")
    except ValueError:
        options = {}
    img_html = ""
    if r["image"]:
        img_src = r["image"] if r["image"].startswith("http") else _url(r["image"])
        img_alt = _e(qtext[:40]) or "题目配图"
        img_html = f'<img src="{_e(img_src)}" alt="{img_alt}" style="max-width:100%;border-radius:8px" loading="lazy">'
        if r["image_credit"]:
            credit = _e(r["image_credit"])
            img_html += f'<p class="meta">图源：{credit}</p>'
    opts_html = "".join(
        f'<div class="opt"><b>{_e(k)}.</b> {_e(v)}</div>' for k, v in sorted(options.items())
    )
    hs = (r["hs_explanation"] or "").strip()
    raw_exp = (r["explanation"] or "").strip()
    explanation = hs or raw_exp
    hs_html = _e(hs).replace("\n", "<br>")
    raw_html = _e(raw_exp).replace("\n", "<br>")
    if hs and raw_exp:
        exp_html = f"<p><b>花生十三讲解</b></p><p>{hs_html}</p><p><b>原解析</b></p><p>{raw_html}</p>"
    else:
        exp_html = f"<p>{hs_html or raw_html or '暂无解析'}</p>"
    src = " ".join(filter(None, [f'{r["exam_year"]}年' if r["exam_year"] else "", r["exam_region"] or "", "真题" if r["is_real"] else "练习题"]))
    sim_html = "".join(
        f'<li><a href="/tiku/q/{s["id"]}">{_e((s["question"] or "").strip().replace(chr(10), " ")[:60])}…</a></li>'
        for s in similar
    )
    crumbs = [("题库", "/tiku/"), (mod_name, f'/tiku/{r["module"]}/')]
    topic_link = (
        f' · <a href="{_e(_topic_path(r["tag3"]))}">{_e(topic["name"])}</a>' if topic else ""
    )
    if r["submodule"]:
        crumbs.append((r["submodule"], _sub_path(r["module"], r["submodule"])))
    crumbs.append((f"题目 #{qid}", None))
    body = (
        _crumb(crumbs)
        + f'<article class="card"><h1>{_e(qtext[:40])}{"…" if len(qtext) > 40 else ""}</h1>'
        + f'<p class="meta">{_e(mod_name)}{" · " + _e(r["submodule"]) if r["submodule"] else ""}'
        + topic_link
        + f" · {_e(src)}</p>"
        + f"<p>{_e(qtext)}</p>"
        + img_html
        + opts_html
        + '<details open class="ans"><summary>答案与解析</summary>'
        + f'<p><b>正确答案：{_e(r["answer"] or "见解析")}</b></p>{exp_html}</details>'
        + (
            f'<a class="cta" href="{_e(SITE_BASE)}/#/pages/practice/practice?tag3={quote(r["tag3"])}'
            f'{"&module=" + quote(r["module"]) if r["module"] else ""}&source=seo">在线练习此考点（免费）→</a>'
            if r["tag3"]
            else f'<a class="cta" href="{_e(SITE_BASE)}/">继续刷题（免费题库+AI 讲解）→</a>'
        )
        + (
            f'<p><a href="{_e(_topic_path(r["tag3"]))}">← 返回「{_e(topic["name"])}」考点题目列表</a></p>'
            if topic
            else ""
        )
        + "</article>"
        + (
            f'<section class="card"><h2>同考点相似题</h2><ul class="qlist">{sim_html}</ul>'
            + (
                f'<p><a href="{_e(_topic_path(r["tag3"]))}">查看「{_e(topic["name"])}」考点全部题目 →</a></p>'
                if topic
                else ""
            )
            + "</section>"
            if sim_html
            else ""
        )
    )
    title_head = qtext.replace("\n", " ")[:50]
    jsonld = {
        "@context": "https://schema.org",
        "@type": "QAPage",
        "mainEntity": {
            "@type": "Question",
            "name": title_head,
            "text": qtext,
            "answerCount": 1,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": f'正确答案：{r["answer"] or ""}。{explanation[:500]}',
                "url": _url(f"/tiku/q/{qid}"),
            },
        },
    }
    return _page(
        f"{title_head}_{mod_name}题库_错题邦",
        f"{mod_name}{('·' + r['submodule']) if r['submodule'] else ''}{src}：{qtext[:70]} 附答案与解析，在线刷同考点题目。",
        f"/tiku/q/{qid}",
        body,
        jsonld,
    )


@router.get("/{module}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_module(module: str, page: int = 1):
    name = _module_name(module)
    if not name:
        raise HTTPException(404, "模块不存在")
    page = max(1, page)
    total = _count_questions(module)
    rows = _list_questions(module, None, page)
    if not rows and page > 1:
        raise HTTPException(404, "页码超出范围")
    subs = db.submodule_counts(module)
    sub_links = "".join(
        f'<a href="{_e(_sub_path(module, s["submodule"]))}">{_e(s["submodule"])}（{s["n"]}）</a>' for s in subs
    )
    body = (
        _crumb([("题库", "/tiku/"), (name, None)])
        + f"<h1>{_e(name)}题库（{total} 题）</h1>"
        + (f'<div class="card"><h2>按题型刷题</h2><div class="tags">{sub_links}</div></div>' if sub_links else "")
        + '<div class="card">'
        + _q_items(rows)
        + "</div>"
        + _pager(f"/tiku/{module}/", page, total)
        + f'<a class="cta" href="{_e(SITE_BASE)}/">进入主站刷{_e(name)} →</a>'
    )
    suffix = f"（第{page}页）" if page > 1 else ""
    return _page(
        f"{name}题库{suffix}_行测{name}真题及答案解析_错题邦",
        f"{name}题库共 {total} 题（含历年真题），按题型分类，附答案与花生十三方法解析，支持在线刷题。{suffix}",
        f"/tiku/{module}/" + (f"?page={page}" if page > 1 else ""),
        body,
    )


@router.get("/{module}/{submodule}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_submodule(module: str, submodule: str, page: int = 1):
    name = _module_name(module)
    if not name:
        raise HTTPException(404, "模块不存在")
    page = max(1, page)
    total = _count_questions(module, submodule)
    if not total:
        raise HTTPException(404, "题型不存在")
    rows = _list_questions(module, submodule, page)
    if not rows and page > 1:
        raise HTTPException(404, "页码超出范围")
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
        f"{submodule}题库{suffix}_{name}{submodule}真题及答案解析_错题邦",
        f"{name}{submodule}专项题库共 {total} 题（含历年真题），附答案与解析，在线刷题提升正确率。{suffix}",
        _sub_path(module, submodule) + (f"?page={page}" if page > 1 else ""),
        body,
    )


# ---------- sitemap / robots ----------


def _question_ids() -> list[int]:
    conn = db.get_conn()
    ids = [r["id"] for r in conn.execute(
        "SELECT id FROM questions WHERE disabled=0 ORDER BY id"
    )]
    conn.close()
    return ids


def _lastmod(ts: float | str | None) -> str:
    if not ts:
        return ""
    if isinstance(ts, str):
        # 历史数据存在 ISO8601 文本（如 2026-08-09T18:23:19Z），取日期部分
        return "<lastmod>" + ts[:10] + "</lastmod>" if len(ts) >= 10 else ""
    return "<lastmod>" + time.strftime("%Y-%m-%d", time.gmtime(ts)) + "</lastmod>"


def _urlset(urls: list[tuple[str, float | None]]) -> Response:
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(f"<url><loc>{_e(u)}</loc>{_lastmod(ts)}</url>" for u, ts in urls)
        + "</urlset>"
    )
    return Response(content=body, media_type="application/xml")


@root_router.get("/sitemap.xml", include_in_schema=False)
def sitemap_index():
    n_shards = max(1, math.ceil(len(_question_ids()) / SITEMAP_SHARD))
    maps = (
        [_url("/sitemap-pages.xml"), _url("/sitemap-topics.xml"), _url("/sitemap-years.xml")]
        + [_url(f"/sitemap-questions-{i}.xml") for i in range(1, n_shards + 1)]
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(f"<sitemap><loc>{_e(u)}</loc></sitemap>" for u in maps)
        + "</sitemapindex>"
    )
    return Response(content=body, media_type="application/xml")


@root_router.get("/sitemap-pages.xml", include_in_schema=False)
def sitemap_pages():
    urls = [(_url("/tiku/"), None), (_url("/tiku/papers/"), None)]
    for r in db.question_counts():
        if not _module_name(r["module"]):
            continue
        urls.append((_url(f'/tiku/{quote(r["module"])}/'), None))
        for s in db.submodule_counts(r["module"]):
            urls.append((_url(_sub_path(r["module"], s["submodule"])), None))
    urls += [(_url(f'/tiku/papers/{p["id"]}'), p["created_at"]) for p in db.list_exam_papers(kind="zhenti")]
    return _urlset(urls)


@root_router.get("/sitemap-topics.xml", include_in_schema=False)
def sitemap_topics():
    counts = db.tag3_counts()
    lastmod = db.tag3_lastmod()
    urls = [
        (_url(_topic_path(code)), lastmod.get(code))
        for code in taxonomy.topic_index()
        if counts.get(code)
    ]
    return _urlset(urls)


@root_router.get("/sitemap-years.xml", include_in_schema=False)
def sitemap_years():
    urls = [
        (_url(_year_path(y, m)), mu)
        for (y, m), (n, mu) in sorted(db.year_module_counts().items(), reverse=True)
        if n and _module_name(m)
    ]
    return _urlset(urls)


@root_router.get("/sitemap-questions-{shard}.xml", include_in_schema=False)
def sitemap_questions(shard: int):
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, updated_at FROM questions WHERE disabled=0 ORDER BY id"
    ).fetchall()
    conn.close()
    lo = (shard - 1) * SITEMAP_SHARD
    if shard < 1 or lo >= len(rows):
        raise HTTPException(404, "分片不存在")
    return _urlset([
        (_url(f'/tiku/q/{r["id"]}'), r["updated_at"]) for r in rows[lo : lo + SITEMAP_SHARD]
    ])


@root_router.get("/indexnow-key.txt", include_in_schema=False)
def indexnow_key():
    if not INDEXNOW_KEY:
        raise HTTPException(404, "未配置")
    return PlainTextResponse(INDEXNOW_KEY)


@root_router.get("/s/{sid}", response_class=HTMLResponse, include_in_schema=False)
def share_landing(sid: str):
    """分享落地页：服务端输出动态 OG（题干摘要作 og:description）后跳转 SPA 分享页。

    社交爬虫（微信/QQ/微博/Telegram 等）抓 head 里的 OG；真实用户被 JS 立即带去
    /#/pkgA/share/share-q。不含答案/解析，noindex 避免瘦内容进索引。
    """
    sid = sid.strip()[:16]
    conn = db.get_conn()
    try:
        s = conn.execute(
            "SELECT question_id, from_name FROM shared_questions WHERE sid=?", (sid,)
        ).fetchone()
        q = conn.execute(
            "SELECT question, module FROM questions WHERE id=? AND disabled=0", (s["question_id"],)
        ).fetchone() if s else None
    except db.sqlite3.OperationalError:
        s = q = None
    finally:
        conn.close()
    if not s or not q:
        return RedirectResponse(SITE_BASE + "/", status_code=302)
    mod = _module_name(q["module"]) or "行测"
    summary = " ".join((q["question"] or "").split())
    if len(summary) > 90:
        summary = summary[:90] + "…"
    from_name = (s["from_name"] or "考友").strip()[:20]
    title = f"{from_name}分享了一道{mod}题，敢来挑战吗？"
    spa = f"/#/pkgA/share/share-q?sid={quote(sid)}"
    page_url = _url(f"/s/{quote(sid)}")
    return HTMLResponse(
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex">'
        f"<title>{_e(title)}</title>"
        f'<meta name="description" content="{_e(summary)}">'
        f'<meta property="og:type" content="website">'
        f'<meta property="og:site_name" content="错题邦">'
        f'<meta property="og:title" content="{_e(title)}">'
        f'<meta property="og:description" content="{_e(summary)}">'
        f'<meta property="og:url" content="{_e(page_url)}">'
        f'<meta name="twitter:card" content="summary">'
        f'<meta name="twitter:title" content="{_e(title)}">'
        f'<meta name="twitter:description" content="{_e(summary)}">'
        f'<meta http-equiv="refresh" content="0;url={_e(spa)}">'
        f'<script>location.replace("{spa}"+location.search.replace("?","&"))</script>'
        f"</head><body><p>正在打开分享题目… "
        f'<a href="{_e(spa)}">点此继续</a></p></body></html>'
    )


@root_router.get("/robots.txt", include_in_schema=False)
def robots_txt():
    return PlainTextResponse(
        "User-agent: *\nAllow: /tiku/\nDisallow: /api/\nDisallow: /admin\n"
        f"Sitemap: {_url('/sitemap.xml')}\n"
    )
