"""周学习报告：每周一 0 点（东八区）后可看上一周，首次访问惰性聚合并冻结快照。

数据全部来自既有 answer_log / review_log / exam_attempts / mistakes / mock_event_entries；
上周无任何学习行为返回 {status:"empty"}；快照只保留最近 12 周（惰性清理）。
"""
import calendar
import json
import time

from fastapi import APIRouter, HTTPException

from . import db
from .insights import _week_start
from .mock_event import ensure_weekly_event

router = APIRouter(prefix="/api/report")

TZ = 8 * 3600
KEEP_WEEKS = 12
MOD_NAMES = {
    "ziliao": "资料分析", "shuliang": "数量关系", "yanyu": "言语理解",
    "panduan": "判断推理", "changshi": "常识判断",
}


def init_report_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS weekly_reports (
            uid TEXT NOT NULL,
            week_start REAL NOT NULL,
            payload TEXT NOT NULL,
            created_at REAL NOT NULL,
            read_at REAL,
            PRIMARY KEY (uid, week_start)
        )"""
    )
    conn.commit()
    conn.close()


def _clean_uid(uid) -> str:
    u = str(uid or "").strip()[:64]
    if not u:
        raise HTTPException(400, "缺少 uid")
    return u


def _week_of(param: str | None) -> float:
    """week 参数（YYYY-MM-DD，属于该周任一天）→ 周一 0 点时间戳；默认上一周。"""
    now = time.time()
    if param:
        try:
            # 日期按东八区当天中午取时间戳，避免时区边界歧义
            ts = calendar.timegm(time.strptime(param, "%Y-%m-%d")) - TZ + 12 * 3600
        except ValueError:
            raise HTTPException(400, "week 参数格式应为 YYYY-MM-DD")
        ws = _week_start(ts)
    else:
        ws = _week_start(now) - 7 * 86400
    if ws + 7 * 86400 > now:
        raise HTTPException(400, "该周尚未结束，周一之后可查看")
    return ws


def _fmt_day(ts: float) -> str:
    return time.strftime("%Y-%m-%d", time.gmtime(ts + TZ))


def _week_answer_rows(conn, uid: str, ws: float) -> list[dict]:
    db._ensure_answer_log(conn)
    return [dict(r) for r in conn.execute(
        "SELECT created_at, module, submodule, correct, secs FROM answer_log"
        " WHERE uid=? AND created_at>=? AND created_at<?",
        (uid, ws, ws + 7 * 86400),
    ).fetchall()]


def _week_summary(rows: list[dict]) -> dict:
    n = len(rows)
    correct = sum(1 for r in rows if r["correct"])
    secs = sum(r["secs"] or 0 for r in rows)
    days = len({int((r["created_at"] + TZ) // 86400) for r in rows})
    return {
        "n": n,
        "correct": correct,
        "acc": round(correct / n, 3) if n else 0,
        "secs": secs,
        "days": days,
    }


def _sub_acc(rows: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for r in rows:
        sub = r.get("submodule")
        if not sub:
            continue
        d = out.setdefault(sub, {"n": 0, "c": 0, "module": r.get("module")})
        d["n"] += 1
        if r["correct"]:
            d["c"] += 1
    return out


def _build(uid: str, ws: float) -> dict | None:
    we = ws + 7 * 86400
    conn = db.get_conn()
    try:
        rows = _week_answer_rows(conn, uid, ws)
        db._ensure_review_log(conn)
        reviews = conn.execute(
            "SELECT COUNT(*) n FROM review_log WHERE uid=? AND created_at>=? AND created_at<?",
            (uid, ws, we),
        ).fetchone()["n"]
        db._ensure_exam_tables(conn)
        exams = [dict(r) for r in conn.execute(
            "SELECT id, paper_id, score, submitted_at FROM exam_attempts"
            " WHERE uid=? AND submitted_at>=? AND submitted_at<?",
            (uid, ws, we),
        ).fetchall()]
        if not rows and not reviews and not exams:
            return None

        cur = _week_summary(rows)
        prev_rows = _week_answer_rows(conn, uid, ws - 7 * 86400)
        prev = _week_summary(prev_rows)

        # 掌握度升降：两周都有 >=3 题样本的二级题型
        cur_sub, prev_sub = _sub_acc(rows), _sub_acc(prev_rows)
        changes = []
        for sub, d in cur_sub.items():
            p = prev_sub.get(sub)
            if not p or d["n"] < 3 or p["n"] < 3:
                continue
            delta = d["c"] / d["n"] - p["c"] / p["n"]
            changes.append({
                "submodule": sub,
                "module": d.get("module"),
                "acc": round(d["c"] / d["n"], 3),
                "prev_acc": round(p["c"] / p["n"], 3),
                "delta": round(delta, 3),
            })
        ups = sorted([c for c in changes if c["delta"] > 0.02], key=lambda x: -x["delta"])[:3]
        downs = sorted([c for c in changes if c["delta"] < -0.02], key=lambda x: x["delta"])[:3]

        # 错因分布（本周新增错题 vs 上周）
        db._ensure_mistake_uid(conn)
        def reasons(a, b):
            rs = conn.execute(
                "SELECT COALESCE(NULLIF(error_reason,''),'未标注') k, COUNT(*) n FROM mistakes"
                " WHERE uid=? AND created_at>=? AND created_at<? GROUP BY k ORDER BY n DESC",
                (uid, a, b),
            ).fetchall()
            return [{"reason": r["k"], "n": r["n"]} for r in rs]
        cur_reasons = reasons(ws, we)
        prev_reasons = {r["reason"]: r["n"] for r in reasons(ws - 7 * 86400, ws)}
        for r in cur_reasons:
            r["prev_n"] = prev_reasons.get(r["reason"], 0)

        # 本周模考/比赛回顾
        mock = None
        best = max(exams, key=lambda e: e["score"] or 0) if exams else None
        if best:
            mock = {"attempt_id": best["id"], "score": best["score"], "n_exams": len(exams)}
            ev = conn.execute(
                """SELECT e.event_id, e.rank, ev.title,
                          (SELECT COUNT(*) FROM mock_event_entries x
                           WHERE x.event_id=e.event_id AND x.score IS NOT NULL) total,
                          (SELECT COUNT(*) FROM mock_event_entries x
                           WHERE x.event_id=e.event_id AND x.score IS NOT NULL AND x.score<e.score) below
                   FROM mock_event_entries e JOIN mock_events ev ON ev.id=e.event_id
                   WHERE e.uid=? AND e.score IS NOT NULL AND ev.open_at>=? AND ev.close_at<=?
                   ORDER BY e.score DESC LIMIT 1""",
                (uid, ws, we),
            ).fetchone()
            if ev:
                mock["event_title"] = ev["title"]
                mock["rank"] = ev["rank"]
                mock["pct"] = round(100 * ev["below"] / ev["total"]) if ev["total"] > 1 else 100

        # 徽章（规则版，至多 3 枚）
        badges = []
        if cur["days"] >= 7:
            badges.append({"key": "streak7", "title": "全勤一周", "desc": "本周 7 天都有练习"})
        if cur["n"] >= 30 and cur["acc"] > (prev["acc"] or 0) and prev["n"] >= 10:
            badges.append({"key": "acc_up", "title": "正确率提升", "desc": f"较上周提升 {round((cur['acc'] - prev['acc']) * 100)} 个百分点"})
        if mock:
            badges.append({"key": "mock_done", "title": "完成模考", "desc": f"本周模考最高 {mock['score']} 分"})
        if ups and len(badges) < 3:
            badges.append({"key": "mastery_up", "title": "考点进阶", "desc": f"{ups[0]['submodule']} 正确率上升"})
        badges = badges[:3]

        # 下周行动
        due = db.due_review_count(uid)
        weak = db.recommend_stats(uid, top=3)["items"]
        actions = []
        if due:
            actions.append({"type": "review", "title": f"清理 {due} 道到期错题", "url": "/pages/book/book"})
        for w in weak[:2]:
            tag = w.get("tag3")
            actions.append({
                "type": "practice",
                "title": f"专项突破：{w.get('label') or w.get('submodule')}",
                "url": ("/pages/practice/practice?tag3=" + tag) if tag else
                       ("/pages/practice/practice?module=" + (w.get("module") or "") + "&submodule=" + (w.get("submodule") or "")),
            })
        actions.append({"type": "mock", "title": "参加下周六全站模考大赛", "url": "/pkgA/exam/contest"})

        return {
            "status": "ok",
            "week_start": ws,
            "week_end": we,
            "range": f"{_fmt_day(ws)} ~ {_fmt_day(we - 86400)}",
            "summary": {**cur, "reviews": reviews, "n_exams": len(exams)},
            "prev": prev,
            "badges": badges,
            "compare": {
                "n": [cur["n"], prev["n"]],
                "acc": [cur["acc"], prev["acc"]],
                "secs": [cur["secs"], prev["secs"]],
                "days": [cur["days"], prev["days"]],
            },
            "mastery": {"up": ups, "down": downs},
            "reasons": cur_reasons,
            "mock": mock,
            "actions": actions,
        }
    finally:
        conn.close()


def _cleanup(conn, uid: str):
    cutoff = _week_start(time.time()) - KEEP_WEEKS * 7 * 86400
    conn.execute("DELETE FROM weekly_reports WHERE uid=? AND week_start<?", (uid, cutoff))


@router.get("/weekly")
def api_weekly(uid: str = "", week: str | None = None):
    uid = _clean_uid(uid)
    ws = _week_of(week)
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT payload FROM weekly_reports WHERE uid=? AND week_start=?", (uid, ws)
        ).fetchone()
        if row:
            return json.loads(row["payload"])
    finally:
        conn.close()
    data = _build(uid, ws)
    if data is None:
        return {"status": "empty", "week_start": ws, "range": f"{_fmt_day(ws)} ~ {_fmt_day(ws + 6 * 86400)}"}
    conn = db.get_conn()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO weekly_reports(uid, week_start, payload, created_at)"
            " VALUES(?,?,?,?)",
            (uid, ws, json.dumps(data, ensure_ascii=False), time.time()),
        )
        _cleanup(conn, uid)
        conn.commit()
    finally:
        conn.close()
    return data


@router.get("/weekly/list")
def api_weekly_list(uid: str = ""):
    uid = _clean_uid(uid)
    now = time.time()
    last_ws = _week_start(now) - 7 * 86400
    conn = db.get_conn()
    try:
        rows = conn.execute(
            "SELECT week_start, payload, read_at FROM weekly_reports WHERE uid=?"
            " ORDER BY week_start DESC LIMIT ?",
            (uid, KEEP_WEEKS),
        ).fetchall()
        by_ws = {r["week_start"]: r for r in rows}
        items = []
        for i in range(KEEP_WEEKS):
            ws = last_ws - i * 7 * 86400
            r = by_ws.get(ws)
            it = {
                "week_start": ws,
                "range": f"{_fmt_day(ws)} ~ {_fmt_day(ws + 6 * 86400)}",
                "generated": bool(r),
                "read": bool(r and r["read_at"]),
            }
            if r:
                p = json.loads(r["payload"])
                it["n"] = (p.get("summary") or {}).get("n", 0)
                it["acc"] = (p.get("summary") or {}).get("acc", 0)
            items.append(it)
        return {"items": items}
    finally:
        conn.close()


@router.post("/weekly/read")
def api_weekly_read(body: dict):
    uid = _clean_uid(body.get("uid"))
    ws = _week_of(str(body.get("week") or "") or None)
    conn = db.get_conn()
    try:
        conn.execute(
            "UPDATE weekly_reports SET read_at=? WHERE uid=? AND week_start=? AND read_at IS NULL",
            (time.time(), uid, ws),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.get("/weekly/next_event")
def api_next_event():
    """周报「下周行动」里的下一场比赛预告。"""
    ensure_weekly_event()
    now = time.time()
    conn = db.get_conn()
    try:
        row = conn.execute(
            "SELECT id, title, open_at, close_at FROM mock_events WHERE close_at>? ORDER BY open_at LIMIT 1",
            (now,),
        ).fetchone()
        return {"event": dict(row) if row else None}
    finally:
        conn.close()
