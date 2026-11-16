# R569：错题本 cache-first 首帧按深链先落地筛选 + 到期数未同步显「—」 + 离线兜底也应用深链筛选（研究 → 论证 → 实修 → 生产复验 → D 分类）

线上基线：后端 `09d664a4`（health），H5 静态层 `index-B6W2qzqD.js`（R568，PR #748 待合入）。分支 `devin/1788996330-r569-book-cache-first-frame` 从 #748 分支开（含线上谱系与 #742–#748 未合入提交），PR #749 `0a1c36f2`。

## 研究（一手）

### ① R568-1 复现口径（源码 `book.vue load()` / `api.js`）

- `load()` 先把 `mistakesCache` 快照铺进 `items` 并 `loading=false`，之后才 `await Promise.all([/api/mistakes, /api/review])`；`applyPendingKp()` 只在真实回包后调用 → 带 `?kp/?qt` 深链 F5 时，回包前的整段时间用户看到**未筛选的缓存全量卡**（R568 生产慢 origin 下 ~30s）。
- 同一段时间 `due=[]` → 模板走 `v-else-if="items.length"` 分支显「今天没有到期错题，待掌握 N，已掌握 M」——这是对**未知状态**的假陈述（真实到期 5 题）。
- `api.js request()` GET 网络失败时回退 `apiSnap:<path>` 快照（`stale_fallback` 埋点）：`/api/review` 有快照时 `Promise.all` 仍 resolve，`book.vue` 不进 catch → 「离线兜底」分支只在两条 API 都无快照/超 TTL 时才到。这是既有分层（R90 读接口兜底），不是本轮口径。

### ② 375 我的页 / 收藏夹截图走查

复看 R568 shots + 本轮 375 截图：无 P0/P1，不立项。

## 论证结论

- 立项 ①：`applyPendingKp(provisional=true)`——缓存/当前屏幕快照铺屏后立刻按 `kp/qt/kp3` 落地筛选，但**不消费** pending 值、不校正 URL（快照没命中不代表真实数据没有）；真实回包后再 `applyPendingKp()` 终判，命不中仍 fail-closed 清筛选 + `syncBookUrl()`（R546 语义不变）。
- 立项 ②：`dueSynced` 三态——未知显 `—/—`；在线同步中 tip「正在同步今日待复习…」；真离线兜底 tip「离线中 · 今日待复习需联网后同步」；真 0 到期仍「0 题 / 0 分钟 + 今天没有到期错题」。
- 立项 ③：离线兜底 catch 分支也调 `applyPendingKp()`（对缓存终判）。
- 不立项：`apiSnap` 分层（R569-1 候选：`/api/review` 快照命中时 header 显示的是旧值而非「未知」，属 R90 既有设计，需单独论证是否要给 review 加「快照来源」标识）。

## 实修（`0a1c36f2`，仅 H5，0 后端/小程序）

- `book.vue`：`applyPendingKp(provisional = false)`；`load()` 缓存铺屏后 `applyPendingKp(true)`、真实回包后 `applyPendingKp()`、catch 兜底 `applyPendingKp()`；`dueSynced/dueTotal` 状态 + `headStats` `—` + 三态 tip。
- 测试：`tests/r569-book-cache-first-frame.test.js`（12：provisional 不消费/不校正、终判 fail-closed、kp3 优先、离线兜底、header 三态源锁）。
- 本地门：H5 vitest 189 文件 1467 / eslint 0 error（20 warn 同 main）/ build:h5（`index-CM5y2EMx.js`、`pages-book-book.CTai9rGa.js`）/ `git diff --check` 空。
- 发版：宿主仍被同机负载挤、后端 0 改动 → 同 R567/R568 只跑 Pages 4c/5/5b/6（`~/r569/pages_deploy.sh`）：Pages `6e5a2c44.kaogong-h5-zalize.pages.dev`，线上 `index-B6W2qzqD.js → index-CM5y2EMx.js`，七种编码 / 7 项回归 200；health 仍 `09d664a4`。

## 生产复验（Pages `index-CM5y2EMx.js` / 后端 `09d664a4`，`~/r569/prod/report.md`，PR #749 评论附截图）

**结论：核心项 PASS；D 重练返回 URL 丢 kp/qt FAIL——经 R568 基线复现分类为既有，非 R569 引入（见下），不判整轮 PASS。**

