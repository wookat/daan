"""SEO 题库落地页：服务端渲染 HTML（/tiku/*）+ sitemap/robots，承接搜索长尾流量导流主站。"""
import hashlib
import html
import json
import math
import os
import threading
import time
import urllib.request
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


def _shenlun_paper_path(paper: str) -> str:
    return f"/tiku/shenlun/p/{quote(paper)}/"


_CSS = (
    ":root{--bg:#f6f7fb;--surface:#fff;--border:#e7e9f0;--text:#17181c;--muted:#6b7280;"
    "--link:" + BRAND + ";--tag-bg:#eef3ff;--ans-bg:#ecfdf5;"
    "--shadow:0 1px 2px rgba(23,24,28,.05);--shadow-hover:0 4px 12px rgba(23,24,28,.1)}"
    "@media(prefers-color-scheme:dark){:root{--bg:#111827;--surface:#1f2937;--border:#374151;"
    "--text:#f3f4f6;--muted:#9ca3af;--link:#7c9aff;--tag-bg:#26324d;--ans-bg:#123527;"
    "--shadow:0 1px 2px rgba(0,0,0,.4);--shadow-hover:0 4px 12px rgba(0,0,0,.5)}}"
    "*{box-sizing:border-box}body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"
    "'PingFang SC','HarmonyOS Sans','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',system-ui,sans-serif;"
    "color:var(--text);background:var(--bg);line-height:1.7;font-size:16px;overflow-wrap:anywhere}"
    "a{color:var(--link);text-decoration:none}a:hover{text-decoration:underline}"
    ".wrap{max-width:860px;margin:0 auto;padding:16px}"
    ".hdr{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 0}"
    ".hdr .wrap{padding-top:0;padding-bottom:0;display:flex;align-items:center;justify-content:space-between}"
    ".hdr .brand{color:var(--link);font-weight:700;font-size:18px}.hdr .brand:hover{text-decoration:none}"
    ".hdr-cta{background:" + BRAND + ";color:#fff!important;border-radius:999px;padding:6px 18px;"
    "font-size:14px;font-weight:600}.hdr-cta:hover{text-decoration:none;opacity:.92}"
    ".hdr-s{flex:1;display:flex;margin:0 12px;min-width:0}"
    ".hdr-s input{flex:1;min-width:0;max-width:280px;margin-left:auto;font-size:14px;color:var(--text);"
    "background:var(--bg);border:1px solid var(--border);border-radius:999px;padding:6px 14px}"
    ".hdr-s input:focus{border-color:var(--link)}"
    ":focus-visible{outline:2px solid var(--link);outline-offset:2px;border-radius:4px}"
    ".hdr-s input:focus:not(:focus-visible){outline:none}"
    "@media(max-width:480px){.hdr-s input{max-width:none}}"
    ".card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin:12px 0;"
    "box-shadow:var(--shadow)}"
    ".crumb{font-size:13px;color:var(--muted);margin:10px 0}.crumb a{color:var(--muted)}"
    "h1{font-size:22px;margin:10px 0}h2{font-size:17px;margin:8px 0}"
    ".qlist{list-style:none;padding:0;margin:0}.qlist li{border-bottom:1px solid var(--border);padding:10px 0}"
    ".qlist li:last-child{border-bottom:none}"
    ".tags{display:flex;flex-wrap:wrap;gap:8px}.tags a{background:var(--tag-bg);border-radius:16px;padding:4px 12px;"
    "font-size:14px;white-space:nowrap}"
    ".meta{color:var(--muted);font-size:13px}"
    ".meta a,.ftr a,h2 a,p a,.qlist li>a{text-decoration:underline}"
    "p a.cta,.crumb a{text-decoration:none}"
    ".opt{margin:6px 0;padding:8px 12px;border:1px solid var(--border);border-radius:8px}"
    ".ans{background:var(--ans-bg);border-radius:8px;padding:12px;margin-top:10px}"
    ".cta{display:inline-block;background:" + BRAND + ";color:#fff!important;border-radius:999px;"
    "padding:10px 24px;font-weight:600;margin:14px 0}"
    ".pager{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:16px 0}.pager a,.pager span{padding:6px 12px;"
    "background:var(--surface);border-radius:8px;border:1px solid var(--border)}"
    ".pager .gap{border:none;background:none;padding:6px 2px}"
    ".pager [aria-current]{background:" + BRAND + ";color:#fff;border-color:" + BRAND + "}"
    ".ftr{color:var(--muted);font-size:13px;text-align:center;padding:20px 0}"
    "details summary{cursor:pointer;font-weight:600}"
    "@media(min-width:768px){.card{transition:box-shadow .15s ease}"
    ".card:hover{box-shadow:var(--shadow-hover)}}"
    "@media(max-width:480px){.wrap{padding:12px}h1{font-size:19px}}"
    "@media print{:root{--bg:#fff;--surface:#fff;--text:#000;--muted:#444;--ans-bg:#fff}"
    ".hdr-cta,.hdr-s,.cta,.pager,.crumb,.tags,.ftr,.noprint{display:none!important}"
    "body{background:#fff}.card{border:none;box-shadow:none;break-inside:avoid;padding:8px 0}"
    ".ans{border:1px solid #999;padding:8px}a{color:#000}}"
)


