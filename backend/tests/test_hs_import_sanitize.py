"""R348 hs 导入口源头拦截：含自检失败词不落库、管线括注被剥离并重打分。"""
from app import db, deps, quality

from .conftest import seed_questions

_HS = "第一步：由题干可知总量为 120。第二步：代入选项排除 B、C。因此故选 A。" * 3
_NOTE = "（通用解法，该题型花生方法不在库中）"


def _q(qid: int) -> dict:
    conn = db.get_conn()
    row = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    conn.close()
    return dict(row)


def test_import_skips_selfcheck_failed_items():
    q1, q2 = seed_questions()[:2]
    before1, before2 = _q(q1), _q(q2)
    n = db.import_hs_explanations([
        {"id": q1, "hs_explanation": _HS + "SKIP:数据与选项矛盾。", "xp_explanation": "xp 不应落库"},
        {"id": q2, "hs_explanation": "官方解析有误，" + _HS},
    ])
    assert n == 0
    after1, after2 = _q(q1), _q(q2)
    assert after1["hs_explanation"] == before1["hs_explanation"]
    assert after1["xp_explanation"] == before1["xp_explanation"]
    assert after1["has_hs"] == before1["has_hs"]
    assert after2["hs_explanation"] == before2["hs_explanation"]


def test_import_strips_pipeline_note_and_rescores():
    q1 = seed_questions()[2]
    assert db.import_hs_explanations([{"id": q1, "hs_explanation": _HS + "\n" + _NOTE}]) == 1
    a1 = _q(q1)
    assert a1["hs_explanation"] == _HS
    assert a1["has_hs"] == 1
    assert not quality.HS_PIPELINE_NOTE_RE.search(a1["hs_explanation"])
    assert a1["quality_score"] == quality.score_question(a1)
    # 剥离后与同题干净导入同分（无 −15）
    assert db.import_hs_explanations([{"id": q1, "hs_explanation": _HS}]) == 1
    assert _q(q1)["quality_score"] == a1["quality_score"]


def test_hs_import_endpoint_applies_sanitize(client, monkeypatch):
    monkeypatch.setattr(deps, "IMPORT_TOKEN", "test-import-token")
    q1, q2 = seed_questions()[4:6]
    r = client.post(
        "/api/questions/hs_import",
        headers={"X-Import-Token": "test-import-token"},
        json={"items": [
            {"id": q1, "hs_explanation": _HS + "SKIP:无法用给定数据得出唯一答案。"},
            {"id": q2, "hs_explanation": "此题" + _NOTE + "按整体法：" + _HS},
        ]},
    )
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    assert _q(q1)["hs_explanation"] in (None, "")
    assert _q(q2)["hs_explanation"] == "此题按整体法：" + _HS
