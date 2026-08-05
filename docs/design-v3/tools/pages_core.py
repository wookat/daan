# -*- coding: utf-8 -*-
"""核心 4 页：刷题首页 / 练习答题 / 错题本 / 统计（移动 + 宽屏）。"""
from common import page, desktop_page

PAGES = {}

# ---------------------------------------------------------------- 刷题首页
MODS = [("资料分析","var(--mod-ziliao)","📊","32,140 题"),("数量关系","var(--mod-shuliang)","🔢","18,660 题"),
        ("言语理解","var(--mod-yanyu)","💬","41,205 题"),("判断推理","var(--mod-panduan)","🧩","28,930 题"),
        ("常识判断","var(--mod-changshi)","💡","15,872 题")]

home_body = '<div class="content">' + f"""
<div class="hero">
  <div class="row" style="justify-content:space-between;margin-bottom:6px">
    <span style="font-size:13px;color:rgba(255,255,255,.85)">今日已练 <b class="num" style="font-size:18px;color:#fff">32</b>/50 题</span>
    <span class="tag" style="background:rgba(255,255,255,.18);color:#fff">🔥 连续打卡 12 天</span>
  </div>
  <div class="bar" style="background:rgba(255,255,255,.25);margin:8px 0 12px"><i style="width:64%;background:#fff"></i></div>
  <div class="row" style="gap:10px">
    <a class="btn" href="practice.html" style="flex:1;background:#fff;color:var(--brand-500);min-height:40px;font-size:14px">继续目标 ›</a>
    <a class="btn" href="plan.html" style="background:rgba(255,255,255,.16);color:#fff;min-height:40px;padding:0 16px;font-size:14px">今日计划</a>
  </div>
</div>

<div class="card" style="display:flex;align-items:center;gap:12px;padding:13px 16px">
  <span style="width:40px;height:40px;border-radius:var(--r-m);background:var(--warning-bg);display:flex;align-items:center;justify-content:center;font-size:19px">📰</span>
  <div class="grow">
    <div style="font-size:14.5px;font-weight:600">时政每日一练 <span class="tag tag-warn" style="margin-left:4px">10.28 更新</span></div>
    <div style="font-size:12px;color:var(--t3)">10 题 · 今日热点：二十届四中全会公报</div>
  </div>
  <a class="btn btn-ghost" href="daily.html" style="min-height:34px;padding:0 14px;font-size:13px">去练习</a>
</div>

<div class="sec-h"><span class="t">专项练习</span><a class="more" href="plan.html">报考画像 ›</a></div>
""" + "".join(f'''
<a class="card modrow" href="practice.html" style="display:flex;align-items:center;gap:12px;padding:14px 16px">
  <span style="width:44px;height:44px;border-radius:var(--r-m);background:color-mix(in srgb,{c} 10%,white);display:flex;align-items:center;justify-content:center;font-size:20px">{ico}</span>
  <div class="grow">
    <div style="font-size:15px;font-weight:600">{name}</div>
    <div style="font-size:12px;color:var(--t3)">{cnt} · 正确率 {72-i*3}%</div>
  </div>
  <div style="width:64px">
    <div class="bar" style="height:5px"><i style="width:{72-i*3}%;background:{c}"></i></div>
  </div>
  <span style="color:var(--t4)">›</span>
</a>''' for i,(name,c,ico,cnt) in enumerate(MODS)) + """
<div class="sec-h"><span class="t">更多练习</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <a class="card" href="exam-list.html" style="margin:0;text-decoration:none;color:inherit">
    <div style="font-size:22px">📝</div><div style="font-weight:600;margin-top:6px">全真模考</div>
    <div style="font-size:12px;color:var(--t3)">真题卷库 · 成绩报告</div>
  </a>
  <a class="card" href="shenlun.html" style="margin:0;text-decoration:none;color:inherit">
    <div style="font-size:22px">✍️</div><div style="font-weight:600;margin-top:6px">申论专区</div>
    <div style="font-size:12px;color:var(--t3)">真题 + AI 采分点批改</div>
  </a>
  <a class="card" href="book.html" style="margin:0;text-decoration:none;color:inherit">
    <div style="font-size:22px">🔁</div><div style="font-weight:600;margin-top:6px">错题重练</div>
    <div style="font-size:12px;color:var(--t3)">今日待复习 <b style="color:var(--error)">14</b> 题</div>
  </a>
  <a class="card" href="ask.html" style="margin:0;text-decoration:none;color:inherit">
    <div style="font-size:22px">📷</div><div style="font-weight:600;margin-top:6px">拍题讲解</div>
    <div style="font-size:12px;color:var(--t3)">花生十三方法体系</div>
  </a>
</div>
</div>"""

