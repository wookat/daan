# R556：练习页退出按钮文案按 `navigateBack` 实际落点给出（R555-2）——研究 / 实修 / 生产复验

日期：2026-09-09。代码 PR #720（分支 `devin/1788923175-r556-back-label`，自 main `005a8f24`），已合入 main `68c8a1fb`。生产 `798c154f → e720e8cc`（`index-D1AfXVtv.js`）。

## 1. 研究（先调查再发言）

### 1.1 R555-2：H5 练习页「返回首页」落点不一致

源码一手核实（`frontend-uni/src/pages/practice/practice.vue`）：

- 三处退出按钮硬编码「返回首页」：加载失败层 `kg-empty-state secondary-text`、骨架层 `kg-button variant=text`、完成页底部 `kg-button variant=text block`，全部 `@click="quit"`。
- `quit()`：无未完成作答直接 `leave(false)`；有则弹「保留进度 / 结束本组」后 `leave(keep)`。
- `leave()` 落点：`getCurrentPages().length > 1 ? uni.navigateBack({fail: switchTab home}) : uni.switchTab(home)`。既有注释已写明 H5 `navigateBack` 只是 `history.go(-1)` 且永不 fail。
- 进练习页的写入方（`rg "pages/practice/practice"`）：首页模块卡/续练卡、错题本重练（`book.vue redoAll`/「更多操作 → 练 3 道同类」）、统计、卷库「按卷练习（不计时）」、成绩报告、收藏、搜索、分享落地页、练习历史等 → 除深链直达/刷新外页面栈均 >1，按钮实际回**上一页**而非首页。
- 小程序 `utils/done-bar.ts` 结算态次级按钮「返回」、`practice.wxml` 加载失败层 `secondaryText="返回"`，`onQuit()` 同为 `navigateBack` + fail → 首页。小程序不写错落点，但也不告知落点。

结论：改文案不改导航（导航行为 R546–R548 已在多轮复验中被依赖：错题本重练返回后 `onShow syncBookUrl` 回写筛选 query 等）。文案三态：栈 ≤1 →「返回首页」（与 `switchTab` 一致）；上一页在路由名表 →「返回<页名>」；未知 →「返回」。

### 1.2 R555 自然样本回看（生产只读 `~/r545/q556.py`）

- 首查写了 `count(answer_log.mid)` 报 `no such column: mid`——`mid` 只是 `/api/answer_log` 的**请求字段**，服务端据此 `_find_open_mistake → _advance_review(via='answer')` 写 `review_log`，`answer_log` 不落 `mid` 列。教训：先 `PRAGMA table_info` 再写聚合。
- 修正后：近期非测试/非探针 `answer_log` 0 行、非测试/非探针 `review_log.via='answer'` 历史 0 行；近期全量行均为 `probe=1`/测试前缀；到期可命中 uid 61 个 / 错题 242 道。→ **R555 上线后尚无自然 `due_mid` 触达样本**，属证据不足，不是产品失败；继续观察，不据此立项「今日回流 n 道」汇总（没有样本证明用户能感知到回流，先不加层）。

### 1.3 其余候选

- R555-1 `practice.vue` 计时分支（UI 不可达）P4：本轮未顺手清理（本轮改动集中在退出文案，避免混入模板级删除）。
- 小程序真机（R536-1 累计）、probe 真人口径：条件未变，继续等。

## 2. 实修（#720，+171/-9，后端 0 改动）

- 新增 `frontend-uni/src/back-label.js`：`prevRoute(pages)`（取倒数第二页 `route`/`$page.route`，去前导 `/` 与 query）+ `backLabel(pages)`（三态）；`ROUTE_NAMES` 覆盖首页/错题本/统计/我的/卷库/成绩报告/大赛报告/周报/练习历史/掌握度地图/收藏/搜索/队友分享。
- `practice.vue`：`data.backLabel='返回首页'`；`onShow` 首行 `this.backLabel = backLabel(getCurrentPages())`（onShow 而非 onLoad：uni-h5 同一练习页实例被不同入口复用，需每次重算）；三处按钮改绑。
- 小程序：`utils/back-label.ts` 同口径（路由表按小程序实际分包路径）；`practice.ts onLoad` 算 `backLabel` 入 data；`doneBarPlan(wrongCount, beiMode, back='返回')` 新增第三参，仅无错题分支的 `secondary` 使用（有错题分支「只重练本组错题 / 再来一组」层级不变）；`practice.wxml` 失败层 `secondaryText="{{backLabel}}"`。
- 测试：H5 `tests/r556-back-label.test.js`（纯函数三态 + `$page.route`/斜杠/query 兼容 + practice.vue 接线源锁 + `leave()` 落点逻辑不变源锁）；小程序 `scripts/back-label.test.ts`；R554 `scripts/done-bar.test.ts` 源锁按新签名更新。
- 本地门：H5 vitest 1206（+5）/ eslint+tokens 0 / build:h5；小程序 tsc / eslint 0 / vitest 56（+4）；`git diff --check` 空。

