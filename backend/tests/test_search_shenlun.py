"""站内搜索申论真题段回归（R241）：/api/search 覆盖 shenlun_questions。"""
from app import db

from .test_shenlun_hub import _seed_shenlun


def test_search_returns_shenlun_hits_and_empty_when_no_corpus(client):
    _seed_shenlun()
    try:
        r = client.get("/api/search", params={"q": "测试申论"})
        assert r.status_code == 200
        hits = r.json()["shenlun"]
        assert hits and all("测试申论" in h["question"] for h in hits)
        assert {"id", "exam_year", "exam_region", "paper", "qtype", "question"} <= set(hits[0])
        # 卷名命中同样可搜
        assert client.get("/api/search", params={"q": "副省级"}).json()["shenlun"]
        # type=question 不带申论段
        assert "shenlun" not in client.get(
            "/api/search", params={"q": "测试申论", "type": "question"}
        ).json()
    finally:
        conn = db.get_conn()
        conn.execute("DELETE FROM shenlun_questions")
        conn.commit()
        conn.close()
    assert client.get("/api/search", params={"q": "测试申论"}).json()["shenlun"] == []
