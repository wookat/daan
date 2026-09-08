# R519：登记项 → 实修（统筹者指令「只读走查已够，把登记项转为实际修复」）——R517-2/R518-2 全站 uni `fail` 原文 `request:fail` 在网络层映射为中文（分类/重试口径不变）+ R518-1 讨论页 `logged` 初值取 token（登录态进页 `GET comments` 不再 ×2）+ R518-3 游客 `focus=1` 弹登录门并保留聚焦意图 + R517-1 `KgChipRow` 新增 opt-in `wrap` 让纠错 7 类型全显 + 追加：`guard_account_uid` 对 JSON body 非字符串 uid 返 400（生产 01:30Z 5 条 TypeError Traceback）；生产 `de94fde` → `03f7d826`，375/1440 复采四项全对上

日期：2026-09-08（UTC 01:2x–02:1x）。代码 PR #650（已由老板合入 main `6cec81dd`；兄弟会话同修法 PR #649 被其自行关闭为重复）。本文档/handoff/SKILL 在后续纯文档分支。

## 0. 结论

1. **四项前端登记项全部实修并上线，改后生产 375/1440 一手全部对上预期**（`~/r519/post/*.out`，dist `index-DydCjYD3.js` / rev `03f7d826`）：
   - **R517-2 / R518-2 网络失败文案**：讨论页 abort `GET comments` → 空态「加载失败：**网络错误，请检查网络后重试**」+ 「重试」→ 放行后重试回「共 0 条」空态；纠错提交 abort → toast「提交失败：网络错误，请检查网络后重试」；登录态发布 abort → toast「网络错误，请检查网络后重试」。此前三处均为 `request:fail` 原文（R517 §0.4 / R518 §0.5）。
   - **R518-1 讨论页重复 GET**：本地假 token 登录态直开 `…&focus=1` → 整个进入过程 `GET comments?question_id=246821&sort=hot&uid=…` **恰 1 次**（`nCommentsGET 1`，R518 为 2）；游客路径同样 1 次；`focus=1` 0.5 s 内 textarea `focused=true`、占位「说说你的解法 / 吐槽这道题…」。
   - **R518-3 游客「抢首评」落点**：游客直开 `…&focus=1` → 300 ms 后弹既有登录 modal「需要登录 / 发言需登录账号，登录后即可参与讨论 / 取消 · 去登录」（此前静默无提示）；「取消」→ modal 关、留在讨论页可读评论；「去登录」→ `#/pkgA/user/login`「登录 / 注册」；**不带 `focus=1` 的游客进页不弹 modal**（`NOFOCUS modal null`，避免打扰只读者）。
   - **R517-1 纠错类型 chip 裁切**：纠错弹层 `kg-chips kg-chips--sm kg-chips--wrap`、`scroll-x` 关、mask `none`、`.kg-chips__row` `display:flex / flex-wrap:wrap`；7 个 chip **全部完整可见**（`nVisibleFull 7`），375 两行（4+3，行高 30、行距 38）/ 1440 两行（4+3）；此前 375 隐 3 / 1440 隐 2（R517 §0.4）。弹层 375 `375×386`（R517 时 348，+38 = 多一行）/ 1440 `480×378`（R517 340）；「提交纠错」343×44 / 448×44 未选类型 `aria-disabled=true`+`pe:none` → 选「其他」后可用 → `POST question_report {question_id:246821, uid, type:"其他", detail:""}` abort → toast 映射文案、弹层留存可重试。
   - 全部用例 `docSW==cw`（375/375、1425/1425）、`pageerror []`；非 GET `/api/**` 全 abort（边缘非探针 POST `[]`）。
