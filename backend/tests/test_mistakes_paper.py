"""R368：错题本归卷——/api/mistakes 每条 paper={pid,title,psource}（真题且匹配卷库 psource），否则 None（fail-closed）。"""
from app import db
from tests.test_paper_psource import _seed_paper, _seed_src_questions


def _save(client, uid: str, qid: int | None, text: str):
    r = client.post("/api/mistakes", json={
        "uid": uid, "question_id": qid, "module": "yanyu", "question_type": "单选题",
        "question_text": text, "user_answer": "B", "correct_answer": "A",
    })
    assert r.status_code == 200
    return r.json()["id"]


def _by_id(client, uid: str) -> dict:
    d = client.get(f"/api/mistakes?uid={uid}").json()
    return {m["id"]: m for m in d["items"]}


def test_paper_attached_for_real_question_in_paper(client):
    uid = "u-r368-a"
    qids = _seed_src_questions("2024r368归卷卷", 20)
    pid = _seed_paper("r368 归卷测试卷", qids)
    mid = _save(client, uid, qids[3], "r368 归卷题干 A")
    m = _by_id(client, uid)[mid]
    assert m["paper"] == {"pid": pid, "title": "r368 归卷测试卷", "psource": "2024r368归卷卷"}
    assert "q_source" not in m and "q_is_real" not in m


def test_paper_none_when_not_real_or_no_paper_or_no_qid(client):
    uid = "u-r368-b"
    fake = _seed_src_questions("2024r368非真题卷", 20, is_real=0)
    _seed_paper("r368 非真题卷", fake)
    orphan = _seed_src_questions("2024r368无卷source", 20)  # 有 source 但没建卷
    m1 = _save(client, uid, fake[0], "r368 非真题题干")
    m2 = _save(client, uid, orphan[0], "r368 无卷题干")
    m3 = _save(client, uid, None, "r368 无 question_id 题干")
    by = _by_id(client, uid)
    assert by[m1]["paper"] is None
    assert by[m2]["paper"] is None
    assert by[m3]["paper"] is None


def test_paper_picks_latest_when_same_source(client):
    uid = "u-r368-c"
    qids = _seed_src_questions("2024r368同源两卷", 20)
    _seed_paper("r368 同源旧卷", qids)
    pid_new = _seed_paper("r368 同源新卷", qids)
    mid = _save(client, uid, qids[0], "r368 同源题干")
    m = _by_id(client, uid)[mid]
    assert m["paper"]["pid"] == pid_new
    assert m["paper"]["title"] == "r368 同源新卷"


def test_paper_survives_disabled_question(client):
    uid = "u-r368-d"
    qids = _seed_src_questions("2024r368禁用卷", 22)
    pid = _seed_paper("r368 禁用测试卷", qids)
    mid = _save(client, uid, qids[0], "r368 禁用题干")
    conn = db.get_conn()
    conn.execute("UPDATE questions SET disabled=1 WHERE id=?", (qids[0],))
    conn.commit()
    conn.close()
    db._papers_cache.clear()
    m = _by_id(client, uid)[mid]
    assert m["paper"]["pid"] == pid
