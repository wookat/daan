"""AI 结构化面试陪练：内置题库抽题 → 文字作答 → LLM 多维打分点评 → 会话历史。

题库来自公开资料整理（backend/app/data/interview_questions.json）。
打分走快速文本通道（chat_json fast），逐段点评走流式主通道（chat_stream）。
"""
import json
import os
import random
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from . import db, llm
from .deps import rl

router = APIRouter(prefix="/api/interview")

BANK_PATH = os.path.join(os.path.dirname(__file__), "data", "interview_questions.json")

DIMENSIONS = ["内容针对性", "逻辑条理", "内容深度", "语言表达", "整体素养"]

ANSWER_MAX_LEN = 5000
ANSWER_MIN_LEN = 20
REVIEW_MIN_LEN = 300  # 短于此视为流截断/异常产出，保留重新生成入口

_bank: dict | None = None


def bank() -> dict:
    global _bank
    if _bank is None:
        with open(BANK_PATH, encoding="utf-8") as f:
            _bank = json.load(f)
    return _bank


def question_by_id(qid: int) -> dict | None:
    for q in bank()["questions"]:
        if q["id"] == qid:
            return q
    return None


def init_interview_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS interview_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            category TEXT,
            question_text TEXT,
            answer_text TEXT,
            duration_sec INTEGER,
            scores TEXT,
            total INTEGER,
            review TEXT,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ivs_uid ON interview_sessions(uid, created_at DESC)")
    conn.commit()
    conn.close()


@router.get("/categories")
def api_categories(uid: str = ""):
    b = bank()
    counts: dict[str, int] = {}
    for q in b["questions"]:
        counts[q["category"]] = counts.get(q["category"], 0) + 1
    done: dict[str, int] = {}
    if uid:
        conn = db.get_conn()
        rows = conn.execute(
            "SELECT category, COUNT(DISTINCT question_id) n FROM interview_sessions WHERE uid=? GROUP BY category",
            (uid,),
        ).fetchall()
        conn.close()
        done = {r["category"]: r["n"] for r in rows}
    return {
        "categories": [
            {"name": c, "total": counts.get(c, 0), "done": done.get(c, 0)}
            for c in b["categories"]
        ],
        "total": len(b["questions"]),
    }


@router.get("/question")
def api_draw_question(uid: str = "", category: str = "", exclude_id: int = 0):
    qs = [q for q in bank()["questions"] if not category or q["category"] == category]
    if not qs:
        raise HTTPException(404, "该分类暂无题目")
    recent: set[int] = set()
    if uid:
        conn = db.get_conn()
        rows = conn.execute(
            "SELECT DISTINCT question_id FROM interview_sessions WHERE uid=? ORDER BY created_at DESC LIMIT 30",
            (uid,),
        ).fetchall()
        conn.close()
        recent = {r["question_id"] for r in rows}
    if exclude_id:
        recent.add(exclude_id)
    fresh = [q for q in qs if q["id"] not in recent]
    q = random.choice(fresh or qs)
    return {"question": {k: q[k] for k in ("id", "category", "question", "source")}}


def _score_prompt(q: dict, answer: str) -> list:
    return [
        {
            "role": "system",
            "content": (
                "你是公务员结构化面试考官。按公考面试测评维度给考生作答打分，只输出 JSON，不要输出其他内容。"
                '格式：{"scores":{"内容针对性":n,"逻辑条理":n,"内容深度":n,"语言表达":n,"整体素养":n},"summary":"一句话总评（30字内）"}'
                "，每个维度 1-10 的整数。空话套话堆砌、答非所问要坚决打低分；作答与题目高度契合、有层次有见解才可给 8 分以上。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"【面试题目】（{q['category']}）{q['question']}\n\n"
                f"【参考思路要点】{'；'.join(q.get('points', []))}\n\n"
                f"【考生作答】\n{answer}"
            ),
        },
    ]


