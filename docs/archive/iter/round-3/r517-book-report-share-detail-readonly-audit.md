# R517：错题操作单「题目纠错」/「分享给队友」落点 + 错题展开详情 375/1440 只读整页审 → 两条写路径与详情态均正常、**本轮不改代码**；登记 ① 纠错类型 chip 行 7 项在 375 裁 3 / 1440 裁 2（无滚动条、仅 24 px 渐隐，桌面竖向滚轮不横滚）② 网络失败 toast 透出原文 `request:fail`（`request()` 全站口径，119 处 `e.message` 直显）③ 时政/手录（`question_id` NULL，27 行 / 8 uid）没有纠错/分享路径（fail-closed 设计）④ 簇仍在跑且同签名开始打 `/tiku/papers/*`、`/tiku/y/*`

日期：2026-09-08（UTC 00:4x–00:5x）。生产 `94803e0b`（R516）未变，本轮 0 部署。文档/handoff/SKILL 在新分支（#642 已合，`6dbed739`）。

## 0. 结论

1. **(c) / 到期项 0 增量**：R516 容器整窗（00:29:12Z → 00:54:02Z，569 请求）assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；5xx 21 = R516 已归因的重建窗 72 条 503 里落在容器启动 00:29:12Z 之后的尾段（审前/审后同为 21，本轮 0 新增）；WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、`review_similar_auto` 3/1；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`questions?module=时政` 0。无新的外部真人证据。
2. **簇**：09-07 UTC 终值 1437/1435 不变；09-08 00:00→00:54Z **892 行 / 847 IP**（16.2 行/分、无 >120 s 间断、UA 14、每 IP ≤2），仍在跑。`crawler-stats.json` 仍是 00:23Z 那份（`humans.page 09-07 1444 / 09-08 250`），下次 cron 会把 09-08 再灌到 ~900。**新形态（推断）**：非簇「候选真人」里 3 行 `152.249.213.37 /tiku/y/2025/panduan/`、`178.81.244.190 /tiku/papers/75`、`102.104.97.37 /tiku/papers/89`——请求头签名（Win Chrome UA / `en-US,en;q=0.9` / 无 Referer / 单 IP 单请求 / 无后续 assets）与簇完全相同，只是路径不在 `/tiku/q/*`，本轮 `sig()` 未计入；簇已扩到卷页/年份页（无 IP 情报，仍是特征推断）。
3. **W10 / umsacie7**：`user_profile` 9 行、`test-w10-*` 0 行不变。09-07 11:56–11:58Z `141.11.46.189` `umsacie728f4ghcv8` 那段（错题本 `mistakes`/`review/cur` + 首页全套 + `POST practice_result/mistakes`）是 R502 已入档的首次非探针作答设备（`answer_log` 70 行 probe=0），不是新真人。
4. **改前 = 改后一手（`umst3` 真数据，dist `94803e0b`，`~/r517/*.out`）**——两条写路径与详情态**均按源码预期工作，无功能断点**：
   - **操作单**：比重 2808 「比重 · 更多操作」7 项（同考点强化 / 练3道同类 / **题目纠错** / **分享给队友** / 标为已掌握 / 删除 / 取消），375 面板 375×527、动作 343×49；1440 居中 480 宽、动作 448×49。时政 2914「时政 · 更多操作」3 项，**无纠错/分享**（`m.question_id` NULL → fail-closed；展开态 footer 也无「纠错」）。
   - **题目纠错弹层**（375 底部 375×348 贴底 / 1440 居中 480×340）：标题「题目纠错」+ ✕ 44×44；类型 `kg-chip-row sm` 7 chip 视觉 30 高（命中 `::after` 扩到 `--hit-min`，非缺陷）；textarea `placeholder`「补充说明（选填，500 字以内）」（uni H5 由 `.uni-textarea-placeholder` 呈现，`ta.placeholder` 为空是实现细节）、`maxlength=500`、注入 560 字后 `len 500`；「提交纠错」`kg-btn lg block` 343×44 / 448×44，未选类型 `disabled` + `aria-disabled=true` + `pointer-events:none` + `opacity .4`（点它 0 请求）；选「答案错误」→ 立即可用；提交 → `POST /api/question_report {question_id:246821, uid, type:'答案错误', detail:500 字}` 被 abort → toast「提交失败：request:fail」、**弹层不关、类型/文本留存可重试**；关闭后重开 → 类型/文本清空、按钮回 disabled（`openReport()` 重置）。展开态 footer「纠错」与操作单「题目纠错」是同一 `openReport(m)`。
   - **分享给队友**：`POST /api/share/create {uid, nickname:'考友KOU5', question_id:246821, team_id:null}` 被 abort → `hideLoading` + toast「request:fail」（`e.message || '分享失败'` 取到的是原文），操作单已关；`sharestub`（本地 200 桩 `{sid:'r517stub', module:'ziliao', submodule:'比重'}`，**未发往生产**）→ `navigator.clipboard.writeText('【比重】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/s/r517stub?v=a')`（`shareVariant('umst3…')='a'`，`mod` 取 `d.submodule`）+ toast「分享链接已复制，发给队友吧」+ `POST /api/track {event:'share_copy', source:'book_a', ref:'r517stub'}`（abort）。375/1440 同。
   - **展开详情**（2808）：卡 343×874.6（375）/ 696×583（1440）；题干 14 px 不截断；4 选项竖排 309×40.3（375 两行 13 px）/ 662×20.1（1440）、A `--ok` / C `--bad`；「我选 C 答案 A」；`mStatLine` null（REAL_TRAFFIC 口径无真人统计，预期）；历次作答 1 行「✗ 错 选 C 9月6日」；footer「AI 详解」68.9×32 + 「纠错」34×32（视觉 sm、命中 ≥40）+「···」；解析 rich 16/15 px；社交条 78 高「📝 写笔记 / 💬 讨论 (0) › / 🔗 分享给队友」各 40 高 + 「这题还没有讨论…」；展开只多发 `GET attempts / comments/count / notes` 三条只读。时政 2914：`opts []`（`options` NULL，A–D 嵌在题干）、「我选 A 答案 C」、解析在、**无历次作答 / 无社交条 / 无纠错**（都要 `question_id`）。折叠后回收起态。`docSW==cw`（375/375、1425/1425）、`pageerror []` 全部用例。
