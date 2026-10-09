"""真实用户/样本评审域（自 db.py 拆出）：real_user_report 反作弊报表 + sample_review 样本抽检。
经 `from . import db` 调 db.get_conn()：测试对 db.get_conn/db.DB_PATH 的 monkeypatch 依然生效。"""
import re
import time

from . import db

__all__ = ["_OWNER_UID", "_TEST_NICK_RE", "_TEST_UID_RE", "_ensure_sample_reviews", "_uid_kind", "real_user_report", "sample_review_delete", "sample_review_set", "sample_review_summary", "sample_reviews"]


_TEST_UID_RE = re.compile(
    r"^(dev-|qa-|r88grp|r32-main|r26-|r25|r28|r34|r41|test|smoke|probe|ua_)"
    r"|tmp|_test$|demo", re.IGNORECASE)
_TEST_NICK_RE = re.compile(r"测试|走查|审查|体验|QA|R\d+|小助手|smoke|probe", re.IGNORECASE)
_OWNER_UID = "u21"  # piemvibes 主号，单独标注不计入真人


def _uid_kind(uid: str) -> str:
    if re.fullmatch(r"u\d+", uid or ""):
        return "reg"
    return "anon"


def real_user_report(days: int = 60) -> dict:
    conn = db.get_conn()
    q = conn.execute
    now = time.time()
    since = now - days * 86400

    rows = list(q(
        "SELECT uid, created_at, secs, probe FROM answer_log WHERE created_at>=? ORDER BY uid, created_at",
        (since,),
    ))
    regs = {
        "u" + str(r["id"]): r
        for r in q("SELECT id, phone, nickname, created_at, last_login FROM users")
    }
    profiles = {r["uid"] for r in q("SELECT uid FROM user_profile")}
    conn.close()

    users: dict[str, dict] = {}
    for r in rows:
        u = users.setdefault(r["uid"], {"n": 0, "probe": 0, "secs": [], "ts": []})
        u["n"] += 1
        u["probe"] += 1 if r["probe"] else 0
        if r["secs"]:
            u["secs"].append(r["secs"])
        u["ts"].append(r["created_at"])

    def classify(uid: str, u: dict) -> dict:
        reg = regs.get(uid)
        test_uid = bool(_TEST_UID_RE.search(uid))
        test_reg = bool(reg and (_TEST_NICK_RE.search(reg["nickname"] or "")
                                 or re.match(r"1(39|99)0000", reg["phone"] or "")))
        only_probe = u["n"] > 0 and u["probe"] == u["n"]
        if test_uid or test_reg or only_probe:
            return {"verdict": "excluded", "signals": ["test_prefix" if (test_uid or test_reg) else "all_probe"]}
        if uid == _OWNER_UID:
            return {"verdict": "owner", "signals": ["owner_account"]}
        ts = u["ts"]
        days_active = len({time.strftime("%Y-%m-%d", time.localtime(t)) for t in ts})
        avg = sum(u["secs"]) / len(u["secs"]) if u["secs"] else 0.0
        gaps = [ts[i + 1] - ts[i] for i in range(len(ts) - 1)]
        max_gap = max(gaps) if gaps else 0.0
        sigs = []
        if reg:
            sigs.append("registered")
        if uid in profiles:
            sigs.append("has_profile")
        real = (
            reg is not None
            or uid in profiles
            or avg >= 8
            or max_gap >= 300
            or (days_active >= 2 and avg >= 5)
        )
        if real:
            if avg >= 8: sigs.append("human_pace")
            if max_gap >= 300: sigs.append("long_gaps")
            if days_active >= 2: sigs.append("multi_day")
            return {"verdict": "real", "signals": sigs}
        return {"verdict": "suspect", "signals": ["fast_pace" if avg < 5 else "single_short_session"]}

    def isotime(t):
        return time.strftime("%Y-%m-%d %H:%M", time.localtime(t))

    items = []
    for uid, u in users.items():
        verdict = classify(uid, u)
        ts = u["ts"]
        avg = round(sum(u["secs"]) / len(u["secs"]), 1) if u["secs"] else None
        max_gap = max([ts[i + 1] - ts[i] for i in range(len(ts) - 1)] or [0])
        reg = regs.get(uid)
        last = ts[-1]
        items.append({
            "uid": uid, "kind": _uid_kind(uid),
            "nickname": (reg["nickname"] if reg else None),
            "answers": u["n"],
            "days_active": len({time.strftime("%Y-%m-%d", time.localtime(t)) for t in ts}),
            "avg_secs": avg, "max_gap_min": round(max_gap / 60, 1),
            "first": isotime(ts[0]), "last": isotime(last),
            "last_ts": last,
            "verdict": verdict["verdict"], "signals": verdict["signals"],
        })
    items.sort(key=lambda x: -x["last_ts"])
    for it in items:
        del it["last_ts"]

    def window_count(w):
        cut = now - w * 86400
        out = {"real": 0, "suspect": 0, "excluded": 0, "owner": 0}
        for it in items:
            if it["answers"] and any(r["uid"] == it["uid"] and r["created_at"] >= cut for r in rows):
                out[it["verdict"]] += 1
        return out

    weekly = {}
    for r in rows:
        wk = time.strftime("%G-W%V", time.gmtime(r["created_at"]))
        weekly.setdefault(wk, {"answers": 0, "uids": set()})
        weekly[wk]["answers"] += 1
        weekly[wk]["uids"].add(r["uid"])
    verdict_of = {it["uid"]: it["verdict"] for it in items}
    weekly_out = [
        {"week": wk,
         "answers": w["answers"],
         "real_users": len({u for u in w["uids"] if verdict_of.get(u) == "real"})}
        for wk, w in sorted(weekly.items())
    ]

    new_regs = [
        {"id": r["id"], "nickname": r["nickname"],
         "phone": (r["phone"][:3] + "****" + r["phone"][-4:]) if r["phone"] and len(r["phone"]) >= 7 else r["phone"],
         "created_at": isotime(r["created_at"]),
         "answers_window": users.get("u" + str(r["id"]), {}).get("n", 0),
         "verdict": "excluded" if _TEST_NICK_RE.search(r["nickname"] or "") or re.match(r"1(39|99)0000", r["phone"] or "") else "real"}
        for r in sorted(regs.values(), key=lambda x: -(x["created_at"] or 0))
        if (r["created_at"] or 0) >= since
    ]

    return {
        "generated_at": isotime(now),
        "window_days": days,
        "summary": {"d7": window_count(7), "d30": window_count(30)},
        "users": items,
        "weekly": weekly_out,
        "new_registrations": new_regs,
        "rules": "excluded=测试前缀/全probe/测试注册号; real=注册号|有档案|均时>=8s|间隔>300s|跨天且均时>=5s; suspect=其余匿名",
    }


