"""应用装配层：中间件、路由挂载、静态资源与后台预热线程（业务路由见各域模块）。"""
import hashlib
import json
import mimetypes
import os
import threading
import time

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import (
    admin_api,
    ai_api,
    auth,
    db,
    exam_api,
    insights,
    interview,
    mock_event,
    monitor,
    pk,
    push_api,
    qbank_api,
    report,
    seo,
    shenlun_api,
    social,
    study_api,
    team,
    zalize_sso,
)
from .deps import ACCESS_CODE

_DOCS_OFF = os.environ.get("DISABLE_API_DOCS") == "1"
app = FastAPI(
    title="错题邦",
    docs_url=None if _DOCS_OFF else "/docs",
    redoc_url=None if _DOCS_OFF else "/redoc",
    openapi_url=None if _DOCS_OFF else "/openapi.json",
)
# Android App（Capacitor WebView，origin 为 https://localhost）跨域访问 API
APP_ORIGINS = os.environ.get(
    "APP_CORS_ORIGINS", "https://localhost,capacitor://localhost,http://localhost"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in APP_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Paper-Code"],
)


@app.middleware("http")
async def report_5xx(request, call_next):
    """集中式错误监控（审计 P1-7）：后端 5xx 与未捕获异常转发中心收集器。"""
    try:
        response = await call_next(request)
    except Exception as exc:
        monitor.report("5xx", f"{type(exc).__name__}: {exc}",
                       url=str(request.url), status=500)
        raise
    if response.status_code >= 500:
        monitor.report("5xx",
                       f"HTTP {response.status_code} {request.method} {request.url.path}",
                       url=str(request.url), status=response.status_code)
    return response


@app.post("/api/monitor/report")
async def monitor_report(request: Request):
    """前端未捕获 JS 错误同源上报，由后端转发中心收集器（不向浏览器暴露中心 key）。"""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="bad_json")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="bad_json")
    monitor.report(
        "js",
        str(body.get("message") or "(no message)"),
        stack=str(body.get("stack")) if body.get("stack") else None,
        url=str(body.get("url")) if body.get("url") else None,
        ua=request.headers.get("User-Agent"),
    )
    return {"ok": True}


@app.middleware("http")
async def log_slow_requests(request, call_next):
    """慢请求留痕：>3s 打点路径与耗时，用于定位生产间歇性长尾。"""
    t0 = time.monotonic()
    response = await call_next(request)
    dt = time.monotonic() - t0
    if dt >= 3.0:
        q = ("?" + request.url.query) if request.url.query else ""
        print(f"[slow-req] {dt:.1f}s {request.method} {request.url.path}{q}", flush=True)
    return response


@app.middleware("http")
async def guard_account_uid(request, call_next):
    """账号态 uid（u<id>）可被枚举，统一要求携带本人 Bearer token 才可按该 uid 读写。

    匿名随机 uid 不受影响（其本身即凭据）。覆盖 query 与 JSON body 两处 uid。
    """
    uid = request.query_params.get("uid")
    body = b""
    if (
        not auth.is_account_uid(uid)
        and request.method in ("POST", "PATCH", "PUT", "DELETE")
        and "json" in (request.headers.get("content-type") or "")
    ):
        body = await request.body()
        try:
            parsed = json.loads(body or b"{}")
            uid = parsed.get("uid") if isinstance(parsed, dict) else None
        except (ValueError, TypeError):
            uid = None
    if auth.is_account_uid(uid) and not auth.owns_uid(uid, request.headers.get("authorization")):
        return JSONResponse({"detail": "无权访问该账号数据，请重新登录"}, status_code=403)
    if body:
        async def _receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(request.scope, _receive)
    return await call_next(request)


app.include_router(auth.router)
app.include_router(zalize_sso.router)
app.include_router(insights.router)
app.include_router(social.router)
app.include_router(interview.router)
app.include_router(pk.router)
app.include_router(mock_event.router)
app.include_router(mock_event.admin_router)
app.include_router(report.router)
app.include_router(team.router)
app.include_router(push_api.router)
app.include_router(seo.router)
app.include_router(seo.root_router)
app.include_router(ai_api.router)
app.include_router(qbank_api.router)
app.include_router(study_api.router)
app.include_router(exam_api.router)
app.include_router(shenlun_api.router)
app.include_router(admin_api.router)


def _build_rev() -> str:
    """部署脚本写入的代码版本戳（backend/BUILD_REV），用于校验线上容器实际运行的代码版本。"""
    try:
        p = os.path.join(os.path.dirname(__file__), "..", "BUILD_REV")
        with open(p, encoding="utf-8") as f:
            return f.read().strip() or "dev"
    except OSError:
        return "dev"


BUILD_REV = _build_rev()


@app.get("/api/health")
def api_health():
    """存活探针：走完整请求链路（事件循环→线程池→SQLite 读），供容器 healthcheck 判定假死。"""
    db.get_conn().execute("SELECT 1").fetchone()
    return {"ok": True, "rev": BUILD_REV}


@app.get("/api/access_info")
def api_access_info():
    """客户端进入 AI 功能前查询是否需要访问码（不泄露访问码本身）。"""
    return {"required": bool(ACCESS_CODE)}


db.init_db()
auth.init_auth_db()
social.init_social_db()
interview.init_interview_db()
pk.init_pk_db()
mock_event.init_mock_event_db()
report.init_report_db()
team.init_team_db()


