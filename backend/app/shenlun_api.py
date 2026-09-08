"""申论域：题库/素材/收藏与 AI 批改（大作文按档位、小题按采分点）。"""
import time

from fastapi import APIRouter, Header, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from . import db, llm
from .deps import check_access, check_import_token, friendly_ai_err, rl

router = APIRouter()


@router.post("/api/shenlun/import")
def api_shenlun_import(body: dict, x_import_token: str | None = Header(None)):
    check_import_token(x_import_token)
    batch = "sl" + time.strftime("%Y%m%d%H%M%S")
    return db.import_shenlun(body.get("questions") or [], body.get("materials") or [], batch)


@router.get("/api/shenlun/questions")
def api_shenlun_questions(qtype: str | None = None, year: int | None = None, region: str | None = None, limit: int = 20, offset: int = 0, paper: str | None = None):
    return db.shenlun_questions(qtype, year, region, limit, offset, paper)


@router.get("/api/shenlun/filters")
def api_shenlun_filters():
    return db.shenlun_filters()


@router.get("/api/shenlun/questions/{qid}")
def api_shenlun_question(qid: int):
    item = db.shenlun_question(qid)
    if not item:
        raise HTTPException(404, "题目不存在")
    return {"item": item}


@router.post("/api/shenlun/grade")
async def api_shenlun_grade(body: dict, request: Request, x_access_code: str | None = Header(None)):
    check_access(x_access_code)
    rl(request, "ai_shenlun_grade", 10, 600, body.get("uid"))
    qid = body.get("qid")
    answer = (body.get("answer") or "").strip()
    if not qid or not answer:
        raise HTTPException(400, "缺少题目或作答内容")
    if len(answer) > 3000:
        raise HTTPException(400, "作答内容过长")
    q = await run_in_threadpool(db.shenlun_question, int(qid))
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
    except Exception as e:
        raise HTTPException(502, f"批改失败：{friendly_ai_err(e)}") from e
    uid = (body.get("uid") or "").strip()[:64]
    if uid:
        await run_in_threadpool(db.save_shenlun_answer, uid, int(qid), answer, result)
    return {"result": result, "essay": is_essay}


@router.get("/api/shenlun/history")
def api_shenlun_history(uid: str, qid: int | None = None, limit: int = 20):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.shenlun_answer_history(uid[:64], qid, limit)}


@router.get("/api/shenlun/stats")
def api_shenlun_stats(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.shenlun_stats(uid[:64])


@router.get("/api/shenlun/mat_favs")
def api_shenlun_mat_favs(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"ids": db.mat_fav_ids(uid[:64]), "items": db.mat_fav_items(uid[:64])}


@router.post("/api/shenlun/mat_favs")
def api_shenlun_mat_fav_set(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    mid = body.get("mid")
    if not uid or not mid:
        raise HTTPException(400, "缺少 uid 或素材 id")
    db.mat_fav_set(uid, int(mid), bool(body.get("on")))
    return {"ok": True}


@router.get("/api/shenlun/qfavs")
def api_shenlun_qfavs(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"ids": db.qfav_ids(uid[:64]), "items": db.qfav_items(uid[:64])}


@router.post("/api/shenlun/qfavs")
def api_shenlun_qfav_set(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    qid = body.get("qid")
    if not uid or not qid:
        raise HTTPException(400, "缺少 uid 或题目 id")
    db.qfav_set(uid, int(qid), bool(body.get("on")))
    return {"ok": True}


@router.get("/api/shenlun/draft")
def api_shenlun_draft_get(uid: str, qid: int):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.sl_draft_get(uid[:64], qid)


@router.post("/api/shenlun/draft")
def api_shenlun_draft_set(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    qid = body.get("qid")
    if not uid or not qid:
        raise HTTPException(400, "缺少 uid 或题目 id")
    content = str(body.get("content") or "")
    if len(content) > 3000:
        raise HTTPException(400, "草稿内容过长")
    db.sl_draft_set(uid, int(qid), content)
    return {"ok": True}


@router.get("/api/shenlun/materials")
def api_shenlun_materials(topic: str | None = None, type: str | None = None, limit: int = 20, offset: int = 0,
                          id: int | None = None):
    return {"items": db.shenlun_materials(topic, type, limit, offset, mid=id)}
