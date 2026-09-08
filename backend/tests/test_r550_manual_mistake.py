"""R550：免 AI 手录错题（POST /api/mistakes source='manual'）——服务端归一/校验；
落库为 question_id=NULL 行，复习到期/重练/PDF 走既有内联路径；非 manual 来源的写入不受影响。"""
import time

import pytest

from app import db
from app.manual_mistake import MANUAL_MODULES, normalize

UID = "test-r550-manual-u1"


def _base(**kw):
    rec = {
        "uid": UID,
        "source": "manual",
        "module": "shuliang",
        "question_text": "R550 手录：某数列 1,3,6,10,…第 5 项是？\nA.13  B.14  C.15  D.16",
        "correct_answer": "c",
        "user_answer": "B",
        "error_reason": "方法不会",
        "explanation": "  二阶等差  \n\n\n\n差为 2,3,4,5 ",
    }
    rec.update(kw)
    return rec


def test_normalize_happy_path_collapses_and_normalizes():
    out = normalize(_base())
    assert out["module"] == "shuliang" and out["source"] == "manual"
    assert out["question_id"] is None and out["question_type"] is None
    assert out["correct_answer"] == "C" and out["user_answer"] == "B"
    assert out["error_reason"] == "方法不会"
    assert out["explanation"] == "二阶等差\n\n差为 2,3,4,5"
    assert out["question_text"].startswith("R550 手录：")


def test_normalize_multi_letters_sorted_dedup_and_optional_fields_none():
    out = normalize(_base(correct_answer="dbb", user_answer="", error_reason="随便写", explanation=None))
    assert out["correct_answer"] == "BD"
    assert out["user_answer"] is None
    assert out["error_reason"] is None and out["explanation"] is None


@pytest.mark.parametrize(
    "patch, msg",
    [
        ({"uid": ""}, "缺少 uid"),
        ({"module": "shenlun"}, "请选择模块"),
        ({"module": ""}, "请选择模块"),
        ({"question_text": " x "}, "请填写题干"),
        ({"correct_answer": "E"}, "正确答案"),
        ({"correct_answer": ""}, "正确答案"),
        ({"user_answer": "c"}, "相同"),
    ],
)
def test_normalize_rejects(patch, msg):
    with pytest.raises(ValueError) as ei:
        normalize(_base(**patch))
    assert msg in str(ei.value)


def test_normalize_truncates_long_text():
    out = normalize(_base(question_text="题" * 5000, explanation="解" * 5000))
    assert len(out["question_text"]) == 2000 and len(out["explanation"]) == 2000


def test_manual_modules_cover_xingce_and_shizheng():
    assert MANUAL_MODULES == {"ziliao", "shuliang", "yanyu", "panduan", "changshi", "时政"}


def test_api_manual_saves_null_qid_row_and_400_on_invalid(client):
    r = client.post("/api/mistakes", json=_base(question_id=999999, question_type="单选"))
    assert r.status_code == 200
    mid = r.json()["id"]
    items = client.get(f"/api/mistakes?uid={UID}").json()["items"]
    m = next(x for x in items if x["id"] == mid)
    assert m["question_id"] is None and m["source"] == "manual" and m["module"] == "shuliang"
    assert m["correct_answer"] == "C" and m["user_answer"] == "B" and m["error_reason"] == "方法不会"
    assert m["question_type"] is None
    assert m["next_review"] is None or m["next_review"] <= time.time() + 86400 * 2

    bad = client.post("/api/mistakes", json=_base(correct_answer=""))
    assert bad.status_code == 400 and "正确答案" in bad.json()["detail"]
    same = client.post("/api/mistakes", json=_base(user_answer="C"))
    assert same.status_code == 400

    # 同 uid 同题干再录：不新增行，times+1（既有 save_mistake 去重口径）
    r2 = client.post("/api/mistakes", json=_base())
    assert r2.json()["id"] == mid
    items2 = client.get(f"/api/mistakes?uid={UID}").json()["items"]
    assert sum(1 for x in items2 if x["id"] == mid) == 1
    assert next(x for x in items2 if x["id"] == mid)["times"] == 2

    # 另一 uid 同题干互不可见
    other = client.post("/api/mistakes", json=_base(uid=UID + "-b")).json()["id"]
    assert other != mid
    assert all(x["id"] != other for x in client.get(f"/api/mistakes?uid={UID}").json()["items"])


def test_api_non_manual_source_untouched(client):
    """AI/练习路径 source 缺省或 exam：不走 manual 校验，空 correct_answer 也照旧落库。"""
    r = client.post(
        "/api/mistakes",
        json={"uid": UID + "-ai", "module": "yanyu", "question_text": "R550 AI 路径题干", "user_answer": "A", "explanation": "解析"},
    )
    assert r.status_code == 200
    items = client.get(f"/api/mistakes?uid={UID}-ai").json()["items"]
    assert items and items[0]["source"] is None and items[0]["correct_answer"] is None


def test_manual_row_flows_into_review_due_and_redo_skips(client):
    """手录行进入到期复习（question_id=NULL 走内联字段）；重练对不回题库 fail-closed 跳过（计入 skipped，不静默少题）。"""
    uid = UID + "-flow"
    mid = client.post("/api/mistakes", json=_base(uid=uid)).json()["id"]
    conn = db.get_conn()
    conn.execute("UPDATE mistakes SET next_review=? WHERE id=?", (time.time() - 10, mid))
    conn.commit()
    conn.close()
    due = client.get(f"/api/review?uid={uid}").json()["items"]
    d = next(x for x in due if x["id"] == mid)
    assert d["question_id"] is None and d["correct_answer"] == "C" and "R550 手录" in d["question_text"]
    rr = client.post(f"/api/review/{mid}", json={"uid": uid, "correct": False, "picked": "B", "secs": 7})
    assert rr.status_code == 200
    redo = client.get(f"/api/mistakes/redo?uid={uid}&limit=10").json()
    assert redo["items"] == [] and redo["skipped"] == 1