5. **登记（本轮不改，理由见 §4）**：
   - **R517-1 纠错类型 chip 行可见性**：7 chip 总宽 594，375 可视 343 → 「答案错误 / 解析错误 / 题干或选项错字」全显、「图片缺失」露 62/78、**「分类错误 / 重复题 / 其他」不可见**；1440 弹层 448 → 前 4 项全显、「分类错误」右缘落在 24 px 渐隐里（截图里半透）、**「重复题 / 其他」不可见**。`scroll-view` `show-scrollbar=false`，唯一提示是 24 px 渐隐。1440 实测：鼠标竖向滚轮悬停行上 `scrollLeft` 不动（事件冒泡到页面）；横向 delta（触控板）/ Shift+滚轮可滚到 146（=594−448）——桌面纯鼠标用户须知道 Shift+滚轮才能选到「重复题 / 其他」。历史 6 条报告里「其他」1 条。修法候选：弹层内改两行 `flex-wrap`（组件 `KgChipRow` 无 `wrap` 属性，COMPONENTS §1.3 定义它为横滚行）或按频次重排；属交互设计变更 → 交 UX 角色定，不单方面改组件契约。
   - **R517-2 网络失败 toast 透原文**：`api.js request()` `fail: reject(new Error(err.errMsg || '网络错误'))`，uni H5 的 `errMsg` 是 `request:fail` / `request:fail timeout`；纠错显「提交失败：request:fail」、分享显「request:fail」。`frontend-uni/src` 共 **119** 处 `title: e.message` / `e.message || …` toast 同形态（grep 计数）。**不能只改 `request()` 文案**：`api-policy.js isNetMsg/isTimeoutMsg`、`trackRetryable`、`exam-policy submitFailPlan` 都按原文 `request:fail|timeout` 分类（单测锁定）。修法候选：在显示层加 `userFacingError(e)`（网络类→「网络异常，请检查网络后重试」/超时→「请求超时，请重试」，其余原样），119 处逐点接入或在 toast 封装处统一——跨切面设计项，本轮登记。真人证据：离线/超时时无服务端日志可证，只有合成 abort 一手。
   - **R517-3 时政/手录无纠错/分享**：`question_id` NULL → 两入口按 `m.question_id` fail-closed（后端 `api_question_report` 也要 `qid`）；时政 27 行 / 8 uid **全部到期**，其中若有答案/解析错误用户无处反馈。产品缺口（P3），与 R515「时政不接普通池」同一原则：另立项（时政题库表 + 纠错落点），不在错题本臆造。
   - **R517-4 历史 reason 口径**：`question_reports.reason` 历史值「答案有误 / 解析有误」（08-01 之前 4 条）≠ 当前 `_QREPORT_TYPES`「答案错误 / 解析错误」，管理台按 reason 分组会分裂；只登记，不做兼容映射（无当前路径缺陷）。
   - **R517-5 簇扩路径**：见 §0.2；`access_log_report.classify()` 口径仍不改（不点头不改）。
