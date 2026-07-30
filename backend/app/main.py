import base64
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
        explanation = await engine.explain(extracted, user_answer)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"解析失败：{e}") from e
    return {
        "module": extracted.get("module"),
        "module_name": kb.MODULES.get(extracted.get("module"), {}).get("name"),
        "question_type": extracted.get("question_type"),
        "question_text": extracted.get("question_text"),
        "user_answer": user_answer or extracted.get("user_answer"),
        "explanation": explanation,
    }


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
            meta = {
                "module": extracted.get("module"),
                "module_name": kb.MODULES.get(extracted.get("module"), {}).get("name"),
                "question_type": extracted.get("question_type"),
                "question_text": extracted.get("question_text"),
                "user_answer": user_answer or extracted.get("user_answer"),
            }
            yield "event: meta\ndata: " + json.dumps(meta, ensure_ascii=False) + "\n\n"
            async for delta in engine.explain_stream(extracted, user_answer):
                yield "data: " + json.dumps({"d": delta}, ensure_ascii=False) + "\n\n"
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


@app.post("/api/mistakes")
async def api_save_mistake(rec: dict):
    mid = db.save_mistake(rec)
    return {"id": mid}


@app.get("/api/mistakes")
async def api_list_mistakes():
    return {"items": db.list_mistakes()}


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
