# R518：错题展开详情社交条「写笔记」/「讨论」落点 375/1440 只读整页审 → 笔记编辑态/草稿/失败留存/成功态（本地桩）与讨论页（空态·失败重试·排序·登录门·草稿·`focus=1`·无 qid fail-closed·登录态发布失败留存·收件箱）均按源码预期工作、**本轮不改代码 / 0 部署**；登记 ① 登录态进讨论页 `GET /api/comments` 重复发 2 次（`onLoad load()` + `onShow` `logged` 翻转再 `load()`）② 三处失败 toast 透原文 `request:fail`（= R517-2 同口径）③ 游客点「抢首评」到 `focus=1` 无任何提示（按源码只在有 token 时聚焦）④ 簇 09-08 至 01:20Z 1282 行 / 1237 IP 仍在跑、扩路径行只占 ≈0.6%

日期：2026-09-08（UTC 01:0x–01:2x）。**生产在 R518 取证前被兄弟会话换成 `de94fde`（W10 集成，#643）**：容器 `01:03:49Z` 重建、`/api/health rev=de94fde`；本轮全部一手（`~/r518/*.out` 01:13Z–01:18Z）都在该容器上采；`git diff 94803e0b de94fde -- frontend-uni/src/pkgA/social frontend-uni/src/components/q-social-bar frontend-uni/src/pages/book` 为空，社交条/讨论页/错题本源码与 R517 审时相同。本轮 0 部署。文档/handoff/SKILL 在新分支（`origin/main 0cde594d` 起）。

## 0. 结论

