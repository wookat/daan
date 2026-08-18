"""应用装配层：中间件、路由挂载、静态资源与后台预热线程（业务路由见各域模块）。"""
import hashlib
import json
import mimetypes
import os
import threading
import time

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import Headers

from . import (
    admin_api,
    ai_api,
    auth,
    db,
    exam_api,
    insights,
    interview,
    mock_event,
    pk,
    qbank_api,
    report,
    seo,
    shenlun_api,
    social,
    study_api,
    team,
)
from .deps import ACCESS_CODE

app = FastAPI(title="上岸错题")
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
app.include_router(insights.router)
app.include_router(social.router)
app.include_router(interview.router)
app.include_router(pk.router)
app.include_router(mock_event.router)
app.include_router(mock_event.admin_router)
app.include_router(report.router)
app.include_router(team.router)
app.include_router(seo.router)
app.include_router(seo.root_router)
app.include_router(ai_api.router)
app.include_router(qbank_api.router)
app.include_router(study_api.router)
app.include_router(exam_api.router)
app.include_router(shenlun_api.router)
app.include_router(admin_api.router)


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


def _warmup():
    """周期预热抽题 id 池与热点索引页，消除缓存被换出后的冷启动秒级延迟。"""
    while True:
        try:
            for m in (None, "yanyu", "changshi", "panduan", "shuliang", "ziliao"):
                db.random_questions(m, 1)
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
        resp = await super().get_response(path, scope)
        if is_asset and resp.status_code == 200:
            resp.headers["Cache-Control"] = self._CACHE
        elif resp.status_code == 200 and "text/html" in (resp.headers.get("content-type") or ""):
            # SPA 壳（index.html）每次回源协商（ETag 命中返 304），避免启发式缓存供给旧壳引用已下线的 hash chunk
            resp.headers["Cache-Control"] = "no-cache"
        return resp


app.mount("/qimg", StaticFiles(directory=qbank_api.QIMG_DIR), name="qimg")
app.mount("/", AssetStaticFiles(directory=FRONTEND_DIR, html=True), name="static")
