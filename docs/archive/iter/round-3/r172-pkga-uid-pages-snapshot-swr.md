# R172：分包 uid 页快照即显（真题卷库/练习历史/掌握度地图）

## 取证（2026-08-29）

- 7d 生产 RUM `slow_load` 47 条，仍以 nav:60s/90s 无 UA 族群为主（挂观察），uid API 长尾背景不变（R169 取证：mistakes 33s/daily_plan 45s）。
- 源码实证：R169/R170/R171 收口后，`snapPeek` 消费仅覆盖 stats/book/home/profile 四个主包页面；分包仍有三个 uid 数据页零快照消费：
  - `pkgA/exam/list.vue`：`/api/exam/papers?...uid=...`（带 uid 绕过公开边缘缓存）+ `/api/exam/attempts?uid=`，等待期整屏 `试卷加载中…` spinner；
  - `pkgA/stats/practice-history.vue`：`/api/practice/history?uid=`；
  - `pkgA/stats/mastery-map.vue`：`/api/mastery/map?uid=`。
- 三页数据均非日界敏感（试卷列表/带时间戳的历史会话/掌握度色格），陈旧即显无误导风险。

## 方案

对称复用 R169 已验证模式（api.js `snapPeek`，R90 apiSnap 存储/24h TTL，零后端零白名单变更）：

- list.vue `load()`：按当前 filter 拼出的完整 path 做 `snapPeek`，命中即铺 items/filters 且不出 spinner（`loading = !snap`）；`loadAttempts()` 同法。真实响应到达后覆盖，失败保留既有错误态。
- practice-history `load()`：`snapPeek` 命中先铺 items（`loaded=true` 提前），真实响应覆盖。
- mastery-map `load()`：`snapPeek` 命中先走既有 apply 路径（含 cold 分支语义不变），真实响应覆盖。

不引入新存储/并发机制；三页均为 onShow 全量重载、无分页竞态面。

## 验收

- 本地 ESLint / vitest / H5 build 全绿。
- 生产：测试 uid 建快照后拦截全部 uid API 重载，三页 1440/375 内容即显、spinner 不出、溢出 0、console 0 error；测试数据清理、保护 uid 零 mutation。
