"""B7：申论热点三段式聚合 / 我的笔记 / 周报典型错题+下周计划。"""
import json
import time

from app import db

PFX = "test-b7-"


def _cleanup():
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    db._ensure_exam_tables(conn)
    conn.execute("DELETE FROM shenlun_materials WHERE topic LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM shenlun_notes WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM answer_log WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM mistakes WHERE uid LIKE ?", (PFX + "%",))
    conn.execute("DELETE FROM questions WHERE question LIKE 'b7-%'")
    conn.execute("DELETE FROM weekly_reports WHERE uid LIKE ?", (PFX + "%",))
    conn.commit()
    conn.close()


def _mat(topic, mtype, content):
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shenlun_materials (type, topic, content, source, import_batch, disabled)"
        " VALUES (?,?,?,?,?,0)",
        (mtype, topic, content, "test", "b7"),
    )
    conn.commit()
    conn.close()


def test_hotspots_groups_three_segs(client):
    _cleanup()
    _mat(PFX + "乡村振兴", "内涵", "乡村要振兴，产业必振兴")
    _mat(PFX + "乡村振兴", "角度", "从产业/人才/治理三线切入")
    _mat(PFX + "乡村振兴", "金句", "民族要复兴，乡村必振兴")
    _mat(PFX + "乡村振兴", "案例", "某县电商助农案例")
    _mat(PFX + "基层治理", "金句", "治国有常，利民为本")

    r = client.get("/api/shenlun/hotspots?limit=10")
    assert r.status_code == 200
    items = {g["topic"]: g for g in r.json()["items"]}
    g = items[PFX + "乡村振兴"]
    assert len(g["segs"]["内涵"]) == 1 and g["segs"]["内涵"][0]["type"] == "内涵"
    assert len(g["segs"]["角度"]) == 1 and len(g["segs"]["金句"]) == 1
    assert g["others"][0]["type"] == "案例"
    assert items[PFX + "基层治理"]["segs"]["金句"]
    # 排序：三段命中多的在前
    assert r.json()["items"][0]["topic"] == PFX + "乡村振兴"
    _cleanup()


def test_notes_crud(client):
    _cleanup()
    uid = PFX + "me"
    r = client.post("/api/shenlun/notes", json={
        "uid": uid, "topic": "乡村振兴", "title": "我的框架", "content": "先内涵后对策"})
    assert r.status_code == 200
    nid = r.json()["id"]
    r = client.get("/api/shenlun/notes", params={"uid": uid})
    assert [n["id"] for n in r.json()["items"]] == [nid]
    r = client.post("/api/shenlun/notes", json={
        "uid": uid, "id": nid, "topic": "乡村振兴", "title": "改", "content": "更新版"})
    assert r.json()["updated"] is True
    r = client.get("/api/shenlun/notes", params={"uid": uid})
    assert r.json()["items"][0]["content"] == "更新版"
    r = client.post("/api/shenlun/notes/delete", json={"uid": uid, "id": nid})
    assert r.json()["ok"] is True
    assert client.get("/api/shenlun/notes", params={"uid": uid}).json()["items"] == []
    # 越权：别人的 uid 删不到
    client.post("/api/shenlun/notes", json={"uid": uid, "content": "再一条"})
    nid2 = client.get("/api/shenlun/notes", params={"uid": uid}).json()["items"][0]["id"]
    r = client.post("/api/shenlun/notes/delete", json={"uid": PFX + "other", "id": nid2})
    assert r.json()["ok"] is False
    _cleanup()


def test_weekly_has_typical_and_plan(client):
    _cleanup()
    uid = PFX + "wk"
    conn = db.get_conn()
    db._ensure_answer_log(conn)
    db._ensure_mistake_uid(conn)
    # 上周（东八区上一周一内）写 6 条作答 + 2 条错题
    from app.insights import _week_start
    ws = _week_start(time.time()) - 7 * 86400
    qid = None
    cur = conn.execute(
        "INSERT INTO questions (module, question_type, question, options, answer, tag3,"
        " explanation, is_real, disabled) VALUES ('yanyu','单选题','b7-wk 题干',?, 'A','WK_TAG','解析',1,0)"
        " RETURNING id",
        (json.dumps({"A": "1"}, ensure_ascii=False),),
    )
    try:
        qid = cur.fetchone()["id"]
    except Exception:
        conn.execute(
            "INSERT INTO questions (module, question_type, question, options, answer, tag3,"
            " explanation, is_real, disabled) VALUES ('yanyu','单选题','b7-wk 题干',?,'A','WK_TAG','解析',1,0)",
            (json.dumps({"A": "1"}, ensure_ascii=False),),
        )
        qid = conn.execute("SELECT id FROM questions WHERE question='b7-wk 题干'").fetchone()["id"]
    for i in range(6):
        conn.execute(
            "INSERT INTO answer_log (uid, created_at, question_id, module, correct, secs)"
            " VALUES (?,?,?,?,?,?)",
            (uid, ws + 3600 + i * 60, qid, "yanyu", i % 2, 30),
        )
    conn.execute(
        "INSERT INTO mistakes (uid, question_id, module, created_at, error_reason)"
        " VALUES (?,?,?,?,?)",
        (uid, qid, "yanyu", ws + 7200, "审题偏差"),
    )
    conn.commit()
    conn.close()

    from app.report import _build
    d = _build(uid, ws)
    assert d is not None
    assert d["typical"][0]["qid"] == qid
    assert d["typical"][0]["reason"] == "审题偏差"
    assert d["typical"][0]["tag3"] == "WK_TAG"
    assert d["plan"]["target_n"] >= 6
    assert d["plan"]["items"] == d["actions"]
    _cleanup()
