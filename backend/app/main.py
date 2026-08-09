import base64
import hashlib
import json
import os
import re
import threading
import time

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import auth, db, engine, insights, interview, kb, llm, mock_event, omr, pdf_export, pk, plan, report, seo, similarity, social, taxonomy

app = FastAPI(title="考公错题助手")
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
app.include_router(auth.router)
app.include_router(insights.router)
app.include_router(social.router)
app.include_router(interview.router)
app.include_router(pk.router)
app.include_router(mock_event.router)
app.include_router(mock_event.admin_router)
app.include_router(report.router)
app.include_router(seo.router)
app.include_router(seo.root_router)

ACCESS_CODE = os.environ.get("ACCESS_CODE", "")


def check_access(x_access_code: str | None):
    if ACCESS_CODE and x_access_code != ACCESS_CODE:
        raise HTTPException(401, "访问码错误")


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


def _warmup():
    """启动后台预热题库热点索引页缓存，消除首个随机抽题/统计请求的冷启动秒级延迟。"""
    try:
        conn = db.get_conn()
        conn.execute("SELECT COUNT(*) FROM questions INDEXED BY idx_q_pick WHERE has_hs IS NOT NULL")
        conn.execute("SELECT COUNT(*) FROM questions INDEXED BY idx_q_tag3_disabled WHERE tag3 IS NOT NULL")
        conn.close()
    except Exception:
        pass


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


def _friendly_ai_err(e: Exception) -> str:
    if isinstance(e, httpx.HTTPStatusError):
        code = e.response.status_code
        if code in (402, 403, 429):
            return "AI 服务额度已用完，请稍后再试"
        return "AI 服务暂时不可用，请稍后再试"
    if isinstance(e, httpx.HTTPError):
        return "AI 服务连接失败，请稍后再试"
    return str(e)


def _cache_key(question_text: str | None, user_answer: str | None) -> str:
    raw = (question_text or "").strip() + "\n||\n" + (user_answer or "").strip()
    return hashlib.sha256(raw.encode()).hexdigest()

_ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
_H5_DIR = os.path.join(_ROOT, "frontend-uni", "dist", "build", "h5")
FRONTEND_DIR = _H5_DIR if os.path.isdir(_H5_DIR) else os.path.join(_ROOT, "frontend")


@app.post("/api/explain")
async def api_explain(
    image: UploadFile | None = File(None),
    text: str | None = Form(None),
    user_answer: str | None = Form(None),
    x_access_code: str | None = Header(None),
):
    check_access(x_access_code)
    if not image and not text:
        raise HTTPException(400, "需要图片或题目文字")
    image_b64 = None
    mime = None
    if image:
        raw = await image.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(400, "图片过大（限 8MB）")
        image_b64 = base64.b64encode(raw).decode()
        mime = image.content_type or "image/jpeg"
    if text and not image:
        raw_key = _cache_key(text, user_answer)
        hit = db.get_explain_cache(raw_key)
        if hit:
            return {
                "module": hit.get("module"),
                "module_name": kb.MODULES.get(hit.get("module"), {}).get("name"),
                "question_type": hit.get("question_type"),
                "question_text": hit.get("question_text"),
                "user_answer": hit.get("user_answer") or user_answer,
                "explain_key": raw_key,
                "cached": True,
                "explanation": hit["explanation"],
            }
    try:
        extracted = await engine.extract_question(image_b64, mime, text)
        ua = user_answer or extracted.get("user_answer")
        key = _cache_key(extracted.get("question_text"), ua)
        raw_key = _cache_key(text, ua) if text else None
        cached = db.get_explain_cache(key) or (db.get_explain_cache(raw_key) if raw_key else None)
        if cached:
            explanation = cached["explanation"]
        else:
            explanation = await engine.explain(extracted, user_answer)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"解析失败：{_friendly_ai_err(e)}") from e
    suspect = engine.is_suspect(extracted.get("question_text", ""))
    meta = {
        "module": None if suspect else extracted.get("module"),
        "module_name": None if suspect else kb.MODULES.get(extracted.get("module"), {}).get("name"),
        "question_type": None if suspect else extracted.get("question_type"),
        "question_text": extracted.get("question_text"),
        "user_answer": ua,
        "explain_key": key,
        "cached": bool(cached),
    }
    if not cached:
        db.save_explain_cache(key, meta, explanation)
        if raw_key and raw_key != key:
            db.save_explain_cache(raw_key, meta, explanation)
    return {**meta, "explanation": explanation}


