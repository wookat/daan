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

## 发版 + 生产复验一（Pages 静态层 `index-D0Aywqly → C1NhelQ3`，favorites chunk `pkgA-social-favorites.CHuIoHvV.js`；后端 0 改动 health 仍 `ec8206e5`）

- 宿主窗口：load 15.6 / mem_avail 228MB / disk 89% / health 1.3s（比研究阶段 22.9s 好，仍宿主级慢）。只跑 4c/5/5b/6（`~/r574/pages_deploy.sh`，与 R567–R573 同做法）：bundle 一致、7 种 Accept-Encoding 全 javascript、7 条回归 200。
- A 单模块（chip 行不渲染、CTA/卡上移、F5 / 切夹保持）/ B 两模块（3 枚按 MOD_KEYS、`?mod=yanyu` F5 保留高亮、全部去 mod）/ C 深链无收藏模块（单模块 changshi + `?mod=shuliang` → 全部/数量/常识 3 枚 + 空态 + 切回全部；**我复验指令原写「2 枚」为口径错**，按函数应 3 枚）/ D 本机 local-only（阻断 POST → `id:null` 言语 + 云常识 → 3 枚，F5 保持；删 local → 单卡行隐藏）/ E 切夹不闪 / 1440 抽检：**PASS**。
- **F FAIL（既有，非 R574 引入）**：B 用户「重练全部收藏」→ 练习页 → 返回 → 取消言语云收藏：`DELETE /api/favs` 200 后卡以 `_local` 复活、仍 2 卡 / 3 枚，第二次（本机分支）删才收缩。根因：题页 `toggleFav` 与 `syncCloudFavs`（R561）都把云收藏写进本机 `favQuestions`，`favorites.vue unfav` 云分支只 `removeFav`，`load()` 合并时同题本机条目复活；小程序 `onUnfav` 同形（报告页收藏同时写本机+云）。源码早于本轮（`unfav` 未在 R574 diff 内），按「既有」归因，不另跑基线 bundle。
- **F 附带 FAIL（既有）**：练习页返回后地址栏回到旧 `?tab=note` 而 UI 在收藏 tab——R546 `book.vue` 同型（`syncUrl` `replaceState(null)` 抹 router state + `onShow` 不重写），`favorites.vue` 当年未一并修。
- 审计：API 65×200 + 1 主动 abort，超时/未终态 0；Runtime.exception / rejection 0；应用 console 2 条同一 `scrollLeft null` TypeError（练习入口，R561-1 既有 P3）。清理：本轮 `test-r574-v-%` + 研究阶段 `test-r574-shots` 11 行（mistakes 2 / favs 3 / growth 6）精确清，共享 42 行不动（细节见 testing agent 报告）。

## 热修（同 PR，`favorites.vue` + 小程序 `favorites.ts`）

- `unfav`：云条目 `await removeFav(it.id)` **成功后**再清本机 `favQuestions` 同题（`question` 相等，或 `it.id != null && x.id === it.id`）；本机条目仍只清本机；removeFav 失败 toast 不动本机。小程序 `onUnfav` 同口径（按 `question`）。
- `syncUrl`：`replaceState(window.history.state, …)` 保住 router state；`onShow` 在 `load()` 后 `if (this._pendingFolder == null) this.syncUrl()`（深链 `?folder=` 由 load 落地前让位，与 R546 `_pendingKp` 守卫同理）。
- 测试：H5 `r574-fav-module-opts.test.js` +2（10）；小程序 `fav-module-opts.test.ts` +1（7）。本地门：H5 eslint 0 / vitest 194 文件 1513 / build:h5 `index-BmUQ_r2w`；小程序 tsc / lint 0 / vitest 16 文件 80；diff --check 空。

<<<<<<< HEAD
## 生产复验二（Pages `index-C1NhelQ3 → BmUQ_r2w`，favorites chunk `pkgA-social-favorites.oBB9a3Dt.js`；后端 0 改动 health 7 次 `ec8206e5`）