2. **追加后端修（生产一手命中）**：发版前基线（`~/r519_pre.out` 01:50Z）容器窗 5xx 8 条里 **5 条 500 = 01:30:29–49Z `POST /api/mistakes ×3 / answer_log / team/create`，容器日志 5 条 Traceback `TypeError: expected string or bytes-like object, got 'list'|'int'|'dict'`**（来源 `140.232.64.5` 探针网段，是兄弟会话 W10 生产回归的畸形参数矩阵，无真人）。根因 `guard_account_uid` 中间件从 JSON body 取 `uid` 后直接 `auth.is_account_uid(uid)` → `_ACCOUNT_UID_RE.match(非 str)` 抛 `TypeError`，中间件不经 app 的 `ValueError/TypeError` 异常处理器 → 500；即使守卫放过，`/api/answer_log` 的 `(body.get("uid") or "").strip()` 对 int/list 也会 `AttributeError`。修：`is_account_uid()` `isinstance(uid, str) and …`（fail-closed）+ 中间件 `uid is not None and not isinstance(uid, str)` → `400 {"detail":"uid 格式错误"}`；`uid:null`/缺省语义不变（留给端点）。**改后生产容器内直打**（`docker exec … urllib`，`X-Kg-Probe: 1`）：`answer_log {uid:1}` / `{uid:["u1"]}`、`mistakes {uid:{u:1}}`、`team/create {uid:true}` **全 400 `uid 格式错误`**、容器日志 Traceback 0（`~/r519_post.out` 尾段）。兄弟会话同一修法 PR #649（`参数格式错误` 文案）在本 PR 合入后自行关闭为重复。
3. **(c) / 到期项 0 增量**：R518-fresh 容器整窗（01:03:49Z→01:58Z，1653 请求）5xx 8 = 重建窗 3 条 503（R518 已归因）+ 上述 5 条 500（探针，已修）；R519 容器（01:58:41Z→02:05Z，159 请求）**5xx 0**、assets 404 / monitor / mpUA / 非探针 POST / 401·403 / Traceback 全 0；WAL `4,173,592` 同字节（09:59 CST mtime 是 checkpoint 写回，字节数不变）；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`questions?module=时政` 0；`user_profile` 11→9（`test-w10-*` 已被兄弟清理）、`shared_questions` 19→17。**无新的外部真人证据**。
4. **簇**：09-07 终值 1445 行 / 1443 IP 不变；09-08 00:00→02:05Z **1972 行 / 1927 IP**（15.8 行/分、峰 97 = R516 重建窗、无 >120 s 间断、UA 14、每 IP ≤2、200 ×1900 / 503 ×72）仍在跑；`crawler-stats.json` 01:23Z 版 `humans.page 09-08 = 1234 / ips 1189`——与复算一致，日报候选真人 09-08 仍基本全是簇。本轮 R519 发版重建窗（01:58:3x–01:58:41Z）**0 条 5xx**（compose 4 min 收敛、未触顶，见 §5）。归因仍只有请求签名，无 IP 情报，口径不改。
5. **发版**：预检 `mem_avail=269MB / disk 5.1G(90%) / load 1.72 / other_builds=0 / prunes=0`；compose 01:54:28Z → 容器 `01:58:41Z rev=03f7d826` healthy 0 重启，`KG_COMPOSE_EXIT rc=0`（约 4 min 收敛，未触 600 s）；bundle 线上=本机 `index-DydCjYD3.js`（gzip 123 KB ≤160）；5b 各 Accept-Encoding 变体 OK；6b `/` perf 0.99 / a11y 1.00 / LCP 1747 / CLS 0.06、`/tiku/` 1.00 / LCP 939 / CLS 0.00；`DEPLOY_RC=0`（`~/r519_deploy.log`）。`deploy-history.log` 尾行 `01:59:03Z rev=03f7d826 bundle=index-DydCjYD3.js`。
6. **如实**：本机 CDP `X-Kg-Probe: 1`、`localStorage.anonUid=umst3…`；非 GET 全 abort，`netfail` 用 abort `GET comments?` 造失败态、`dclogged` 是本地假 token `r519-local-fake`（`comments/inbox`·`auth/*`·`profile` GET 一并 abort）**不是真实登录用户证据**；后端 400 复测是容器内 `127.0.0.1:8000` 直打（带探针头、被中间件 400 拦下、**0 行写入**）；`umst3` 四表自 R516 发版起新增 0（32/45/22/1）、`mistake 1953/2784/2914` 不变；`question_reports` 6 / `shared_questions` 17 / qid 246821 笔记评论 0/0 审前后不变。`reportBusy`「提交中…」态因 abort 即回未量到；`selected` 字段在脚本里按 `--on` 类名判为 `[]`，但 POST body `type:"其他"` 证实选中生效（脚本判据过窄，非产品问题）。点了 chip/提交/发布/取消/去登录——浏览器本地路径，**不是真人纠错/评论证据**。