HOME_CSS = """
.hero{background:var(--grad-brand);border-radius:var(--r-l);padding:18px 18px 16px;margin-bottom:12px;color:#fff;box-shadow:0 6px 18px rgba(59,111,245,.3)}
.modrow{text-decoration:none;color:inherit}
"""

PAGES["home.html"] = page("刷题首页", home_body, nav="刷题", tabbar_on="刷题",
  extra_css=HOME_CSS, crumb="01 刷题首页（Tab）",
  notes=[
    ("d","设计要点","顶部渐变 Hero 只放「今日目标进度 + 行动」；学习计划/时政作为次级入口卡片；五模块列表带正确率微型进度条，配置项（每日目标、模式）全部收进练习入口内部，导航层只放行动（对标粉笔理念）。"),
    ("d","与现状差异","现状首页 banner+计划卡+宫格并列层级平；v3 改为 Hero(行动)→时政条→专项列表→2×2 宫格四层，信息密度更低、留白更足；模块色仅用于图标底色，页面主色统一品牌蓝。"),
    ("plat","小程序端","顶部右上胶囊按钮区预留 96px：自定义导航栏时标题左对齐，Hero 顶部 padding+44px；tabBar 用原生 tabBar 保持性能。"),
    ("plat","App 端","状态栏沉浸式：Hero 渐变延伸至状态栏下（safe-area-inset-top）；底部 tabbar padding-bottom 使用 safe-area-inset-bottom。"),
  ])

# ---------------------------------------------------------------- 练习答题页
practice_body = """
<header class="navbar" style="background:var(--bg)">
  <a class="back" href="home.html">‹</a>
  <span class="title">资料分析 · 专项练习</span>
  <a class="navact" href="#" style="display:flex;gap:14px;color:var(--t3);font-size:16px">⭐ Aa ⋯</a>
</header>
<div style="padding:0 16px">
  <div class="row" style="gap:10px;margin:2px 0 10px">
    <span class="tag tag-brand">背题模式</span>
    <span class="tag tag-info">自适应 · 难度 ↑</span>
    <div class="grow"></div>
    <span style="font-size:13px;color:var(--t3)"><b class="num" style="color:var(--t1)">7</b>/10 · 计时 04:12</span>
  </div>
  <div class="bar" style="margin-bottom:12px"><i style="width:70%"></i></div>
</div>
<div class="content" style="padding-top:0">
  <div class="card">
    <div class="row" style="gap:6px;margin-bottom:10px">
      <span class="tag tag-gray">2024 国考</span><span class="tag" style="background:color-mix(in srgb,var(--mod-ziliao) 10%,white);color:var(--mod-ziliao)">截位直除</span><span class="tag tag-gray">同材料 2/4</span>
    </div>
    <p style="font-size:15.5px;line-height:1.7">2023 年全国粮食总产量 69541 万吨，比上年增长 1.3%。其中夏粮产量 14613 万吨，下降 0.8%……2023 年全国粮食总产量约为 2019 年的多少倍？</p>
    <div class="opts">
      <a href="#" class="opt">A　1.02 倍</a>
      <a href="#" class="opt ok">B　1.05 倍 <span style="margin-left:auto;font-size:12px">✓ 正确</span></a>
      <a href="#" class="opt bad">C　1.12 倍 <span style="margin-left:auto;font-size:12px">✕ 我的选择</span></a>
      <a href="#" class="opt">D　1.21 倍</a>
    </div>
  </div>
  <div class="card" style="border:1px solid var(--brand-100);background:linear-gradient(180deg,var(--brand-50),#fff 40%)">
    <div class="row" style="gap:8px;margin-bottom:8px"><span class="tag tag-brand">花生十三 · 截位直除</span><span class="tag tag-gray">用时 38s · 全站正确率 61%</span></div>
    <p style="font-size:14px;color:var(--t2)">基期倍数 = 69541 / (69541÷1.013⁴)。四年复合增速较小，可用截位直除：69541 截为 695，直除 663 ≈ <b>1.05</b>，选 B。</p>
    <div class="row" style="gap:8px;margin-top:12px">
      <a class="btn btn-ghost grow" href="ask.html" style="min-height:38px;font-size:13px">🤖 继续问 AI</a>
      <a class="btn btn-plain grow" href="book-detail.html" style="min-height:38px;font-size:13px">📒 已自动入错题本</a>
    </div>
  </div>
  <div class="card" style="text-align:center">
    <div style="font-size:13px;color:var(--t3);margin-bottom:10px">— 组内结算（每 10 题）预览 —</div>
    <div class="row" style="justify-content:space-around;margin-bottom:12px">
      <div><div class="num" style="font-size:26px;color:var(--success)">8</div><div style="font-size:12px;color:var(--t3)">答对</div></div>
      <div><div class="num" style="font-size:26px;color:var(--error)">2</div><div style="font-size:12px;color:var(--t3)">答错</div></div>
      <div><div class="num" style="font-size:26px">6′48″</div><div style="font-size:12px;color:var(--t3)">用时</div></div>
      <div><div class="num" style="font-size:26px;color:var(--brand-500)">↑</div><div style="font-size:12px;color:var(--t3)">下组难度</div></div>
    </div>
    <div class="row" style="gap:10px">
      <a class="btn btn-plain grow" href="book.html" style="min-height:40px;font-size:14px">复盘错题</a>
      <a class="btn btn-primary grow" href="practice.html" style="min-height:40px;font-size:14px">再来一组 ›</a>
    </div>
  </div>
</div>
<footer style="position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);border-top:.5px solid var(--border);padding:10px 16px 26px;display:flex;gap:10px">
  <a class="btn btn-plain" href="#" style="flex:1">上一题</a>
  <a class="btn btn-plain" href="exam.html" style="width:88px">答题卡</a>
  <a class="btn btn-primary" href="#" style="flex:1">下一题</a>
</footer>"""

