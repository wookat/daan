"""W17-B1：PK 随机匹配只接 PK_MATCH_WINDOW_S 内的等待局——几天前遗留的 waiting 局不再配给新用户；
窗口内可匹配、探针池隔离不变。"""
import json

from app import db
from app.pk import PK_MATCH_WINDOW_S

from .conftest import seed_questions

PROBE = {"X-Kg-Probe": "1"}
UIDS = ["test-w17-pkw-a", "test-w17-pkw-b", "test-w17-pkw-c", "test-w17-pkw-p1", "test-w17-pkw-p2"]


def _reset():
    conn = db.get_conn()
    for u in UIDS:
        conn.execute("DELETE FROM pk_matches WHERE creator_uid=? OR opponent_uid=?", (u, u))
    conn.commit()
    conn.close()


def _finish_creator(client, code: str, uid: str, headers=None):
    conn = db.get_conn()
    qids = json.loads(conn.execute("SELECT question_ids FROM pk_matches WHERE code=?", (code,)).fetchone()[0])
    conn.close()
    ans = {q["id"]: q["answer"] for q in db.questions_by_ids(qids)}
    items = [{"question_id": q, "answer": ans[q], "ms": 1000} for q in qids]
    r = client.post("/api/pk/submit", json={"uid": uid, "code": code, "items": items}, headers=headers or {})
    assert r.status_code == 200, r.text


def _age(code: str, seconds: float):
    conn = db.get_conn()
    conn.execute("UPDATE pk_matches SET created_at=created_at-? WHERE code=?", (seconds, code))
    conn.commit()
    conn.close()


def _waiting_created(client, uid: str, headers=None) -> str:
    code = client.post("/api/pk/create", json={"uid": uid, "module": "yanyu"}, headers=headers or {}).json()["code"]
    _finish_creator(client, code, uid, headers)
    return code


def test_stale_waiting_match_not_served(client):
    _reset()
    seed_questions(per_module=12, modules=("yanyu",))
    stale = _waiting_created(client, "test-w17-pkw-a")
    _age(stale, PK_MATCH_WINDOW_S + 60)
    r = client.post("/api/pk/random_match", json={"uid": "test-w17-pkw-b", "module": "yanyu"}).json()
    assert r["matched"] is False and r["code"] != stale
    # 过期局仍可凭挑战码加入
    j = client.post("/api/pk/join", json={"uid": "test-w17-pkw-c", "code": stale})
    assert j.status_code == 200 and len(j.json()["questions"]) == 10
    _reset()


def test_fresh_waiting_match_served_newest_first(client):
    _reset()
    seed_questions(per_module=12, modules=("yanyu",))
    older = _waiting_created(client, "test-w17-pkw-a")
    _age(older, PK_MATCH_WINDOW_S - 3600)
    newer = _waiting_created(client, "test-w17-pkw-b")
    r = client.post("/api/pk/random_match", json={"uid": "test-w17-pkw-c", "module": "yanyu"}).json()
    assert r["matched"] is True and r["code"] == newer
    r2 = client.post("/api/pk/random_match", json={"uid": "test-w17-pkw-p1", "module": "yanyu"}).json()
    assert r2["matched"] is True and r2["code"] == older
    _reset()


def test_probe_pool_isolation_unchanged_within_window(client):
    _reset()
    seed_questions(per_module=12, modules=("yanyu",))
    pc = _waiting_created(client, "test-w17-pkw-p1", PROBE)
    r = client.post("/api/pk/random_match", json={"uid": "test-w17-pkw-a", "module": "yanyu"}).json()
    assert r["matched"] is False and r["code"] != pc
    r2 = client.post("/api/pk/random_match", json={"uid": "test-w17-pkw-p2", "module": "yanyu"}, headers=PROBE).json()
    assert r2["matched"] is True and r2["code"] == pc
    _reset()
