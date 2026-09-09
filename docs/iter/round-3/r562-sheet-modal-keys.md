# R562：`kg-sheet` 键盘模态（Esc / Tab 圈定 / 焦点归还）+ 浏览器 Back 先关层不离页——三个代表页实测先行；R560-5 LCP 复采归因；小程序收藏 tab 本机写入审计

日期：2026-09-09。生产 rev `2c0868b3`（#734），分支 `devin/1788950727-r562-sheet-modal-keys` 从 main `55a91d3c`（#735 合入后）开。

## 1. 研究范围（R561 handoff ①②③）

① R560-1 `kg-sheet` 键盘模态：先在 3 个代表页（错题本「更多操作」/「筛选与排序」/「手录错题」）**实测**再论证全量；② R560-5 `/` LCP 复采归因（R561 发版二 3272ms / a11y 0.94，`/tiku/` 全 1.00）；③ 小程序收藏 tab cloud-only 是否需保留本机时政收藏（先核有无本机写入）；④ 自然样本在分发到位前只登记。

## 2. 一手核实（verified）

### 2.1 `wd-popup`（node_modules 已装版本源码）

- `closeOnClickModal` 默认 `true`，遮罩点击 `handleClickModal()` → `close()` → emit `close` + `update:modelValue(false)`。
- **没有**：Escape、Tab 圈定、焦点捕获/归还、popstate。关闭后内容 `display:none`（不卸载）。
- 编译后 DOM（本地 build 产物 + CDP 实测）：`.wd-popup-wrapper > [.wd-overlay, .wd-popup.kg-sheet]`，两者 `position:fixed; z-index:1000`，遮罩是 popup 的**同级兄弟**（不是父级）。

### 2.2 既有全局焦点栈 `a11y-focus.js`（R530 起）

只扫 `.mask`（export-confirm 一处），Esc → 对 mask 派发 click；Tab 圈定 `[tabindex]`；焦点栈 `lastFocus = document.activeElement`。`kg-sheet`/`wd-datetime-picker` 完全不在栈内。

### 2.3 修前基线（R560 生产走查 + 本地 R561 bundle 复现）

| 流程 | Esc | Tab | Back | dialog 语义 |
|---|---|---|---|---|
| 更多操作 / 筛选 / 手录 | 不关 | 落到背景页 | 直接离开错题本回首页 | 无 role/aria-modal/name |

### 2.4 小程序收藏 tab 本机写入审计（③）

`miniapp-native` 全仓 `favQuestions` 写入方**仅 1 处**：`pkgExam/report/report.ts toggleDetailFav`（模考报告题详情星星）——本机 + `addFav/deleteFav(d.question_id)` 双写；报告项来自 `exam_papers.question_ids`（`exam_api.py` 每项带 `question_id`，恒非空）→ **小程序本机 favQuestions 永远有云端对应行**。练习页 `onToggleFav` cloud-only；申论收藏走独立 `QFAV_*/MFAV_*` 键与收藏 tab 无关。`pkgSocial/favorites.ts load()` 的本机合并在小程序侧实际是空集（只对 H5 写的 `id:null` 时政条目有意义，而那些条目不在小程序设备上）。
**结论**：小程序收藏 tab cloud-only 不丢任何本机收藏，**不立项**、0 改动；登记为已审计。

## 3. 设计论证 → 方案

修在哪一层（三选一）：

| 方案 | 覆盖 | 风险 |
|---|---|---|
| A 页面级（每个使用点自己接 keydown/popstate） | 29 处逐个改 | 漏改、口径漂移，`book.vue` 已有一处页面级 Escape（仅 ≥1024） |
| B `kg-sheet` wrapper 内做焦点/键盘 | 29 处 KgSheet | `wd-datetime-picker`（首页/提醒设置 2 处）不覆盖；与全局 `.mask` 栈两套叠层顺序不一致 |
| **C 全局栈把 `.wd-popup` 与 `.mask` 同入一栈 + wrapper 只管 history** | 29 KgSheet + 2 datetime-picker + 1 mask，叠层顺序唯一 | Esc 对无遮罩 popup（`modal=false`）无处可点 → 设为不关只圈定 |

