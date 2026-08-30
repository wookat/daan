"""社区与个人沉淀：每题讨论区、收藏夹（多夹）、每题笔记、打卡摘要。

讨论发言需登录账号（Bearer token）；收藏/笔记按 uid 隔离（与错题本一致，匿名可用）。
"""
import re
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException

from . import db
from .auth import rate_limit, require_user, user_uid
from .deps import check_admin

router = APIRouter(prefix="/api")

COMMENT_MAX_LEN = 500
COMMENT_MIN_LEN = 2
REPORT_HIDE_THRESHOLD = 3  # 去重举报人数达到即自动隐藏待审核
REPORT_REASONS = ("广告导流", "人身攻击", "违法违规", "色情低俗", "其他")

# 简单敏感词过滤（命中直接拒绝）
_BANNED_WORDS = [
    "习近平", "共产党", "法轮", "翻墙", "vpn", "梯子",
    "加微信", "加v", "加Q", "qq群", "微信群", "代考", "答案出售", "包过",
    "色情", "赌博", "博彩", "毒品", "枪支", "炸弹",
    "傻逼", "傻b", "煞笔", "狗东西", "去死", "妈的", "尼玛", "操你", "草你",
]
_URL_RE = re.compile(r"https?://|www\.", re.IGNORECASE)


def _hit_banned(text: str) -> str | None:
    low = text.lower()
    for w in _BANNED_WORDS:
        if w.lower() in low:
            return w
    return None


