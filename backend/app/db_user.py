"""py 拆分之 user 域：按职责抽出，跨模块调用经 db.<name>()（保 get_conn monkeypatch）。"""
import time

from . import db

__all__ = ["_ensure_user_profile", "_ensure_user_state", "get_user_profile", "get_user_state", "save_user_profile", "set_user_state"]


def _ensure_user_state(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS user_state (
            uid TEXT NOT NULL, day TEXT NOT NULL, focus_module TEXT, note TEXT,
            created_at REAL, PRIMARY KEY (uid, day))"""
    )


def set_user_state(uid: str, focus_module: str, note: str = "") -> None:
    conn = db.get_conn()
    _ensure_user_state(conn)
    conn.execute(
        "INSERT OR REPLACE INTO user_state (uid, day, focus_module, note, created_at) VALUES (?,?,?,?,?)",
        (uid, db._today_str(), focus_module or None, (note or "")[:200] or None, time.time()),
    )
    conn.commit()
    conn.close()


def get_user_state(uid: str) -> dict | None:
    conn = db.get_conn()
    _ensure_user_state(conn)
    row = conn.execute(
        "SELECT focus_module, note FROM user_state WHERE uid=? AND day=?",
        (uid, db._today_str()),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def _ensure_user_profile(conn):
    conn.execute(
        """CREATE TABLE IF NOT EXISTS user_profile (
            uid TEXT PRIMARY KEY,
            exam_type TEXT,
            target_region TEXT,
            exam_date TEXT,
            target_score INTEGER,
            daily_minutes INTEGER,
            base_level TEXT,
            daily_goal INTEGER,
            group_size INTEGER,
            timed_mode INTEGER,
            auto_next INTEGER,
            theme_mode TEXT,
            theme_accent TEXT,
            created_at REAL,
            updated_at REAL)"""
    )
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(user_profile)")}
    for col in ("daily_goal", "group_size", "timed_mode", "auto_next"):
        if col not in cols:
            conn.execute(f"ALTER TABLE user_profile ADD COLUMN {col} INTEGER")
    for col in ("theme_mode", "theme_accent"):
        if col not in cols:
            conn.execute(f"ALTER TABLE user_profile ADD COLUMN {col} TEXT")


def get_user_profile(uid: str) -> dict | None:
    conn = db.get_conn()
    _ensure_user_profile(conn)
    row = conn.execute("SELECT * FROM user_profile WHERE uid=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def save_user_profile(uid: str, fields: dict) -> dict:
    conn = db.get_conn()
    _ensure_user_profile(conn)
    now = time.time()
    existing = conn.execute("SELECT uid FROM user_profile WHERE uid=?", (uid,)).fetchone()
    vals = {k: fields.get(k) for k in db.PROFILE_FIELDS if k in fields}
    if existing:
        if vals:
            clause = ", ".join(f"{k}=?" for k in vals)
            conn.execute(
                f"UPDATE user_profile SET {clause}, updated_at=? WHERE uid=?",
                (*vals.values(), now, uid),
            )
    else:
        conn.execute(
            """INSERT INTO user_profile
               (uid, exam_type, target_region, exam_date, target_score, daily_minutes, base_level,
                daily_goal, group_size, timed_mode, auto_next, theme_mode, theme_accent, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                uid,
                vals.get("exam_type"),
                vals.get("target_region"),
                vals.get("exam_date"),
                vals.get("target_score"),
                vals.get("daily_minutes"),
                vals.get("base_level"),
                vals.get("daily_goal"),
                vals.get("group_size"),
                vals.get("timed_mode"),
                vals.get("auto_next"),
                vals.get("theme_mode"),
                vals.get("theme_accent"),
                now,
                now,
            ),
        )
    conn.commit()
    conn.close()
    return get_user_profile(uid) or {}


