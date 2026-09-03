# R334 设计：收藏题目详情补「AI 详解本题」入口

## 一手取证（verified）

- `pkgA/social/favorites.vue` 收藏题目卡展开态（`it._open`）现有：选项 + 正确答案 + 解析（若有）+ 操作行「移动到… / 讨论区 / 取消收藏」，**零 AI 出口**。
- 收藏场景恰是「存了好题、回头看仍不懂」时刻，粉笔/夸克在收藏/解析场景均有 AI 讲题出口。
- 复盘 AI 出口线现状：刷题页（R326 前既有）、错题本复习流（R326）、成绩报告浮层（R326）、搜索详情（R333）均已就位，收藏页是最后一个展示完整题面却无 AI 出口的复盘场景。
- 数据可用性：收藏项含 `question`（题干，不含选项拼接）与 `options`（对象），与 `askPrefill(stem, options)` 契约直接匹配；本地收藏（`_local`）同 schema。
- 埋点白名单（`backend/app/team.py` `api_track()`）无 `fav_ask_click`——R333 已实证「前端发白名单外事件 → 静默 400 丢埋点 + console error」，故本轮**前后端同步**加事件，不重蹈 R333 走查返工。

## 方案（零新 endpoint/表/URL 契约，复用既有协议）

前端 `favorites.vue`：
1. 展开态 `.ops` 行首插 `<text class="op" role="button" aria-label="AI 详解本题" @click.stop="askFromFav(it)">AI 详解本题</text>`（`@click.stop` 防冒泡收起卡片）。
2. `askFromFav(it)`：`askPrefill(it.question, it.options)` 空则 no-op → `trackEvent('fav_ask_click', it.module || '')` → `setStorageSync('redoQuestion', text)` → `removeStorageSync('redoAnswer')`（收藏场景无本次作答语义，防串用上题作答 chip）→ `switchTab('/pages/ask/ask')`。
3. 引入 `trackEvent`（api.js）与 `askPrefill`（ask-prefill.js），既有收藏/笔记/夹管理行为零变化。

后端 `team.py`：白名单补 `fav_ask_click`。

## 验收标准

- 本地：ruff / pytest / pyright / lint / vitest / build:h5 全绿。
- 生产：收藏页展开题目 → AI 详解本题 → ask 页题干+选项预填、无作答 chip；抓包 `fav_ask_click` 200；0 次 /api/explain；1440/375 无溢出、console 0 error；既有 移动到/讨论区/取消收藏 回归。
- 测试 uid 数据验后全库清理 LEFTOVER 0。

## 边界（如实）

- 不触发真实 LLM；本地收藏项若历史数据缺 options 则仅预填题干（askPrefill 语义）；真实触屏不实测（CDP 模拟）。
