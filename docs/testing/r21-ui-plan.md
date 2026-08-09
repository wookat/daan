# 轮21 生产 UI 回归计划（https://kaogong.zalize.com，375px，录屏）

前提（已确认）：生产前端 chunk 含 r21 字符串；API 返回 team_invite/q_stats。分享 sid=ys8efj8y（题1273654，答案C，数量关系/最值问题），小队「QA回归22队」邀请码 A9ODCD。窗口 375px：`wmctrl -r :ACTIVE: -e 0,50,30,400,720`。CJK 输入用 xclip。全程记录各浏览器 profile 的 localStorage uid。

## T1 答对流程 + 一键组队（新匿名 uid A）
1. 无痕/清 uid 打开 `#/pkgA/share/share-q?sid=ys8efj8y`。
   - PASS: 题干显示，标签为「数量关系」+「最值问题」；页面有「和 QA甲 组队刷题 / 加入小队「QA回归22队」」卡片带「一键加入」按钮（未作答时后端已返回 team_invite）。
2. 选 C 提交。
   - PASS: 绿色「回答正确」；出现琥珀色条「🏆 你击败了 X% 的作答者（共 N 人做过这题）」，X/N 为具体数字。
3. 点「一键加入」。
   - PASS: toast「加入成功！」；卡片变绿色「🎉 已加入「QA回归22队」」+「看队友 ›」按钮。
4. 点「看队友 ›」跳小队面板。
   - PASS: 面板显示 QA回归22队 / 邀请码 A9ODCD，成员含新 uid。
5. 记录 localStorage.uid（uid A）。

## T2 小队面板周排行 + 周战报（同 uid A，已在队）
1. 面板上「🏆 本周队内排行」卡片。
   - PASS: 成员按本周题数降序；第 1 名右侧有黄色「卷王」标（week_n>0 时）；本人行有「我」标；每行「本周 N 题」。
2. 点「复制周战报」。
   - PASS: toast「周战报已复制，发到微信群吧」；剪贴板（xclip -o）文案格式：`📊刷题小队「QA回归22队」本周战报：全队共刷 N 题，打卡 M 人天，卷王是「…」（K 题）。…邀请码 A9ODCD，点链接加入：…/#/pages/team/join?code=A9ODCD`，N/M 与排行卡片一致。

## T3 答错流程（新 uid B：清 localStorage 后刷新）
1. 清 localStorage，重开 share-q 链接，选错误项（如 A）提交。
   - PASS: 红色「回答错误」条；显示「共 N 人做过这题，正确率 Y% ，再战同类题赢回来」（无「击败」字样）；组队卡片仍显示（uid B 未入队）。此步不点加入（避免再加成员——可点，产生的是测试队数据，允许；按时间决定，默认不点）。
2. 记录 uid B。

## T4 刷题页「分享给队友」文案（uid B 或 A）
1. 打开刷题页（练习页题卡下 q-social-bar），**答对后**点「分享给队友」（注意：练习答错写真实错题本，必须答对；用解析/搜索保证正确，若无把握改用错题本外的分享入口——share-q 落地页无此按钮，只能练习页；答题前先确认答案）。
   - 替代更安全路径：由于练习答错风险，改为验证 q-social-bar 分享按钮无需作答即可点？（代码中 shareCreate 由按钮触发，与作答无关）——直接进练习页找题卡分享按钮点它，不提交答案。
   - PASS: toast「分享链接已复制，发给队友吧」；剪贴板文案 = `【<二级模块或模块名>】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/#/pkgA/share/share-q?sid=…`。

## T5 微信内 title（CDP 设 UA 含 MicroMessenger）
1. 用 CDP `Emulation.setUserAgentOverride`（含 MicroMessenger/8.0）后打开 share-q 链接（已作答 uid 亦可）。
   - PASS: document.title = 「QA甲 考了你一道最值问题题，你能做对吗？- 考公助手」。
2. 打开 `#/pages/team/join?code=A9ODCD`。
   - PASS: document.title = 「队友邀请你加入刷题小队，一起打卡冲上岸 - 考公助手」。（join 页面不点加入按钮。）

## 汇报
- 记录 uid A / uid B（+任何其他产生的 uid）；问题按 P0/P1/P2 分级；报告文件 + 录屏路径。
- 不删除任何生产数据；不在练习模式提交错误答案。