## 1. 设计论证（改前）

| 登记项 | 断点/代价 | 备选 | 取舍 |
|---|---|---|---|
| R517-2/R518-2 `request:fail` | 全站 119 处 `e.message` 直显；`api-policy isNetMsg`/`trackRetryable`/`exam-policy submitFailPlan` 及单测按原文 `request:fail|timeout` 分类 | (a) 每处 toast 加 `userFacingError(e)`；(b) 在 `api.js` 五个 `uni.request/uploadFile` `fail` 回调处把 `err.errMsg` 映射后再 `reject` | 取 (b)：一处收口、真人可见；映射结果「网络错误，请检查网络后重试」/「请求超时，请稍后重试」仍分别命中既有 `/网络错误/` / `/超时/` 正则 → 分类/重试/埋点口径**零变化**（源锁 `api-r519-net-fail-message.test.js` 断言 `isNetMsg`/`isTimeoutMsg`/`trackRetryable`/`submitFailPlan` 对映射后文案与原文同判）；可读的应用/HTTP 文案原样透出（只对 `:fail` 原文与空串映射） |
| R518-1 重复 GET | `data.logged=false` → `onLoad load()`；`onShow` 见 token 翻转再 `load()` | `logged: !!getToken()` 一行 + 抽 `syncLogged()`（`onShow`/`authChanged` 共用，只在翻转时 `load()`） | 取之；同一进入 1 次 GET，登录返回仍刷新 |
| R518-3 游客 `focus=1` | 源码只在有 token 时 `autoFocus`，游客到页静默 | (a) 保持静默；(b) 到页即弹既有 `ensureLogin()` modal 并记 `_wantFocus`，登录返回后补聚焦；(c) 只 toast | 取 (b)：`focus=1` 只来自「抢首评」/「写评论」这类明确的发言意图，弹既有 modal 不新增文案/组件；无 `focus=1` 的只读进入不弹（源锁两条） |
| R517-1 chip 裁切 | `KgChipRow` 按 COMPONENTS §1.3 是横滚行，7 项 375 隐 3 / 1440 隐 2、桌面竖滚轮不横滚 | (a) 按频次重排；(b) 组件加 opt-in `wrap` prop，默认契约不变，只纠错弹层用 | 取 (b)：默认横滚/24 px 渐隐/选中项自动滚全部保留（源锁），`wrap` 时关 `scroll-x`/关 `scroll-into-view`/去 mask/`flex-wrap`；弹层仅 +38 px |
| 追加 uid 非 str 500 | 生产 Traceback 5 条（探针触发，但任何客户端都能打出 500） | 中间件返 400 + `is_account_uid` 类型守卫 | fail-closed，`null` 语义不变；三接口 × int/list/dict/bool 源锁 |

## 2. 改动清单（PR #650，`6cec81dd`）

