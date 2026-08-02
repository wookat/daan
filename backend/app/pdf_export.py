"""试卷/答题卡 PDF 生成（A4 打印排版）。"""
import io
import time

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_FONT = "KGSans"
_FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
]


def _ensure_font() -> str:
    if _FONT in pdfmetrics.getRegisteredFontNames():
        return _FONT
    for path in _FONT_CANDIDATES:
        try:
            pdfmetrics.registerFont(TTFont(_FONT, path, subfontIndex=0))
            return _FONT
        except Exception:
            continue
    return "Helvetica"


def _styles(font: str) -> dict:
    return {
        "title": ParagraphStyle("t", fontName=font, fontSize=16, leading=22, alignment=1),
        "meta": ParagraphStyle("m", fontName=font, fontSize=9, leading=13, alignment=1, textColor=colors.HexColor("#646A73")),
        "sec": ParagraphStyle("s", fontName=font, fontSize=12, leading=17, spaceBefore=10, spaceAfter=4),
        "q": ParagraphStyle("q", fontName=font, fontSize=10.5, leading=16, wordWrap="CJK", spaceBefore=6),
        "opt": ParagraphStyle("o", fontName=font, fontSize=10.5, leading=15, wordWrap="CJK", leftIndent=14),
        "mat": ParagraphStyle("mt", fontName=font, fontSize=9.5, leading=14, wordWrap="CJK", textColor=colors.HexColor("#333"), leftIndent=6, spaceBefore=4),
        "ans": ParagraphStyle("a", fontName=font, fontSize=10, leading=15, wordWrap="CJK", spaceBefore=4),
    }


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(_ensure_font(), 8)
    canvas.setFillColor(colors.HexColor("#8F959E"))
    canvas.drawCentredString(A4[0] / 2, 10 * mm, f"第 {doc.page} 页 · 考公错题助手 kaogong.zalize.com")
    canvas.restoreState()


def build_paper_pdf(
    title: str,
    questions: list[dict],
    include_answers: bool = True,
    answer_sheet: bool = True,
    paper_code: str = "",
) -> bytes:
    font = _ensure_font()
    st = _styles(font)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=title,
    )
    story = []
    n = len(questions)
    date = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 8 * 3600))
    story.append(Paragraph(_esc(title), st["title"]))
    meta = f"共 {n} 题 · 建议用时 {max(5, round(n * 0.9))} 分钟 · {date}"
    if paper_code:
        meta += f" · 卷码 {paper_code}"
    story.append(Spacer(1, 3))
    story.append(Paragraph(meta, st["meta"]))
    story.append(Paragraph("姓名：__________　得分：__________", st["meta"]))
    story.append(Spacer(1, 6))

    cur_mod = None
    part = 0
    last_mat = None
    for i, q in enumerate(questions, 1):
        mod = q.get("module") or ""
        if mod and mod != cur_mod:
            cur_mod = mod
            part += 1
            zh = "一二三四五六七八九十"[part - 1] if part <= 10 else str(part)
            story.append(Paragraph(f"第{zh}部分　{_esc(mod)}", st["sec"]))
        qtext = q.get("question") or ""
        mat = q.get("material") or ""
        if not mat and "【资料】" in qtext:
            mat, _, rest = qtext.partition("【资料】")[2].partition("【问题】")
            if rest.strip():
                qtext = rest.strip()
            else:
                mat = ""
        if mat and mat != last_mat:
            story.append(Paragraph("【资料】" + _esc(mat.strip()), st["mat"]))
        last_mat = mat or last_mat
        qid = q.get("id")
        tag = f'<font size="7.5" color="#8F959E">[{qid}]</font> ' if qid else ""
        story.append(Paragraph(f"{i}. {tag}{_esc(qtext)}", st["q"]))
        opts = q.get("options") or {}
        for k in ["A", "B", "C", "D", "E", "F"]:
            if k in opts and opts[k]:
                story.append(Paragraph(f"{k}. {_esc(str(opts[k]))}", st["opt"]))

    if answer_sheet:
        story.append(_page_break())
        story.extend(_answer_sheet_flow(questions, st, font, title, paper_code))

    if include_answers:
        story.append(_page_break())
        story.append(Paragraph("参考答案与解析", st["title"]))
        story.append(Spacer(1, 6))
        story.extend(_answer_table(questions, st, font))
        for i, q in enumerate(questions, 1):
            ana = (q.get("analysis") or q.get("explanation") or q.get("hs_explanation") or "").strip()
            if not ana:
                continue
            story.append(
                Paragraph(
                    f"<b>{i}. 答案 {_esc(q.get('answer') or '—')}</b>　{_esc(ana[:600])}",
                    st["ans"],
                )
            )

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


def _page_break():
    from reportlab.platypus import PageBreak

    return PageBreak()


def _answer_table(questions: list[dict], st: dict, font: str):
    cells, row = [], []
    per = 5
    for i, q in enumerate(questions, 1):
        row.append(f"{i}. {q.get('answer') or '—'}")
        if len(row) == per:
            cells.append(row)
            row = []
    if row:
        cells.append(row + [""] * (per - len(row)))
    if not cells:
        return []
    t = Table(cells, colWidths=[33 * mm] * per)
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), font),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#EBEDF0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return [t, Spacer(1, 8)]


def _answer_sheet_flow(questions: list[dict], st: dict, font: str, title: str, paper_code: str):
    flow = [Paragraph("答题卡", st["title"]), Spacer(1, 2)]
    sub = _esc(title) + (f" · 卷码 {paper_code}" if paper_code else "")
    flow.append(Paragraph(sub, st["meta"]))
    flow.append(Paragraph("姓名：__________　日期：__________　请用铅笔将所选项涂满", st["meta"]))
    flow.append(Spacer(1, 8))
    n = len(questions)
    cols = 2
    rows_per_col = (n + cols - 1) // cols
    grid = []
    for r in range(rows_per_col):
        row = []
        for c in range(cols):
            idx = c * rows_per_col + r
            if idx < n:
                qid = questions[idx].get("id") or ""
                row += [f"{idx + 1}", f"[{qid}]", "Ⓐ", "Ⓑ", "Ⓒ", "Ⓓ"]
            else:
                row += [""] * 6
        grid.append(row)
    widths = ([10 * mm, 18 * mm] + [14 * mm] * 4) * cols
    t = Table(grid, colWidths=widths, rowHeights=8.2 * mm)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#8F959E")),
        ("FONTSIZE", (1, 0), (1, -1), 7),
        ("TEXTCOLOR", (7, 0), (7, -1), colors.HexColor("#8F959E")),
        ("FONTSIZE", (7, 0), (7, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EBEDF0")),
    ]
    t.setStyle(TableStyle(style))
    flow.append(t)
    return flow
