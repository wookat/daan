# R472：按 R471 教训全仓回扫「补 `min-height` 顺带改了 `display`」的规则——R410 起 87 条 display 新增/变更、33 处块级↔行内流变化，0 处同类布局回归；R471 未截图的 4 页 `.retry` 生产失败态补截；(c) / 到期项无增量

日期：2026-09-07 04:40–05:00Z。生产仍 `6e82179`（R471b），**本轮 0 行产品代码、不发版**。取证方式：`git diff 2541413~1 HEAD -- frontend-uni/src`（R410 起点 → HEAD）逐行抽 `display:` 增删 → 按 (文件, 选择器) 归并净变化 → 模板静态解析（元素标签 / 父容器 display / 兄弟是否行内）→ 生产 Playwright CDP 只读量测 + 截图（375 / 1440，`X-Kg-Probe: 1`，`route('**/api/**')` 全 abort 制造失败态，无 DB 写入）+ 宿主直读卷 `mode=ro` + 源站 caddy 日志（UTC、按 host 过滤）。

## 1. 结论

1. **R471a 那类回归（「加载失败：…」与「重试 ›」被挤到同一行）全仓只此一例，已在 R471b 闭合；没有别的同类**。方法：R410（`2541413`）到 HEAD 的前端 diff 里，`display:` 出现在增删行的记录共 **310 行 → 按 (文件, 选择器) 归并后净变化 87 条**（其余是同规则重排、值不变）。87 条里 **块级↔行内流真正变化的 33 处**（`<view>` 默认 block → `inline-flex`/`inline-block`，或 `<text>` 默认 inline → `flex`/`block`）逐个查模板：
   - **26 处父容器是 flex**（`.sheet-h` ×15、`.mhead`、`.multi-bar` ×2、`.wr-row`、`.acard-grid` ×2、`.qgrid`、`.dnav`、`.hist-top`、`.sbox`、`.sheet-acts` ×2、`.replying`、`.empty`(search)、`.tag`）——flex 子项一律 blockified，`inline-*` 与 `block` 在布局上等价，不可能改行；
   - **7 处父容器是 block、但同容器没有任何行内兄弟**（book `.retry`（兄弟 `.e-t/.e-s` 都是 `<view>`）、book `.kbd-more`（独子）、home `.ld-x`、report `.retry`（兄弟 `<text class="empty-t/empty-s">` 但 CSS 显式 `display:block`）、discuss `.plaza-btn` / `.retry`（兄弟 `<view class="empty-t">`）、practice `.tag-t`）——行内元素前后无行内内容就仍是独占一行，只是宽度从撑满变成内容宽（居中靠父 `text-align:center`）；
   - **0 处**「父 block + 有行内兄弟 + 流变化」= R471a 形态。
