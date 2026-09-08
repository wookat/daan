"""W10-A：负 limit 统一夹到 [0, cap]（SQLite `LIMIT -1` 等于不限行数）。"""
import pytest
from fastapi import HTTPException

from app import db
from app.deps import clamp_limit

from .conftest import seed_questions


def _seed_shenlun(n: int):
    conn = db.get_conn()
    for i in range(n):
        conn.execute(
            "INSERT OR IGNORE INTO shenlun_questions (exam_year, exam_region, paper, qtype, question, material, disabled)"
            " VALUES (?,?,?,?,?,?,0)",
            (2023, "国考", "副省级", "概括题", f"W10 申论测试题 {i}", "材料"),
        )
    conn.commit()
    conn.close()


def test_clamp_limit_bounds():
    assert clamp_limit(-1, 50) == 0
    assert clamp_limit(0, 50) == 0
    assert clamp_limit(20, 50) == 20
    assert clamp_limit(999, 50) == 50
    assert clamp_limit(None, 50, floor=1) == 1
    with pytest.raises(HTTPException):
        clamp_limit("abc", 50)


def test_shenlun_questions_negative_limit_equals_zero(client):
    _seed_shenlun(3)
    neg = client.get("/api/shenlun/questions?limit=-1")
    zero = client.get("/api/shenlun/questions?limit=0")
    assert neg.status_code == 200 and zero.status_code == 200
    assert len(neg.json()["items"]) <= 50
    assert neg.json()["items"] == zero.json()["items"] == []
    assert neg.json()["total"] >= 3
    assert len(client.get("/api/shenlun/questions?limit=2").json()["items"]) == 2


def test_negative_limit_endpoints_do_not_error(client):
    seed_questions()
    r = client.get("/api/mistakes/redo?limit=-5")
    assert r.status_code == 200 and r.json()["items"] == []
    r = client.get("/api/questions?limit=-1")
    assert r.status_code == 200 and r.json()["items"] == []
    r = client.get("/api/questions?limit=-1&module=ziliao&grouped=1")
    assert r.status_code == 200 and r.json()["items"] == []