def _review_prompt(q: dict, answer: str, scores: dict, summary: str) -> list:
    return [
        {
            "role": "system",
            "content": (
                "你是资深公务员结构化面试考官，正在给考生做逐段点评。用 Markdown 输出，结构如下：\n"
                "## 逐段点评\n把考生作答按意思分成若干段，每段引用原文关键句（用 > 引用），"
                "指出亮点（✅）与问题（⚠️，如口头禅、空泛、逻辑跳跃、偏题），给出改进建议。\n"
                "## 参考答题框架\n给出这道题的高分作答框架（分点列出，含破题、分析、对策、升华等层次，贴合题目类型）。\n"
                "## 提升建议\n针对本次作答给 2-3 条最重要的训练建议。\n"
                "点评要具体、可操作，紧扣考生原文，不要泛泛而谈。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"【面试题目】（{q['category']}）{q['question']}\n\n"
                f"【参考思路要点】{'；'.join(q.get('points', []))}\n\n"
                f"【考生作答】\n{answer}\n\n"
                f"【已评分】{json.dumps(scores, ensure_ascii=False)}，总评：{summary}"
            ),
        },
    ]


def _clip_score(v) -> int:
    try:
        return max(1, min(10, int(v)))
    except (TypeError, ValueError):
        return 5


async def _grade(q: dict, answer: str) -> tuple[dict, int, str]:
    data = await llm.chat_json(_score_prompt(q, answer), fast=True, temperature=0.1)
    raw = data.get("scores") or {}
    scores = {d: _clip_score(raw.get(d)) for d in DIMENSIONS}
    total = sum(scores.values()) * 2
    summary = str(data.get("summary") or "").strip()[:60]
    return scores, total, summary


def _save_session(uid, q, answer, duration, scores, total, review) -> int:
    conn = db.get_conn()
    cur = conn.execute(
        "INSERT INTO interview_sessions (uid, question_id, category, question_text, answer_text,"
        " duration_sec, scores, total, review, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            uid, q["id"], q["category"], q["question"], answer,
            duration, json.dumps(scores, ensure_ascii=False), total, review, time.time(),
        ),
    )
    conn.commit()
    sid = cur.lastrowid
    conn.close()
    return sid


def _update_review(sid: int, review: str) -> None:
    conn = db.get_conn()
    conn.execute("UPDATE interview_sessions SET review=? WHERE id=?", (review, sid))
    conn.commit()
    conn.close()


