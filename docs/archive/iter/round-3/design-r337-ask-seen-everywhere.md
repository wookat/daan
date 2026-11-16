# R337 设计：「回看 AI 详解」入口铺满剩余复盘场景（报告浮层/搜索详情/收藏详情）

## 取证（一手证据）

- R336 建立了 ask item 级 qid 关联协议（ask-link.js：askQid/findAskSid + askOpenSid 导航），但「回看 AI 详解」入口首批只铺了两处：练习历史展开态（practice-history.vue seenAsk）与错题本复习流（book.vue reviewAskSeen）。
- 源码 verified：`grep -rln findAskSid src/` 仅 book.vue / ask.vue / practice-history.vue / ask-link.js。
- 但六个写 redoQid 的 AI 入口场景中，成绩报告解析浮层（report.vue askDetail，d.question_id）、搜索详情（search.vue askFromSearch，d.id）、收藏详情（favorites.vue askFromFav，it.id）都已在 R336 写入有效 qid——用户在这三个场景生成过 AI 详解后，回到同一题仍然只看到「AI 详解本题」，不知道已问过、点了就要再等一次预填流程（甚至再触发一次 LLM 讲解）。
- 对标：粉笔 AI 讲题在题目解析处呈现「已生成」态直达历史讲解；夸克搜题命中已有讲解直接展示。

## 方案（纯前端，零后端/零契约，复用 R336 协议）

三处场景在既有「AI 详解本题」按钮旁按命中态补「回看 AI 详解」入口，语义与 book/practice-history 完全一致：

1. **report.vue（成绩报告解析浮层）**：computed `detailAskSeen()`——`void this.askSeenTick; return findAskSid(askSessions, askCurSession, this.detail && this.detail.question_id)`；data 补 `askSeenTick: 0`，onShow `this.askSeenTick++`（从 ask 页返回后重算）；浮层 dask 行上方命中时渲染「回看 AI 详解 ›」→ `openSeenAsk()`（sid>0 写 askOpenSid，switchTab ask）。浮层逐题连看切 detail 时 computed 自动重算。
2. **search.vue（搜索详情，两处模板：code_hit + 列表）**：computed `detailAskSeen()` 基于 `this.detail && this.detail.id`（同 tick 协议）；两处 ops 行命中时补「回看 AI 详解」。
3. **favorites.vue（收藏卡展开态）**：卡片是列表多开（it._open），不用单一 computed——方法 `favAskSeen(it)` 直接调 findAskSid（模板内 `v-if="askSeenTick >= 0 && favAskSeen(it)"` 用 tick 参与依赖失效）；本地时政收藏 `id:null` 经 askQid fail-closed 为 0 自然不出入口。`openSeenAskFav(it)` 同协议导航。

统一约束：
- 命中才渲染（findAskSid null 不出入口），点击零 /api/explain。
- sid=0（进行中会话）不写 askOpenSid，直接切 tab 依赖 current-session 恢复。
- 不新增埋点（book/practice-history 的 openSeenAsk 也无埋点，口径一致）。
- 不改 redoQid 写入逻辑与既有「AI 详解本题」行为。

## 验收

- 本地：lint / vitest / build:h5 全绿。
- 生产：三场景命中出入口且导航到对应会话、未问过的题不出入口、存量无 qid 会话不误命中、0 次 /api/explain、双视口无溢出、console 0 error、Lighthouse 预算过。
- 测试数据验后清理 + 保护 uid 快照一致。
