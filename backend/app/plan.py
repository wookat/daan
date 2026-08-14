"""学习计划规则引擎：报考画像 + 历史作答数据 → 今日任务清单（即时计算，无需物化）。

规则说明：
- 距考天数 days_left = 考试日期 - 今天（东八区）。
- 阶段划分（按剩余天数 + 基础自评倒排）：
    基础期：days_left > 基础阈值（零基础 90 / 有基础 60 / 二战 45）
    专项期：30 < days_left <= 基础阈值
    真题期：14 < days_left <= 30（专项练习切换真题模式）
    冲刺期：days_left <= 14（真题模式 + 错题优先）
- 每日专项练习量 N = clamp(每日可用时长(分钟) × 0.5, 10, 100)，按弱项拆成 1~2 个
  专项任务（弱项来自 answer_log 正确率，即现有 recommend_stats 口径，今日主攻模块优先），
  剩余量为综合练习。
- 错题复习 M = min(到期错题数, max(5, 时长//10), 20)；今日新产生的错题不计入今日任务（首次复习属于明天），避免已完成任务回退；复习队列本身仍可立即复习新错题。
- 每周 1 次模考：本周（周一起）无已交卷模考记录时列入任务。
- 完成判定：练习/综合任务用当日 answer_log 按模块/题型计数；复习用当日 review_log；
  模考用本周 exam_attempts 交卷记录。
"""
import datetime
import time

from . import db

MOD_NAMES = {
    "ziliao": "资料分析", "shuliang": "数量关系", "yanyu": "言语理解",
    "panduan": "判断推理", "changshi": "常识判断",
}

BASE_THRESHOLD = {"零基础": 90, "有基础": 60, "二战": 45}

PHASES = {
    "jichu": "基础期",
    "zhuanxiang": "专项期",
    "zhenti": "真题期",
    "chongci": "冲刺期",
}


def _days_left(exam_date: str | None) -> int | None:
    if not exam_date:
        return None
    try:
        exam = datetime.date.fromisoformat(exam_date)
    except ValueError:
        return None
    today = datetime.datetime.fromtimestamp(time.time() + 8 * 3600, datetime.timezone.utc).date()
    return (exam - today).days


def _phase(days_left: int | None, base_level: str | None) -> str:
    if days_left is None:
        return "zhuanxiang"
    jichu_max = BASE_THRESHOLD.get(base_level or "", 90)
    if days_left > jichu_max:
        return "jichu"
    if days_left > 30:
        return "zhuanxiang"
    if days_left > 14:
        return "zhenti"
    return "chongci"


def today_plan(uid: str) -> dict:
    profile = db.get_user_profile(uid)
    if not profile:
        return {"profile": None, "tasks": []}
    days_left = _days_left(profile.get("exam_date"))
    phase = _phase(days_left, profile.get("base_level"))
    minutes = profile.get("daily_minutes") or 60
    n_practice = max(10, min(100, round(minutes * 0.5)))
    real = phase in ("zhenti", "chongci")

    today = db.today_answer_counts(uid)
    reviewed = db.reviews_today(uid)
    # 今日新错题不计入今日计划，否则按计划练习产生的新错题会把刚完成的复习任务变回未完成
    cn_day_start = (int(time.time() + 8 * 3600) // 86400) * 86400 - 8 * 3600
    due = db.due_review_count(uid, created_before=cn_day_start)

    tasks: list[dict] = []

    # 错题复习（到期口径与现有复习队列一致）
    m_review = min(max(5, minutes // 10), 20)
    review_target = min(m_review, reviewed + due)
    if review_target > 0:
        tasks.append({
            "key": "review",
            "type": "review",
            "title": f"错题复习 {review_target} 道",
            "sub": f"还有 {due} 道到期" if due else "今日到期错题已清",
            "target": review_target,
            "done_n": min(reviewed, review_target),
            "done": reviewed >= review_target,
        })

    # 错题同考点强化（spec-03）：今日复习完成且有薄弱考点时追加一组
    if review_target > 0 and reviewed >= review_target:
        picked = db.reinforce_candidates(uid, include_done=True)["picked"]
        if picked:
            done_n = db.today_skill_count(
                uid, tag3=picked["tag3"], submodule=None if picked["tag3"] else picked["submodule"]
            )
            n = db.REINFORCE_N
            label = picked["tag3_name"] or picked["submodule"]
            tasks.append({
                "key": "reinforce",
                "type": "reinforce",
                "title": f"同考点强化：{label} {n} 题",
                "sub": f"今日复习仍薄弱 · 掌握度 {round(picked['mastery'] * 100)}%",
                "target": n,
                "done_n": min(done_n, n),
                "done": done_n >= n,
                "module": picked["module"],
                "submodule": picked["submodule"],
                "tag3": picked["tag3"],
            })

    # 专项练习：优先弱项（今日主攻模块置前）
    weak = db.recommend_stats(uid, top=4)["items"]
    focus = (db.get_user_state(uid) or {}).get("focus_module") or ""
    if focus:
        weak.sort(key=lambda w: 0 if w.get("module") == focus else 1)
    assigned = 0
    counted_subs: list[str] = []
    for i, w in enumerate(weak[:2]):
        n = round(n_practice * 0.6) if i == 0 else n_practice - assigned
        n = max(5, min(n, n_practice - assigned))
        if n <= 0:
            break
        sub = w["submodule"]
        done_n = today["by_sub"].get(sub, {}).get("n", 0)
        counted_subs.append(sub)
        tasks.append({
            "key": f"practice_{i}",
            "type": "practice",
            "title": f"专项练习：{sub} {n} 题",
            "sub": f"{w['reason']} · 正确率 {round(w['acc'] * 100)}%",
            "target": n,
            "done_n": min(done_n, n),
            "done": done_n >= n,
            "module": w.get("module") or None,
            "submodule": sub,
            "real": real,
        })
        assigned += n
    if assigned < n_practice:
        n = n_practice - assigned
        others = today["total"] - sum(today["by_sub"].get(s, {}).get("n", 0) for s in counted_subs)
        tasks.append({
            "key": "practice_mix",
            "type": "practice",
            "title": ("真题" if real else "综合") + f"刷题 {n} 题",
            "sub": "巩固全模块手感" if weak else "先刷起来，积累弱项数据后推荐更准",
            "target": n,
            "done_n": max(0, min(others, n)),
            "done": others >= n,
            "module": (focus or None),
            "submodule": None,
            "real": real,
        })

    # 每周一次模考
    mock_done = db.mock_done_this_week(uid)
    tasks.append({
        "key": "mock",
        "type": "mock",
        "title": "本周模考 1 次",
        "sub": "已完成，下周继续" if mock_done else ("真题卷或迷你模考均可" if not real else "建议整卷全真模考"),
        "target": 1,
        "done_n": 1 if mock_done else 0,
        "done": mock_done,
    })

    done_cnt = sum(1 for t in tasks if t["done"])
    return {
        "profile": profile,
        "days_left": days_left,
        "phase": phase,
        "phase_name": PHASES[phase],
        "real_mode": real,
        "tasks": tasks,
        "progress": {"done": done_cnt, "total": len(tasks)},
        "today": {"n": today["total"], "correct": today["correct"]},
    }
