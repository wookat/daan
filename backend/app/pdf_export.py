"""试卷/答题卡 PDF 生成（A4 打印排版）。"""
import io
import math
import os
import time

from . import omr, qcode

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

_FONT = "KGSans"
_MOD_NAMES = {
    "ziliao": "资料分析",
    "shuliang": "数量关系",
    "yanyu": "言语理解与表达",
    "panduan": "判断推理",
    "changshi": "常识判断",
    "shenlun": "申论",
}
_FONT_HEI = "KGHei"
_FONT_BOLD = "KGSongB"
_FONT_DIR = os.path.join(os.path.dirname(__file__), "fonts")
_SONG_CANDIDATES = [
    os.path.join(_FONT_DIR, "NotoSerifSC.ttf"),
    "/usr/share/fonts/truetype/arphic/uming.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
]
_SONG_BOLD_CANDIDATES = [
    os.path.join(_FONT_DIR, "NotoSerifSC-Bold.ttf"),
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
]
_HEI_CANDIDATES = [
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/arphic/uming.ttc",
]


def _register(name: str, candidates: list[str]) -> str:
    if name in pdfmetrics.getRegisteredFontNames():
        return name
    for path in candidates:
        try:
            pdfmetrics.registerFont(TTFont(name, path, subfontIndex=0))
            return name
        except Exception:
            continue
    return "Helvetica"


def _ensure_font() -> str:
    """正文字体：宋体（思源宋体），并注册粗体使 <b> 生效。"""
    name = _register(_FONT, _SONG_CANDIDATES)
    bold = _register(_FONT_BOLD, _SONG_BOLD_CANDIDATES)
    if name == _FONT:
        pdfmetrics.registerFontFamily(
            _FONT, normal=_FONT, bold=bold, italic=_FONT, boldItalic=bold
        )
    return name


def _ensure_hei() -> str:
    """标题/分节字体：黑体。"""
    return _register(_FONT_HEI, _HEI_CANDIDATES)