def _ensure_sample_reviews(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS sample_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            batch TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            verdict TEXT NOT NULL,
            note TEXT,
            UNIQUE(batch, question_id)
        )"""
    )


def sample_review_set(batch: str, question_id: int, verdict: str, note: str | None) -> dict:
    conn = db.get_conn()
    _ensure_sample_reviews(conn)
    conn.execute(
        "INSERT INTO sample_reviews (created_at, batch, question_id, verdict, note) VALUES (?,?,?,?,?) "
        "ON CONFLICT(batch, question_id) DO UPDATE SET verdict=excluded.verdict, note=excluded.note, created_at=excluded.created_at",
        (time.time(), batch, question_id, verdict, note),
    )
    conn.commit()
    conn.close()
    return sample_review_summary(batch)


def sample_review_delete(batch: str, question_id: int) -> None:
    conn = db.get_conn()
    _ensure_sample_reviews(conn)
    conn.execute("DELETE FROM sample_reviews WHERE batch=? AND question_id=?", (batch, question_id))
    conn.commit()
    conn.close()


def sample_reviews(batch: str) -> list[dict]:
    conn = db.get_conn()
    _ensure_sample_reviews(conn)
    rows = conn.execute(
        "SELECT question_id, verdict, note, created_at FROM sample_reviews WHERE batch=? ORDER BY created_at",
        (batch,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def sample_review_summary(batch: str) -> dict:
    conn = db.get_conn()
    _ensure_sample_reviews(conn)
    rows = conn.execute(
        "SELECT verdict, COUNT(*) n FROM sample_reviews WHERE batch=? GROUP BY verdict", (batch,)
    ).fetchall()
    conn.close()
    out = {"ok": 0, "problem": 0}
    for r in rows:
        out[r["verdict"]] = r["n"]
    return out
