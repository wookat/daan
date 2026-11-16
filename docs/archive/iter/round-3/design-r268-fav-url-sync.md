# R268 设计：申论素材「收藏」视图 URL 同步 + ?fav=1 入向深链

## 取证（生产 + 源码一手证据）

- R261–R263 已把申论专区 paper/qtype/year/region/tab/mtype/mid 全部筛选态双向同步 URL（可复制/刷新/分享）。
- 源码实查 `shenlun.vue`：素材 tab 的「收藏」视图（`favOnly`）是唯一剩余不同步 URL 的筛选态——`toggleFavOnly()` 只翻转本地状态，`buildShenlunTabUrl(tab, mtype)` 不感知 fav，onLoad 也不收 `?fav` 参数。
- 后果：用户切到收藏视图后复制链接/刷新，回到的是素材全量列表；收藏视图不可分享、不可从外部直达。

## 方案

- `shenlun-url.js`：`buildShenlunTabUrl(tab, mtype, fav)` 增第三参，`tab === 'm' && fav` 时输出 `?tab=m&fav=1`（收藏视图不叠 mtype——视图本身不按类型过滤，与 UI 行为一致）。
- `shenlun.vue`：
  - `filterUrl()` 素材 tab 传 `this.favOnly`；
  - `toggleFavOnly()` 后调 `syncFilterUrl()`；`setMtype()` 已清 favOnly，既有 sync 自然回落；
  - onLoad `tab === 'm'` 分支收 `opts.fav === '1'` 置 `favOnly = true`（与 mid 置顶互不冲突：mid 走全量列表路径，fav 走本地收藏，两者并存时 fav 优先级低，保持 mid 行为不回退——实现上仅在无 mid 时应用 fav）。

## 不做

- 不改后端/SSR/SEO（hash 深链不新增可收录 URL）。
- 不做收藏列表分页/搜索。

## 验证

- vitest：buildShenlunTabUrl fav 组合（fav=true/false、tab!=m 忽略）。
- 本地 lint / vitest / build 全绿。
- 生产 1440/375：切收藏视图 URL 带 ?tab=m&fav=1、刷新后收藏视图保持、切类型 chip 回落、?fav=1 深链直达；溢出 0、console 0 error、性能预算全过。
