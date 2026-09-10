# R574 · 收藏与笔记页模块筛选只列本人有收藏的模块（H5 + 小程序）

分支 `devin/1789019269-r574-fav-module-chips` 从 #753 分支开；H5 + 小程序，0 后端。

## 研究（一手，生产只读；`~/r574/q574.sh` / `q574b.sh`）

- 宿主：`load 1.14→25.65`（两次探测间隔 13 min）、`mem_avail 355MB`、`disk 42G/50G 89%`、health `0.17s → 22.9s`——宿主级慢持续（非本产品代码），R568 起累计，需老板/运维扩容或限流他家。
- `ec8206e5` 后自然远端样本：`practice_progress` 非测试 3 行 = `(null)` 2 题 / `link` 3 题 / `redo` 1 题，`daily` 列 **0 行**（每日一练跨设备续练尚无自然样本）；`stale_fallback` 自 R573 上线后 **0 条**，14 天非测试仍是 20 条 / 2 uid（`2026-09-05 08:19` 起、宿主 503 窗一次冷启 17 端点），`/api/favs%` 端点**从未**出现（含测试 uid）；`fav%` 事件 0（`fav_ask_click` 无自然样本）。
- 收藏（`question_favs` 非测试）：**8 行 / 8 uid，每人恰 1 题、1 模块**；模块分布 常识 2 / 判断 2 / 资料 2 / 数量 1 / 言语 1；`fav_folders` 1 行 / 1 uid；`notes` 5 行 / 5 uid。
- 生产截图（`~/r574/shots*.py`，uid `test-r574-shots` 3 收藏，375×812@2x + 1440）：我的页「我的收藏 3题」→ `book?tab=fav` 三卡；`#/pkgA/social/favorites` 375 首屏 = 分段控件 + 默认收藏夹卡 + **模块 chip 行 6 枚**（全部模块 / 资料分析 / 数量关系 / 言语理解 / 判断推理 / 常识判断，时政溢出需横滑）+「重练全部收藏（3 题 · 乱序）」+ 三卡；API 36 条全 200、console / pageerror 0。
- 源码：H5 `favorites.vue modOpts()` 与小程序 `favorites.ts data.modOpts` 都是**静态**「全部模块 + MOD_KEYS 6 模块」，与本人收藏无关；点一枚无收藏的模块 → `kg-empty-state`「这个筛选下还没有收藏 · 换个收藏夹或模块看看」。

## 论证

- 样本：8/8 自然用户收藏只落 1 个模块 → 生产上模块筛选行对**全部**真实用户都是 6 枚里 5 枚点了必空的死 chip，375 下占首屏一行（≈44px）+ 横滑，且把「重练全部收藏」主 CTA 与卡片往下压；深链 `?mod=` 只由本页自身写出（`favorites-url.js`），外部无入口。
- 对标：粉笔 / 夸克收藏夹的分类筛选按已有收藏的分类生成、无内容的分类不出现；筛选项由数据派生是通用做法。
- 方案：`favModuleOptions(items, modFilter, keys, label)` 纯函数——`全部模块` + 只保留 `items` 中出现过的模块（按 MOD_KEYS 原顺序），深链正在筛的模块即使暂无收藏也保留（给「全部模块」退路，避免空态死锁）；可选项 < 2（即 `opts.length <= 2`）时整行不渲染（只有 1 个模块时筛选没有意义）。H5 / 小程序同一口径；`present` 取全部 `items`（不受收藏夹筛选影响，避免切夹时 chip 行闪动）。
- 对比现状：有 ≥2 模块收藏的用户看到的 chip 只少了空模块，筛选语义 / URL `?mod=` / 空态文案不变；1 模块用户少一行死控件。不改 `fetchFavs`/`syncCloudFavs`/本地合并/收藏夹逻辑。
- 否决 / 登记：
  - **R574-1（P3，登记不做）**：`favorites.vue load()` 走 `fetchFavs()`/`fetchFavFolders()` 普通 `request()`，宿主慢时 `apiSnap` 旧快照 resolve → 页面无「缓存」提示（R571/R572 同型）；生产 `/api/favs%` `stale_fallback` 0 条（含测试 uid）→ 无自然证据不接 `snapshotViewMixin`，出现 ≥1 条自然样本再论证。
  - **R573-1（P3）** 首页续练卡 `netOnline` 非响应式 / 无重试：本轮无新样本，维持登记。
  - 我的页 `snapPeek + request` 展示型字段：R572/R573 结论不变（不做全站 banner）。
  - chip 上带数量（「常识判断 2」）：8/8 单模块用户下仍是死行，不解决主问题，不做。

## 实修

- H5 `src/fav-module-opts.js`：`favModulePlan(items, modFilter, keys, label) → { opts, visible }`。`opts` = 「全部模块」+ 按 keys 顺序只列 items 中出现的模块，当前 `modFilter` 即便 0 条也保留（否则空态无从切回全部）；`visible = opts.length > 2 || (modFilter && !present.has(modFilter))`——单模块且筛选未排除任何收藏才隐藏（设计阶段写的纯 `opts.length > 2` 会在「单模块 + 深链指向另一模块」时把行隐掉，用户困在空态，实时修正）。
- H5 `pkgA/social/favorites.vue`：`modPlan` 计算属性 = `favModulePlan(this.items, this.modFilter, MOD_KEYS, modName)`（按全部 items 非当前夹，切夹不改 chip 行），`modOpts` / `modChipsVisible` 取自它；chip 行 `v-if="modChipsVisible"`。`shownItems` / `load()` / URL 同步不动。
- 小程序 `utils/fav-module-opts.ts` 同实现；`favorites.ts render()` 每次按 `this.items` + `modFilter` 算 plan，与 rows 一起 `setData({ modOpts, modChipsVisible })`，`data.modOpts` 初值只剩「全部模块」；`favorites.wxml` chip 行 `wx:if="{{modChipsVisible}}"`。
- 测试：H5 `tests/r574-fav-module-opts.test.js`（8：纯函数 6 + 源锁 2）；小程序 `scripts/fav-module-opts.test.ts`（6）。
- 本地门：H5 eslint 0 / vitest 194 文件 1511 / build:h5；小程序 tsc / lint 0 / vitest 16 文件 79；`git diff --check` 空；0 后端。

## 证据分类

- 已核实：8/8 单模块、`/api/favs` stale 0、chip 行静态 6 枚、375 首屏占位（截图）。
- 推断：粉笔 / 夸克按已有分类生成筛选（凭产品使用经验，未逐版本核对）。
- UNTESTED：真机 / 小程序（R536-1 累计）、真实 SW/offline、深链 `?mod=` 指向无收藏模块的生产态（单测覆盖）。
- 基础设施受阻：宿主 load 25 / health 22.9s，生产复验窗口需择时。
