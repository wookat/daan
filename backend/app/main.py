import base64
import hashlib
import json
import os
import re
import threading
import time

import httpx
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import db, engine, kb, llm

app = FastAPI(title="考公错题助手")

ACCESS_CODE = os.environ.get("ACCESS_CODE", "")


def check_access(x_access_code: str | None):
    if ACCESS_CODE and x_access_code != ACCESS_CODE:
        raise HTTPException(401, "访问码错误")

db.init_db()


def _stats_refresher():
    while True:
        try:
            db.refresh_question_stats()
            db.refresh_material_hash()
        except Exception:
            pass
        time.sleep(6 * 3600)


threading.Thread(target=_stats_refresher, daemon=True).start()


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
    advice = await llm.chat([{"role": "user", "content": prompt}], temperature=0.4, max_tokens=800)
    return {"advice": advice}


@app.post("/api/answer_log")
def api_answer_log(body: dict):
    uid = (body.get("uid") or "").strip()
    items = body.get("items")
    if not uid or not isinstance(items, list) or not items:
        raise HTTPException(400, "缺少 uid 或答题记录")
    n = db.save_answer_log(uid[:64], items[:200])
    return {"saved": n}


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
):
    if grouped and module == "ziliao" and not real:
        return {
            "items": db.grouped_ziliao_questions(min(limit, 50), uid=uid),
            "counts": db.question_counts(),
        }
    return {
        "items": db.random_questions(
            module, min(limit, 50), submodule, real_only=bool(real), year=year, region=region, uid=uid,
            adaptive=bool(adaptive),
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
    return {"items": db.shenlun_questions(qtype, year, region, limit, offset)}


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
async def api_shenlun_grade(body: dict):
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
        result = await llm.chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=1500)
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


@app.get("/api/submodule_progress")
def api_submodule_progress(uid: str, module: str | None = None):
    return {"items": db.submodule_progress(uid, module)}


@app.get("/api/papers")
def api_papers():
    return {"items": db.list_papers()}


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
def api_list_mistakes(uid: str = ""):
    return {"items": db.list_mistakes(uid=uid.strip()[:64] or None)}


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
        return db.record_review(mid, bool(body.get("correct")))
    except KeyError:
        raise HTTPException(404, "错题不存在") from None


@app.get("/api/stats")
def api_stats():
    s = db.stats()
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


app.mount("/qimg", StaticFiles(directory=QIMG_DIR), name="qimg")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