PRACTICE_CSS = """
.opts{display:flex;flex-direction:column;gap:10px;margin-top:14px}
.opt{display:flex;align-items:center;min-height:46px;padding:10px 14px;border-radius:var(--r-m);
  border:1px solid var(--border);background:var(--surface);color:var(--t1);font-size:14.5px;text-decoration:none}
.opt.ok{border-color:var(--success);background:var(--success-bg);color:var(--success);font-weight:600}
.opt.bad{border-color:var(--error);background:var(--error-bg);color:var(--error);font-weight:600}
"""

PAGES["practice.html"] = page("练习答题页", practice_body, crumb="02 练习答题页",
  extra_css=PRACTICE_CSS,
  notes=[
    ("d","设计要点","顶栏只留返回/收藏/字号/更多；模式状态（背题、自适应难度）用 chips 常驻可见；解析卡用品牌浅底渐变与题干区分；答完 10 题出现组内结算卡（本稿平铺展示三态：作答后+解析+结算）。"),
    ("d","与现状差异","现状模式切换按钮占顶栏；v3 收进「⋯」更多菜单，符合「配置收进入口内部」；错项/对项用色块+文字双通道（无障碍）；底部操作区固定，热区 ≥44px。"),
    ("plat","背题模式","选项直接标绿显示答案，底部变「上一题 / 下一题」快速翻页，无计时。"),
    ("plat","App/小程序","App 支持左右滑动切题+iOS 边缘手势返回需二次确认防误退；小程序无字号 API 用页内 Aa 控件；退出练习弹确认保存进度。"),
  ])

