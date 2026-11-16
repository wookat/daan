# R479/R480：SOP-10 四维审计选簇 = 问答页 `pages/ask` + 面试簇 `pkgA/interview/*` —— 生产 375/1440 一手量测命中 → 最小修复上线（`2bad8bc` → `6d7259c`）

日期：2026-09-07 06:36Z–06:50Z。改动 3 文件：`frontend-uni/src/pages/ask/ask.vue`（只 `<style>`）、`frontend-uni/src/pkgA/interview/history.vue`（只 `<style>`）、新增源锁 `frontend-uni/tests/ask-interview-r479-audit.test.js`；0 模板、0 后端、0 库写入。

## 0. 结论

1. **选簇依据坐实**：`git log --oneline -- frontend-uni/src/pages/ask frontend-uni/src/pkgA/interview` 自 R410 起只有 R421/R422（问答页传 qid / 推理计时）、R466（面试页 `.hist-link` 只读读数）触碰，**从未按 R410+ 的「≥24rpx 字号 / ≥40px 可点元素」规则整页过审**——与 R465 practice、R470 模考簇同形态的漏审簇。
2. **生产一手命中（改前，`2bad8bc` bundle `index-ln5farCT.js`）**：
   - 问答页 `.sheet-x`（三个 sheet 的 ✕：文字面板 / 历史 / 追问）**27.7 px**、`.rate-btn`「有用 / 有误」**29.2 px**（375）——同 R465/R470 答题卡 ✕ 27.7 一模一样的形态；
   - 问答页 12 处 `21–23rpx`（375 渲染 10.08–11.04 px；1440 10.5–11.5 px）：`.top-s / .cam-quick / .cam-tip2 / .cam-mode / .cam-side / .ub-ans / .ds-d2 / .ans-method / .tag / .rec-meta / .rec-del / .rec-e2`；
   - 面试练习记录页 `.stat-t / .tag / .meta` 3 处 `22rpx`（375/1440 各 7 个叶节点 11 px）；
   - 面试出题页 `interview.vue`：字号 0 命中（最小 25rpx）；可点元素 `.cat` 整行 52、`.swap` 40、`.hist-link` 40、`.btn-ghost/.btn-primary` 44 —— **不改**（`.cat-arrow` 自身 18 px 但无 `@click`，父 `.cat` 整行命中）。
