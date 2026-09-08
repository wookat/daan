"""模考/真题卷域：PDF 导出卷、答题卡/卷码判分、整卷模考（同一套判分落库逻辑）。"""
import hashlib
import time

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from . import auth, db, omr, pdf_export, taxonomy
from .deps import rl

router = APIRouter()


@router.post("/api/export/pdf")
def api_export_pdf(body: dict, request: Request):
    rl(request, "export_pdf", 20, 300, body.get("uid"))
    ids = [int(i) for i in (body.get("question_ids") or [])[:140]]
    items = body.get("items") or []
    questions = db.questions_by_ids(ids) if ids else []
    for it in items[:140]:
        if isinstance(it, dict) and (it.get("question") or "").strip():
            questions.append(
                {
                    "id": it.get("id"),
                    "module": it.get("module") or "",
                    "question": str(it.get("question"))[:2000],
                    "options": it.get("options") or {},
                    "answer": it.get("answer") or "",
                    "analysis": it.get("analysis") or "",
                    "material": it.get("material") or "",
                }
            )
    if not questions:
        raise HTTPException(400, "没有可导出的题目")
    questions = pdf_export.group_by_material(questions)
    code = hashlib.md5(
        (",".join(str(q.get("id") or q.get("question", "")[:20]) for q in questions)).encode()
    ).hexdigest()[:8].upper()
    db.save_paper_export(
        code,
        [int(q["id"]) for q in questions if q.get("id")],
        str(body.get("title") or "自选练习卷")[:40],
    )
    data = pdf_export.build_paper_pdf(
        title=str(body.get("title") or "自选练习卷")[:40],
        questions=questions,
        include_answers=bool(body.get("include_answers", True)),
        answer_sheet=bool(body.get("answer_sheet", True)),
        include_questions=bool(body.get("include_questions", True)),
        paper_code=code,
    )
    return StreamingResponse(
        iter([data]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="paper-{code}.pdf"', "X-Paper-Code": code},
    )


@router.get("/api/paper/{code}")
def api_paper_info(code: str):
    paper = db.get_paper_export(code.strip().upper()[:16])
    if not paper:
        raise HTTPException(404, "未找到该卷码对应的导出记录，请核对卷面右上角/封面的卷码")
    return {
        "code": paper["code"],
        "title": paper.get("title"),
        "n": len(paper["question_ids"]),
        "created_at": paper.get("created_at"),
    }

def _grade(picked_raw, answer_raw) -> tuple[str, str, str, bool]:
    """卷库/答题卡/模考统一判分：返回 (picked, correct_ans, status, is_correct)。

    字母均归一（大写、去重、升序）；多选题（answer 多字母）需字母集完全一致才算对；
    单选题涂多个泡 status='multi'（不记分不落库，与答题卡多涂同义）。"""
    picked = db.normalize_answer(picked_raw)
    correct_ans = db.normalize_answer(answer_raw)
    if not picked:
        status = "blank"
    elif len(picked) > 1 and len(correct_ans) <= 1:
        status = "multi"
    else:
        status = "ok"
    return picked, correct_ans, status, status == "ok" and picked == correct_ans


def _mistake_text(q: dict) -> str:
    """错题文本与刷题端同格式（题干+选项），复习时才看得到选项。"""
    opts = q.get("options") or {}
    opt_text = " ".join(f"{k}.{v}" for k, v in opts.items())
    base = q.get("question") or ""
    return base + ("\n" + opt_text if opt_text else "")


def _judge_paper(uid: str, paper: dict, picks: dict[int, str], secs: dict[int, int] | None = None, probe: bool = False) -> dict:
    """picks: {题号(从1开始): 'A'}；secs: {题号: 用时秒}；与扫描答题卡同一套判分/落库逻辑。"""
    qids = paper["question_ids"]
    questions = {q["id"]: q for q in db.questions_by_ids(qids)}
    results = []
    log_items = []
    for i, qid in enumerate(qids):
        q = questions.get(qid)
        if not q:
            continue
        picked, correct_ans, status, is_correct = _grade(picks.get(i + 1), q.get("answer"))
        results.append(
            {
                "no": i + 1,
                "question_id": qid,
                "module": q.get("module"),
                "picked": picked,
                "answer": correct_ans,
                "correct": is_correct,
                "status": status,
                "secs": (secs or {}).get(i + 1) or 0,
                "question": (q.get("question") or "")[:80],
            }
        )
        if uid and status == "ok":
            log_items.append(
                {
                    "question_id": qid,
                    "module": q.get("module"),
                    "submodule": q.get("submodule"),
                    "correct": is_correct,
                    "picked": picked,
                    "secs": (secs or {}).get(i + 1) or 0,
                }
            )
            if not is_correct:
                db.save_mistake(
                    {
                        "uid": uid[:64],
                        "question_id": qid,
                        "module": q.get("module"),
                        "question_type": q.get("submodule"),
                        "question_text": _mistake_text(q),
                        "user_answer": picked,
                        "correct_answer": correct_ans,
                        "explanation": q.get("explanation") or q.get("hs_explanation") or "",
                        "source": "exam",
                    }
                )
    if uid and log_items:
        db.save_answer_log(uid[:64], log_items, probe=probe)
    answered = [r for r in results if r["status"] == "ok"]
    return {
        "code": paper["code"],
        "title": paper.get("title"),
        "total": len(results),
        "answered": len(answered),
        "correct": sum(1 for r in answered if r["correct"]),
        "saved": bool(uid and log_items),
        "items": results,
    }


@router.post("/api/paper_answers")
def api_paper_answers(body: dict, request: Request):
    code = str(body.get("code") or "").strip().upper()[:16]
    paper = db.get_paper_export(code)
    if not paper:
        raise HTTPException(404, "未找到该卷码对应的导出记录")
    raw_picks = body.get("picks") or {}
    picks: dict[int, str] = {}
    for k, v in raw_picks.items():
        try:
            picks[int(k)] = str(v or "")[:8]
        except (TypeError, ValueError):
            continue
    if not picks:
        raise HTTPException(400, "没有已选择的答案")
    return _judge_paper(str(body.get("uid") or ""), paper, picks, probe=auth.probe_request(request))


@router.post("/api/scan_sheet")
async def api_scan_sheet(request: Request, uid: str = Form(""), image: UploadFile = File(...)):
    # multipart 不经 guard_account_uid 中间件解析，账号 uid 归属在此校验
    if not await run_in_threadpool(auth.owns_uid, uid, request.headers.get("authorization")):
        raise HTTPException(403, "无权访问该账号数据，请重新登录")
    rl(request, "scan_sheet", 20, 300, uid)
    raw = await image.read()
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(400, "图片过大，请控制在 12MB 以内")
    try:
        rec = await run_in_threadpool(omr.recognize, raw)
    except ValueError as e:
        raise HTTPException(422, str(e))
    paper = db.get_paper_export(rec["code"])
    if not paper:
        raise HTTPException(404, f"未找到卷码 {rec['code']} 对应的导出记录")
    qids = paper["question_ids"]
    page = max(1, rec["page"])
    start = (page - 1) * omr.PER_PAGE
    page_ids = qids[start : start + omr.PER_PAGE]
    questions = {q["id"]: q for q in db.questions_by_ids(page_ids)}
    results = []
    log_items = []
    for slot, qid in enumerate(page_ids):
        q = questions.get(qid)
        if not q:
            continue
        picked, correct_ans, status, is_correct = _grade(rec["picks"].get(slot, ""), q.get("answer"))
        results.append(
            {
                "no": start + slot + 1,
                "question_id": qid,
                "picked": picked,
                "answer": correct_ans,
                "correct": is_correct,
                "status": status,
                "question": (q.get("question") or "")[:80],
            }
        )
        if uid and status == "ok":
            log_items.append(
                {
                    "question_id": qid,
                    "module": q.get("module"),
                    "submodule": q.get("submodule"),
                    "correct": is_correct,
                    "picked": picked,
                    "secs": 0,
                }
            )
            if not is_correct:
                db.save_mistake(
                    {
                        "uid": uid[:64],
                        "question_id": qid,
                        "module": q.get("module"),
                        "question_type": q.get("submodule"),
                        "question_text": _mistake_text(q),
                        "user_answer": picked,
                        "correct_answer": correct_ans,
                        "explanation": q.get("explanation") or q.get("hs_explanation") or "",
                        "source": "exam",
                    }
                )
    if uid and log_items:
        db.save_answer_log(uid[:64], log_items, probe=auth.probe_request(request))
    answered = [r for r in results if r["status"] == "ok"]
    return {
        "code": rec["code"],
        "page": page,
        "title": paper.get("title"),
        "total": len(results),
        "answered": len(answered),
        "correct": sum(1 for r in answered if r["correct"]),
        "saved": bool(uid and log_items),
        "items": results,
    }

@router.get("/api/papers")
def api_papers():
    return {"items": db.list_papers()}

def _clean_int_map(raw: dict, as_str: bool = False) -> dict:
    out: dict = {}
    for k, v in (raw or {}).items():
        try:
            out[int(k)] = str(v or "")[:8] if as_str else max(0, min(int(v or 0), 86400))
        except (TypeError, ValueError):
            continue
    return out


def _clean_marks(raw, total: int) -> list[int]:
    """标记题号清洗：仅接受 1..total 范围内整数，去重升序，非法项跳过。"""
    if not isinstance(raw, list):
        return []
    out: set[int] = set()
    for v in raw:
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if isinstance(v, bool):
            continue
        if 1 <= n <= total:
            out.add(n)
    return sorted(out)

_EXAM_ITEM_FIELDS = ("id", "question", "options", "module", "submodule", "image",
                     "is_real", "exam_year", "exam_region")


def _exam_item(q: dict) -> dict:
    """下发题面不带答案，但给出是否多选（前端据此切多选交互）。"""
    d = {k: q.get(k) for k in _EXAM_ITEM_FIELDS}
    d["multi"] = len(db.normalize_answer(q.get("answer"))) > 1
    return d


@router.get("/api/exam/papers")
def api_exam_papers(kind: str | None = None, year: int | None = None,
                    region: str | None = None, uid: str | None = None):
    items = db.list_exam_papers(kind, year, region, uid=(uid or "").strip()[:64] or None)
    return {
        "items": [p for p in items if p["n"] >= 5],
        "filters": db.exam_paper_filters(),
    }


@router.get("/api/exam/papers/{pid}")
def api_exam_paper_detail(pid: int):
    paper = db.get_exam_paper(pid)
    if not paper:
        raise HTTPException(404, "试卷不存在")
    paper["question_ids"] = db.exam_active_qids(paper["question_ids"])
    return {"paper": paper}


@router.post("/api/exam/start")
def api_exam_start(body: dict, request: Request):
    uid = (body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    if body.get("mini"):
        pid = db.create_mock_paper(n=30, duration_min=30)
    else:
        pid = body.get("paper_id")
        if not pid:
            raise HTTPException(400, "缺少 paper_id")
        pid = int(pid)
    paper = db.get_exam_paper(pid)
    if not paper:
        raise HTTPException(404, "试卷不存在")
    pinfo, ordered = _exam_paper_payload(paper)
    if len(ordered) < 5:
        raise HTTPException(400, "试卷题目不足")
    attempt_id = db.start_exam_attempt(uid, pid, probe=auth.probe_request(request),
                                       question_ids=[i["id"] for i in ordered])
    return {"attempt_id": attempt_id, "paper": pinfo, "items": ordered}


def _exam_paper_payload(paper: dict) -> tuple[dict, list[dict]]:
    qids = db.exam_active_qids(paper["question_ids"])
    items = {q["id"]: q for q in db.questions_by_ids(qids)}
    ordered = [_exam_item(items[i]) for i in qids if i in items]
    pinfo = {
        "id": paper["id"],
        "title": paper["title"],
        "kind": paper["kind"],
        "year": paper["year"],
        "region": paper["region"],
        "duration_min": paper["duration_min"],
        "n": len(ordered),
    }
    return pinfo, ordered


@router.post("/api/exam/progress")
def api_exam_progress(body: dict):
    uid = (body.get("uid") or "").strip()[:64]
    attempt_id = body.get("attempt_id")
    if not uid or not attempt_id:
        raise HTTPException(400, "缺少 uid 或 attempt_id")
    attempt = db.get_exam_attempt(int(attempt_id))
    if not attempt or attempt["uid"] != uid:
        raise HTTPException(404, "答题记录不存在")
    if body.get("drop") is True:
        db.clear_exam_progress(int(attempt_id))
        return {"ok": True}
    if attempt["submitted_at"]:
        raise HTTPException(400, "该次模考已交卷")
    paper = db.get_exam_paper(attempt["paper_id"])
    if not paper or attempt["started_at"] + paper["duration_min"] * 60 <= time.time():
        raise HTTPException(400, "该场模考已超时")
    raw = body.get("picks")
    if not isinstance(raw, dict) or len(raw) > 300:
        raise HTTPException(400, "无效的作答进度")
    picks: dict[str, str] = {}
    for k, v in raw.items():
        try:
            qid = int(k)
        except (TypeError, ValueError):
            raise HTTPException(400, "无效的作答进度") from None
        if not isinstance(v, str) or not v or len(v) > 4 or any(ch not in "ABCD" for ch in v):
            raise HTTPException(400, "无效的作答进度")
        picks[str(qid)] = db.normalize_answer(v)
    idx = body.get("idx")
    idx = idx if isinstance(idx, int) and 0 <= idx < 1000 else 0
    raw_marks = body.get("marks")
    marks: list[int] = []
    if raw_marks is not None:
        if not isinstance(raw_marks, list) or len(raw_marks) > 300:
            raise HTTPException(400, "无效的作答进度")
        for m in raw_marks:
            if isinstance(m, bool) or not isinstance(m, int):
                raise HTTPException(400, "无效的作答进度")
            marks.append(m)
        marks = sorted(set(marks))
    raw_secs = body.get("secs")
    secs: dict[str, int] = {}
    if raw_secs is not None:
        if not isinstance(raw_secs, dict) or len(raw_secs) > 300:
            raise HTTPException(400, "无效的作答进度")
        for k, v in raw_secs.items():
            try:
                sqid = int(k)
            except (TypeError, ValueError):
                raise HTTPException(400, "无效的作答进度") from None
            if isinstance(v, bool) or not isinstance(v, int) or v <= 0:
                raise HTTPException(400, "无效的作答进度")
            secs[str(sqid)] = v
    raw_excl = body.get("excl")
    excl: dict[str, list[str]] = {}
    if raw_excl is not None:
        if not isinstance(raw_excl, dict) or len(raw_excl) > 300:
            raise HTTPException(400, "无效的作答进度")
        for k, v in raw_excl.items():
            try:
                eqid = int(k)
            except (TypeError, ValueError):
                raise HTTPException(400, "无效的作答进度") from None
            if not isinstance(v, list) or len(v) > 4:
                raise HTTPException(400, "无效的作答进度")
            letters = []
            for x in v:
                if not isinstance(x, str) or x not in ("A", "B", "C", "D"):
                    raise HTTPException(400, "无效的作答进度")
                if x not in letters:
                    letters.append(x)
            if letters:
                excl[str(eqid)] = letters
    db.save_exam_progress(int(attempt_id), uid, picks, idx, marks, secs, excl)
    return {"ok": True}


@router.get("/api/exam/resume")
def api_exam_resume(uid: str):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    prog = db.latest_exam_progress(uid)
    if not prog:
        return {}
    paper = db.get_exam_paper(prog["paper_id"])
    if not paper:
        return {}
    pinfo, ordered = _exam_paper_payload(paper)
    if len(ordered) < 5:
        return {}
    return {
        "attempt_id": prog["attempt_id"],
        "paper": pinfo,
        "items": ordered,
        "picks": prog["picks"],
        "marks": prog["marks"],
        "secs": prog["secs"],
        "excl": prog["excl"],
        "idx": prog["idx"],
        "end_at_ms": int((prog["started_at"] + paper["duration_min"] * 60) * 1000),
    }


@router.post("/api/exam/submit")
def api_exam_submit(body: dict, request: Request):
    uid = (body.get("uid") or "").strip()[:64]
    attempt_id = body.get("attempt_id")
    if not uid or not attempt_id:
        raise HTTPException(400, "缺少 uid 或 attempt_id")
    attempt = db.get_exam_attempt(int(attempt_id))
    if not attempt or attempt["uid"] != uid:
        raise HTTPException(404, "答题记录不存在")
    if attempt["submitted_at"]:
        raise HTTPException(400, "该次模考已交卷")
    paper = db.get_exam_paper(attempt["paper_id"])
    if not paper:
        raise HTTPException(404, "试卷不存在")
    picks = _clean_int_map(body.get("picks") or {}, as_str=True)
    secs = _clean_int_map(body.get("secs") or {})
    qids = attempt.get("question_ids") or db.exam_active_qids(paper["question_ids"])
    marks = _clean_marks(body.get("marks"), len(qids))
    judged = _judge_paper(uid, {"code": None, "title": paper["title"], "question_ids": qids}, picks, secs,
                          probe=auth.probe_request(request))
    per_module: dict = {}
    for r in judged["items"]:
        m = r.get("module") or "other"
        pm = per_module.setdefault(m, {"n": 0, "answered": 0, "correct": 0, "secs": 0})
        pm["n"] += 1
        if r["status"] == "ok":
            pm["answered"] += 1
            if r["correct"]:
                pm["correct"] += 1
        pm["secs"] += r.get("secs") or 0
    total = judged["total"] or 1
    score = round(100.0 * judged["correct"] / total, 1)
    db.finish_exam_attempt(int(attempt_id), {str(k): v for k, v in picks.items()}, score, per_module,
                           secs, marks)
    db.clear_exam_progress(int(attempt_id))
    return {
        "attempt_id": int(attempt_id),
        "paper_id": paper["id"],
        "title": paper["title"],
        "score": score,
        "total": judged["total"],
        "answered": judged["answered"],
        "correct": judged["correct"],
        "per_module": per_module,
        "items": judged["items"],
    }


@router.get("/api/exam/attempts")
def api_exam_attempts(uid: str, paper_id: int | None = None, limit: int = 50):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.list_exam_attempts(uid, paper_id, limit)}


@router.get("/api/exam/report/{attempt_id}")
def api_exam_report(attempt_id: int, uid: str = ""):
    attempt = db.get_exam_attempt(attempt_id)
    if not attempt or not attempt["submitted_at"]:
        raise HTTPException(404, "成绩报告不存在")
    # attempt_id 自增可枚举，成绩报告仅本人可读
    if attempt["uid"] != (uid.strip()[:64] or None):
        raise HTTPException(404, "成绩报告不存在")
    paper = db.get_exam_paper(attempt["paper_id"])
    if not paper:
        raise HTTPException(404, "试卷不存在")
    qids = attempt.get("question_ids") or db.exam_active_qids(paper["question_ids"])
    questions = {q["id"]: q for q in db.questions_by_ids(qids)}
    picks = {int(k): v for k, v in attempt["answers"].items()}
    smap = {int(k): v for k, v in (attempt.get("secs") or {}).items()}
    marked = {m for m in attempt.get("marks") or [] if isinstance(m, int)}
    mmap = db.mistakes_by_qids(attempt["uid"] or "", qids)
    items = []
    for i, qid in enumerate(qids):
        q = questions.get(qid)
        if not q:
            continue
        picked, correct_ans, status, is_correct = _grade(picks.get(i + 1), q.get("answer"))
        items.append({
            "no": i + 1,
            "question_id": qid,
            "module": q.get("module"),
            "submodule": q.get("submodule"),
            "tag3": q.get("tag3"),
            "question": q.get("question"),
            "options": q.get("options"),
            "picked": picked,
            "answer": correct_ans,
            "correct": is_correct,
            "status": status,
            "secs": smap[i + 1] if isinstance(smap.get(i + 1), int) and smap[i + 1] > 0 else None,
            "marked": (i + 1) in marked,
            "mistake_id": (mmap.get(qid) or {}).get("id") if picked and not is_correct else None,
            "error_reason": (mmap.get(qid) or {}).get("error_reason") if picked and not is_correct else None,
            "explanation": q.get("explanation"),
            "hs_explanation": q.get("hs_explanation"),
            "image": q.get("image"),
            "image_credit": q.get("image_credit"),
            "is_real": q.get("is_real"),
            "exam_year": q.get("exam_year"),
            "exam_region": q.get("exam_region"),
            "attempt_count": q.get("attempt_count"),
            "correct_ratio": q.get("correct_ratio"),
            "most_wrong": q.get("most_wrong"),
        })
    answered = sum(1 for r in items if r["status"] == "ok")
    tag_stats: dict[str, list[int]] = {}
    for i, qid in enumerate(qids):
        q = questions.get(qid)
        if not q:
            continue
        tag = q.get("tag3")
        if not tag or tag == "UNKNOWN":
            continue
        picked, _ans, _st, correct = _grade(picks.get(i + 1), q.get("answer"))
        tag_stats.setdefault(tag, [0, 0])
        tag_stats[tag][0] += 1
        if picked and not correct:
            tag_stats[tag][1] += 1
    topic_idx = taxonomy.topic_index()
    weak_tags = sorted(
        (
            {
                "tag3": t,
                "name": (topic_idx.get(t) or {}).get("name") or t,
                "n": v[0],
                "wrong": v[1],
            }
            for t, v in tag_stats.items()
            if v[1] > 0
        ),
        key=lambda x: (-x["wrong"], -x["n"]),
    )[:3]
    return {
        "attempt": {
            "id": attempt["id"],
            "paper_id": attempt["paper_id"],
            "started_at": attempt["started_at"],
            "submitted_at": attempt["submitted_at"],
            "score": attempt["score"],
            "per_module": attempt["per_module"],
        },
        "paper": {
            "id": paper["id"],
            "title": paper["title"],
            "kind": paper["kind"],
            "year": paper["year"],
            "region": paper["region"],
            "duration_min": paper["duration_min"],
            "question_ids": qids,
        },
        "total": len(items),
        "answered": answered,
        "correct": sum(1 for r in items if r["correct"]),
        "weak_tags": weak_tags,
        "items": items,
    }

@router.get("/api/paper_questions")
def api_paper_questions(src: str, uid: str | None = None, pid: int | None = None):
    items = db.paper_questions(
        src,
        uid=(uid or "").strip()[:64] or None,
        pid=pid if pid and pid > 0 else None,
    )
    if not items:
        raise HTTPException(404, "试卷不存在或题目不足")
    return {"items": items}