## 3. 生产复验（独立 testing agent，`e720e8cc`）

报告 `~/kaogong-reports/r556-prod-verify.md`、证据 `~/r556-verify/`（`events.jsonl`/`network-audit.json`/`baseline.json`/`final-db.json`/`clean.json`），录像 `~/screencasts/r556-e720e8cc-{production,desktop}/`。PR #720 评论附截图。

| 项 | 结果 | 要点 |
|---|---|---|
| A 错题本重练 → 完成页 | PASS 375/1440 | 底部「返回错题本」，点击回 `#/pages/book/book`，375 `?mod=yanyu` 筛选保留（R546）；R553 层级（重练 primary / 再来一组 ghost / 分享成绩）不变 |
| B 首页入口 → 完成页 | PASS 375 | 「返回首页」，点击回 `#/`（H5 首页归一为 `#/` 非 `#/pages/home/home`） |
| C 深链直达 | PASS 375/1440 | 新 Document 栈 1，骨架层/完成页均「返回首页」→ switchTab 首页；1440 另以冷模块验证骨架层按钮直接返回 |
| D 加载失败层 | PASS 375/1440（触发路径调整） | 原指令「错题本重练 + block `/api/questions`」不成立：`redoAll` 先 `GET /api/mistakes/redo` 再导航消费 `redoSet`，不请求 questions。改用「错题本 → 更多操作 → 练 3 道同类」触发，失败层分别显「返回错题本」/「返回首页」，落点一致 |
| E 中途退出 | PASS 375 | 「保留进度 / 结束本组」弹窗文案不变；结束落点同 A/B 规则 |
| F 回归 | PASS 375 | R555「曾错题 · 到期复习」标签、「再来一组」1/10；R548 重练 F5 恢复同 qid 序/idx0/已选；卷库独立计时模考 1/75 倒计时 |
| 审计 | PASS | 1505 请求 / 1490 响应全 200（471 API、probe 缺头 0）；console/runtime/rejection/loading 配对 warning/付费 AI-OCR-explain 0；另 10 条有意阻断 `ERR_BLOCKED_BY_CLIENT` + 5 条 Document 导航 `ERR_ABORTED` 逐条分账 |
| 清理 | PASS | 41 表按两个完整 uid 等值精确删 91 行（mistakes 8 / practice_results 8 / answer_log 59 / exam_attempts 1 …）；exact 与 `test-r556-%` 独立只读复核 0 残留；五类保护 hash/count 与基线一致；容器 healthy / restarts 0 |

UNTESTED / 如实：小程序（R536-1 累计，仅 tsc/eslint/vitest）；`practice.vue` 内部计时分支（UI 不可达）；未访问的其他 `ROUTE_NAMES` 映射与「未知上一页 → 返回」仅单测；1440 仅 A/C/D 抽检；未证明「同一 Vue 实例被复用」本身，只验证了连续不同来源所见文案正确；深链 `count=5` 未被读取实际 10 题为既有参数口径（非本 PR）；D 项测试指令口径由我写错，已按可达路径纠正并如实单列。

## 4. 下一步（R557 候选）

- 上线 ≥1 天再回看自然 `review_log.via='answer'`（非探针、非测试前缀）与「曾错题」答对率；若出现样本再论证「今日回流 n 道」汇总层。
- 深链 `count=` 参数未读取（复验附带发现）：核 `practice.vue onLoad` 读参口径与首页/分享写入方是否有依赖，决定是修还是删参数。
- R555-1 计时分支 P4 顺手位；小程序真机；probe 真人口径。