1. **(c) / 到期项 0 增量（R516 容器整窗 00:29:12Z→ + R517-fresh 容器 01:03:49Z→01:20Z 两窗）**：assets 404 / mpUA / 非探针 POST / 401·403 / Traceback 全 0；monitor 4 行全探针网段（`140.232.64.3/.5`）；**5xx 5 条 = 01:03:47–51Z 兄弟会话发版重建窗**（`GET /api/practice/progress`、`POST /api/answer_log` 502/503，全部来自探针网段 `140.232.64.5`——兄弟会话自己的走查流量，无真人）；WAL `4,173,592` 同字节；probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、`review_similar_auto` 3/1；公告「详情」/`home_bundle`/`mistakes_total` 非探针无样本；`questions?module=时政` 0。**无新的外部真人证据**。
2. **社交表 / 真人触达**：`question_notes` 5 行 / 5 uid（最近一条 08-26；`umst3` 0）、`question_comments` 17 行 **全 `status='deleted'`** / 6 uid、`comment_likes` 5、`comment_reports` 0、qid 246821 笔记/评论 0/0 —— 审前后完全相同。边缘 09-07 起非探针 `POST notes|comments|share|question_report` **0 条**；唯一非探针讨论页 API 触达是 `141.11.46.189 umsacie7…`（R502 已入档设备）09-07 11:56:52Z `GET /api/comments?question_id=234494&sort=hot` 一次（该题评论 0 → 看到空态即走），其余是错题本展开时的 `comments/count` / `notes` 只读 GET。**没有任何真人写过笔记/评论**。
3. **簇**：09-07 UTC 终值 1445 行 / 1443 IP（含 01:11:59Z 单条 `/tiku/` 探路 + 22:24:51Z 起连续段）；09-08 00:00→01:20Z **1282 行 / 1237 IP**（15.8 行/分、峰 97 = R516 重建窗重试、无 >120 s 间断、UA 14、每 IP ≤2、200 ×1210 / 503 ×72），仍在跑。`crawler-stats.json` 仍 00:23Z 版（`humans.page 09-07 1444 / 09-08 250`），按同口径复算 09-08 至 01:20Z 候选真人 1282 行 / 1237 IP **全是簇**。扩路径（`sig()` 全 `/tiku/` GET 同签名但非 `/tiku/q/`）：09-07 8 行（`/tiku/papers/*` 3、`/tiku/t/*` 2、`/tiku/panduan/*` 2、`/tiku/` 1）、09-08 8 行（`/tiku/papers/*` 4、`/tiku/y/*` 3、`/tiku/t/*` 1），这些 IP 与 `/tiku/q` 簇 IP 交集 0——扩路径是**涓流**（≈0.6%），主体仍是 `/tiku/q/*`；归因仍只有请求头/节奏特征，无 IP 情报。
4. **W10 兄弟会话痕迹（推断，未求证）**：`user_profile` 9→11（`test-w10-*`，边缘 `POST /api/profile` 01:00:38Z / 01:02:38Z / 01:18:59Z 全 probe=1 `140.232.64.5`）、`shared_questions` 18→19（`test-w10-a` sid `jm7vpb24` 01:20:02Z，`growth_events share_copy ref=jm7vpb24 probe=1`）；两表无 `probe` 列仍需人工剔。生产 rev `94803e0b`→`de94fde` 由兄弟会话发版（`dist/build/h5/index.html` 01:02:07Z、容器 01:03:49Z）。
5. **一手（`umst3` 真数据，mistake 2808 → qid 246821，dist `de94fde`，`~/r518/*.out`）——两条落点均按源码预期工作，无功能断点**：
   - **社交条**（展开 2808 底部）：375 `309×78` / 1440 `662×78`，三链接「📝 写笔记 55×40 / 💬 讨论 (0) › 72.5×40 / 🔗 分享给队友 79×40」+「这题还没有讨论，说说你的解法… 抢首评 →」309×31 / 662×31；展开只多发 `GET attempts / comments/count / notes`。时政 2914 无社交条（R517 已记，`question_id` NULL fail-closed）。
   - **写笔记**（`q-social-bar.vue`）：点「写笔记」→ 编辑态 `noteEdit` 309×99 / 662×99；textarea `auto-height` 291×50 / 644×50，fs 13 / lh 20.8，占位「记下这题的方法 / 陷阱，下次遇到随解析展示」（`.uni-textarea-placeholder` 兄弟节点），`maxlength=1000`；操作「取消 32×40 / 保存 32×40」。输入 30 字 → **草稿即写 `qNoteDraft:246821`**；「保存」→ `POST /api/notes {uid, question_id:246821, content}` abort → toast `request:fail`、**编辑态与 30 字留存可重试**；「取消」→ 回「写笔记」但草稿仍在 LS；重开 / 折叠再展开 / **整页 reload 后再点「写笔记」都恢复 30 字**；清空到 0 → LS 键删除。`notestub`（本地 200 桩 `{ok, content}`，**未发生产**）：toast「笔记已保存」→ 「📝 我的笔记：… 改」309×53.2（「改」20×40）、「写笔记」链接隐去、LS 草稿清除；「改」→ 编辑态多出「删除笔记」56×40；删除（桩 `content null`）→ toast「笔记已删除」→ 回「写笔记」；空内容保存 = 删除同路径。375/1440 同。
   - **讨论页**（`#/pkgA/social/discuss?qid=246821`，游客）：`.wrap` 375×505.8（pb 88）/ 1076×403.6（pb 88）；`.kg-two` 375 `column-reverse`（评论区在上、题目摘要卡在下）/ 1440 `row` aside 320 + main 700；题目摘要卡 343×179.4 / 320×179.4（tag「资料分析」「2019 广东 真题」、题干 4 行截断 fs 13、「正确答案 A」）；工具栏 343×44 / 700×44：`kg-segment`「最热 / 最新」213×32 / 570×32 + 「共 0 条」+ 「消息」66×44；空态「还没有讨论 / 说说你的解法、避坑经验，帮到下一位考友」343×74.8；公约条 343×59.6 / 700×42.8；输入条 375 `fixed` 375×93 贴底（textarea 195×44 + 「发布」104×44）/ 1440 `sticky` 700×94（textarea 518×44 + 发布 104×44）。游客：占位「登录后参与讨论」、「发布」`disabled`+`aria-disabled`+`pe:none`+`op .4`；点 textarea → modal「需要登录 / 发言需登录账号，登录后即可参与讨论 / 取消·去登录」300×175.8（按钮 150×48）；取消后可继续输入 → 草稿 `dcDraft:246821` 即写、「发布」变可用；点「发布」→ **0 请求**、再弹登录 modal（`ensureLogin` 在 `submit()` 里先拦）；「去登录」→ `#/pkgA/user/login`「登录 / 注册」→ 返回 **草稿仍在**；「最新」→ `GET comments?…&sort=new`；「消息」→ 登录 modal；清空 → LS 键删除、「发布」回 disabled。返回错题本（`book.vue load()` 全部 `open:false`，须重新展开）→ 「抢首评 →」→ `…&focus=1`（游客无聚焦、无 modal，见登记 ③）。
   - **讨论页失败态**（`dcfail`，abort `GET comments?…`）：`加载失败：request:fail` + 「重试」1 个（toast 同文）；放行后点「重试」→ `GET comments?…sort=hot` → 空态 + 「共 0 条」，skeleton 消失，errs []。
   - **讨论页登录态**（`dclogged`，`localStorage.authToken='r518-local-fake'` 本地假 token，`comments/inbox`·`auth/*`·`profile` GET 一并 abort）：`focus=1` → 0.5 s 时 textarea `focused=true`；占位「说说你的解法 / 吐槽这道题…」；输入 16 字 → 草稿即写；「发布」→ `POST /api/comments {question_id:246821, content, parent_id:null}` **abort** → toast `request:fail`、**草稿与文本留存**、按钮回可用；「消息」→ `#/pkgA/social/inbox`「讨论消息」（`GET comments/inbox` abort）。**同一进入过程 `GET comments?…sort=hot` 发了 2 次**（登记 ①）。375/1440 同。
   - **无 qid**（`#/pkgA/social/discuss`）：fail-closed 空态「链接缺少题目参数 / 请从题目解析页进入讨论，或去讨论广场看看大家在聊什么 / 去讨论广场」118×44，0 API；点 → `#/pkgA/social/plaza`「讨论广场」`GET comments/plaza`。
   - 全部用例 `docSW==cw`（375/375、1425/1425）、`pageerror []`；`failed` 里只有被 abort 的 `POST notes|comments|track`、被 abort 的 `GET comments(/inbox)` 与 tabbar 图标 `ERR_ABORTED`（导航打断，既有）。
