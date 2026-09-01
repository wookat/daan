"""管理台折叠侧栏导航可访问名称静态契约（R227/R228）。

≤1023px 折叠图标栏下 .txt 必须以 sr-only 方式隐藏（保留可访问性树），
且每个导航链接 title 与 .txt 文案一致，避免名称退化为 emoji。
"""

import os
import re

ADMIN_DIR = os.path.join(os.path.dirname(__file__), "..", "app", "admin")

NAV_RE = re.compile(
    r'<a data-page="([\w-]+)"[^>]*>.*?<span class="txt">([^<]+)</span>',
    re.DOTALL,
)
TITLE_RE = re.compile(r'<a data-page="([\w-]+)"[^>]*?title="([^"]*)"')


def _read(name: str) -> str:
    with open(os.path.join(ADMIN_DIR, name), encoding="utf-8") as f:
        return f.read()


def test_nav_links_title_matches_txt():
    html = _read("index.html")
    txts = dict(NAV_RE.findall(html))
    titles = dict(TITLE_RE.findall(html))
    assert len(txts) == 12, f"侧栏导航链接数变化: {sorted(txts)}"
    for page, txt in txts.items():
        assert titles.get(page), f"{page} 缺 title tooltip"
        assert titles[page] == txt, f"{page} title 与 .txt 文案漂移: {titles[page]!r} != {txt!r}"


def test_collapsed_txt_hidden_via_sr_only_not_display_none():
    css = _read("admin.css")
    blocks = re.findall(r"@media\(max-width:1023px\)\{(.*?)\n\}", css, re.DOTALL)
    assert blocks, "≤1023px 折叠媒体查询缺失"
    joined = "\n".join(blocks)
    for rule in re.finditer(r"([^{}]+)\{[^{}]*display\s*:\s*none[^{}]*\}", joined):
        assert ".txt" not in rule.group(1), f".txt 回退为 display:none 会使可访问名称只剩 emoji: {rule.group(0)!r}"
    m = re.search(r"\.side nav a \.txt\{([^}]*)\}", joined)
    assert m, "折叠态 .side nav a .txt 隐藏规则缺失"
    body = m.group(1)
    assert "position:absolute" in body and "clip:" in body, f"折叠态 .txt 需 sr-only 式 clip 隐藏: {body!r}"
