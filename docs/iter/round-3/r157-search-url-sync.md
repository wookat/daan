# R157：搜索页 URL 同步——搜索即产出可分享/可刷新深链

## 取证（事实）

- R156 已让搜索页**消费** `?q=` 深链（onLoad 自动搜索），并提供 `/tiku/search?q=` SEO 跳板。
- 但源码核查（search.vue 全文无 `replaceState`/`location.hash` 写入）：用户在页内输入搜索**不产出**深链——地址栏始终停留在进入时的 URL；
  - 复制地址栏分享 → 对方打开是空闲态（或旧关键词），与用户所见不一致；
  - 刷新/标签页回收恢复 → 当前搜索词与结果全部丢失，回到闲置态；
  - 切换 tab（题目/考点/试卷）同样不反映在 URL。
- 竞品对标：夸克公开刷题搜索页 URL 携带 query，可直接复制分享/刷新还原；浏览器语境下「地址栏即状态」是 web 搜索的基本预期。
- 既有模式：api.js 已两处使用 `window.history.replaceState`（R60 兜底/R102 深链归一化），H5-only 守卫模式成熟。

## 方案

`search.vue` 内新增 `syncUrl()`（H5-only，`typeof window` 守卫）：

- `doSearch()` 成功（含失败？——否，仅成功后同步，与 saveHist 同时机）后：
  `history.replaceState(null, '', '/#/pkgA/search/search?q=<enc(q)>' + (tab!=='all' ? '&tab='+tab : ''))`
- 清空输入（sclear）时同步回 `/#/pkgA/search/search`（无 query）。
- 用 replaceState 而非 pushState：不污染返回栈（uni 返回行为不变）。
- 纯前端、零后端、零新依赖；非 H5 平台 no-op。

## 验收

- 本地：ESLint / vitest / build 全绿。
- 生产 1440/375：
  1. 进搜索页输「隧道」→ 地址栏变为 `/#/pkgA/search/search?q=%E9%9A%A7%E9%81%93`；
  2. 刷新 → 关键词回填 + 自动出结果（R156 onLoad 路径）；
  3. 切 tab=题目再搜 → URL 带 `&tab=question`，刷新后 tab 保持；
  4. 清空 → URL 回到无 query；
  5. 返回键行为不变（不多出历史条目）；溢出 0、console 0 error。
