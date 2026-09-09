"""题库域：抽题、考点树、时政每日、导入导出与题图上传（导入统一 check_import_token）。"""
import base64
import json
import math
import os
import re
import time

from fastapi import APIRouter, Header, HTTPException, Request

from . import content_gate, db, quality, taxonomy
from .auth import probe_request
from .deps import check_import_token, clamp_limit

router = APIRouter()


_split_family = quality.split_family


def _dedupe_family(items: list[dict], limit: int) -> list[dict]:
    """一组内同族只放行首见题，不足 limit 时按原序回填被剔除项保证题量，再截断到 limit。"""
    kept, dropped = _split_family(items)
    return (kept + dropped)[:limit]


def _draw_questions(module, limit: int, **kw) -> list[dict]:
    """普通抽题：先按原量抽，组内无同族则原样返回（零额外开销）；有同族才过采 3 倍补位，
    首抽排在前面以保留 has_hs/未做过优先，再 _dedupe_family。"""
    items = db.random_questions(module, limit, **kw)
    if limit <= 0 or not _split_family(items)[1]:
        return items
    have = {q["id"] for q in items}
    extra = [q for q in db.random_questions(module, limit * 3, **kw) if q["id"] not in have]
    extra.sort(key=lambda q: 0 if q.get("has_hs") else 1)
    return _dedupe_family(items + extra, limit)


DUE_MIX_MAX = 2


def due_mix_slots(limit: int) -> int:
    """一组里最多混入几道到期错题：≥5 题起混、每 5 题 1 道、上限 2，其余仍是新题。"""
    return max(0, min(DUE_MIX_MAX, limit // 5))


def interleave_due(items: list[dict], due: list[dict], limit: int) -> list[dict]:
    """把到期错题均匀插进新题组（不占首题，n=10/k=2 → 第 5、8 位），总量仍 ≤ limit；
    新题不足时错题只补空位不再顶掉新题。"""
    if not due:
        return items[:limit]
    k = min(len(due), limit)
    fresh = items[: max(0, limit - k)]
    n = len(fresh) + k
    out = list(fresh)
    for i, q in enumerate(due[:k]):
        pos = min(len(out), math.ceil((i + 1) * n / (k + 1)))
        out.insert(pos, q)
    return out


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


@router.get("/api/daily_set")
def api_daily_set(date: str | None = None):
    """全站同题每日一练：uid 无关、按日确定，可边缘缓存；date 可选取近 7 天往期题组。"""
    day = db.daily_archive_day(date) or db.cn_day()
    return {"date": day, "items": db.daily_set_questions(day), "stats": db.daily_set_stats(day)}


@router.get("/api/daily_set/board")
def api_daily_set_board(uid: str | None = None):
    """今日排行榜（昵称/脱敏名），公开只读；不入边缘缓存，保证提交后即含本人。

    榜只算真人成绩；带 uid 时本人成绩并入（探针会话看得到自己）。"""
    day = db.cn_day()
    return {"date": day, "items": db.daily_set_board(day, uid=(uid or "").strip()[:64] or None)}


@router.post("/api/daily_set/submit")
def api_daily_set_submit(body: dict, request: Request):
    uid = str(body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    day = db.cn_day()
    if body.get("date") and str(body["date"]) != day:
        raise HTTPException(400, "只接受当日成绩")
    try:
        right = max(0, min(int(body.get("right") or 0), 50))
        total = max(1, min(int(body.get("total") or 0), 50))
        secs = float(body.get("secs") or 0) or None
    except (TypeError, ValueError):
        raise HTTPException(400, "参数不合法") from None
    nickname = str(body.get("nickname") or "").strip()[:20]
    if nickname.lower() in ("null", "undefined"):
        nickname = ""
    return db.daily_set_submit(
        day, uid, min(right, total), total, secs, nickname or None, probe=1 if probe_request(request) else 0
    )


@router.get("/api/questions/export")
def api_questions_export(
    offset: int = 0,
    limit: int = 200,
    module: str | None = None,
    all: int = 0,
    x_import_token: str | None = Header(None),
):
    check_import_token(x_import_token)
    return {"items": db.export_questions(offset, clamp_limit(limit, 500), module, missing_only=not all)}


@router.post("/api/questions/import")
def api_questions_import(body: dict, x_import_token: str | None = Header(None)):
    check_import_token(x_import_token)
    batch = "b" + time.strftime("%Y%m%d%H%M%S")
    accepted, receipt = content_gate.gate_questions(body.get("items") or [])
    if receipt["batch_rejected"]:
        raise HTTPException(422, {"error": "batch_rejected", "receipt": receipt})
    result = db.import_questions(accepted, batch=batch)
    result["receipt"] = receipt
    return result


@router.post("/api/questions/hs_import")
def api_questions_hs_import(body: dict, x_import_token: str | None = Header(None)):
    check_import_token(x_import_token)
    accepted, receipt = content_gate.gate_hs(body.get("items") or [])
    if receipt["batch_rejected"]:
        raise HTTPException(422, {"error": "batch_rejected", "receipt": receipt})
    n = db.import_hs_explanations(accepted)
    return {"updated": n, "receipt": receipt}


@router.get("/api/question_counts")
def api_question_counts():
    """各模块题数（uid 无关、确定性，供首屏轻量拉取与边缘缓存）。"""
    return {"counts": db.question_counts()}


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
    mix_due: int = 0,
):
    if mode == "reinforce" and uid:
        # 错题同考点强化：严格只出该 uid 未做过的新题，中等难度优先
        return {
            "items": db.reinforce_questions(
                uid.strip()[:64], tag3=tag3, module=module, submodule=submodule,
                limit=clamp_limit(limit, 10),
            ),
            "counts": db.question_counts(),
        }
    if grouped and module == "ziliao" and not real:
        return {
            "items": db.grouped_ziliao_questions(clamp_limit(limit, 50), uid=uid),
            "counts": db.question_counts(),
        }
    n = clamp_limit(limit, 50)
    items = _draw_questions(
        module, n, submodule=submodule, real_only=bool(real), year=year, region=region,
        uid=uid, adaptive=bool(adaptive), tag3=tag3,
    )
    # 到期错题混入：仅普通练习（无真题/年份/地区/考点/自适应筛选）且客户端显式 mix_due=1；
    # random_questions 排除已答过的题，普通练习本身永远抽不到自己的错题，答对推进复习只能靠这里
    if mix_due and uid and not (real or year or region or tag3 or adaptive):
        due = db.due_mix_questions(
            uid.strip()[:64], due_mix_slots(n), module=module, submodule=submodule,
            exclude={q["id"] for q in items},
        )
        items = interleave_due(items, due, n)
    return {"items": items, "counts": db.question_counts()}

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
