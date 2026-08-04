# -*- coding: utf-8 -*-
"""design-v3 原型生成公共库：共享 CSS + 页面骨架。"""

CSS = """
:root{
  --brand-50:#EDF3FE; --brand-100:#DCE7FD; --brand-200:#BDD2FB; --brand-300:#8FB2F9;
  --brand-400:#6493F7; --brand-500:#3B6FF5; --brand-600:#2C5AD6; --brand-700:#2247AC;
  --grad-brand:linear-gradient(135deg,#5B8AF8,#3B6FF5);
  --success:#16A34A; --success-bg:#ECFDF5; --error:#DC2626; --error-bg:#FEF2F2;
  --warning:#D97706; --warning-bg:#FFFBEB; --info:#0284C7; --info-bg:#F0F9FF;
  --t1:#17181C; --t2:#40434E; --t3:#7D818F; --t4:#B0B4C0;
  --border:#E7E9F0; --fill:#F2F3F7; --bg:#F6F7FB; --surface:#FFF;
  --mod-ziliao:#0D9488; --mod-shuliang:#3B6FF5; --mod-yanyu:#E11D48; --mod-panduan:#7C3AED; --mod-changshi:#D97706;
  --r-s:6px; --r-m:10px; --r-l:14px; --r-xl:20px; --r-full:999px;
  --sh-1:0 1px 4px rgba(23,24,28,.05); --sh-2:0 4px 12px rgba(23,24,28,.08); --sh-3:0 8px 24px rgba(23,24,28,.16);
}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;
  background:#E9EBF2;color:var(--t1);font-size:15px;line-height:1.55}
.stage{display:flex;justify-content:center;align-items:flex-start;gap:24px;padding:0}
@media(min-width:760px){.stage{padding:32px 24px}}
.phone{width:375px;flex:none;background:var(--bg);min-height:812px;position:relative;overflow:hidden}
@media(min-width:760px){.phone{border-radius:28px;box-shadow:var(--sh-3);border:1px solid #d8dbe4}}
.statusbar{height:44px;display:flex;align-items:flex-end;justify-content:space-between;
  padding:0 18px 6px;font-size:13px;font-weight:600;color:var(--t1)}
.statusbar .right{letter-spacing:1px;font-size:12px;color:var(--t2)}
.navbar{height:44px;display:flex;align-items:center;padding:0 16px;position:relative}
.navbar .title{position:absolute;left:0;right:0;text-align:center;font-size:16px;font-weight:600;pointer-events:none}
.navbar .back{width:32px;height:32px;border-radius:var(--r-full);display:flex;align-items:center;justify-content:center;
  background:var(--surface);border:1px solid var(--border);font-size:15px;color:var(--t2);z-index:1;text-decoration:none}
.navbar .navact{margin-left:auto;z-index:1;font-size:13px;color:var(--brand-500);font-weight:500;text-decoration:none}
.content{padding:12px 16px 96px}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:74px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);
  border-top:.5px solid var(--border);display:flex;padding-bottom:18px}
.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  font-size:10px;color:var(--t3);text-decoration:none;min-height:44px}
.tabbar a.on{color:var(--brand-500);font-weight:600}
.tabbar .ico{font-size:20px;line-height:1}
.card{background:var(--surface);border-radius:var(--r-l);box-shadow:var(--sh-1);padding:16px;margin-bottom:12px}
.sec-h{display:flex;align-items:baseline;justify-content:space-between;margin:18px 2px 10px}
.sec-h .t{font-size:16px;font-weight:700}
.sec-h .more{font-size:12px;color:var(--t3);text-decoration:none}
.btn{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:var(--r-m);
  font-size:15px;font-weight:600;text-decoration:none;border:none;cursor:pointer}
.btn-primary{background:var(--grad-brand);color:#fff;box-shadow:0 4px 12px rgba(59,111,245,.28)}
.btn-ghost{background:var(--brand-50);color:var(--brand-500)}
.btn-plain{background:var(--surface);color:var(--t2);border:1px solid var(--border)}
.btn-danger{background:var(--error-bg);color:var(--error)}
.chip{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:var(--r-full);
  background:var(--fill);color:var(--t2);font-size:12px;text-decoration:none;white-space:nowrap}
.chip.on{background:var(--brand-50);color:var(--brand-500);font-weight:600}
.tag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:var(--r-s);font-size:11px;font-weight:500}
.tag-brand{background:var(--brand-50);color:var(--brand-500)}
.tag-ok{background:var(--success-bg);color:var(--success)}
.tag-bad{background:var(--error-bg);color:var(--error)}
.tag-warn{background:var(--warning-bg);color:var(--warning)}
.tag-info{background:var(--info-bg);color:var(--info)}
.tag-gray{background:var(--fill);color:var(--t3)}
.row{display:flex;align-items:center}
.grow{flex:1;min-width:0}
.num{font-variant-numeric:tabular-nums;font-weight:700}
.empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:48px 0;color:var(--t3);font-size:13px}
.empty .eico{width:72px;height:72px;border-radius:24px;background:var(--fill);display:flex;align-items:center;justify-content:center;font-size:30px}
.bar{height:6px;border-radius:var(--r-full);background:var(--fill);overflow:hidden}
.bar>i{display:block;height:100%;border-radius:var(--r-full);background:var(--grad-brand)}
.dim{position:absolute;inset:0;background:rgba(23,24,28,.45);z-index:10}
.sheet{position:absolute;left:0;right:0;bottom:0;z-index:11;background:var(--surface);
  border-radius:var(--r-xl) var(--r-xl) 0 0;padding:8px 20px calc(20px + 18px);box-shadow:var(--sh-3)}
.sheet .grab{width:36px;height:4px;border-radius:2px;background:var(--border);margin:4px auto 12px}
.sheet .sh-t{font-size:17px;font-weight:700;text-align:center;margin-bottom:14px}
.opt-row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:.5px solid var(--fill);font-size:15px}
.opt-row .oico{width:36px;height:36px;border-radius:var(--r-m);background:var(--brand-50);display:flex;align-items:center;justify-content:center;font-size:17px}
.opt-row .osub{font-size:12px;color:var(--t3)}
.notes{display:none;width:300px;flex:none;padding-top:8px}
@media(min-width:760px){.notes{display:block}}
.note{background:#fff;border:1px solid var(--border);border-left:3px solid var(--brand-500);
  border-radius:var(--r-m);padding:12px 14px;margin-bottom:12px;font-size:12.5px;color:var(--t2)}
.note b{display:block;color:var(--t1);margin-bottom:4px;font-size:13px}
.note.plat{border-left-color:var(--warning)}
.topbar{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--border);
  padding:10px 20px;display:flex;align-items:center;gap:14px;font-size:13px}
.topbar a{color:var(--brand-500);text-decoration:none;font-weight:600}
.topbar .crumb{color:var(--t3)}
@media(max-width:759px){.topbar{display:none}}
"""

