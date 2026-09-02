# R280 设计：考点掌握度地图模块 tab URL 同步 + 入向深链

## 取证（生产/源码一手证据）
- 生产 12h origin 窗口无新增用户可见 5xx（04:34–04:37 的 503 簇为 R275 已收口历史形态，逐条早于 R271–R273 部署时刻）；本轮转功能差距。
- 源码实查 `pkgA/stats/mastery-map.vue`：`curMod`（模块 tab/桌面侧栏，双入口同状态）为纯本地状态——无 onLoad 恢复、无 URL 同步，刷新/复制/分享即回落第一个模块。
- R276（错题本）/R277（卷库）/R279（收藏页）后，掌握度地图是 App 内最后一个主要筛选态不进 URL 的页面（practice-history/plaza 等无筛选态；selected 考点吸底条为瞬时交互态不收）。

## 方案
1. 新增 `src/mastery-url.js` 纯函数（对齐 favorites-url.js 先例）：
   - `MASTERY_PATH = '/#/pkgA/stats/mastery-map'`；
   - `buildMasteryUrl({mod})`：mod 非空字符串则 `?mod=` encodeURIComponent，否则回落基础路径；
   - `parseMasteryOpts(opts)`：decodeURIComponent 容错（malformed 返回空），返回 `{mod}`。
2. `mastery-map.vue` 接线：
   - `onLoad(opts)`：mod 暂存 `_pendingMod`（模块列表为 API 动态数据，不能静态白名单）；
   - `applyMap(d)`：`_pendingMod` 在 `d.modules` 中真实存在才应用（对齐 R277/R279 API 白名单模式），否则回落第一个模块；
   - `curMod` watcher 经 `syncUrl()` `history.replaceState`（#ifdef H5）；默认第一个模块也外显 ?mod（状态可分享优先，与列表首模块自动选中语义一致）→ 修正：默认选中同样写 URL 会让「无参进入」立刻带参，接受（replaceState 不污染历史，且深链语义一致）。
3. 边界：cold 态（<30 题）无模块列表，_pendingMod 自然不应用；selected 考点态不收（瞬时交互）。纯前端，零后端/SSR/SEO 变化。

## 验证计划
- vitest：build/parse 组合（空/中文/malformed URI）。
- lint/build 全绿；生产 1440/375：切模块 tab/侧栏 URL 就位、?mod 深链新开页恢复选中、非法模块回落第一模块、溢出 0、console 0 error、性能预算。