_HOT_UID_TABLES = (
    "answer_log", "review_log", "user_profile", "question_favs", "fav_folders",
    "question_notes", "question_comments", "comment_likes", "growth_events",
    "mistakes", "pk_matches", "interview_sessions", "shenlun_answers",
)


def _warmup():
    """周期预热抽题 id 池、热点索引页与 uid 热表（总量 <1MB），消除缓存被换出后的冷启动分钟级长尾。"""
    while True:
        try:
            for m in (None, "yanyu", "changshi", "panduan", "shuliang", "ziliao"):
                db.random_questions(m, 1)
            db.daily_set_ids(db.cn_day())
            db.daily_set_ids(
                time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600 + 86400))
            )
            conn = db.get_conn()
            try:
                for t in _HOT_UID_TABLES:
                    try:
                        conn.execute(f"SELECT * FROM {t}").fetchall()
                    except Exception:
                        pass
            finally:
                conn.close()
        except Exception:
            pass
        time.sleep(300)


threading.Thread(target=_warmup, daemon=True).start()


def _stats_refresher():
    while True:
        try:
            db.refresh_question_stats()
            db.refresh_material_hash()
        except Exception:
            pass
        time.sleep(6 * 3600)


threading.Thread(target=_stats_refresher, daemon=True).start()


def _fts_backfiller():
    """搜索索引后台分批回填（首次建表 13.5 万题避免阻塞启动）。"""
    while True:
        try:
            if insights.fts_backfill() == 0:
                time.sleep(3600)
                continue
        except Exception:
            time.sleep(600)
            continue
        time.sleep(2)


threading.Thread(target=_fts_backfiller, daemon=True).start()

push_api.start_push_thread()

_ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
_H5_DIR = os.path.join(_ROOT, "frontend-uni", "dist", "build", "h5")
FRONTEND_DIR = _H5_DIR if os.path.isdir(_H5_DIR) else os.path.join(_ROOT, "frontend")

app.mount("/admin/static", StaticFiles(directory=admin_api.ADMIN_DIR), name="admin_static")


@app.get("/sw.js", include_in_schema=False)
def api_sw_js(if_none_match: str | None = Header(None)):
    """Service Worker 需从站点根路径提供才能获得 '/' 作用域（H5 离线壳）。"""
    p = os.path.join(FRONTEND_DIR, "static", "sw.js")
    if not os.path.isfile(p):
        raise HTTPException(404, "not found")
    # SW 脚本必须免启发式缓存：否则浏览器最长 24h 不回源校验，新发版对存量用户长时间不生效。
    # FileResponse 只生成 ETag 不做条件判断，这里自行处理 If-None-Match 返 304
    st = os.stat(p)
    etag = f'"{hashlib.md5(f"{st.st_mtime}-{st.st_size}".encode()).hexdigest()}"'
    headers = {"Cache-Control": "no-cache", "ETag": etag}
    if if_none_match and etag in {t.strip() for t in if_none_match.split(",")}:
        return Response(status_code=304, headers=headers)
    return FileResponse(p, media_type="application/javascript", headers=headers)


_NOT_FOUND_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>页面不存在（404）｜错题邦</title>
<style>
body{margin:0;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7fb;color:#1f2329;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{max-width:420px;padding:40px 32px;text-align:center}
h1{font-size:64px;margin:0;color:#3b6df0}
p{color:#5a6472;line-height:1.7}
a{display:inline-block;margin-top:16px;padding:10px 28px;background:#3b6df0;color:#fff;border-radius:24px;text-decoration:none}
</style>
</head>
<body>
<div class="card">
<h1>404</h1>
<p>你要找的页面不存在或已被移动。<br>可以回到错题邦首页继续刷题。</p>
<a href="/">返回首页</a>
</div>
</body>
</html>
"""


class AssetStaticFiles(StaticFiles):
    """带 hash 的 /assets/* 长缓存；存在预压缩 .br 产物时优先返回（比 gzip 小约 15-20%）。"""

    _CACHE = "public, max-age=31536000, immutable"

    async def get_response(self, path: str, scope):
        is_asset = path.startswith("assets/")
        if is_asset and "br" in Headers(scope=scope).get("accept-encoding", ""):
            br = os.path.join(self.directory, path + ".br")
            if os.path.isfile(br):
                media_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
                return FileResponse(
                    br,
                    media_type=media_type,
                    headers={
                        "Content-Encoding": "br",
                        "Vary": "Accept-Encoding",
                        "Cache-Control": self._CACHE,
                    },
                )
        try:
            resp = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and "text/html" in Headers(scope=scope).get("accept", ""):
                return HTMLResponse(_NOT_FOUND_HTML, status_code=404, headers={"Cache-Control": "no-cache"})
            raise
        if is_asset and resp.status_code == 200:
            resp.headers["Cache-Control"] = self._CACHE
        elif resp.status_code == 200 and "text/html" in (resp.headers.get("content-type") or ""):
            # SPA 壳（index.html）每次回源协商（ETag 命中返 304），避免启发式缓存供给旧壳引用已下线的 hash chunk
            resp.headers["Cache-Control"] = "no-cache"
        return resp


app.mount("/qimg", StaticFiles(directory=qbank_api.QIMG_DIR), name="qimg")
app.mount("/", AssetStaticFiles(directory=FRONTEND_DIR, html=True), name="static")
