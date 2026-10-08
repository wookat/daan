"""SEO 题库落地页：服务端渲染 HTML（/tiku/*）+ sitemap/robots，承接搜索长尾流量导流主站。"""
import html
import json
import math
import os
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import (
    HTMLResponse,
)

from .. import db, kb

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


def _shenlun_sucai_path(mtype: str) -> str:
    return f"/tiku/shenlun/sucai/{quote(mtype)}/"


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
    "font-size:14px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}"
    ".meta{color:var(--muted);font-size:13px}"
    ".meta a,.ftr a,h2 a,p a,.qlist li>a{text-decoration:underline}"
    "p a.cta,.crumb a{text-decoration:none}"
    ".opt{display:block;margin:6px 0;padding:10px 12px;min-height:44px;border:1px solid var(--border);border-radius:8px;"
    "color:var(--text)}a.opt:hover,a.opt:active{text-decoration:none;border-color:var(--link);background:var(--tag-bg)}"
    ".ans{background:var(--ans-bg);border-radius:8px;padding:12px;margin-top:10px}"
    ".cta{display:inline-block;background:" + BRAND + ";color:#fff!important;border-radius:999px;"
    "padding:10px 24px;font-weight:600;margin:14px 0}"
    ".cta-w{display:block;text-align:center;padding:13px 20px}"
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


# 百度自适应站点标注，紧随 viewport（搜索学堂《自适应对百度友好关键》）
BAIDU_ADAPT_META = '<meta name="applicable-device" content="pc,mobile">'


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
        f"{BAIDU_ADAPT_META}"
        '<meta name="color-scheme" content="light dark">'
        f"<title>{_e(title)}</title>"
        f'<meta name="description" content="{_e(description)}">'
        '<meta property="og:type" content="website">'
        '<meta property="og:site_name" content="答岸">'
        f'<meta property="og:title" content="{_e(title)}">'
        f'<meta property="og:description" content="{_e(description)}">'
        f'<meta property="og:image" content="{_e(SITE_BASE)}/static/og-card.png">'
        '<meta name="twitter:card" content="summary_large_image">'
        f"{head_meta}"
        f"<style>{_CSS}</style>{ld}</head><body>"
        f'<header class="hdr"><div class="wrap"><a class="brand" href="/tiku/">答岸 · 考公题库</a>'
        f'<form class="hdr-s" action="/tiku/search" method="get" role="search">'
        f'<input name="q" type="search" placeholder="搜题目 / 考点 / 试卷" aria-label="搜索题库"></form>'
        f'<a class="hdr-cta" href="/app/">去刷题</a></div></header>'
        f'<main class="wrap">{body}</main>'
        f'<footer class="ftr"><a href="{_e(SITE_BASE)}/">答岸</a> · 10万+ 行测题 · 1.5万+ 历年真题'
        f' · <a href="/tiku/papers/">真题卷</a>'
        f' · <a href="https://career.zalize.com/privacy/">隐私政策</a>'
        f' · <a href="https://career.zalize.com/terms/">服务条款</a>'
        f' · <a href="mailto:support@zalize.com">联系我们</a></footer></body></html>'
    )


# 题库无题但 App 内有对应专区的模块：404 页给专区直达出路，而非死胡同
_EMPTY_MODULE_OUTLET = {
    "shenlun": (
        '<p><a class="cta" href="/app/#/pkgA/shenlun/shenlun">'
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
        ' · <a href="/tiku/daily/">每日一练</a> · <a href="/app/">去刷题</a></p>'
    )
    return HTMLResponse(
        _page(f"{msg}_答岸", "页面不存在或已下架。", "/tiku/", body, noindex=True),
        status_code=404,
    )


def _collection_ld(name: str, description: str, path: str, crumbs: list[tuple[str, str]]) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": name,
        "description": description[:200],
        "url": _url(path),
        "isPartOf": {"@type": "WebSite", "name": "答岸", "url": SITE_BASE},
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