6. **登记（本轮不改，理由见 §4）**：
   - **R518-1 登录态进讨论页评论列表重复请求**：`discuss.vue data.logged=false` → `onLoad()` 先 `load()`；uni 随后触发 `onShow()`，`!!getToken() !== this.logged` 成立 → `logged=true` 再 `load()` → 同参 `GET /api/comments?question_id&sort=hot&uid` 连发 2 次（`dclogged` 375/1440 `gets` 各 2 条；游客 `dcfail`/`discuss` 只 1 条）。两次并发回包同数据、后到者覆盖，无可见异常，只是每次进入多 1 次只读请求；`loadInbox()` 只在 `onShow` 发、不重复。修法候选：`data()` 里 `logged: !!getToken()`（`onShow` 首次即不翻转）或 `onShow` 首次跳过——一行改动 + 源锁，但本轮**无真人受影响证据**（非探针登录态讨论页 0 次），属性能微修，登记待并入下一次含发版的轮次（本轮宿主 `MemAvailable 239 MB`、兄弟会话刚发版，不为一行只读优化单独发版）。
   - **R518-2 失败 toast 透原文**：笔记保存 `e.message`、评论加载 `加载失败：request:fail`、评论发布 `request:fail` 三处 = R517-2 同一 `api.js request()` 口径（119 处），不单页改。
   - **R518-3 游客「抢首评 →」落点无提示**：`q-social-bar openDiscuss(focus)` → `…&focus=1`；`discuss.vue onLoad` 只在 `getToken()` 为真时 300 ms 后 `autoFocus`，游客到页后无聚焦、无登录 modal，要再点输入框才知道要登录。按源码是有意「不对游客弹窗」，属交互设计取舍（P3，交 UX 定：到页即弹 vs 保持静默），不单方面改。
   - **R518-4 `question_comments` 17 行全 deleted**：历史评论全是 R25/R28 测试后清理（`R28测试1/2/4`、`测试小助手`、`考友0001`），生产从未有一条真人评论；`comments/plaza`、`/tiku/discuss/` 聚合页均为空态——不是缺陷，是「无人用」的事实，继续按「无一手不加功能」原则不做运营性造数。
   - **R518-5 簇扩路径涓流 + 日报口径**：见 §0.3，`access_log_report.classify()` 仍不改（不点头不改）。
