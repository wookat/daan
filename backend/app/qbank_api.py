"""题库域：抽题、考点树、时政每日、导入导出与题图上传（导入统一 check_import_token）。"""
import base64
import json
import os
import re
import time

from fastapi import APIRouter, Header, HTTPException

from . import db, taxonomy
from .deps import check_import_token

router = APIRouter()


@router.get("/api/taxonomy")
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

@router.get("/api/shizheng/daily")
def api_shizheng_daily(date: str | None = None, limit: int = 10):
    """按日期取当日一组时政题（同一天所有人相同，用日期作随机种子从底池抽）。"""
    day = (date or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day or ""):
        day = time.strftime("%Y-%m-%d")
    items = db.shizheng_daily(day, min(max(limit, 1), 20))
    return {"date": day, "items": items, "total": db.shizheng_count()}

@router.get("/api/questions/export")
def api_questions_export(offset: int = 0, limit: int = 200, module: str | None = None, all: int = 0):
    return {"items": db.export_questions(offset, min(limit, 500), module, missing_only=not all)}


@router.post("/api/questions/import")
def api_questions_import(body: dict, x_import_token: str | None = Header(None)):
    check_import_token(x_import_token)
    batch = "b" + time.strftime("%Y%m%d%H%M%S")
    result = db.import_questions(body.get("items") or [], batch=batch)
    return result


@router.post("/api/questions/hs_import")
def api_questions_hs_import(body: dict, x_import_token: str | None = Header(None)):
    check_import_token(x_import_token)
    n = db.import_hs_explanations(body.get("items") or [])
    return {"updated": n}


@router.get("/api/questions")
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

@router.get("/api/submodule_progress")
def api_submodule_progress(uid: str, module: str | None = None):
    return {"items": db.submodule_progress(uid, module)}

@router.get("/api/announcement")
def api_announcement():
    return {"item": db.active_announcement()}

@router.get("/api/real_filters")
def api_real_filters():
    return db.real_filters()


@router.get("/api/submodules")
def api_submodules(module: str):
    return {"items": db.submodule_counts(module)}

QIMG_DIR = os.path.join(os.path.dirname(db.DB_PATH) or ".", "qimg")
os.makedirs(QIMG_DIR, exist_ok=True)


@router.post("/api/questions/image")
def api_upload_qimg(body: dict, x_import_token: str | None = Header(None)):
    check_import_token(x_import_token)
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
