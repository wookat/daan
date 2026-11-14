"""产品数据分析（管理端聚合层）：规模/留存/习惯/漏斗/团队/AI 质量/考试题库。

llm_stats 写入走后台单写线程：记录点散布在 async 请求链路（llm.py finally、
ai_api 命中分支），sqlite 连接 isolation_level=IMMEDIATE 会在持锁竞争时
阻塞事件循环（W14 回归：/api/health 曾被冻 2.8s），故 record_llm 只做入队。

口径约定：
- 活跃 = 当日 answer_log ∪ growth_events 存在 REAL_TRAFFIC 行（打开即算，不只答题）。
- 新用户 = 该 uid 在两表的全局首现日；匿名 uid 与注册 uid（u+数字）分列。
- 会话 = growth_events.session_id 分组（前端 30 分钟无活动轮换，随 X-Kg-Session 上送）。
- 平台 = growth_events.platform（h5/mp-weixin/app…），旧行 NULL 归入「未标记」。
- llm_stats = llm.py 每次调用终态；channel: text|main|fallback|rescue（传输层）
  与 feat:*（功能层命中，如 feat:explain_cache/feat:explain_gen）。
- 留存 = 队列用户在第 N 个自然日有任何活动即记为留存（UTC+8 自然日）。
"""
import queue
import re
import threading
import time
from collections import defaultdict

from . import db

_UID_REG = re.compile(r"^u\d+$")
_REAL = "COALESCE(probe,0)=0"
SESS_IDLE_SEC = 30 * 60

# 传输层通道名（llm.py 写入）；feat:* 是功能层命中标记，不进通道分布
TRANSPORT_CHANNELS = ("text", "main", "fallback", "rescue")