def _styles(font: str) -> dict:
    hei = _ensure_hei()
    return {
        "title": ParagraphStyle("t", fontName=hei, fontSize=17, leading=24, alignment=1),
        "meta": ParagraphStyle("m", fontName=font, fontSize=9, leading=14, alignment=1, textColor=colors.HexColor("#646A73")),
        "sec": ParagraphStyle("s", fontName=hei, fontSize=12.5, leading=18, spaceBefore=14, spaceAfter=5, textColor=colors.HexColor("#1F2329")),
        "q": ParagraphStyle("q", fontName=font, fontSize=10.5, leading=17, wordWrap="CJK", spaceBefore=9, firstLineIndent=0),
        "opt": ParagraphStyle("o", fontName=font, fontSize=10.5, leading=16.5, wordWrap="CJK", leftIndent=16),
        "mat": ParagraphStyle("mt", fontName=font, fontSize=9.5, leading=15, wordWrap="CJK", textColor=colors.HexColor("#333"), leftIndent=8, rightIndent=4, spaceBefore=8, spaceAfter=2, backColor=colors.HexColor("#F7F8FA"), borderPadding=5),
        "ans": ParagraphStyle("a", fontName=font, fontSize=10, leading=15.5, wordWrap="CJK", spaceBefore=5),
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
    include_questions: bool = True,
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
    story.append(Paragraph(_esc(title if include_questions else title + " · 参考答案"), st["title"]))
    meta = f"共 {n} 题 · 建议用时 {max(5, round(n * 0.9))} 分钟 · {date}"
    if paper_code:
        meta += f" · 卷码 {paper_code}"
    story.append(Spacer(1, 3))
    story.append(Paragraph(meta, st["meta"]))
    if include_questions:
        story.append(Paragraph("姓名：__________　得分：__________", st["meta"]))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#1F2329")))
    story.append(Spacer(1, 2))

    cur_mod = None
    part = 0
    last_mat = None
    for i, q in enumerate(questions, 1):
        if not include_questions:
            break
        mod = q.get("module") or ""
        mod = _MOD_NAMES.get(mod, mod)
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
        code = qcode.build_code(q)
        tag = f'<font size="7.5" color="#8F959E">[{code}]</font> ' if code else ""
        block = [Paragraph(f"<b>{i}.</b> {tag}{_esc(qtext)}", st["q"])]
        opts = q.get("options") or {}
        keys = [k for k in ["A", "B", "C", "D", "E", "F"] if k in opts and opts[k]]
        segs = [f"{k}. {str(opts[k]).strip()}" for k in keys]
        per = _opts_per_line(segs, font, 10.5, avail=A4[0] - 32 * mm - 16)
        for j in range(0, len(keys), per):
            line = "　　".join(_esc(s) for s in segs[j : j + per])
            block.append(Paragraph(line, st["opt"]))
        if len(qtext) <= 400:
            story.append(KeepTogether(block))
        else:
            story.extend(block)

    if include_answers:
        if include_questions:
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
    data = buf.getvalue()
    if answer_sheet and paper_code and include_questions:
        # 答题卡放在最前，方便用户先拿到/单独打印第一页
        data = _append_pdf(_omr_sheet_pdf(questions, title, paper_code), data)
    return data


def _append_pdf(main: bytes, extra: bytes) -> bytes:
    from pypdf import PdfReader, PdfWriter

    w = PdfWriter()
    for src in (main, extra):
        r = PdfReader(io.BytesIO(src))
        for p in r.pages:
            w.add_page(p)
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()


def _omr_sheet_pdf(questions: list[dict], title: str, paper_code: str) -> bytes:
    """机读答题卡：四角定位块 + 卷码条 + 涂黑框网格（几何与 omr.py 共用）。"""
    from reportlab.pdfgen import canvas as rl_canvas

    font = _ensure_font()
    hei = _ensure_hei()
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)
    n = len(questions)
    pages = max(1, math.ceil(n / omr.PER_PAGE))

    def X(x):
        return x * mm

    def Y(y):
        return (omr.PAGE_H - y) * mm

    for pg in range(1, pages + 1):
        # 四角定位块（左上更大）
        c.setFillColor(colors.black)
        for key, (cx, cy) in omr.FID_POS.items():
            s = omr.FID_TL_SIZE if key == "tl" else omr.FID_SIZE
            c.rect(X(cx - s / 2), Y(cy + s / 2), s * mm, s * mm, stroke=0, fill=1)
        # 标题与说明
        c.setFont(hei, 14)
        c.drawCentredString(X(105), Y(16), "答题卡")
        c.setFont(font, 8.5)
        c.setFillColor(colors.HexColor("#646A73"))
        c.drawCentredString(
            X(105), Y(22),
            f"{title} · 卷码 {paper_code} · 第 {pg}/{pages} 页 · 用黑色签字笔或 2B 铅笔将所选项方框完全涂黑",
        )
        c.drawCentredString(X(105), Y(27), "姓名：____________　　日期：____________")
        # 卷码条
        bits = omr.code_to_bits(paper_code, pg)
        c.setFillColor(colors.black)
        for i, b in enumerate(bits):
            x = omr.CODE_X0 + i * omr.CODE_PITCH
            if b:
                c.rect(X(x), Y(omr.CODE_Y + omr.CODE_CELL_H), omr.CODE_CELL_W * mm, omr.CODE_CELL_H * mm, stroke=0, fill=1)
            else:
                c.setStrokeColor(colors.HexColor("#C9CDD4"))
                c.setLineWidth(0.3)
                c.rect(X(x), Y(omr.CODE_Y + omr.CODE_CELL_H), omr.CODE_CELL_W * mm, omr.CODE_CELL_H * mm, stroke=1, fill=0)
        c.setFont(font, 6)
        c.setFillColor(colors.HexColor("#8F959E"))
        c.drawCentredString(X(105), Y(omr.CODE_Y + omr.CODE_CELL_H + 3), "机读卷码区 · 请勿涂改")
        # 题行
        start = (pg - 1) * omr.PER_PAGE
        for slot in range(omr.PER_PAGE):
            idx = start + slot
            if idx >= n:
                break
            q = questions[idx]
            nx, ix, cy_mid = omr.slot_label_pos(slot)
            c.setFont(hei, 9.5)
            c.setFillColor(colors.black)
            c.drawRightString(X(nx + omr.NUM_W - 2), Y(cy_mid + 1.2), str(idx + 1))
            code = qcode.build_code({**q, "is_real": None})  # 答题卡用短码（不含年份）
            if code:
                c.setFont(font, 5.5)
                c.setFillColor(colors.HexColor("#646A73"))
                c.drawString(X(ix), Y(cy_mid + 1.0), code)
            for opt in range(4):
                bx, by, bw_, bh_ = omr.bubble_rect(slot, opt)
                c.setStrokeColor(colors.black)
                c.setLineWidth(0.5)
                c.rect(X(bx), Y(by + bh_), bw_ * mm, bh_ * mm, stroke=1, fill=0)
                c.setFont(font, 7)
                c.setFillColor(colors.HexColor("#B9BFC7"))
                c.drawCentredString(X(bx + bw_ / 2), Y(by + bh_ - 1.1), omr.LETTERS[opt])
            if slot % omr.ROWS != omr.ROWS - 1 and idx != n - 1:
                c.setStrokeColor(colors.HexColor("#EFF1F4"))
                c.setLineWidth(0.25)
                yline = omr.GRID_Y0 + (slot % omr.ROWS + 1) * omr.ROW_H
                col = slot // omr.ROWS
                c.line(X(omr.COL_X0[col]), Y(yline), X(omr.COL_X0[col] + 88), Y(yline))
        c.setFont(font, 7)
        c.setFillColor(colors.HexColor("#8F959E"))
        c.drawCentredString(X(105), Y(292), "扫描入口：APP 错题本 → 扫描答题卡 · kaogong.zalize.com")
        c.showPage()
    c.save()
    return buf.getvalue()


def _opts_per_line(segs: list[str], font: str, size: float, avail: float) -> int:
    """按实际渲染宽度自适应：4/2/1 个选项一行。"""
    if not segs:
        return 1
    gap = pdfmetrics.stringWidth("　　", font, size)
    widths = [pdfmetrics.stringWidth(s, font, size) for s in segs]

    def fits(per: int) -> bool:
        for j in range(0, len(widths), per):
            chunk = widths[j : j + per]
            if sum(chunk) + gap * (len(chunk) - 1) > avail:
                return False
        return True

    for per in (4, 2):
        if len(segs) >= per and fits(per):
            return per
    return 1


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
