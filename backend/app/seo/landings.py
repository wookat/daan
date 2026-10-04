"""分享落地页：/s/{sid} 分享卡、/p/{rid} PK 战绩短链。"""

from urllib.parse import quote

from fastapi.responses import HTMLResponse, RedirectResponse

from .. import db
from .common import SITE_BASE, _e, _module_name, _url, root_router


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
        f'<meta property="og:site_name" content="岸上见">'
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
    summary = f"岸上见答题 PK（{mod}）实时对局战绩，免注册打开即可应战。"
    spa = f"/#/pkgA/share/pk-result?rid={quote(code)}"
    page_url = _url(f"/p/{quote(code)}")
    return HTMLResponse(
        '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex">'
        f"<title>{_e(title)}</title>"
        f'<meta name="description" content="{_e(summary)}">'
        f'<meta property="og:type" content="website">'
        f'<meta property="og:site_name" content="岸上见">'
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
