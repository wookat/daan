"""行测 SSR 页族：/tiku 首页、search、daily、discuss、papers、q、year、topic。"""
import json
import time
from functools import lru_cache
from urllib.parse import quote

from fastapi import HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from .. import db, taxonomy
from .common import (
    PAGE_SIZE,
    SITE_BASE,
    _breadcrumb_ld,
    _collection_ld,
    _crumb,
    _e,
    _module_name,
    _not_found,
    _page,
    _pager,
    _q_items,
    _shenlun_sucai_path,
    _sub_path,
    _topic_path,
    _url,
    _year_path,
    router,
)
from .shenlun import _render_shenlun_year


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
            sl_mat_types = "、".join(
                f'<a href="{_e(_shenlun_sucai_path(t))}">{_e(t)}（{n} 条）</a>' for t, n in sl_mats
            )
            sl_mat_line = f'<p class="meta">另收录申论写作素材 {sl_mat_total} 条：{sl_mat_types}。</p>'
        sl_qtypes = "".join(
            f'<a href="{_e(_sub_path("shenlun", t))}">{_e(t)}（{n}）</a>'
            for t, n in db.shenlun_qtype_counts()
        )
        sl_years = "".join(
            f'<a href="{_e(_year_path(y, "shenlun"))}">{y}年（{n}）</a>'
            for y, n in db.shenlun_year_counts()
        )
        sections.append(
            '<section class="card"><h2><a href="/tiku/shenlun/">申论</a>'
            f'<span class="meta">（{sl_total} 道真题）</span></h2>'
            '<p class="meta">历年申论真题与参考解析，可在 <a href="/tiku/shenlun/">申论真题库</a> '
            "按套卷（含给定资料与参考解析）、年份、题型浏览。</p>"
            + (f'<p class="meta">按题型刷题：</p><div class="tags">{sl_qtypes}</div>' if sl_qtypes else "")
            + (f'<p class="meta">按年份刷真题：</p><div class="tags">{sl_years}</div>' if sl_years else "")
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
    filters = db.exam_paper_filters()
    year_chips = "".join(
        f'<a href="/#/pkgA/exam/list?year={f["y"]}">{f["y"]}年（{f["n"]}）</a>'
        for f in filters["years"]
    )
    region_chips = "".join(
        f'<a href="/#/pkgA/exam/list?region={quote(f["r"])}">{_e(f["r"])}（{f["n"]}）</a>'
        for f in filters["regions"]
    )
    lis = "".join(
        f'<li><a href="/tiku/papers/{p["id"]}">{_e(p["title"])}</a>'
        f'<div class="meta">{_e(p["year"] or "")} {_e(p["region"] or "")} · {p["n"]} 题'
        f'{" · 限时 " + str(p["duration_min"]) + " 分钟" if p["duration_min"] else ""}</div></li>'
        for p in papers
    )
    body = (
        _crumb([("题库", "/tiku/"), ("真题卷", None)])
        + f"<h1>历年公务员考试真题卷（{len(papers)} 套）</h1>"
        + (f'<div class="card"><h2>按年份筛卷</h2><div class="tags">{year_chips}</div></div>' if year_chips else "")
        + (f'<div class="card"><h2>按地区筛卷</h2><div class="tags">{region_chips}</div></div>' if region_chips else "")
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


def _exam_list_query(p: dict) -> str:
    parts = []
    if p.get("year"):
        parts.append(f'year={p["year"]}')
    if p.get("region"):
        parts.append(f'region={quote(p["region"])}')
    return "?" + "&".join(parts) if parts else ""


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
        + f'<a class="cta" href="{_e(SITE_BASE)}/#/pkgA/exam/list{_exam_list_query(p)}">在线模考本卷 →</a>'
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

