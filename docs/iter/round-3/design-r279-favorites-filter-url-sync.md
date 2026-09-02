# R279 设计：收藏与笔记页 tab/收藏夹/模块筛选 URL 同步 + 入向深链

## 取证（生产/源码一手证据）
- 生产 12h origin 窗口无新增用户可见 5xx（04:34–04:37 的 503 簇与 09-01 即时 502 均为 R257/R265/R271–R273 前的已收口历史形态，X-Kg-Fetch/时刻对照复验）；本轮转功能差距。
- 源码实查 `pkgA/social/favorites.vue`：`tab`（收藏题目/我的笔记）、`folderId`（收藏夹选择）、`modFilter`（模块 chips）均为纯本地状态——无 onLoad 恢复、无 URL 同步，刷新/复制/分享即丢。
- R276（错题本）/R277（真题卷库）/R278（SSR 深链）后，收藏页是 App 内剩余未闭环的主要筛选态页面。

## 方案
1. 新增 `src/favorites-url.js` 纯函数（对齐 book-url.js 先例）：
   - `FAVORITES_PATH = '/#/pkgA/social/favorites'`；
   - `buildFavoritesUrl({tab, mod, folder})`：`tab=note` 时不叠 fav 侧参数（与 UI 一致）；`mod` 按 MODS 六键白名单（含中文键「时政」encodeURIComponent）；`folder` 为 ≥0 整数（0=默认夹合法）；全默认回落基础路径。
   - `parseFavoritesOpts(opts)`：白名单校验 + decodeURIComponent 容错（malformed 不抛错）。
2. `favorites.vue` 接线：
   - `onLoad(opts)`：`tab=note` 直接切笔记 tab；`mod` 静态白名单立即应用；`folder` 暂存 `_pendingFolder`，`load()` 收藏夹列表返回后按真实 folders 校验存在才应用（对齐 R277 API 白名单模式）。
   - `tab/folderId/modFilter` watcher 统一经 `syncUrl()` `history.replaceState`（#ifdef H5，不污染历史）。
3. 边界：不收 `_open` 展开态（列表项无稳定短 id）；纯前端，零后端/SSR/SEO 变化。

## 验证计划
- vitest：build/parse 全组合（note 不叠参、时政编码、folder 0/负数/非整数、malformed URI）。
- lint/build 全绿；生产 1440/375：切筛选 URL 就位、深链刷新恢复、非法参数与无参一致、溢出 0、console 0 error、性能预算。
