# R575 · 收藏页取消收藏先本地收缩、再后台对账 + 旧快照不覆盖手上的真实列表（H5 + 小程序）

分支 `devin/1789025509-r575-fav-local-shrink` 从 #754 分支开；H5 + 小程序，0 后端。

## 研究（一手，生产只读；`~/r575/q575.sh` … `q575e.sh`、`shots.py`）

- 宿主：`load 16.72 / 18.38 / 18.51`、`mem_avail 66MB`（buff/cache 314）、`disk 42G/50G 89%`、health `1.63s`——宿主级慢持续（非本产品代码，R568 起累计）。
- `ec8206e5` 后自然远端样本：`practice_progress` 非测试 = `(null)` 2 题 / `link` 3 题 / `redo` 1 题，**窗内 0 行新增**、`daily` 列仍 0 行；`stale_fallback` 自 ec8206e5 后 **0 条**（7 天仍是 R571 那 20 条 / 2 uid）；`question_favs` 窗内 0 新增、`unfav`/`fav%` 事件 0。正确结论只能是「所选窗口内无合格自然样本」，不能推「每日一练/跨设备续练无人用」。
- 7 天事件榜：`boot 195/188`、`heatmap_view 69/27`、`stale_fallback 20/2`、`share_open 10/9`、`daily_open 3/3`、`slow_load 3/2`、`practice_quit_end 2/2`。
- Caddy（仅 `kaogong-origin.zalize.com-access.log*`，禁止聚合同机他域）：7 天 `/api/track` 2336 条；剔除 DB 探针 uid / `X-Kg-Probe` / 已知自动化 UA 后 2 天窄窗**似自然 13 条**（5 类 UA、12 IP、全 200、6ms–6177ms）。这组样本不构成 daily/redo/收藏缺陷证据，只说明宿主慢时单请求可到 6s 量级。
- 375 生产截图（`~/r575/shots/`，游客 375×812@2x）：首页首屏 = 顶栏「刷题」+ 选择考试/搜索 + hero「免注册立即开练」+ 欢迎条 + 学习计划卡 + 专项练习首卡；我的页 = 未登录卡 + 三计数 + 连续打卡 + 学习列表（我的收藏 0 题）——两页无 P0/P1、无溢出/遮挡。**我脚本里写的 `#/pkgA/daily/daily` 是不存在的路由**（`pages.json` 无独立每日一练页，真实入口是 `home.vue startDaily()` 走练习页），该截图为空白页是研究脚本错误、不是产品缺陷；每日一练 375 走查改由生产复验在登录态从首页 CTA 进入完成。
- 源码（R574-3 相关）：
  - `favorites.vue load()`：每次 `loading = true` 铺 `kg-skeleton`，`Promise.all([fetchFavFolders(), fetchFavs()])` 回包后整份 `items/folders` 覆盖；`unfav` 云条目 `await removeFav` → 清本机 → `this.load()`。R574 复验坐实 375 DELETE 9.4s + GET 4.0s 期间用户先见整屏骨架、卡才收缩。
  - `fetchFavs()`/`fetchFavFolders()` 走普通 `request()`：GET 网络失败/超时会以 `apiSnap` 旧快照 **resolve**（`staleAt(data)` 可辨身份），而这份快照是 DELETE **之前**上次成功 GET 的镜像——取消后 `load()` 若吃到旧快照，会把刚删的题**原样铺回**，与 R561-fix「收藏对账只用真实回包」同一类问题（R561 只修了题页 `syncCloudFavs`，收藏页 `load()` 未覆盖）。生产 `/api/favs%` `stale_fallback` 至今 0 条 → 这条是**机制推断 + 本地可复现**，不是生产观测到的缺陷。
  - 模板错误态 `v-else-if="favErr"` 不看 `items.length`：已有列表在手时后台刷新失败会把整页换成「加载失败」空态。
  - 小程序 `favorites.ts load()/onUnfav` 同形（`loading: true` 铺骨架 → 全量覆盖；wxml `wx:elif="{{favErr}}"` 同样不看 hasItems）。

## 论证

