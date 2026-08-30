# R21 设计方案：AI 面试陪练 + 模考大赛桌面化（search 之后的下一批）

日期：2026-08-29 ｜ 轮次：round-3 R21 ｜ 范围：仅 `frontend-uni/src/pkgA/interview/interview.vue`、`frontend-uni/src/pkgA/exam/contest.vue` + 本文档，零后端、零既有 JS 逻辑改动

## 1. 现状取证（生产 1440×900，bundle index-DVvOFRNf.js）

- `/#/pkgA/interview/interview`：`.wrap` 712px（自带 680px 上限），选分类列表 5 行纵向堆叠，桌面两侧全空；作答页题卡+textarea 纵向；点评报告页评分/题目/点评全部单列。
- `/#/pkgA/exam/contest`：`.wrap` 704px，比赛 hero 卡、往期比赛、赛制说明纵向堆叠；榜单 `.sheet` 是底部抽屉（桌面上贴底不自然）。
- 截图：r21_interview.png / r21_contest.png（会话内）。
- 其余候选：weekly-report / calendar / mastery-map 游客态内容极简（scrollH=900 一屏），暂不立项。
- 对标：粉笔面试模考/模考大赛在桌面端为宽幅工作台（左内容右侧栏）+ 居中弹窗。

## 2. 方案（全部 H5 媒体查询 + 少量模板包裹层，零 JS 方法改动）

### interview.vue
- ≥768px：`.wrap { max-width: 1044px; }`（原 680）。
- ≥1024px：
  - 选分类：`.cat-list` 改两列 grid（`.cat` 为格子，去行间 border 改格子内边框）。
  - 作答页：`.iv-cols` 双栏——左 `.iv-left`（题卡+计时行，sticky）、右 `.iv-right`（textarea+计数+按钮行）。模板加包裹层，<1024 纵向退化、DOM 顺序同原单列。
  - 报告页：`.rp-cols` 双栏——左 `.rp-left`（总分 hero+五维评分+题目+参考要点，sticky 无必要，左列自然流）、右 `.rp-right`（考官点评，长文主体）。
- hover：cat/按钮 cursor 已有，补 `.cat:hover` 背景。

### contest.vue
- ≥768px：`.wrap { max-width: 1044px; margin: 0 auto; }`；`.prow/.cta/.rules-h/.brow` hover cursor+背景；`.mask` 居中 + `.sheet` 桌面居中弹窗（max-width 560px、圆角四边）。
- ≥1024px：`.ct-cols` 双栏——左 `.ct-main`（比赛 hero 卡，flex:1）、右 `.ct-side`（往期比赛+赛制说明，360px sticky）。模板加包裹层。

## 3. 不做

- 不改任何 API、报名/进入/榜单逻辑、面试流式点评逻辑。
- 小程序/Flutter 端零影响（媒体查询包 `/* #ifdef H5 */`）。
- weekly/calendar/mastery-map 留待有内容深度需求时再议。

## 4. 验收

- 1440/1280：面试三步双栏/两列网格；模考大赛左主卡右侧栏、榜单居中弹窗；无横向溢出。
- 375：两页与旧版一致单列，交互（抽题、作答提交、报名、看榜单、赛制展开）零回归。
- 干净重载 console 0 error。