7. **如实**：本机 CDP（`X-Kg-Probe: 1`、`localStorage.anonUid=umst3…`）；**非 GET `/api/**` 全 abort**（`notes` / `comments` / `track` 均未到边缘：窗内非探针 POST `[]`，`probe` 头在所以边缘只记 probe=1 GET）；`notestub` 是浏览器本地 `route.fulfill`，**生产 `question_notes` 仍 5 行、qid 246821 笔记/评论仍 0/0**；`dclogged` 的登录态是**本地假 token**（`r518-local-fake`），不是真实登录，`comments/inbox` 等账号 GET 一并 abort，不能证明真实登录用户在生产的表现；`GET review/cur` 桩 null；`umst3` 四表自 R516 发版起新增 0、`mistake 1953/2784/2914` 不变。点了写笔记/保存/取消/删除/讨论/发布/排序/消息/抢首评——浏览器本地路径，**不是真人笔记/讨论证据**。`reload` 后草稿恢复用例只在 375 跑（1440 没跑 reload 步）；`busy`「保存中」态因 abort 即回未量到。

## 1. 边界与方法

- `~/r518/social_path.py <375|1440> <note|notestub|discuss|noqid|dcfail|dclogged> <mistakeId>`：`note` 展开卡 → 量社交条 → 「写笔记」→ 量编辑态/占位/`maxlength` → `Input.insertText` 30 字 → 读 LS 草稿 → 「保存」（abort）→ 量留存 → 「取消」→ 重开 → 折叠再展开 → `reload` 再展开再点「写笔记」→ 清空；`notestub` 同路径但 `POST notes` 本地 200 桩 `{ok, content}` → 量「我的笔记」/「改」/「删除笔记」/空内容保存；`discuss` 「讨论」→ 0.25 s 步进采 skeleton/空态/toast 3 s → 量整页几何 → 点 textarea（modal）→ 取消 → 输入 → 「发布」（应 0 请求 + modal）→ 「去登录」→ 返回 → 「最新」→ 「消息」→ 清空 → 返回错题本重新展开 → 「抢首评 →」；`noqid` 直开无参路由 → 「去讨论广场」；`dcfail` abort `GET comments?` → 量失败态/重试按钮 → 放行 → 点「重试」；`dclogged` `add_init_script` 注入本地假 token → 直开 `…&focus=1` → 采聚焦时序 → 输入 → 「发布」（abort）→ 量留存 → 「消息」→ inbox。
- 生产只读：`~/r518_pre.sh` → `~/r518_pre.out`（审前 01:04Z）、`~/r518_pre2.sh` → `~/r518_pre2.out`（容器 events / 5xx / 归因）、`~/r518_post.sh` → `~/r518_post.out`（审后 01:20Z，同脚本 + 三窗 + 社交 API 计数）、`/tmp/r518_5xx.py`（5 条 5xx 逐条 IP/probe）。`sig()` 本轮扩为「全 `/tiku/` GET + `en-US,en;q=0.9` + 无 Referer」，另保留 `sigq()`（只 `/tiku/q/`）对照。

## 2. 生产读数表（dist `de94fde`，社交/错题本源码 = `94803e0b`）

| 项 | 375 | 1440 |
|---|---|---|
| 社交条 2808 | 309×78；三链接 55/72.5/79 ×40；抢首评 309×31 | 662×78；同；662×31 |
| 笔记编辑态 | `noteEdit` 309×99；ta 291×50 fs 13 lh 20.8 maxlength 1000；取消/保存 32×40 | 662×99；ta 644×50；同 |
| 保存（abort） | toast `request:fail`；editing 留、30 字留、LS 留 | 同 |
| 取消 → 重开 / 折叠展开 / reload | 30 字三次都恢复；清空 → LS 删 | 重开恢复（未跑 reload） |
| 笔记桩成功 | 「笔记已保存」→ 我的笔记 309×53.2 +「改」20×40；LS 清 | 662 宽同形态 |
| 改 → 删除笔记桩 | 「删除笔记」56×40 → 「笔记已删除」→ 回「写笔记」 | 同 |
| 讨论页整页 | wrap 375×505.8；two column-reverse；qcard 343×179.4；toolbar 343×44；seg 213×32；空态 343×74.8；公约 343×59.6；输入条 fixed 375×93（ta 195×44 + 发布 104×44） | wrap 1076×403.6；row aside 320 / main 700；qcard 320×179.4；toolbar 700×44；seg 570×32；公约 700×42.8；输入条 sticky 700×94（ta 518×44 + 发布 104×44） |
| 游客点 textarea | modal 300×175.8「需要登录」取消/去登录 150×48 | 同 |
| 游客草稿 + 发布 | LS `dcDraft:246821` 即写；发布 0 请求 + modal；去登录→返回草稿留 | 同 |
| 最新 / 消息 / 清空 | `sort=new` GET；登录 modal；LS 删 + 发布 disabled | 同 |
| 抢首评 → `focus=1`（游客） | 无聚焦、无 modal、`active=BODY` | 同 |
| 无 qid | 「链接缺少题目参数」+「去讨论广场」118×44，0 API → plaza | 同（wrap 1076） |
| dcfail | 「加载失败：request:fail」+ 重试 → 放行重试 → 空态 共 0 条 | （未跑，逻辑同一分支） |
| dclogged | 0.5 s 聚焦；占位「说说你的解法 / 吐槽这道题…」；`POST comments` abort → `request:fail` + 草稿留；消息 → inbox；`GET comments` ×2 | 同；`GET comments` ×2 |
| `docSW/cw` / errs | 375/375 / [] | 1425/1425 / [] |

