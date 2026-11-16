# -*- coding: utf-8 -*-
"""截图：375px 全页 + 核心 4 页宽屏。用法：python3 shoot.py（需 Chrome CDP :29229）"""
import os
from playwright.sync_api import sync_playwright

BASE = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PNG = os.path.join(BASE, "png")
os.makedirs(PNG, exist_ok=True)

MOBILE = ["home","practice","book","stats","book-detail","book-entry","book-scan","pdf-export",
          "ask","shenlun","shenlun-detail","shenlun-review","exam-list","exam","exam-report",
          "daily","plan","calendar","login","profile"]
DESKTOP = ["home-desktop","practice-desktop","book-desktop","stats-desktop","index"]

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://localhost:29229")
    ctx = browser.new_context(viewport={"width":375,"height":812}, device_scale_factor=2)
    pg = ctx.new_page()
    for name in MOBILE:
        pg.goto(f"file://{BASE}/{name}.html")
        pg.wait_for_timeout(150)
        pg.screenshot(path=f"{PNG}/{name}.png", full_page=True)
        print("m", name)
    pg.close(); ctx.close()
    ctx = browser.new_context(viewport={"width":1280,"height":800}, device_scale_factor=2)
    pg = ctx.new_page()
    for name in DESKTOP:
        pg.goto(f"file://{BASE}/{name}.html")
        pg.wait_for_timeout(150)
        pg.screenshot(path=f"{PNG}/{name}.png", full_page=True)
        print("d", name)
    pg.close(); ctx.close()
print("done")
