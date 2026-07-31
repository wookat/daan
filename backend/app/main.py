import base64
import hashlib
import json
import os
import time

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import db, engine, kb

app = FastAPI(title="考公错题助手")

ACCESS_CODE = os.environ.get("ACCESS_CODE", "")


def check_access(x_access_code: str | None):
    if ACCESS_CODE and x_access_code != ACCESS_CODE:
        raise HTTPException(401, "访问码错误")

db.init_db()


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
        raise HTTPException(502, f"解析失败：{e}") from e
    meta = {
        "module": extracted.get("module"),
        "module_name": kb.MODULES.get(extracted.get("module"), {}).get("name"),
        "question_type": extracted.get("question_type"),
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
            meta = {
                "module": extracted.get("module"),
                "module_name": kb.MODULES.get(extracted.get("module"), {}).get("name"),
                "question_type": extracted.get("question_type"),
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
            yield "event: error\ndata: " + json.dumps({"message": str(e)}, ensure_ascii=False) + "\n\n"

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
        raise HTTPException(502, f"生成失败：{e}") from e
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


@app.get("/api/admin/questions")
def api_admin_questions(
    keyword: str | None = None,
    module: str | None = None,
    flagged: int = 0,
    disabled: int = 0,
    offset: int = 0,
    limit: int = 20,
    x_admin_token: str | None = Header(None),
):
    check_admin(x_admin_token)
    return {
        "items": db.admin_search_questions(
            keyword, module, flagged=bool(flagged), disabled_only=bool(disabled), offset=offset, limit=limit
        )
    }


@app.patch("/api/admin/questions/{qid}")
def api_admin_update_question(qid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    if not db.admin_update_question(qid, body):
        raise HTTPException(400, "无可更新字段或题目不存在")
    return {"ok": True}


@app.get("/api/admin/flagged_cache")
def api_admin_flagged_cache(limit: int = 30, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_flagged_cache(limit)}


@app.delete("/api/admin/cache/{key}")
def api_admin_delete_cache(key: str, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"ok": db.admin_delete_cache(key)}


_ADMIN_HTML = os.path.join(os.path.dirname(__file__), "admin.html")


@app.get("/admin")
def admin_page():
    return FileResponse(_ADMIN_HTML, media_type="text/html")


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
):
    return {
        "items": db.random_questions(
            module, min(limit, 50), submodule, real_only=bool(real), year=year, region=region
        ),
        "counts": db.question_counts(),
    }


@app.get("/api/admin/batches")
def api_admin_batches(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_batches()}


@app.get("/api/admin/batches/{bid}/sample")
def api_admin_batch_sample(bid: str, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_batch_sample(bid)}


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
def api_list_mistakes():
    return {"items": db.list_mistakes()}


@app.patch("/api/mistakes/{mid}")
def api_update_mistake(mid: int, body: dict):
    db.update_mistake(mid, body)
    return {"ok": True}


@app.delete("/api/mistakes/{mid}")
def api_delete_mistake(mid: int):
    db.delete_mistake(mid)
    return {"ok": True}


@app.get("/api/review")
def api_review_due():
    return {"items": db.due_reviews()}


@app.post("/api/review/{mid}")
def api_review_record(mid: int, body: dict):
    try:
        return db.record_review(mid, bool(body.get("correct")))
    except KeyError:
        raise HTTPException(404, "错题不存在") from None


@app.get("/api/stats")
def api_stats():
    s = db.stats()
    for row in s["by_module"]:
        row["module"] = kb.MODULES.get(row["module"], {}).get("name", row["module"])
    return s


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
