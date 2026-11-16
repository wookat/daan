# R158：搜索请求竞态防护——慢响应乱序不再覆盖新结果

## 取证（事实）

- `search.vue` `doSearch()`：`this.result = await request(...)` 无任何请求序号/取消机制；
  输入防抖仅 400ms，连续输入（如「隧」→「隧道」）或快速切 tab 会发出多个并发请求。
- R152 实测生产短词冷路径曾达 15–20s（现已收口，但缓存被逐出时仍可能秒级）；
  网络抖动下先发请求完全可能后返回：**旧关键词/旧 tab 的结果覆盖新结果**，
  且 `saveHist`/`syncUrl`（R154/R157）随旧响应写入旧词——历史与地址栏一并被污染。
- 同类缺陷有先例：R9 错题本 `load()` 并发防护（seq 令牌丢弃过期响应）已上线验证。
- `loadMore()` 同页追加使用 `result.q`，受同一竞态影响较小但换词后旧 loadMore 返回也会串list——
  以 result 引用比对一并防护。

## 方案（对称 R9 模式）

- `doSearch()` 入口 `const seq = ++this.searchSeq`；响应返回后 `if (seq !== this.searchSeq) return;`
  过期响应直接丢弃（不写 result/不 saveHist/不 syncUrl/不清 loadErr）；
  错误分支同样只对当前 seq 生效；`loading` 只由最新请求落停。
- `loadMore()` 捕获当次 `const r = this.result`，返回后 `if (r !== this.result) return;` 防换词串写。
- 零后端、零依赖、零 UI 变化。

## 验收

- 本地：ESLint / vitest / build 全绿。
- 生产 1440/375：CDP 网络拦截把首个搜索请求人为延迟 5s，随后立即搜第二个词——
  最终展示第二个词的结果且地址栏/搜索历史只记第二个词；放行延迟响应后界面不回跳；
  溢出 0、console 0 error。
