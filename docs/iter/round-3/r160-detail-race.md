# R160：搜索详情展开竞态——慢响应晚归不再回跳到旧题

## 取证（事实）

- 生产实测（1440，CDP 将第 1 题详情响应延迟 4s）：点开第 1 题后立即点第 2 题，
  第 2 题详情正常展开；4s 后第 1 题慢响应晚归 → 详情**回跳到第 1 题**、第 2 题详情被关闭
  （mid open=[0,1,0] → fin open=[1,0,0]）；
- `search.vue` `toggleDetail()` await 后无条件 `this.detail = d`，无「用户当前想看哪题」判断；
- R158/R159 已收口 doSearch/loadMore 两条竞态路径，本条是搜索页最后一条异步写状态路径。

## 方案（零后端、零依赖）

- 新增 `detailWant`（用户最近一次点击想展开的题 id）：
  - 点击展开：`this.detailWant = it.id`，响应返回后 `if (this.detailWant !== it.id) return;`；
  - 点击收起：`this.detailWant = null`；
  - 错误 toast 同样仅对当前目标生效；
- doSearch 清空 detail 时同步清 `detailWant`。

## 验收

- 本地 ESLint / vitest / build 全绿；
- 生产 1440/375：延迟第 1 题详情响应，点 1 再点 2 → 最终仅第 2 题详情展开、不回跳；
  正常展开/收起回归；溢出 0、console 无非预期 error。