def _validate(request: Request, body: dict) -> tuple[str, dict, str, int]:
    uid = str(body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rl(request, "itv_answer", 20, 600, uid)
    q = question_by_id(int(body.get("question_id") or 0))
    if not q:
        raise HTTPException(404, "题目不存在")
    answer = str(body.get("answer") or "").strip()
    if len(answer) < ANSWER_MIN_LEN:
        raise HTTPException(400, f"作答太短（至少 {ANSWER_MIN_LEN} 字）")
    if len(answer) > ANSWER_MAX_LEN:
        raise HTTPException(400, f"作答过长（限 {ANSWER_MAX_LEN} 字）")
    duration = int(body.get("duration_sec") or 0)
    return uid, q, answer, duration


def _friendly_ai_err(e: Exception) -> str:
    import httpx

    if isinstance(e, httpx.HTTPStatusError):
        if e.response.status_code in (402, 403, 429):
            return "AI 服务额度已用完，请稍后再试"
        return "AI 服务暂时不可用，请稍后再试"
    if isinstance(e, httpx.HTTPError):
        return "AI 服务连接失败，请稍后再试"
    return str(e)


@router.post("/answer/stream")
async def api_answer_stream(body: dict, request: Request):
    """SSE：event meta（scores/total/summary/session 占位）→ data 点评增量 → event done（session_id）。"""
    uid, q, answer, duration = _validate(request, body)

    async def gen():
        try:
            scores, total, summary = await _grade(q, answer)
            meta = {
                "scores": scores, "total": total, "summary": summary,
                "category": q["category"], "question_id": q["id"],
            }
            sid = _save_session(uid, q, answer, duration, scores, total, "")
            meta["session_id"] = sid
            yield "event: meta\ndata: " + json.dumps(meta, ensure_ascii=False) + "\n\n"
            full = ""
            async for delta in llm.chat_stream(_review_prompt(q, answer, scores, summary)):
                full += delta
                yield "data: " + json.dumps({"d": delta}, ensure_ascii=False) + "\n\n"
            _update_review(sid, full)
            yield "event: done\ndata: " + json.dumps({"session_id": sid, "summary": summary}) + "\n\n"
        except Exception as e:
            yield "event: error\ndata: " + json.dumps({"message": _friendly_ai_err(e)}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/sessions/{sid}/review/stream")
async def api_review_regen_stream(sid: int, body: dict, request: Request):
    """为点评缺失的 session（流中断）重新生成考官点评：SSE data 增量 → done，完成后回填 DB。"""
    uid = str(body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rl(request, "itv_regen", 10, 600, uid)
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM interview_sessions WHERE id=? AND uid=?", (sid, uid)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "记录不存在")
    if len((row["review"] or "").strip()) >= REVIEW_MIN_LEN:
        raise HTTPException(400, "点评已存在")
    q = question_by_id(row["question_id"])
    if not q:
        raise HTTPException(404, "题目不存在")
    scores = json.loads(row["scores"] or "{}")
    answer = row["answer_text"] or ""

    async def gen():
        try:
            full = ""
            async for delta in llm.chat_stream(_review_prompt(q, answer, scores, "")):
                full += delta
                yield "data: " + json.dumps({"d": delta}, ensure_ascii=False) + "\n\n"
            if full.strip():
                _update_review(sid, full)
            yield "event: done\ndata: " + json.dumps({"session_id": sid}) + "\n\n"
        except Exception as e:
            yield "event: error\ndata: " + json.dumps({"message": _friendly_ai_err(e)}, ensure_ascii=False) + "\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/answer")
async def api_answer(body: dict, request: Request):
    """非流式版（小程序/App 用）：一次返回打分 + 点评。"""
    uid, q, answer, duration = _validate(request, body)
    try:
        scores, total, summary = await _grade(q, answer)
        review = await llm.chat(_review_prompt(q, answer, scores, summary))
    except Exception as e:
        raise HTTPException(502, _friendly_ai_err(e)) from e
    sid = _save_session(uid, q, answer, duration, scores, total, review)
    return {
        "session_id": sid, "scores": scores, "total": total, "summary": summary,
        "review": review, "category": q["category"], "question_id": q["id"],
    }


@router.get("/history")
def api_history(uid: str, limit: int = 50):
    if not uid:
        raise HTTPException(400, "缺少 uid")
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT id, question_id, category, question_text, total, duration_sec, created_at"
        " FROM interview_sessions WHERE uid=? ORDER BY created_at DESC LIMIT ?",
        (uid, min(int(limit), 200)),
    ).fetchall()
    n = conn.execute("SELECT COUNT(*) n FROM interview_sessions WHERE uid=?", (uid,)).fetchone()["n"]
    best = conn.execute("SELECT MAX(total) m FROM interview_sessions WHERE uid=?", (uid,)).fetchone()["m"]
    conn.close()
    return {
        "items": [dict(r) for r in rows],
        "total": n,
        "best": best,
    }


@router.get("/sessions/{sid}")
def api_session_detail(sid: int, uid: str):
    conn = db.get_conn()
    row = conn.execute(
        "SELECT * FROM interview_sessions WHERE id=? AND uid=?", (sid, uid)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "记录不存在")
    d = dict(row)
    d["scores"] = json.loads(d["scores"] or "{}")
    q = question_by_id(d["question_id"])
    d["points"] = (q or {}).get("points", [])
    d["source"] = (q or {}).get("source", "")
    return {"session": d}