- `frontend-uni/src/api-policy.js`：`NET_FAIL_TEXT` / `NET_TIMEOUT_TEXT` / `netFailMessage(errMsg, fallback)`（`isTimeoutMsg`/`isNetMsg` 不动）。
- `frontend-uni/src/api.js`：`rawRequest` / `exportPdf` / `streamExplain` / `scanSheet` / `uploadExplain` 五处 `fail` 改 `reject(new Error(netFailMessage(err && err.errMsg[, '上传失败，请检查网络后重试'])))`。
- `frontend-uni/src/pkgA/social/discuss.vue`：`logged: !!getToken()`；`onShow → syncLogged()`；`authChanged → syncLogged()`；`syncLogged()` 只在翻转时 `load()`，且 `l && _wantFocus` 时补 `focusCompose()`；`onLoad focus==='1'` → `_wantFocus=true` + 300 ms `focusCompose()`；`focusCompose()` 先 `ensureLogin()`（游客弹 modal、意图保留），登录态清意图并 `autoFocus`。
- `frontend-uni/src/components/kg-chip-row/kg-chip-row.vue`：prop `wrap`（默认 false）；`:scroll-x="!wrap"`、`:scroll-into-view="scrollToSelected && !wrap ? … : ''"`、`kg-chips--wrap` 去 mask + `.kg-chips__row` `flex-wrap:wrap`。
- `frontend-uni/src/pages/book/book.vue`：纠错弹层 `<kg-chip-row size="sm" :options … wrap :scroll-to-selected="false" …/>`（属性顺序保持 `size` 后紧跟 `:options` 以过 R410 源锁）。
- `backend/app/auth.py` `is_account_uid()` 类型守卫；`backend/app/main.py` `guard_account_uid` 非 str uid → 400。
- 源锁：`frontend-uni/tests/api-r519-net-fail-message.test.js`、`discuss-r519-logged-init-focus-gate.test.js`、`chip-row-r519-wrap.test.js`；`backend/tests/test_guard_account_uid.py` 追加 `test_non_string_uid_in_json_body_is_400_not_500`（int/list/dict/bool × 三接口）+ `test_null_uid_in_json_body_left_to_endpoint`。
- 门：vitest 128 文件 / 885 用例、eslint、`lint:tokens`、`lint-pages` 0 error、`build:h5`；pytest 557 passed、ruff、pyright 0；`git diff --check` 空。

## 3. 改后生产读数表（rev `03f7d826`，`~/r519/post/`）

| 用例 | 375 | 1440 |
|---|---|---|
| `netfail` 空态 | 「加载失败：网络错误，请检查网络后重试 重试」`retry:true` → 重试 `GET comments …sort=hot` → 「还没有讨论 …」 | 同 |
| `dclogged` 进页 | `taFocused true`、占位「说说你的解法 / 吐槽这道题…」、`nCommentsGET 1`、`comments/inbox` abort | 同 |
| `dclogged` 发布 abort | toast「网络错误，请检查网络后重试」 | 同 |
| `dcguest` 进页 `focus=1` | modal「需要登录 / 发言需登录账号，登录后即可参与讨论 / 取消·去登录」、`taFocused false`、`nCommentsGET 1` | 同 |
| `dcguest` 取消 / 无 focus / 去登录 | modal null 留在页 / `NOFOCUS modal null` / `#/pkgA/user/login`「登录 / 注册」 | 同 |
| `report` 操作单 | 7 项「同考点强化 5 道新题 / 练3道同类 / 题目纠错 / 分享给队友 / 标为已掌握 / 删除 / 取消」 | 同 |
| `report` chip 行 | `kg-chips--wrap`、`scroll-x null`、mask none、flex wrap；7/7 全显、2 行（498 / 536）；弹层 375×386 | 同；2 行（337 / 375）；弹层 480×378 |
| `report` 提交 | 未选 `aria-disabled true / pe none` → 选「其他」→ `POST question_report` abort → toast「提交失败：网络错误，请检查网络后重试」 | 同 |
| 后端 400 | `answer_log {uid:1}`/`{uid:["u1"]}`、`mistakes {uid:{}}`、`team/create {uid:true}` → 400 `uid 格式错误`，Traceback 0 | — |

## 4. 证据文件

- 代码：PR #650 https://github.com/wookat/kaogong-assistant/pull/650 （main `6cec81dd`；含 `03f7d826` 后端追加）；重复修法 PR #649（兄弟会话，已关闭）。
- 脚本/输出：`~/r519/post_path.py <375|1440> <netfail|dclogged|dcguest|report> [mistakeId]`；`~/r519/post/{netfail,dclogged,dcguest,report}_{375,1440}.out`、`~/r519/post/*.png`（`report_375_2808_open.png` = 两行 chip 全显、`*_submit_fail.png` = 映射文案 toast）。
- 生产只读：`~/r519_pre.sh` → `~/r519_pre.out`（01:50Z，含 5 条 500 Traceback 命中）、`~/r519_post.sh` → `~/r519_post.out`（02:05Z + 容器内 400 复测）、`~/r519_deploy.log`、`~/r519_pytest.log`。
