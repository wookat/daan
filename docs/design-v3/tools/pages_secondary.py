# -*- coding: utf-8 -*-
"""次级页面原型（部分线框级）。"""
from common import page

PAGES = {}

# -------- 错题详情
PAGES["book-detail.html"] = page("错题详情", """
<div class="content">
 <div class="card">
  <div class="row" style="gap:6px;margin-bottom:10px">
    <span class="tag" style="background:#e6f4f2;color:var(--mod-ziliao)">资料分析</span>
    <span class="tag tag-gray">截位直除</span><span class="tag tag-bad">方法不会</span>
    <span style="margin-left:auto;font-size:11px;color:var(--t4)">错 3 次</span>
  </div>
  <p style="font-size:15px;line-height:1.7">2023 年全国粮食总产量 69541 万吨，比上年增长 1.3%……2023 年全国粮食总产量约为 2019 年的多少倍？</p>
  <div class="row" style="gap:8px;margin-top:12px;font-size:13px">
    <span class="tag tag-ok">正确 B</span><span class="tag tag-bad">我选 C</span>
  </div>
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">历次作答</span></div>
  """ + "".join(f'''<div class="row" style="gap:10px;padding:9px 0;border-bottom:.5px solid var(--fill);font-size:13px">
    <span class="tag {'tag-bad' if not ok else 'tag-ok'}">{'✕ 错' if not ok else '✓ 对'}</span>
    <span style="color:var(--t2)">选 {sel}</span><span style="color:var(--t4)">· 用时 {t}</span>
    <span style="margin-left:auto;color:var(--t4)">{d}</span></div>''' for ok,sel,t,d in [(False,"C","62s","10.28 今日复习"),(False,"C","55s","10.21 专项练习"),(False,"A","71s","10.14 模考")]) + """
 </div>
 <div class="card" style="border:1px solid var(--brand-100);background:linear-gradient(180deg,var(--brand-50),#fff 40%)">
  <div class="sec-h" style="margin:0 0 8px"><span class="t" style="font-size:14px">🤖 AI 错因分析</span><span class="tag tag-brand">花生十三</span></div>
  <p style="font-size:14px;color:var(--t2)">三次均在基期倍数计算上失误：未先转化为「现期/基期」结构。建议重学「截位直除」第 2 节，先做 5 道同考点简单题建立手感。</p>
  <div class="row" style="gap:8px;margin-top:12px">
   <a class="btn btn-ghost grow" href="practice.html" style="min-height:38px;font-size:13px">同考点重练 5 题</a>
   <a class="btn btn-plain grow" href="ask.html" style="min-height:38px;font-size:13px">继续问 AI</a>
  </div>
 </div>
 <div class="row" style="gap:10px">
  <a class="btn btn-plain grow" href="pdf-export.html" style="font-size:13px;min-height:40px">⤓ 导出本题</a>
  <a class="btn btn-danger grow" href="book.html" style="font-size:13px;min-height:40px">标记已掌握</a>
 </div>
</div>""", nav="错题详情", back="book.html", crumb="05 错题详情",
 notes=[("d","设计要点","题干卡→历次作答时间线→AI 错因分析卡（品牌浅底）→行动区；「标记已掌握」放危险色防误触；每卡都有出口（重练/问 AI/导出）。"),
        ("d","与现状差异","历次作答由折叠列表改为紧凑时间线；AI 分析与解析分离，突出错因结论而非复述解析。")])

# -------- 手动录入
PAGES["book-entry.html"] = page("手动录入", """
<div class="content">
 <div class="card">
  <label style="font-size:13px;color:var(--t3)">题干（必填）</label>
  <div style="border:1px solid var(--border);border-radius:var(--r-m);min-height:96px;padding:10px 12px;margin:6px 0 14px;font-size:14px;color:var(--t4)">粘贴或输入题干文字…</div>
  <label style="font-size:13px;color:var(--t3)">选项</label>
  """ + "".join(f'<div class="row" style="gap:8px;margin:6px 0"><span style="width:26px;height:26px;border-radius:50%;background:var(--fill);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600">{o}</span><div class="grow" style="border:1px solid var(--border);border-radius:var(--r-s);height:38px;padding:8px 12px;font-size:13px;color:var(--t4)">{ph}</div></div>' for o,ph in [("A","选项 A"),("B","选项 B"),("C","选项 C"),("D","选项 D")]) + """
  <div class="row" style="gap:8px;margin-top:12px">
   <span style="font-size:13px;color:var(--t3)">正确答案</span>
   <a class="chip" href="#">A</a><a class="chip on" href="#">B</a><a class="chip" href="#">C</a><a class="chip" href="#">D</a>
  </div>
  <div class="row" style="gap:8px;margin-top:12px">
   <span style="font-size:13px;color:var(--t3)">我的错因</span>
   <a class="chip on" href="#">方法不会</a><a class="chip" href="#">看错题</a><a class="chip" href="#">计算失误</a><a class="chip" href="#">陷阱</a>
  </div>
 </div>
 <div class="card" style="display:flex;align-items:center;gap:12px">
  <span style="width:40px;height:40px;border-radius:var(--r-m);background:var(--brand-50);display:flex;align-items:center;justify-content:center;font-size:18px">📷</span>
  <div class="grow"><div style="font-size:14px;font-weight:600">拍照识题更快</div><div style="font-size:12px;color:var(--t3)">AI 自动识别题干与选项，免手打</div></div>
  <a class="btn btn-ghost" href="ask.html" style="min-height:34px;padding:0 14px;font-size:13px">去拍题</a>
 </div>
 <a class="btn btn-primary" href="book.html">保存到错题本</a>
</div>""", nav="手动录入", back="book.html", crumb="06 手动录入",
 notes=[("d","设计要点","单卡表单，模块/考点由 AI 自动判定（保存后可改）；顶部保留拍题捷径导流，减少手打成本。")])

