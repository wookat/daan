"""R396 scripts/r396_explanation_quarantine.py：dry-run 零写入、apply 隔离+快照回落、restore 还原。"""
import importlib.util
import json
import os
import sqlite3

from app import quality

SCRIPT = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "r396_explanation_quarantine.py")
_spec = importlib.util.spec_from_file_location("r396_quarantine", SCRIPT)
assert _spec and _spec.loader
rq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rq)

_OPTS = json.dumps({"A": "83", "B": "84", "C": "126", "D": "252"}, ensure_ascii=False)
_Q = "滑雪和滑冰是冬奥会的两大项赛事，从9个分项中选6项，滑雪滑冰各至少1项，有多少种选法？"
_E_OWN = "从9个分项中选6项，需滑雪、滑冰各至少1项。总组合数C(9,6)=84，排除滑冰0项（即全选滑雪6项）的1种情况，得83种。"
_E_OTHER = "第一步，本题考查时政常识。2021年11月，中国共产党第十九届中央委员会第六次全体会议审议通过了《中共中央关于党的百年奋斗重大成就和历史经验的决议》。因此，选择B选项。"
_HS = "花生十三解法：正难则反，C(9,6)-1=83。"


def _db(tmp_path):
    p = tmp_path / "q.db"
    conn = sqlite3.connect(p)
    conn.executescript(
        "CREATE TABLE questions (id INTEGER PRIMARY KEY, question TEXT, options TEXT, explanation TEXT, "
        "hs_explanation TEXT, disabled INTEGER DEFAULT 0, is_real INTEGER DEFAULT 1, updated_at REAL);"
        "CREATE TABLE mistakes (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER, explanation TEXT, uid TEXT);"
    )
    rows = [(i, _Q, _OPTS, _E_OTHER, _HS, 0, 1, 1.0) for i in range(100, 106)]  # 串题块 100–105
    rows[2] = (102, _Q, _OPTS, _E_OWN, _HS, 0, 1, 1.0)  # 块内已修好的一行
    rows[4] = (104, _Q, _OPTS, _E_OTHER, None, 1, 1, 1.0)  # 下线且无 hs
    rows.append((200, _Q, _OPTS, _E_OWN, _HS, 0, 1, 1.0))  # 块外正常题
    conn.executemany("INSERT INTO questions VALUES (?,?,?,?,?,?,?,?)", rows)
    conn.executemany(
        "INSERT INTO mistakes (question_id, explanation, uid) VALUES (?,?,?)",
        [(100, _E_OTHER, "u1"), (101, "用户自己改过的快照", "u1"), (200, _E_OWN, "u1")],
    )
    conn.commit()
    conn.row_factory = sqlite3.Row
    return conn, str(p)


def test_select_targets_skips_keep_and_high_fit_rows_and_adds_extra(tmp_path):
    conn, _ = _db(tmp_path)
    t = rq.select_targets(conn, [(100, 105)], keep={101}, extra={200}, fit_max=rq.DEFAULT_FIT_MAX)
    by = {x["id"]: x for x in t}
    assert set(by) == {100, 101, 102, 103, 104, 105, 200}
    assert by[101]["skip"] == "keep"
    assert by[102]["skip"] and by[102]["skip"].startswith("fit>=")
    assert by[200]["skip"] is None and by[200]["block"] == "extra"
    assert [x["id"] for x in t if not x["skip"]] == [100, 103, 104, 105, 200]
    assert all(x["fit"] is not None and x["fit"] < quality.EXP_FIT_LOW for x in t if x["id"] in (100, 103, 104, 105))


def test_apply_quarantines_and_rewrites_snapshot_then_restore_round_trips(tmp_path):
    conn, _ = _db(tmp_path)
    t = rq.select_targets(conn, [(100, 105)], keep=set(), extra=set(), fit_max=rq.DEFAULT_FIT_MAX)
    rq.apply(conn, t)
    q = {r["id"]: r for r in conn.execute("SELECT id, explanation, hs_explanation FROM questions")}
    assert q[100]["explanation"] is None and q[103]["explanation"] is None and q[104]["explanation"] is None
    assert q[102]["explanation"] == _E_OWN  # 高贴合行保留
    assert q[200]["explanation"] == _E_OWN  # 块外不动
    assert q[100]["hs_explanation"] == _HS  # hs 不动，前端回落来源
    qr = {r["question_id"]: r for r in conn.execute("SELECT * FROM explanation_quarantine")}
    assert set(qr) == {100, 101, 103, 104, 105}
    assert qr[100]["explanation"] == _E_OTHER and qr[100]["reason"] == rq.REASON and qr[100]["block"] == "100-105"
    m = {r["question_id"]: r["explanation"] for r in conn.execute("SELECT question_id, explanation FROM mistakes")}
    assert m[100] == _HS  # 快照与被隔离解析相同 → 回落 hs
    assert m[101] == "用户自己改过的快照"  # 快照不同 → 不动
    assert m[200] == _E_OWN

    # 再次 apply 幂等（explanation 已空，不再入选）
    t2 = rq.select_targets(conn, [(100, 105)], keep=set(), extra=set(), fit_max=rq.DEFAULT_FIT_MAX)
    assert [x["id"] for x in t2 if not x["skip"]] == []

    rq.restore(conn)
    q = {r["id"]: r["explanation"] for r in conn.execute("SELECT id, explanation FROM questions")}
    assert q[100] == _E_OTHER and q[103] == _E_OTHER and q[105] == _E_OTHER
    assert conn.execute("SELECT COUNT(*) FROM explanation_quarantine").fetchone()[0] == 0


def test_restore_does_not_overwrite_manually_rewritten_explanation(tmp_path):
    conn, _ = _db(tmp_path)
    t = rq.select_targets(conn, [(100, 105)], keep=set(), extra=set(), fit_max=rq.DEFAULT_FIT_MAX)
    rq.apply(conn, t)
    conn.execute("UPDATE questions SET explanation='人工重写的正确解析' WHERE id=100")
    conn.commit()
    rq.restore(conn)
    assert conn.execute("SELECT explanation FROM questions WHERE id=100").fetchone()[0] == "人工重写的正确解析"
    assert conn.execute("SELECT explanation FROM questions WHERE id=103").fetchone()[0] == _E_OTHER


def test_cli_dry_run_writes_nothing(tmp_path, capsys):
    conn, path = _db(tmp_path)
    conn.close()
    import sys
    argv = sys.argv
    sys.argv = ["x", "--db", path, "--blocks", "100-105"]
    try:
        rq.main()
    finally:
        sys.argv = argv
    out = capsys.readouterr().out
    assert "dry-run only" in out and "targets: 5" in out
    c = sqlite3.connect(path)
    assert c.execute("SELECT COUNT(*) FROM questions WHERE explanation IS NULL").fetchone()[0] == 0
    assert c.execute("SELECT name FROM sqlite_master WHERE name='explanation_quarantine'").fetchone() is None
