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
TOP = (0x2E, 0x5B, 0xFF)
BOT = (0x4C, 0x7D, 0xFF)


def main() -> None:
    im = Image.new("RGB", (W, H))
    for y in range(H):
        t = y / (H - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(TOP, BOT))
        im.paste(c, (0, y, W, y + 1))
    d = ImageDraw.Draw(im)

    f_site = ImageFont.truetype(str(FONT), 96)
    f_sub = ImageFont.truetype(str(FONT), 46)
    f_chip = ImageFont.truetype(str(FONT), 32)

    d.text((90, 150), "岸上见", font=f_site, fill=(255, 255, 255))
    d.text((90, 290), "10万+ 行测题 · 1.5万+ 历年真题免费在线刷", font=f_sub, fill=(255, 255, 255))

    chips = ["AI 拍题讲解", "智能错题本", "每日一练", "迷你模考"]
    x = 90
    y = 420
    for c in chips:
        tw = d.textlength(c, font=f_chip)
        d.rounded_rectangle(
            (x, y, x + tw + 48, y + 64), radius=32, outline=(255, 255, 255), width=2
        )
        d.text((x + 24, y + 13), c, font=f_chip, fill=(255, 255, 255))
        x += tw + 48 + 24

    d.text((90, 540), "kaogong.zalize.com · 免注册打开即练", font=f_chip, fill=(220, 230, 255))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT, optimize=True)
    print("written:", OUT, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