# -------- 扫描答题卡
PAGES["book-scan.html"] = page("扫描答题卡", """
<div class="content">
 <div class="card" style="text-align:center;padding:28px 16px">
  <div style="width:180px;height:240px;margin:0 auto;border:2px dashed var(--brand-300);border-radius:var(--r-l);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:var(--brand-50)">
   <span style="font-size:34px">📷</span>
   <span style="font-size:13px;color:var(--brand-500);font-weight:600">对准答题卡拍摄</span>
   <span style="font-size:11px;color:var(--t3)">自动识别涂卡 · 支持相册导入</span>
  </div>
  <div class="row" style="gap:10px;margin-top:18px">
   <a class="btn btn-plain grow" href="#" style="min-height:42px;font-size:14px">从相册选择</a>
   <a class="btn btn-primary grow" href="#" style="min-height:42px;font-size:14px">拍摄</a>
  </div>
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">识别结果（示例）</span><span class="tag tag-ok">已识别 30/30</span></div>
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">
  """ + "".join(f'<span style="height:32px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-s);font-size:12px;{s}">{i+1} {a}</span>' for i,(a,s) in enumerate([("B","background:var(--success-bg);color:var(--success)"),("C","background:var(--success-bg);color:var(--success)"),("A","background:var(--error-bg);color:var(--error)"),("D","background:var(--success-bg);color:var(--success)"),("B","background:var(--success-bg);color:var(--success)"),("?","background:var(--warning-bg);color:var(--warning)")]*3)) + """
  </div>
  <p style="font-size:12px;color:var(--t3);margin-top:10px">黄色为置信度低项，点击可手动修正；确认后错题自动入本。</p>
  <a class="btn btn-primary" href="book.html" style="margin-top:12px">确认并导入错题（8 题）</a>
 </div>
</div>""", nav="扫描答题卡", back="book.html", crumb="07 扫描答题卡",
 notes=[("plat","端差异","小程序：wx.chooseMedia + canvas 识别；App：原生相机+连续拍摄；H5 桌面：拖拽上传图片。")])

# -------- AI 问答 / 拍题讲解
PAGES["ask.html"] = page("AI 问答 · 拍题讲解", """
<div class="content" style="display:flex;flex-direction:column;min-height:600px">
 <div style="flex:1">
  <div class="msg me">这道题为什么选 B？（附题目截图）</div>
  <div class="msg me"><div style="width:150px;height:90px;border-radius:var(--r-s);background:var(--fill);display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:12px">🖼 题目截图</div></div>
  <div class="msg ai">
   <div class="row" style="gap:6px;margin-bottom:6px"><span class="tag tag-brand">资料分析 · 截位直除</span></div>
   识别到基期倍数问题。按花生十三方法：<br>① 列式：现期 ÷ 基期 = 69541 ÷ (69541÷1.013⁴)<br>② 截位：695 ÷ 663<br>③ 直除首两位 ≈ <b>1.05</b> → 选 B<br>
   <span style="font-size:12px;color:var(--t3)">易错点：勿把「比上年增长」当四年累计增速。</span>
  </div>
  <div class="row" style="gap:8px;margin:4px 0 0 0;flex-wrap:wrap">
   <a class="chip" href="#">再讲细一点</a><a class="chip" href="#">出一道同款题</a><a class="chip" href="book.html">存入错题本</a>
  </div>
 </div>
 <div style="margin-top:16px">
  <div class="row" style="gap:10px;margin-bottom:10px">
   <a class="btn btn-ghost grow" href="#" style="min-height:44px;font-size:14px">📷 拍题 / 相册</a>
   <a class="btn btn-plain grow" href="#" style="min-height:44px;font-size:14px">📋 粘贴文字</a>
  </div>
  <div class="row" style="gap:8px;background:#fff;border:1px solid var(--border);border-radius:var(--r-full);padding:6px 6px 6px 16px">
   <span class="grow" style="font-size:14px;color:var(--t4)">继续追问这道题…</span>
   <span style="width:36px;height:36px;border-radius:50%;background:var(--grad-brand);display:flex;align-items:center;justify-content:center;color:#fff">↑</span>
  </div>
 </div>
</div>""", nav="AI 问答", tabbar_on="AI问答", crumb="08 AI 问答 / 拍题讲解",
 extra_css="""
.msg{max-width:82%;border-radius:var(--r-l);padding:10px 14px;font-size:14px;margin-bottom:10px}
.msg.me{margin-left:auto;background:var(--brand-500);color:#fff;border-bottom-right-radius:4px}
.msg.ai{background:#fff;box-shadow:var(--sh-1);border-bottom-left-radius:4px;line-height:1.7}
""",
 notes=[("d","设计要点","会话式重构：空态两个大按钮（拍题/粘贴），有会话后沉底为输入区；AI 回答自动挂「模块·方法」tag，回答下给追问 chips（再讲细/出同款/入错题本），把讲解转化为练习闭环。"),
        ("d","与现状差异","现状为工具页（上传→结果单次流程）；v3 升级为可追问的会话流，历史讲解可回看。"),
        ("plat","端差异","小程序相机 wx.chooseMedia；App 支持系统分享图片进入；桌面支持 Ctrl+V 直接粘贴截图。")])