# ---------------------------------------------------------------- 错题本
book_body = '<div class="content">' + """
<div class="card" style="display:flex;gap:0;padding:14px 0;text-align:center">
  <div class="grow"><div class="num" style="font-size:22px;color:var(--error)">14</div><div style="font-size:12px;color:var(--t3)">今日待复习</div></div>
  <div class="grow" style="border-left:.5px solid var(--fill)"><div class="num" style="font-size:22px">326</div><div style="font-size:12px;color:var(--t3)">全部错题</div></div>
  <div class="grow" style="border-left:.5px solid var(--fill)"><div class="num" style="font-size:22px;color:var(--success)">68%</div><div style="font-size:12px;color:var(--t3)">重练正确率</div></div>
</div>
<a class="btn btn-primary" href="practice.html" style="margin-bottom:14px">开始今日复习（14 题 · 遗忘曲线）</a>
<div class="row" style="gap:8px;overflow-x:auto;margin-bottom:4px">
  <a class="chip on" href="#">全部</a><a class="chip" href="#">资料分析 96</a><a class="chip" href="#">数量 74</a><a class="chip" href="#">言语 68</a><a class="chip" href="#">判断 55</a><a class="chip" href="#">常识 33</a>
</div>
<div class="row" style="gap:8px;margin:8px 0 12px">
  <a class="chip" href="#">错因 ▾</a><a class="chip" href="#">时间 ▾</a><a class="chip" href="#">已掌握 ▾</a>
  <div class="grow"></div><a class="chip" href="pdf-export.html">⤓ 导出 PDF</a>
</div>
""" + "".join(f'''
<a class="card" href="book-detail.html" style="display:block;text-decoration:none;color:inherit;padding:14px 16px">
  <div class="row" style="gap:6px;margin-bottom:8px">
    <span class="tag" style="background:color-mix(in srgb,{c} 10%,white);color:{c}">{mod}</span>
    <span class="tag tag-gray">{kp}</span><span class="tag {rc}">{reason}</span>
    <span style="margin-left:auto;font-size:11px;color:var(--t4)">{when}</span>
  </div>
  <p style="font-size:14px;color:var(--t2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{q}</p>
  <div class="row" style="margin-top:8px;gap:10px;font-size:12px;color:var(--t3)">
    <span>错 {wrong} 次</span><span>·</span><span>{sched}</span>
    <span style="margin-left:auto;color:var(--brand-500);font-weight:500">详情 ›</span>
  </div>
</a>''' for mod,c,kp,reason,rc,when,q,wrong,sched in [
  ("资料分析","var(--mod-ziliao)","截位直除","方法不会","tag-bad","今天","2023 年全国粮食总产量 69541 万吨，比上年增长 1.3%……总产量约为 2019 年的多少倍？",3,"⏰ 今日待复习"),
  ("数量关系","var(--mod-shuliang)","415份数","计算失误","tag-warn","昨天","甲、乙两队合作 15 天完成某工程，甲队单独做 24 天完成，问乙队单独做需要多少天？",2,"3 天后复习"),
  ("判断推理","var(--mod-panduan)","翻译推理","看错题","tag-info","10.25","如果天下雨，那么地面湿。以下哪项与上述推理结构一致？",1,"✓ 已掌握"),
]) + """
<div class="row" style="gap:10px;margin-top:4px">
  <a class="btn btn-plain grow" href="book-entry.html" style="font-size:13px;min-height:40px">✏️ 手动录入</a>
  <a class="btn btn-plain grow" href="book-scan.html" style="font-size:13px;min-height:40px">📷 扫描答题卡</a>
</div>
</div>"""

PAGES["book.html"] = page("错题本", book_body, nav="错题本", tabbar_on="错题本", crumb="03 错题本（Tab）",
  navact=("收藏夹","book.html"),
  notes=[
    ("d","设计要点","顶部三指标概览 + 一键「今日复习」主行动（遗忘曲线调度）；模块 chips 横滑 + 二级筛选（错因/时间/掌握态）；列表卡两行截断，错因用语义色 tag；录入/扫描收在列表尾部次级位。"),
    ("d","与现状差异","现状筛选与录入按钮平铺挤占首屏；v3 主行动唯一化（开始复习），导出 PDF 收进筛选行尾部；卡片信息层级：模块>考点>错因>时间。"),
    ("plat","端差异","小程序扫描答题卡走 wx.chooseMedia；App 走相机权限+安全区；桌面 hover 卡片浮起 shadow-2。"),
  ])

