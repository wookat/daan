"""站内搜索申论素材段回归（R244）：/api/search 覆盖 shenlun_materials。"""
from app import db


def _seed_mats():
    conn = db.get_conn()
    conn.execute(
        "INSERT INTO shenlun_materials(type, topic, content, source, disabled) VALUES(?,?,?,?,?)",
        ("金句", "测试素材乡村振兴", "产业兴旺是乡村振兴的物质基础。", "测试出处", None),
    )
    conn.execute(
        "INSERT INTO shenlun_materials(type, topic, content, source, disabled) VALUES(?,?,?,?,?)",
        ("案例", "基层治理", "测试素材乡村振兴案例正文内容。", "", 0),
    )
    conn.execute(
        "INSERT INTO shenlun_materials(type, topic, content, source, disabled) VALUES(?,?,?,?,?)",
        ("范文", "测试素材乡村振兴已下架", "已下架内容。", "", 1),
    )
    conn.commit()
    conn.close()


def test_search_returns_shenlun_material_hits(client):
    _seed_mats()
    try:
        r = client.get("/api/search", params={"q": "测试素材乡村振兴"})
        assert r.status_code == 200
        hits = r.json()["shenlun_mats"]
        assert len(hits) == 2  # topic 命中 + content 命中，disabled 排除
        assert {"id", "type", "topic", "content", "source"} <= set(hits[0])
        # type=question 不带素材段
        assert "shenlun_mats" not in client.get(
            "/api/search", params={"q": "测试素材乡村振兴", "type": "question"}
        ).json()
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM shenlun_materials WHERE topic LIKE '%测试素材%' OR content LIKE '%测试素材%'")
        conn.commit()
        conn.close()
    assert client.get("/api/search", params={"q": "测试素材乡村振兴"}).json()["shenlun_mats"] == []


def test_materials_by_id_deeplink(client):
    """R246：/api/shenlun/materials?id=N 按 id 取单条；下架 id 取不到。"""
    _seed_mats()
    try:
        conn = db.get_conn()
        ok_id = conn.execute(
            "SELECT id FROM shenlun_materials WHERE topic='测试素材乡村振兴'"
        ).fetchone()[0]
        off_id = conn.execute(
            "SELECT id FROM shenlun_materials WHERE topic='测试素材乡村振兴已下架'"
        ).fetchone()[0]
        conn.close()
        r = client.get("/api/shenlun/materials", params={"id": ok_id})
        items = r.json()["items"]
        assert len(items) == 1 and items[0]["id"] == ok_id
        r2 = client.get("/api/shenlun/materials", params={"id": off_id})
        assert r2.json()["items"] == []
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM shenlun_materials WHERE topic LIKE '%测试素材%' OR content LIKE '%测试素材%'")
        conn.commit()
        conn.close()
