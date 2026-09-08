"""R549：错题本导出 PDF 可附每题「我的错答 / 错因」（参考答案页），批注只来自请求体、归一后落到题目 dict；
题库题按 `mistakes[question_id]` 对回、内联题随 items 自带；不带批注时 PDF 与 R548 前完全同形态。"""
import io

import pytest
from pypdf import PdfReader  # pyright: ignore[reportMissingImports]

from app import db
from app.pdf_export import build_paper_pdf, mistake_note, note_text, parse_mistake_notes
from tests.conftest import seed_questions

ORD = {"id": 110, "module": "changshi", "question": "下列节气中，白昼最长的是：", "options": {"A": "春分", "B": "夏至"}, "answer": "B", "analysis": "夏至日照最长"}
SZ = {"id": None, "module": "时政", "question": "R549：某会议的说法正确的是\nA.甲 B.乙 C.丙 D.丁", "options": {}, "answer": "C"}


def _body(data: bytes) -> str:
    return "".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)


def _flat(s: str) -> str:
    return "".join(s.split())


@pytest.mark.parametrize(
    "raw, expect",
    [
        ({"picked": "a", "reason": "粗心大意"}, {"my_answer": "A", "error_reason": "粗心大意"}),
        ({"picked": "DBB"}, {"my_answer": "BD"}),
        ({"picked": "我选 C", "reason": "  概念  不清 "}, {"my_answer": "C", "error_reason": "概念 不清"}),
        ({"reason": "x" * 40}, {"error_reason": "x" * 24}),
        ({"picked": "", "reason": ""}, {}),
        ({"picked": 12, "reason": None}, {}),
        ("not-a-dict", {}),
        (None, {}),
    ],
)
def test_mistake_note_normalizes(raw, expect):
    assert mistake_note(raw) == expect


def test_parse_mistake_notes_by_qid_drops_bad_keys_and_empty():
    out = parse_mistake_notes({"110": {"picked": "A"}, "abc": {"picked": "B"}, 7: {"reason": ""}, "8": {"reason": "纯蒙的"}})
    assert out == {110: {"my_answer": "A"}, 8: {"error_reason": "纯蒙的"}}
    assert parse_mistake_notes(None) == {} and parse_mistake_notes([{"picked": "A"}]) == {}


def test_note_text_variants():
    assert note_text({}) == ""
    assert note_text({"my_answer": "A"}) == "我的错答 A"
    assert note_text({"error_reason": "粗心大意"}) == "错因：粗心大意"
    assert note_text({"my_answer": "A", "error_reason": "粗心大意"}) == "我的错答 A · 错因：粗心大意"


def test_pdf_renders_notes_on_answer_page_and_meta_count():
    qs = [{**ORD, "my_answer": "A", "error_reason": "粗心大意"}, {**SZ, "error_reason": "纯蒙的"}]
    body = _flat(_body(build_paper_pdf("错题重练卷", qs, paper_code="ABCD1234", answer_sheet=False)))
    assert "2题附我的错答/错因" in body
    assert "1.答案B我的错答A·错因：粗心大意夏至日照最长" in body
    # 无解析的时政题也因有批注而出现在解析段
    assert "2.答案C错因：纯蒙的" in body


def test_pdf_without_notes_unchanged_and_answers_off_hides_notes():
    plain = _flat(_body(build_paper_pdf("错题重练卷", [ORD, SZ], paper_code="ABCD1234", answer_sheet=False)))
    assert "我的错答" not in plain and "错因" not in plain and "附我的错答" not in plain
    off = build_paper_pdf("错题重练卷", [{**ORD, "my_answer": "A"}], paper_code="ABCD1234", answer_sheet=False, include_answers=False)
    assert "我的错答" not in _body(off) and "附我的错答" not in _body(off)


def test_api_export_pdf_attaches_notes_by_qid_and_inline(client):
    qid = seed_questions(1, ("yanyu",))[0]
    q = db.questions_by_ids([qid])[0]
    r = client.post(
        "/api/export/pdf",
        json={
            "uid": "test-r549-export",
            "question_ids": [qid],
            "items": [{"module": "时政", "question": "R549 内联题干", "answer": "C", "picked": "d", "reason": "方法不会"}],
            "mistakes": {str(qid): {"picked": "a", "reason": "粗心大意"}, "999999999": {"picked": "B"}},
            "answer_sheet": False,
        },
    )
    assert r.status_code == 200, r.text
    body = _flat(_body(r.content))
    assert "2题附我的错答/错因" in body
    assert "我的错答A·错因：粗心大意" in body
    assert "我的错答D·错因：方法不会" in body
    assert _flat(q["explanation"]) in body


def test_api_export_pdf_ignores_malformed_mistakes(client):
    qid = seed_questions(1, ("yanyu",))[0]
    for bad in ([1, 2], "x", {"abc": {"picked": "A"}}, {str(qid): "A"}):
        r = client.post("/api/export/pdf", json={"uid": "test-r549-export", "question_ids": [qid], "mistakes": bad, "answer_sheet": False})
        assert r.status_code == 200, (bad, r.text)
        assert "我的错答" not in _body(r.content)
