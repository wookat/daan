import base64
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import db, engine, kb

app = FastAPI(title="考公错题助手")

db.init_db()

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")


@app.post("/api/explain")
async def api_explain(
    image: UploadFile | None = File(None),
    text: str | None = Form(None),
    user_answer: str | None = Form(None),
):
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


@app.get("/api/stats")
async def api_stats():
    s = db.stats()
    for row in s["by_module"]:
        row["module"] = kb.MODULES.get(row["module"], {}).get("name", row["module"])
    return s


@app.get("/")
async def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
