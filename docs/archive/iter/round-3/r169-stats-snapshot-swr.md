# R169 学习统计页快照即显（客户端 stale-while-revalidate）

## 取证

- 7d 生产 RUM（growth_events.slow_load）中真实用户 uid 专属 API 长尾：
  `mistakes:33321`、`daily_plan:45484`、`events:14818`、`questions:9016–13564`、`history:8732`（毫秒）。
- uid 专属端点带 `uid` 参数，边缘缓存规则天然绕过（R56/R168 只覆盖公开确定性内容），
  origin 共享宿主（2 vCPU/1.9GB，load ≈6）争抢窗口的长尾无法在边缘层消除。
- R63 已有 GET 12s 超时 + 20s 重试，R90 已有「双超时后回退最近成功快照」——
  但快照只在**双超时失败后**才启用：用户仍要先盯 12–32s 骨架/空白才能看到内容。
- 统计页（tabbar 一级页）onShow 并发 6 个 uid 网络请求（stats/mistakes/growth/recommend/review/shenlun-stats），
  全部命中长尾时首屏内容区长时间空白，而本地明明存有上次成功快照。

## 方案

镜像 R168 边缘 stale-while-revalidate 语义到客户端：

1. `api.js` 导出 `snapPeek(path)`：同步读取该 path 的最近成功快照（沿用 R90 的
   `apiSnap:` 存储、24h TTL、`snapCacheable` 白名单），无快照返 null。
2. 统计页各网络加载入口先 `snapPeek` 即显快照数据，随后照常发起请求，
   真实响应到达后覆盖；请求失败时屏上已有快照数据，错误卡因 `loadErr && !byModule.length`
   条件自然不出现，toast 照旧提示。
3. 不改 `request()` 语义、不改超时/重试/快照落盘路径、零后端。

## 验收

- 本地 ESLint/vitest/build 全绿。
- 生产 1440/375：首访（无快照）行为不变；二访拦截 uid API（模拟长尾）时
  统计页内容区立即呈现上次数据，放行后被真实数据覆盖；console 0 error、溢出 0。