## 3. 源码事实

- `q-social-bar.vue`：`startEdit()` 读 `qNoteDraft:<qid>`；textarea `auto-height` `maxlength 1000`，`@input` 即写草稿；`saveIt(content)` → `saveNote(qid, content.trim())` 成功 `note=d.content||''`、`editing=false`、删草稿、toast「笔记已保存」/「笔记已删除」（空内容 = 删除），失败 `toast e.message`（编辑态不关）；`note` 非空时链接区显「📝 我的笔记：… 改」并隐「写笔记」；`openDiscuss(focus)` → `navigateTo /pkgA/social/discuss?qid=&focus=1`。
- `discuss.vue`：`data.logged=false`；`onLoad` 读 `dcDraft:<qid>`、`focus==='1' && getToken()` → 300 ms `autoFocus`、`loadQuestion()` + `load()`、注册 `authChanged`；`onShow` `logged` 翻转即 `load()` + `loadInbox()`（→ 登记 ①）；`load()` 失败 `loadErr=e.message` + toast；模板失败态「加载失败：{{loadErr}}」+「重试」`@click=load`；`ensureLogin()` 未登录 `showModal` → `/pkgA/user/login`；`submit()` 先 `ensureLogin` 再 `postComment`，失败 toast、草稿不清；`goInbox()` 需登录；`noQid` 空态 → `goPlaza()` `reLaunch /pkgA/social/plaza`。
- 后端 `GET /api/comments` 只回 `status='ok'`（17 行 deleted 全不可见）；`POST /api/notes` 空 content 即删除行。
- SKILL 旧条「`logged` computed 依赖非响应式 `getToken()`，登录返回须 F5」已过时：当前 `onShow` + `authChanged` 两路刷新（R496–R499 收口），本轮 `dclogged` 直开即为登录态。

## 4. 为什么本轮不改

- 两条落点在两视口按源码预期工作，失败态都保留输入可重试、成功态（本地桩）状态切换正确、无 qid fail-closed，无 R512–R516 那类「用户无法完成动作」的断点。
- R518-1 是一次多余只读 GET（同参、后到覆盖、无可见异常），无真人受影响证据（非探针登录态讨论页 0 次），且本轮宿主 `MemAvailable 239 MB` / 兄弟会话 01:03Z 刚发版——不为一行性能优化单独走 build + recreate（R516 咬过 600 s 触顶 + 重建窗 5xx）；待下一次含发版轮次并入并加源锁。
- R518-2 属 R517-2 全站口径；R518-3 属交互设计取舍；R518-4 是「无人用」事实非缺陷。
- 无真人证据表明有人在这两条路径上受阻（09-07 起非探针 `POST notes|comments` 0；唯一非探针讨论页访问 umsacie7 看到空态离开）。

## 5. 证据文件

- `~/r518/social_path.py`、`~/r518/{note,notestub,discuss,noqid}_{375,1440}.out`、`~/r518/dcfail_375.out`、`~/r518/dclogged_{375,1440}.out`、`~/r518/*.png`（各步截图：`note_375_2808_edit.png` / `notestub_375_2808_saved.png` / `notestub_375_2808_deleted.png` / `discuss_{375,1440}_2808_page{,_full}.png` / `discuss_375_2808_login_modal.png` / `noqid_375.png` / `dcfail_375_page.png` / `dcfail_375_retry.png` / `dclogged_{375,1440}_submit_fail.png` / `dclogged_{375,1440}_inbox.png` 等）
- `~/r518_pre.sh` / `~/r518_pre.out`（01:04Z）、`~/r518_pre2.sh` / `~/r518_pre2.out`、`~/r518_post.sh` / `~/r518_post.out`（01:20Z）