def init_analytics_db() -> None:
    conn = db.get_conn()
    # 聚合层引用的懒建表（首写时才创建的那些）先确保存在——否则全新部署上
    # /api/admin/analytics/* 会因 no such table 报错。各 ensure 均幂等。
    for ensure in (
        db._ensure_answer_log,
        db._ensure_exam_tables,
        db._ensure_review_log,
        db._ensure_shenlun_answers,
        db._ensure_sl_drafts,
        db._ensure_ask_sessions,
    ):
        try:
            ensure(conn)
        except Exception:
            pass  # 单表失败不阻塞启动；对应聚合项会因空表返回 0
    conn.execute(
        """CREATE TABLE IF NOT EXISTS llm_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            model TEXT,
            ok INTEGER NOT NULL DEFAULT 1,
            ms INTEGER,
            img INTEGER DEFAULT 0,
            stream INTEGER DEFAULT 0,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ls_ct ON llm_stats(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ls_ch ON llm_stats(channel, created_at)")
    conn.commit()
    conn.close()


_LLM_Q: queue.SimpleQueue = queue.SimpleQueue()
_WLOCK = threading.Lock()
_WRITER: threading.Thread | None = None
_LLM_COLS = "INSERT INTO llm_stats (channel, model, ok, ms, img, stream, created_at) VALUES (?,?,?,?,?,?,?)"


def _drain_llm_stats() -> int:
    """把队列中积压的记录批量写入；写线程主体，测试也可直接调用强制落盘。"""
    conn = db.get_conn()
    n = 0
    try:
        while n < 1000:
            try:
                rec = _LLM_Q.get_nowait()
            except queue.Empty:
                break
            conn.execute(_LLM_COLS, rec)
            n += 1
        if n:
            conn.commit()
    finally:
        conn.close()
    return n


def _llm_writer() -> None:
    while True:
        _LLM_Q.get()  # 等第一条，醒后把积压的一批都带走
        try:
            _drain_llm_stats()
        except Exception:
            pass


def record_llm(channel: str, model: str | None, ok: bool, ms: int, img: bool, stream: bool) -> None:
    """llm.py / ai_api 的调用终态记录；只入队不碰 DB，异步链路零阻塞；任何失败都吞掉。"""
    global _WRITER
    try:
        if _WRITER is None or not _WRITER.is_alive():
            with _WLOCK:
                if _WRITER is None or not _WRITER.is_alive():
                    _WRITER = threading.Thread(target=_llm_writer, daemon=True, name="llm-stats-writer")
                    _WRITER.start()
        _LLM_Q.put(
            (channel[:32], (model or "")[:64] or None, 1 if ok else 0, int(ms),
             1 if img else 0, 1 if stream else 0, time.time())
        )
    except Exception:
        pass


def _day(ts: float) -> str:
    return time.strftime("%Y-%m-%d", time.localtime(ts))


def _act_rows(conn, start: float, end: float | None = None) -> list[dict]:
    """窗口内全部真实流量活动行（uid/created_at/src）。src=a 作答、e 事件。"""
    cond = " AND created_at<?" if end else ""
    args = [start] + ([end] if end else [])
    return [
        dict(r)
        for r in conn.execute(
            f"""SELECT uid, created_at, src FROM (
                    SELECT uid, created_at, 'a' AS src FROM answer_log
                    WHERE created_at>=?{cond} AND {_REAL}
                    UNION ALL
                    SELECT uid, created_at, 'e' AS src FROM growth_events
                    WHERE created_at>=?{cond} AND {_REAL}
                )""",
            args + args,
        )
        if r["uid"]
    ]


def _first_seen(conn, uids: set[str]) -> dict[str, float]:
    """uid 在两表的全局首现时刻（只在需要的 uid 集合上求值）。"""
    out: dict[str, float] = {}
    if not uids:
        return out
    marks = ",".join("?" * len(uids))
    for r in conn.execute(
        f"""SELECT uid, MIN(t) first_t FROM (
                SELECT uid, MIN(created_at) t FROM answer_log WHERE uid IN ({marks}) GROUP BY uid
                UNION ALL
                SELECT uid, MIN(created_at) t FROM growth_events WHERE uid IN ({marks}) GROUP BY uid
            ) GROUP BY uid""",
        list(uids) + list(uids),
    ):
        out[r["uid"]] = r["first_t"]
    return out


# ---------- 1) 使用规模 ----------

def usage_overview(days: int = 30) -> dict:
    days = max(7, min(days, 180))
    conn = db.get_conn()
    q = conn.execute
    now = time.time()
    day0 = db._day_start()
    start = db._day_start(-(days - 1))
    rows = _act_rows(conn, start)

    per_day: dict[str, dict] = defaultdict(lambda: {"uids": set(), "answers": 0, "events": 0})
    uids_all: set[str] = set()
    for r in rows:
        d = _day(r["created_at"])
        per_day[d]["uids"].add(r["uid"])
        per_day[d]["answers" if r["src"] == "a" else "events"] += 1
        uids_all.add(r["uid"])

    today_s, yday_s = _day(day0), _day(day0 - 86400)
    act = lambda d: len(per_day[d]["uids"]) if d in per_day else 0
    dau, dau_y = act(today_s), act(yday_s)

    def _act_between(a: float, b: float) -> set[str]:
        s = set()
        for r in rows:
            if a <= r["created_at"] < b:
                s.add(r["uid"])
        return s

    wau = len(_act_between(now - 7 * 86400, now + 1))
    mau = len(_act_between(now - 30 * 86400, now + 1))

    first_seen = _first_seen(conn, uids_all)
    new_by_day: dict[str, int] = defaultdict(int)
    for u, t in first_seen.items():
        if t and t >= start:
            new_by_day[_day(t)] += 1

    trend = []
    for i in range(days - 1, -1, -1):
        ds = _day(day0 - i * 86400)
        pd = per_day.get(ds)
        trend.append({
            "d": ds,
            "active": len(pd["uids"]) if pd else 0,
            "answers": pd["answers"] if pd else 0,
            "events": pd["events"] if pd else 0,
            "new": new_by_day.get(ds, 0),
        })

    # 平台分布（事件侧新字段；NULL 归未标记，覆盖率另报）
    plat = [
        dict(r)
        for r in q(
            f"""SELECT COALESCE(platform,'未标记') platform, COUNT(DISTINCT uid) u, COUNT(*) n
                FROM growth_events WHERE created_at>=? AND {_REAL} AND uid IS NOT NULL
                GROUP BY platform ORDER BY n DESC""",
            (start,),
        )
    ]
    marked = q(
        f"SELECT COUNT(*) n FROM growth_events WHERE created_at>=? AND {_REAL} AND platform IS NOT NULL",
        (start,),
    ).fetchone()["n"]
    total_ev = q(
        f"SELECT COUNT(*) n FROM growth_events WHERE created_at>=? AND {_REAL}", (start,)
    ).fetchone()["n"]

    # 功能渗透（30 天窗口内用过该功能的 uid 数 / 窗口活跃 uid 数）
    feat_q = {
        "刷题作答": "SELECT COUNT(DISTINCT uid) n FROM answer_log WHERE created_at>=? AND " + _REAL,
        "错题复习": "SELECT COUNT(DISTINCT uid) n FROM review_log WHERE created_at>=? AND " + _REAL,
        "套卷考试": "SELECT COUNT(DISTINCT uid) n FROM exam_attempts WHERE started_at>=?",
        "AI 问答": "SELECT COUNT(DISTINCT uid) n FROM ask_sessions WHERE updated_at>=?",
        "申论作答": "SELECT COUNT(DISTINCT uid) n FROM shenlun_answers WHERE created_at>=?",
        "面试练习": "SELECT COUNT(DISTINCT uid) n FROM interview_sessions WHERE created_at>=?",
        "PK 对战": "SELECT COUNT(DISTINCT uid) n FROM (SELECT creator_uid uid FROM pk_matches UNION SELECT opponent_uid FROM pk_matches) WHERE uid IS NOT NULL",
        "组队成员": "SELECT COUNT(DISTINCT uid) n FROM team_members",
        "主动分享": "SELECT COUNT(DISTINCT from_uid) n FROM shared_questions WHERE created_at>=?",
        "错题本": "SELECT COUNT(DISTINCT uid) n FROM mistakes",
    }
    base_n = max(1, len(uids_all))
    penetration = []
    for name, sql in feat_q.items():
        try:
            n = q(sql, (start,)).fetchone()["n"]
        except Exception:
            n = 0
        penetration.append({"name": name, "users": n, "pct": round(n * 100 / base_n, 1)})
    penetration.sort(key=lambda x: -x["users"])

    top_events = [
        dict(r)
        for r in q(
            f"""SELECT event, COUNT(*) n, COUNT(DISTINCT uid) u
                FROM growth_events WHERE created_at>=? AND {_REAL} GROUP BY event ORDER BY n DESC LIMIT 15""",
            (start,),
        )
    ]

    reg_active = sum(1 for u in uids_all if _UID_REG.match(u))
    new_regs = q(
        "SELECT COUNT(*) n FROM users WHERE created_at>=?", (start,)
    ).fetchone()["n"]
    register_ev = q(
        f"SELECT COUNT(*) n FROM growth_events WHERE event='register' AND created_at>=? AND {_REAL}",
        (start,),
    ).fetchone()["n"]

    conn.close()
    return {
        "kpis": {
            "dau": dau, "dau_yesterday": dau_y,
            "wau": wau, "mau": mau,
            "stickiness": round(dau * 100 / mau, 1) if mau else None,
            "new_today": new_by_day.get(today_s, 0),
            "new_yesterday": new_by_day.get(yday_s, 0),
            "new_registrations": new_regs,
            "register_events": register_ev,
            "active_uids": len(uids_all),
            "registered_active": reg_active,
            "anon_active": len(uids_all) - reg_active,
        },
        "trend": trend,
        "platforms": plat,
        "platform_coverage": round(marked * 100 / total_ev, 1) if total_ev else 0,
        "penetration": penetration,
        "top_events": top_events,
        "days": days,
        "generated_at": now,
    }


# ---------- 2) 留存 ----------

def retention(days: int = 35) -> dict:
    days = max(14, min(days, 90))
    conn = db.get_conn()
    now = time.time()
    day0 = db._day_start()
    start = db._day_start(-(days - 1))
    rows = _act_rows(conn, db._day_start(-(days + 30)))  # 往前多取 30 天兜底更早队列

    uid_days: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        if r["created_at"] >= db._day_start(-(days + 30)):
            uid_days[r["uid"]].add(_day(r["created_at"]))

    first_seen = _first_seen(conn, set(uid_days))
    cohorts: dict[str, set[str]] = defaultdict(set)
    for u, t in first_seen.items():
        if t and start <= t <= now:
            cohorts[_day(t)].add(u)

    ks = (1, 3, 7, 14, 30)
    cohort_rows = []
    for i in range(days - 1, -1, -1):
        cs = _day(day0 - i * 86400)
        members = cohorts.get(cs) or set()
        if not members:
            continue
        row: dict = {"day": cs, "size": len(members)}
        for k in ks:
            target = _day(day0 - (i - k) * 86400)
            if i - k < 0:
                row[f"d{k}"] = None
            else:
                row[f"d{k}"] = round(
                    sum(1 for u in members if target in uid_days.get(u, set())) * 100 / len(members), 1
                )
        cohort_rows.append(row)

    # 周回访率：本周活跃 ∩ 上周活跃 / 上周活跃
    weeks: dict[str, set[str]] = defaultdict(set)
    for u, dset in uid_days.items():
        for ds in dset:
            wk = time.strftime("%G-W%V", time.strptime(ds, "%Y-%m-%d"))
            weeks[wk].add(u)
    wk_sorted = sorted(weeks)
    weekly = []
    for i in range(1, len(wk_sorted)):
        cur, prev = weeks[wk_sorted[i]], weeks[wk_sorted[i - 1]]
        if not prev:
            continue
        weekly.append({
            "week": wk_sorted[i],
            "active": len(cur),
            "returning": len(cur & prev),
            "ret_pct": round(len(cur & prev) * 100 / len(prev), 1),
        })

    conn.close()
    return {
        "cohorts": cohort_rows,
        "weekly": weekly[-8:],
        "days": days,
        "note": "留存=队列用户在第 N 个自然日有任何活动（打开或作答）；队列为两表全局首现日",
        "generated_at": now,
    }


# ---------- 3) 使用习惯 ----------

def habits(days: int = 30) -> dict:
    days = max(7, min(days, 90))
    conn = db.get_conn()
    q = conn.execute
    now = time.time()
    start = db._day_start(-(days - 1))

    heat = [[0] * 24 for _ in range(7)]
    for r in q(
        f"""SELECT CAST(strftime('%w', created_at, 'unixepoch', '+8 hours') AS INTEGER) wd,
                  CAST(strftime('%H', created_at, 'unixepoch', '+8 hours') AS INTEGER) hr,
                  COUNT(*) n
           FROM (
               SELECT created_at FROM answer_log WHERE created_at>=? AND {_REAL}
               UNION ALL
               SELECT created_at FROM growth_events WHERE created_at>=? AND {_REAL}
           ) GROUP BY wd, hr""",
        (start, start),
    ):
        heat[r["wd"]][r["hr"]] = r["n"]

    # 会话（仅有 session_id 的新行；覆盖率先报）
    srows = [
        dict(r)
        for r in q(
            f"""SELECT session_id, uid, MIN(created_at) t0, MAX(created_at) t1, COUNT(*) n
                FROM growth_events
                WHERE created_at>=? AND {_REAL} AND session_id IS NOT NULL AND session_id<>''
                GROUP BY session_id""",
            (start,),
        )
    ]
    total_ev = q(
        f"SELECT COUNT(*) n FROM growth_events WHERE created_at>=? AND {_REAL}", (start,)
    ).fetchone()["n"]
    sess_ev = sum(r["n"] for r in srows)
    durations = sorted(min(r["t1"] - r["t0"], 4 * 3600) for r in srows)
    mid = len(durations) // 2 if durations else 0
    sess_days = max(1, days)
    sessions = {
        "count": len(srows),
        "per_day": round(len(srows) / sess_days, 1),
        "median_sec": round(durations[mid] if durations else 0),
        "p90_sec": round(durations[int(len(durations) * 0.9)] if durations else 0),
        "avg_events": round(sess_ev / len(srows), 1) if srows else 0,
        "coverage_pct": round(sess_ev * 100 / total_ev, 1) if total_ev else 0,
    }

    # 连续活跃天数分布（窗口内每 uid 的最长连续段）
    day_rows = [
        (r["uid"], r["d"])
        for r in q(
            f"""SELECT DISTINCT uid, date(created_at,'unixepoch','+8 hours') d
                FROM (
                    SELECT uid, created_at FROM answer_log WHERE created_at>=? AND {_REAL}
                    UNION ALL
                    SELECT uid, created_at FROM growth_events WHERE created_at>=? AND {_REAL}
                )""",
            (start, start),
        )
        if r["uid"]
    ]
    uid_days: dict[str, list[int]] = defaultdict(list)
    day_num = {ds: i for i, ds in enumerate(sorted({d for _, d in day_rows}))}
    for u, ds in day_rows:
        uid_days[u].append(day_num[ds])
    streak_bins = {"1天": 0, "2天": 0, "3-6天": 0, "7-13天": 0, "14-29天": 0, "30天+": 0}
    for u, nums in uid_days.items():
        best = cur = 1
        for a, b in zip(sorted(nums), sorted(nums)[1:]):
            cur = cur + 1 if b == a + 1 else 1
            best = max(best, cur)
        if best >= 30:
            streak_bins["30天+"] += 1
        elif best >= 14:
            streak_bins["14-29天"] += 1
        elif best >= 7:
            streak_bins["7-13天"] += 1
        elif best >= 3:
            streak_bins["3-6天"] += 1
        elif best == 2:
            streak_bins["2天"] += 1
        else:
            streak_bins["1天"] += 1

    secs_bins = {"<5s": 0, "5-15s": 0, "15-30s": 0, "30-60s": 0, "60-120s": 0, ">120s": 0}
    for r in q(
        f"SELECT secs, COUNT(*) n FROM answer_log WHERE created_at>=? AND {_REAL} GROUP BY secs",
        (start,),
    ):
        s = r["secs"] or 0
        k = "<5s" if s < 5 else "5-15s" if s < 15 else "15-30s" if s < 30 else "30-60s" if s < 60 else "60-120s" if s < 120 else ">120s"
        secs_bins[k] += r["n"]

    quits = {
        r["event"]: r["n"]
        for r in q(
            f"""SELECT event, COUNT(*) n FROM growth_events
                WHERE created_at>=? AND {_REAL}
                AND event IN ('practice_quit_keep','practice_quit_end','practice_stay_here',
                              'practice_resume_cont','practice_resume_drop')
                GROUP BY event""",
            (start,),
        )
    }

    conn.close()
    return {
        "heatmap": heat,  # [weekday 0=周日..6][hour 0-23]
        "sessions": sessions,
        "streaks": [{"label": k, "users": v} for k, v in streak_bins.items()],
        "answer_secs": [{"label": k, "n": v} for k, v in secs_bins.items()],
        "quit_events": quits,
        "days": days,
        "generated_at": now,
    }


# ---------- 4) 漏斗 ----------

FUNNEL_PRESETS = {
    "分享裂变": ["share_open", "share_answer", "share_copy", "register"],
    "组队邀请": ["team_invite_copy", "team_join_open", "register"],
    "推送转化": ["push_nudge_show", "push_nudge_ok", "boot"],
    "登录引导": ["login_nudge_show", "login_nudge_click", "register"],
    "分享回流": ["share_copy", "share_open", "share_answer"],
}


def funnel(chain: list[str], days: int = 30) -> dict:
    days = max(7, min(days, 90))
    chain = [str(e)[:32] for e in chain if e][:8]
    conn = db.get_conn()
    start = db._day_start(-(days - 1))
    if not chain:
        conn.close()
        return {"steps": [], "presets": FUNNEL_PRESETS, "days": days}
    marks = ",".join("?" * len(chain))
    rows = [
        dict(r)
        for r in conn.execute(
            f"""SELECT uid, event, created_at FROM growth_events
                WHERE created_at>=? AND {_REAL} AND uid IS NOT NULL
                AND event IN ({marks}) ORDER BY uid, created_at""",
            [start] + chain,
        )
    ]
    conn.close()

    # 有序漏斗：step i+1 需发生在 step i 首次达成之后
    by_uid: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_uid[r["uid"]].append(r)
    reached = [0] * len(chain)
    for u, evs in by_uid.items():
        idx, t_prev = 0, 0.0
        for ev in evs:
            if idx < len(chain) and ev["event"] == chain[idx] and ev["created_at"] > t_prev:
                t_prev = ev["created_at"]
                idx += 1
                if idx == len(chain):
                    break
        for i in range(min(idx, len(chain))):
            reached[i] += 1
    steps = [
        {
            "event": e,
            "uids": reached[i],
            "conv_prev": round(reached[i] * 100 / reached[i - 1], 1) if i and reached[i - 1] else (100 if i == 0 and reached[0] else None),
            "conv_first": round(reached[i] * 100 / reached[0], 1) if reached[0] else None,
        }
        for i, e in enumerate(chain)
    ]
    return {"steps": steps, "chain": chain, "presets": FUNNEL_PRESETS, "days": days, "generated_at": time.time()}


# ---------- 5) 团队 ----------

def team_overview(days: int = 30) -> dict:
    days = max(7, min(days, 90))
    conn = db.get_conn()
    q = conn.execute
    now = time.time()
    start = db._day_start(-(days - 1))
    week0 = now - 7 * 86400

    teams = [dict(r) for r in q("SELECT id, name, creator_uid, created_at FROM teams")]
    members = [dict(r) for r in q("SELECT team_id, uid, joined_at FROM team_members")]
    team_uids = {m["uid"] for m in members}

    act_week = {
        r["uid"]
        for r in q(
            f"""SELECT uid FROM answer_log WHERE created_at>=? AND {_REAL}
                UNION SELECT uid FROM growth_events WHERE created_at>=? AND {_REAL}""",
            (week0, week0),
        )
    }
    per_team = defaultdict(list)
    for m in members:
        per_team[m["team_id"]].append(m["uid"])
    active_teams = sum(1 for t, us in per_team.items() if any(u in act_week for u in us))
    sizes = [len(us) for us in per_team.values()] or [0]
    size_bins = {"1人": 0, "2-3人": 0, "4-6人": 0, "7-10人": 0, "11-20人": 0}
    for s in sizes:
        size_bins["1人" if s == 1 else "2-3人" if s <= 3 else "4-6人" if s <= 6 else "7-10人" if s <= 10 else "11-20人"] += 1

    # 成员活跃分层（窗口内 answer_log 计数）
    tier_bins = {"活跃(≥20题)": 0, "一般(1-19题)": 0, "潜水(0题)": 0}
    cnt = {
        r["uid"]: r["n"]
        for r in q(
            f"SELECT uid, COUNT(*) n FROM answer_log WHERE created_at>=? AND {_REAL} GROUP BY uid",
            (start,),
        )
    }
    for u in team_uids:
        n = cnt.get(u, 0)
        tier_bins["活跃(≥20题)" if n >= 20 else "一般(1-19题)" if n >= 1 else "潜水(0题)"] += 1

    # 团队 vs 非团队：近 7 天活跃率（基数=窗口内曾活跃的 uid）
    uids_all = {
        r["uid"]
        for r in q(
            f"""SELECT uid FROM answer_log WHERE created_at>=? AND {_REAL}
                UNION SELECT uid FROM growth_events WHERE created_at>=? AND {_REAL}""",
            (start, start),
        )
    }
    team_act = team_uids & act_week
    solo = uids_all - team_uids
    solo_act = solo & act_week

    top_teams = []
    for tid, us in per_team.items():
        n_ans = sum(cnt.get(u, 0) for u in us)
        top_teams.append({"team_id": tid, "members": len(us), "active_7d": sum(1 for u in us if u in act_week), "answers": n_ans})
    top_teams.sort(key=lambda x: -x["answers"])
    name_of = {t["id"]: t["name"] for t in teams}
    for t in top_teams[:10]:
        t["name"] = name_of.get(t["team_id"], "?")

    conn.close()
    f = funnel(["team_invite_copy", "team_join_open", "register"], days)
    return {
        "kpis": {
            "teams": len(teams),
            "active_teams_7d": active_teams,
            "members": len(team_uids),
            "avg_size": round(sum(sizes) / len(sizes), 1) if sizes else 0,
            "team_active_rate_7d": round(len(team_act) * 100 / len(team_uids), 1) if team_uids else None,
            "solo_active_rate_7d": round(len(solo_act) * 100 / len(solo), 1) if solo else None,
        },
        "size_bins": [{"label": k, "teams": v} for k, v in size_bins.items()],
        "member_tiers": [{"label": k, "users": v} for k, v in tier_bins.items()],
        "invite_funnel": f["steps"],
        "top_teams": top_teams[:10],
        "days": days,
        "generated_at": now,
    }


# ---------- 6) AI 质量与成本 ----------

# 各通道粗估单价（¥/次调用；随实际 token 用量浮动，仅作量级参考）
COST_HINT = {"text": 0.004, "main": 0.01, "fallback": 0.03, "rescue": 0.05}


def ai_quality(days: int = 30) -> dict:
    days = max(7, min(days, 90))
    conn = db.get_conn()
    q = conn.execute
    now = time.time()
    start = db._day_start(-(days - 1))

    by_channel = [
        dict(r)
        for r in q(
            f"""SELECT channel, COUNT(*) n,
                      ROUND(AVG(ok)*100,1) ok_pct,
                      ROUND(AVG(ms)) avg_ms,
                      SUM(img) imgs, SUM(stream) streams
               FROM llm_stats WHERE created_at>=? GROUP BY channel ORDER BY n DESC""",
            (start,),
        )
    ]
    for r in by_channel:
        r["est_cost"] = round(r["n"] * COST_HINT.get(r["channel"], 0.02), 2)

    trend = {}
    for r in q(
        """SELECT date(created_at,'unixepoch','+8 hours') d, channel, COUNT(*) n
           FROM llm_stats WHERE created_at>=? GROUP BY d, channel""",
        (start,),
    ):
        trend.setdefault(r["d"], {})[r["channel"]] = r["n"]
    daily = [{"d": d, **ch} for d, ch in sorted(trend.items())]

    ratings = q(
        "SELECT COALESCE(SUM(up),0) up, COALESCE(SUM(down),0) down, COUNT(*) entries FROM explain_cache"
    ).fetchone()
    rated = q("SELECT COUNT(*) n FROM explain_cache WHERE up>0 OR down>0").fetchone()["n"]

    cache_hit = q(
        "SELECT COUNT(*) n FROM llm_stats WHERE channel='feat:explain_cache' AND created_at>=?", (start,)
    ).fetchone()["n"]
    gen = q(
        "SELECT COUNT(*) n FROM llm_stats WHERE channel='feat:explain_gen' AND created_at>=?", (start,)
    ).fetchone()["n"]

    conn.close()
    return {
        "channels": [r for r in by_channel if r["channel"] in TRANSPORT_CHANNELS],
        "features": [r for r in by_channel if r["channel"].startswith("feat:")],
        "daily": daily,
        "cache": {
            "hits": cache_hit,
            "gens": gen,
            "hit_pct": round(cache_hit * 100 / (cache_hit + gen), 1) if (cache_hit + gen) else None,
        },
        "ratings": {
            "up": ratings["up"], "down": ratings["down"], "rated_entries": rated,
            "up_pct": round(ratings["up"] * 100 / (ratings["up"] + ratings["down"]), 1) if (ratings["up"] + ratings["down"]) else None,
        },
        "est_cost_total": round(sum(r["est_cost"] for r in by_channel if r["channel"] in TRANSPORT_CHANNELS), 2),
        "days": days,
        "generated_at": now,
    }


# ---------- 7) 考试与题库 ----------

def exam_overview(days: int = 90) -> dict:
    days = max(14, min(days, 180))
    conn = db.get_conn()
    q = conn.execute
    now = time.time()
    start = now - days * 86400

    attempts = q(
        "SELECT COUNT(*) n, SUM(submitted_at IS NOT NULL) done, ROUND(AVG(score),1) avg_score "
        "FROM exam_attempts WHERE started_at>=?",
        (start,),
    ).fetchone()
    papers = q("SELECT COUNT(*) n FROM exam_papers").fetchone()["n"]

    mock = q(
        "SELECT COUNT(*) entries, SUM(registered_at IS NOT NULL) reg, SUM(attempt_id IS NOT NULL) att, "
        "SUM(score IS NOT NULL) scored FROM mock_event_entries"
    ).fetchone()
    mock_events = [
        dict(r)
        for r in q(
            """SELECT ev.id, ev.title, ev.open_at, COUNT(en.uid) regs,
                      SUM(en.attempt_id IS NOT NULL) atts, SUM(en.score IS NOT NULL) scored
               FROM mock_events ev LEFT JOIN mock_event_entries en ON en.event_id=ev.id
               GROUP BY ev.id ORDER BY ev.open_at DESC LIMIT 10"""
        )
    ]

    pk = q(
        "SELECT COUNT(*) n, SUM(status='finished') finished FROM pk_matches"
    ).fetchone()
    pk_window = q(
        "SELECT COUNT(*) n FROM pk_matches WHERE rowid>=(SELECT COALESCE(MAX(rowid)-100000,0) FROM pk_matches)"
    ).fetchone()["n"]

    total_q = q("SELECT COUNT(*) n FROM questions WHERE COALESCE(disabled,0)=0").fetchone()["n"]
    covered = q(
        f"SELECT COUNT(DISTINCT question_id) n FROM answer_log WHERE question_id IS NOT NULL AND {_REAL}"
    ).fetchone()["n"]
    covered_w = q(
        f"SELECT COUNT(DISTINCT question_id) n FROM answer_log WHERE created_at>=? AND question_id IS NOT NULL AND {_REAL}",
        (start,),
    ).fetchone()["n"]

    hardest = [
        dict(r)
        for r in q(
            f"""SELECT a.question_id qid, COUNT(*) n,
                      ROUND((1 - COALESCE(SUM(a.correct),0)*1.0/COUNT(*)) * 100, 1) err_pct,
                      q.module, substr(q.question,1,60) stem
               FROM answer_log a JOIN questions q ON q.id=a.question_id
               WHERE a.created_at>=? AND {db.REAL_TRAFFIC.replace('probe','a.probe')} AND a.question_id IS NOT NULL
               GROUP BY a.question_id HAVING COUNT(*)>=8
               ORDER BY err_pct DESC, n DESC LIMIT 20""",
            (start,),
        )
    ]

    shenlun = {
        "answers": q("SELECT COUNT(*) n FROM shenlun_answers WHERE created_at>=?", (start,)).fetchone()["n"],
        "answerers": q("SELECT COUNT(DISTINCT uid) n FROM shenlun_answers WHERE created_at>=?", (start,)).fetchone()["n"],
        "drafts": q("SELECT COUNT(*) n FROM shenlun_drafts").fetchone()["n"],
    }
    interview = {
        "sessions": q("SELECT COUNT(*) n FROM interview_sessions WHERE created_at>=?", (start,)).fetchone()["n"],
        "users": q("SELECT COUNT(DISTINCT uid) n FROM interview_sessions WHERE created_at>=?", (start,)).fetchone()["n"],
    }
    ask = {
        "sessions": q("SELECT COUNT(*) n FROM ask_sessions WHERE updated_at>=?", (start,)).fetchone()["n"],
        "users": q("SELECT COUNT(DISTINCT uid) n FROM ask_sessions WHERE updated_at>=?", (start,)).fetchone()["n"],
    }
    shares = {
        "created": q("SELECT COUNT(*) n FROM shared_questions WHERE created_at>=?", (start,)).fetchone()["n"],
        "opens": q("SELECT COALESCE(SUM(open_count),0) n FROM shared_questions").fetchone()["n"],
    }

    conn.close()
    return {
        "exam": {
            "attempts": attempts["n"], "submitted": attempts["done"],
            "finish_pct": round(attempts["done"] * 100 / attempts["n"], 1) if attempts["n"] else None,
            "avg_score": attempts["avg_score"], "papers": papers,
        },
        "mock": {"entries": mock["entries"], "registered": mock["reg"], "attempted": mock["att"], "scored": mock["scored"], "events": mock_events},
        "pk": {"total": pk["n"], "finished": pk["finished"], "window_est": pk_window},
        "coverage": {
            "total_questions": total_q, "answered_ever": covered,
            "pct": round(covered * 100 / total_q, 1) if total_q else None,
            "answered_window": covered_w,
            "pct_window": round(covered_w * 100 / total_q, 1) if total_q else None,
        },
        "hardest": hardest,
        "shenlun": shenlun, "interview": interview, "ask": ask, "shares": shares,
        "days": days,
        "generated_at": now,
    }
