"""公开契约回归测试：临时 SQLite 注入后拉起完整应用。"""
import json
import os
import tempfile
import time

import pytest

_tmpdir = tempfile.mkdtemp(prefix="kg-test-")
os.environ["DB_PATH"] = os.path.join(_tmpdir, "test.db")
os.environ.pop("INDEXNOW_KEY", None)
os.environ.pop("KG_VAPID_PRIVATE", None)
os.environ.pop("KG_VAPID_PUBLIC", None)

from fastapi.testclient import TestClient

from app import db
from app.main import app


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


def seed_questions(per_module: int = 3, modules=("ziliao", "shuliang", "yanyu", "panduan", "changshi")):
    conn = db.get_conn()
    ids = []
    for mod in modules:
        for i in range(per_module):
            cur = conn.execute(
                "INSERT OR IGNORE INTO questions (module, question_type, question, options, answer,"
                " explanation, is_real, disabled) VALUES (?,?,?,?,?,?,1,0)",
                (
                    mod,
                    "单选题",
                    f"测试题干 {mod}-{i}：以下说法正确的是？",
                    json.dumps({"A": "甲", "B": "乙", "C": "丙", "D": "丁"}, ensure_ascii=False),
                    "A",
                    "测试解析：选 A。",
                ),
            )
            if cur.lastrowid:
                ids.append(cur.lastrowid)
    conn.commit()
    conn.close()
    return ids


def seed_share(sid: str, question_id: int, from_name: str = "测试考友"):
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO shared_questions (sid, question_id, from_uid, from_name, created_at)"
        " VALUES (?,?,?,?,?)",
        (sid, question_id, "utestsharer", from_name, time.time()),
    )
    conn.commit()
    conn.close()


def seed_pk(code: str, status: str = "finished", creator_score: int = 120, opponent_score: int = 90):
    conn = db.get_conn()
    conn.execute(
        "INSERT OR IGNORE INTO pk_matches (code, module, question_ids, creator_uid, creator_name,"
        " creator_score, creator_correct, creator_time_ms, creator_answers, opponent_uid,"
        " opponent_name, opponent_score, opponent_correct, opponent_time_ms, opponent_answers,"
        " status, winner, created_at, finished_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            code, "yanyu", json.dumps([1, 2, 3, 4, 5]), "utestcreator", "测试甲",
            creator_score, 4, 60000, json.dumps(["A"] * 5), "utestopponent",
            "测试乙", opponent_score, 3, 70000, json.dumps(["B"] * 5),
            status, "creator" if creator_score >= opponent_score else "opponent",
            time.time(), time.time() if status == "finished" else None,
        ),
    )
    conn.commit()
    conn.close()