# ---------------------------------------------------------------- 统计
stats_body = '<div class="content">' + """
<div class="row" style="gap:8px;margin-bottom:12px">
  <a class="chip on" href="#">近 7 天</a><a class="chip" href="#">近 30 天</a><a class="chip" href="#">全部</a>
  <div class="grow"></div><a class="chip" href="calendar.html">📅 学习日历</a>
</div>
<div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">本周概览</span><span style="font-size:12px;color:var(--t3)">10.22 – 10.28</span></div>
  <div class="row" style="text-align:center">
    <div class="grow"><div class="num" style="font-size:24px">486</div><div style="font-size:12px;color:var(--t3)">做题量</div></div>
    <div class="grow"><div class="num" style="font-size:24px;color:var(--success)">74%</div><div style="font-size:12px;color:var(--t3)">正确率</div></div>
    <div class="grow"><div class="num" style="font-size:24px">6.2h</div><div style="font-size:12px;color:var(--t3)">学习时长</div></div>
    <div class="grow"><div class="num" style="font-size:24px;color:var(--brand-500)">12</div><div style="font-size:12px;color:var(--t3)">连续打卡</div></div>
  </div>
</div>
<div class="card">
  <div class="sec-h" style="margin:0 0 12px"><span class="t" style="font-size:14px">正确率成长曲线</span><span class="tag tag-ok">↑ 5.2%</span></div>
  <svg viewBox="0 0 320 120" style="width:100%">
    <polyline points="0,90 46,82 92,86 138,70 184,62 230,66 276,48 320,40" fill="none" stroke="var(--brand-500)" stroke-width="2.5" stroke-linecap="round"/>
    <polyline points="0,90 46,82 92,86 138,70 184,62 230,66 276,48 320,40 320,120 0,120" fill="url(#g)" opacity=".35"/>
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B6FF5" stop-opacity=".5"/><stop offset="1" stop-color="#3B6FF5" stop-opacity="0"/></linearGradient></defs>
    <g fill="var(--t4)" font-size="9">
      <text x="0" y="118">10.22</text><text x="150" y="118">10.25</text><text x="296" y="118">10.28</text>
    </g>
  </svg>
</div>
<div class="card">
  <div class="sec-h" style="margin:0 0 12px"><span class="t" style="font-size:14px">薄弱模块</span><a class="more" href="practice.html">去补弱 ›</a></div>
""" + "".join(f'''
  <div class="row" style="gap:10px;margin-bottom:10px">
    <span style="width:64px;font-size:13px;color:var(--t2)">{m}</span>
    <div class="bar grow" style="height:8px"><i style="width:{v}%;background:{c}"></i></div>
    <span class="num" style="width:40px;text-align:right;font-size:13px;color:{'var(--error)' if v<60 else 'var(--t2)'}">{v}%</span>
  </div>''' for m,v,c in [("数量关系",52,"var(--error)"),("常识判断",58,"var(--warning)"),("资料分析",71,"var(--mod-ziliao)"),("判断推理",76,"var(--mod-panduan)"),("言语理解",81,"var(--success)")]) + """
</div>
<div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">薄弱考点 Top5</span></div>
  <div class="row" style="flex-wrap:wrap;gap:8px">
    <span class="chip" style="background:var(--error-bg);color:var(--error)">牛吃草 42%</span>
    <span class="chip" style="background:var(--error-bg);color:var(--error)">工程问题 48%</span>
    <span class="chip" style="background:var(--warning-bg);color:var(--warning)">混合增长率 55%</span>
    <span class="chip" style="background:var(--warning-bg);color:var(--warning)">类比-语义 58%</span>
    <span class="chip">主旨概括 63%</span>
  </div>
  <a class="btn btn-ghost" href="practice.html" style="margin-top:12px;min-height:40px;font-size:14px">薄弱点定向重练 ›</a>
</div>
</div>"""

PAGES["stats.html"] = page("统计", stats_body, nav="统计", tabbar_on="统计", crumb="04 统计（Tab）",
  notes=[
    ("d","设计要点","时间范围 chips 置顶统一控制全部卡片；四指标概览→成长曲线→薄弱模块条形→薄弱考点 chips，每张卡都挂行动出口（去补弱/定向重练），统计不止展示、直接导流练习。"),
    ("d","与现状差异","现状图表混用色；v3 曲线统一品牌蓝渐变面积图，模块条形用模块色、<60% 红色告警；日历收为右上入口。"),
    ("plat","桌面端","≥768px 双栏：左曲线+概览、右薄弱模块+考点；图表 hover 显示 tooltip 数值。"),
  ])