3. **修法**：字号 15 处 → `24rpx`；`.sheet-x` `min-width/min-height:40px` + `margin:-6px -8rpx -6px 0`（不抬 `.sheet-h`，改后 `.sheet-h` 仍 28 px）；`.rate-btn` `min-height:40px + box-sizing:border-box`（父 `.rate-btns` 已是 flex，不改流——R471 教训，未改 `display`）。其余 44px 元素保留、源锁反锁。
4. **改后生产一手（`6d7259c` bundle `index-DoCoVd0k.js`，375/1440 都确认加载该 bundle）**：`.sheet-x` ×2 处（文字面板 / 历史）40×40、`.rate-btn` ×2 40；`elementFromPoint` 中心 ±19 命中 / ±21 不命中（竖向；`.rate-btn` 横向 ±21 仍命中因宽 64）；1440 页面自有 `<11.9px` 叶节点 问答页四态 2/2/3/5 → **0**、面试记录页 7 → **0**；375 页面自有叶节点全部 ≥11.52 px（=24rpx 在 360 仿真下的下限），剩余 <11.9 的只有 uni 框架 tabbar label 10 px（全站共有、非本页样式，历轮同判不动）。截图 `/home/ubuntu/r479_post_{result,textsheet,hist}_{375,1440}.png` 布局无回归（评价行、sheet 头行、chips 行都在原位）。
5. 门：vitest **706/706**（+7 源锁）、`npx eslint src tests` **rc=0**（本轮直接取原始退出码，不经管道）、`npm run build:h5` 绿；部署 `deploy_h5.sh --skip-build` 一次 rc=0（rev 一致、bundle 校验、7/7 200、perf `/` 0.98 LCP 1676 / `/tiku/` 1.00 LCP 952）。
6. 到期项与观测项（§4）：自然非探针 `mistakes/analysis` **仍 0**、`explain/stream` 第 2 对 **未出现**、`umst3tuisd7lgzaka` **0 回访**、`error_reason` ≥09-11 **0**；(c) 新容器起后 78 请求 = 本机 76 + GPTBot 2（`/robots.txt` 304、`/sitemap.xml` 200），`/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。

## 1. 选簇：为什么是问答页 + 面试簇

R478 下一步已列候选「从未过 R410+ 审计的面试簇 `pkgA/interview/*` 或问答页 `pages/ask`」。本轮先查两簇自 R410 起的触碰史（`git log --oneline 2bad8bc -- <path>`）：

| 路径 | R410 起触碰 | 是否按 24rpx/40px 规则整页过审 |
|---|---|---|
| `pages/ask/ask.vue` | R421（传 qid + 推理中计时）、R422（识题时延文案） | 否——都是功能改动，`<style>` 只加不审 |
| `pkgA/interview/interview.vue` | R466（`.hist-link` 单点只读读数 40） | 否（只读了 1 处） |
| `pkgA/interview/history.vue` | 无 | 否 |

三页都是「用户真会走到」的路径（R477/R478：非探针问答提交 2 条；R475/R476：非探针面试出题 2 uid），比继续在主循环页上找微修有价值。

## 2. 改前一手（生产 `2bad8bc`，375=360 仿真 dpr2 / 1440，`X-Kg-Probe:1`，API 只放 GET、`/api/interview/history` 浏览器侧 fulfill 占位、问答结果态用 uni H5 包装格式 localStorage 占位——0 库写入）

量测脚本 `/home/ubuntu/r479_scan.py`（叶节点 computed `font-size` <11.9 px + 可点元素 bounding box）；改前 JSON 存 `/home/ubuntu/r479_pre/r479_{375,1440}.json`。

### 2.1 可点元素（375，px）

| 页/态 | 元素 | 改前 h | 判定 |
|---|---|---|---|
| 问答·文字面板 | `.sheet-x` ✕ | **27.7** | 命中（同 R465/R470 答题卡 ✕ 形态） |
| 问答·历史 sheet | `.sheet-x` ✕ | **27.7** | 命中 |
| 问答·结果态 | `.rate-btn` 有用 / 有误 | **29.2** | 命中 |
| 问答·结果态 | `.chip`（再讲细一点 / 出同款题 / 存错题本） | 44 | 通过 |
| 问答·历史 sheet | `.rec-del` 删除 | 44 | 通过 |
| 问答 | `.top-btn` 历史 / 新对话；`.ib-cam/.ib-txt/.ib-send` | 44 | 通过 |
| 面试出题 | `.cat` 分类行 | 52 / 53 | 通过（`.cat-arrow` 18 无 `@click`，父行命中） |
| 面试出题 | `.swap` 换一题 / `.hist-link` 练习记录 | 40 | 通过（R466 已读） |
| 面试出题 | `.btn-ghost` / `.btn-primary` | 44 | 通过 |
| 面试记录 | `.btn-primary` / `.retry` | 44 / 40 | 通过——本轮占位有数据态下两者未渲染，按源码 + 源锁；`.retry` 生产失败态一手见 R471 |

追问 sheet 的 ✕ 同一 `.sheet-x` 规则，模板同构、未单独在生产打开（不发追问流）——按源码 + 源锁推断。

### 2.2 字号（页面自有叶节点 <11.9 px，去 uni tabbar）

| 页/态 | 375 | 1440 | 源 |
|---|---|---|---|
| 问答·空态 | `.top-s` 10.56、`.cam-quick` 11.04 ×2、`.cam-tip2` 10.56、`.cam-mode` 11.04 ×3、`.cam-side` 10.56 ×2 | `.top-s` 11、`.ds-d2` 11.5 | 22–23rpx |
| 问答·文字面板 | 上列 + `.label` 11.52（=24rpx，非命中） | 同上 | — |
| 问答·历史 sheet | 上列 + `.rec-e2` 11.04 | + `.rec-e2` 11.5 | 23rpx |
| 问答·结果态 | `.top-s` 10.56、`.ub-ans` 10.56、`.tag` 10.56 ×2、`.ans-method` **10.08** | `.ub-ans/.tag` 11、`.ans-method` 10.5 | 21–22rpx |
| 面试记录 | `.stat-t` 11 ×3、`.tag` 11 ×2、`.meta` 11 ×2 | 同 7 个 | 22rpx |
| 面试出题 | 0 | 0 | 最小 25rpx |

其中 `.ans-method`（答案卡「细节判断」方法名）21rpx 是全簇最小；`.ub-ans`（用户气泡「我选：B」）、`.tag`（模块 / 题型）是讲解卡片的关键信息，不是纯辅助。

## 3. 改法与改后一手

### 3.1 改法（只 `<style>`）

- 15 处字号 → `24rpx`（ask 12 + history 3）。
- `.sheet-x`：`display:inline-flex; align-items:center; justify-content:center; min-width:40px; min-height:40px; margin:-6px -8rpx -6px 0`——负外边距吃掉抬高量，`.sheet-h` 头行高不变（改后 28 px，与改前同）；三个 sheet 共用。
- `.rate-btn`：`min-height:40px; box-sizing:border-box; padding:0 24rpx`，保持 `inline-flex`；父 `.rate-btns` 本就 `display:flex`，不改任何 `display`（R471a 教训）。
- 源锁 `tests/ask-interview-r479-audit.test.js`：三页 `<style>` 无 `<24rpx`；`.sheet-x` 40/40/-6px；`.rate-btn` 40 + border-box + 父 flex；原 44px 八类元素反锁；面试簇 `.cat` 52 / `.swap` `.hist-link` `.retry` 40 / 按钮 44。

### 3.2 改后一手（生产 `6d7259c`；脚本 `/home/ubuntu/r479_scan.py` + `/home/ubuntu/r479_hits.py`）

| 项 | 375 | 1440 |
|---|---|---|
| bundle | `index-DoCoVd0k.js` | `index-DoCoVd0k.js` |
| `.sheet-x` 文字面板 / 历史 | 40×40；y±19 命中、y±21 不命中；x±19 命中、x±21 不命中 | 同 |
| `.sheet-h` 头行高 | 28（不变） | 28 |
| `.rate-btn` 有用 / 有误 | h 40 w 63.9；y±19 命中、y±21 不命中 | h 40 w 66 |
| 页面自有 <11.9px 叶节点：问答 空态/文字/历史/结果 | 0/0/0/0（最小 11.52=24rpx） | 0/0/0/0 |
| 面试记录页 <11.9px 叶节点 | 0 | 0 |
| 面试出题页结构 | `.cat` 52/53 / `.swap` 40 / `.hist-link` 40 / 按钮 44 不变 | 同 |

截图（改后）：`/home/ubuntu/r479_post_result_375.png`（结果态：评价行 / chips 行原位）、`/home/ubuntu/r479_post_textsheet_375.png`（文字面板：✕ 与标题同行、头行未抬）、`/home/ubuntu/r479_post_hist_375.png`。改前截图 `/home/ubuntu/r479_pre/*.png`。

## 4. 到期项 / 观测项（06:48Z，新容器 `6d7259c` StartedAt 06:44:14Z）

- 容器 `running healthy restarts=0`；WAL 4,124,152 B 同字节。
- `answer_log probe=0` 33/1、`growth_events probe=0` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs` 0、`weekly_reports` 2、`exam_attempts probe=0` 1/64；`ask_cur` 5（explanation 空 0）、`ask_sessions` 1、`explain_cache` 82（空 0 / min 50 字）。
- 自然非探针 `mistakes/analysis`：R475 容器（05:32:03Z）起至本次发版前 280 请求全部本机；本次发版后 78 请求 = `140.232.64.4` 76（部署回归 / Lighthouse / 本轮 Playwright）+ `74.7.241.145` `/robots.txt` 304 + `74.7.227.151` GPTBot `/sitemap.xml` 200 → 非探针 AI/ask/interview **0**，single-flight 三条件核法继续挂。
- `explain/stream` 第 2 对未出现；`umst3tuisd7lgzaka` 0 次 `GET /api/ask/cur`（09-13 21:41Z 前继续挂）。
- (c)：`/assets/*` 404 0、5xx 0、`/api/monitor/report` 0、小程序 UA/referer 0。

## 5. 如实说明

- 375 为 360 仿真（uni rpx 基准），真机未量；无 testing agent 录屏（未另行授权）。
- 追问 sheet ✕ 与三处 `.sheet-x` 共用规则，未在生产打开追问面板（不发追问流），按源码 + 源锁推断。
- 面试出题页 `.cat-arrow` 18 px「非缺陷」判定依据 = 模板无 `@click` + 父 `.cat` 52 整行 `@click`（源码）+ 生产 `.cat` 读数，未做 `elementFromPoint` 逐点命中。
- 问答结果态 / 历史 sheet 是本地占位数据渲染（uni H5 `{type:'object',data:[...]}` 包装格式），几何与真实讲解等价但正文长度不同，不影响字号/热区读数。
- 面试记录页 `/api/interview/history` 为浏览器侧 fulfill 占位回包，未在生产制造面试记录；该页空态 `.btn-primary` / 失败态 `.retry` 本轮未渲染（源码 + 源锁 + R471 一手）。
- 「从未过审」按 `git log` 触碰史判定，不是按每轮文档逐字复核。
- 单轮发版，无 R471 式二次发版；构建走 `--skip-build`（本机 dist 与线上 bundle 校验一致）。