6. **如实**：本机 CDP（`X-Kg-Probe: 1`、`localStorage.anonUid=umst3…`）；**非 GET `/api/**` 全 abort**（`question_report` / `share/create` / `track` 均未到边缘：窗内非探针 POST `[]`）；`sharestub` 是浏览器本地 `route.fulfill`，**生产 `shared_questions` 仍 17 行、`question_reports` 仍 6 行、`growth_events share_copy` 分布不变**；`GET review/cur` 桩 null；`umst3` 四表自 R516 发版起新增 0、`mistake 1953/2784/2914` 不变。点了操作单动作 / chip / 提交 / 分享——浏览器本地路径，**不是真人纠错/分享证据**；`RP-SUBMIT` 因 abort 即回，`reportBusy` 的「提交中…」态没量到（源码 `:loading="reportBusy"`）。

## 1. 边界与方法

- `~/r517/ops_path.py <375|1440> <report|share|sharestub|detail> <id,…>`：`report` 打开「···」→「题目纠错」→ 量弹层/chip/textarea/按钮 → 点 disabled 按钮（应 0 请求）→ 选「答案错误」→ `Input.insertText` 560 字 → 提交（abort）→ 量失败留存 → 关闭 → 展开卡 footer「纠错」重开（应清空）；`share` 「分享给队友」→ 0.25 s 步进采 toast/loading 3 s；`sharestub` 同路径但 `share/create` 本地 200 桩、hook `navigator.clipboard.writeText`；`detail` 点卡展开量题干/选项/答案比对/统计/历次/footer/解析/社交条几何 + 折叠。
- `~/r517/wheel_probe.py 1440 2808`：纠错弹层 chip 行桌面可达性——竖向滚轮 / 横向 delta / Shift+滚轮 / Playwright 点被裁 chip。
- 生产只读：`~/r517_pre.sh` → `~/r517_pre.out`（审前 00:42Z）、`~/r517_post.sh` → `~/r517_post.out`（审后 00:54Z，同脚本），`/tmp/r517_uid.py` → `~/r517_uid.out`（`umsacie7` / `141.11.46.*` 归因）。

## 2. 生产读数表（dist `94803e0b`）

| 项 | 375 | 1440 |
|---|---|---|
| 操作单 2808 | 面板 375×527 @273，7 动作 343×49 | 480×519 居中，448×49 |
| 操作单 2914（时政） | 375×331，3 动作（无纠错/分享） | 480×323，3 动作 |
| 纠错弹层 | 375×348 底 800，✕ 44×44，body 200 高 | 480×340 @280，✕ 44×44，body 192 |
| chip 行 | 343 视口 / 594 内容：全显 3 + 露 62/78 + 隐 3 | 448 / 594：全显 4 + 渐隐 1 + 隐 2；竖滚轮 0、横 delta/Shift 146 |
| textarea | 319×126（wrap 343×150，`min-height 88`），fs 13，maxlength 500，560→500 | 424×126（wrap 448×150） |
| 提交按钮 | 343×44；disabled → aria-disabled/pe none/op .4；选类型后 enabled | 448×44 同 |
| 提交（abort） | toast「提交失败：request:fail」，弹层留、chip「答案错误」留、500 字留 | 同 |
| 关闭→重开 | chipsOn []、len 0、disabled | 同 |
| 分享（abort） | toast「request:fail」，操作单已关 | 同 |
| 分享（桩） | 剪贴板「【比重】我刚做了一道题…/s/r517stub?v=a」+ toast「分享链接已复制，发给队友吧」+ `track share_copy book_a` abort | 同 |
| 展开 2808 | 卡 343×874.6；选项 309×40.3 ×4；历次 1 行；footer AI 详解 68.9×32 / 纠错 34×32；社交条 78 | 696×583；选项 662×20.1；同 |
| 展开 2914 | 卡 343×415.5；`opts []`；无历次/社交/纠错 | 696×279 |
| `docSW/cw` / errs | 375/375 / [] | 1425/1425 / [] |