# -------- 申论 ×3
PAGES["shenlun.html"] = page("申论专区", """
<div class="content">
 <div class="row" style="gap:8px;margin-bottom:12px">
  <a class="chip on" href="#">真题题库</a><a class="chip" href="#">素材 / 范文</a><a class="chip" href="#">作答记录</a>
 </div>
 <div class="row" style="gap:8px;margin-bottom:12px">
  <a class="chip" href="#">地区 ▾</a><a class="chip" href="#">年份 ▾</a><a class="chip" href="#">题型 ▾</a>
  <div class="grow"></div><a class="chip" href="#">重置</a>
 </div>
 """ + "".join(f'''<a class="card" href="shenlun-detail.html" style="display:block;text-decoration:none;color:inherit">
  <div class="row" style="gap:6px;margin-bottom:8px"><span class="tag tag-brand">{tp}</span><span class="tag tag-gray">{yr}</span>{extra}</div>
  <p style="font-size:14.5px;font-weight:600;line-height:1.6">{t}</p>
  <div class="row" style="margin-top:8px;font-size:12px;color:var(--t3)"><span>{meta}</span><span style="margin-left:auto;color:var(--brand-500);font-weight:500">去作答 ›</span></div>
 </a>''' for tp,yr,extra,t,meta in [
   ("概括归纳","2024 国考·副省级","<span class='tag tag-ok'>已作答 2 次 · 最高 21/25</span>","根据「给定资料 1」，概括 S 市在推进基层治理创新中的主要做法。","字数 ≤300 · 建议 25 分钟"),
   ("提出对策","2024 联考","","「给定资料 3」反映了社区养老服务存在的问题，请提出改进建议。","字数 ≤400 · 建议 30 分钟"),
   ("大作文","2023 国考·地市级","","参考给定资料，以「流动与新生」为题，写一篇文章。","1000–1200 字 · 建议 60 分钟")]) + """
</div>""", nav="申论专区", back="home.html", crumb="09 申论 · 题库",
 notes=[("d","设计要点","三 Tab（题库/素材/记录）+ 筛选 chips；卡片直接露出「已作答·最高分」，形成再战动机。")])

PAGES["shenlun-detail.html"] = page("申论作答", """
<div class="content">
 <div class="card">
  <div class="row" style="gap:6px;margin-bottom:8px"><span class="tag tag-brand">概括归纳</span><span class="tag tag-gray">2024 国考·副省级</span></div>
  <p style="font-size:15px;font-weight:600">根据「给定资料 1」，概括 S 市在推进基层治理创新中的主要做法。</p>
  <p style="font-size:12.5px;color:var(--t3);margin-top:6px">要求：全面、准确、有条理，不超过 300 字。</p>
  <a href="#" style="display:inline-block;margin-top:8px;font-size:13px;color:var(--brand-500);text-decoration:none">📄 查看给定资料（3 篇） ›</a>
 </div>
 <div class="card">
  <div class="row" style="margin-bottom:8px"><span style="font-size:13px;color:var(--t3)">我的作答</span><span style="margin-left:auto;font-size:12px;color:var(--t4)">已自动保存 · 186/300 字</span></div>
  <p style="font-size:14px;line-height:1.8;color:var(--t2)">S 市基层治理创新做法主要有：一是搭建「网格化+数字化」治理平台，整合 12345 热线与网格员上报……二是推行「居民议事厅」协商机制……<span style="border-left:2px solid var(--brand-500);margin-left:2px"></span></p>
 </div>
 <div class="row" style="gap:10px">
  <a class="btn btn-plain grow" href="shenlun.html">存草稿退出</a>
  <a class="btn btn-primary grow" href="shenlun-review.html">提交 AI 批改</a>
 </div>
</div>""", nav="申论作答", back="shenlun.html", navact=("历史 3","shenlun-review.html"), crumb="10 申论 · 作答",
 notes=[("d","设计要点","题干+要求置顶，给定资料抽屉式展开不打断书写；作答区自动保存+实时字数；主行动唯一（提交批改）。"),
        ("plat","端差异","小程序 textarea 原生键盘避让；桌面双栏（左资料右作答）。")])

