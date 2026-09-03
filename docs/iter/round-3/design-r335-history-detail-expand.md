# R335：练习历史逐题回看展开态 + 「AI 详解本题」入口

## 一手取证（2026-08-29）
- `pkgA/stats/practice-history.vue` 会话详情逐题行只有：✓/✗、2 行截断题干（ellip2）、错题「我的答案 X · 正解 Y」、用时；不可点开看完整题干/选项/解析。
- 后端 `db.practice_history_detail` 每行已附完整题库原题（question/options/answer/explanation/hs_explanation），前端只消费了 question/answer 两个字段——数据早已就位，纯呈现缺口。
- 用户复盘动线断点：看到错题想弄懂，只能「重练本次错题」重新做一遍，无法就地看解析；粉笔练习历史支持逐题点开看解析。
- AI 出口收敛线（R326/R327/R333/R334）已覆盖刷题/错题本/报告浮层/搜索/收藏，练习历史是最后一个持有完整题面数据却无 AI 出口的复盘场景；且本场景有用户真实作答 picked，应走 R327 redoAnswer 协议带上作答。

## 方案（纯前端 + 埋点白名单，零新 endpoint/表/URL 契约）
- d-row 有 question 数据时可点展开（openDetailIdx 单开互斥）：完整题干、选项（标注正解绿/我的错选红）、解析（hs_explanation||explanation）。
- 展开态操作行「AI 详解本题」：askPrefill(q.question, q.options) 空 no-op → trackEvent('history_ask_click', module) → 写 redoQuestion；picked 经 askAnswerLetter 校验有效则写 redoAnswer、无效则显式 remove（fail-closed）→ switchTab /pages/ask/ask。
- @click.stop 防冒泡收起会话卡；无 question 数据的行（题目已下架）不可展开、不出入口。
- backend team.py /api/track 白名单补 history_ask_click。

## 验收
- 本地全绿（ruff/pytest/pyright/lint/vitest/build）。
- 生产双视口实测：展开态选项/解析呈现、AI 入口预填+作答 chip 恢复、埋点 200、0 次 /api/explain、重练按钮回归、console 0 error、无溢出。
- 测试 uid 验后全库清理 + 保护 uid 快照一致。

## 边界（如实）
- 不真实触发 LLM；题目下架行为既有 LEFT JOIN fail-closed（question=null）不改；真实触屏不实测（CDP 模拟）。