# ---------------------------------------------------------------- 宽屏 4 页
PAGES["home-desktop.html"] = desktop_page("刷题首页", f"""
<div style="display:grid;grid-template-columns:2fr 1fr;gap:20px">
 <div>
  <div style="background:var(--grad-brand);border-radius:var(--r-xl);padding:28px;color:#fff;margin-bottom:20px;display:flex;align-items:center;gap:32px">
    <div class="grow"><div style="font-size:15px;opacity:.9">今日已练 <b class="num" style="font-size:26px">32</b>/50 题 · 连续打卡 12 天</div>
    <div class="bar" style="background:rgba(255,255,255,.25);margin-top:12px;max-width:420px"><i style="width:64%;background:#fff"></i></div></div>
    <a class="btn" href="practice.html" style="background:#fff;color:var(--brand-500);padding:0 28px">继续目标 ›</a>
  </div>
  <div class="sec-h"><span class="t">专项练习</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">""" +
  "".join(f'''<a class="card" href="practice.html" style="margin:0;text-decoration:none;color:inherit">
    <span style="width:44px;height:44px;border-radius:var(--r-m);background:color-mix(in srgb,{c} 10%,white);display:flex;align-items:center;justify-content:center;font-size:20px">{ico}</span>
    <div style="font-weight:600;margin-top:10px">{name}</div>
    <div style="font-size:12px;color:var(--t3);margin:4px 0 8px">{cnt} · 正确率 {72-i*3}%</div>
    <div class="bar" style="height:5px"><i style="width:{72-i*3}%;background:{c}"></i></div></a>''' for i,(name,c,ico,cnt) in enumerate(MODS)) +
  """<a class="card" href="exam-list.html" style="margin:0;text-decoration:none;color:inherit;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1.5px dashed var(--border);box-shadow:none;background:transparent"><span style="font-size:22px">📝</span><span style="font-weight:600;margin-top:6px;color:var(--t2)">全真模考 ›</span></a>
  </div>
 </div>
 <aside>
  <div class="card"><div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">今日计划</span><a class="more" href="plan.html">编辑</a></div>
   <div class="opt-row" style="border:none;padding:8px 0"><span style="color:var(--success)">✓</span><span class="grow" style="color:var(--t4);text-decoration:line-through">专项练习 · 资料分析 20 题</span></div>
   <div class="opt-row" style="border:none;padding:8px 0"><span style="color:var(--t4)">○</span><span class="grow">错题复习 14 题</span></div>
   <div class="opt-row" style="border:none;padding:8px 0"><span style="color:var(--t4)">○</span><span class="grow">时政每日一练 10 题</span></div>
  </div>
  <div class="card"><div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">时政每日一练</span><span class="tag tag-warn">10.28</span></div>
   <p style="font-size:13px;color:var(--t3)">今日热点：二十届四中全会公报 · 10 题</p>
   <a class="btn btn-ghost" href="daily.html" style="margin-top:10px;min-height:38px;font-size:13px">去练习 ›</a></div>
  <div class="card"><div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">错题复习</span></div>
   <p style="font-size:13px;color:var(--t3)">今日待复习 <b style="color:var(--error)">14</b> 题（遗忘曲线）</p>
   <a class="btn btn-primary" href="book-desktop.html" style="margin-top:10px;min-height:38px;font-size:13px">开始复习</a></div>
 </aside>
</div>""", crumb="01D 刷题首页 · 宽屏")

