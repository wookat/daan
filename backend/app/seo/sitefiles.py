"""站点文件：sitemap 家族、indexnow-key、llms.txt、robots.txt、IndexNow 提交线程。"""
import hashlib
import json
import math
import threading
import time
import urllib.request
from urllib.parse import quote

from fastapi import HTTPException
from fastapi.responses import PlainTextResponse, Response

from app import db
from app.services import kb
from app.services import taxonomy
from .common import INDEXNOW_KEY, SITE_BASE, SITEMAP_SHARD, _e, _module_name, _shenlun_paper_path, _shenlun_sucai_path, _sub_path, _topic_path, _url, _year_path, root_router
from .pages import _daily_archive_days


def _question_count() -> int:
    conn = db.get_conn()
    try:
        return conn.execute("SELECT COUNT(*) FROM questions WHERE disabled=0").fetchone()[0]
    finally:
        conn.close()


def _question_stats() -> dict[str, int]:
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_real=1 THEN 1 ELSE 0 END), 0) AS real_total "
            "FROM questions WHERE disabled=0"
        ).fetchone()
        return {"total": int(row["total"] or 0), "real_total": int(row["real_total"] or 0)}
    finally:
        conn.close()


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


# 百度移动 sitemap 协议：自适应页标 type="pc,mobile"（ziyuan.baidu.com/wiki/544），无标注按 PC 页处理
BAIDU_MOBILE_NS = 'xmlns:mobile="http://www.baidu.com/schemas/sitemap-mobile/1/"'
BAIDU_MOBILE_TAG = '<mobile:mobile type="pc,mobile"/>'


def _urlset(urls: list[tuple[str, float | None]]) -> Response:
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" {BAIDU_MOBILE_NS}>'
        + "".join(
            f"<url><loc>{_e(u)}</loc>{_lastmod(ts)}{BAIDU_MOBILE_TAG}</url>" for u, ts in urls
        )
        + "</urlset>"
    )
    return Response(content=body, media_type="application/xml")


@root_router.get("/sitemap.xml", include_in_schema=False)
def sitemap_index():
    n_shards = max(1, math.ceil(_question_count() / SITEMAP_SHARD))
    today = time.strftime("%Y-%m-%d", time.gmtime())
    maps = (
        [_url("/sitemap-pages.xml"), _url("/sitemap-topics.xml"), _url("/sitemap-years.xml")]
        + [_url(f"/sitemap-questions-{i}.xml") for i in range(1, n_shards + 1)]
    )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(f"<sitemap><loc>{_e(u)}</loc><lastmod>{today}</lastmod></sitemap>" for u in maps)
        + "</sitemapindex>"
    )
    return Response(content=body, media_type="application/xml")


