"""py 拆分之 social 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import secrets
import time

import app.db as db

__all__ = ["_ensure_announcements", "_ensure_ask_cur", "_ensure_ask_sessions", "_ensure_reminder_prefs", "active_announcement", "clear_ask_cur", "delete_ask_session", "get_ask_cur", "get_backup", "get_reminder_prefs", "invalidate_announcement_cache", "list_ask_sessions", "save_ask_cur", "save_ask_session", "save_backup", "set_reminder_pref"]

_ANN_TTL = 60.0
_ANN_CACHE: dict[str, tuple[float, dict | None]] = {}


def invalidate_announcement_cache() -> None:
    _ANN_CACHE.clear()


def _ensure_announcements(conn) -> None:
    if db._is_ensured(conn, "announcements"):
        return
    conn.execute(
        """CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            active INTEGER DEFAULT 1
        )"""
    )
    db._mark_ensured(conn, "announcements")


def active_announcement() -> dict | None:
    path_key = str(db.DB_PATH)
    now = time.time()
    hit = _ANN_CACHE.get(path_key) if path_key != ":memory:" else None
    if hit and now - hit[0] < _ANN_TTL:
        return dict(hit[1]) if hit[1] else None
    conn = db.get_conn()
    _ensure_announcements(conn)
    row = conn.execute(
        "SELECT id, title, body FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    res = dict(row) if row else None
    if path_key != ":memory:":
        _ANN_CACHE[path_key] = (now, res)
    return dict(res) if res else None


def _ensure_reminder_prefs(conn):
    if db._is_ensured(conn, "reminder_prefs"):
        return
    conn.execute(
        """CREATE TABLE IF NOT EXISTS reminder_prefs (
            uid TEXT NOT NULL,
            channel TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            hour INTEGER,
            updated_at REAL NOT NULL,
            PRIMARY KEY (uid, channel)
        )"""
    )
    db._mark_ensured(conn, "reminder_prefs")


def set_reminder_pref(uid: str, channel: str, enabled: bool, hour: int | None = None):
    conn = db.get_conn()
    _ensure_reminder_prefs(conn)
    conn.execute(
        "INSERT OR REPLACE INTO reminder_prefs (uid, channel, enabled, hour, updated_at) VALUES (?,?,?,?,?)",
        (uid, channel, 1 if enabled else 0, hour, time.time()),
    )
    conn.commit()
    conn.close()


def get_reminder_prefs(uid: str) -> list[dict]:
    conn = db.get_conn()
    _ensure_reminder_prefs(conn)
    rows = conn.execute(
        "SELECT channel, enabled, hour, updated_at FROM reminder_prefs WHERE uid=?", (uid,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


_BACKUP_MAX_CHARS = 500_000
_BACKUP_CODE_RE = __import__("re").compile(r"^[A-Z0-9]{8,16}$")


def save_backup(code: str | None, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    if len(payload) > _BACKUP_MAX_CHARS:
        raise ValueError("备份数据过大（上限 500KB）")
    raw_code = str(code).strip().upper()[:16] if code else ""
    if not _BACKUP_CODE_RE.match(raw_code):
        raw_code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    conn = db.get_conn()
    try:
        conn.execute(
            "INSERT INTO backups (code, data, updated_at) VALUES (?,?,?) "
            "ON CONFLICT(code) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
            (raw_code, payload, time.time()),
        )
        conn.commit()
    finally:
        conn.close()
    return raw_code


def get_backup(code: str) -> dict | None:
    conn = db.get_conn()
    row = conn.execute("SELECT data FROM backups WHERE code=?", (code,)).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["data"])


def _ensure_ask_sessions(conn):
    if db._is_ensured(conn, "ask_sessions"):
        return
    conn.execute(
        """CREATE TABLE IF NOT EXISTS ask_sessions (
            uid TEXT NOT NULL,
            sid INTEGER NOT NULL,
            ts INTEGER NOT NULL,
            title TEXT NOT NULL,
            n INTEGER NOT NULL,
            items TEXT NOT NULL,
            updated_at REAL NOT NULL,
            PRIMARY KEY (uid, sid)
        )"""
    )
    db._mark_ensured(conn, "ask_sessions")


def save_ask_session(uid: str, sid: int, ts: int, title: str, n: int, items_json: str) -> None:
    conn = db.get_conn()
    _ensure_ask_sessions(conn)
    conn.execute(
        """INSERT INTO ask_sessions (uid, sid, ts, title, n, items, updated_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(uid, sid) DO UPDATE SET
             ts=excluded.ts, title=excluded.title, n=excluded.n,
             items=excluded.items, updated_at=excluded.updated_at""",
        (uid, sid, ts, title, n, items_json, time.time()),
    )
    conn.execute(
        """DELETE FROM ask_sessions WHERE uid=? AND sid NOT IN (
             SELECT sid FROM ask_sessions WHERE uid=? ORDER BY ts DESC, sid DESC LIMIT 20)""",
        (uid, uid),
    )
    conn.commit()
    conn.close()


def delete_ask_session(uid: str, sid: int) -> None:
    conn = db.get_conn()
    _ensure_ask_sessions(conn)
    conn.execute("DELETE FROM ask_sessions WHERE uid=? AND sid=?", (uid, sid))
    conn.commit()
    conn.close()


def list_ask_sessions(uid: str) -> list[dict]:
    conn = db.get_conn()
    _ensure_ask_sessions(conn)
    rows = conn.execute(
        "SELECT sid, ts, title, n, items FROM ask_sessions WHERE uid=? ORDER BY ts DESC, sid DESC LIMIT 20",
        (uid,),
    ).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        try:
            items = json.loads(d["items"] or "[]")
        except ValueError:
            items = []
        out.append({"id": d["sid"], "ts": d["ts"], "title": d["title"], "n": d["n"], "items": items})
    return out


def _ensure_ask_cur(conn):
    if db._is_ensured(conn, "ask_cur"):
        return
    conn.execute(
        """CREATE TABLE IF NOT EXISTS ask_cur (
            uid TEXT PRIMARY KEY,
            sid INTEGER NOT NULL DEFAULT 0,
            ts INTEGER NOT NULL,
            items TEXT NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )
    db._mark_ensured(conn, "ask_cur")


def save_ask_cur(uid: str, sid: int, ts: int, items_json: str) -> None:
    conn = db.get_conn()
    _ensure_ask_cur(conn)
    conn.execute(
        """INSERT INTO ask_cur (uid, sid, ts, items, updated_at)
           VALUES (?,?,?,?,?)
           ON CONFLICT(uid) DO UPDATE SET
             sid=excluded.sid, ts=excluded.ts, items=excluded.items, updated_at=excluded.updated_at""",
        (uid, sid, ts, items_json, time.time()),
    )
    conn.commit()
    conn.close()


def clear_ask_cur(uid: str) -> None:
    conn = db.get_conn()
    _ensure_ask_cur(conn)
    conn.execute("DELETE FROM ask_cur WHERE uid=?", (uid,))
    conn.commit()
    conn.close()


def get_ask_cur(uid: str) -> dict | None:
    conn = db.get_conn()
    _ensure_ask_cur(conn)
    row = conn.execute("SELECT sid, ts, items, updated_at FROM ask_cur WHERE uid=?", (uid,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    try:
        d["items"] = json.loads(d["items"] or "[]")
    except ValueError:
        d["items"] = []
    return d


