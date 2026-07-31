import base64
import hashlib
import json
import os

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
    try:
        extracted = await engine.extract_question(image_b64, mime, text)
        ua = user_answer or extracted.get("user_answer")
        key = _cache_key(extracted.get("question_text"), ua)
        cached = db.get_explain_cache(key)
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
            extracted = await engine.extract_question(image_b64, mime, text)
            ua = user_answer or extracted.get("user_answer")
            key = _cache_key(extracted.get("question_text"), ua)
            cached = db.get_explain_cache(key)
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
async def api_rate(body: dict):
    up = bool(body.get("up"))
    if body.get("key"):
        db.rate_explain(str(body["key"]), up)
    elif body.get("question_id"):
        db.rate_question_hs(int(body["question_id"]), up)
    else:
        raise HTTPException(400, "缺少 key 或 question_id")
    return {"ok": True}


IMPORT_TOKEN = os.environ.get("IMPORT_TOKEN", "")


@app.get("/api/questions/export")
async def api_questions_export(offset: int = 0, limit: int = 200, module: str | None = None):
    return {"items": db.export_questions(offset, min(limit, 500), module)}


@app.post("/api/questions/hs_import")
async def api_questions_hs_import(body: dict, x_import_token: str | None = Header(None)):
    if not IMPORT_TOKEN or x_import_token != IMPORT_TOKEN:
        raise HTTPException(401, "无效导入令牌")
    n = db.import_hs_explanations(body.get("items") or [])
    return {"updated": n}


@app.get("/api/questions")
async def api_questions(module: str | None = None, limit: int = 10, submodule: str | None = None):
    return {
        "items": db.random_questions(module, min(limit, 30), submodule),
        "counts": db.question_counts(),
    }


@app.get("/api/submodules")
async def api_submodules(module: str):
    return {"items": db.submodule_counts(module)}


@app.post("/api/mistakes")
async def api_save_mistake(rec: dict):
    mid = db.save_mistake(rec)
    return {"id": mid}


@app.get("/api/mistakes")
async def api_list_mistakes():
    return {"items": db.list_mistakes()}


@app.patch("/api/mistakes/{mid}")
async def api_update_mistake(mid: int, body: dict):
    db.update_mistake(mid, body)
    return {"ok": True}


@app.delete("/api/mistakes/{mid}")
async def api_delete_mistake(mid: int):
    db.delete_mistake(mid)
    return {"ok": True}


@app.get("/api/review")
async def api_review_due():
    return {"items": db.due_reviews()}


@app.post("/api/review/{mid}")
async def api_review_record(mid: int, body: dict):
    try:
        return db.record_review(mid, bool(body.get("correct")))
    except KeyError:
        raise HTTPException(404, "错题不存在") from None


@app.get("/api/stats")
async def api_stats():
    s = db.stats()
    for row in s["by_module"]:
        row["module"] = kb.MODULES.get(row["module"], {}).get("name", row["module"])
    return s


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