def _page(
    title: str,
    description: str,
    canonical_path: str,
    body: str,
    jsonld: dict | list | None = None,
    noindex: bool = False,
) -> str:
    ld = (
        '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
        if jsonld
        else ""
    )
    # 404 等错误态页不声明规范地址/og:url，并显式 noindex
    head_meta = (
        '<meta name="robots" content="noindex">'
        if noindex
        else (
            f'<link rel="canonical" href="{_e(_url(canonical_path))}">'
            f'<meta property="og:url" content="{_e(_url(canonical_path))}">'
        )
    )
    return (
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light dark">'
        f"<title>{_e(title)}</title>"
        f'<meta name="description" content="{_e(description)}">'
        '<meta property="og:type" content="website">'
        '<meta property="og:site_name" content="错题邦">'
        f'<meta property="og:title" content="{_e(title)}">'
        f'<meta property="og:description" content="{_e(description)}">'
        f'<meta property="og:image" content="{_e(SITE_BASE)}/static/og-card.png">'
        '<meta name="twitter:card" content="summary_large_image">'
        f"{head_meta}"
        f"<style>{_CSS}</style>{ld}</head><body>"
        f'<header class="hdr"><div class="wrap"><a class="brand" href="/tiku/">错题邦 · 考公题库</a>'
        f'<form class="hdr-s" action="/tiku/search" method="get" role="search">'
        f'<input name="q" type="search" placeholder="搜题目 / 考点 / 试卷" aria-label="搜索题库"></form>'
        f'<a class="hdr-cta" href="/">去刷题</a></div></header>'
        f'<main class="wrap">{body}</main>'
        f'<footer class="ftr"><a href="{_e(SITE_BASE)}/">错题邦</a> · 13万+行测真题在线刷题'
        f' · <a href="/tiku/papers/">真题卷</a>'
        f' · <a href="https://career.zalize.com/privacy/">隐私政策</a>'
        f' · <a href="https://career.zalize.com/terms/">服务条款</a>'
        f' · <a href="mailto:support@zalize.com">联系我们</a></footer></body></html>'
    )


# 题库无题但 App 内有对应专区的模块：404 页给专区直达出路，而非死胡同
_EMPTY_MODULE_OUTLET = {
    "shenlun": (
        '<p><a class="cta" href="/#/pkgA/shenlun/shenlun">'
        "申论请前往「申论专区」：历年真题 + 素材范文 + 在线作答 →</a></p>"
    ),
}


def _not_found(msg: str, cta_html: str = "") -> HTMLResponse:
    """页族品牌 404：失效链接（题目下架/外链拼错）给出壳+出路，而非裸 JSON 报文。"""
    body = (
        f"<h1>{_e(msg)}</h1>"
        f"{cta_html}"
        "<p>你访问的页面不存在或已下架，可从以下入口继续：</p>"
        '<p><a href="/tiku/">题库首页</a> · <a href="/tiku/papers/">真题卷</a>'
        ' · <a href="/tiku/daily/">每日一练</a> · <a href="/">去刷题</a></p>'
    )
    return HTMLResponse(
        _page(f"{msg}_错题邦", "页面不存在或已下架。", "/tiku/", body, noindex=True),
        status_code=404,
    )


def _collection_ld(name: str, description: str, path: str, crumbs: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": name,
        "description": description[:200],
        "url": _url(path),
        "isPartOf": {"@type": "WebSite", "name": "错题邦", "url": SITE_BASE},
        "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "name": n, "item": _url(h)}
                for i, (n, h) in enumerate(crumbs)
            ],
        },
    }


def _breadcrumb_ld(crumbs: list[tuple[str, str | None]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, **({"item": _url(h)} if h else {})}
            for i, (n, h) in enumerate(crumbs)
        ],
    }


def _crumb(items: list[tuple[str, str | None]]) -> str:
    parts = []
    for name, href in items:
        parts.append(f'<a href="{_e(href)}">{_e(name)}</a>' if href else _e(name))
    return '<nav class="crumb">' + " › ".join(parts) + "</nav>"


