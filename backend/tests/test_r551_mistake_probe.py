"""R551：mistakes / review_log 入库侧探针打标（与 answer_log.probe 同口径），本人列表/复习语义不变。"""
import pytest

from app import auth, db
from tests.conftest import seed_questions

PFX = "test-r551-"
PROBE_IP = {"X-Kg-Ip": "140.232.64.5"}
REAL_IP = {"X-Kg-Ip": "39.158.40.85"}


@pytest.fixture
def probe_nets(monkeypatch):
    monkeypatch.setattr(auth, "PROBE_NETS", auth.parse_cidrs("140.232.64.0/24"))


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    conn = db.get_conn()
    db._ensure_review_log(conn)
    for t in ("mistakes", "review_log", "answer_log", "paper_submits"):
        try:
            conn.execute(f"DELETE FROM {t} WHERE uid LIKE ?", (PFX + "%",))
        except Exception:
            pass
    conn.commit()
    conn.close()


def _probe(table, uid):
    conn = db.get_conn()
    rows = [r["probe"] for r in conn.execute(f"SELECT probe FROM {table} WHERE uid=? ORDER BY id", (uid,))]
    conn.close()
    return rows


def _manual(uid):
    return {
        "uid": uid, "source": "manual", "module": "ziliao",
        "question_text": "R551 手录题干", "correct_answer": "B", "user_answer": "A",
    }


def test_save_mistake_tags_probe_by_cidr_and_header(client, probe_nets):
    up, ur, uh = PFX + "p", PFX + "r", PFX + "h"
    assert client.post("/api/mistakes", json=_manual(up), headers=PROBE_IP).status_code == 200
    assert client.post("/api/mistakes", json=_manual(ur), headers=REAL_IP).status_code == 200
    assert client.post("/api/mistakes", json=_manual(uh), headers={**REAL_IP, "X-Kg-Probe": "1"}).status_code == 200
    assert _probe("mistakes", up) == [1]
    assert _probe("mistakes", ur) == [0]
    assert _probe("mistakes", uh) == [1]
    # 本人列表不受打标影响，且内部标记不外泄到客户端字段
    items = client.get("/api/mistakes", params={"uid": up}).json()["items"]
    assert len(items) == 1 and "probe" not in items[0]


def test_duplicate_save_keeps_original_probe(client, probe_nets):
    uid = PFX + "dup"
    a = client.post("/api/mistakes", json=_manual(uid), headers=REAL_IP).json()["id"]
    b = client.post("/api/mistakes", json=_manual(uid), headers=PROBE_IP).json()["id"]
    assert a == b
    assert _probe("mistakes", uid) == [0]


def test_review_log_tags_probe_via_review_and_answer_log(client, probe_nets):
    qid = seed_questions(1, ("ziliao",))[0]
    for uid, hdr, want in ((PFX + "rv-p", PROBE_IP, 1), (PFX + "rv-r", REAL_IP, 0)):
        mid = client.post(
            "/api/mistakes",
            json={"uid": uid, "module": "ziliao", "question_id": qid, "question_text": "题库题",
                  "correct_answer": "A", "user_answer": "B"},
            headers=hdr,
        ).json()["id"]
        r = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": True, "picked": "A", "secs": 5}, headers=hdr)
        assert r.status_code == 200 and r.json()["streak"] == 1
        # 练习答对连带推进复习（via=answer）同样打标
        r = client.post("/api/answer_log", json={"uid": uid, "items": [{"qid": qid, "correct": True, "mid": mid}]}, headers=hdr)
        assert r.status_code == 200 and r.json()["reviewed"][0]["streak"] == 2
        assert _probe("mistakes", uid) == [want]
        assert _probe("review_log", uid) == [want, want]
        assert _probe("answer_log", uid) == [want]


def test_exam_wrong_mistakes_tag_probe(client, probe_nets):
    qids = seed_questions(2, ("ziliao",))[:2]
    db.save_paper_export("R551PRB", qids, "R551 探针卷")
    uid = PFX + "paper"
    r = client.post("/api/paper_answers", json={"code": "R551PRB", "uid": uid, "picks": {"1": "B", "2": "B"}},
                    headers=PROBE_IP)
    assert r.status_code == 200
    rows = _probe("mistakes", uid)
    assert rows and set(rows) == {1}
