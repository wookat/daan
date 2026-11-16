# R35 设计方案：/tiku/q 题目 SSR 页外显考友讨论（UGC SEO）

## 现状取证（2026-08-29）
- `/tiku/q/{qid}`（seo.py `_render_question`）SSR 输出题干/选项/答案解析/同考点相似题 + QAPage JSON-LD，但完全不含讨论区 UGC——生产已有真实评论（`question_comments` status='ok'），搜索引擎与 SSR 访客均不可见。
- App 内讨论链路（R25–R34）已闭环：讨论页、广场、热评外显、收件箱；SEO 页族是唯一没有接入讨论的曝光面。
- 竞品惯例：粉笔/华图等题目落地页均外显用户评论/讨论，UGC 是题目页 SEO 长尾与停留时长的重要来源。

## 差距定级
P1（架构/SEO + 功能曝光）：已有 UGC 资产未在 SEO 页面复用。

## 方案
仅改 `backend/app/seo.py`：

- `_render_question(qid)` 保持 `@lru_cache`，在 body 尾部埋 `<!--QCOMMENTS-->` 占位符；
- 路由 `tiku_question(qid)` 在返回前用 `_render_q_comments(qid)`（不缓存，查询轻量）替换占位符：
  - 查 `question_comments WHERE question_id=? AND status='ok' AND parent_id IS NULL ORDER BY likes DESC, created_at DESC LIMIT 5`；
  - 有评论时输出 `<section class="card"><h2>考友讨论（N 条）</h2>` + 每条「昵称 · 👍 n：内容」+ CTA `参与讨论 →`（跳 `SITE_BASE/#/pkgA/social/discuss?qid=`）；
  - 无评论时输出空串（页面零变化）；
- 评论文本经 `_e()` 转义防注入；N 用该题 ok 评论总数（含回复）。
- 不改 JSON-LD（QAPage 结构不动，避免 comment 字段与缓存耦合）。

## 不做
- SSR 页内互动（点赞/回复仍在 App 讨论页）；
- 评论进 lru_cache（避免 UGC 长期陈旧）。

## 验收
- 本地 py_compile/ruff 无新增错误；H5 build（无前端改动可跳过）；
- 生产：有评论题 /tiku/q/{qid} 可见「考友讨论」区块且转义正确、CTA 跳讨论页；无评论题零变化；新评论无需重启即出现（占位符替换不缓存）；1440/375 无溢出。
