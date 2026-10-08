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


MARK_PNG = Path(__file__).resolve().parent.parent / "brand" / "mark-blue.png"


def draw_mark(im: Image.Image, x: float, y: float, size: float) -> None:
    """答岸「对勾旗上岸」标，直接贴 brand/mark-blue.png。"""
    mark = Image.open(MARK_PNG)
    scale = size / mark.width
    mark = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS)
    im.paste(mark, (round(x), round(y)), mark)


def main() -> None:
    im = Image.new("RGB", (W, H), BRAND)
    d = ImageDraw.Draw(im)

    # 白块标：圆角白砖 + 品牌蓝「对勾旗上岸」标
    tx, ty, ts = 90, 110, 200
    d.rounded_rectangle((tx, ty, tx + ts, ty + ts), radius=46, fill=WHITE)
    pad = 30
    draw_mark(im, tx + pad, ty + pad + 10, ts - pad * 2)

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
