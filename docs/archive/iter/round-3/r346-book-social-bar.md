# R346：错题本挂 q-social-bar——列表展开态 + 复习流补逐题笔记/讨论/热评

## 取证（SOP-10 功能深度维度）

- verified：`q-social-bar`（我的笔记 + 讨论计数/热评 + 分享给队友，R292 组件）当前只挂在两处：
  - `pages/practice/practice.vue:183`（刷题页解析区）
  - `pkgA/exam/report.vue:278`（模考报告解析浮层）
- 错题本 `pages/book/book.vue` 两个核心复盘场景均无该出口：
  - 列表展开态（题干/选项/解析/历次作答俱全）；
  - 复习流 answered 态（判分 + 讲解 + 错因自评 + AI 出口俱全）。
- 用户可感知缺口：在错题本复盘时想「记一笔这题的坑」或看考友讨论，只能先跳去刷题页/搜索页找同一题；粉笔错题本支持错题逐题笔记。

## 方案（纯前端零后端/零契约）

- 列表展开态：`<rich-text :nodes="m.html" />` 之后追加
  `<q-social-bar v-if="m.open && m.question_id" :question-id="m.question_id" />`。
  - 手录错题（`question_id` 为空）fail-closed 不渲染（笔记/讨论均以题库 id 为键，无 id 无处可挂）。
  - 组件仅在展开时挂载，API 调用（count/note/热评）随展开惰性触发，与报告浮层同口径。
- 复习流 answered 态：「回看 AI 详解」行之后、「下一题」按钮之前追加
  `<q-social-bar v-if="cur.question_id" :question-id="cur.question_id" />`。
  - 加练同类题（`_extra: true`）不带 `question_id`，自然 fail-closed。
  - 组件 watch questionId immediate 自动随切题重载并清空编辑态，无串题风险。

## 非目标

- 不新增后端 endpoint/表/analytics event（组件内埋点已有）；
- 不动 q-social-bar 组件本身；
- 不给手录错题造 question_id；
- 不接入真实支付、不调用真实 LLM。

## 验证计划

- 本地：lint / vitest / H5 build 全绿（模板级改动，无新纯函数）。
- 生产 testing agent：
  - 列表展开出现笔记/讨论出口，写笔记→保存→toast→重进错题本笔记回显；
  - 同题在刷题页/搜索详情可见同一笔记（同 qid 同源）；
  - 手录错题展开无 social bar（fail-closed）；
  - 复习流答题后出现出口、加练同类题无出口；
  - 讨论入口跳转正常、热评/抢首评态展示；
  - 375/1440 无溢出、console 0 error、0 次 /api/explain；
  - 测试 uid 清理 + 保护 uid 快照一致。
