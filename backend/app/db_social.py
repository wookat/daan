"""py 拆分之 social 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import json
import secrets
import time

from . import db

__all__ = ["_ensure_announcements", "_ensure_ask_cur", "_ensure_ask_sessions", "_ensure_reminder_prefs", "active_announcement", "clear_ask_cur", "delete_ask_session", "get_ask_cur", "get_backup", "get_reminder_prefs", "list_ask_sessions", "save_ask_cur", "save_ask_session", "save_backup", "set_reminder_pref"]


def _ensure_announcements(conn) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            active INTEGER DEFAULT 1
        )"""
    )


def active_announcement() -> dict | None:
    conn = db.get_conn()
    _ensure_announcements(conn)
    row = conn.execute(
        "SELECT id, title, body FROM announcements WHERE active=1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def _ensure_reminder_prefs(conn):
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


def save_backup(code: str | None, data: dict) -> str:
    conn = db.get_conn()
    if not code:
        code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
    else:
        code = str(code).strip().upper()[:16]
    conn.execute(
        "INSERT INTO backups (code, data, updated_at) VALUES (?,?,?) "
        "ON CONFLICT(code) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (code, json.dumps(data, ensure_ascii=False)[:500000], time.time()),
    )
    conn.commit()
    conn.close()
    return code


def get_backup(code: str) -> dict | None:
    conn = db.get_conn()
    row = conn.execute("SELECT data FROM backups WHERE code=?", (code,)).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["data"])


def _ensure_ask_sessions(conn):
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
    conn.execute(
        """CREATE TABLE IF NOT EXISTS ask_cur (
            uid TEXT PRIMARY KEY,
            sid INTEGER NOT NULL DEFAULT 0,
            ts INTEGER NOT NULL,
            items TEXT NOT NULL,
            updated_at REAL NOT NULL
        )"""
    )


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