PAGES["shenlun-review.html"] = page("AI 批改报告", """
<div class="content">
 <div class="card" style="text-align:center;background:var(--grad-brand);color:#fff;box-shadow:0 6px 18px rgba(59,111,245,.3)">
  <div style="font-size:13px;opacity:.85">AI 采分点批改 · 概括归纳</div>
  <div class="num" style="font-size:44px;margin:4px 0">21<span style="font-size:18px;opacity:.8">/25</span></div>
  <div style="font-size:12px;opacity:.85">超过 78% 的作答 · 第 2 次作答 ↑3 分</div>
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">采分点命中 6/8</span></div>
  """ + "".join(f'''<div class="row" style="gap:8px;padding:8px 0;border-bottom:.5px solid var(--fill);font-size:13.5px">
   <span class="tag {'tag-ok' if hit else 'tag-bad'}">{'✓' if hit else '漏'}</span><span class="grow" style="color:{'var(--t2)' if hit else 'var(--error)'}">{t}</span><span style="color:var(--t4)">{s}</span></div>''' for hit,t,s in [
    (True,"网格化+数字化平台整合诉求渠道","3/3"),(True,"居民议事厅协商机制","3/3"),(True,"社会组织孵化与购买服务","3/3"),
    (False,"党建引领·包联制度（资料 1 第 4 段）","0/3"),(False,"治理成效数据佐证","0/2")]) + """
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 8px"><span class="t" style="font-size:14px">逐句点评（节选）</span></div>
  <p style="font-size:13.5px;line-height:1.9;color:var(--t2)">S 市基层治理创新做法主要有：<mark style="background:var(--success-bg);color:var(--success)">一是搭建「网格化+数字化」治理平台…（命中采分点①）</mark>二是推行<mark style="background:var(--warning-bg);color:var(--warning)">「居民议事厅」协商机制（表述可再精炼）</mark>……</p>
 </div>
 <div class="row" style="gap:10px">
  <a class="btn btn-plain grow" href="shenlun-detail.html">修改再交</a>
  <a class="btn btn-primary grow" href="shenlun.html">下一题 ›</a>
 </div>
</div>""", nav="批改报告", back="shenlun-detail.html", crumb="11 申论 · AI 批改",
 notes=[("d","设计要点","得分 Hero（对比历史↑）→采分点清单（命中/漏点红绿）→原文逐句高亮点评；漏点标注资料出处，可回看。")])

# -------- 模考 ×3
PAGES["exam-list.html"] = page("真题卷库", """
<div class="content">
 <div class="card" style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#FFF7ED,#FFFBEB)">
  <span style="font-size:26px">⚡</span>
  <div class="grow"><div style="font-size:15px;font-weight:700">迷你模考</div><div style="font-size:12px;color:var(--t3)">30 题 · 30 分钟 · 随机组卷，即刻开考</div></div>
  <a class="btn btn-primary" href="exam.html" style="min-height:38px;padding:0 18px;font-size:14px">开始</a>
 </div>
 <div class="row" style="gap:8px;margin:14px 0 12px">
  <a class="chip on" href="#">全部地区</a><a class="chip" href="#">国考</a><a class="chip" href="#">省考联考</a><a class="chip" href="#">全部年份 ▾</a>
  <div class="grow"></div><a class="chip" href="exam-report.html">历史成绩</a>
 </div>
 """ + "".join(f'''<a class="card" href="exam.html" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit">
  <span style="width:44px;height:44px;border-radius:var(--r-m);background:var(--brand-50);display:flex;align-items:center;justify-content:center;font-size:18px">📝</span>
  <div class="grow"><div style="font-size:14.5px;font-weight:600">{t}</div>
  <div style="font-size:12px;color:var(--t3)">{meta}</div></div>{badge}
 </a>''' for t,meta,badge in [
  ("2024 国考行测（副省级）","135 题 · 120 分钟 · 3.2 万人考过",'<span class="tag tag-ok">最高 68.5</span>'),
  ("2024 多省联考行测","120 题 · 120 分钟 · 2.8 万人考过",'<span style="color:var(--t4)">›</span>'),
  ("2023 国考行测（地市级）","130 题 · 120 分钟 · 4.1 万人考过",'<span style="color:var(--t4)">›</span>')]) + """
</div>""", nav="真题卷库", back="home.html", crumb="12 模考 · 卷库",
 notes=[("d","设计要点","迷你模考置顶（低门槛高频行动）；真题卷带社会证明（x 万人考过）与个人最高分。")])

