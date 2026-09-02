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

from .. import db, kb, taxonomy
from .common import (
    INDEXNOW_KEY,
    SITE_BASE,
    SITEMAP_SHARD,
    _e,
    _module_name,
    _shenlun_paper_path,
    _shenlun_sucai_path,
    _sub_path,
    _topic_path,
    _url,
    _year_path,
    root_router,
)
from .pages import _daily_archive_days


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
