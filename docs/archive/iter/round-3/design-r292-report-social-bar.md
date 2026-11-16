# R292 设计：成绩报告解析浮层挂载 q-social-bar（笔记 / 讨论 / 热评 / 分享给队友）

## 取证（一手源码）

- `components/q-social-bar/q-social-bar.vue`：既有题目社交条组件——写/改/删笔记（`fetchNote/saveNote` 服务端 + `qNoteDraft:` 本地草稿）、讨论数 + 讨论页直达（`/pkgA/social/discuss?qid=`）、热评卡外显、分享给队友（`shareCreate`）。props 仅 `questionId: Number`，watch immediate 自加载。
- 全站唯一挂载点为刷题页 `pages/practice/practice.vue`（`cur.id && !cur._sz` 时挂载）。
- `pkgA/exam/report.vue` 解析浮层（R290 连看 + R291 收藏后）仍无笔记/讨论/热评任何出口；复盘中想给错题记方法心得，只能收藏后离开报告去别处找题。`detail.question_id` 已由 `/api/exam/report` 返回（真实题库 id）。
- 竞品：粉笔模考报告逐题解析页有笔记与讨论区，是复盘工作台标配。

## 方案（最小改动，纯组件复用）

- `report.vue` 浮层解析块（`.dexp` 后、`scroll-view` 内）挂载：
  `<q-social-bar v-if="detail.question_id" :question-id="detail.question_id" />`
- easycom autoscan 自动解析组件，无需注册；组件 watch `questionId`（immediate）在 R290 连看切题时自动重载对应题的笔记/热评。
- 无 `question_id` 的题（理论上不存在，防御）不渲染。

## 边界（不改）

- 不改 q-social-bar 组件本身、讨论页、笔记 API、收藏链路（R291）、连看导航（R290）、报告 URL 协议与其他 API 语义。

## 验证

- 本地：lint / vitest / build:h5 全绿。
- 生产（临时测试 uid 种子模考，验后清理）：1440/375 双视口——浮层出现社交条；写笔记→保存→toast→「收藏与笔记」页笔记 tab 可见；切下一题社交条切换为对应题；讨论链接指向正确 qid；溢出 0；console 无新增错误；性能预算复跑。