def _pager(base_path: str, page: int, total: int) -> str:
    pages = max(1, math.ceil(total / PAGE_SIZE))

    def href(p: int) -> str:
        return _e(base_path) if p == 1 else f"{_e(base_path)}?page={p}"

    out = []
    if page > 1:
        out.append(f'<a href="{href(page - 1)}" rel="prev">上一页</a>')
    lo, hi = max(1, page - 2), min(pages, page + 2)
    if lo > 1:
        out.append(f'<a href="{href(1)}">1</a>')
        if lo > 2:
            out.append('<span class="gap">…</span>')
    for p in range(lo, hi + 1):
        if p == page:
            out.append(f'<span aria-current="page">{p}</span>')
        else:
            out.append(f'<a href="{href(p)}">{p}</a>')
    if hi < pages:
        if hi < pages - 1:
            out.append('<span class="gap">…</span>')
        out.append(f'<a href="{href(pages)}">{pages}</a>')
    if page < pages:
        out.append(f'<a href="{href(page + 1)}" rel="next">下一页</a>')
    return '<nav class="pager" aria-label="分页">' + "".join(out) + "</nav>"


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
        if len(topic_links) > 12:
            topics += f'<a href="/tiku/{_e(key)}/">全部 {len(topic_links)} 个考点 →</a>'
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
    sl_total = db.shenlun_questions(limit=1)["total"]
    if sl_total:
        sl_mats = db.shenlun_material_type_counts()
        sl_mat_line = ""
        if sl_mats:
            sl_mat_total = sum(n for _, n in sl_mats)
            sl_mat_types = "、".join(t for t, _ in sl_mats)
            sl_mat_line = f'<p class="meta">另收录申论写作素材 {sl_mat_total} 条（{_e(sl_mat_types)}），详见申论真题库页。</p>'
        sections.append(
            '<section class="card"><h2><a href="/tiku/shenlun/">申论</a>'
            f'<span class="meta">（{sl_total} 道真题）</span></h2>'
            '<p class="meta">历年申论真题与参考解析，可在 <a href="/tiku/shenlun/">申论真题库</a> '
            "按套卷（含给定资料与参考解析）、年份、题型浏览。</p>"
            + sl_mat_line
            + "</section>"
        )
    total = sum(counts.values())
    body = (
        "<h1>公务员考试题库</h1>"
        f"<p>收录 {total} 道行测题目（含历年真题），按模块、题型、考点分类，可在线刷题并查看花生十三方法讲解。"
        '· <a href="/tiku/daily/" style="white-space:nowrap">今日每日一练 →</a>'
        ' · <a href="/tiku/discuss/" style="white-space:nowrap">考友热议题目 →</a></p>'
        + "".join(sections)
        + f'<a class="cta" href="{_e(SITE_BASE)}/">进入刷题主站 →</a>'
    )
    return _page(
        "公务员考试题库_行测真题在线刷题_错题邦",
        f"免费公务员考试题库，收录 {total} 道行测题目与历年真题，覆盖资料分析、数量关系、言语理解、判断推理、常识判断，附答案解析。",
        "/tiku/",
        body,
        [
            _collection_ld(
                "公务员考试题库",
                f"免费公务员考试题库，收录 {total} 道行测题目与历年真题，附答案解析。",
                "/tiku/",
                [("题库", "/tiku/")],
            ),
            {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "错题邦",
                "url": SITE_BASE,
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                        "@type": "EntryPoint",
                        "urlTemplate": SITE_BASE + "/tiku/search?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                },
            },
        ],
    )


@router.get("/search", include_in_schema=False)
def tiku_search(q: str = ""):
    q = q.strip()[:64]
    dest = "/#/pkgA/search/search" + (f"?q={quote(q)}" if q else "")
    return RedirectResponse(dest, status_code=302)


@router.get("/search/", include_in_schema=False)
def tiku_search_slash(q: str = ""):
    q = q.strip()[:64]
    dest = "/tiku/search" + (f"?q={quote(q)}" if q else "")
    return RedirectResponse(dest, status_code=301)


@router.get("/daily", include_in_schema=False)
def tiku_daily_noslash():
    return RedirectResponse("/tiku/daily/", status_code=301)


def _daily_archive_days(n: int = 7) -> list[str]:
    now = time.time() + 8 * 3600
    return [time.strftime("%Y-%m-%d", time.gmtime(now - i * 86400)) for i in range(1, n + 1)]