| 项 | 375 | 1440 | 结果 |
|---|---|---|---|
| A 带 kp/qt 深链 F5 首帧：1 张 4178 卡 + `—题/—分钟` + 「正在同步今日待复习…」，无「开始复习」/无假 0 陈述；真实回包后同 1 卡 + 5 题 / 4 分钟 / 开始复习 | ✓ | ✓ | PASS |
| B（原口径）API abort + F5：有 `apiSnap` 时 header 直接显 5/4（`request()` 快照回退，不进 catch） | 既有 | — | 既有分层 R569-1，非 FAIL |
| B′ 只删本 uid `/api/mistakes`/`/api/review` 两条快照、保留 `mistakesCache` → 离线 banner + 1 卡 + `—/—` + 「离线中 · 今日待复习需联网后同步」；恢复 F5 回 5/4 | ✓ | — | PASS |
| C 旧缓存命中、真实数据已删：删 4178 → 首帧缓存 1 卡 → 回包后清 `qt` 保 `kp=法律` 显民法；再删民法 → 回包后清 kp/qt 保 mod | ✓ | — | PASS（fail-closed 不变） |
| D0 真 0 到期：PATCH 已掌握 → GET review `items=[] total=0` → F5 显 `0 题 / 0 分钟` + 「今天没有到期错题，待掌握 0，已掌握 1」，非 `—` | ✓ | — | PASS |
| R568 A 更多操作标题「法律 · 个税 · 更多操作」 | ✓ | ✓ | PASS |
| R567/R568 法律四值：库内 `法律-个税` / 显示 `个税` / URL `qt=法律-个税` / redo `qtype=法律-个税` → 200 恰 [4178] 进 1/1 | ✓ | ✓ | PASS |
| **D 重练返回**：筛选态 → F5 → 更多操作开/X → 重练 → 页头返回：UI 仍 1 卡「法律 · 个税」，URL 只剩 `?mod=changshi` | ✗ | ✗ | **FAIL（既有，→ R570）** |
| R568 C1 关层后地址栏改 hash / `location.hash` 到统计页：留统计页，一次 Back 回错题本 | ✓ | ✓ | PASS |
| R568 C2 关层后 Back（Alt+Left / go_back）一次到首页 | ✓ | ✓ | PASS |
| R568 C3 层开着 Back：关层留本页、深链 URL 保留 | ✓ | ✓ | PASS |
| 部署身份：线上 index/book 与本地 dist SHA256 一致；17+17 次 Script 请求全为新文件名 | ✓ | ✓ | PASS |
| 清理：`test-r569-%` 41 表 0 残留；共享 R562 42 行 / 保护数据不变 | ✓ | — | PASS |

- 审计：291 API = 231×200 + 60 有意 abort（23 条 12/15s 超时形态 + 14 条导航伴随 + 其余 harness 路由 abort），非 2xx 0；console error / runtime exception / unhandledrejection 0；17 条 SW 注册 warning 为 Playwright harness。
- 录像：`~/screencasts/r569-cache-375/r569-cache-375-clean.mp4`、`~/screencasts/r569-cache-1440/r569-cache-1440-edited.mp4`、`~/screencasts/r569-offline-zero-375/r569-offline-zero-375-edited.mp4`、`~/screencasts/r569-zero-due-375/r569-zero-due-375-edited.mp4`。
- 未验：小程序/真机（R536-1 累计）、真实 SW offline、其它浏览器、跨设备、`kp3` 专项、B 原口径下 review 快照来源标识（R569-1）。

## D 分类：R568 基线同复现 → 既有，非 R569 引入（`~/r569/repro_d.py` / `seed_d.py`）

- 方法：生产同结构 5 条 fixture 专用 uid `test-r569-d-1788997993`（`seed_d.py`，`X-Kg-Probe: 1`）；本地 `http.server` 分别服务 R568 dist（`~/r568` 构建，port 8568）与 R569 dist（port 8571），GET `/api/**` 只读转发生产、非 GET 本地 200 不写生产；Playwright 复走 testing agent 同序列（首页底栏 → 错题本 → 常识 chip → 筛选层 法律/个税/完成 → F5 → 更多操作开/X → 重练 → 页头返回），`window.__hist` 钩子逐条记 pushState/replaceState/popstate/hashchange + 调用栈。
- 结果：**两套 bundle 最终 URL 都是 `?mod=changshi`、UI 都仍是 1 张个税卡**（`~/r569/d-repos-agentpath/log.json` = R568、`~/r569/d-r569-agentpath/log.json` = R569）。
- 事件序列（两套一致）：`pushState practice` → 页头返回 → `popstate(dummy2 全筛选)` → `book.vue onShow syncBookUrl replaceState(全筛选)` → `popstate(dummy1 全筛选)` → `popstate(real ?mod=changshi)` 止。**没有任何 replaceState 抹掉 kp/qt**：哑条目是 `sheetOpened()` 在开层那一刻 URL 上 push 的，层内改筛选 `syncBookUrl()` 就地改的只是最上面那条（哑条目），本页真条目的 query 停在开层前的 `?mod=changshi`；R563-fix-2 链式补跳逐条跳过已关哑条目落到真条目 → 自然回到旧 query。
- 结论：既有（自 R562 哑条目设计起，R563-fix-2 让它在「深页返回」路径可见），非 R569 引入；R569 不改，单独立 R570 修（落地真条目时通知页面对齐 URL）。
- 一手 vs 推断：两套 bundle 复现与事件序列是一手；「R562 起即存在」是按源码演进推断（R562 前无哑条目，此形态不可能出现）。

## 教训（已入 SKILL）

- 「离线」复验必须先看 `apiSnap` 两层：`request()` 快照回退与页面 catch 兜底是两个状态，指令要写清用哪一层、并按 uid 精确删对应快照键。
- 生产 FAIL 归因必须做同 fixture 同流程的**基线 bundle 复现**再下结论；History 类问题用 `pushState/replaceState/popstate/hashchange` 钩子 + 调用栈逐条对账，「最终 URL 变了」≠「有人改写了 URL」。
