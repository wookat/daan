"""W11-A merge_anon 归并覆盖：按 schema 自省归并所有含 uid / *_uid 列的表（含目标优先、幂等、源锁）。"""
import glob
import inspect
import os
import re

import pytest

from app import auth as auth_mod
from app import db, push_api

APP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app")
ANON = "test-w11-merge-anon"
_seq = [0]


def _ensure_all_tables():
    """临时库只建了启动期表；懒建表（各 db._ensure_*）也全部拉起，让自省覆盖完整 schema。"""
    conn = db.get_conn()
    for name, fn in inspect.getmembers(db, inspect.isfunction):
        if name.startswith("_ensure_") and list(inspect.signature(fn).parameters) == ["conn"]:
            fn(conn)
    push_api._ensure_table(conn)
    conn.commit()
    conn.close()


def _table_cols(conn, table: str):
    return conn.execute(f'PRAGMA table_info("{table}")').fetchall()


def _dummy(decl_type: str, n: int):
    t = (decl_type or "").upper()
    if "INT" in t:
        return n
    if "REAL" in t or "FLOA" in t or "DOUB" in t:
        return float(n)
    return f"w11-{n}"


def _insert(conn, table: str, uid_col: str, uid: str, shared: dict | None = None) -> dict:
    """插入一行：uid 列取 uid，shared 指定的列沿用给定值，其余列取唯一哑值；返回该行各列取值。"""
    _seq[0] += 1
    n = _seq[0]
    cols = _table_cols(conn, table)
    pk_cols = [c for c in cols if c["pk"]]
    rowid_alias = len(pk_cols) == 1 and (pk_cols[0]["type"] or "").upper() == "INTEGER"
    row: dict = {}
    for c in cols:
        name = c["name"]
        if name == uid_col:
            row[name] = uid
        elif shared and name in shared:
            row[name] = shared[name]
        elif rowid_alias and c["pk"]:
            continue
        else:
            row[name] = _dummy(c["type"], n)
    names = ", ".join(f'"{k}"' for k in row)
    conn.execute(f'INSERT INTO "{table}" ({names}) VALUES ({",".join("?" * len(row))})', tuple(row.values()))
    return row


def _count(conn, table: str, col: str, uid: str) -> int:
    return conn.execute(f'SELECT COUNT(*) FROM "{table}" WHERE "{col}"=?', (uid,)).fetchone()[0]


def _register(client, phone: str) -> tuple[str, str]:
    r = client.post("/api/auth/register", json={"phone": phone, "password": "pw123456", "code": "000000"})
    assert r.status_code == 200, r.text
    return r.json()["token"], f"u{r.json()['user']['id']}"


def _source_uid_columns() -> set[tuple[str, str]]:
    """扫 app/**/*.py 建表 / 加列语句，抽出所有 uid / *_uid 列（与实现无关的独立口径）。"""
    found: set[tuple[str, str]] = set()
    is_uid = re.compile(r"^(uid|\w+_uid)$")
    create_re = re.compile(r"CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(")
    alter_re = re.compile(r"ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(\w+)")
    addcol_re = re.compile(r"add_column_if_missing\(\s*conn,\s*\"(\w+)\",\s*\"(\w+)\"")
    for path in glob.glob(os.path.join(APP_DIR, "**", "*.py"), recursive=True):
        with open(path, encoding="utf-8") as f:
            src = f.read()
        for m in create_re.finditer(src):
            depth, i = 1, m.end()
            while depth and i < len(src):
                depth += {"(": 1, ")": -1}.get(src[i], 0)
                i += 1
            body = src[m.end() : i - 1]
            parts, depth, cur = [], 0, []
            for ch in body:
                depth += {"(": 1, ")": -1}.get(ch, 0)
                if ch == "," and depth == 0:
                    parts.append("".join(cur))
                    cur = []
                else:
                    cur.append(ch)
            parts.append("".join(cur))
            for p in parts:
                tok = p.split()
                if tok and is_uid.match(tok[0]):
                    found.add((m.group(1), tok[0]))
        for m in alter_re.finditer(src):
            if is_uid.match(m.group(2)):
                found.add((m.group(1), m.group(2)))
        for m in addcol_re.finditer(src):
            if is_uid.match(m.group(2)):
                found.add((m.group(1), m.group(2)))
    return found


@pytest.fixture(scope="module")
def uid_columns():
    _ensure_all_tables()
    conn = db.get_conn()
    try:
        return auth_mod._uid_columns(conn)
    finally:
        conn.close()