PAGES["exam.html"] = page("全真模考", """
<header class="navbar" style="background:var(--bg)">
  <a class="back" href="exam-list.html">‹</a>
  <span class="title" style="color:var(--error);font-variant-numeric:tabular-nums">⏱ 91:24</span>
  <a class="navact" href="#" style="color:var(--t3)">⋯</a>
</header>
<div style="padding:0 16px"><div class="row" style="gap:10px;margin-bottom:10px">
  <span class="tag tag-brand">言语理解 21–40</span>
  <div class="grow"></div><span style="font-size:13px;color:var(--t3)"><b class="num" style="color:var(--t1)">36</b>/135</span>
</div><div class="bar" style="margin-bottom:12px"><i style="width:27%"></i></div></div>
<div class="content" style="padding-top:0">
 <div class="card">
  <p style="font-size:15.5px;line-height:1.75">36. 依次填入画横线部分最恰当的一项是：<br>传统村落是农耕文明的____，承载着乡愁记忆；保护不能____，要见人见物见生活。</p>
  <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
   <a href="#" style="display:flex;align-items:center;min-height:46px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--r-m);text-decoration:none;color:var(--t1);font-size:14.5px">A　活化石　因噎废食</a>
   <a href="#" style="display:flex;align-items:center;min-height:46px;padding:10px 14px;border:1.5px solid var(--brand-500);background:var(--brand-50);border-radius:var(--r-m);text-decoration:none;color:var(--brand-500);font-weight:600;font-size:14.5px">B　活标本　大拆大建</a>
   <a href="#" style="display:flex;align-items:center;min-height:46px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--r-m);text-decoration:none;color:var(--t1);font-size:14.5px">C　博物馆　急功近利</a>
   <a href="#" style="display:flex;align-items:center;min-height:46px;padding:10px 14px;border:1px solid var(--border);border-radius:var(--r-m);text-decoration:none;color:var(--t1);font-size:14.5px">D　基因库　修旧如旧</a>
  </div>
 </div>
</div>
<footer style="position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);border-top:.5px solid var(--border);padding:10px 16px 26px;display:flex;gap:10px">
  <a class="btn btn-plain" href="#" style="flex:1">上一题</a>
  <a class="btn btn-plain" href="#" style="width:88px">答题卡</a>
  <a class="btn btn-primary" href="exam-report.html" style="flex:1">下一题</a>
</footer>""", crumb="13 模考 · 答题",
 notes=[("d","设计要点","模考态与练习态区分：倒计时居中红显、无解析无收藏；模块分段进度；「交卷」收进答题卡浮层二次确认防误触。"),
        ("plat","端差异","App 息屏计时继续+回前台校准；小程序切后台超 5 分钟提醒。")])

PAGES["exam-report.html"] = page("成绩报告", """
<div class="content">
 <div class="card" style="text-align:center;background:var(--grad-brand);color:#fff;box-shadow:0 6px 18px rgba(59,111,245,.3)">
  <div style="font-size:13px;opacity:.85">2024 国考行测（副省级）</div>
  <div class="num" style="font-size:48px;margin:2px 0">68.5<span style="font-size:16px;opacity:.8"> 分</span></div>
  <div style="font-size:12px;opacity:.85">击败 82% 考生 · 用时 112 分钟 · 较上次 ↑4.2</div>
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 12px"><span class="t" style="font-size:14px">模块得分</span></div>
  """ + "".join(f'''<div class="row" style="gap:10px;margin-bottom:10px">
   <span style="width:64px;font-size:13px;color:var(--t2)">{m}</span>
   <div class="bar grow" style="height:8px"><i style="width:{p}%;background:{c}"></i></div>
   <span class="num" style="width:56px;text-align:right;font-size:13px">{s}</span></div>''' for m,p,s,c in [
    ("言语理解",85,"34/40","var(--success)"),("判断推理",78,"31/40","var(--mod-panduan)"),("资料分析",75,"15/20","var(--mod-ziliao)"),("常识判断",60,"12/20","var(--warning)"),("数量关系",47,"7/15","var(--error)")]) + """
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">逐题对错（点击看解析）</span><span class="tag tag-gray">错题已自动入本</span></div>
  <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:7px">
  """ + "".join(f'<a href="book-detail.html" style="height:30px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-s);font-size:11.5px;text-decoration:none;{s}">{i+1}</a>' for i,s in enumerate(["background:var(--success-bg);color:var(--success)"]*5+["background:var(--error-bg);color:var(--error)"]+["background:var(--success-bg);color:var(--success)"]*3+["background:var(--error-bg);color:var(--error)"]+["background:var(--success-bg);color:var(--success)"]*4+["background:var(--fill);color:var(--t4)"]+["background:var(--success-bg);color:var(--success)"]*2+["background:var(--error-bg);color:var(--error)"]+["background:var(--success-bg);color:var(--success)"]*8)) + """
  </div>
 </div>
 <div class="row" style="gap:10px">
  <a class="btn btn-plain grow" href="exam-list.html">返回卷库</a>
  <a class="btn btn-primary grow" href="book.html">复盘 21 道错题</a>
 </div>
</div>""", nav="成绩报告", back="exam-list.html", navact=("历次成绩","stats.html"), crumb="14 模考 · 成绩报告",
 notes=[("d","设计要点","得分 Hero+对比激励→模块条形（弱模块红显）→对错网格直达解析；主行动「复盘错题」而非「再考一次」，强化错题闭环。")])