选 **C**：键盘与焦点是「弹层」的通用行为，栈是唯一事实源；Back 关层是 History 语义，只有 KgSheet（业务弹层）需要，放 wrapper。

### 3.1 实现（仅 H5，0 后端/协议/小程序）

- `modal-policy.js`（纯函数，便于单测）：`modalEntry(el, overlay)`（box/hit/layers）、`modalKeyAction(key, isComposing, textWithValue)`（IME 组合中不处理；有内容的文本控件首次 Esc 只 `blur`，再按才关；Tab → cycle）、`isTextWithValue`、`pickRestoreTarget(chain, alive, focusablesIn)`（触发元素被 `v-if` 卸掉 → 归还最近仍在祖先内首个可聚焦项）。
- `a11y-focus.js`：扫 `.mask, .wd-popup`；`FOCUSABLE_SEL = '[tabindex], input, textarea, select, button, a[href]'`（原生 textarea 进 Tab 序，disabled 跳过）；Esc 对 `.wd-overlay` 派发 click；入栈记 `openerChain()`（activeElement 或最近 focusin 祖先链）；Esc/Tab `stopPropagation` → `book.vue` 页面级 Escape 不再重复处理。
- `kg-sheet.vue`：`role="dialog" aria-modal="true" :aria-label="title"`；`watch modelValue` / `mounted` / `beforeUnmount` 调 `sheetOpened(closeCb)` / `sheetClosed(tok)`。
- 新 `sheet-history.js`：打开 → `pushState({...state, __kgSheet:{t,u}})` 同 URL 条目；popstate 落回上一条目 → 关层不离页；X/Esc 关层不动历史，留下的「哑条目」在下次 Back 落到它时自动再 `back()` 一次（用户感知仍是一次 Back 离页）；`router.afterEach → noteRouteChange`（`App.vue` 启动安装，刷新落在哑条目也能接住）；跨 URL 被 vue-router 复制的标记清掉；`history.state.position` 缺失（非 vue-router 环境）不 push。

### 3.2 实测坐实的两处设计修正

1. **手录焦点归还**：触发项「手录错题」是 fab 菜单 `v-if="fabOpen"` 子项，点击即 `fabOpen=false` 卸掉 → 旧实现关层后焦点落 `BODY`（实测 FAIL）。修：`pickRestoreTarget` 沿祖先链归还 `.fab-main`（实测 PASS）。
2. **Back 时序**：加临时日志实测，vue-router 对**同 URL** pop 的 `afterEach`（NAVIGATION_DUPLICATED 也触发）**先于**本模块 popstate 触发，`noteRouteChange` 按落地 state 覆写 `prev=null` → onPop 判不出「离开的是弹层条目」→ 第一次 Back 层不关、第二次才离页（实测 FAIL）。修：`noteRouteChange` 同 URL 不动 `prev`（`curHref` 守卫）；DOM 测试固定该时序（去掉守卫该测试即红）。

## 4. 本地实测（本地 build 产物 `http://127.0.0.1:8562` + 真实 Chrome CDP，`~/r562/modal_probe.py` / `hist_seq.py`，viewport 1280）

| 流程 | dialog 语义 | 打开焦点 | Tab×8 / Shift+Tab×3 | Esc | 焦点归还 | Back（层开着） |
|---|---|---|---|---|---|---|
| 更多操作 | `role=dialog aria-modal=true label=言语理解 · 更多操作` | 「关闭」 | 全在层内（粗心大意…取消） | 关 | 「更多操作」按钮 | 关层，URL 仍 book |
| 筛选与排序 | `label=筛选与排序` | 「关闭」 | 全在层内（最新…言语理解） | 关 | 「筛选与排序」按钮 | 关层，URL 仍 book |
| 手录错题 | `label=手录错题` | 「关闭」 | 全在层内（模块 chips → 原生 textarea → A…） | 关 | **`.fab-main`**（触发项已卸） | 关层，URL 仍 book |