def test_introspection_covers_every_uid_column_in_source(uid_columns):
    """源锁：源码里任何带 uid / *_uid 列的建表 / 加列，都必须被自省归并（排除表清单不得误吞）。"""
    introspected = {(t, c) for t, c, _ in uid_columns}
    # 排除口径在测试内独立写死，不引用实现的清单：实现多排除一张表即在此失败
    identity_tables = {"merged_anon", "users", "auth_tokens", "zalize_bindings"}
    assert auth_mod._MERGE_SKIP_TABLES <= identity_tables
    expected = {(t, c) for t, c in _source_uid_columns() if t not in identity_tables}
    assert expected, "源码扫描应至少发现一张含 uid 列的表"
    assert expected - introspected == set()
    assert ("merged_anon", "anon_uid") not in introspected
    # 历史手工清单里的表一张不少
    legacy = {
        "answer_log", "mistakes", "shenlun_answers", "review_log", "exam_attempts", "exam_progress",
        "shenlun_mat_favs", "shenlun_qfavs", "shenlun_drafts", "user_state", "question_favs", "question_notes",
        "fav_folders", "comment_likes", "user_profile", "reminder_prefs", "reinforce_log",
    }
    assert legacy <= {t for t, _ in introspected}
    # 本轮点名漏归并的表
    missing_before = {
        "team_members", "teams", "shared_questions", "shared_answers", "growth_events", "question_comments",
        "comment_reports", "comment_inbox_reads", "mock_event_entries", "weekly_reports", "daily_set_entries",
        "practice_progress", "ask_sessions", "ask_cur", "review_cur", "interview_sessions", "pk_matches",
        "push_subs", "practice_results",
    }
    assert missing_before <= {t for t, _ in introspected}
    assert {c for t, c in introspected if t == "pk_matches"} == {"creator_uid", "opponent_uid"}


def test_keyed_flag_matches_pk_or_unique_index(uid_columns):
    flags = {(t, c): k for t, c, k in uid_columns}
    assert flags[("answer_log", "uid")] is False
    assert flags[("user_profile", "uid")] is True
    assert flags[("team_members", "uid")] is True
    assert flags[("fav_folders", "uid")] is True  # 无主键但有 (uid, name) 唯一索引
    assert flags[("pk_matches", "creator_uid")] is False


def test_merge_anon_moves_every_uid_column_and_keeps_target_on_conflict(client, uid_columns):
    token, target = _register(client, "13900000511")
    conn = db.get_conn()
    for t, c, _ in uid_columns:
        conn.execute(f'DELETE FROM "{t}" WHERE "{c}" IN (?,?)', (ANON, target))
    conn.commit()

    expect_target: dict[tuple[str, str], int] = {}
    keep_marker: dict[tuple[str, str], tuple[str, object]] = {}
    for t, c, keyed in uid_columns:
        anon_row = _insert(conn, t, c, ANON)
        expect_target[(t, c)] = 1
        if not keyed:
            continue
        cols = _table_cols(conn, t)
        keyed_names = {x["name"] for x in cols if x["pk"]}
        for ix in conn.execute(f'PRAGMA index_list("{t}")').fetchall():
            if ix["unique"]:
                keyed_names.update(r["name"] for r in conn.execute(f'PRAGMA index_info("{ix["name"]}")'))
        shared = {k: v for k, v in anon_row.items() if k in keyed_names and k != c}
        # 目标 uid 已有同键行：归并后保留目标行、丢弃匿名行
        target_row = _insert(conn, t, c, target, shared)
        marker = next((k for k in target_row if k not in keyed_names and k != c), None)
        if marker:
            keep_marker[(t, c)] = (marker, target_row[marker])
        if shared:
            # 键不冲突的匿名行照常迁入
            _insert(conn, t, c, ANON)
            expect_target[(t, c)] = 2
        else:
            expect_target[(t, c)] = 1
    conn.commit()
    conn.close()

    r = client.post("/api/auth/merge_anon", json={"anon_uid": ANON}, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    merged = r.json()["merged"]
    assert r.json()["uid"] == target

    conn = db.get_conn()
    try:
        for t, c, keyed in uid_columns:
            key = f"{t}.{c}"
            assert key in merged, key
            assert merged[key] >= 0
            assert _count(conn, t, c, ANON) == 0, key
            assert _count(conn, t, c, target) == expect_target[(t, c)], key
            if (t, c) in keep_marker:
                col, val = keep_marker[(t, c)]
                got = conn.execute(f'SELECT "{col}" FROM "{t}" WHERE "{c}"=?', (target,)).fetchall()
                assert val in [g[0] for g in got], key
        assert conn.execute(
            "SELECT COUNT(*) FROM merged_anon WHERE anon_uid=?", (ANON,)
        ).fetchone()[0] == 1
    finally:
        conn.close()

    # 幂等：再合一次全 0，行数不变
    r2 = client.post("/api/auth/merge_anon", json={"anon_uid": ANON}, headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, r2.text
    assert set(r2.json()["merged"]) == set(merged)
    assert all(v == 0 for v in r2.json()["merged"].values())
    conn = db.get_conn()
    try:
        for t, c, _ in uid_columns:
            assert _count(conn, t, c, target) == expect_target[(t, c)], f"{t}.{c}"
        for t, c, _ in uid_columns:
            conn.execute(f'DELETE FROM "{t}" WHERE "{c}"=?', (target,))
        conn.execute("DELETE FROM merged_anon WHERE anon_uid=?", (ANON,))
        conn.commit()
    finally:
        conn.close()


def test_merge_anon_rejects_account_uid_and_noop_on_self(client):
    token, target = _register(client, "13900000512")
    hdr = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/auth/merge_anon", json={"anon_uid": "u1"}, headers=hdr).status_code == 400
    r = client.post("/api/auth/merge_anon", json={"anon_uid": target}, headers=hdr)
    assert r.status_code == 200 and r.json()["skipped"] is True