# -------- 时政每日一练
PAGES["daily.html"] = page("时政每日一练", """
<div class="content">
 <div class="card" style="background:linear-gradient(135deg,#FFF7ED,#FFFBEB)">
  <div class="row" style="gap:8px"><span class="tag tag-warn">10 月 28 日</span><span class="tag tag-gray">已连续 12 天</span></div>
  <p style="font-size:15px;font-weight:700;margin-top:8px">今日热点：二十届四中全会公报要点</p>
  <p style="font-size:12.5px;color:var(--t3);margin-top:4px">10 题 · 约 8 分钟 · 今日 2,314 人已练</p>
  <a class="btn btn-primary" href="#" style="margin-top:12px;min-height:42px">开始今日一练</a>
 </div>
 <div class="sec-h"><span class="t">本月日历</span><a class="more" href="calendar.html">全部 ›</a></div>
 <div class="card">
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;font-size:12px">
   """ + "".join(f'<span style="color:var(--t4)">{d}</span>' for d in "一二三四五六日") +
   "".join(f'<span style="height:32px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-s);{s}">{i}</span>' for i,s in
     [(i, "background:var(--success-bg);color:var(--success)" if i<=28 and i>=17 else ("border:1.5px solid var(--brand-500);color:var(--brand-500);font-weight:700" if i==28 else "color:var(--t3)")) for i in range(1,29)]) + """
  </div>
 </div>
 <div class="sec-h"><span class="t">往期补练</span></div>
 """ + "".join(f'''<a class="card" href="#" style="display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;padding:13px 16px">
  <div class="grow"><div style="font-size:14px;font-weight:600">{t}</div><div style="font-size:12px;color:var(--t3)">{m}</div></div>{b}
 </a>''' for t,m,b in [("10.27 · 全国秋粮收购进展","10 题 · 已完成 9/10",'<span class="tag tag-ok">90 分</span>'),("10.26 · 载人航天新闻发布会","10 题 · 未练",'<span class="tag tag-gray">补练</span>')]) + """
</div>""", nav="时政每日一练", back="home.html", crumb="15 时政每日一练",
 notes=[("d","设计要点","暖色卡与刷题蓝区分「每日仪式感」；打卡日历强化连续性；往期可补练但不计入连击（防刷）。")])

# -------- 学习计划 / 报考画像
PAGES["plan.html"] = page("学习计划 · 报考画像", """
<div class="content">
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">报考画像</span><a class="more" href="#">修改</a></div>
  <div class="row" style="flex-wrap:wrap;gap:8px">
   <span class="chip on">2025 国考</span><span class="chip on">副省级</span><span class="chip on">税务系统</span><span class="chip">在职备考</span>
  </div>
  <div class="row" style="margin-top:12px;gap:10px">
   <div class="grow" style="background:var(--brand-50);border-radius:var(--r-m);padding:10px 14px">
    <div style="font-size:12px;color:var(--t3)">距笔试</div><div class="num" style="font-size:22px;color:var(--brand-500)">33 天</div>
   </div>
   <div class="grow" style="background:var(--fill);border-radius:var(--r-m);padding:10px 14px">
    <div style="font-size:12px;color:var(--t3)">当前阶段</div><div style="font-size:15px;font-weight:700">冲刺期</div>
   </div>
  </div>
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 4px"><span class="t" style="font-size:14px">阶段路线</span></div>
  """ + "".join(f'''<div class="row" style="gap:12px;padding:10px 0">
   <span style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;{s}">{ic}</span>
   <div class="grow"><div style="font-size:14px;font-weight:600;{'color:var(--t4)' if done else ''}">{t}</div><div style="font-size:12px;color:var(--t3)">{d}</div></div></div>''' for done,ic,s,t,d in [
    (True,"✓","background:var(--success);color:#fff","基础期 · 已完成","方法库全刷 + 模块摸底"),
    (True,"✓","background:var(--success);color:#fff","强化期 · 已完成","专项 3000 题 + 每周模考"),
    (False,"●","background:var(--brand-500);color:#fff","冲刺期 · 进行中","错题清零 + 真题卷 8 套 + 时政冲刺"),
    (False,"","border:1.5px solid var(--border);color:var(--t4)","考前一周","保温模考 + 作息校准")]) + """
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">每日任务模板</span><span class="tag tag-gray">按考试日期倒排</span></div>
  <div class="opt-row"><span class="oico">📊</span><div class="grow">专项练习 20 题<div class="osub">优先薄弱模块：数量关系</div></div><span style="color:var(--t4)">›</span></div>
  <div class="opt-row"><span class="oico">🔁</span><div class="grow">错题复习<div class="osub">遗忘曲线到期题目</div></div><span style="color:var(--t4)">›</span></div>
  <div class="opt-row" style="border:none"><span class="oico">📝</span><div class="grow">每周日 · 全真模考<div class="osub">交替国考/联考卷</div></div><span style="color:var(--t4)">›</span></div>
 </div>
 <a class="btn btn-primary" href="home.html">保存计划</a>
</div>""", nav="学习计划", back="home.html", crumb="16 学习计划 / 报考画像",
 notes=[("d","设计要点","画像 chips 一屏可改；倒计时+阶段双卡；路线时间轴显示已完成/进行中；任务模板与首页「今日计划」同源。")])

