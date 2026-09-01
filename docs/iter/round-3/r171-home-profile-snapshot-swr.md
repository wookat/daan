# R171 首页/我的页快照即显（客户端 stale-while-revalidate 收口 tab 级页面）

## 取证

- R169（统计页）/R170（错题本）已把「先渲染最近成功快照、真实响应覆盖」带到两个
  tab 级页面；一手核查其余 tab 级页面：
  - 首页 `loadHome()` 走 `/api/home_bundle?uid=`（uid 专属、绕过边缘缓存），
    长尾期间「今日任务/学习计划/连续打卡」等个性化卡整段停留默认空值；
  - 我的页 `loadRemote()` 串行 4 个请求（mistakes 计数/profile/growth 均 uid 专属），
    长尾期间错题数/成长值/备考画像停留 0/空。
- 两页均无 spinner 遮挡（静态壳先出），但个性化数据回填慢；R90 快照已经在
  `request()` 成功路径落盘（`apiSnap:` 24h），只差消费侧先读。

## 方案（对称 R169/R170）

- 首页 `loadHome()` 起始处 `snapPeek('/api/home_bundle?uid=…')` 命中即先按
  既有 apply 流程铺屏，随后真实响应覆盖；失败回退分支不变。
- 我的页 `loadRemote()` 三个 uid 请求各自先 `snapPeek` 铺屏再照常 request 覆盖
  （announcement 为公开端点、已走边缘缓存，不动）。
- 不改 request() 语义、不新增存储键、不扩大快照白名单。

## 验收

- 本地 ESLint/vitest/build 全绿。
- 生产 1440/375：二访拦截 uid API 时首页个性化卡与我的页错题数/成长值立即
  呈现上次数据；放行后被真实数据覆盖；console 0 error、溢出 0；
  测试数据清理、保护 uid 零 mutation。