- F1 云取消 375 + 1440：真实「重练全部收藏」触发 `syncCloudFavs` 写本机 → 返回 → 取消言语云收藏：各恰 1 条 `DELETE /api/favs` 200、本机 `favQuestions` 该题清除、终态 1 卡 / 行隐藏、原生 F5 保持、只读 DB 仅剩常识 4178 → **PASS**。**时序纠正**：复验一「DELETE 200 后仍 2 卡」截图实际早于 DELETE 响应；真实序列是 DELETE → `load()` 重载骨架 → 收缩（375 DELETE 9.4s + GET 4.0s，1440 0.34s + 0.29s，宿主慢）。「删后重拉」是既有设计，不是即时本地更新——我复验指令写「立即 1 卡」为口径过严，不算 FAIL。
- F2 本机 local-only（`id:null`）取消：只清本机、**0 DELETE**、云 GET 前后逐字段相等 → PASS。F3 阻断 own DELETE：网络错误 toast、2 卡 / 本机数组 / 云两行均保留（不误删本机）→ PASS。
- F4：notes→收藏→重练→返回地址栏无 `tab=note` 且 UI 收藏 tab、F5 仍收藏；`?mod=yanyu` 重练返回保留筛选与 query；`history.state` 非 null、回返前后对象相等、`position=2` 保留（`__id__` 本就不存在）；`?folder=9` 首进 / 新建夹移入后 F5 地址栏始终保留 folder、显示夹内 1 卡 → PASS。F5 回归 A 单模块隐藏 / B 3 枚 / C 空数量深链 3 枚 + 空态 + 恢复 → PASS。
- 审计：API 87 = 85×200 + 2 主动 abort，非 2xx / 超时 / 导航取消 / 未终态 0；Runtime.exception / rejection 0；应用 console 10 条全为 `scrollLeft null`（R561-1 既有）；SW harness warning 10 / controller error 5 / setup error 1 分列（等待方式、过早断言、选择器偏差，更正后核验）。身份：10 个 Document 目标 bundle + chunk，runtime / 线上 / dist hash 一致。清理：`test-r574-w-%` 0→15→0，独立 41 表 0 残留，共享 R562 42 行逐字段保持，五类 hash / papers 不变。

## 证据分类

- 已核实：8/8 单模块、`/api/favs` stale 0、chip 行静态 6 枚、375 首屏占位（截图）；生产复验一 A–E/1440 PASS、F 两条既有 FAIL（见上）；复验二 F1–F5 + 1440 F1 PASS（热修生效）。
- 推断：粉笔 / 夸克按已有分类生成筛选（凭产品使用经验，未逐版本核对）。
- UNTESTED：真机 / 小程序 `onUnfav`（仅 tsc / 源锁，R536-1 累计）、真实 SW/offline、其它浏览器、DELETE 业务 HTTP 错误分支（只测了网络阻断）、练习**完成**后返回收藏页、1440 F2–F5。
- 基础设施受阻：研究阶段宿主 load 25 / health 22.9s；复验一窗口 load 15.6 / health 1.3s 可用。
- 登记 R574-2（P3）：练习页入口 `scrollLeft null` TypeError（R561-1 既有）两轮再次出现 2 + 10 条，未修。
- 登记 R574-3（P3 UX）：收藏页取消后走 `load()` 全量重拉再收缩，宿主慢时骨架可见数秒；可改为本地先收缩再后台对账，本轮不改（涉及 R561 对账口径）。
=======
## 证据分类

- 已核实：8/8 单模块、`/api/favs` stale 0、chip 行静态 6 枚、375 首屏占位（截图）；生产复验一 A–E/1440 PASS、F 两条既有 FAIL（见上）。
- 推断：粉笔 / 夸克按已有分类生成筛选（凭产品使用经验，未逐版本核对）。
- UNTESTED：真机 / 小程序（R536-1 累计）、真实 SW/offline、深链 `?mod=` 指向无收藏模块的生产态（单测覆盖）。
- 基础设施受阻：研究阶段宿主 load 25 / health 22.9s；复验一窗口 load 15.6 / health 1.3s 可用。
- 登记 R574-2（P3）：练习页入口 `scrollLeft null` TypeError（R561-1 既有）本轮再次出现 2 条，未修。
>>>>>>> 09e72974 (R574-fix: 收藏页取消云收藏同时清本机同题（题页/对账写进 favQuestions 的条目不再在 load() 合并时复活）+ syncUrl 保留 history.state / onShow 回写地址栏（R546 同型）；小程序 onUnfav 同口径（生产复验 F 两条既有 FAIL）)
