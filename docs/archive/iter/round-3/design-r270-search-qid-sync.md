# R270 设计：搜索页题目详情展开态 URL 同步 + ?qid 入向深链

## 取证（源码 + 生产一手证据）

- R157 已让搜索关键词/tab 双向同步 URL（`buildSearchUrl` + replaceState + onLoad 收 q/tab）。
- 源码实查 `search.vue`：`toggleDetail(it)` 展开题目详情只翻 `detailWant/detail` 本地状态，地址栏不动；`onLoad` 只收 `q/tab`，无法通过 URL 恢复「搜索+已展开某题」状态——刷新即收起，复制地址栏发给考友对方看不到展开的解析。
- 申论专区同类状态（详情 ?id、素材 ?mid）在 R243/R246 已双向闭环；搜索页是最后一个有展开详情态却不进 URL 的页面。

## 方案

- `buildSearchUrl(kw, tab, qid)` 增第三参：合法正整数时追加 `&qid=N`（无关键词仍回落 SEARCH_PATH，不带 qid——qid 依附于搜索结果语境）。
- `toggleDetail` 展开/收起后调用既有 `syncUrl()`（replaceState）。
- `onLoad` 收 `qid`（纯数字校验），搜索完成后若结果含该题（questions.items 或 code_hit）自动 `toggleDetail` 展开。
- 纯前端，零后端/SSR/SEO 变化；vitest 补纯函数用例。

## 不做

- 不为 qid 单独拉详情落置顶（搜索结果分页语境下越权；公开页 /tiku/q/{id}/ 已覆盖直达单题）。
- 不同步「加载更多」偏移。
