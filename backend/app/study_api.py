"""学习记录域：画像/计划、作答日志、错题本、SRS 复习、提醒、统计与反馈纠错。"""
import json
import re
import time

from fastapi import APIRouter, HTTPException, Request

from . import db, kb, plan, taxonomy
from .deps import rl
from .social import api_checkin_badges, api_checkin_summary

router = APIRouter()


@router.post("/api/user_state")
def api_user_state(body: dict):
    uid = (body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    db.set_user_state(uid[:64], str(body.get("focus") or "")[:32], str(body.get("note") or ""))
    return {"ok": True}


PROFILE_EXAM_TYPES = {"国考", "省考", "事业单位", "其他"}
PROFILE_BASE_LEVELS = {"零基础", "有基础", "二战"}
PROFILE_DAILY_GOALS = {20, 50, 100}
PROFILE_GROUP_SIZES = {10, 20, 30, 50}


@router.get("/api/profile")
def api_profile_get(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"profile": db.get_user_profile(uid[:64])}


@router.post("/api/profile")
def api_profile_save(body: dict):
    uid = (body.get("uid") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    fields: dict = {}
    if "exam_type" in body:
        v = (body.get("exam_type") or "").strip()
        if v and v not in PROFILE_EXAM_TYPES:
            raise HTTPException(400, "考试类型无效")
        fields["exam_type"] = v or None
    if "target_region" in body:
        fields["target_region"] = (body.get("target_region") or "").strip()[:50] or None
    if "exam_date" in body:
        v = (body.get("exam_date") or "").strip()
        if v and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise HTTPException(400, "考试日期格式应为 YYYY-MM-DD")
        fields["exam_date"] = v or None
    if "target_score" in body:
        v = body.get("target_score")
        fields["target_score"] = max(0, min(100, int(v))) if v is not None else None
    if "daily_minutes" in body:
        v = body.get("daily_minutes")
        fields["daily_minutes"] = max(10, min(600, int(v))) if v is not None else None
    if "daily_goal" in body:
        v = body.get("daily_goal")
        if v is None:
            fields["daily_goal"] = None
        else:
            if isinstance(v, bool) or not isinstance(v, int) or v not in PROFILE_DAILY_GOALS:
                raise HTTPException(400, "每日目标无效")
            fields["daily_goal"] = v
    if "group_size" in body:
        v = body.get("group_size")
        if v is None:
            fields["group_size"] = None
        else:
            if isinstance(v, bool) or not isinstance(v, int) or v not in PROFILE_GROUP_SIZES:
                raise HTTPException(400, "每组题量无效")
            fields["group_size"] = v
    for flag in ("timed_mode", "auto_next"):
        if flag in body:
            v = body.get(flag)
            if v is None:
                fields[flag] = None
            else:
                if isinstance(v, bool) or not isinstance(v, int) or v not in (0, 1):
                    raise HTTPException(400, "练习偏好无效")
                fields[flag] = v
    if "base_level" in body:
        v = (body.get("base_level") or "").strip()
        if v and v not in PROFILE_BASE_LEVELS:
            raise HTTPException(400, "基础自评无效")
        fields["base_level"] = v or None
    return {"profile": db.save_user_profile(uid[:64], fields)}


@router.get("/api/plan/today")
def api_plan_today(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return plan.today_plan(uid[:64])


@router.get("/api/daily_plan")
def api_daily_plan(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.daily_plan(uid[:64])


@router.get("/api/home_bundle")
def api_home_bundle(uid: str):
    """首页首屏 uid 专属数据聚合：plan/profile/plan_today/badges/summary 一次取齐。

    各子结构直接复用既有端点的实现函数，与独立端点响应逐字段一致；
    独立端点保留，旧客户端零影响。
    """
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    u = uid[:64]
    profile = db.get_user_profile(u)
    return {
        "plan": db.daily_plan(u),
        "profile": profile,
        "plan_today": plan.today_plan(u) if profile else None,
        "badges": api_checkin_badges(u),
        "summary": api_checkin_summary(u),
    }


@router.get("/api/attempts")
def api_attempts(uid: str, question_id: int):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.question_attempts(uid[:64], question_id)}

@router.post("/api/answer_log")
def api_answer_log(body: dict, request: Request):
    uid = (body.get("uid") or "").strip()
    rl(request, "alog", 120, 3600, uid)
    items = body.get("items")
    if not uid or not isinstance(items, list) or not items:
        raise HTTPException(400, "缺少 uid 或答题记录")
    n = db.save_answer_log(uid[:64], items[:200])
    return {"saved": n}

@router.get("/api/practice/history")
def api_practice_history(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.practice_history(uid[:64])}


@router.get("/api/practice/history/detail")
def api_practice_history_detail(uid: str, start: float, end: float):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.practice_history_detail(uid[:64], start, end)}


@router.get("/api/growth")
def api_growth(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.growth_stats(uid[:64])


@router.get("/api/recommend")
def api_recommend(uid: str):
    uid = uid.strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    return db.recommend_stats(uid[:64])


@router.post("/api/backup")
def api_backup_save(body: dict, request: Request):
    rl(request, "backup", 10, 3600)
    data = body.get("data")
    if not isinstance(data, dict):
        raise HTTPException(400, "缺少备份数据")
    code = db.save_backup(body.get("code"), data)
    return {"code": code}


@router.get("/api/backup")
def api_backup_get(code: str):
    data = db.get_backup(code.strip().upper())
    if data is None:
        raise HTTPException(404, "恢复码不存在")
    return {"data": data}

_REDO_REASONS = {"粗心大意", "概念不清", "方法不会", "纯蒙的", "未标注"}
_REDO_SOURCES = {"exam", "practice"}


@router.get("/api/mistakes/redo")
def api_mistakes_redo(limit: int = 10, qtype: str | None = None, module: str | None = None, noqt: int = 0, uid: str | None = None, rz: str | None = None, src: str | None = None, t3: str | None = None):
    if rz is not None and rz not in _REDO_REASONS:
        raise HTTPException(400, "无效的错因")
    if src is not None and src not in _REDO_SOURCES:
        raise HTTPException(400, "无效的来源")
    if t3 is not None and t3 not in taxonomy.topic_index():
        raise HTTPException(400, "无效的考点")
    return {"items": db.mistakes_redo_questions(min(limit, 25), qtype=qtype, module=module, noqt=bool(noqt), uid=uid, reason=rz, source=src, tag3=t3)}

_REPORT_REASONS = {"答案有误", "题目有错字/乱码", "选项有问题", "图片不清晰/缺失", "解析有误", "其他"}


@router.post("/api/report")
def api_report(body: dict, request: Request):
    rl(request, "report", 20, 3600)
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


_QREPORT_TYPES = {"答案错误", "解析错误", "题干或选项错字", "图片缺失", "分类错误", "重复题", "其他"}


@router.post("/api/question_report")
def api_question_report(body: dict, request: Request):
    rl(request, "qreport", 30, 3600, body.get("uid"))
    rtype = str(body.get("type") or "").strip()
    if rtype not in _QREPORT_TYPES:
        raise HTTPException(400, "无效的纠错类型")
    try:
        qid = int(body.get("question_id") or 0)
    except (TypeError, ValueError):
        qid = 0
    if not qid:
        raise HTTPException(400, "缺少题目 ID")
    uid = str(body.get("uid") or "").strip()[:64] or None
    detail = str(body.get("detail") or "").strip()[:500]
    rid, updated = db.add_question_report(qid, uid, rtype, detail)
    return {"id": rid, "updated": updated}

@router.post("/api/practice_result")
def api_practice_result(body: dict, request: Request):
    rl(request, "presult", 60, 3600)
    n = int(body.get("n") or 0)
    if not (0 < n <= 200):
        raise HTTPException(400, "无效题量")
    correct = max(0, min(int(body.get("correct") or 0), n))
    secs = max(0, min(int(body.get("secs") or 0), 86400))
    return db.save_practice_result(body.get("module"), n, correct, secs)

@router.post("/api/practice/progress")
def api_practice_progress(body: dict, request: Request):
    uid = (body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rl(request, "ppro", 120, 3600, uid)
    raw_qids = body.get("qids")
    if not isinstance(raw_qids, list) or len(raw_qids) > 100:
        raise HTTPException(400, "无效的练习进度")
    if not raw_qids:
        db.clear_practice_progress(uid)
        return {"ok": True}
    qids: list[int] = []
    for q in raw_qids:
        if isinstance(q, bool) or not isinstance(q, int) or q <= 0:
            raise HTTPException(400, "无效的练习进度")
        qids.append(q)
    qid_set = {str(q) for q in qids}
    raw_picks = body.get("picks")
    picks: dict[str, str] = {}
    if raw_picks is not None:
        if not isinstance(raw_picks, dict) or len(raw_picks) > 100:
            raise HTTPException(400, "无效的练习进度")
        for k, v in raw_picks.items():
            try:
                pk = str(int(k))
            except (TypeError, ValueError):
                raise HTTPException(400, "无效的练习进度") from None
            if pk not in qid_set or not isinstance(v, str) or v not in ("A", "B", "C", "D"):
                raise HTTPException(400, "无效的练习进度")
            picks[pk] = v
    raw_excl = body.get("excl")
    excl: dict[str, list[str]] = {}
    if raw_excl is not None:
        if not isinstance(raw_excl, dict) or len(raw_excl) > 100:
            raise HTTPException(400, "无效的练习进度")
        for k, v in raw_excl.items():
            try:
                ek = str(int(k))
            except (TypeError, ValueError):
                raise HTTPException(400, "无效的练习进度") from None
            if ek not in qid_set or not isinstance(v, list) or len(v) > 4:
                raise HTTPException(400, "无效的练习进度")
            letters = []
            for x in v:
                if not isinstance(x, str) or x not in ("A", "B", "C", "D"):
                    raise HTTPException(400, "无效的练习进度")
                if x not in letters:
                    letters.append(x)
            if letters:
                excl[ek] = letters
    idx = body.get("idx")
    idx = idx if isinstance(idx, int) and not isinstance(idx, bool) and 0 <= idx < len(qids) else 0

    def _bounded(key: str, hi: int) -> int:
        v = body.get(key)
        if isinstance(v, bool) or not isinstance(v, int):
            return 0
        return max(0, min(v, hi))

    module = str(body.get("module") or "").strip()[:64] or None
    submodule = str(body.get("submodule") or "").strip()[:64] or None
    db.save_practice_progress(uid, qids, picks, excl, idx,
                              _bounded("right", len(qids)), _bounded("streak", len(qids)),
                              _bounded("best_streak", 10000),
                              module, submodule)
    return {"ok": True}


@router.get("/api/practice/resume")
def api_practice_resume(uid: str):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    prog = db.get_practice_progress(uid)
    if not prog or time.time() - prog["updated_at"] > 24 * 3600:
        return {}
    items = db.questions_by_ids(prog["qids"])
    by_id = {q["id"]: q for q in items}
    ordered = [by_id[q] for q in prog["qids"] if q in by_id]
    if not ordered:
        return {}
    return {
        "items": ordered,
        "picks": prog["picks"],
        "excl": prog["excl"],
        "idx": prog["idx"],
        "right": prog["right_n"],
        "streak": prog["streak"],
        "best_streak": prog["best_streak"],
        "module": prog["module"],
        "submodule": prog["submodule"],
        "t": prog["updated_at"],
    }


@router.post("/api/mistakes")
def api_save_mistake(rec: dict, request: Request):
    rl(request, "mistake", 240, 3600, str(rec.get("uid") or "").strip() or None)
    mid = db.save_mistake(rec)
    return {"id": mid}


@router.get("/api/mistakes")
def api_list_mistakes(uid: str = ""):
    items = db.list_mistakes(uid=uid.strip()[:64] or None)
    idx = taxonomy.topic_index()
    for m in items:
        t = idx.get(m.get("tag3") or "")
        m["tag3_name"] = t["name"] if t else None
    return {"items": items}


@router.patch("/api/mistakes/{mid}")
def api_update_mistake(mid: int, body: dict):
    """按 uid 隔离：只允许改自己的错题（uid 缺省时仅匹配无归属历史记录）。"""
    uid = str(body.get("uid") or "").strip()[:64] or None
    if not db.update_mistake(mid, body, uid=uid):
        raise HTTPException(404, "错题不存在")
    return {"ok": True}


@router.delete("/api/mistakes/{mid}")
def api_delete_mistake(mid: int, uid: str = ""):
    if not db.delete_mistake(mid, uid=uid.strip()[:64] or None):
        raise HTTPException(404, "错题不存在")
    return {"ok": True}


# 学习提醒偏好：仅存意向与时段；小程序订阅消息待 AppID/模板配置后由下发任务读取本表开闸
@router.post("/api/reminders")
def api_set_reminder(body: dict):
    uid = str(body.get("uid") or "").strip()[:64]
    channel = str(body.get("channel") or "").strip()
    if not uid:
        raise HTTPException(400, "缺少 uid")
    if channel not in {"wxsub", "web"}:
        raise HTTPException(400, "无效 channel")
    hour = body.get("hour")
    if hour is not None:
        try:
            hour = int(hour)
        except (TypeError, ValueError):
            raise HTTPException(400, "无效 hour")
        if not 0 <= hour <= 23:
            raise HTTPException(400, "无效 hour")
    db.set_reminder_pref(uid, channel, bool(body.get("enabled", True)), hour)
    return {"ok": True}


@router.get("/api/reminders")
def api_get_reminders(uid: str = ""):
    u = uid.strip()[:64]
    if not u:
        raise HTTPException(400, "缺少 uid")
    return {"items": db.get_reminder_prefs(u)}


@router.get("/api/review")
def api_review_due(uid: str = ""):
    u = uid.strip()[:64] or None
    return {"items": db.due_reviews(uid=u), "total": db.due_review_count(uid=u)}


REVIEW_CUR_MAX_ITEMS = 80
REVIEW_CUR_TTL_S = 2 * 3600


def _valid_review_snap(snap, uid: str) -> bool:
    if not isinstance(snap, dict) or snap.get("v") != 1 or snap.get("uid") != uid:
        return False
    ts = snap.get("ts")
    if isinstance(ts, bool) or not isinstance(ts, int) or ts <= 0:
        return False
    items = snap.get("items")
    if not isinstance(items, list) or not 0 < len(items) <= REVIEW_CUR_MAX_ITEMS:
        return False
    for x in items:
        if not isinstance(x, dict) or not isinstance(x.get("question_text"), str) or not x["question_text"]:
            return False
    r = snap.get("rIdx")
    return not isinstance(r, bool) and isinstance(r, int) and 0 <= r < len(items)


# 注意：必须注册在 /api/review/{mid} 之前，否则 "cur" 会被 int 路径参数吞掉。
@router.post("/api/review/cur")
def api_review_cur_save(body: dict, request: Request):
    uid = str(body.get("uid") or "").strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    rl(request, "rcur", 120, 3600, uid)
    snap = body.get("snap")
    if snap is None:
        db.clear_review_cur(uid)
        return {"ok": True}
    if not _valid_review_snap(snap, uid):
        raise HTTPException(400, "无效的复习快照")
    snap_json = json.dumps(snap, ensure_ascii=False)
    if len(snap_json) > 200_000:
        raise HTTPException(400, "复习快照过大")
    db.save_review_cur(uid, snap_json)
    return {"ok": True}


@router.get("/api/review/cur")
def api_review_cur_get(uid: str = ""):
    uid = uid.strip()[:64]
    if not uid:
        raise HTTPException(400, "缺少 uid")
    d = db.get_review_cur(uid)
    if not d or time.time() - d["updated_at"] > REVIEW_CUR_TTL_S or not d["snap"]:
        return {}
    return {"snap": d["snap"]}


@router.post("/api/review/{mid}")
def api_review_record(mid: int, body: dict):
    try:
        uid = (body.get("uid") or "").strip()[:64] or None
        return db.record_review(mid, bool(body.get("correct")), uid=uid)
    except KeyError:
        raise HTTPException(404, "错题不存在") from None


@router.get("/api/stats")
def api_stats(uid: str = ""):
    s = db.stats(uid=uid.strip()[:64] or None)
    for row in s["by_module"]:
        row["module"] = kb.MODULES.get(row["module"], {}).get("name", row["module"])
    return s