# -------- 登录 / 个人中心
PAGES["login.html"] = page("登录 / 注册", """
<div class="content" style="padding-top:48px">
 <div style="text-align:center;margin-bottom:36px">
  <div style="width:72px;height:72px;border-radius:22px;background:var(--grad-brand);margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 8px 20px rgba(59,111,245,.35)">📘</div>
  <div style="font-size:20px;font-weight:800">考公错题助手</div>
  <div style="font-size:13px;color:var(--t3);margin-top:4px">登录后错题、做题记录多端同步</div>
 </div>
 <div class="card" style="padding:20px">
  <div style="border:1px solid var(--border);border-radius:var(--r-m);height:46px;display:flex;align-items:center;padding:0 14px;color:var(--t4);font-size:14px;margin-bottom:12px">手机号</div>
  <div style="border:1px solid var(--border);border-radius:var(--r-m);height:46px;display:flex;align-items:center;padding:0 14px;color:var(--t4);font-size:14px;margin-bottom:16px">密码</div>
  <a class="btn btn-primary" href="home.html">登录</a>
  <div class="row" style="justify-content:space-between;margin-top:12px;font-size:13px">
   <a href="#" style="color:var(--t3);text-decoration:none">注册新账号</a>
   <a href="#" style="color:var(--brand-500);text-decoration:none">忘记密码</a>
  </div>
 </div>
 <div style="text-align:center;margin-top:24px">
  <div style="font-size:12px;color:var(--t4);margin-bottom:14px">— 其他方式 —</div>
  <div class="row" style="justify-content:center;gap:20px">
   <span style="width:46px;height:46px;border-radius:50%;background:#fff;box-shadow:var(--sh-1);display:flex;align-items:center;justify-content:center;font-size:20px">💬</span>
   <span style="width:46px;height:46px;border-radius:50%;background:#fff;box-shadow:var(--sh-1);display:flex;align-items:center;justify-content:center;font-size:20px"></span>
  </div>
  <p style="font-size:11px;color:var(--t4);margin-top:20px">登录即同意 <a href="#" style="color:var(--t3)">用户协议</a> 与 <a href="#" style="color:var(--t3)">隐私政策</a> · 本机记录自动合并</p>
 </div>
</div>""", nav="", back="home.html", crumb="17 登录 / 注册",
 notes=[("plat","端差异","小程序：一键微信授权登录为主 CTA，手机号登录收次级；App：Apple 登录（iOS 上架必需）+ 微信；H5：手机号+密码为主。")])

PAGES["profile.html"] = page("个人中心 · 设置", """
<div class="content">
 <div class="card" style="display:flex;align-items:center;gap:14px">
  <span style="width:56px;height:56px;border-radius:50%;background:var(--grad-brand);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700">树</span>
  <div class="grow"><div style="font-size:17px;font-weight:700">上岸的小树 <span class="tag tag-brand">2025 国考</span></div>
  <div style="font-size:12px;color:var(--t3);margin-top:2px">累计刷题 12,480 · 连续打卡 12 天</div></div>
  <span style="color:var(--t4)">›</span>
 </div>
 <div class="card" style="padding:6px 16px">
  <div class="opt-row"><span class="oico">🎯</span><div class="grow">学习计划与报考画像</div><a href="plan.html" style="color:var(--t4);text-decoration:none">›</a></div>
  <div class="opt-row"><span class="oico">⭐</span><div class="grow">我的收藏<div class="osub">好题 36 · 申论素材 12</div></div><span style="color:var(--t4)">›</span></div>
  <div class="opt-row" style="border:none"><span class="oico">⤓</span><div class="grow">PDF 导出记录</div><a href="pdf-export.html" style="color:var(--t4);text-decoration:none">›</a></div>
 </div>
 <div class="card" style="padding:6px 16px">
  <div class="opt-row"><span class="oico">🔔</span><div class="grow">提醒设置<div class="osub">每日 20:00 学习提醒</div></div><span style="color:var(--brand-500);font-size:13px">已开启</span></div>
  <div class="opt-row"><span class="oico">Aa</span><div class="grow">字号与显示</div><span style="color:var(--t3);font-size:13px">标准</span></div>
  <div class="opt-row" style="border:none"><span class="oico">🌙</span><div class="grow">深色模式</div><span style="color:var(--t3);font-size:13px">跟随系统</span></div>
 </div>
 <div class="card" style="padding:6px 16px">
  <div class="opt-row"><span class="oico">📢</span><div class="grow">公告与更新</div><span class="tag tag-bad" style="height:16px">1</span></div>
  <div class="opt-row"><span class="oico">🛟</span><div class="grow">反馈与纠错</div><span style="color:var(--t4)">›</span></div>
  <div class="opt-row" style="border:none"><span class="oico">ℹ️</span><div class="grow">关于 · 方法库版权说明</div><span style="color:var(--t4)">›</span></div>
 </div>
 <a class="btn btn-plain" href="login.html" style="color:var(--t3)">退出登录</a>
</div>""", nav="我的", tabbar_on="我的", crumb="18 个人中心 / 设置",
 notes=[("d","设计要点","新增第 5 个 Tab「我的」，把散落的设置/收藏/导出/公告归拢；分组卡：学习资产 → 偏好 → 支持。"),
        ("plat","端差异","App 增加推送权限管理与版本更新项；小程序无退出登录（授权态）。")])