PAGES["practice-desktop.html"] = desktop_page("练习答题（宽屏）", """
<div style="display:grid;grid-template-columns:1fr 300px;gap:20px">
 <div>
  <div class="row" style="gap:10px;margin-bottom:12px">
    <a class="btn btn-plain" href="home-desktop.html" style="min-height:36px;padding:0 14px;font-size:13px">‹ 退出练习</a>
    <span class="tag tag-brand">自适应 · 难度 ↑</span>
    <div class="grow"></div><span style="font-size:13px;color:var(--t3)">7/10 · 计时 04:12</span>
  </div>
  <div class="card" style="padding:24px">
    <div class="row" style="gap:6px;margin-bottom:12px"><span class="tag tag-gray">2024 国考</span><span class="tag" style="background:#e6f4f2;color:var(--mod-ziliao)">截位直除</span></div>
    <p style="font-size:16px;line-height:1.8">2023 年全国粮食总产量 69541 万吨，比上年增长 1.3%……2023 年全国粮食总产量约为 2019 年的多少倍？</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px">
      <a href="#" style="display:flex;align-items:center;min-height:48px;padding:0 16px;border:1px solid var(--border);border-radius:var(--r-m);text-decoration:none;color:var(--t1)">A　1.02 倍</a>
      <a href="#" style="display:flex;align-items:center;min-height:48px;padding:0 16px;border:1px solid var(--success);background:var(--success-bg);border-radius:var(--r-m);text-decoration:none;color:var(--success);font-weight:600">B　1.05 倍 ✓</a>
      <a href="#" style="display:flex;align-items:center;min-height:48px;padding:0 16px;border:1px solid var(--error);background:var(--error-bg);border-radius:var(--r-m);text-decoration:none;color:var(--error);font-weight:600">C　1.12 倍 ✕</a>
      <a href="#" style="display:flex;align-items:center;min-height:48px;padding:0 16px;border:1px solid var(--border);border-radius:var(--r-m);text-decoration:none;color:var(--t1)">D　1.21 倍</a>
    </div>
    <div style="margin-top:18px;border:1px solid var(--brand-100);border-radius:var(--r-m);background:linear-gradient(180deg,var(--brand-50),#fff 45%);padding:16px">
      <span class="tag tag-brand">花生十三 · 截位直除</span>
      <p style="font-size:14px;color:var(--t2);margin-top:8px">基期倍数 = 69541 / (69541÷1.013⁴)，截位直除 695÷663 ≈ <b>1.05</b>，选 B。</p>
    </div>
    <div class="row" style="gap:12px;margin-top:18px">
      <a class="btn btn-plain" href="#" style="flex:1">上一题（←）</a>
      <a class="btn btn-primary" href="#" style="flex:1">下一题（→ / 空格）</a>
    </div>
  </div>
 </div>
 <aside>
  <div class="card"><div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">答题卡</span></div>
   <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">""" +
  "".join(f'<span style="height:34px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-s);font-size:13px;{s}">{n}</span>'
    for n,s in [(1,'background:var(--success-bg);color:var(--success)'),(2,'background:var(--success-bg);color:var(--success)'),(3,'background:var(--error-bg);color:var(--error)'),(4,'background:var(--success-bg);color:var(--success)'),(5,'background:var(--success-bg);color:var(--success)'),(6,'background:var(--error-bg);color:var(--error)'),(7,'border:1.5px solid var(--brand-500);color:var(--brand-500);font-weight:700'),(8,'background:var(--fill);color:var(--t4)'),(9,'background:var(--fill);color:var(--t4)'),(10,'background:var(--fill);color:var(--t4)')]) +
  """</div></div>
  <div class="card"><div class="sec-h" style="margin:0 0 8px"><span class="t" style="font-size:14px">快捷键</span></div>
   <p style="font-size:12.5px;color:var(--t3);line-height:2">A/B/C/D 选择答案<br>← / → 上一题 / 下一题<br>S 收藏 · E 查看解析</p></div>
 </aside>
</div>""", crumb="02D 练习答题 · 宽屏")

PAGES["book-desktop.html"] = desktop_page("错题本（宽屏）", """
<div style="display:grid;grid-template-columns:240px 1fr;gap:20px">
 <aside>
  <div class="card" style="padding:12px">
   <a class="btn btn-primary" href="practice-desktop.html" style="min-height:40px;font-size:13.5px;margin-bottom:12px">开始今日复习（14）</a>
   """ + "".join(f'<a href="#" style="display:flex;justify-content:space-between;padding:9px 10px;border-radius:var(--r-s);font-size:13.5px;text-decoration:none;color:{"var(--brand-500)" if i==0 else "var(--t2)"};{"background:var(--brand-50);font-weight:600" if i==0 else ""}"><span>{m}</span><span style="color:var(--t4)">{n}</span></a>' for i,(m,n) in enumerate([("全部错题",326),("资料分析",96),("数量关系",74),("言语理解",68),("判断推理",55),("常识判断",33)])) + """
   <div style="border-top:.5px solid var(--fill);margin:8px 0"></div>
   <a href="book-entry.html" style="display:block;padding:9px 10px;font-size:13px;color:var(--t3);text-decoration:none">✏️ 手动录入</a>
   <a href="book-scan.html" style="display:block;padding:9px 10px;font-size:13px;color:var(--t3);text-decoration:none">📷 扫描答题卡</a>
   <a href="pdf-export.html" style="display:block;padding:9px 10px;font-size:13px;color:var(--t3);text-decoration:none">⤓ 导出 PDF</a>
  </div>
 </aside>
 <div>
  <div class="row" style="gap:8px;margin-bottom:14px">
    <a class="chip on" href="#">全部错因</a><a class="chip" href="#">方法不会 128</a><a class="chip" href="#">计算失误 92</a><a class="chip" href="#">看错题 64</a><a class="chip" href="#">陷阱 42</a>
    <div class="grow"></div><a class="chip" href="#">最近错 ▾</a>
  </div>""" + "".join(f'''
  <a class="card" href="book-detail.html" style="display:block;text-decoration:none;color:inherit">
    <div class="row" style="gap:6px;margin-bottom:8px"><span class="tag" style="background:color-mix(in srgb,{c} 10%,white);color:{c}">{mod}</span><span class="tag tag-gray">{kp}</span><span class="tag {rc}">{r}</span><span style="margin-left:auto;font-size:12px;color:var(--t4)">{when} · 错 {w} 次</span></div>
    <p style="font-size:14px;color:var(--t2)">{q}</p></a>''' for mod,c,kp,r,rc,when,q,w in [
      ("资料分析","var(--mod-ziliao)","截位直除","方法不会","tag-bad","今天","2023 年全国粮食总产量 69541 万吨，比上年增长 1.3%……总产量约为 2019 年的多少倍？",3),
      ("数量关系","var(--mod-shuliang)","415份数","计算失误","tag-warn","昨天","甲、乙两队合作 15 天完成某工程，甲队单独做 24 天完成，问乙队单独做需要多少天？",2),
      ("判断推理","var(--mod-panduan)","翻译推理","看错题","tag-info","10.25","如果天下雨，那么地面湿。以下哪项与上述推理结构一致？",1)]) + """
 </div>
</div>""", crumb="03D 错题本 · 宽屏")

