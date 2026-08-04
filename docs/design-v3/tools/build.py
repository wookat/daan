# -*- coding: utf-8 -*-
"""生成 docs/design-v3/ 全部 HTML 原型。用法：python3 build.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CSS
import pages_core, pages_secondary

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

ALL = {}
ALL.update(pages_core.PAGES)
ALL.update(pages_secondary.PAGES)

GROUPS = [
 ("核心页（深做 · 移动 375px + 宽屏）", [
   ("home.html","01 刷题首页（Tab）","home-desktop.html"),
   ("practice.html","02 练习答题页（背题/自适应/组内结算）","practice-desktop.html"),
   ("book.html","03 错题本（Tab）","book-desktop.html"),
   ("stats.html","04 统计（Tab）","stats-desktop.html"),
 ]),
 ("错题本子流程", [
   ("book-detail.html","05 错题详情（历次作答 / AI 分析）",None),
   ("book-entry.html","06 手动录入",None),
   ("book-scan.html","07 扫描答题卡",None),
   ("pdf-export.html","19 PDF 导出弹层",None),
 ]),
 ("AI 与申论", [
   ("ask.html","08 AI 问答 / 拍题讲解（Tab）",None),
   ("shenlun.html","09 申论 · 真题题库",None),
   ("shenlun-detail.html","10 申论 · 作答",None),
   ("shenlun-review.html","11 申论 · AI 批改报告",None),
 ]),
 ("模考与养成", [
   ("exam-list.html","12 模考 · 真题卷库",None),
   ("exam.html","13 模考 · 全真答题",None),
   ("exam-report.html","14 模考 · 成绩报告",None),
   ("daily.html","15 时政每日一练",None),
   ("plan.html","16 学习计划 / 报考画像",None),
   ("calendar.html","20 学习日历",None),
 ]),
 ("账户", [
   ("login.html","17 登录 / 注册",None),
   ("profile.html","18 个人中心 / 设置（Tab）",None),
 ]),
]

def index_html():
    body = ""
    for g, items in GROUPS:
        cards = ""
        for href, title, dt in items:
            png = href.replace(".html", ".png")
            d = f' · <a href="{dt}">宽屏稿</a>' if dt else ""
            cards += f"""<div class="gcard">
  <a href="{href}"><img src="png/{png}" alt="{title}" loading="lazy"
    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="ph" style="display:none">预览图待生成</span></a>
  <div class="gt"><a href="{href}">{title}</a><span class="gl"><a href="{href}">HTML</a>{d}</span></div>
</div>"""
        body += f'<h2>{g}</h2><div class="grid">{cards}</div>'
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>考公助手 design-v3 · 全 APP UI/UX 原型总览</title>
<style>{CSS}
body{{background:var(--bg);padding:0 0 64px}}
.wrap{{max-width:1200px;margin:0 auto;padding:32px 24px}}
h1{{font-size:24px}} h2{{font-size:17px;margin:32px 0 14px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}}
.gcard{{background:#fff;border:1px solid var(--border);border-radius:var(--r-l);overflow:hidden;box-shadow:var(--sh-1)}}
.gcard:hover{{box-shadow:var(--sh-2)}}
.gcard img{{width:100%;height:300px;object-fit:cover;object-position:top;display:block;background:var(--fill)}}
.gcard .ph{{height:300px;align-items:center;justify-content:center;color:var(--t4);font-size:13px}}
.gt{{padding:10px 12px;font-size:13px;font-weight:600;display:flex;flex-direction:column;gap:4px}}
.gt a{{color:var(--t1);text-decoration:none}}
.gl{{font-weight:400;font-size:12px}} .gl a{{color:var(--brand-500)}}
.lead{{color:var(--t2);font-size:14px;max-width:760px;margin:10px 0 4px}}
.doc{{display:inline-flex;gap:8px;margin-top:14px}}
.doc a{{background:var(--brand-50);color:var(--brand-500);padding:8px 14px;border-radius:var(--r-m);font-size:13px;font-weight:600;text-decoration:none}}
</style></head><body><div class="wrap">
<h1>考公错题助手 · design-v3 全 APP UI/UX 原型</h1>
<p class="lead">品牌蓝 #3B6FF5 · 现代克制 · 配置收进入口内部、导航层只放行动 · 热区 ≥44px。移动 375px 主稿（H5/小程序/App 共用），核心 4 页另附 ≥768px 宽屏稿；每页右侧（宽屏浏览时）附设计要点与端差异标注。</p>
<div class="doc"><a href="DESIGN.md">📄 设计说明文档 DESIGN.md</a><a href="home.html">▶ 从首页开始点击走查</a></div>
{body}
</div></body></html>"""

def main():
    for name, html in ALL.items():
        with open(os.path.join(OUT, name), "w") as f:
            f.write(html)
    with open(os.path.join(OUT, "index.html"), "w") as f:
        f.write(index_html())
    print(f"generated {len(ALL)+1} html files -> {os.path.abspath(OUT)}")

if __name__ == "__main__":
    main()