History 序列（`hist_seq.py`）：A 开→Esc→Back = 一次离页回首页 ✅；B 开→Back 关层→Back 离页 ✅；C 筛选层上再开导出层（叠层）→Back 只关顶层→Back 离页 ✅。

## 5. 全量影响评估

- 29 处 `<kg-sheet>`：行为由全局栈 + wrapper 统一接管，页面 0 改动；`book.vue` 页面级 Escape（≥1024）因全局 `stopPropagation` 不再触达（DOM 测试锁定）。
- 2 处 `wd-datetime-picker`（`home.vue`/`reminders.vue`）：同入栈 → Esc 点遮罩关、Tab 圈定；未做真机实测（UNTESTED，非本轮代表页）。
- 1 处 `.mask`（export-confirm）：行为不变（同栈）。
- 叠层：sheet 上再开 sheet（筛选 → 导出确认）实测 Back/Esc 只作用栈顶。

## 6. R560-5 `/` LCP 复采归因（②）

Lighthouse 12.x `simulate`（cpuSlowdownMultiplier 4），生产 `2c0868b3` 同 bundle：

| 运行 | 本机 benchmarkIndex | `/` perf | LCP | FCP | TTFB | 观测 LCP |
|---|---|---|---|---|---|---|
| 空闲 #1 | 2626 | 0.93 | 1381 | 1284 | 122 | 287 |
| 空闲 #2 | 2584 | 0.99 | 989 | 989 | 34 | 116 |
| **双核占满**（`yes`×2） | **1231** | **0.82** | **2275** | 1701 | 45 | 252 |
| `/tiku/` ×3 | 2088–2626 | 1.00 | 858–916 | — | 27–40 | 114–131 |

- TTFB 27–122ms 全程正常、观测（未模拟）LCP 116–287ms、render-blocking 0 → 服务端与资源路径无异常。
- LCP 随 **Lighthouse 本机 CPU 空闲度**单调漂移（benchmarkIndex 2600 → 1230，LCP ≈1.0s → 2.3s）；R560/R561 发版后多次违例发生在同机刚跑完 `build:h5`/多会话并发时段，与此形态一致。`/tiku/` 静态页几乎无主线程工作故不受影响。
- **归因（verified 方向，具体 3.2–3.7s 那几次未留 JSON 不能逐次坐实）**：Lantern 把观测主线程时间按 CPU 倍率折算，本机负载高时 FCP/LCP 被放大；不是首页 bundle/关键路径回归。
- 处置：`deploy/perf-budget.sh` 每 URL 打印 `INFO benchmarkIndex/observedLCP/observedFCP/TTFB`，`benchmarkIndex < MIN_BENCH(1800)` 时打 WARN「本次分数不可作回归结论，空闲后重跑」（仍按预算判定不放水）。首页关键路径 preload/内联改造**不立项**（无证据）。

## 7. 本地门

`npx vitest run`（H5 全量）180 文件 1370（+46：`tests/r562-sheet-modal-keys.test.js` 纯函数、`r562-sheet-modal-keys.dom.test.js` jsdom 焦点栈、`r562-sheet-history.dom.test.js` 真 History API）/ eslint 0 / tokens+lint-pages 20 warn 同 main / build:h5（bundle gzip 126KB，+1KB）/ `bash -n perf-budget.sh` / `diff --check` 空。后端、小程序 0 改动未跑。

## 8. 如实登记

- UNTESTED（本轮）：`wd-datetime-picker` 两处真机；手录 textarea 有内容时首次 Esc 只 blur 仅 jsdom；IME 组合态仅 jsdom；375 触屏无键盘（Back 关层为触屏可感知项，生产复验补）；`history.state.position` 缺失分支仅单测。
- 小程序 `t-popup` 层键盘无意义（无键盘），Back 手势由微信原生栈接管 → 小程序侧不做。
- R561-1 `scrollLeft` 既有 P3 继续登记，与本轮无关。
- 本地 probe 唯一 console error `The script has an unsupported MIME type ('text/html')` 为本地静态服务器 `sw.js` 404 回退 HTML，非产品。
