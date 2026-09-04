"""R373：后台重任务空闲门控 + 题目统计刷新不在写锁内翻冷页（只写变化行、分批 commit）。"""
import json

from app import db, main


def _log(uid: str, qid: int, correct: int, picked: str = "B"):
    db.save_answer_log_detail(uid, [{"qid": qid, "correct": correct, "secs": 1, "picked": picked}])


def _fresh_questions(n: int) -> list[int]:
    """共享测试库里其他用例已给 seed_questions 的题留下作答，这里插入本用例专属题。"""
    conn = db.get_conn()
    ids = []
    for i in range(n):
        cur = conn.execute(
            "INSERT INTO questions (module, question_type, question, options, answer, explanation, is_real, disabled)"
            " VALUES (?,?,?,?,?,?,1,0)",
            ("yanyu", "单选题", f"R373 统计刷新测试题 {i}", json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}), "A", "选 A"),
        )
        ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    return ids


def _stats(qid: int):
    conn = db.get_conn()
    # fetchall 让语句走到 DONE 复位：主线程连接若留有活动读语句，另一线程写后本线程再写会立刻 BUSY_SNAPSHOT
    r = conn.execute("SELECT attempt_count, correct_ratio, most_wrong FROM questions WHERE id=?", (qid,)).fetchall()[0]
    conn.close()
    return (r["attempt_count"], r["correct_ratio"], r["most_wrong"])


def test_refresh_question_stats_only_writes_changed_rows_in_batches(monkeypatch):
    a, b, c = _fresh_questions(3)
    _log("test-r373-u1", a, 0, "B")
    _log("test-r373-u2", a, 1, "A")
    _log("test-r373-u1", b, 1, "A")
    _log("test-r373-u1", c, 0, "C")

    updates: list[int] = []
    commits = {"n": 0}
    orig_conn = db.get_conn

    class SpyConn:
        def __init__(self, inner):
            self._inner = inner

        def executemany(self, sql, rows):
            rows = list(rows)
            if sql.lstrip().startswith("UPDATE questions"):
                updates.append(len(rows))
            return self._inner.executemany(sql, rows)

        def commit(self):
            commits["n"] += 1
            return self._inner.commit()

        def __getattr__(self, name):
            return getattr(self._inner, name)

    monkeypatch.setattr(db, "get_conn", lambda: SpyConn(orig_conn()))
    monkeypatch.setattr(db, "QUESTION_STATS_BATCH", 2)

    # 共享库里可能已有其他用例的作答：返回值为有作答的题数（≥ 本用例 3 题），且本用例 3 题必在变化行中
    total = db.refresh_question_stats()
    assert total >= 3
    assert _stats(a) == (2, 50, "B")
    assert _stats(b) == (1, 100, None)
    assert _stats(c) == (1, 0, "C")
    assert sum(updates) >= 3 and all(n <= 2 for n in updates)
    assert commits["n"] == len(updates)

    # 无新作答再刷一轮：契约返回值不变，但一行都不写、一次都不 commit（写锁零持有）
    updates.clear()
    commits["n"] = 0
    assert db.refresh_question_stats() == total
    assert updates == []
    assert commits["n"] == 0

    # 只有一题有新作答 → 只写那一行
    _log("test-r373-u3", c, 1, "A")
    assert db.refresh_question_stats() == total
    assert updates == [1]
    assert _stats(c) == (2, 50, "C")
    assert _stats(a) == (2, 50, "B")


def test_heavy_task_gate_requires_quiet_and_idle(monkeypatch):
    monkeypatch.setattr(main, "BOOT_TS", 1000.0)
    monkeypatch.setattr(main, "BOOT_QUIET_S", 600.0)
    monkeypatch.setattr(main, "IDLE_GATE_S", 60.0)
    monkeypatch.setattr(main, "IDLE_MAX_DEFER_S", 7200.0)
    quiet_end = 1600.0

    main.note_request(now=1500.0)
    assert not main.heavy_task_allowed(now=quiet_end - 1)  # 静默期未过
    assert main.heavy_task_allowed(now=quiet_end)  # 静默已过且最近 60s 无请求（上次 1500）

    main.note_request(now=quiet_end - 10)
    assert not main.heavy_task_allowed(now=quiet_end)  # 10s 前有用户请求 → 推迟
    assert not main.heavy_task_allowed(now=quiet_end + 49)
    assert main.heavy_task_allowed(now=quiet_end + 50)  # 满 60s 空闲放行

    # 持续在线：每 30s 一条请求，永不空闲 → 到最大推迟期强制放行
    for t in range(int(quiet_end), int(quiet_end + 7200), 30):
        main.note_request(now=float(t))
        assert not main.heavy_task_allowed(now=float(t) + 1)
    assert main.heavy_task_allowed(now=quiet_end + 7200)


def test_health_probe_does_not_count_as_user_activity(client, monkeypatch):
    seen = []
    monkeypatch.setattr(main, "note_request", lambda now=None: seen.append(1))
    client.get("/api/health")
    assert seen == []
    client.get("/api/access_info")
    assert seen == [1]
