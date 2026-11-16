"""机读答题卡：几何布局（生成与识别共用）+ 拍照识别管线。

坐标体系：A4 纵向，单位 mm，原点在左上角。
识别时统一透视纠偏到 4px/mm 的标准图（840x1188）。
"""


PAGE_W, PAGE_H = 210.0, 297.0
SCALE = 4  # px per mm（识别标准图）

# 四角定位块（实心正方形），左上角块更大用于方向判定
FID_SIZE = 6.0
FID_TL_SIZE = 9.0
FID_POS = {  # 中心点
    "tl": (14.0, 14.0),
    "tr": (196.0, 14.0),
    "br": (196.0, 283.0),
    "bl": (14.0, 283.0),
}

# 卷码条：40 个数据格（32 位卷码 + 4 位页号 + 4 位校验）
CODE_BITS = 40
CODE_Y = 34.0          # 格子顶边 y
CODE_CELL_W = 2.6
CODE_PITCH = 3.5
CODE_CELL_H = 4.5
CODE_X0 = (PAGE_W - CODE_BITS * CODE_PITCH) / 2

# 涂题网格：2 列 x 25 行 = 每页 50 题
ROWS = 25
COLS = 2
PER_PAGE = ROWS * COLS


def sheet_pages(n_slots: int) -> int:
    """答题卡页数：与 pdf_export 出卡 / exam_api 回读同一公式（槽位数按 PER_PAGE 分页，至少 1 页）。"""
    return max(1, -(-int(n_slots or 0) // PER_PAGE))
GRID_Y0 = 60.0         # 第一行格子顶边 y
ROW_H = 8.6
COL_X0 = (16.0, 110.0)  # 每列起点 x
NUM_W = 9.0             # 题号区宽
ID_W = 15.0             # 题目ID区宽
BUB_X0 = 28.0           # 列内第一个涂框左边偏移
BUB_PITCH = 15.0
BUB_W = 7.0
BUB_H = 4.6
LETTERS = "ABCD"


def code_to_bits(code: str, page_no: int) -> list[int]:
    v = int(code, 16) & 0xFFFFFFFF
    bits = [(v >> (31 - i)) & 1 for i in range(32)]
    p = page_no & 0xF
    bits += [(p >> (3 - i)) & 1 for i in range(4)]
    chk = (sum(bits) + p) & 0xF
    bits += [(chk >> (3 - i)) & 1 for i in range(4)]
    return bits


def bits_to_code(bits: list[int]) -> tuple[str, int] | None:
    if len(bits) != CODE_BITS:
        return None
    v = 0
    for b in bits[:32]:
        v = (v << 1) | b
    p = 0
    for b in bits[32:36]:
        p = (p << 1) | b
    chk = 0
    for b in bits[36:40]:
        chk = (chk << 1) | b
    if (sum(bits[:36]) + p) & 0xF != chk:
        return None
    if v == 0 or p < 1:  # 全零/无效页号视为误读
        return None
    return f"{v:08X}", p


def bubble_rect(slot: int, opt: int) -> tuple[float, float, float, float]:
    """slot: 页内序号 0..49，opt: 0..3 -> (x, y, w, h) 顶边坐标系 mm。"""
    col, row = divmod(slot, ROWS)
    x = COL_X0[col] + BUB_X0 + opt * BUB_PITCH
    y = GRID_Y0 + row * ROW_H + (ROW_H - BUB_H) / 2
    return x, y, BUB_W, BUB_H


def slot_label_pos(slot: int) -> tuple[float, float, float]:
    col, row = divmod(slot, ROWS)
    return COL_X0[col], COL_X0[col] + NUM_W, GRID_Y0 + row * ROW_H + ROW_H / 2


# ---------------- 识别 ----------------


def recognize(image_bytes: bytes) -> dict:
    """返回 {code, page, picks: {slot: 'A'|'AB'|''}} 或抛 ValueError。"""
    import cv2  # pyright: ignore[reportMissingImports]
    import numpy as np

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("无法解析图片")
    h, w = img.shape
    if max(h, w) > 2200:
        k = 2200 / max(h, w)
        img = cv2.resize(img, (int(w * k), int(h * k)))
    img = cv2.GaussianBlur(img, (3, 3), 0)
    thr = cv2.adaptiveThreshold(
        img, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 41, 15
    )
    pts = _find_fiducials(thr, img.shape)
    if pts is None:
        raise ValueError("未找到答题卡四角定位块，请拍全整张答题卡")
    dst_w, dst_h = int(PAGE_W * SCALE), int(PAGE_H * SCALE)
    dst = np.array(
        [
            [FID_POS["tl"][0] * SCALE, FID_POS["tl"][1] * SCALE],
            [FID_POS["tr"][0] * SCALE, FID_POS["tr"][1] * SCALE],
            [FID_POS["br"][0] * SCALE, FID_POS["br"][1] * SCALE],
            [FID_POS["bl"][0] * SCALE, FID_POS["bl"][1] * SCALE],
        ],
        dtype=np.float32,
    )
    for roll in range(4):
        src = np.array([pts[(roll + i) % 4] for i in range(4)], dtype=np.float32)
        m = cv2.getPerspectiveTransform(src, dst)
        warped = cv2.warpPerspective(img, m, (dst_w, dst_h))
        bw = cv2.adaptiveThreshold(
            warped, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 41, 15
        )
        decoded = _read_code(bw)
        if decoded:
            code, page = decoded
            return {"code": code, "page": page, "picks": _read_bubbles(bw)}
    raise ValueError("卷码识别失败，请对正光线充足后重拍")


def _find_fiducials(thr, shape):
    import cv2  # pyright: ignore[reportMissingImports]

    h, w = shape
    contours, _ = cv2.findContours(thr, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cands = []
    for c in contours:
        area = cv2.contourArea(c)
        if area < (h * w) * 3e-5 or area > (h * w) * 6e-3:
            continue
        x, y, bw_, bh_ = cv2.boundingRect(c)
        if bh_ == 0 or not 0.6 < bw_ / bh_ < 1.7:
            continue
        if area / (bw_ * bh_) < 0.75:  # 实心度
            continue
        cands.append((x + bw_ / 2, y + bh_ / 2, area))
    if len(cands) < 4:
        return None
    # 取分别最靠近图像四角的候选
    corners = [(0, 0), (w, 0), (w, h), (0, h)]
    pts = []
    for cx, cy in corners:
        best = min(cands, key=lambda t: (t[0] - cx) ** 2 + (t[1] - cy) ** 2)
        pts.append((best[0], best[1]))
    if len({(round(p[0]), round(p[1])) for p in pts}) < 4:
        return None
    return pts


def _read_code(bw) -> tuple[str, int] | None:
    bits = []
    y0 = int(CODE_Y * SCALE)
    y1 = int((CODE_Y + CODE_CELL_H) * SCALE)
    for i in range(CODE_BITS):
        x0 = int((CODE_X0 + i * CODE_PITCH) * SCALE)
        x1 = x0 + int(CODE_CELL_W * SCALE)
        cell = bw[y0:y1, x0:x1]
        bits.append(1 if cell.mean() > 90 else 0)
    return bits_to_code(bits)


def _read_bubbles(bw) -> dict:
    picks = {}
    for slot in range(PER_PAGE):
        fills = []
        for opt in range(4):
            x, y, w_, h_ = bubble_rect(slot, opt)
            x0, y0 = int((x + 0.8) * SCALE), int((y + 0.6) * SCALE)
            x1, y1 = int((x + w_ - 0.8) * SCALE), int((y + h_ - 0.6) * SCALE)
            fills.append(bw[y0:y1, x0:x1].mean() / 255.0)
        chosen = [LETTERS[i] for i, f in enumerate(fills) if f > 0.35]
        picks[slot] = "".join(chosen)
    return picks
