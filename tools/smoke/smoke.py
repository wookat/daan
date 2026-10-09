"""H5 发版冒烟巡检（一条命令）。

两段式：
1. deploy-integrity：index → entry → 其引用的全部 chunk 必须 200。
   这是「本次部署是否自洽」的决定性检查（hash chunk 缺失 = 部署事故）。
2. 逐页渲染：全新 browser context（无 SW/无磁盘缓存 = 新用户视角），
   每页唯一 ?v 强制文档重载；FAIL 只计正文为空与 pageerror/JS 报错。
   console 里的 404（残留 SW/邻居 tab 按旧 hash 拉 chunk）记为 noise 展示。

用法（先在本机开着 Chrome 并允许 --remote-debugging-port=29229）：
    MSYS_NO_PATHCONV=1 python tools/smoke/smoke.py
    MSYS_NO_PATHCONV=1 python tools/smoke/smoke.py --base https://kaogong.zalize.com/app/

依赖：pip install playwright
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

# 发版后必须验的核心页面（hash 路由）
PAGES = [
    "pages/home/home",
    "pages/book/book",
    "pages/stats/stats",
    "pages/profile/profile",
    "pages/practice/practice",
    "pkgA/exam/list",
]

BAD_STATUS = {0, 404, 500, 502, 503}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://kaogong.zalize.com/app/")
    ap.add_argument("--v", default=str(int(time.time())), help="缓存穿透参数")
    ap.add_argument("--pages", nargs="*", default=PAGES)
    args = ap.parse_args()

    fails = 0
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp("http://localhost:29229")
        ctx = browser.new_context()

        # ── 1. 部署自洽核验：index 引用的 entry + entry 引用的 chunk 全部 200
        try:
            idx = ctx.request.get(f"{args.base}?v={args.v}-idx").text()
            entries = sorted(set(re.findall(r"assets/index-[A-Za-z0-9_-]+\.js", idx)))
            missing = []
            for ent in entries:
                body = ctx.request.get(urljoin(args.base, ent)).text()
                # 引号内完整文件名：vite 会把 @/node_modules 编成 ..-node_modules-@xxx，正则需含 .@
                for c in sorted(set(re.findall(r'"([^"\']+\.[A-Za-z0-9_-]{8}\.js)"', body))):
                    path = c if c.startswith("assets/") else "assets/" + c
                    if ctx.request.get(urljoin(args.base, path)).status != 200:
                        missing.append(c)
            print(f"[{'OK' if not missing else 'FAIL'}] deploy-integrity entries={len(entries)} missing={len(missing)}")
            for m in missing[:8]:
                print("    asset:", m)
            if missing:
                fails += 1
        except Exception as e:  # noqa: BLE001
            fails += 1
            print("[FAIL] deploy-integrity", e)

        # ── 2. 逐页渲染核验
        page = ctx.new_page()
        errors: list[str] = []
        bad_assets: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on(
            "response",
            lambda r: bad_assets.append(f"{r.status} {r.url[:110]}")
            if r.status in BAD_STATUS and "/assets/" in r.url
            else None,
        )
        for i, rel in enumerate(args.pages):
            errors.clear()
            bad_assets.clear()
            url = f"{args.base}?v={args.v}-{i}#/{rel}"
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=20000)
                page.wait_for_timeout(2500)
                text = page.evaluate("document.body ? document.body.innerText.length : 0")
                page_errors = [e for e in errors if "Failed to load resource" not in e]
                ok = text > 50 and not page_errors
                if not ok:
                    fails += 1
                print(f"[{'OK' if ok else 'FAIL'}] {rel}  textlen={text} page_errors={len(page_errors)} asset404={len(bad_assets)}")
                for e in page_errors[:5]:
                    print("    err:", e[:160])
                for a in bad_assets[:5]:
                    print("    asset-noise:", a)
            except Exception as e:  # noqa: BLE001
                fails += 1
                print(f"[FAIL] {rel}  {e}")
        page.close()
        ctx.close()
    print("SMOKE", "PASS" if fails == 0 else f"{fails} FAILURES")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
