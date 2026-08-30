# R22 设计方案：答题 PK 大厅 + 刷题小队桌面化（interview/contest 之后的下一批）

日期：2026-08-29 ｜ 轮次：round-3 R22 ｜ 范围：仅 `frontend-uni/src/pkgA/pk/pk.vue`、`frontend-uni/src/pkgA/team/team.vue` + 本文档，零后端、零既有 JS 逻辑改动

## 1. 现状取证（生产 1440×900，bundle index-DS_jK4Xe.js）

- `/#/pkgA/pk/pk`：`.wrap.pk` 712px（680 上限），入口页 hero/模块 chips/发起按钮/胜场榜/我的对局全部单列纵向堆叠。
- `/#/pkgA/team/team`：`.wrap.team` 712px，小队列表/创建/加入单列；小队面板（hero+周排行+队友周打卡卡）同样单列。
- 截图：r22_pk.png / r22_team.png（会话内）。
- 其余候选：discuss 生产仍 0 条讨论、interview history/weekly/calendar 游客空态一屏，暂不立项。
- 对标：竞品对战/小组功能桌面端为「左操作区+右榜单/动态」布局。

## 2. 方案（H5 媒体查询 + 模板包裹层，零 JS 方法改动）

### pk.vue（仅入口 home 视图分栏；答题/结果视图保持窄栏专注，680 居中不动）
- ≥768px：`.wrap.pk { max-width: 1044px; }`（答题/结果视图由内层 `.pk-solo` 继续 680 居中）。
  - 实现：home 视图包 `.pk-cols`，quiz/result 视图包 `.pk-solo { max-width: 680px; margin: 0 auto; }`。
- ≥1024px（home）：`.pk-cols` 双栏——左 `.pk-left`（hero+选择模块+发起好友挑战/随机匹配+应战输入，420px sticky）/ 右 `.pk-right`（本周胜场榜+我的对局，flex:1）。

### team.vue
- ≥768px：`.wrap.team { max-width: 1044px; }`（创建弹层已居中）。
- ≥1024px：
  - home：hero 整宽；下方 `.tm-cols`（row-reverse）双栏——右 `.tm-side`（创建小队+邀请码加入，360px sticky）/ 左 `.tm-main`（我的小队列表）。DOM 顺序保持原单列（列表在前、创建/加入在后），移动端零变化。
  - panel：hero 整宽；下方 `.tp-cols` 双栏——左 `.tp-side`（本周队内排行，360px sticky）/ 右 `.tp-main`（周打卡表头+队友卡列表）。
- <1024px 包裹层退化纵向，DOM 顺序与原单列一致。

## 3. 不做

- 不改 PK 对局/提交/轮询、小队创建/加入/提醒等任何 JS 与 API。
- 答题（quiz）视图不分栏——对战计时场景窄栏专注更优。
- 小程序/Flutter 零影响（`/* #ifdef H5 */`）。

## 4. 验收

- 1440/1280：PK 大厅与小队 home/panel 双栏、sticky、无横向溢出；发起挑战→结果页（分享卡）680 窄栏正常。
- 375：两页与旧版一致单列，交互（选模块、发起、应战输入、创建/加入小队）零回归。
- 干净重载 console 0 error。
