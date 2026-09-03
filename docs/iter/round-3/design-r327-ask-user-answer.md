# R327 设计方案：AI 详解入口带上用户作答（redoAnswer 协议）

日期：2026-08-29 ｜ 轮次：round-3 R327 ｜ 状态：实施

## 取证（一手证据）

- ask.vue 早有「我的答案」A–D chips（uanswer），doExplain 把 user_answer 传给 /api/explain，
  后端 cache_key 与讲解生成均消费该字段——AI 讲解本就能针对「你为何错选」展开。
- 但 R326 的四个「AI 详解」入口（刷题页 deepExplain / 错题本列表卡 / 复习流 / 报告浮层）只写
  redoQuestion，ask.vue 消费时硬置 `this.uanswer = ''`（ask.vue L296）——用户在源头明明已作答
  （practice `picked`、mistakes `user_answer`、report `detail.picked`），到问答页全部丢失，
  用户须手动再点一次自己的错选，多数人不会点，AI 讲解退化为泛泛讲题。
- 竞品：粉笔 AI 老师讲题带你的作答上下文（「你选了 B，正确答案是 C」）；夸克讲解同样感知作答。

## 方案（纯前端零后端/零契约）

1. ask-prefill.js 新增纯函数 `askAnswerLetter(v)`：提取 A–D 字母集合，恰好单字母时返回该字母，
   否则（空/非法/多选）fail-closed 返回 `''`。
2. 四入口写 redoQuestion 的同时维护 `redoAnswer` storage：有效单字母 set、否则 remove（防陈旧串题）。
   - practice.vue deepExplain：`this.picked`；
   - book.vue redo(m)：`m.user_answer`；askFromReview：`this.cur.user_answer`；
   - report.vue askDetail：`d.picked`。
3. ask.vue onShow 消费 redoQuestion 时改读 redoAnswer（白名单 `/^[A-D]$/`，非法回落 ''）并 remove。

不做：不改后端 /api/explain 契约；不改 uanswer 交互；多选题不预填（uanswer 仅单选语义）。

## 验收

- 生产：四入口答错场景跳 ask 后「我的答案」chip 已选中源头错选；未作答/多选不预填；不串题。
- vitest：askAnswerLetter 单字母/带文字/多选/非法/空各分支。
- 测试 uid 验后清理 LEFTOVER 0，保护 uid 快照一致。