## 3. 源码事实

- `book.vue itemSheet(m)`：`if (m.question_id) acts.push({t:'题目纠错'…}); if (m.question_id) acts.push({t:'分享给队友'…})`；展开 footer `<kg-button v-if="m.question_id" … @click.stop="openReport(m)">{{ m._reported ? '已纠错' : '纠错' }}</kg-button>`。
- `openReport()` 重置 `reportType/reportDetail`；`submitReport()` `detail.slice(0,500)`，成功 `m._reported=true` + 关弹层 + toast「感谢反馈，我们会尽快核查」，失败 toast「提交失败：」+ `e.message`（弹层不关）。
- `shareToMates()`：`showLoading('生成分享链接…')` → `shareCreate(qid)` → `mod = d.submodule || modName(d.module) || '行测'` → `trackEvent('share_copy','book_'+shareVariant(), d.sid)` → `setClipboardData(qShareText(mod, sid))`；失败 `e.message || '分享失败'`。后端 `team.py api_share_create` 回 `{sid, module, submodule}`（含已存在复用）。
- 后端 `api_question_report`：`rl(qreport, 30/h per uid)`、`type ∈ _QREPORT_TYPES` 否则 400、`qid` 必填、`detail[:500]`、同 uid 同题 `add_question_report` 去重 UPDATE（`status='open'` 重开）。
- `kg-chip-row.vue`：`scroll-view scroll-x :show-scrollbar="false"`，`.kg-chips` 右 24 px mask 渐隐；`.kg-chip::after` 命中扩 `--hit-min`；无 wrap 属性。`kg-button.vue` sm/md `::after` 同法扩命中（注释「视觉高度不变，命中区纵向扩到 --hit-min」）。
- `api.js request()` 失败：`reject(new Error(err.errMsg || '网络错误'))`；`api-policy.js isNetMsg = isTimeoutMsg || /网络错误|request:fail/`；`tests/api-policy.test.js` / `exam-policy.test.js` 以 `request:fail` 原文为夹具。

## 4. 为什么本轮不改

- 两条写路径与详情态在两视口按源码预期工作，无 R512–R516 那类「用户无法完成动作」的断点；R517-1 在移动端是常规横滚 chip 行（有渐隐、可滑），仅桌面纯鼠标场景需 Shift+滚轮；R517-2 是全站 119 处同形态的显示层口径，且策略层依赖原文分类——两项都属交互/文案设计变更，按 Company OS「前端须与 UX 协作、下开发指令前先设计论证」交 UX 角色定方案后再做；R517-3/4 是产品缺口/历史数据口径，不属最小修范围。
- 无真人证据表明有人在这两条路径上受阻（非探针 `POST question_report` / `share/create` 自 R516 起 0；历史 17 条分享 / 6 条报告都成功落库）。

## 5. 证据文件

- `~/r517/ops_path.py`、`~/r517/{report,share,sharestub,detail}_375.out`、`~/r517/{report,sharestub,detail}_1440.out`、`~/r517/*.png`（各步截图）、`~/r517/wheel_probe.py` + `~/r517/wheel_1440.png`
- `~/r517_pre.sh` / `~/r517_pre.out`（00:42Z）、`~/r517_post.sh` / `~/r517_post.out`（00:54Z）、`~/r517_uid.out`