# -------- PDF 导出弹层
PAGES["pdf-export.html"] = page("PDF 导出弹层", """
<div class="content" style="filter:grayscale(.1)">
 <div class="card"><p style="font-size:14px;color:var(--t3)">（错题本页面，弹层下方内容变暗）</p>
 <div class="bar" style="margin-top:10px"><i style="width:40%"></i></div></div>
 <div class="card" style="height:120px"></div><div class="card" style="height:120px"></div>
</div>
<div class="dim"></div>
<div class="sheet">
 <div class="grab"></div>
 <div class="sh-t">导出错题 PDF</div>
 <div class="opt-row"><span class="oico">🗂</span><div class="grow">导出范围<div class="osub">当前筛选 · 96 题（资料分析）</div></div><span style="color:var(--brand-500);font-size:13px">更改 ›</span></div>
 <div class="opt-row"><span class="oico">📄</span><div class="grow">版式<div class="osub">题目+解析分离（先题后析，适合重做）</div></div><span style="color:var(--brand-500);font-size:13px">题析分离 ▾</span></div>
 <div class="opt-row" style="border:none"><span class="oico">✍️</span><div class="grow">包含我的错误选项与错因标注</div>
  <span style="width:44px;height:26px;border-radius:13px;background:var(--brand-500);position:relative"><i style="position:absolute;right:2px;top:2px;width:22px;height:22px;border-radius:50%;background:#fff"></i></span></div>
 <a class="btn btn-primary" href="book.html" style="margin-top:14px">生成 PDF（约 10s）</a>
 <a class="btn" href="book.html" style="color:var(--t3);margin-top:6px;min-height:40px">取消</a>
</div>""", nav="错题本", back="book.html", crumb="19 PDF 导出弹层",
 notes=[("d","设计要点","半屏 bottom-sheet 三选项（范围/版式/标注开关）+ 单主行动；生成中转进度态、完成后系统分享/下载。"),
        ("plat","端差异","小程序生成后 wx.openDocument 预览+转发；App 走系统分享面板；H5 直接下载。")])

# -------- 学习日历（stats 引用）
PAGES["calendar.html"] = page("学习日历", """
<div class="content">
 <div class="card">
  <div class="sec-h" style="margin:0 0 12px"><span class="t" style="font-size:14px">‹ 2025 年 10 月 ›</span><span class="tag tag-ok">本月打卡 24 天</span></div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;font-size:12px">
   """ + "".join(f'<span style="color:var(--t4)">{d}</span>' for d in "一二三四五六日") +
   "".join(f'<span style="height:38px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--r-s);{s}"><b style="font-size:12px">{i}</b><i style="font-style:normal;font-size:8px;{sub}">{n}</i></span>'
     for i,s,sub,n in [(i,
        "border:1.5px solid var(--brand-500);color:var(--brand-500)" if i==28 else ("background:var(--brand-50)" if i%7 not in (3,) and i<28 else ""),
        "color:var(--brand-400)" if i<28 and i%7!=3 else "color:transparent",
        f"{20+i%30}题" ) for i in range(1,29)]) + """
  </div>
 </div>
 <div class="card">
  <div class="sec-h" style="margin:0 0 10px"><span class="t" style="font-size:14px">10 月 28 日 · 今天</span></div>
  <div class="opt-row"><span class="oico">📊</span><div class="grow">专项练习 32 题<div class="osub">资料分析 · 正确率 78%</div></div></div>
  <div class="opt-row" style="border:none"><span class="oico">🔁</span><div class="grow">错题复习 6 题<div class="osub">重练正确率 83%</div></div></div>
 </div>
</div>""", nav="学习日历", back="stats.html", crumb="20 学习日历",
 notes=[("d","设计要点","热力日历（做题量深浅）+ 点选日显当日明细；与统计页同一时间口径。")])