def page(title, body, nav=None, tabbar_on=None, notes=None, back=None, navact=None, extra_css="", crumb=""):
    tabs = [("home.html","🏠","刷题"),("book.html","📒","错题本"),("ask.html","💬","AI问答"),("stats.html","📊","统计"),("profile.html","👤","我的")]
    tb = ""
    if tabbar_on:
        items = "".join(
            f'<a href="{h}" class="{"on" if t==tabbar_on else ""}"><span class="ico">{i}</span>{t}</a>'
            for h,i,t in tabs)
        tb = f'<nav class="tabbar">{items}</nav>'
    navbar = ""
    if nav is not None:
        b = f'<a class="back" href="{back}">‹</a>' if back else ""
        a = f'<a class="navact" href="{navact[1]}">{navact[0]}</a>' if navact else ""
        navbar = f'<header class="navbar">{b}<span class="title">{nav}</span>{a}</header>'
    notes_html = ""
    if notes:
        cards = "".join(f'<div class="note{" plat" if k=="plat" else ""}"><b>{t}</b>{d}</div>' for k,t,d in notes)
        notes_html = f'<aside class="notes">{cards}</aside>'
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · 考公助手 design-v3</title>
<style>{CSS}{extra_css}</style></head>
<body>
<div class="topbar"><a href="index.html">← 原型总览</a><span class="crumb">design-v3 / {crumb or title}</span></div>
<div class="stage">
<div class="phone">
  <div class="statusbar"><span>9:41</span><span class="right">●●● ⁝ 100%</span></div>
  {navbar}
  {body}
  {tb}
</div>
{notes_html}
</div>
</body></html>"""

def desktop_page(title, body, extra_css="", crumb=""):
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}（宽屏） · 考公助手 design-v3</title>
<style>{CSS}
body{{background:var(--bg)}}
.dstage{{max-width:1200px;margin:0 auto;padding:24px 28px 64px}}
.dheader{{display:flex;align-items:center;gap:28px;background:#fff;border-bottom:1px solid var(--border);padding:0 28px;height:60px;position:sticky;top:0;z-index:6}}
.dheader .logo{{font-weight:800;font-size:17px;color:var(--brand-500)}}
.dnav{{display:flex;gap:6px}}
.dnav a{{padding:8px 14px;border-radius:var(--r-m);font-size:14px;color:var(--t2);text-decoration:none}}
.dnav a.on{{background:var(--brand-50);color:var(--brand-500);font-weight:600}}
.dnav a:hover{{background:var(--fill)}}
.davatar{{margin-left:auto;width:34px;height:34px;border-radius:50%;background:var(--grad-brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}}
{extra_css}</style></head>
<body>
<div class="topbar"><a href="index.html">← 原型总览</a><span class="crumb">design-v3 / {crumb or title}（≥768px 宽屏稿）</span></div>
<div class="dheader"><span class="logo">📘 考公助手</span>
<nav class="dnav"><a href="home-desktop.html" class="{'on' if '刷题' in title else ''}">刷题</a><a href="book-desktop.html" class="{'on' if '错题' in title else ''}">错题本</a><a href="ask.html">AI 问答</a><a href="stats-desktop.html" class="{'on' if '统计' in title else ''}">统计</a><a href="shenlun.html">申论</a><a href="exam-list.html">模考</a></nav>
<span class="davatar">树</span></div>
<div class="dstage">{body}</div>
</body></html>"""