2. **生产失败态补截（R471 只量 h/hits 没截图的 4 页）**：book / report / discuss / search 的 `.retry` 在生产 `6e82179` 375 与 1440 下——`h=40`、±19 命中 / ±21 不命中，**`.retry` 的 top 都在前一兄弟（错误文案）的 bottom 之下**（375：book 145.1 vs 129.8、report 128 vs 110.7、discuss 163.5 vs 155.8、search 218.7 vs 211），截图「重试 ›」均独占一行居中（`r472_{book,discuss,report,search}_375.png`）。至此 17 页 `.retry` 里 **16 页有生产失败态一手**（R471 10 页 + R470 list + 本轮 4 页 + shenlun R464），只剩 `inbox` 仍未走到（API 全 abort 先落登录分支）。
3. **顺带纠正本轮自己的第一版 grep**：先用 `^\+\s*display:` 只匹配「display 独占一行」的规则，得到「R410 起只新增 3 条 display」的假结论；本仓大量单行规则 `.x { display: inline-flex; ... }`，必须按 `display:\s*([a-z-]+)` 在整行里抽（→ 87 条）。写进 SKILL。
4. **到期项（04:52Z）无增量**：`answer_log` probe=0 33/1、`growth_events` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs 0`、`weekly_reports 2`、`exam_attempts` probe=0 1 / 64、healthy 0 重启（`6e82179` 容器 `StartedAt 04:35:18Z`）。
   (c) R471b 容器起后 **54 请求全部来自本机出口 `140.232.64.4`**（部署脚本 curl 回归 / Lighthouse `moto g power (2022)` UA / 本轮 Playwright），`/assets/*` 404 **0**、MiniProgram UA 0、kaogong 5xx 0、非 2xx 只有 `/sw.js` 304；`/api/monitor/report` 仍只有 R471 登记的那 1 条（04:36:06Z，部署 6b Lighthouse），04:42Z 独立 perf-budget 的同 UA 会话 0 上报。别家 host 在该窗口 0 行。

## 2. 一手证据

### 2a. display 变化归并（`git diff 2541413~1 HEAD -- frontend-uni/src`，按 (文件, 选择器) 归并，只列流变化 33 处）

| 文件:行 | 元素 | display 旧 → 新 | 父容器 / display | 行内兄弟 | 判定 |
|---|---|---|---|---|---|
| book.vue:228/243/273/344/374/498/523 | `<view .sheet-x>` | block → inline-flex | `.sheet-h` flex | `text.sheet-t` | flex 子项，等价 |
| book.vue:338 | `<text .kbd-more>` | block → inline-flex | `.card.kbdcard` block | 无 | 独占行，宽变内容宽（R467 生产已量 40） |
| book.vue:423 | `<view .retry>` | block → inline-flex | `.card.empty` block | 无（`.e-t/.e-s` 是 view） | 独占行；本轮生产截图 |
| book.vue:451 | `<view .pbadge-hit>` | block → inline-flex | `.mhead` flex | text ×4 | flex 子项（R467 已量） |
| home.vue:17 | `<text .ld-x>` | inline → flex | `.card.landing` block | 无 | 独占行（R467 已量） |
| practice.vue:56 | `<text .tag-t>` | inline → block | `.tag` flex | 无 | flex 子项（R465） |
| practice.vue:71/307/328 | `<view .sheet-x>` | block → inline-flex | `.sheet-h` flex | `text.sheet-t` | 等价 |
| practice.vue:137 / share-q.vue:37 | `<view .multi-ok>` | block → inline-flex | `.multi-bar` flex | `text.multi-hint` | 等价 |
| practice.vue:243 | `<view .wr-btn>` | block → inline-flex | `.wr-row` flex | 无 | 等价 |
| exam.vue:67/98 | `<view .acard-n>` | block → inline-flex | `.acard-grid` flex | 无 | 等价 |
| exam.vue:89 / report.vue:193 | `<view .sheet-x>` | block → inline-flex | `.sheet-h` flex | `text.sheet-t` | 等价 |
| report.vue:127 | `<view .qn>` | block → inline-flex | `.qgrid` flex | 无 | 等价 |
| report.vue:225/226 | `<view .sheet-x>` | block → inline-flex | `.sheet-acts` flex | — | 等价 |
| report.vue:282 | `<view .dnav-mid>` | block → inline-flex | `.dnav` flex | 无 | 等价 |
| report.vue:8 | `<view .retry>` | block → inline-flex | `.card.empty` block | `<text .empty-t/.empty-s>` **CSS 显式 block** | 独占行；本轮生产截图 |
| search.vue:7 | `<view .sclear>` | block → inline-flex | `.sbox` flex | `l-icon` | 等价（R466 已量） |
| search.vue:18 | `<view .retry>` | block → inline-flex | `.empty` **flex column** | `text.empty-t` | 等价；本轮生产截图 |
| search.vue:120 | `<view .hist-clear>` | block → inline-flex | `.hist-top` flex | `text.hist-t` | 等价 |
| discuss.vue:34 | `<view .plaza-btn>` | inline-block → inline-flex | `.card.empty` block | 无 | 流不变 |
| discuss.vue:39 | `<view .retry>` | block → inline-flex | `.card.empty` block | 无（`.empty-t` 是 view） | 独占行；本轮生产截图 |
| discuss.vue:83 | `<view .rx>` | block → inline-flex | `.replying` flex | 文本节点 | 等价 |

其余 54 条净变化是 `(none) → flex/block` 落在 `<view>` 上（block → block-level，流不变）或 `inline-flex ↔ inline-block`（流不变），不列。

### 2b. 生产 `6e82179` 4 页 `.retry` 失败态（API 全 abort，`elementFromPoint` 中心列）

| 页 | W | h | display | 前一兄弟 (class, display, bottom) | `.retry` top | ±19 / ±21 |
|---|---|---|---|---|---|---|
| book `/#/pages/book/book` | 375 | 40 | inline-flex | `.e-s` block 129.8 | 145.1 | 命中 / 不命中 |
| book | 1440 | 40 | inline-flex | `.e-s` block 134.4 | 150.4 | 命中 / 不命中 |
| report `?attempt_id=1` | 375 | 40 | inline-flex | `.empty-s`(text) block 110.7 | 128 | 命中 / 不命中 |
| report | 1440 | 40 | inline-flex | `.empty-s` block 112 | 130 | 命中 / 不命中 |
| discuss `?qid=1` | 375 | 40 | inline-flex | `.empty-t` block 155.8 | 163.5 | 命中 / 不命中 |
| discuss | 1440 | 40 | inline-flex | `.empty-t` block 158 | 166 | 命中 / 不命中 |
| search（输入 abc 回车） | 375 | 40 | flex | `.empty-t`(text) block 211 | 218.7 | 命中 / 不命中 |
| search | 1440 | 40 | flex | `.empty-t` block 216.6 | 224.6 | 命中 / 不命中 |

注：report 页 URL 参数是 `attempt_id` 不是 `aid`（第一版脚本传 `aid=1` 走到 `onLoad` 无参分支 → 「暂无成绩报告」空态，不是失败态）；search 需真的发起一次搜索（`?q=` 或输入回车）才有 `.retry`。

### 2c. 宿主 / 源站（04:52Z）

```
load 10.43 6.10 8.29  mem_avail=281MB  4.2G(92%)
probe0_answer_log|33|1   growth_probe0|20|4   error_reason|7|0
push_subs|0   weekly|2   exam_attempts_probe0|1   exam_attempts_total|64
healthy restarts=0 started=2026-09-07T04:35:18Z   /api/health rev=6e82179
disk guard: 04:30:01Z triggered at 90% → 90%；04:45:02Z 89% → 88%
origin since 04:35:18Z (host=kaogong): total 54  200=48 304=6  assets404=0  miniUA=0  5xx=0
  monitor: [('04:36:06Z','140.232.64.4','moto g power (2022) …')]   ← R471 已登记
  非 probe 头 37 行全部 Cf-Connecting-Ip=140.232.64.4（本机）：04:35 部署 curl 回归 ×10 / 04:36 6b Lighthouse / 04:42 perf-budget Lighthouse（`uid=umtqr7…` home_bundle/resume/review 7 req）/ sw.js 304
```

## 3. 如实边界

- 「0 处同类回归」是**静态判定**（元素默认 display 按 uni H5 `<view>` block / `<text>` inline 假定；父容器 display 只查同文件 `<style>`，全局 `.card` 等按 block）+ 4 页生产失败态一手；其余 29 处流变化未在本轮重新截图，依赖各轮次（R465/R466/R467/R470）当时的生产量测。
- `inbox` 失败态仍未在生产走到；375 为 360 仿真、真机未量；无 testing agent 录屏（未另行授权）。
- 静态解析器用 `html.parser` 读 Vue 模板，`:class` 动态 class 不参与判定；`l-icon` 等自定义组件按行内假定。
- 本轮 0 代码改动，未跑部署；vitest/eslint/build 门为 R471b 结果（699/699）。

## 4. 指针

- 起点：R471 §「需注意」/ `docs/iter/round-3/r471-retry-hitarea-all-pages-rankcard-mount-erratum.md`。
- 脚本（本机，不入仓）：`~/r472_static.py`（display 净变化归并 + 模板上下文）、`~/r472_retry_ctx.py` / `~/r472_retry_ctx2.py`（生产 `.retry` 兄弟位置量测 + 截图）、`~/r472_host.sh` / `~/r472_host2.sh`（到期项 + caddy UTC 过滤）。