- 问题真实性：R574 复验一/二在真实生产各观测一次「DELETE 200 后先骨架数秒再收缩」（375：DELETE 9.4s + GET 4.0s；1440：0.34s + 0.29s 感知不到）。宿主慢是外因，但既有设计让**已经成功的操作**在用户眼前退回「加载中」，是可用性问题（P3 UX，R574-3 登记）。
- 是否值得改：改动纯前端、不动 `fetchFavs`/`removeFav`/本机 `favQuestions` 口径/URL 语法/后端；新增一枚纯函数 + 两处接线；同时顺手补上旧快照回滚这条 R561 同型漏洞。收益在宿主慢时最明显（正是当前生产常态）。
- 方案（H5/小程序同口径）：
  1. **DELETE 成功 → 清本机 → `dropFavItem` 本地收缩 → `load()` 后台对账**。收缩严格在 `await removeFav` 成功之后（失败路径不动可见列表、不动本机，R574 F3 语义不变）。
  2. `dropFavItem(items, folders, it)`：按**对象身份 / 非空 `id` / `_lkey`** 匹配，**不按题干**——同题干「本机 + 云端」两条并存时只删被点的那条（另一条由 `load()` 对账决定去留）；所属夹计数减一（`n > 0` 才减）。
  3. `load()` 已有列表时 `loading = !items.length` 不铺骨架，列表原地更新；错误空态只在 `!items.length` 时出现（有列表时只 toast）。
  4. H5 挂 `snapshotViewMixin({ noun: '收藏', reload: 'load' })`：两回包逐一 `noteSnapshot`；**若任一回包是旧快照且本页已有过真实回包（`_liveAt`）→ 不覆盖列表、只显示「网络不稳定 · 展示 N 前缓存的收藏」横幅 + 重试**；首次加载（无 `_liveAt`）拿到旧快照仍照常铺屏（有胜于无，横幅如实提示）。全真实回包才 `settleSnapshotRound()` 并刷新 `_liveAt`。
  5. 小程序无 `staleAt`/apiSnap 机制（`wx.request` 直连），只做 1–3。
- 逐项讨论（设计要求）：
  - 失败注入：DELETE 网络错误/HTTP 错误 → `catch` toast，`dropFavItem` 未执行（位于 `try` 内 `await` 之后）→ 可见 / 本机 / 云三方不变。
  - 慢 DELETE：等待期与现状一致（按钮无 loading 态，未改）；成功瞬间收缩，不再等 GET。
  - 慢 GET：收缩已发生，`load()` 回包晚到时按真实数据整份覆盖——真实回包已不含该题，不会复活。
  - 旧快照 GET：见 4；对账用真实回包，旧快照在已有真实列表时只提示不覆盖，消除「刚删的题铺回」。
  - 本机/云身份：不按 `question` 收缩；本机 `favQuestions` 同题清理仍按 R574 口径（`question` / `id`）在 DELETE 成功后做，故 `load()` 合并时不会从本机复活。
  - 回滚/恢复：任何一次真实 `load()` 都是全量对账，本地收缩不留持久状态；横幅「重试」= `load()`；`online` 事件自动重拉（mixin 既有）。
  - 折叠态：`dropFavItem` 过滤保留其它条目的对象引用，`_open` 不丢；`load()` 覆盖后 `_open: false` 与现状一致。
- 否决：
  - 「不 `load()`，只本地收缩」：丢掉 R561 云对账（其他设备取消/新增在本页不可见），否。
  - 「DELETE 前先收缩（乐观删除 + 失败回滚）」：R574 F3 语义（失败不动）要改、需回滚状态机，且 DELETE 成功率高时收益差不大，否。
  - 「全站 `snapshotViewMixin`」：维持 R572/R573 结论，本轮只接收藏页（有具体机制缺陷）。

## 实修

- H5 `src/fav-list.js` `dropFavItem(items, folders, it) → { items, folders }`；`pkgA/social/favorites.vue`：横幅 + `loading = !items.length` + 错误空态 `favErr && !items.length` + `beginSnapshotRound / noteSnapshot / _liveAt 守卫 / settleSnapshotRound` + `unfav` 收缩接线 + `.offbar` 间距。
- 小程序 `utils/fav-list.ts` 同实现；`favorites.ts` `load()` `loading: !this.items.length`、`onUnfav` 收缩 → `render()` → `load()`；`favorites.wxml` 错误态 `favErr && !hasItems`。
- 测试：H5 `tests/r575-fav-list-reload.test.js`（纯函数 5 + 源锁 4 + 小程序源锁 1）；小程序 `scripts/fav-list.test.ts`（2）。R549 源锁 `mixins: [segResizeMixin],` 字面断言放宽为正则（`segResizeMixin` 仍须是首个 mixin），因收藏页现在挂两个 mixin。
- 本地门：H5 eslint 0 / vitest 195 文件 1523 / build:h5 `index-DCzSOweZ`；小程序 tsc / lint 0 error / vitest 17 文件 82；`git diff --check` 空；0 后端。

## 证据分类

- 已核实：宿主指标；ec8206e5 后 daily/redo/stale/favs 窗内 0 自然样本；Caddy 似自然 13 条全 200、最长 6.2s；375 首页/我的首屏无 P0/P1；`load()`/`unfav`/`request()` 旧快照 resolve 机制（源码）；R574 两轮观测到的骨架时序。
- 推断：旧快照铺回刚删的题——机制成立、生产 `/api/favs` 无 stale 样本（复验将用阻断 GET 注入验证）；「用户会把骨架当操作失败」是 UX 推断。
- UNTESTED（发版前）：生产 UI（375/1440）取消收缩时序、阻断 GET 旧快照不覆盖、阻断 DELETE 三方不变、同题干本机+云并存只删一条、小程序真机（R536-1 累计）、每日一练 375 走查（本轮研究脚本路由错，待复验补）。