def init_social_db():
    conn = db.get_conn()
    conn.execute(
        """CREATE TABLE IF NOT EXISTS question_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            uid TEXT NOT NULL,
            nickname TEXT,
            content TEXT NOT NULL,
            parent_id INTEGER,
            likes INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'ok',
            created_at REAL NOT NULL
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_qc_qid ON question_comments(question_id, status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_qc_parent ON question_comments(parent_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_qc_uid ON question_comments(uid, created_at)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS comment_likes (
            comment_id INTEGER NOT NULL,
            uid TEXT NOT NULL,
            created_at REAL NOT NULL,
            PRIMARY KEY (comment_id, uid)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cl_uid ON comment_likes(uid)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS comment_reports (
            comment_id INTEGER NOT NULL,
            uid TEXT NOT NULL,
            reason TEXT,
            created_at REAL NOT NULL,
            PRIMARY KEY (comment_id, uid)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cr_cid ON comment_reports(comment_id)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS comment_inbox_reads (
            uid TEXT PRIMARY KEY,
            last_read_at REAL NOT NULL
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS fav_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid TEXT NOT NULL,
            name TEXT NOT NULL,
            icon TEXT,
            created_at REAL NOT NULL,
            UNIQUE (uid, name)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ff_uid ON fav_folders(uid)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS question_favs (
            uid TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            folder_id INTEGER,
            created_at REAL NOT NULL,
            PRIMARY KEY (uid, question_id)
        )"""
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_qf_folder ON question_favs(folder_id)")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS question_notes (
            uid TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            updated_at REAL NOT NULL,
            PRIMARY KEY (uid, question_id)
        )"""
    )
    conn.commit()
    conn.close()


def _clean_uid(uid: str | None) -> str:
    u = (uid or "").strip()[:64]
    if not u:
        raise HTTPException(400, "缺少 uid")
    return u


# ---------- 每题讨论区 ----------

@router.get("/question/{qid}")
def api_question_detail(qid: int):
    items = db.questions_by_ids([qid])
    if not items:
        raise HTTPException(404, "题目不存在")
    return {"item": items[0]}



def _clean_name(name, fallback: str = "考友") -> str:
    n = str(name or "").strip()[:20]
    return fallback if not n or n.lower() in ("null", "undefined") else n


def _comment_payload(r, liked_ids: set[int], my_uid: str | None) -> dict:
    return {
        "id": r["id"],
        "question_id": r["question_id"],
        "nickname": _clean_name(r["nickname"]),
        "content": r["content"] if r["status"] == "ok" else "该评论已删除",
        "parent_id": r["parent_id"],
        "likes": r["likes"],
        "liked": r["id"] in liked_ids,
        "mine": bool(my_uid) and r["uid"] == my_uid,
        "deleted": r["status"] != "ok",
        "created_at": r["created_at"],
    }


@router.get("/comments")
def api_comments(question_id: int, sort: str = "hot", uid: str = ""):
    u = (uid or "").strip()[:64]
    conn = db.get_conn()
    rows = conn.execute(
        "SELECT * FROM question_comments WHERE question_id=?", (question_id,)
    ).fetchall()
    liked_ids: set[int] = set()
    if u and rows:
        ids = [r["id"] for r in rows]
        liked_ids = {
            r["comment_id"]
            for r in conn.execute(
                f"SELECT comment_id FROM comment_likes WHERE uid=? AND comment_id IN ({','.join('?' * len(ids))})",
                [u, *ids],
            )
        }
    conn.close()
    tops = [r for r in rows if not r["parent_id"] and r["status"] == "ok"]
    if sort == "new":
        tops.sort(key=lambda r: -r["created_at"])
    else:
        tops.sort(key=lambda r: (-r["likes"], -r["created_at"]))
    by_parent: dict[int, list] = {}
    for r in rows:
        if r["parent_id"] and r["status"] == "ok":
            by_parent.setdefault(r["parent_id"], []).append(r)
    items = []
    for t in tops:
        item = _comment_payload(t, liked_ids, u or None)
        replies = sorted(by_parent.get(t["id"], []), key=lambda r: r["created_at"])
        item["replies"] = [_comment_payload(r, liked_ids, u or None) for r in replies]
        items.append(item)
    total = len(tops) + sum(len(v) for v in by_parent.values())
    return {"items": items, "total": total}


@router.get("/comments/inbox")
def api_comment_inbox(authorization: str | None = Header(None)):
    user = require_user(authorization)
    uid = user_uid(user["id"])
    conn = db.get_conn()
    row = conn.execute(
        "SELECT last_read_at FROM comment_inbox_reads WHERE uid=?", (uid,)
    ).fetchone()
    last_read = row["last_read_at"] if row else 0.0
    rows = conn.execute(
        """SELECT r.id, r.nickname, r.content, r.created_at, r.question_id,
                  p.content AS parent_content
           FROM question_comments r JOIN question_comments p ON r.parent_id = p.id
           WHERE p.uid=? AND r.uid!=? AND r.status='ok' AND p.status='ok'
           ORDER BY r.created_at DESC LIMIT 50""",
        (uid, uid),
    ).fetchall()
    conn.close()
    items = []
    unread = 0
    for r in rows:
        is_unread = r["created_at"] > last_read
        unread += 1 if is_unread else 0
        items.append(
            {
                "id": r["id"],
                "nickname": r["nickname"] or "考友",
                "content": r["content"],
                "created_at": r["created_at"],
                "question_id": r["question_id"],
                "parent_content": r["parent_content"],
                "unread": is_unread,
            }
        )
    return {"items": items, "unread": unread}


@router.post("/comments/inbox/read")
def api_comment_inbox_read(authorization: str | None = Header(None)):
    user = require_user(authorization)
    uid = user_uid(user["id"])
    conn = db.get_conn()
    conn.execute(
        """INSERT INTO comment_inbox_reads (uid, last_read_at) VALUES (?, ?)
           ON CONFLICT(uid) DO UPDATE SET last_read_at=excluded.last_read_at""",
        (uid, time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/comments/count")
def api_comments_count(question_id: int):
    conn = db.get_conn()
    n = conn.execute(
        "SELECT COUNT(*) FROM question_comments WHERE question_id=? AND status='ok'",
        (question_id,),
    ).fetchone()[0]
    conn.close()
    return {"total": n}


@router.post("/comments")
def api_comment_create(body: dict, authorization: str | None = Header(None)):
    user = require_user(authorization)
    uid = user_uid(user["id"])
    question_id = body.get("question_id")
    if not question_id:
        raise HTTPException(400, "缺少 question_id")
    content = str(body.get("content") or "").strip()
    if len(content) < COMMENT_MIN_LEN:
        raise HTTPException(400, "内容太短")
    if len(content) > COMMENT_MAX_LEN:
        raise HTTPException(400, f"内容不能超过 {COMMENT_MAX_LEN} 字")
    if _URL_RE.search(content):
        raise HTTPException(400, "评论不支持发链接")
    if _hit_banned(content):
        raise HTTPException(400, "内容包含违规词汇，请修改后重试")
    rate_limit(f"cmt:{uid}", 3, 60)
    parent_id = body.get("parent_id")
    conn = db.get_conn()
    if parent_id:
        p = conn.execute(
            "SELECT id, parent_id, question_id FROM question_comments WHERE id=? AND status='ok'",
            (int(parent_id),),
        ).fetchone()
        if not p or p["question_id"] != int(question_id):
            conn.close()
            raise HTTPException(404, "回复的评论不存在")
        # 只允许一层嵌套：回复楼中楼时挂到顶层楼
        parent_id = p["parent_id"] or p["id"]
    nickname = _clean_name(user["nickname"], "考友" + str(user["phone"])[-4:])
    cur = conn.execute(
        """INSERT INTO question_comments (question_id, user_id, uid, nickname, content, parent_id, created_at)
           VALUES (?,?,?,?,?,?,?)""",
        (int(question_id), user["id"], uid, nickname, content, parent_id, time.time()),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM question_comments WHERE id=?", (cur.lastrowid,)).fetchone()
    conn.close()
    out = _comment_payload(row, set(), uid)
    out["replies"] = []
    return {"item": out}


@router.post("/comments/{cid}/like")
def api_comment_like(cid: int, authorization: str | None = Header(None)):
    user = require_user(authorization)
    uid = user_uid(user["id"])
    conn = db.get_conn()
    row = conn.execute(
        "SELECT id FROM question_comments WHERE id=? AND status='ok'", (cid,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "评论不存在")
    liked = conn.execute(
        "SELECT 1 FROM comment_likes WHERE comment_id=? AND uid=?", (cid, uid)
    ).fetchone()
    if liked:
        conn.execute("DELETE FROM comment_likes WHERE comment_id=? AND uid=?", (cid, uid))
        conn.execute("UPDATE question_comments SET likes=MAX(likes-1,0) WHERE id=?", (cid,))
    else:
        conn.execute(
            "INSERT INTO comment_likes (comment_id, uid, created_at) VALUES (?,?,?)",
            (cid, uid, time.time()),
        )
        conn.execute("UPDATE question_comments SET likes=likes+1 WHERE id=?", (cid,))
    conn.commit()
    n = conn.execute("SELECT likes FROM question_comments WHERE id=?", (cid,)).fetchone()[0]
    conn.close()
    return {"liked": not liked, "likes": n}


@router.delete("/comments/{cid}")
def api_comment_delete_own(cid: int, authorization: str | None = Header(None)):
    user = require_user(authorization)
    conn = db.get_conn()
    cur = conn.execute(
        "UPDATE question_comments SET status='deleted' WHERE id=? AND user_id=?",
        (cid, user["id"]),
    )
    conn.commit()
    conn.close()
    if not cur.rowcount:
        raise HTTPException(404, "评论不存在")
    return {"ok": True}


@router.post("/comments/{cid}/report")
def api_comment_report(cid: int, body: dict, authorization: str | None = Header(None)):
    user = require_user(authorization)
    uid = user_uid(user["id"])
    rate_limit(f"cmt_report:{uid}", 10, 600)
    reason = str(body.get("reason") or "").strip()
    if reason not in REPORT_REASONS:
        reason = "其他"
    conn = db.get_conn()
    row = conn.execute(
        "SELECT id, uid FROM question_comments WHERE id=? AND status='ok'", (cid,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "评论不存在")
    if row["uid"] == uid:
        conn.close()
        raise HTTPException(400, "不能举报自己的评论")
    cur = conn.execute(
        "INSERT OR IGNORE INTO comment_reports (comment_id, uid, reason, created_at) VALUES (?,?,?,?)",
        (cid, uid, reason, time.time()),
    )
    already = not cur.rowcount
    n = conn.execute(
        "SELECT COUNT(DISTINCT uid) FROM comment_reports WHERE comment_id=?", (cid,)
    ).fetchone()[0]
    hidden = False
    if n >= REPORT_HIDE_THRESHOLD:
        conn.execute("UPDATE question_comments SET status='hidden' WHERE id=? AND status='ok'", (cid,))
        hidden = True
    conn.commit()
    conn.close()
    return {"ok": True, "already": already, "hidden": hidden}


# ---------- 管理端 ----------

def _check_admin(x_admin_token: str | None):
    check_admin(x_admin_token)


@router.get("/admin/comments")
def api_admin_comments(
    status: str = "ok", question_id: int | None = None, limit: int = 100, offset: int = 0,
    x_admin_token: str | None = Header(None),
):
    _check_admin(x_admin_token)
    conn = db.get_conn()
    where, args = ["status=?"], [status if status in ("ok", "deleted", "hidden") else "ok"]
    if question_id:
        where.append("question_id=?")
        args.append(question_id)
    rows = conn.execute(
        f"SELECT * FROM question_comments WHERE {' AND '.join(where)} ORDER BY id DESC LIMIT ? OFFSET ?",
        [*args, min(int(limit), 500), max(int(offset), 0)],
    ).fetchall()
    conn.close()
    return {"items": [dict(r) for r in rows]}


@router.get("/admin/comment-reports")
def api_admin_comment_reports(limit: int = 100, x_admin_token: str | None = Header(None)):
    _check_admin(x_admin_token)
    conn = db.get_conn()
    rows = conn.execute(
        """SELECT r.comment_id, COUNT(DISTINCT r.uid) AS report_count,
                  GROUP_CONCAT(r.reason) AS reasons, MAX(r.created_at) AS last_at,
                  c.content, c.status, c.question_id, c.nickname
           FROM comment_reports r JOIN question_comments c ON c.id = r.comment_id
           GROUP BY r.comment_id ORDER BY last_at DESC LIMIT ?""",
        (min(int(limit), 500),),
    ).fetchall()
    conn.close()
    return {"items": [dict(r) for r in rows]}


@router.post("/admin/comments/{cid}/restore")
def api_admin_comment_restore(cid: int, x_admin_token: str | None = Header(None)):
    _check_admin(x_admin_token)
    conn = db.get_conn()
    cur = conn.execute("UPDATE question_comments SET status='ok' WHERE id=?", (cid,))
    if not cur.rowcount:
        conn.close()
        raise HTTPException(404, "评论不存在")
    conn.execute("DELETE FROM comment_reports WHERE comment_id=?", (cid,))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/admin/comments/{cid}")
def api_admin_comment_delete(cid: int, x_admin_token: str | None = Header(None)):
    _check_admin(x_admin_token)
    conn = db.get_conn()
    cur = conn.execute("UPDATE question_comments SET status='deleted' WHERE id=?", (cid,))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        raise HTTPException(404, "评论不存在")
    return {"ok": True}


# ---------- 收藏夹 ----------

def _folder_rows(conn, uid: str) -> list[dict]:
    counts = {
        r["fid"]: r["n"]
        for r in conn.execute(
            "SELECT COALESCE(folder_id, 0) AS fid, COUNT(*) AS n FROM question_favs WHERE uid=? GROUP BY fid",
            (uid,),
        )
    }
    folders = [{"id": 0, "name": "默认收藏夹", "icon": "⭐", "n": counts.get(0, 0)}]
    for r in conn.execute("SELECT * FROM fav_folders WHERE uid=? ORDER BY id", (uid,)):
        folders.append({"id": r["id"], "name": r["name"], "icon": r["icon"] or "📁", "n": counts.get(r["id"], 0)})
    return folders


@router.get("/favs/folders")
def api_fav_folders(uid: str):
    u = _clean_uid(uid)
    conn = db.get_conn()
    folders = _folder_rows(conn, u)
    conn.close()
    return {"items": folders}


@router.post("/favs/folders")
def api_fav_folder_create(body: dict):
    u = _clean_uid(body.get("uid"))
    name = str(body.get("name") or "").strip()[:20]
    if not name:
        raise HTTPException(400, "夹名不能为空")
    conn = db.get_conn()
    n = conn.execute("SELECT COUNT(*) FROM fav_folders WHERE uid=?", (u,)).fetchone()[0]
    if n >= 20:
        conn.close()
        raise HTTPException(400, "收藏夹最多 20 个")
    try:
        cur = conn.execute(
            "INSERT INTO fav_folders (uid, name, icon, created_at) VALUES (?,?,?,?)",
            (u, name, str(body.get("icon") or "").strip()[:4] or None, time.time()),
        )
    except Exception:
        conn.close()
        raise HTTPException(409, "已有同名收藏夹") from None
    conn.commit()
    conn.close()
    return {"id": cur.lastrowid, "name": name}


@router.patch("/favs/folders/{fid}")
def api_fav_folder_rename(fid: int, body: dict):
    u = _clean_uid(body.get("uid"))
    name = str(body.get("name") or "").strip()[:20]
    if not name:
        raise HTTPException(400, "夹名不能为空")
    conn = db.get_conn()
    try:
        cur = conn.execute("UPDATE fav_folders SET name=? WHERE id=? AND uid=?", (name, fid, u))
    except Exception:
        conn.close()
        raise HTTPException(409, "已有同名收藏夹") from None
    conn.commit()
    conn.close()
    if not cur.rowcount:
        raise HTTPException(404, "收藏夹不存在")
    return {"ok": True}


@router.delete("/favs/folders/{fid}")
def api_fav_folder_delete(fid: int, uid: str):
    u = _clean_uid(uid)
    conn = db.get_conn()
    cur = conn.execute("DELETE FROM fav_folders WHERE id=? AND uid=?", (fid, u))
    # 夹内收藏移回默认夹
    conn.execute("UPDATE question_favs SET folder_id=NULL WHERE uid=? AND folder_id=?", (u, fid))
    conn.commit()
    conn.close()
    if not cur.rowcount:
        raise HTTPException(404, "收藏夹不存在")
    return {"ok": True}


@router.get("/favs")
def api_favs(uid: str, folder_id: int | None = None, module: str | None = None, limit: int = 200):
    u = _clean_uid(uid)
    conn = db.get_conn()
    where, args = ["uid=?"], [u]
    if folder_id is not None:
        where.append("COALESCE(folder_id, 0)=?")
        args.append(int(folder_id))
    rows = conn.execute(
        f"SELECT question_id, COALESCE(folder_id, 0) AS folder_id, created_at FROM question_favs "
        f"WHERE {' AND '.join(where)} ORDER BY created_at DESC LIMIT ?",
        [*args, min(int(limit), 500)],
    ).fetchall()
    notes = {
        r["question_id"]: r["content"]
        for r in conn.execute("SELECT question_id, content FROM question_notes WHERE uid=?", (u,))
    }
    conn.close()
    meta = {r["question_id"]: r for r in rows}
    questions = {q["id"]: q for q in db.questions_by_ids([r["question_id"] for r in rows])}
    items = []
    for r in rows:
        q = questions.get(r["question_id"])
        if not q:
            continue
        if module and q.get("module") != module:
            continue
        m = meta[r["question_id"]]
        items.append({
            **q,
            "folder_id": m["folder_id"],
            "faved_at": m["created_at"],
            "note": notes.get(r["question_id"]),
        })
    items.sort(key=lambda x: -x["faved_at"])
    return {"items": items}


@router.post("/favs")
def api_fav_set(body: dict):
    u = _clean_uid(body.get("uid"))
    qid = body.get("question_id")
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    folder_id = body.get("folder_id") or None
    conn = db.get_conn()
    if folder_id and not conn.execute(
        "SELECT 1 FROM fav_folders WHERE id=? AND uid=?", (int(folder_id), u)
    ).fetchone():
        conn.close()
        raise HTTPException(404, "收藏夹不存在")
    conn.execute(
        """INSERT INTO question_favs (uid, question_id, folder_id, created_at) VALUES (?,?,?,?)
           ON CONFLICT (uid, question_id) DO UPDATE SET folder_id=excluded.folder_id""",
        (u, int(qid), int(folder_id) if folder_id else None, time.time()),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "faved": True}


@router.delete("/favs")
def api_fav_remove(uid: str, question_id: int):
    u = _clean_uid(uid)
    conn = db.get_conn()
    conn.execute("DELETE FROM question_favs WHERE uid=? AND question_id=?", (u, question_id))
    conn.commit()
    conn.close()
    return {"ok": True, "faved": False}


@router.get("/favs/status")
def api_fav_status(uid: str, question_id: int):
    u = _clean_uid(uid)
    conn = db.get_conn()
    row = conn.execute(
        "SELECT COALESCE(folder_id, 0) AS folder_id FROM question_favs WHERE uid=? AND question_id=?",
        (u, question_id),
    ).fetchone()
    note = conn.execute(
        "SELECT content FROM question_notes WHERE uid=? AND question_id=?", (u, question_id)
    ).fetchone()
    conn.close()
    return {
        "faved": bool(row),
        "folder_id": row["folder_id"] if row else None,
        "note": note["content"] if note else None,
    }


# ---------- 每题笔记 ----------

NOTE_MAX_LEN = 1000


@router.get("/notes")
def api_notes(uid: str, question_id: int | None = None, limit: int = 200):
    u = _clean_uid(uid)
    conn = db.get_conn()
    if question_id is not None:
        row = conn.execute(
            "SELECT content, updated_at FROM question_notes WHERE uid=? AND question_id=?",
            (u, question_id),
        ).fetchone()
        conn.close()
        return {"item": dict(row) if row else None}
    rows = conn.execute(
        "SELECT question_id, content, updated_at FROM question_notes WHERE uid=? ORDER BY updated_at DESC LIMIT ?",
        (u, min(int(limit), 500)),
    ).fetchall()
    conn.close()
    questions = {q["id"]: q for q in db.questions_by_ids([r["question_id"] for r in rows])}
    items = []
    for r in rows:
        q = questions.get(r["question_id"])
        items.append({
            "question_id": r["question_id"],
            "content": r["content"],
            "updated_at": r["updated_at"],
            "question": (q or {}).get("question"),
            "module": (q or {}).get("module"),
            "submodule": (q or {}).get("submodule"),
        })
    return {"items": items}


@router.post("/notes")
def api_note_save(body: dict):
    u = _clean_uid(body.get("uid"))
    qid = body.get("question_id")
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    content = str(body.get("content") or "").strip()[:NOTE_MAX_LEN]
    conn = db.get_conn()
    if content:
        conn.execute(
            """INSERT INTO question_notes (uid, question_id, content, updated_at) VALUES (?,?,?,?)
               ON CONFLICT (uid, question_id) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at""",
            (u, int(qid), content, time.time()),
        )
    else:
        conn.execute("DELETE FROM question_notes WHERE uid=? AND question_id=?", (u, int(qid)))
    conn.commit()
    conn.close()
    return {"ok": True, "content": content or None}


# ---------- 打卡里程碑徽章 ----------

BADGE_MILESTONES = [3, 7, 14, 30, 60, 100]

# 打卡日界统一按北京时间（Asia/Shanghai，无夏令时，固定 UTC+8）
CN_TZ = timezone(timedelta(hours=8))
CN_DAY_SQL = "DATE(created_at + 28800, 'unixepoch')"


def _cn_now() -> datetime:
    return datetime.now(CN_TZ)


@router.get("/checkin/badges")
def api_checkin_badges(uid: str):
    """连续打卡里程碑徽章：按 answer_log 的做题日期计算当前连击与历史最长连击。"""
    u = _clean_uid(uid)
    conn = db.get_conn()
    days = {
        r["d"]
        for r in conn.execute(
            f"SELECT DISTINCT {CN_DAY_SQL} AS d FROM answer_log WHERE uid=?",
            (u,),
        )
    }
    conn.close()
    streak = 0
    d = _cn_now()
    if d.strftime("%Y-%m-%d") not in days:
        d -= timedelta(days=1)
    while d.strftime("%Y-%m-%d") in days:
        streak += 1
        d -= timedelta(days=1)
    best = 0
    run = 0
    prev = None
    for day in sorted(days):
        cur = datetime.strptime(day, "%Y-%m-%d").date()
        run = run + 1 if prev is not None and (cur - prev).days == 1 else 1
        best = max(best, run)
        prev = cur
    return {
        "streak": streak,
        "best_streak": best,
        "badges": [{"days": m, "unlocked": best >= m} for m in BADGE_MILESTONES],
    }


# ---------- 打卡摘要（海报数据） ----------

@router.get("/checkin/summary")
def api_checkin_summary(uid: str):
    u = _clean_uid(uid)
    conn = db.get_conn()
    days = {
        r["d"]: {"n": r["n"], "correct": r["c"]}
        for r in conn.execute(
            f"""SELECT {CN_DAY_SQL} AS d,
                      COUNT(*) AS n, SUM(correct) AS c
               FROM answer_log WHERE uid=? GROUP BY d""",
            (u,),
        )
    }
    # 复习作答同样计入每日练习量（今日已练/连签/日历口径统一：练习+复习都算学习行为）
    if conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='review_log'"
    ).fetchone():
        for r in conn.execute(
            f"""SELECT {CN_DAY_SQL} AS d,
                      COUNT(*) AS n, SUM(correct) AS c
               FROM review_log WHERE uid=? GROUP BY d""",
            (u,),
        ):
            t = days.setdefault(r["d"], {"n": 0, "correct": 0})
            t["n"] += r["n"]
            t["correct"] = (t["correct"] or 0) + (r["c"] or 0)
    total = conn.execute("SELECT COUNT(*) FROM answer_log WHERE uid=?", (u,)).fetchone()[0]
    today = _cn_now().strftime("%Y-%m-%d")
    day0 = _cn_now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp()
    cleared_today = conn.execute(
        "SELECT COUNT(*) FROM review_log WHERE uid=? AND correct=1 AND created_at>=?",
        (u, day0),
    ).fetchone()[0] if conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='review_log'"
    ).fetchone() else 0
    prof = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profile'"
    ).fetchone()
    exam_date = exam_type = None
    if prof:
        p = conn.execute("SELECT * FROM user_profile WHERE uid=?", (u,)).fetchone()
        if p:
            keys = p.keys()
            exam_date = p["exam_date"] if "exam_date" in keys else None
            exam_type = p["exam_type"] if "exam_type" in keys else None
    conn.close()
    streak = 0
    d = _cn_now()
    if today not in days:
        d -= timedelta(days=1)
    while d.strftime("%Y-%m-%d") in days:
        streak += 1
        d -= timedelta(days=1)
    t = days.get(today, {"n": 0, "correct": 0})
    days_to_exam = None
    if exam_date:
        try:
            days_to_exam = (datetime.strptime(exam_date, "%Y-%m-%d").date() - datetime.now(CN_TZ).date()).days
        except ValueError:
            days_to_exam = None
    return {
        "date": today,
        "streak": streak,
        "today_n": t["n"],
        "today_correct": t["correct"] or 0,
        "today_rate": round(100 * (t["correct"] or 0) / t["n"]) if t["n"] else None,
        "cleared_today": cleared_today,
        "total": total,
        "days": days,
        "exam_type": exam_type,
        "days_to_exam": days_to_exam if days_to_exam is not None and days_to_exam >= 0 else None,
    }