def _render_daily(day: str, archived: bool):
    items = db.daily_set_questions(day)
    stats = db.daily_set_stats(day)
    cards = []
    for i, q in enumerate(items, 1):
        stem = (q.get("question") or "").strip().replace("\n", " ")[:70]
        mod = _module_name(q.get("module") or "") or "综合"
        cards.append(
            '<section class="card">'
            f'<h2>{i}. <a href="/tiku/q/{q["id"]}">{_e(stem)}…</a></h2>'
            f'<p class="meta">{_e(mod)}{" · 真题" if q.get("is_real") else ""}</p>'
            "</section>"
        )
    n = stats.get("participants") or 0
    if archived:
        part = f"当日 {n} 人完成" if n else "当日题组可随时补练"
    else:
        part = f"今天已有 {n} 人完成" if n else "来做今天第 1 位完成者"
    board = db.daily_set_board(day, 10)
    board_html = ""
    if board:
        rows = "".join(
            f'<p class="meta">{r["rank"]}. {_e(r["name"])} · 答对 {r["right"]}/{r["total"]}'
            + (f' · 用时 {int(r["secs"])}"' if r.get("secs") else "")
            + "</p>"
            for r in board
        )
        label = "当日排行榜" if archived else "今日排行榜"
        board_html = f'<section class="card"><h2>{label}（前 {len(board)} 名）</h2>{rows}</section>'
    if archived:
        cta = (
            f'<a class="cta" href="{_e(SITE_BASE)}/#/pages/practice/practice?daily=1&amp;date={_e(day)}&amp;src=seo">'
            "去主站补练这期同题（免费）→</a>"
        )
        archive_html = '<p class="meta"><a href="/tiku/daily/">← 回今日每日一练</a></p>'
    else:
        cta = f'<a class="cta" href="{_e(SITE_BASE)}/#/pages/practice/practice?daily=1&amp;src=seo">去主站作答今日同题（免费）→</a>'
        links = " · ".join(f'<a href="/tiku/daily/{d}/">{d}</a>' for d in _daily_archive_days())
        archive_html = f'<section class="card"><h2>往期每日一练</h2><p class="meta">{links}</p></section>'
    path = f"/tiku/daily/{day}/" if archived else "/tiku/daily/"
    title_tag = "往期补练" if archived else "全站同题刷题"
    crumbs = [("题库", "/tiku/"), ("每日一练", "/tiku/daily/" if archived else None)]
    if archived:
        crumbs.append((day, None))
    body = (
        _crumb(crumbs)
        + f"<h1>每日一练（{_e(day)}）</h1>"
        + f'<p class="meta">全站同题 · 五大模块各 2 题共 10 题 · {_e(part)}，完成后可查看击败全站百分比</p>'
        + "".join(cards)
        + board_html
        + cta
        + archive_html
    )
    return _page(
        f"每日一练{day}_公务员考试{title_tag}_错题邦",
        f"{day} 公务员考试每日一练：全站同题 10 道行测真题（五大模块各 2 题），在线作答查看解析，完成后可比较全站排名。",
        path,
        body,
        _collection_ld(
            f"每日一练（{day}）",
            "公务员考试每日一练，全站同题 10 道行测题目，附答案解析。",
            path,
            [("题库", "/tiku/"), ("每日一练", "/tiku/daily/")] + ([(day, path)] if archived else []),
        ),
    )


@router.get("/daily/", response_class=HTMLResponse, include_in_schema=False)
def tiku_daily():
    return _render_daily(db.cn_day(), archived=False)


@router.get("/daily/{day}", include_in_schema=False)
def tiku_daily_archive_noslash(day: str):
    return RedirectResponse(f"/tiku/daily/{quote(day)}/", status_code=301)