@app.post("/api/explain/stream")
async def api_explain_stream(
    image: UploadFile | None = File(None),
    text: str | None = Form(None),
    user_answer: str | None = Form(None),
    x_access_code: str | None = Header(None),
):
    check_access(x_access_code)
    if not image and not text:
        raise HTTPException(400, "需要图片或题目文字")
    image_b64 = None
    mime = None
    if image:
        raw = await image.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(400, "图片过大（限 8MB）")
        image_b64 = base64.b64encode(raw).decode()
        mime = image.content_type or "image/jpeg"

    async def gen():
        try:
            if text and not image:
                rk = _cache_key(text, user_answer)
                hit = db.get_explain_cache(rk)
                if hit:
                    meta0 = {
                        "module": hit.get("module"),
                        "module_name": kb.MODULES.get(hit.get("module"), {}).get("name"),
                        "question_type": hit.get("question_type"),
                        "question_text": hit.get("question_text"),
                        "user_answer": hit.get("user_answer") or user_answer,
                        "explain_key": rk,
                        "cached": True,
                    }
                    yield "event: meta\ndata: " + json.dumps(meta0, ensure_ascii=False) + "\n\n"
                    yield "data: " + json.dumps({"d": hit["explanation"]}, ensure_ascii=False) + "\n\n"
                    yield "event: done\ndata: {}\n\n"
                    return
            extracted = await engine.extract_question(image_b64, mime, text)
            ua = user_answer or extracted.get("user_answer")
            key = _cache_key(extracted.get("question_text"), ua)
            raw_key = _cache_key(text, ua) if text else None
            cached = db.get_explain_cache(key) or (db.get_explain_cache(raw_key) if raw_key else None)
            suspect = engine.is_suspect(extracted.get("question_text", ""))
            meta = {
                "module": None if suspect else extracted.get("module"),
                "module_name": None if suspect else kb.MODULES.get(extracted.get("module"), {}).get("name"),
                "question_type": None if suspect else extracted.get("question_type"),
                "question_text": extracted.get("question_text"),
                "user_answer": ua,
                "explain_key": key,
                "cached": bool(cached),
            }
            yield "event: meta\ndata: " + json.dumps(meta, ensure_ascii=False) + "\n\n"
            if cached:
                yield "data: " + json.dumps({"d": cached["explanation"]}, ensure_ascii=False) + "\n\n"
            else:
                full = ""
                async for delta in engine.explain_stream(extracted, user_answer):
                    full += delta
                    yield "data: " + json.dumps({"d": delta}, ensure_ascii=False) + "\n\n"
                if full.strip():
                    db.save_explain_cache(key, meta, full)
                    if raw_key and raw_key != key:
                        db.save_explain_cache(raw_key, meta, full)
            yield "event: done\ndata: {}\n\n"
        except Exception as e:  # noqa: BLE001
            yield "event: error\ndata: " + json.dumps({"message": _friendly_ai_err(e)}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/similar")
async def api_similar(body: dict, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    qt = body.get("question_text")
    if not qt:
        raise HTTPException(400, "缺少 question_text")
    try:
        content = await engine.similar_question(qt, body.get("question_type"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"生成失败：{_friendly_ai_err(e)}") from e
    return {"content": content}


@app.post("/api/rate")
def api_rate(body: dict):
    up = bool(body.get("up"))
    if body.get("key"):
        db.rate_explain(str(body["key"]), up)
    elif body.get("question_id"):
        db.rate_question_hs(int(body["question_id"]), up)
    else:
        raise HTTPException(400, "缺少 key 或 question_id")
    return {"ok": True}


IMPORT_TOKEN = os.environ.get("IMPORT_TOKEN", "")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "") or IMPORT_TOKEN


def check_admin(x_admin_token: str | None):
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(401, "无效管理令牌")


@app.get("/api/admin/stats")
def api_admin_stats(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.admin_stats()


@app.get("/api/admin/llm_health")
async def api_admin_llm_health(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    out = []
    seen = set()
    for name, base in (("视觉/主通道", llm.BASE_URL), ("文字通道", llm.TEXT_BASE_URL), ("备用通道", llm.RESCUE_BASE_URL)):
        if not base or base in seen:
            continue
        seen.add(base)
        host = base.split("//")[-1].split("/")[0]
        masked = host[:6] + "…" + host[-10:] if len(host) > 20 else host
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=8.0)) as client:
                r = await client.get(f"{base}/v1/models")
            ok = r.status_code < 500
            out.append({"name": name, "host": masked, "ok": ok, "status": r.status_code})
        except Exception:
            out.append({"name": name, "host": masked, "ok": False, "status": "不可达"})
    return {"items": out}


@app.get("/api/admin/questions")
def api_admin_questions(
    keyword: str | None = None,
    module: str | None = None,
    flagged: int = 0,
    disabled: int = 0,
    offset: int = 0,
    limit: int = 20,
    qid: int | None = None,
    min_score: int | None = None,
    max_score: int | None = None,
    sort: str | None = None,
    x_admin_token: str | None = Header(None),
):
    check_admin(x_admin_token)
    return {
        "items": db.admin_search_questions(
            keyword, module, flagged=bool(flagged), disabled_only=bool(disabled), offset=offset, limit=limit, qid=qid,
            min_score=min_score, max_score=max_score, sort=sort,
        )
    }


@app.patch("/api/admin/questions/{qid}")
def api_admin_update_question(qid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    if "tag3" in body:
        code = (body["tag3"] or "").strip()
        if code and code != "UNKNOWN" and code not in taxonomy.topic_index():
            raise HTTPException(400, "未知考点 code")
        body["tag3"] = code or None
    if "options" in body:
        if not isinstance(body["options"], dict):
            raise HTTPException(400, "options 需为对象")
        body["options"] = json.dumps(body["options"], ensure_ascii=False)
    if not db.admin_update_question(qid, body):
        raise HTTPException(400, "无可更新字段或题目不存在")
    if "tag3" in body:
        db.tag3_review_close(qid)
    return {"ok": True}


@app.get("/api/taxonomy")
def api_taxonomy():
    """三级考点树 + 各级题目数。"""
    counts = db.tag3_counts()
    tree = json.loads(json.dumps(taxonomy.tree(), ensure_ascii=False))
    for m in tree["modules"]:
        mn = 0
        for g in m["groups"]:
            gn = 0
            for t in g["topics"]:
                t["n"] = counts.get(t["code"], 0)
                gn += t["n"]
            g["n"] = gn
            mn += gn
        m["n"] = mn
    tree["unknown"] = counts.get("UNKNOWN", 0)
    return tree


@app.get("/api/admin/taxonomy/questions")
def api_admin_taxonomy_questions(code: str, offset: int = 0, limit: int = 20, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.questions_by_tag3(code, offset=offset, limit=limit)}


@app.get("/api/admin/tag3_review")
def api_admin_tag3_review(limit: int = 100, module: str | None = None, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.tag3_review_list(limit, module)


@app.get("/api/admin/similar_questions")
def api_admin_similar_questions(qid: int, limit: int = 10, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    conn = db.get_conn()
    try:
        items = similarity.find_similar(conn, qid, limit=min(limit, 50))
    finally:
        conn.close()
    return {"qid": qid, "items": items}


@app.get("/api/admin/dup_clusters")
def api_admin_dup_clusters(offset: int = 0, limit: int = 20, status: str = "open", x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {**db.dup_cluster_list(offset=offset, limit=limit, status=status), "stats": db.dup_cluster_stats()}


@app.get("/api/admin/dup_clusters/{cluster_id}")
def api_admin_dup_cluster_detail(cluster_id: int, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"cluster_id": cluster_id, "items": db.dup_cluster_detail(cluster_id)}


@app.post("/api/admin/dup_clusters/{cluster_id}/resolve")
def api_admin_dup_cluster_resolve(cluster_id: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    keep = body.get("keep_qid")
    res = db.dup_cluster_resolve(cluster_id, int(keep) if keep is not None else None)
    if not res.get("ok"):
        raise HTTPException(400, res.get("error", "处理失败"))
    return res


@app.get("/api/admin/flagged_cache")
def api_admin_flagged_cache(limit: int = 30, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_flagged_cache(limit)}


@app.delete("/api/admin/cache/{key}")
def api_admin_delete_cache(key: str, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"ok": db.admin_delete_cache(key)}


_ADMIN_DIR = os.path.join(os.path.dirname(__file__), "admin")


@app.get("/admin")
def admin_page():
    return FileResponse(os.path.join(_ADMIN_DIR, "index.html"), media_type="text/html")


app.mount("/admin/static", StaticFiles(directory=_ADMIN_DIR), name="admin_static")


@app.get("/api/admin/dashboard")
def api_admin_dashboard(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.admin_dashboard()


@app.get("/api/admin/governance")
def api_admin_governance(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.governance_scan()


@app.get("/api/admin/users")
def api_admin_users(
    keyword: str | None = None,
    offset: int = 0,
    limit: int = 20,
    inactive_days: int | None = None,
    x_admin_token: str | None = Header(None),
):
    check_admin(x_admin_token)
    return db.admin_users(keyword, offset, limit, inactive_days)


@app.get("/api/admin/users/{uid}")
def api_admin_user_detail(uid: str, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    d = db.admin_user_detail(uid.strip()[:64])
    if not d:
        raise HTTPException(404, "用户不存在")
    return d


@app.get("/api/admin/shizheng")
def api_admin_shizheng(offset: int = 0, limit: int = 20, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.admin_shizheng(offset, limit)


@app.get("/api/admin/shenlun_overview")
def api_admin_shenlun_overview(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.admin_shenlun_overview()


@app.post("/api/admin/tag3_review/reopen")
def api_admin_tag3_review_reopen(body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    qid = int(body.get("question_id") or 0)
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    return {"ok": db.tag3_review_reopen(qid)}


@app.get("/api/admin/settings_info")
def api_admin_settings_info(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    tok = IMPORT_TOKEN or ""
    return {
        "import_token": ({"set": True, "masked": tok[:2] + "··" + tok[-4:]} if len(tok) >= 8
                         else {"set": bool(tok), "masked": "··"}),
        "llm_model": os.environ.get("LLM_MODEL", ""),
        "access_code_enabled": bool(ACCESS_CODE),
    }


@app.post("/api/followup")
async def api_followup(body: dict, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(400, "缺少追问内容")
    answer = await engine.followup(
        body.get("question_text") or "",
        body.get("explanation") or "",
        body.get("history") or [],
        query[:500],
    )
    return {"answer": answer}


@app.post("/api/coach")
async def api_coach(body: dict, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    stats = body.get("stats")
    if not isinstance(stats, dict):
        raise HTTPException(400, "缺少学习数据")
    prompt = (
        "你是公务员行测备考教练。根据以下学习数据，用中文给出简短、具体、可执行的学习建议。"
        "格式：## 本周诊断（2-3 句）、## 建议行动（3-4 条带序号，每条一句话，具体到模块/题型/每天题量）、"
        "## 一句鼓励。总字数 250 字以内，不要空话套话。\n\n学习数据（JSON）：\n"
        + json.dumps(stats, ensure_ascii=False)[:3000]
    )
    advice = await llm.chat_fast([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=800)
    return {"advice": advice}


@app.post("/api/user_state")
def api_user_state(body: dict):
    uid = (body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    db.set_user_state(uid[:64], str(body.get("focus") or "")[:32], str(body.get("note") or ""))
    return {"ok": True}


PROFILE_EXAM_TYPES = {"国考", "省考", "事业单位", "其他"}
PROFILE_BASE_LEVELS = {"零基础", "有基础", "二战"}


@app.get("/api/profile")
def api_profile_get(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"profile": db.get_user_profile(uid[:64])}


@app.post("/api/profile")
def api_profile_save(body: dict):
    uid = (body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    fields: dict = {}
    if "exam_type" in body:
        v = (body.get("exam_type") or "").strip()
        if v and v not in PROFILE_EXAM_TYPES:
            raise HTTPException(400, "考试类型无效")
        fields["exam_type"] = v or None
    if "target_region" in body:
        fields["target_region"] = (body.get("target_region") or "").strip()[:50] or None
    if "exam_date" in body:
        v = (body.get("exam_date") or "").strip()
        if v and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise HTTPException(400, "考试日期格式应为 YYYY-MM-DD")
        fields["exam_date"] = v or None
    if "target_score" in body:
        v = body.get("target_score")
        fields["target_score"] = max(0, min(100, int(v))) if v is not None else None
    if "daily_minutes" in body:
        v = body.get("daily_minutes")
        fields["daily_minutes"] = max(10, min(600, int(v))) if v is not None else None
    if "base_level" in body:
        v = (body.get("base_level") or "").strip()
        if v and v not in PROFILE_BASE_LEVELS:
            raise HTTPException(400, "基础自评无效")
        fields["base_level"] = v or None
    return {"profile": db.save_user_profile(uid[:64], fields)}


@app.get("/api/plan/today")
def api_plan_today(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return plan.today_plan(uid[:64])


@app.get("/api/daily_plan")
def api_daily_plan(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.daily_plan(uid[:64])


@app.get("/api/attempts")
def api_attempts(uid: str, question_id: int):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.question_attempts(uid[:64], question_id)}


@app.post("/api/export/pdf")
def api_export_pdf(body: dict):
    ids = [int(i) for i in (body.get("question_ids") or [])[:140]]
    items = body.get("items") or []
    questions = db.questions_by_ids(ids) if ids else []
    for it in items[:140]:
        if isinstance(it, dict) and (it.get("question") or "").strip():
            questions.append(
                {
                    "id": it.get("id"),
                    "module": it.get("module") or "",
                    "question": str(it.get("question"))[:2000],
                    "options": it.get("options") or {},
                    "answer": it.get("answer") or "",
                    "analysis": it.get("analysis") or "",
                    "material": it.get("material") or "",
                }
            )
    if not questions:
        raise HTTPException(400, "没有可导出的题目")
    code = hashlib.md5(
        (",".join(str(q.get("id") or q.get("question", "")[:20]) for q in questions)).encode()
    ).hexdigest()[:8].upper()
    db.save_paper_export(
        code,
        [int(q["id"]) for q in questions if q.get("id")],
        str(body.get("title") or "自选练习卷")[:40],
    )
    data = pdf_export.build_paper_pdf(
        title=str(body.get("title") or "自选练习卷")[:40],
        questions=questions,
        include_answers=bool(body.get("include_answers", True)),
        answer_sheet=bool(body.get("answer_sheet", True)),
        include_questions=bool(body.get("include_questions", True)),
        paper_code=code,
    )
    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="paper-{code}.pdf"', "X-Paper-Code": code},
    )


@app.get("/api/paper/{code}")
def api_paper_info(code: str):
    paper = db.get_paper_export(code.strip().upper()[:16])
    if not paper:
        raise HTTPException(404, "未找到该卷码对应的导出记录，请核对卷面右上角/封面的卷码")
    return {
        "code": paper["code"],
        "title": paper.get("title"),
        "n": len(paper["question_ids"]),
        "created_at": paper.get("created_at"),
    }


def _judge_paper(uid: str, paper: dict, picks: dict[int, str], secs: dict[int, int] | None = None) -> dict:
    """picks: {题号(从1开始): 'A'}；secs: {题号: 用时秒}；与扫描答题卡同一套判分/落库逻辑。"""
    qids = paper["question_ids"]
    questions = {q["id"]: q for q in db.questions_by_ids(qids)}
    results = []
    log_items = []
    for i, qid in enumerate(qids):
        q = questions.get(qid)
        if not q:
            continue
        picked = (picks.get(i + 1) or "").strip().upper()
        correct_ans = (q.get("answer") or "").strip().upper()[:1]
        status = "blank" if not picked else ("multi" if len(picked) > 1 else "ok")
        is_correct = status == "ok" and picked == correct_ans
        results.append(
            {
                "no": i + 1,
                "question_id": qid,
                "module": q.get("module"),
                "picked": picked,
                "answer": correct_ans,
                "correct": is_correct,
                "status": status,
                "secs": (secs or {}).get(i + 1) or 0,
                "question": (q.get("question") or "")[:80],
            }
        )
        if uid and status == "ok":
            log_items.append(
                {
                    "question_id": qid,
                    "module": q.get("module"),
                    "submodule": q.get("submodule"),
                    "correct": is_correct,
                    "picked": picked,
                    "secs": (secs or {}).get(i + 1) or 0,
                }
            )
            if not is_correct:
                db.save_mistake(
                    {
                        "uid": uid[:64],
                        "question_id": qid,
                        "module": q.get("module"),
                        "question_type": q.get("submodule"),
                        "question_text": q.get("question"),
                        "user_answer": picked,
                        "correct_answer": correct_ans,
                        "explanation": q.get("explanation") or q.get("hs_explanation") or "",
                    }
                )
    if uid and log_items:
        db.save_answer_log(uid[:64], log_items)
    answered = [r for r in results if r["status"] == "ok"]
    return {
        "code": paper["code"],
        "title": paper.get("title"),
        "total": len(results),
        "answered": len(answered),
        "correct": sum(1 for r in answered if r["correct"]),
        "saved": bool(uid and log_items),
        "items": results,
    }


@app.post("/api/paper_answers")
def api_paper_answers(body: dict):
    code = str(body.get("code") or "").strip().upper()[:16]
    paper = db.get_paper_export(code)
    if not paper:
        raise HTTPException(404, "未找到该卷码对应的导出记录")
    raw_picks = body.get("picks") or {}
    picks: dict[int, str] = {}
    for k, v in raw_picks.items():
        try:
            picks[int(k)] = str(v or "")[:1]
        except (TypeError, ValueError):
            continue
    if not picks:
        raise HTTPException(400, "没有已选择的答案")
    return _judge_paper(str(body.get("uid") or ""), paper, picks)


@app.post("/api/scan_sheet")
async def api_scan_sheet(uid: str = Form(""), image: UploadFile = File(...)):
    raw = await image.read()
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(400, "图片过大，请控制在 12MB 以内")
    try:
        rec = omr.recognize(raw)
    except ValueError as e:
        raise HTTPException(422, str(e))
    paper = db.get_paper_export(rec["code"])
    if not paper:
        raise HTTPException(404, f"未找到卷码 {rec['code']} 对应的导出记录")
    qids = paper["question_ids"]
    page = max(1, rec["page"])
    start = (page - 1) * omr.PER_PAGE
    page_ids = qids[start : start + omr.PER_PAGE]
    questions = {q["id"]: q for q in db.questions_by_ids(page_ids)}
    results = []
    log_items = []
    for slot, qid in enumerate(page_ids):
        q = questions.get(qid)
        if not q:
            continue
        picked = rec["picks"].get(slot, "")
        correct_ans = (q.get("answer") or "").strip().upper()[:1]
        status = "blank" if not picked else ("multi" if len(picked) > 1 else "ok")
        is_correct = status == "ok" and picked == correct_ans
        results.append(
            {
                "no": start + slot + 1,
                "question_id": qid,
                "picked": picked,
                "answer": correct_ans,
                "correct": is_correct,
                "status": status,
                "question": (q.get("question") or "")[:80],
            }
        )
        if uid and status == "ok":
            log_items.append(
                {
                    "question_id": qid,
                    "module": q.get("module"),
                    "submodule": q.get("submodule"),
                    "correct": is_correct,
                    "picked": picked,
                    "secs": 0,
                }
            )
            if not is_correct:
                db.save_mistake(
                    {
                        "uid": uid[:64],
                        "question_id": qid,
                        "module": q.get("module"),
                        "question_type": q.get("submodule"),
                        "question_text": q.get("question"),
                        "user_answer": picked,
                        "correct_answer": correct_ans,
                        "explanation": q.get("explanation") or q.get("hs_explanation") or "",
                    }
                )
    if uid and log_items:
        db.save_answer_log(uid[:64], log_items)
    answered = [r for r in results if r["status"] == "ok"]
    return {
        "code": rec["code"],
        "page": page,
        "title": paper.get("title"),
        "total": len(results),
        "answered": len(answered),
        "correct": sum(1 for r in answered if r["correct"]),
        "saved": bool(uid and log_items),
        "items": results,
    }


@app.post("/api/mistakes/analysis")
async def api_mistake_analysis(body: dict, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    uid = (body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    stats = db.mistake_analysis_stats(uid[:64])
    if not stats["mistake_types"]:
        return {"analysis": "错题本还没有待掌握的错题，先去刷题吧。"}
    prompt = (
        "你是公务员行测备考教练。根据用户的错题分布与近期作答数据，用中文生成一份简短错题分析。"
        "格式：## 错题画像（2-3 句，指出最集中的题型与错因）、## 薄弱点诊断（2-3 条带序号，"
        "结合正确率与做题速度）、## 复习建议（3 条带序号，具体到题型与做法）。"
        "总字数 300 字以内，不要空话套话。\n\n数据（JSON）：\n"
        + json.dumps(stats, ensure_ascii=False)[:3000]
    )
    analysis = await llm.chat_fast([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=900)
    return {"analysis": analysis, "stats": stats}


@app.post("/api/answer_log")
def api_answer_log(body: dict):
    uid = (body.get("uid") or "").strip()
    items = body.get("items")
    if not uid or not isinstance(items, list) or not items:
        raise HTTPException(400, "缺少 uid 或答题记录")
    n = db.save_answer_log(uid[:64], items[:200])
    return {"saved": n}


@app.get("/api/shizheng/daily")
def api_shizheng_daily(date: str | None = None, limit: int = 10):
    """按日期取当日一组时政题（同一天所有人相同，用日期作随机种子从底池抽）。"""
    day = (date or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day or ""):
        day = time.strftime("%Y-%m-%d")
    items = db.shizheng_daily(day, min(max(limit, 1), 20))
    return {"date": day, "items": items, "total": db.shizheng_count()}


@app.get("/api/growth")
def api_growth(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.growth_stats(uid[:64])


@app.get("/api/recommend")
def api_recommend(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.recommend_stats(uid[:64])


@app.post("/api/backup")
def api_backup_save(body: dict):
    data = body.get("data")
    if not isinstance(data, dict):
        raise HTTPException(400, "缺少备份数据")
    code = db.save_backup(body.get("code"), data)
    return {"code": code}


@app.get("/api/backup")
def api_backup_get(code: str):
    data = db.get_backup(code.strip().upper())
    if data is None:
        raise HTTPException(404, "恢复码不存在")
    return {"data": data}


@app.get("/api/questions/export")
def api_questions_export(offset: int = 0, limit: int = 200, module: str | None = None, all: int = 0):
    return {"items": db.export_questions(offset, min(limit, 500), module, missing_only=not all)}


@app.post("/api/questions/import")
def api_questions_import(body: dict, x_import_token: str | None = Header(None)):
    if not IMPORT_TOKEN or x_import_token != IMPORT_TOKEN:
        raise HTTPException(401, "无效导入令牌")
    batch = "b" + time.strftime("%Y%m%d%H%M%S")
    result = db.import_questions(body.get("items") or [], batch=batch)
    return result


@app.post("/api/questions/hs_import")
def api_questions_hs_import(body: dict, x_import_token: str | None = Header(None)):
    if not IMPORT_TOKEN or x_import_token != IMPORT_TOKEN:
        raise HTTPException(401, "无效导入令牌")
    n = db.import_hs_explanations(body.get("items") or [])
    return {"updated": n}


@app.get("/api/questions")
def api_questions(
    module: str | None = None,
    limit: int = 10,
    submodule: str | None = None,
    real: int = 0,
    year: int | None = None,
    region: str | None = None,
    uid: str | None = None,
    adaptive: int = 0,
    grouped: int = 0,
    tag3: str | None = None,
    mode: str | None = None,
):
    if mode == "reinforce" and uid:
        # 错题同考点强化：严格只出该 uid 未做过的新题，中等难度优先
        return {
            "items": db.reinforce_questions(
                uid.strip()[:64], tag3=tag3, module=module, submodule=submodule,
                limit=min(limit, 10),
            ),
            "counts": db.question_counts(),
        }
    if grouped and module == "ziliao" and not real:
        return {
            "items": db.grouped_ziliao_questions(min(limit, 50), uid=uid),
            "counts": db.question_counts(),
        }
    return {
        "items": db.random_questions(
            module, min(limit, 50), submodule, real_only=bool(real), year=year, region=region, uid=uid,
            adaptive=bool(adaptive), tag3=tag3,
        ),
        "counts": db.question_counts(),
    }


@app.post("/api/shenlun/import")
def api_shenlun_import(body: dict, x_import_token: str | None = Header(None)):
    if not IMPORT_TOKEN or x_import_token != IMPORT_TOKEN:
        raise HTTPException(401, "无效导入令牌")
    batch = "sl" + time.strftime("%Y%m%d%H%M%S")
    return db.import_shenlun(body.get("questions") or [], body.get("materials") or [], batch)


@app.get("/api/shenlun/questions")
def api_shenlun_questions(qtype: str | None = None, year: int | None = None, region: str | None = None, limit: int = 20, offset: int = 0):
    return db.shenlun_questions(qtype, year, region, limit, offset)


@app.get("/api/shenlun/filters")
def api_shenlun_filters():
    return db.shenlun_filters()


@app.get("/api/shenlun/questions/{qid}")
def api_shenlun_question(qid: int):
    item = db.shenlun_question(qid)
    if not item:
        raise HTTPException(404, "题目不存在")
    return {"item": item}


@app.post("/api/shenlun/grade")
async def api_shenlun_grade(body: dict, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    qid = body.get("qid")
    answer = (body.get("answer") or "").strip()
    if not qid or not answer:
        raise HTTPException(400, "缺少题目或作答内容")
    if len(answer) > 3000:
        raise HTTPException(400, "作答内容过长")
    q = db.shenlun_question(int(qid))
    if not q:
        raise HTTPException(404, "题目不存在")
    is_essay = "大作文" in (q.get("qtype") or "")
    if is_essay:
        rubric = (
            "这是申论大作文。不要给绝对分数，请输出：\n"
            "【立意判断】考生立意是否契合材料主旨（对照参考要点）\n"
            "【结构点评】标题/开头/分论点/结尾逐段简评\n"
            "【语言与规范】用词、政治规范性问题\n"
            "【提升建议】3 条最重要的改进方向\n"
            "【参考档位】仅给出 一类文/二类文/三类文/四类文 参考档位（注明仅供参考）"
        )
    else:
        rubric = (
            "请严格按采分点批改，输出：\n"
            "【命中要点】逐条列出考生答案命中的参考要点\n"
            "【遗漏要点】逐条列出遗漏的参考要点\n"
            "【冗余/错误】答非所问或表述错误之处\n"
            "【逐条点评】简要点评条理、概括度、字数控制\n"
            "【参考得分】x/满分（按命中要点比例估算，注明仅供参考）\n"
            "【提升建议】2-3 条"
        )
    prompt = (
        "你是资深申论阅卷人。以下是题目、给定资料摘要、参考要点和考生作答，请批改。\n\n"
        f"【题目/作答要求】\n{q['question']}\n\n"
        f"【参考要点】\n{q.get('reference') or '（无）'}\n\n"
        f"【考生作答】\n{answer}\n\n" + rubric +
        "\n\n要求：客观、具体、指出原文依据；不要复述整篇材料；控制在 600 字内。"
    )
    try:
        result = await llm.chat_fast([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=1500)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"批改失败：{_friendly_ai_err(e)}") from e
    uid = (body.get("uid") or "").strip()[:64]
    if uid:
        db.save_shenlun_answer(uid, int(qid), answer, result)
    return {"result": result, "essay": is_essay}


@app.get("/api/shenlun/history")
def api_shenlun_history(uid: str, qid: int | None = None, limit: int = 20):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.shenlun_answer_history(uid[:64], qid, limit)}


@app.get("/api/shenlun/stats")
def api_shenlun_stats(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.shenlun_stats(uid[:64])


@app.get("/api/shenlun/mat_favs")
def api_shenlun_mat_favs(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"ids": db.mat_fav_ids(uid[:64]), "items": db.mat_fav_items(uid[:64])}


@app.post("/api/shenlun/mat_favs")
def api_shenlun_mat_fav_set(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    mid = body.get("mid")
    if not uid or not mid:
        raise HTTPException(400, "缺少 uid 或素材 id")
    db.mat_fav_set(uid, int(mid), bool(body.get("on")))
    return {"ok": True}


@app.get("/api/shenlun/materials")
def api_shenlun_materials(topic: str | None = None, type: str | None = None, limit: int = 20, offset: int = 0):
    return {"items": db.shenlun_materials(topic, type, limit, offset)}


@app.get("/api/mistakes/redo")
def api_mistakes_redo(limit: int = 10, qtype: str | None = None, module: str | None = None, noqt: int = 0, uid: str | None = None):
    return {"items": db.mistakes_redo_questions(min(limit, 25), qtype=qtype, module=module, noqt=bool(noqt), uid=uid)}


_REPORT_REASONS = {"答案有误", "题目有错字/乱码", "选项有问题", "图片不清晰/缺失", "解析有误", "其他"}


@app.post("/api/report")
def api_report(body: dict):
    reason = str(body.get("reason") or "").strip()
    if reason not in _REPORT_REASONS:
        raise HTTPException(400, "无效的反馈类型")
    qid = body.get("question_id")
    rid = db.add_report(
        int(qid) if qid else None,
        reason,
        str(body.get("detail") or "")[:500],
    )
    return {"id": rid}


_QREPORT_TYPES = {"答案错误", "解析错误", "题干或选项错字", "图片缺失", "分类错误", "重复题", "其他"}


@app.post("/api/question_report")
def api_question_report(body: dict):
    rtype = str(body.get("type") or "").strip()
    if rtype not in _QREPORT_TYPES:
        raise HTTPException(400, "无效的纠错类型")
    try:
        qid = int(body.get("question_id") or 0)
    except (TypeError, ValueError):
        qid = 0
    if not qid:
        raise HTTPException(400, "缺少题目 ID")
    uid = str(body.get("uid") or "").strip()[:64] or None
    detail = str(body.get("detail") or "").strip()[:500]
    rid, updated = db.add_question_report(qid, uid, rtype, detail)
    return {"id": rid, "updated": updated}


@app.get("/api/admin/question_reports")
def api_admin_question_reports(status: str = "open", x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    st = status if status in ("open", "fixed", "rejected") else "open"
    return {"items": db.admin_list_reports(st), "open_count": db.admin_open_report_count()}


@app.patch("/api/admin/question_reports/{rid}")
def api_admin_patch_question_report(rid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    status = body.get("status")
    if status not in ("open", "fixed", "rejected"):
        raise HTTPException(400, "status 需为 open/fixed/rejected")
    note = body.get("note")
    if not db.admin_handle_report(rid, status, str(note)[:500] if note else None):
        raise HTTPException(404, "纠错记录不存在")
    return {"ok": True}


@app.get("/api/submodule_progress")
def api_submodule_progress(uid: str, module: str | None = None):
    return {"items": db.submodule_progress(uid, module)}


@app.get("/api/papers")
def api_papers():
    return {"items": db.list_papers()}


def _clean_int_map(raw: dict, as_str: bool = False) -> dict:
    out: dict = {}
    for k, v in (raw or {}).items():
        try:
            out[int(k)] = str(v or "")[:1] if as_str else max(0, min(int(v or 0), 86400))
        except (TypeError, ValueError):
            continue
    return out


@app.get("/api/exam/papers")
def api_exam_papers(kind: str | None = None, year: int | None = None,
                    region: str | None = None, uid: str | None = None):
    return {
        "items": db.list_exam_papers(kind, year, region, uid=(uid or "").strip()[:64] or None),
        "filters": db.exam_paper_filters(),
    }


@app.get("/api/exam/papers/{pid}")
def api_exam_paper_detail(pid: int):
    paper = db.get_exam_paper(pid)
    if not paper:
        raise HTTPException(404, "试卷不存在")
    return {"paper": paper}


@app.post("/api/exam/start")
def api_exam_start(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    if body.get("mini"):
        pid = db.create_mock_paper(n=30, duration_min=30)
    else:
        pid = body.get("paper_id")
        if not pid:
            raise HTTPException(400, "缺少 paper_id")
        pid = int(pid)
    paper = db.get_exam_paper(pid)
    if not paper:
        raise HTTPException(404, "试卷不存在")
    items = {q["id"]: q for q in db.questions_by_ids(paper["question_ids"])}
    ordered = [items[i] for i in paper["question_ids"] if i in items]
    if len(ordered) < 5:
        raise HTTPException(400, "试卷题目不足")
    attempt_id = db.start_exam_attempt(uid, pid)
    return {
        "attempt_id": attempt_id,
        "paper": {
            "id": paper["id"],
            "title": paper["title"],
            "kind": paper["kind"],
            "year": paper["year"],
            "region": paper["region"],
            "duration_min": paper["duration_min"],
            "n": len(ordered),
        },
        "items": ordered,
    }


@app.post("/api/exam/submit")
def api_exam_submit(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    attempt_id = body.get("attempt_id")
    if not uid or not attempt_id:
        raise HTTPException(400, "缺少 uid 或 attempt_id")
    attempt = db.get_exam_attempt(int(attempt_id))
    if not attempt or attempt["uid"] != uid:
        raise HTTPException(404, "答题记录不存在")
    if attempt["submitted_at"]:
        raise HTTPException(400, "该次模考已交卷")
    paper = db.get_exam_paper(attempt["paper_id"])
    if not paper:
        raise HTTPException(404, "试卷不存在")
    picks = _clean_int_map(body.get("picks") or {}, as_str=True)
    secs = _clean_int_map(body.get("secs") or {})
    judged = _judge_paper(uid, {"code": None, "title": paper["title"], "question_ids": paper["question_ids"]}, picks, secs)
    per_module: dict = {}
    for r in judged["items"]:
        m = r.get("module") or "other"
        pm = per_module.setdefault(m, {"n": 0, "answered": 0, "correct": 0, "secs": 0})
        pm["n"] += 1
        if r["status"] == "ok":
            pm["answered"] += 1
            if r["correct"]:
                pm["correct"] += 1
        pm["secs"] += r.get("secs") or 0
    total = judged["total"] or 1
    score = round(100.0 * judged["correct"] / total, 1)
    db.finish_exam_attempt(int(attempt_id), {str(k): v for k, v in picks.items()}, score, per_module)
    return {
        "attempt_id": int(attempt_id),
        "paper_id": paper["id"],
        "title": paper["title"],
        "score": score,
        "total": judged["total"],
        "answered": judged["answered"],
        "correct": judged["correct"],
        "per_module": per_module,
        "items": judged["items"],
    }


@app.get("/api/exam/attempts")
def api_exam_attempts(uid: str, paper_id: int | None = None, limit: int = 50):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.list_exam_attempts(uid, paper_id, limit)}


@app.get("/api/exam/report/{attempt_id}")
def api_exam_report(attempt_id: int, uid: str = ""):
    attempt = db.get_exam_attempt(attempt_id)
    if not attempt or not attempt["submitted_at"]:
        raise HTTPException(404, "成绩报告不存在")
    if uid and attempt["uid"] != uid.strip()[:64]:
        raise HTTPException(404, "成绩报告不存在")
    paper = db.get_exam_paper(attempt["paper_id"])
    if not paper:
        raise HTTPException(404, "试卷不存在")
    questions = {q["id"]: q for q in db.questions_by_ids(paper["question_ids"])}
    picks = {int(k): v for k, v in attempt["answers"].items()}
    items = []
    for i, qid in enumerate(paper["question_ids"]):
        q = questions.get(qid)
        if not q:
            continue
        picked = (picks.get(i + 1) or "").strip().upper()
        correct_ans = (q.get("answer") or "").strip().upper()[:1]
        items.append({
            "no": i + 1,
            "question_id": qid,
            "module": q.get("module"),
            "submodule": q.get("submodule"),
            "question": q.get("question"),
            "options": q.get("options"),
            "picked": picked,
            "answer": correct_ans,
            "correct": bool(picked) and len(picked) == 1 and picked == correct_ans,
            "explanation": q.get("explanation"),
            "hs_explanation": q.get("hs_explanation"),
        })
    answered = sum(1 for r in items if r["picked"] and len(r["picked"]) == 1)
    return {
        "attempt": {
            "id": attempt["id"],
            "paper_id": attempt["paper_id"],
            "started_at": attempt["started_at"],
            "submitted_at": attempt["submitted_at"],
            "score": attempt["score"],
            "per_module": attempt["per_module"],
        },
        "paper": {
            "id": paper["id"],
            "title": paper["title"],
            "kind": paper["kind"],
            "year": paper["year"],
            "region": paper["region"],
            "duration_min": paper["duration_min"],
            "question_ids": paper["question_ids"],
        },
        "total": len(items),
        "answered": answered,
        "correct": sum(1 for r in items if r["correct"]),
        "items": items,
    }


@app.get("/api/admin/exam_papers")
def api_admin_exam_papers(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.list_exam_papers()}


@app.get("/api/paper_questions")
def api_paper_questions(src: str):
    items = db.paper_questions(src)
    if not items:
        raise HTTPException(404, "试卷不存在或题目不足")
    return {"items": items}


@app.post("/api/admin/refresh_stats")
def api_admin_refresh_stats(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"updated": db.refresh_question_stats()}


@app.get("/api/admin/reports")
def api_admin_reports(status: str = "open", x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_list_reports(status if status in ("open", "resolved", "dismissed") else "open")}


@app.post("/api/admin/reports/{rid}/resolve")
def api_admin_resolve_report(rid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    status = body.get("status")
    if status not in ("resolved", "dismissed"):
        raise HTTPException(400, "status 需为 resolved 或 dismissed")
    return {"ok": db.admin_resolve_report(rid, status)}


@app.get("/api/admin/batches")
def api_admin_batches(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_batches_v3()}


@app.get("/api/admin/batches/{bid}/sample")
def api_admin_batch_sample(bid: str, limit: int = 10, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_batch_sample(bid, min(limit, 50)), "reviews": db.sample_reviews(bid)}


@app.post("/api/admin/batches/{bid}/sample_reviews")
def api_admin_batch_sample_review(bid: str, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    qid = int(body.get("question_id") or 0)
    verdict = body.get("verdict")
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    if verdict is None:
        db.sample_review_delete(bid, qid)
        return {"ok": True, "summary": db.sample_review_summary(bid)}
    if verdict not in ("ok", "problem"):
        raise HTTPException(400, "verdict 需为 ok/problem")
    note = str(body.get("note") or "")[:300] or None
    return {"ok": True, "summary": db.sample_review_set(bid, qid, verdict, note)}


@app.post("/api/admin/batches/{bid}/decide")
def api_admin_batch_decide(bid: str, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"n": db.admin_batch_decide(bid, bool(body.get("approve")))}


@app.get("/api/announcement")
def api_announcement():
    return {"item": db.active_announcement()}


@app.get("/api/admin/announcements")
def api_admin_announcements(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_list_announcements()}


@app.post("/api/admin/announcements")
def api_admin_create_announcement(body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "标题不能为空")
    return {"id": db.admin_create_announcement(title, (body.get("body") or "").strip())}


@app.patch("/api/admin/announcements/{aid}")
def api_admin_toggle_announcement(aid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    if not db.admin_set_announcement(aid, bool(body.get("active"))):
        raise HTTPException(404, "公告不存在")
    return {"ok": True}


@app.post("/api/practice_result")
def api_practice_result(body: dict):
    n = int(body.get("n") or 0)
    if not (0 < n <= 200):
        raise HTTPException(400, "无效题量")
    correct = max(0, min(int(body.get("correct") or 0), n))
    secs = max(0, min(int(body.get("secs") or 0), 86400))
    return db.save_practice_result(body.get("module"), n, correct, secs)


@app.get("/api/real_filters")
def api_real_filters():
    return db.real_filters()


@app.get("/api/submodules")
def api_submodules(module: str):
    return {"items": db.submodule_counts(module)}


@app.post("/api/mistakes")
def api_save_mistake(rec: dict):
    mid = db.save_mistake(rec)
    return {"id": mid}


@app.get("/api/mistakes")
def api_list_mistakes(uid: str = ""):
    items = db.list_mistakes(uid=uid.strip()[:64] or None)
    idx = taxonomy.topic_index()
    for m in items:
        t = idx.get(m.get("tag3") or "")
        m["tag3_name"] = t["name"] if t else None
    return {"items": items}


@app.patch("/api/mistakes/{mid}")
def api_update_mistake(mid: int, body: dict):
    db.update_mistake(mid, body)
    return {"ok": True}


@app.delete("/api/mistakes/{mid}")
def api_delete_mistake(mid: int):
    db.delete_mistake(mid)
    return {"ok": True}


@app.get("/api/review")
def api_review_due(uid: str = ""):
    u = uid.strip()[:64] or None
    return {"items": db.due_reviews(uid=u), "total": db.due_review_count(uid=u)}


@app.post("/api/review/{mid}")
def api_review_record(mid: int, body: dict):
    try:
        uid = (body.get("uid") or "").strip()[:64] or None
        return db.record_review(mid, bool(body.get("correct")), uid=uid)
    except KeyError:
        raise HTTPException(404, "错题不存在") from None


@app.get("/api/stats")
def api_stats(uid: str = ""):
    s = db.stats(uid=uid.strip()[:64] or None)
    for row in s["by_module"]:
        row["module"] = kb.MODULES.get(row["module"], {}).get("name", row["module"])
    return s


QIMG_DIR = os.path.join(os.path.dirname(db.DB_PATH) or ".", "qimg")
os.makedirs(QIMG_DIR, exist_ok=True)


@app.post("/api/questions/image")
def api_upload_qimg(body: dict, x_import_token: str | None = Header(None)):
    if not IMPORT_TOKEN or x_import_token != IMPORT_TOKEN:
        raise HTTPException(401, "无效导入令牌")
    name = str(body.get("name") or "")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}\.(png|jpg|jpeg|gif|webp|svg)", name):
        raise HTTPException(400, "文件名不合法")
    try:
        raw = base64.b64decode(body.get("b64") or "", validate=True)
    except Exception:
        raise HTTPException(400, "b64 解码失败") from None
    if not raw or len(raw) > 2 * 1024 * 1024:
        raise HTTPException(400, "图片为空或超过 2MB")
    with open(os.path.join(QIMG_DIR, name), "wb") as f:
        f.write(raw)
    return {"path": "/qimg/" + name}


@app.get("/sw.js", include_in_schema=False)
def api_sw_js():
    """Service Worker 需从站点根路径提供才能获得 '/' 作用域（H5 离线壳）。"""
    p = os.path.join(FRONTEND_DIR, "static", "sw.js")
    if not os.path.isfile(p):
        raise HTTPException(404, "not found")
    return FileResponse(p, media_type="application/javascript")


app.mount("/qimg", StaticFiles(directory=QIMG_DIR), name="qimg")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
