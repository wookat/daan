# R570：弹层哑条目链被 Back 跳过落回本页真条目后按当前筛选重写 URL（R569 生产 D，既有）

线上基线：后端 `09d664a4`（health），H5 静态层 `index-CM5y2EMx.js`（R569，PR #749 待合入）。分支 `devin/1788998797-r570-book-landed-url` 从 #749 分支开（含线上谱系与 #742–#749 未合入提交），PR #750 `567c87a6`。

## 研究（一手，承 R569 D 分类）

- 症状：错题本 `?mod=changshi` → 筛选层选「法律 / 个税」→ 关层 → 更多操作层重练 → 练习页页头返回 → UI 仍 1 张「法律 · 个税」卡，地址栏只剩 `?mod=changshi`（此时 F5 丢筛选、分享/书签也是错的）。R568/R569 两套 bundle 同 fixture 同流程本地同复现（`docs/iter/round-3/r569-book-cache-first-frame.md` D 分类节）。
- 机制（`window.__hist` 逐条对账）：哑条目在 `sheetOpened()` 那一刻的 URL 上 `pushState`；层内改筛选 `syncBookUrl()` 就地 `replaceState` 只改了哑条目；真条目 query 停在开层前。返回时 `sheet-history onPop()` 逐条跳过已关哑条目（R563-fix-2 `skipping` 链）落到本页真条目，URL 即回到旧 query；`book.vue onShow` 的 `syncBookUrl()` 发生在链的第一跳（落在哑条目上），之后没有任何一处再写 URL。
- 三个候选：
  1. 层内改筛选时把真条目也改掉——真条目在栈下方，History API 无法就地改非当前条目；否。
  2. 重开弹层复用哑条目而不再 push——R563 已论证会破坏 R562 D1 `?mod` 保留与多层链语义；否。
  3. 链落地在本页真条目时通知页面按当前状态 `syncBookUrl()`——只在「上一跳是补跳且本次落到本页无标记条目」触发，不改哑条目/补跳语义；**选此**。

## 实修（`567c87a6`，仅 H5，0 后端/小程序）

- `sheet-history.js`：`onPop()` 计算 `landed = skipping && land == null && !away && act.type === 'none'`，成立时回调 `onSheetHistoryLanded(fn)` 订阅者（传落地 href）；`_resetSheetHistory()` 清订阅。直接从哑条目 Back 离页（`act=back`）、层仍开着（`close`）、普通返回（`skipping=false`）、地址栏改 hash（`away`）都不回调。
- `book-url.js`：`isBookHref(href)` 只比 hash 路径忽略 query。
- `book.vue`：onLoad(H5) `this._offLanded = onSheetHistoryLanded((href) => { if (isBookHref(href) && !this._pendingKp && !this._pendingKp3) this.syncBookUrl(); })`；onUnload 取消。深链首开 kp 未落地时沿用 onShow 同一守卫不覆写入参。
- 测试：`tests/r569-sheet-history-landed.dom.test.js`（jsdom 按 vue-router 4 顺序：单哑条目落地回调一次 + URL 重写 + state 为真条目 / 双哑条目链只回调一次 / 无哑条目不回调 + 取消订阅 / 直接离页不回调 / 层开着不回调 / book.vue 源锁 / `isBookHref`）。`r547-book-tab-keepalive` 对 `book-url.js` import 行有源锁 → `isBookHref` 单独一行 import。
- 本地门：H5 vitest 190 文件 1474 / eslint 0 error（20 warn 同 main）/ build:h5（`index-BE-SJK0E.js`、`pages-book-book.8ASq6-ww.js`）/ `git diff --check` 空。
- 本地复现（`~/r569/repro_d.py` 新 bundle port 8570，`~/r569/d-r570-agentpath/`）：落地 URL `?mod=changshi&kp=法律&qt=法律-个税`、1 张个税卡、`history.state` 无 `__kgSheet`（position 1）；序列 `popstate(dummy2) → syncBookUrl(onShow) → popstate(dummy1) → popstate(real ?mod) → syncBookUrl(landed 回调 全筛选)`。
- 发版：宿主已恢复（health 0.28s）但后端 0 改动 → 只跑 Pages 4c/5/5b/6（`~/r570/pages_deploy.sh`）：Pages `c7dc5e06.kaogong-h5-zalize.pages.dev`，线上 `index-CM5y2EMx.js → index-BE-SJK0E.js`（一次 5s 重试后一致；编码变体首轮 text/plain 传播窗口、5s 后全 `application/javascript`），7 项回归 200；health 仍 `09d664a4`。

## 生产复验（Pages `index-BE-SJK0E.js` / 后端 `09d664a4`，`~/r570/prod/report.md`，PR #750 评论附截图）

（见 PR #750 评论与 handoff R570 节；本文件在复验完成后回填。）