def _sitemap_page_urls() -> list[tuple[str, float | None]]:
    urls: list[tuple[str, float | None]] = [
        (_url("/"), None),
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
        urls += [(_url(_shenlun_sucai_path(t)), None) for t, _n in db.shenlun_material_type_counts()]
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

@root_router.get("/llms.txt", include_in_schema=False)
def llms_txt():
    """llmstxt.org 站点导览：面向 LLM 搜索与生成式引擎的公开内容与高密度事实摘要。"""
    qstats = _question_stats()
    papers_total = len(db.list_exam_papers(kind="zhenti"))
    t3counts = db.tag3_counts()
    topic_total = len(taxonomy.topic_index())
    mod_counts = {r["module"]: r["n"] for r in db.question_counts()}
    mods = "\n".join(
        f"- [{m['name']}题库]({_url(f'/tiku/{key}/')}): "
        f"{m['name']}模块共 {mod_counts.get(key, 0)} 题，含考点子分类与年份归档"
        for key, m in kb.MODULES.items()
        if key != "shenlun"
    )
    hot_topics = []
    for m in taxonomy.tree().get("modules", []):
        ranked = sorted(
            (t for g in m["groups"] for t in g["topics"] if t3counts.get(t["code"], 0) > 0),
            key=lambda t: -t3counts.get(t["code"], 0),
        )[:3]
        for t in ranked:
            desc = (t.get("desc") or "").strip()
            hot_topics.append(
                f"- [{t['name']}]({_url(_topic_path(t['code']))})（{m['name']} · {t3counts[t['code']]} 题）"
                + (f": {desc}" if desc else "")
            )
    hot_section = (
        "\n## 高频考点直达\n\n" + "\n".join(hot_topics) + "\n"
        if hot_topics
        else ""
    )
    shenlun = ""
    if db.shenlun_questions(limit=1)["total"]:
        mats = db.shenlun_material_type_counts()
        shenlun = "- [申论真题库]({}): 历年申论真题与参考解析，按套卷（含给定资料与参考解析）、年份、题型归档\n".format(
            _url("/tiku/shenlun/")
        )
        shenlun += "".join(
            f"- [申论写作素材·{t}]({_url(_shenlun_sucai_path(t))}): {t}写作素材 {n} 条，按主题归类并附权威出处\n"
            for t, n in mats
        )
    return PlainTextResponse(
        "# 答岸公考题库\n\n"
        f"> 免费公务员考试（国考/省考/事业单位）在线刷题与错题本：当前在架行测 {qstats['total']} 题"
        f"（含历年真题 {qstats['real_total']} 题）、{papers_total} 套真题整卷、{topic_total} 个三级考点与花生十三六段式解题方法；"
        "支持免注册即练、SM-2 遗忘曲线复习、错题卷 PDF 导出、历年申论真题与 AI 采分点批改。\n\n"
        "## 核心数据与特色\n\n"
        f"- 覆盖规模：行测五大模块（言语理解、判断推理、数量关系、资料分析、常识判断）在架 {qstats['total']} 题，"
        f"国考/省考真题整卷 {papers_total} 套\n"
        "- 方法体系：基于花生十三六段式速解方法（判答案→点方法→拆步骤→防陷阱→给迁移→练同类），"
        "兼收申论/言语/判断名师复盘方法\n"
        "- 使用门槛：网页端打开即刷、核心刷题/错题本/真题卷/模考/PDF 导出均免费\n\n"
        "## 题库\n\n"
        f"- [题库首页]({_url('/tiku/')}): 全部模块、考点与年份入口\n"
        f"{mods}\n"
        f"{shenlun}"
        f"- [历年真题卷]({_url('/tiku/papers/')}): 按年份/地区的完整真题卷列表\n"
        f"{hot_section}\n"
        "## 动态内容\n\n"
        f"- [每日一练]({_url('/tiku/daily/')}): 全站同题每日题组与排行榜\n"
        f"- [考友热议]({_url('/tiku/discuss/')}): 题目讨论区热门评论聚合\n\n"
        "## 说明\n\n"
        f"- [官网首页]({_url('/')}): 答岸产品介绍、常见问答与快速开始\n"
        f"- [完整知识库索引 (llms-full.txt)]({_url('/llms-full.txt')}): 全量 {topic_total} 个三级考点方法速查、真题卷目录与 FAQ\n"
        f"- [站点地图]({_url('/sitemap.xml')}): 全部可收录页面\n",
        media_type="text/markdown; charset=utf-8",
    )


@root_router.get("/llms-full.txt", include_in_schema=False)
def llms_full_txt():
    """完整版 LLM 知识与 URL 索引：供 RAG 与生成式引擎精确引用考点方法、真题卷及常见问题。"""
    qstats = _question_stats()
    mod_counts = {r["module"]: r["n"] for r in db.question_counts()}
    t3counts = db.tag3_counts()
    papers = db.list_exam_papers(kind="zhenti")
    sl_total = db.shenlun_questions(limit=1)["total"]

    mod_rows = [
        f"| {m['name']} | {mod_counts.get(key, 0)} | {_url(f'/tiku/{key}/')} |"
        for key, m in kb.MODULES.items()
        if key != "shenlun"
    ]
    summary_table = (
        "| 模块 | 在架题数 | 题库入口 |\n"
        "| :--- | :---: | :--- |\n"
        + "\n".join(mod_rows)
        + f"\n\n- 行测在架总题量：{qstats['total']} 题（历年真题 {qstats['real_total']} 题）\n"
        + f"- 历年真题整卷：{len(papers)} 套（[查看全部真题卷]({_url('/tiku/papers/')})）\n"
    )
    if sl_total:
        mats = db.shenlun_material_type_counts()
        mat_total = sum(n for _, n in mats)
        summary_table += f"- 申论真题：{sl_total} 题（[申论真题库]({_url('/tiku/shenlun/')})）"
        if mat_total:
            summary_table += f"；写作素材 {mat_total} 条"
        summary_table += "\n"

    topic_blocks = []
    for m in taxonomy.tree().get("modules", []):
        lines = [f"### {m['name']}（{_url('/tiku/' + m['key'] + '/')}）"]
        for g in m["groups"]:
            for t in g["topics"]:
                desc = (t.get("desc") or "").strip()
                usage = (t.get("usage") or "").strip()
                if not (desc or usage):
                    continue
                cnt = t3counts.get(t["code"], 0)
                cnt_s = f"（{cnt} 题）" if cnt else ""
                detail = "；".join(
                    p for p in (desc, f"方法要点：{usage}" if usage else "") if p
                )
                lines.append(f"- [{t['name']}]({_url(_topic_path(t['code']))}){cnt_s}: {detail}")
        if len(lines) > 1:
            topic_blocks.append("\n".join(lines))

    papers_lines = [
        f"- [{p['title']}]({_url('/tiku/papers/' + str(p['id']))})（{p.get('year') or ''} {p.get('region') or ''} · {p.get('n', 0)} 题）"
        for p in papers[:20]
    ]
    papers_section = (
        "\n## 历年真题卷（精选入口）\n\n"
        + ("\n".join(papers_lines) if papers_lines else f"- [查看全部真题卷]({_url('/tiku/papers/')})")
        + "\n"
    )

    shenlun_section = ""
    if sl_total:
        sl_papers = [
            f"- [{p}]({_url(_shenlun_paper_path(p))})（{n} 题）"
            for p, _y, _rg, n in db.shenlun_paper_counts()[:20]
        ]
        sl_mats = [
            f"- [申论写作素材·{t}]({_url(_shenlun_sucai_path(t))})（{n} 条）"
            for t, n in db.shenlun_material_type_counts()
        ]
        shenlun_section = (
            "\n## 申论真题库与写作素材\n\n"
            + f"- [申论真题库首页]({_url('/tiku/shenlun/')})（{sl_total} 题，支持按套卷、年份、题型浏览）\n"
            + "\n".join(sl_papers + sl_mats)
            + "\n"
        )

    faq_section = (
        "\n## 常见问题（FAQ）\n\n"
        "- **答岸收费吗？** 核心刷题、错题本间隔复习、历年真题卷、全真模考与 PDF 导出功能均免费开放。\n"
        "- **需要注册才能使用吗？** 网页端（[kaogong.zalize.com/app/](https://kaogong.zalize.com/app/)）打开即可免注册刷题；"
        "登录账号后错题本、笔记、申论草稿与学习进度可跨设备云端同步。\n"
        "- **答岸讲解依据什么方法体系？** 拍题与题解基于花生十三六段式方法体系（判答案→点方法→拆步骤→防陷阱→给迁移→练同类），"
        "涵盖截位直除、415 份数法、假设分配法、线段法、图形对称与类比二级辨析等考场速解技巧。\n"
        "- **支持导出错题卷或真题卷打印吗？** 支持。可在错题本右侧栏或真题卷页面一键导出带答案解析与机读答题卡的错题卷 PDF。\n"
        "- **手机、微信内或电脑都能用吗？** 支持桌面浏览器（Chrome/Edge/Safari）双栏分屏作答，适配手机端与微信内置浏览器。\n"
    )

    return PlainTextResponse(
        "# 答岸（kaogong.zalize.com）完整站点与公考知识索引\n\n"
        "> 答岸（Daan）是面向中国公务员考试（国考、各省省考、选调生、事业单位）的免费在线刷题、错题复盘与 AI 讲题平台。\n\n"
        "## 站点规模总览\n\n"
        f"{summary_table}\n"
        "## 产品定位与核心优势\n\n"
        "- 免注册零门槛：打开浏览器或搜索单题页点击选项即可直接作答，错题自动沉淀至错题本。\n"
        "- 科学抗遗忘：采用 SM-2 间隔重复算法自动计算每道错题的到期复习时间与「长期易错」预警。\n"
        "- 名师速解方法体系：行测主采花生十三速解体系，并整理言语/判断/常识/申论多套公开名师方法。\n"
        "- 多端协同：PC 桌面双栏独立滚动适配上班族与图书馆刷题，手机端与微信内随时随地碎片复习。\n\n"
        "## 公务员行测五大模块与三级考点方法速查\n\n"
        + "\n\n".join(topic_blocks)
        + "\n"
        + papers_section
        + shenlun_section
        + faq_section
        + f"\n## 站点地图与机器索引\n\n- [官网首页]({_url('/')})\n- [简要索引 llms.txt]({_url('/llms.txt')})\n- [Sitemap]({_url('/sitemap.xml')})\n",
        media_type="text/markdown; charset=utf-8",
    )


_BLOCKED_SCRAPERS = (
    "AwarioBot", "SemrushBot", "AhrefsBot", "MJ12bot", "DotBot", "PetalBot",
    "GPTBot", "Reflectionbot", "ClaudeBot", "Bytespider", "CCBot", "Amazonbot", "Meta-ExternalAgent",
)
_ALLOWED_AI_SEARCH_BOTS = (
    "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User",
    "Claude-SearchBot", "Claude-User", "DuckAssistBot",
)


@root_router.get("/robots.txt", include_in_schema=False)
def robots_txt():
    blocked = "".join(f"User-agent: {b}\nDisallow: /\n\n" for b in _BLOCKED_SCRAPERS)
    ai_search = "".join(
        f"User-agent: {b}\nAllow: /\nAllow: /tiku/\nAllow: /llms.txt\nAllow: /llms-full.txt\n"
        "Disallow: /api/\nDisallow: /admin\n\n"
        for b in _ALLOWED_AI_SEARCH_BOTS
    )
    return PlainTextResponse(
        blocked
        + ai_search
        + "User-agent: *\nAllow: /\nAllow: /tiku/\nAllow: /llms.txt\nAllow: /llms-full.txt\n"
        + "Disallow: /api/\nDisallow: /admin\n"
        + f"Sitemap: {_url('/sitemap.xml')}\n"
        + f"# LLMs: {_url('/llms.txt')}\n"
        + f"# LLMs-Full: {_url('/llms-full.txt')}\n"
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
