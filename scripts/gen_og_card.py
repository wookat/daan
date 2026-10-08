"""生成社交分享品牌卡 og-card.png（1200x630）。

用法: python3 scripts/gen_og_card.py
输出: frontend-uni/src/static/og-card.png
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "backend" / "app" / "fonts" / "NotoSansSC-Bold.ttf"
OUT = ROOT / "frontend-uni" / "src" / "static" / "og-card.png"

W, H = 1200, 630
BRAND = (0x2E, 0x5B, 0xFF)
WHITE = (255, 255, 255)


def _seg(d: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, w: float, color) -> None:
    """圆头线段：line + 两端圆帽。"""
    d.line((x0, y0, x1, y1), fill=color, width=round(w))
    r = w / 2
    for cx, cy in ((x0, y0), (x1, y1)):
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=color)


def draw_mark(d: ImageDraw.ImageDraw, x: float, y: float, size: float, color) -> None:
    """答岸「海岸日出」标，PIL 直绘（96 视窗坐标等比缩放）。"""
    s = size / 96.0
    w = 6 * s

    def P(px: float, py: float) -> tuple[float, float]:
        return (x + px * s, y + py * s)

    _seg(d, *P(48, 30), *P(48, 37), w, color)          # 顶光
    _seg(d, *P(28, 38), *P(37, 47), w, color)          # 左光
    _seg(d, *P(59, 47), *P(68, 38), w, color)          # 右光
    ax0, ay0 = P(33, 58 - 15)
    ax1, ay1 = P(63, 58 + 15)
    d.arc((ax0, ay0, ax1, ay1), start=180, end=360, fill=color, width=round(w))  # 日弧
    _seg(d, *P(26, 66), *P(70, 66), w, color)          # 岸线
    _seg(d, *P(32, 76), *P(48, 76), w, color)          # 水纹
    _seg(d, *P(56, 76), *P(66, 76), w, color)


def main() -> None:
    im = Image.new("RGB", (W, H), BRAND)
    d = ImageDraw.Draw(im)

    # 白块标：圆角白砖 + 品牌蓝线稿
    tx, ty, ts = 90, 110, 200
    d.rounded_rectangle((tx, ty, tx + ts, ty + ts), radius=46, fill=WHITE)
    pad = 26
    draw_mark(d, tx + pad, ty + pad - 6, ts - pad * 2, BRAND)

    f_site = ImageFont.truetype(str(FONT), 96)
    f_sub = ImageFont.truetype(str(FONT), 46)
    f_chip = ImageFont.truetype(str(FONT), 32)

    d.text((330, 152), "答岸", font=f_site, fill=WHITE)
    d.text((90, 356), "10万+ 行测题 · 1.5万+ 历年真题免费在线刷", font=f_sub, fill=WHITE)

    chips = ["AI 拍题讲解", "智能错题本", "每日一练", "迷你模考"]
    x = 90
    y = 448
    for c in chips:
        tw = d.textlength(c, font=f_chip)
        d.rounded_rectangle(
            (x, y, x + tw + 48, y + 64), radius=32, outline=WHITE, width=2
        )
        d.text((x + 24, y + 13), c, font=f_chip, fill=WHITE)
        x += tw + 48 + 24

    d.text((90, 552), "kaogong.zalize.com · 免注册打开即练", font=f_chip, fill=(220, 230, 255))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, optimize=True)
    print("written:", OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
