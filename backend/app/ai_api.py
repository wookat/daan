"""AI 能力面：拍照/文字解析、追问、教练建议、错题分析（LLM 调用统一友好降级）。"""
import base64
import json
import time

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from . import db, engine, kb, llm
from .deps import cache_key, check_access, friendly_ai_err, rl

router = APIRouter()


@router.post("/api/explain")
async def api_explain(
    request: Request,
    image: UploadFile | None = File(None),
    text: str | None = Form(None),
    user_answer: str | None = Form(None),
    x_access_code: str | None = Header(None),
):
    check_access(x_access_code)
    rl(request, "ai_explain", 20, 300)
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
        raw_key = cache_key(text, user_answer)
        hit = db.get_explain_cache(raw_key)
        if hit:
            return {
                "module": hit.get("module"),
                "module_name": kb.MODULES.get(hit.get("module") or "", {}).get("name"),
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
        key = cache_key(extracted.get("question_text"), ua)
        raw_key = cache_key(text, ua) if text else None
        cached = db.get_explain_cache(key) or (db.get_explain_cache(raw_key) if raw_key else None)
        if cached:
            explanation = cached["explanation"]
        else:
            explanation = await engine.explain(extracted, user_answer)
    except Exception as e:
        raise HTTPException(502, f"解析失败：{friendly_ai_err(e)}") from e
    suspect = engine.is_suspect(extracted.get("question_text", ""))
    meta = {
        "module": None if suspect else extracted.get("module"),
        "module_name": None if suspect else kb.MODULES.get(extracted.get("module") or "", {}).get("name"),
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


@router.post("/api/explain/stream")
async def api_explain_stream(
    request: Request,
    image: UploadFile | None = File(None),
    text: str | None = Form(None),
    user_answer: str | None = Form(None),
    x_access_code: str | None = Header(None),
):
    check_access(x_access_code)
    rl(request, "ai_explain", 20, 300)
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
                rk = cache_key(text, user_answer)
                hit = db.get_explain_cache(rk)
                if hit:
                    meta0 = {
                        "module": hit.get("module"),
                        "module_name": kb.MODULES.get(hit.get("module") or "", {}).get("name"),
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
            key = cache_key(extracted.get("question_text"), ua)
            raw_key = cache_key(text, ua) if text else None
            cached = db.get_explain_cache(key) or (db.get_explain_cache(raw_key) if raw_key else None)
            suspect = engine.is_suspect(extracted.get("question_text", ""))
            meta = {
                "module": None if suspect else extracted.get("module"),
                "module_name": None if suspect else kb.MODULES.get(extracted.get("module") or "", {}).get("name"),
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
        except Exception as e:
            yield "event: error\ndata: " + json.dumps({"message": friendly_ai_err(e)}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/api/ask/sessions")
def api_ask_sessions_list(uid: str = ""):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.list_ask_sessions(uid)}


@router.post("/api/ask/sessions")
def api_ask_sessions_save(body: dict, request: Request):
    uid = str(body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rl(request, "asksess", 60, 3600, uid)
    sid = body.get("sid")
    ts = body.get("ts")
    if not isinstance(sid, int) or isinstance(sid, bool) or sid <= 0:
        raise HTTPException(400, "无效的会话")
    if not isinstance(ts, int) or isinstance(ts, bool) or ts <= 0:
        raise HTTPException(400, "无效的会话")
    title = str(body.get("title") or "").strip()[:60] or "问答会话"
    n = body.get("n")
    if isinstance(n, bool) or not isinstance(n, int) or not (1 <= n <= 50):
        raise HTTPException(400, "无效的会话")
    items = body.get("items")
    if not isinstance(items, list) or not items or len(items) > 50 or not all(isinstance(x, dict) for x in items):
        raise HTTPException(400, "无效的会话")
    items_json = json.dumps(items, ensure_ascii=False)
    if len(items_json) > 200_000:
        raise HTTPException(400, "会话过大")
    db.save_ask_session(uid, sid, ts, title, n, items_json)
    return {"ok": True}


@router.delete("/api/ask/sessions/{sid}")
def api_ask_sessions_delete(sid: int, uid: str = ""):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    db.delete_ask_session(uid, sid)
    return {"ok": True}


@router.post("/api/ask/cur")
def api_ask_cur_save(body: dict, request: Request):
    uid = str(body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rl(request, "askcur", 120, 3600, uid)
    items = body.get("items")
    if not isinstance(items, list) or len(items) > 50 or not all(isinstance(x, dict) for x in items):
        raise HTTPException(400, "无效的会话")
    if not items:
        db.clear_ask_cur(uid)
        return {"ok": True}
    sid = body.get("sid")
    if sid is None:
        sid = 0
    if isinstance(sid, bool) or not isinstance(sid, int) or sid < 0:
        raise HTTPException(400, "无效的会话")
    ts = body.get("ts")
    if isinstance(ts, bool) or not isinstance(ts, int) or ts <= 0:
        raise HTTPException(400, "无效的会话")
    items_json = json.dumps(items, ensure_ascii=False)
    if len(items_json) > 200_000:
        raise HTTPException(400, "会话过大")
    db.save_ask_cur(uid, sid, ts, items_json)
    return {"ok": True}


@router.get("/api/ask/cur")
def api_ask_cur_get(uid: str = ""):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    d = db.get_ask_cur(uid)
    if not d or time.time() - d["updated_at"] > 7 * 24 * 3600:
        return {}
    return {"sid": d["sid"], "ts": d["ts"], "items": d["items"]}


@router.post("/api/similar")
async def api_similar(body: dict, request: Request, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    rl(request, "ai_similar", 30, 300, body.get("uid"))
    qt = body.get("question_text")
    if not qt:
        raise HTTPException(400, "缺少 question_text")
    try:
        content = await engine.similar_question(qt, body.get("question_type"))
    except Exception as e:
        raise HTTPException(502, friendly_ai_err(e)) from e
    return {"content": content}


@router.post("/api/rate")
def api_rate(body: dict, request: Request):
    rl(request, "rate", 60, 600)
    up = bool(body.get("up"))
    if body.get("key"):
        db.rate_explain(str(body["key"]), up)
    elif body.get("question_id"):
        db.rate_question_hs(int(body["question_id"]), up)
    else:
        raise HTTPException(400, "缺少 key 或 question_id")
    return {"ok": True}

@router.post("/api/followup")
async def api_followup(body: dict, request: Request, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    rl(request, "ai_followup", 30, 300, body.get("uid"))
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(400, "缺少追问内容")
    try:
        answer = await engine.followup(
            body.get("question_text") or "",
            body.get("explanation") or "",
            body.get("history") or [],
            query[:500],
        )
    except Exception as e:
        raise HTTPException(502, friendly_ai_err(e)) from e
    return {"answer": answer}


@router.post("/api/coach")
async def api_coach(body: dict, request: Request, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    rl(request, "ai_coach", 20, 300, body.get("uid"))
    stats = body.get("stats")
    if not isinstance(stats, dict):
        raise HTTPException(400, "缺少学习数据")
    prompt = (
        "你是公务员行测备考教练。根据以下学习数据，用中文给出简短、具体、可执行的学习建议。"
        "格式：## 本周诊断（2-3 句）、## 建议行动（3-4 条带序号，每条一句话，具体到模块/题型/每天题量）、"
        "## 一句鼓励。总字数 250 字以内，不要空话套话。\n\n学习数据（JSON）：\n"
        + json.dumps(stats, ensure_ascii=False)[:3000]
    )
    try:
        advice = await llm.chat_fast([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=800)
    except Exception as e:
        raise HTTPException(502, friendly_ai_err(e)) from e
    return {"advice": advice}

@router.post("/api/mistakes/analysis")
async def api_mistake_analysis(body: dict, request: Request, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    rl(request, "ai_mistake_analysis", 10, 300, body.get("uid"))
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
    try:
        analysis = await llm.chat_fast([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=900)
    except Exception as e:
        raise HTTPException(502, friendly_ai_err(e)) from e
    return {"analysis": analysis, "stats": stats}