@router.get("/daily/{day}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_daily_archive(day: str):
    valid = db.daily_archive_day(day)
    if not valid:
        return RedirectResponse("/tiku/daily/", status_code=301)
    return _render_daily(valid, archived=True)


@router.get("/discuss", include_in_schema=False)
def tiku_discuss_noslash():
    return RedirectResponse("/tiku/discuss/", status_code=301)


@router.get("/discuss/", response_class=HTMLResponse, include_in_schema=False)
def tiku_discuss():
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT g.question_id, g.cnt, c.nickname, c.content, q.id AS q_id, q.question, q.module
           FROM (SELECT question_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
                 FROM question_comments WHERE status='ok'
                 GROUP BY question_id ORDER BY last_at DESC LIMIT 30) g
           LEFT JOIN question_comments c ON c.id = (
               SELECT id FROM question_comments
               WHERE question_id = g.question_id AND status='ok'
               ORDER BY created_at DESC, id DESC LIMIT 1)
           LEFT JOIN questions q ON q.id = g.question_id AND q.disabled=0
           ORDER BY g.last_at DESC"""
    ).fetchall()
    cards = []
    for r in rows:
        if r["q_id"] is None:
            continue
        stem = (r["question"] or "").strip().replace("\n", " ")[:70]
        mod = _module_name(r["module"]) or "综合"
        nick = (r["nickname"] or "考友").strip()[:20]
        cards.append(
            '<section class="card">'
            f'<h2><a href="/tiku/q/{r["question_id"]}">{_e(stem)}…</a></h2>'
            f'<p class="meta">{_e(mod)} · {r["cnt"]} 条讨论</p>'
            f'<p><b>{_e(nick)}：</b>{_e(r["content"] or "")}</p>'
            "</section>"
        )
    conn.close()
    if cards:
        listing = "".join(cards)
    else:
        listing = '<section class="card"><p>还没有讨论，去刷题时对题目发表评论，这里会聚合全站热议。</p></section>'
    body = (
        _crumb([("题库", "/tiku/"), ("考友热议", None)])
        + f"<h1>考友热议题目（{len(cards)} 题）</h1>"
        + '<p class="meta">全站正在讨论的题目，按最近活跃排序，点题干看题目解析与全部讨论</p>'
        + listing
        + f'<a class="cta" href="{_e(SITE_BASE)}/#/pkgA/social/plaza">进入讨论广场参与互动（免费）→</a>'
    )
    return _page(
        "考友热议题目_公务员考试题目讨论区_错题邦",
        "公务员考试题库热议题目聚合：考友们正在讨论的行测题目与解法交流，可在线查看解析并参与讨论。",
        "/tiku/discuss/",
        body,
        _collection_ld(
            "考友热议题目",
            "公务员考试题库热议题目聚合，考友讨论与解法交流。",
            "/tiku/discuss/",
            [("题库", "/tiku/"), ("考友热议", "/tiku/discuss/")],
        ),
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
        _collection_ld(
            "历年公务员考试真题卷",
            f"{len(papers)} 套历年国考/省考行测真题卷，在线全真模考，附逐题答案解析。",
            "/tiku/papers/",
            [("题库", "/tiku/"), ("真题卷", "/tiku/papers/")],
        ),
    )


@router.get("/papers/{pid}/", include_in_schema=False)
def tiku_paper_detail_slash(pid: int):
    return RedirectResponse(f"/tiku/papers/{pid}", status_code=301)


@router.get("/papers/{pid}", response_class=HTMLResponse, include_in_schema=False)
def tiku_paper_detail(pid: int):
    p = db.get_exam_paper(pid)
    if not p or p.get("kind") != "zhenti":
        return _not_found("试卷不存在")
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


@router.get("/q/{qid}/", include_in_schema=False)
def tiku_question_slash(qid: int):
    return RedirectResponse(f"/tiku/q/{qid}", status_code=301)


@router.get("/q/{qid}", response_class=HTMLResponse, include_in_schema=False)
def tiku_question(qid: int):
    try:
        html = _render_question(qid)
    except HTTPException:
        return _not_found("题目不存在")
    return HTMLResponse(html.replace("<!--QCOMMENTS-->", _render_q_comments(qid)))


def _render_q_comments(qid: int) -> str:
    conn = db.get_conn()
    total = conn.execute(
        "SELECT COUNT(*) FROM question_comments WHERE question_id=? AND status='ok'", (qid,)
    ).fetchone()[0]
    if not total:
        conn.close()
        return ""
    rows = conn.execute(
        "SELECT nickname, content, likes FROM question_comments "
        "WHERE question_id=? AND status='ok' AND parent_id IS NULL "
        "ORDER BY likes DESC, created_at DESC LIMIT 5",
        (qid,),
    ).fetchall()
    conn.close()
    if not rows:
        return ""
    items = "".join(
        '<li><b>'
        + _e((r["nickname"] or "考友").strip()[:20] or "考友")
        + (f' \u00b7 \U0001f44d {r["likes"]}' if r["likes"] else "")
        + "：</b>"
        + _e(r["content"])
        + "</li>"
        for r in rows
    )
    cta = (
        f'<a class="cta" href="{_e(SITE_BASE)}/#/pkgA/social/discuss?qid={qid}">参与讨论（免费）→</a>'
    )
    return f'<section class="card noprint"><h2>考友讨论（{total} 条）</h2><ul class="qlist">{items}</ul>{cta}</section>'


@router.get("/y/{year}/{module}", include_in_schema=False)
def tiku_year_noslash(year: int, module: str):
    if module == "shenlun":
        if not dict(db.shenlun_year_counts()).get(year):
            return _not_found("页面不存在")
        return RedirectResponse(_year_path(year, module), status_code=301)
    if not _module_name(module) or not db.year_module_counts().get((year, module), (0, None))[0]:
        return _not_found("页面不存在")
    return RedirectResponse(_year_path(year, module), status_code=301)


@router.get("/y/{year}/{module}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_year(year: int, module: str, page: int = 1):
    try:
        if module == "shenlun":
            return HTMLResponse(_render_shenlun_year(year, max(1, page)))
        return HTMLResponse(_render_year(year, module, max(1, page)))
    except HTTPException as e:
        return _not_found(e.detail)


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
    if code not in taxonomy.topic_index() or not db.tag3_counts().get(code, 0):
        return _not_found("页面不存在")
    return RedirectResponse(_topic_path(code), status_code=301)


@router.get("/t/{code}/", response_class=HTMLResponse, include_in_schema=False)
def tiku_topic(code: str, page: int = 1):
    try:
        return HTMLResponse(_render_topic(code, max(1, page)))
    except HTTPException as e:
        return _not_found(e.detail)


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
        "is_real, exam_year, exam_region, image, image_credit, material_hash "
        "FROM questions WHERE id=? AND disabled=0",
        (qid,),
    ).fetchone()
    if not r:
        conn.close()
        raise HTTPException(404, "题目不存在")
    group = []
    if r["module"] == "ziliao" and r["material_hash"] and r["material_hash"] != "-":
        group = conn.execute(
            "SELECT id, question FROM questions WHERE material_hash=? AND disabled=0 "
            "ORDER BY id LIMIT 8",
            (r["material_hash"],),
        ).fetchall()
        if len(group) < 2:
            group = []
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
    group_html = "".join(
        (
            f'<li><b>本题</b> {_e((g["question"] or "").strip().replace(chr(10), " ")[:60])}…</li>'
            if g["id"] == qid
            else f'<li><a href="/tiku/q/{g["id"]}">{_e((g["question"] or "").strip().replace(chr(10), " ")[:60])}…</a></li>'
        )
        for g in group
    )
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
            f'<section class="card"><h2>同材料题组（共 {len(group)} 题）</h2><ul class="qlist">{group_html}</ul></section>'
            if group_html
            else ""
        )
        + (
            f'<section class="card noprint"><h2>同考点相似题</h2><ul class="qlist">{sim_html}</ul>'
            + (
                f'<p><a href="{_e(_topic_path(r["tag3"]))}">查看「{_e(topic["name"])}」考点全部题目 →</a></p>'
                if topic
                else ""
            )
            + "</section>"
            if sim_html
            else ""
        )
        + "<!--QCOMMENTS-->"
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
        [jsonld, _breadcrumb_ld(crumbs)],
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
        f"{name}题库{suffix}_行测{name}真题及答案解析_错题邦",
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
        f"{submodule}题库{suffix}_{name}{submodule}真题及答案解析_错题邦",
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


def _sitemap_page_urls() -> list[tuple[str, float | None]]:
    urls: list[tuple[str, float | None]] = [
        (_url("/tiku/"), None),
        (_url("/tiku/papers/"), None),
        (_url("/tiku/discuss/"), None),
        (_url("/tiku/daily/"), None),
    ]
    urls += [(_url(f"/tiku/daily/{d}/"), None) for d in _daily_archive_days()]
    for r in db.question_counts():
        if not _module_name(r["module"]):
            continue
        urls.append((_url(f'/tiku/{quote(r["module"])}/'), None))
        for s in db.submodule_counts(r["module"]):
            urls.append((_url(_sub_path(r["module"], s["submodule"])), None))
    if db.shenlun_questions(limit=1)["total"]:
        urls.append((_url("/tiku/shenlun/"), None))
        urls += [(_url(_sub_path("shenlun", t)), None) for t, _n in db.shenlun_qtype_counts()]
        urls += [(_url(_shenlun_paper_path(p)), None) for p, _y, _rg, _n in db.shenlun_paper_counts()]
    urls += [(_url(f'/tiku/papers/{p["id"]}'), p["created_at"]) for p in db.list_exam_papers(kind="zhenti")]
    return urls


@root_router.get("/sitemap-pages.xml", include_in_schema=False)
def sitemap_pages():
    return _urlset(_sitemap_page_urls())


def _sitemap_topic_urls() -> list[tuple[str, float | None]]:
    counts = db.tag3_counts()
    lastmod = db.tag3_lastmod()
    return [
        (_url(_topic_path(code)), lastmod.get(code))
        for code in taxonomy.topic_index()
        if counts.get(code)
    ]


@root_router.get("/sitemap-topics.xml", include_in_schema=False)
def sitemap_topics():
    return _urlset(_sitemap_topic_urls())


def _sitemap_year_urls() -> list[tuple[str, float | None]]:
    urls: list[tuple[str, float | None]] = [
        (_url(_year_path(y, m)), mu)
        for (y, m), (n, mu) in sorted(db.year_module_counts().items(), reverse=True)
        if n and _module_name(m)
    ]
    urls += [(_url(_year_path(y, "shenlun")), None) for y, _n in db.shenlun_year_counts()]
    return urls


@root_router.get("/sitemap-years.xml", include_in_schema=False)
def sitemap_years():
    return _urlset(_sitemap_year_urls())


@root_router.get("/sitemap-questions-{shard}.xml", include_in_schema=False)
def sitemap_questions(shard: int):
    conn = db.get_conn()
    lo = (shard - 1) * SITEMAP_SHARD
    rows = conn.execute(
        "SELECT id, updated_at FROM questions WHERE disabled=0 ORDER BY id LIMIT ? OFFSET ?",
        (SITEMAP_SHARD, lo),
    ).fetchall()
    conn.close()
    if shard < 1 or not rows:
        raise HTTPException(404, "分片不存在")
    return _urlset([(_url(f'/tiku/q/{r["id"]}'), r["updated_at"]) for r in rows])


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
        f'<meta property="og:image" content="{_e(SITE_BASE)}/static/og-card.png">'
        f'<meta name="twitter:card" content="summary_large_image">'
        f'<meta name="twitter:title" content="{_e(title)}">'
        f'<meta name="twitter:description" content="{_e(summary)}">'
        f'<meta name="twitter:image" content="{_e(SITE_BASE)}/static/og-card.png">'
        f'<meta http-equiv="refresh" content="0;url={_e(spa)}">'
        f'<script>location.replace("{spa}"+location.search.replace("?","&"))</script>'
        f"</head><body><p>正在打开分享题目… "
        f'<a href="{_e(spa)}">点此继续</a></p></body></html>'
    )


@root_router.get("/p/{rid}", response_class=HTMLResponse, include_in_schema=False)
def pk_landing(rid: str):
    """PK 战绩短链落地页：服务端输出动态 OG 后跳转 SPA 战绩页。

    短链路径不含 # / ?，聊天应用链接识别不会截断 rid。noindex 避免瘦内容进索引。
    """
    code = rid.strip().upper()[:12]
    conn = db.get_conn()
    try:
        m = conn.execute(
            "SELECT creator_name, opponent_name, creator_score, opponent_score, module, status "
            "FROM pk_matches WHERE code=?",
            (code,),
        ).fetchone()
    except db.sqlite3.OperationalError:
        m = None
    finally:
        conn.close()
    if not m or m["status"] != "finished":
        return RedirectResponse(SITE_BASE + "/", status_code=302)
    creator = (m["creator_name"] or "匿名考友").strip()[:20]
    opponent = (m["opponent_name"] or "匿名考友").strip()[:20]
    mod = _module_name(m["module"]) or "行测"
    title = f"{creator} {m['creator_score']} : {m['opponent_score']} {opponent}｜答题PK战绩，不服来战！"
    summary = f"错题邦答题 PK（{mod}）实时对局战绩，免注册打开即可应战。"
    spa = f"/#/pkgA/share/pk-result?rid={quote(code)}"
    page_url = _url(f"/p/{quote(code)}")
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
        f'<meta property="og:image" content="{_e(SITE_BASE)}/static/og-card.png">'
        f'<meta name="twitter:card" content="summary_large_image">'
        f'<meta name="twitter:title" content="{_e(title)}">'
        f'<meta name="twitter:description" content="{_e(summary)}">'
        f'<meta http-equiv="refresh" content="0;url={_e(spa)}">'
        f'<script>location.replace("{spa}"+location.search.replace("?","&"))</script>'
        f"</head><body><p>正在打开 PK 战绩… "
        f'<a href="{_e(spa)}">点此继续</a></p></body></html>'
    )


@root_router.get("/llms.txt", include_in_schema=False)
def llms_txt():
    """llmstxt.org 站点导览：面向 LLM 爬虫的公开内容入口清单。"""
    mods = "\n".join(
        f"- [{m['name']}题库]({_url(f'/tiku/{key}/')}): {m['name']}模块真题与练习题，含考点子分类与年份归档"
        for key, m in kb.MODULES.items()
        if key != "shenlun"
    )
    shenlun = ""
    if db.shenlun_questions(limit=1)["total"]:
        mats = db.shenlun_material_type_counts()
        mat_note = f"；另收录 {sum(n for _, n in mats)} 条写作素材（按类型归档）" if mats else ""
        shenlun = f"- [申论真题库]({_url('/tiku/shenlun/')}): 历年申论真题与参考解析，按套卷（含给定资料与参考解析）、年份、题型归档{mat_note}\n"
    return PlainTextResponse(
        "# 错题邦公考题库\n\n"
        "> 免费公务员考试在线刷题与错题本：行测五大模块真题题库（每题含答案与解析）、"
        "历年申论真题、每日一练、历年真题卷、考友讨论。\n\n"
        "## 题库\n\n"
        f"- [题库首页]({_url('/tiku/')}): 全部模块、考点与年份入口\n"
        f"{mods}\n"
        f"{shenlun}"
        f"- [历年真题卷]({_url('/tiku/papers/')}): 按年份/地区的完整真题卷列表\n\n"
        "## 动态内容\n\n"
        f"- [每日一练]({_url('/tiku/daily/')}): 全站同题每日题组与排行榜\n"
        f"- [考友热议]({_url('/tiku/discuss/')}): 题目讨论区热门评论聚合\n\n"
        "## 说明\n\n"
        f"- [站点地图]({_url('/sitemap.xml')}): 全部可收录页面\n",
        media_type="text/markdown; charset=utf-8",
    )


@root_router.get("/robots.txt", include_in_schema=False)
def robots_txt():
    blocked = "".join(
        f"User-agent: {b}\nDisallow: /\n\n"
        for b in ("AwarioBot", "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot", "PetalBot")
    )
    return PlainTextResponse(
        blocked + "User-agent: *\nAllow: /tiku/\nDisallow: /api/\nDisallow: /admin\n"
        f"Sitemap: {_url('/sitemap.xml')}\n"
    )


# ---------- IndexNow 主动提交 ----------
# 密钥文件端点早已上线但从未推送过 URL；搜索引擎（Bing/Yandex 等 IndexNow 联盟）
# 对零外链新站不会主动抓取，主动提交是 /tiku/q/* 页族唯一可行的收录通道。
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"
INDEXNOW_BATCH = 10000
INDEXNOW_BATCHES_PER_CYCLE = 2
INDEXNOW_INTERVAL = 6 * 3600


def _indexnow_post(urls: list[str]) -> bool:
    payload = json.dumps(
        {
            "host": SITE_BASE.split("//", 1)[-1],
            "key": INDEXNOW_KEY,
            "keyLocation": _url("/indexnow-key.txt"),
            "urlList": urls,
        }
    ).encode()
    req = urllib.request.Request(
        INDEXNOW_ENDPOINT,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            print(f"[indexnow] submitted {len(urls)} urls -> {resp.status}", flush=True)
            return 200 <= resp.status < 300
    except OSError as exc:
        print(f"[indexnow] submit failed: {exc}", flush=True)
        return False


def _indexnow_page_urls() -> list[str]:
    urls = [_url("/")]
    urls += [u for u, _ts in _sitemap_page_urls()]
    urls += [u for u, _ts in _sitemap_topic_urls()]
    urls += [u for u, _ts in _sitemap_year_urls()]
    return urls


def _indexnow_submit_pages(conn) -> None:
    urls = sorted(set(_indexnow_page_urls()))
    digest = hashlib.sha256("\n".join(urls).encode()).hexdigest()
    row = conn.execute(
        "SELECT value FROM seo_meta WHERE key='indexnow_pages_hash'"
    ).fetchone()
    if row and row["value"] == digest:
        return
    if not _indexnow_post(urls):
        return
    conn.execute(
        "INSERT INTO seo_meta (key, value) VALUES ('indexnow_pages_hash', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (digest,),
    )
    conn.commit()


def _indexnow_cycle():
    conn = db.get_conn()
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS seo_meta (key TEXT PRIMARY KEY, value TEXT)")
        conn.commit()
        _indexnow_submit_pages(conn)
        row = conn.execute(
            "SELECT value FROM seo_meta WHERE key='indexnow_last_qid'"
        ).fetchone()
        last_qid = int(row["value"]) if row else -1
        if last_qid < 0:
            core = [_url(p) for p in ("/", "/tiku/", "/tiku/daily/", "/tiku/discuss/")]
            if not _indexnow_post(core):
                return
            last_qid = 0
        for _ in range(INDEXNOW_BATCHES_PER_CYCLE):
            rows = conn.execute(
                "SELECT id FROM questions WHERE disabled=0 AND id>? ORDER BY id LIMIT ?",
                (last_qid, INDEXNOW_BATCH),
            ).fetchall()
            if not rows:
                break
            if not _indexnow_post([_url(f'/tiku/q/{r["id"]}') for r in rows]):
                break
            last_qid = rows[-1]["id"]
        conn.execute(
            "INSERT INTO seo_meta (key, value) VALUES ('indexnow_last_qid', ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (str(last_qid),),
        )
        conn.commit()
    finally:
        conn.close()


def _indexnow_submitter():
    time.sleep(120)  # 让启动期预热先行
    while True:
        try:
            _indexnow_cycle()
        except (OSError, ValueError, db.sqlite3.Error) as exc:
            print(f"[indexnow] cycle error: {exc}", flush=True)
        time.sleep(INDEXNOW_INTERVAL)


if INDEXNOW_KEY:
    threading.Thread(target=_indexnow_submitter, daemon=True).start()
