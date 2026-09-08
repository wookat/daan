"""R525：导出 PDF 含无 id 内联题（时政 NULL-qid / 手录）时，机读答题卡只放有 id 的题——
槽位与 save_paper_export 的 question_ids 同序，scan_sheet/paper_answers 才对得回；卷首注明不参与判分的题数。"""
import io

from pypdf import PdfReader  # pyright: ignore[reportMissingImports]

from app.pdf_export import build_paper_pdf, sheet_questions

ORD = {"id": 110, "module": "changshi", "question": "下列节气中，白昼最长的是：", "options": {"A": "春分", "B": "夏至"}, "answer": "B"}
SZ = {"id": None, "module": "时政", "question": "R525：某会议的说法正确的是\nA.甲 B.乙 C.丙 D.丁", "options": {}, "answer": "C", "analysis": "本地解析"}


def _pages(data: bytes) -> list[str]:
    return [p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages]


def _flat(s: str) -> str:
    return "".join(s.split())


def test_sheet_questions_keeps_only_id_rows_with_original_numbering():
    assert sheet_questions([ORD, SZ]) == [(1, ORD)]
    assert sheet_questions([SZ, ORD]) == [(2, ORD)]
    assert sheet_questions([SZ]) == []


def test_mixed_export_sheet_has_only_gradable_row_and_meta_note():
    data = build_paper_pdf("错题重练卷", [ORD, SZ], paper_code="ABCD1234")
    pages = _pages(data)
    sheet, body = pages[0], "".join(pages[1:])
    lines = [ln.strip() for ln in sheet.splitlines()]
    assert "答题卡" in sheet and "CS-000110" in lines
    # 只有第 1 题一行槽位；无 id 的时政题不占第 2 行
    assert "1" in lines and "2" not in lines
    assert lines.count("A") == 1
    assert "共2题" in _flat(body)
    assert "答题卡1题（时政/手录题1题不参与机读判分" in _flat(body)
    # 正文/答案页仍完整含时政题
    assert "R525：某会议的说法正确的是" in body
    assert "2. 答案 C" in body and "本地解析" in body


def test_all_inline_export_has_no_sheet_page_but_keeps_content():
    data = build_paper_pdf("错题重练卷", [SZ], paper_code="ABCD1234")
    pages = _pages(data)
    assert not any("机读卷码区" in p for p in pages)
    body = "".join(pages)
    assert "本卷均为时政/手录题，无机读答题卡" in _flat(body)
    assert "R525：某会议的说法正确的是" in body and "1. 答案 C" in body


def test_all_ordinary_export_unchanged():
    data = build_paper_pdf("测试卷", [ORD, {**ORD, "id": 111}], paper_code="ABCD1234")
    pages = _pages(data)
    lines = [ln.strip() for ln in pages[0].splitlines()]
    assert "机读卷码区 · 请勿涂改" in lines and "1" in lines and "2" in lines
    assert "不参与机读判分" not in "".join(pages)


def test_meta_note_absent_when_sheet_not_requested():
    data = build_paper_pdf("测试卷", [ORD, SZ], paper_code="ABCD1234", answer_sheet=False)
    assert "不参与机读判分" not in "".join(_pages(data))
