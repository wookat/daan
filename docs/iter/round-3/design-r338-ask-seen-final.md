# R338 设计：「回看 AI 详解」命中态收尾——刷题页解析区 + 错题本列表展开态

## 取证（2026-08-29，源码 + 生产 rev 0943b6b）

- R336 建立 item 级 qid 关联协议（`ask-link.js` askQid/findAskSid + askOpenSid 导航），首批入口铺练习历史展开态 + 错题本复习流；R337 铺报告解析浮层/搜索详情/收藏详情。
- 全站 grep `redoQid` 写入点共 7 处，其中仍无 findAskSid 命中态检查的只剩 2 处：
  1. `pages/practice/practice.vue` `deepExplain()`（作答后解析区「用花生十三方法详解这道题 ›」，qid=cur.id 有效写入）——刷题是频次最高的做题场景，已问过 AI 的题再刷到时用户不知已有讲解；
  2. `pages/book/book.vue` `redo(m)`（错题本列表展开态 op 行「AI 详解」，qid=m.question_id 有效写入）——复习流（cur）R336 已有 reviewAskSeen，但列表展开态没有。
- 对标：粉笔错题本/夸克 AI 讲解均在题目维度外显「已有讲解」状态，避免重复讲解成本。

## 方案（纯前端，零新 endpoint/表/URL 契约，不改 /api/explain）

### practice.vue
- 复用 book.vue 同构：`askSeenTick` data + `onShow` 自增；computed `curAskSeen`：`findAskSid(askSessions, askCurSession, this.cur && this.cur.id)`（void askSeenTick 触发重算）。
- 模板 `.deep` 上方命中时插入 `.deep.seen`「回看 AI 详解 ›」（role=button + aria-label），点击 `openSeenAsk()`：sid>0 写 askOpenSid、sid=0 不写，switchTab ask。
- 样式 `.deep.seen { color: var(--ok-strong); }`。

### book.vue 列表展开态
- 列表卡可多开，按 item 查：方法 `mAskSeen(m)`＝`findAskSid(..., m.question_id)`，模板 `v-if="askSeenTick >= 0 && mAskSeen(m)"`（tick 触发重渲染，复用 favorites R337 模式）。
- acts 行「AI 详解」旁插入 `.op.seen`「回看 AI 详解」，`@click.stop="openSeenAskM(m)"`，导航语义同上；mastered 与否均可显示（回看不受掌握状态限制）。
- 样式 `.op.seen { color: var(--ok-strong); }`。

## 验收标准
- 刷题页作答后：已问过题显示「回看 AI 详解 ›」于 deep 行上方，点击打开对应会话（归档写 askOpenSid / 当前直切）；未问过/legacy 无 qid/非法 id 不显示（fail-closed）。
- 错题本列表展开：命中项 acts 行出现绿色「回看 AI 详解」，点击不收起卡片直达对应会话；未命中不显示；复习流入口回归不变。
- 点开已有讲解全程 0 次 /api/explain；既有「AI 详解本题/用花生十三方法详解」写 redoQuestion/redoQid/redoAnswer 行为零变化。
- 本地 lint/vitest/build 全绿；生产 1440/375 双视口走查 console 0 error、无横向溢出。