PAGES["stats-desktop.html"] = desktop_page("统计（宽屏）", """
<div class="row" style="gap:8px;margin-bottom:16px">
  <a class="chip on" href="#">近 7 天</a><a class="chip" href="#">近 30 天</a><a class="chip" href="#">全部</a>
  <div class="grow"></div><a class="chip" href="calendar.html">📅 学习日历</a>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px">""" +
  "".join(f'<div class="card" style="margin:0;text-align:center"><div class="num" style="font-size:28px;color:{c}">{v}</div><div style="font-size:12.5px;color:var(--t3);margin-top:4px">{t}</div></div>'
    for v,t,c in [("486","做题量","var(--t1)"),("74%","正确率","var(--success)"),("6.2h","学习时长","var(--t1)"),("12 天","连续打卡","var(--brand-500)")]) + """
</div>
<div style="display:grid;grid-template-columns:3fr 2fr;gap:20px">
 <div class="card"><div class="sec-h" style="margin:0 0 12px"><span class="t" style="font-size:15px">正确率成长曲线</span><span class="tag tag-ok">↑ 5.2%</span></div>
  <svg viewBox="0 0 560 200" style="width:100%">
   <polyline points="0,150 80,138 160,144 240,116 320,102 400,110 480,80 560,66" fill="none" stroke="var(--brand-500)" stroke-width="3" stroke-linecap="round"/>
   <polyline points="0,150 80,138 160,144 240,116 320,102 400,110 480,80 560,66 560,200 0,200" fill="url(#g2)" opacity=".35"/>
   <defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B6FF5" stop-opacity=".5"/><stop offset="1" stop-color="#3B6FF5" stop-opacity="0"/></linearGradient></defs>
  </svg></div>
 <div class="card"><div class="sec-h" style="margin:0 0 12px"><span class="t" style="font-size:15px">薄弱模块</span><a class="more" href="practice-desktop.html">去补弱 ›</a></div>""" +
  "".join(f'''<div class="row" style="gap:10px;margin-bottom:12px"><span style="width:64px;font-size:13px;color:var(--t2)">{m}</span>
   <div class="bar grow" style="height:8px"><i style="width:{v}%;background:{c}"></i></div>
   <span class="num" style="width:40px;text-align:right;font-size:13px">{v}%</span></div>''' for m,v,c in [("数量关系",52,"var(--error)"),("常识判断",58,"var(--warning)"),("资料分析",71,"var(--mod-ziliao)"),("判断推理",76,"var(--mod-panduan)"),("言语理解",81,"var(--success)")]) + """
  <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:6px">
   <span class="chip" style="background:var(--error-bg);color:var(--error)">牛吃草 42%</span>
   <span class="chip" style="background:var(--error-bg);color:var(--error)">工程问题 48%</span>
   <span class="chip" style="background:var(--warning-bg);color:var(--warning)">混合增长率 55%</span>
  </div>
 </div>
</div>""", crumb="04D 统计 · 宽屏")
