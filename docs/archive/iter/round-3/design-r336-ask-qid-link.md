# R336 设计：AI 问答会话挂题目 id + 复盘场景「已问过 AI · 回看」

## 背景与取证（SOP-10 四维审计窗口，2026-08-29）

四维复审计结论：
- 操作台：R219–R230 已收口（缓存/深色/a11y/移动档），无新 P0。
- 落地页首页 UI：R334 Lighthouse / a11y 1.00、LCP <2s，无新 P0。
- 架构：R331/R332 收口 AI 会话持久化后无结构性缺口；共享宿主资源争抢为外部风险（挂老板资源项）。
- 核心功能深度（本轮选题）：R326–R335 把「AI 详解本题」入口铺进全部 6 个复盘场景后，出现新的断点——**AI 会话与题目零关联**。取证 verified：
  - 6 个入口只写 `redoQuestion`（纯文本）/`redoAnswer`，题目 id 在传递时丢弃；
  - ask 页 persistSession/archiveCurrent 的 items 不含任何题目标识（ask.vue L744–758、L783–799）；
  - 用户对同一道题问过 AI 后，从错题本/练习历史再次遇到该题时无从得知已问过、也无法回看，只能重新消耗 LLM 成本再问一遍，或去历史列表按标题人肉翻找（cap 20）。
  - 粉笔 AI 讲题记录按题挂载可回看；夸克 AI 讲解同题可直达历史回答。

## 方案（纯前端零后端/零契约）

服务端 `/api/ask/sessions|cur` 的 items 校验只要求 list[dict]（ai_api.py L178/L203），**item 级新字段透明穿透**，不改任何 endpoint/表/URL 契约。

1. 新纯函数（ask-link.js，fail-closed + vitest）：
   - `askQid(v)`：仅接受正整数（number 或纯数字字符串），否则 0；
   - `findAskSid(sessions, curItems, qid)`：先扫 curItems（进行中会话，命中返回 `{sid: 0}`），再按 ts 序扫 sessions items 的 `qid === qid`（命中返回 `{sid: s.id}`），无命中 null；非法输入一律 null。
2. 6 个 AI 入口在写 redoQuestion 的同时写 `redoQid`（无有效 id 显式 remove 防串题）：practice / book 复习流 / report 浮层 / search / favorites / practice-history。
3. ask 页：
   - onShow 消费 redoQid（askQid 校验）→ `this.pendingQid`，与 redoQuestion 同生命周期（消费即删）；
   - doExplain 产出的 rec 带 `qid: this.pendingQid`（用后清零，手动输入的新题 qid=0）；
   - persistSession items 补 `qid: r.qid || 0`；adoptItems 原样带回（展开对象展开已覆盖）；
   - onShow 消费 `askOpenSid`：sid>0 且本机 sessions 命中 → loadSession 对应会话；sid=0 → 仅落在进行中会话（restoreCurSession 已回填）；未命中静默忽略（fail-closed）。
4. 可感知外显（本轮两处，其余场景后续轮次同构推广）：
   - 练习历史逐题展开态（R335 d-exp 内）：`findAskSid` 命中时在「AI 详解本题」旁出「回看 AI 详解」；
   - 错题本复习流解析区：同构入口。
   - 点击 = `setStorageSync('askOpenSid', sid)` → `switchTab('/pages/ask/ask')`，不触发 /api/explain、零 LLM 成本。

## 边界（如实）

- 关联只对 R336 之后产生的会话生效（存量会话无 qid，fail-closed 不外显）；
- 「已问过」检测基于本机 askSessions 快照（R328 起 ask 页 onShow 同步）；新设备在首次进 ask 页前可能暂不显示（可接受，fail-closed）；
- 手动粘贴同题文本不建立关联（无 id 语义，刻意不做文本匹配）。

## 验收

本地全绿（lint/vitest/build，后端无改动）；生产双视口走查：入口→问答→归档→回到练习历史/错题本外显「回看 AI 详解」→点击直达原会话内容一致；无关题不外显；0 次新 /api/explain；测试数据清理 + 保护 uid 校验。
