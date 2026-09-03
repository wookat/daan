# R333：搜索题目详情补「AI 详解本题」入口

## 取证（verified）
- `pkgA/search/search.vue` 题目详情展开态（code_hit 直达 + 题目列表两处）呈现题干/选项/答案/解析，唯一出口是「复制本题链接」（R269）；解析看不懂时零 AI 出口。
- R326 已把「AI 详解本题」铺进报告解析浮层/错题本列表/复习流/刷题页四类场景，共用 `ask-prefill.js` 的 `askPrefill` + `redoQuestion` storage 协议；R327 补 `redoAnswer` 透传作答。搜索场景是唯一有完整解析呈现却没接入的入口。
- 后端 `/api/search/question/{qid}` 返回 `question`（纯题干）+ `options`（dict），与 `askPrefill(stem, options)` 拼接口径匹配（粉笔搜题结果页每题带 AI 讲题入口）。

## 方案（纯前端零后端/零契约）
- 详情展开态「复制本题链接」旁新增「AI 详解本题」按钮（两处同构）。
- `askFromSearch(detail)`：`askPrefill(detail.question, detail.options)` 为空则 no-op；写 `redoQuestion`；搜索无作答语义，显式 `removeStorageSync('redoAnswer')` 防串题（R327 协议：无效即删除）；`trackEvent('search_ask_click')`；`uni.switchTab('/pages/ask/ask')`。
- 不触发 `/api/explain` 真实 LLM 请求（仅预填，由用户决定发送）；不改搜索既有竞态防护（R158/R160）。

## 验收
- lint/vitest/build 全绿；生产 UI 实测：两处入口预填题干+选项、无 redoAnswer 残留、复制链接/详情展开回归、1440/375 双视口无溢出、console 0 error、0 次 /api/explain。
