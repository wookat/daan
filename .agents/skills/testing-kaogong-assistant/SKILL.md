---
name: testing-kaogong-assistant
description: How to run and test the 考公错题助手 (FastAPI + uni-app H5 frontend + 花生十三 knowledge base)
---

# Testing 考公错题助手

## R422b 补充（testing agent）— 长题干 SSE 免 gzip / 含图路径已可用 / explain_cache 时间窗清理
- **长题干 SSE 缓冲陷阱**：meta 事件 ≥512 B（题干 ≥~110 字，言语/资料题居多）时若边缘（Caddy `encode gzip`）对 `text/event-stream` 压缩，浏览器会在首字前 60–110 s 零信号、thinking 全部挤到末尾。生产 Caddyfile 已用 `@nosse not path */stream` + `encode @nosse gzip` 排除；复验口径：用 `/tmp/cdp174/holdsse422.py`（= holdsse421 + `rec.hdrs{ce,ct,cl,te}` 取 `Response.headers`）核 `hdrs.ce === null`（不是 `gzip`），再用 `performance.getEntriesByType('resource')` 里 `/api/explain/stream` 的 `encodedBodySize == decodedBodySize` 双证；thinking 判「逐秒」看 `thinking[0].t`（应 ≈ tMeta+2 s）、间隔 min/max、以及 `done 前 5 s 内 thinking 数 == 0`；`tFirstDelta` 应早于 `tDone` ≥ 数秒。之前只测短题干数量题会漏掉此类问题，回归至少各测一道 ≥150 字言语题（无 qid + 深链）。
- 取长题干样本：`/tiku/q/235804`（2022 国考副省级 多空综合，题干 180 字，选项 预测渗透/主导贯穿/判断投射/反映覆盖，答案 A）。避免缓存只需改一个无关字（如「战争目的」→「目标」、「基础」→「基石」），识题不受影响（module yanyu / 逻辑填空）。
- 含图路径自 2026-09-06 05:45 起生产已配 `LLM_BASE_URL/LLM_API_KEY`（复用文本网关）+ `LLM_MODEL=qwen3-vl-plus`：`r422_drop.py` 在 375 也能用（`.ds-drop` 在 375 DOM 里 0×0 但 `onDrop` 无宽度守卫；`handlePaste` 有 `innerWidth<1024` 守卫，375 下 paste 不行）。一手时延 `tMeta ≈3.2 s`（含图 think=True 也很快），meta 带识别出的 `question_text`。同图+同 `user_answer` 会命中 explain_cache，换答案即可。
- 375 ask 页手输入口：「文字输入」按钮 → 弹层 textarea；页面有 2 个 textarea，`Input.insertText` 前必须**原生点一次弹层 textarea** 取焦点（脚本里 `.focus()` 对 uni 组件无效，值会是 0）。
- explain_cache 清理口径：开测前记 `SELECT COUNT(*),MAX(created_at)`，测后列 `created_at > T0` 的行（key/question_text 前 30 字/user_answer），逐行确认全是本轮造的再按 key 删（每道手输题 `\r\n`/`\n` 两键、深链题一键，题干以「（2022国考·副省级）（单选题）」开头的是深链版，`startswith` 过滤要包含它）。总数应回到基线。
- `__hdr` 记录字段是 `{url,status,ms,xkg,cf}`（不是 `u/st`）。

## R422 补充（testing agent）— 无 qid 识题时延 / 含图路径 / practice rejection 口径
- 无 qid 文字识题（`engine.extract_question` 无图 `think=False`，rev 9e657da 起）的 UI 一手时延口径：`__sse[i].tMeta` 生产实测 **2.6–3.3 s**（旧路径 8–15 s）；判定用 `tMeta ≤ 6000` 而不是看占位文案切换的肉眼感受。占位仍先「AI 识题中…（N秒）」再「AI 正在推理…（已 N 秒）」；thinking 心跳与正文行为与 R421 相同（键恰 `{secs,chars}`，客户端间隔可低至 ~990 ms）。
- 造「未缓存新题」时改数字要保证题目仍有一致解（如盈亏问题 `(盈+亏)/差` 需整除），否则 AI 正文会正确判「题目存疑、选项无此项」——这不是缺陷，但会让「正文正常」断言变得难解释。工程问题 `a/b/c` 天改成互为倍数的数（229/458/458）最省事。
- 含图（拍照/上传）路径的环境前提：`llm._endpoint()` 对含图消息走视觉通道（`LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`），未配则 `_require_configured` 抛「AI 服务未配置」→ `/api/explain/stream` HTTP 200 但 ~180 ms 即 `event: error {"message":"AI 服务未配置"}`，UI 红条「失败：AI 服务未配置，请重试」（R422 首轮复验即此形态；同日已在生产 `.env` 补齐，见上 R422b 节）。测含图前先 `docker exec deploy-kaogong-1 env | grep -c ^LLM_MODEL=` 核视觉通道是否配置，否则记环境 FAIL 而不是代码缺陷。
- 含图路径的 UI 触发：`uni.chooseImage` 动态创建 `<input type=file>`，CDP `Page.setInterceptFileChooserDialog` + 合成点击 `.ds-drop` **拦不到**（无 `fileChooserOpened`）。可行方案是 `/tmp/cdp174/r422_drop.py <png>`：页内用 base64 构造 `File` → `DataTransfer` → 在 `.ds-drop` 派发 `DragEvent("drop")`（ask.vue H5 分支原生监听 `document drop`），会弹「确认题目图片」预览层，之后原生点答案 + 「用花生十三方法讲解」即可；`__sse` 记录的 `fd` 键为 `image,user_answer`。
- practice 页 `unhandledrejection` 口径：rev 9e657da 起 `uni.vibrateShort({..., fail(){}})`，桌面 Chrome 答对/答错后 `__pexc` 应恒为 `[]`（R421/R421b 每次判题 +1 条 `vibrateShort:fail`）。判题即时核：每次点选项后立刻 `eval window.__pexc`，正确答案会**自动切下一题**（无「下一题」停留帧），截图要在点选前后各一张。多选题（如常识 273031）从 SEO `/tiku/q/<id>` 点任一选项进 practice 后带 `pick=X` 预选一项，页面出现 `.multi-bar`「多选题：选完所有正确项后确认」+「确认答案（n）」，再点其他选项累加后点「确认答案」→ `answer_log.user_answer` 为拼接串（如 `ACD`）。
- 1440 下 ask 页有「新对话」按钮（页面滚动后需先滚回顶部再点），`window.__sse` 在 SPA 内不重置、进 SEO 页（新 document）才重置——按段落记录时先记下 `__sse.length`。
- teardown：`Emulation.clearDeviceMetricsOverride` 由另一条 CDP 连接调用时页面 `innerWidth` 可能不立刻变化，需 `Page.reload` 一次再核 1600×1017。杀 holder 只用 PID 文件；`for p in $(pgrep -f "holdvw")` 会连当前 shell 一起杀（exit -1）。
- 清理脚本模板 `/tmp/r422_db2.py`（按 `PRAGMA table_info` 找全部含 `uid` 列的 34 张表，count/delete 两模式，参数化 LIKE）；`answer_log` 无 `is_correct` 列，直接 `SELECT *`（第 7 列为对错、末列 probe）。

## R421b 补充（testing agent）— ask 页「存入错题本」带 question_id 的复验口径
- 自 rev adfdc17 起 `ask.vue save(r)` POST `/api/mistakes` 带 `question_id: askQid(r.qid)||null`；后端 `db.save_mistake`（db.py ~L3189）先按 `(question_id, uid)` 再按 `(question_text, uid)` **去重合并**（`times+1`、`next_review` 更新、`question_id=COALESCE`）。因此「练习答错自动存 → ask 再存同题」只会得到 **1 行**（`times 2`），不再是 R421 的两张卡；核 ask 存入是否带 qid 时要看 `times`/`next_review` 变化，而不是找第二行。练习行 `question_text` 无 `\r`、ask 行文本是 meta 的 `\r\n` 版，文本去重不会命中，所以合并本身就证明 ask POST 带了 qid。
- 想要**纯 ask 存入的独立行**（无练习行可合并）：搜索页 `#/pkgA/search/search?q=<qid>` 点结果卡展开 → 「AI 详解本题」（`search.vue askFromSearch` 写 redoQuestion/redoQid、清 redoAnswer）→ ask 页选一个 R421 已缓存的答案（如 709452+B）秒回 → 「存入错题本」→ DB 新行 `question_id` 应等于 qid、`explanation` 以「【答案】」开头（AI 来源）。
- 抓 `/api/mistakes` 请求体：uni.request 走 XHR，可在页内一次性包 `XMLHttpRequest.prototype.open/send` 把 `/api/mistakes` POST 的 body `JSON.parse` 进 `window.__mb`（页级钩子，SEO 全页跳转会丢，需在同一 document 内完成 ask→存入）。
- 错题卡再问入口是展开卡片后的「AI 详解」（`book.vue redo(m)`，`m.question_id` 非空才写 redoQid）；再问成功口径：`__sse` 最新记录 `fd.question_id` = qid、`meta.cached true`、thinking 0、最后 4 个 `.chip` 含「查看原题」→ 点后 `#/pkgA/search/search?q=<qid>&qid=<qid>`。
- SSH 变量在 shell 环境里（`TICKETS_VPS_SSH_*`），不要用 exec `env: secret:org:…`（该引用不存在会被拒）；`cat <<EOF` heredoc 与被拒的同一条命令会一起作废，脚本用 write 工具落盘后 scp。恢复 LS 时不要在 `cdp.py eval` 里内联 `$(python3 …)`（引号嵌套会让 JSON.parse 失败并已清空 LS），改用 `r421b_restore_ls.py` 这类读文件的 CDP 脚本。

## R421 补充（testing agent）— ask 页 AI 讲解 SSE（question_id 直通 / thinking 心跳 / 缓存）取证
- `/api/explain/stream` 是 fetch + FormData（`api.js streamExplain`），uni.request 钩子抓不到；用 `/tmp/cdp174/holdsse421.py`（长连接，`Page.addScriptToEvaluateOnNewDocument` 包 `window.fetch`，**克隆** response 流读 SSE，不替换应用消费的原流）在 `window.__sse[]` 记 `fd`（FormData 字段）、`st`、`tMeta`/`thinking[{t,d}]`/`tFirstDelta`/`tDone`（相对 fetch 发出的 ms）、`full`。注意 SPA 内 hash 路由不重置 `__sse`，但从 SEO 页（`/tiku/q/<id>` 服务端页）点选项进 `/#/pages/practice` 是新 document → `__sse` 重新从 index 0 开始，轮询前先 `window.__sse.length` 确认下标。
- 深链入口（凡 `setStorageSync('redoQid')` 再 switchTab ask）：SEO `/tiku/q/<id>` 原生点选项 → practice `?qid=…&pick=X` 判题 → 「用花生十三方法详解这道题 ›」（可 `scrollIntoView` 后原生点）→ ask 页 toast「题目已填入…」+ textarea 预填 + 答案预选。ask `onShow` 会立刻消费并删掉 `redoQuestion/redoQid/redoAnswer`，事后 LS 里查不到是正常的，以 FormData `question_id` 为准。
- 通过口径：linked 题 `tMeta` ≈150–200 ms、`meta.qid`=题 id、`module/question_type` 与 `questions` 表一致、`cached:false`；无 qid 手输题 `tMeta` ≈8–15 s（识题 LLM，前 meta 占位是「AI 识题中…（N秒）」）、`meta.qid null`。thinking 事件 data 键**恰为** `{secs,chars}`，服务端 ≥1 s 节流（客户端到达间隔有抖动，见过 722 ms，不算失败）；`.spin` 文案「生成中…」→「AI 正在推理…（已 N 秒）」→ N≥30「AI 推理接近完成，讲解正文马上出现…（已 N 秒）」，用 `r421poll.py <out> <idx> <maxs>` 每 1.2 s 采样取证（正文常 30–80 s 才到）。正文检查不含「思考过程/推理过程/<think/reasoning」。
- 缓存键 `deps.cache_key(text.strip()+"\n||\n"+ua)` 是**逐字**的：后端把 meta.question_text 归一成 `\r\n` 版并同时存 `key`（归一文本）与 `raw_key`（原 FormData 文本）两个键；textarea 会把 `\r\n` 转成 `\n`，所以从错题本再问通常命中 raw_key。选未缓存题先在容器 DB 用 prefill 文本（`askPrefill(stem, options)` = 题干+`\n`+`A.x B.y …`）+ ua∈{'',A,B,C,D} 算 sha256 查 `explain_cache`。缓存命中：`meta.cached:true`、meta 无 qid、`thinking.length 0`、`tFirstDelta==tDone≈tMeta`。
- **已知缺陷（R421 时）**：ask `save(r)` POST `/api/mistakes` 不带 `question_id` → 该错题行 `question_id NULL` → 错题本「AI 详解」(`book.vue redo(m)`) 不写 redoQid → 再问时 FormData 无 question_id、卡片无「查看原题」。练习页答错自动存入的行带 question_id，走它才能验「缓存命中 + 查看原题回填」。错题本卡片的再问按钮文案是「AI 详解」（`.op.redo`），不是「再问 AI」；「更多操作」sheet 里没有它。
- 回归耗时：`/api/followup` ≈35 s、`/api/similar` ≈55 s（推理模型），等待要给足；「历史」sheet 在当前会话未归档时是空态，先点「新对话」再开「历史」才列出会话。
- xdotool `type` 无法输入 CJK（只剩数字/字母）：先点聚焦 textarea，再 `cdp.C(pick()).call('Input.insertText', text=…)`（等价 IME/粘贴输入，会触发 input 事件）。
- 桌面 H5 practice 页答题会抛 `unhandledrejection {"errMsg":"vibrateShort:fail"}`（`practice.vue` `uni.vibrateShort` 无 fail 回调），每答一题一次，属既有噪音，报告里单列勿混入 R4xx 回归。
- 清理：`test-r421-%` 会落在 mistakes（练习自动存 + ask 存入）、answer_log、ask_sessions、ask_cur、growth_events、practice_progress，按「所有含 uid 列的表」循环 DELETE 再 LEFTOVER；`explain_cache` 是全局资源不按 uid 删，只记录新增键。

## R420 补充（testing agent）— 时区仿真 / contest 字号·热区 / contest-report 空态
- 时区仿真用 CDP `Emulation.setTimezoneOverride`，但它是**按 CDP session** 的：一次性 `cdp.C(...).call(...)` 在 socket 关闭后立刻回落到系统 TZ（本机 UTC）。要像 `holdvw.py` 一样长连接持有：`/tmp/cdp174/holdtz.py <TZ>`（`setsid nohup … &`，记 PID）。切 TZ 后必须 F5，并用 `Intl.DateTimeFormat().resolvedOptions().timeZone` + `new Date(1789174800000).getHours()`（Asia/Shanghai 9 / UTC 1 / America/Los_Angeles 18）证明设备时区真变了，再量 UI 文本。恢复：kill holder 再 `setTimezoneOverride timezoneId=''`。
- R420 起 `contest-time.js`（`cstParts/fmtWindow/fmtDay/fmtDayHour`）固定东八区：contest `.hero-meta .hm[0]`「9月12日 09:00 - 24:00」、往期 `.prow-s` 用 `fmtDay(close_at-1)`（2026-09-05/08-15/08-08），三种 TZ 下必须完全一致。周报「下一场」`.link` 只在 report 非 empty/pending 态渲染（`/api/report/weekly?uid=` 对测试 uid 是 `status: empty` → 该链接测不到，只能标 untested）；可用页内 `import('/assets/contest-time.<hash>.js')` 直接调 helper 取证（minified 导出名 a/b/f，按参数个数判断）。
- 新 chunk 取证：F5 后 `performance.getEntriesByType('resource')` 里应有 `index-<hash>.js` + `pkgA-exam-contest.<hash>.js` + `contest-time.<hash>.js` + `contest-<hash>.css`。
- 字号扫描：遍历有文本子节点且 rect 非 0 的元素，`parseFloat(getComputedStyle(e).fontSize)<12` 列表应为空（375 下 24rpx=12px，1440 下 uni 把 rpx 按 375 基准上限也是 12px）。抽样 `.hero-series/.hero-phase/.hm/.prow-s/.prow-none/.rules-arrow` 12px，`.prow-t` 13px，`.sheet-x` 15px。
- 榜单弹层：原生点往期行「未参加 · 看榜单 ›」→ `.mask .sheet`，`.sheet-t`「… · 榜单」；`.sheet-x` rect 40×40、`elementFromPoint(cx,cy)` 命中自身。375 `.sheet.bottom === innerHeight`（贴底）。**1440 的 `.mask` 不是全视口**：App.vue `@media (min-width:1366px)` 把 `uni-page-body .mask` 设为 `left: calc((100vw-1280px)/2+208px)`/`right: calc((100vw-1280px)/2)`（跟随壳体+左侧 208px 导航），1440 下 mask 为 288..1345，「居中」要以 mask 中心（816.5）而不是视口中心（712.5）判定，这是既定设计不是 bug。
- contest-report：`#/pkgA/exam/contest-report?event_id=6` 非参赛者 → `GET /api/mock/events/6/report?uid=` **404**（预期 non-2xx，勿计为回归）→ `.card.empty .empty-t`「暂无大赛报告」`.empty-s`「尚无比赛成绩」`.pbtn.main`「去模考大赛」→ 回 contest；不带 event_id → 0 次 API、`.empty-s`「链接缺少赛事参数，请从模考大赛页进入」。报告正文需真实交卷，upcoming 场次进不去，不要造数据。
- Chrome omnibox 会把 `…/contest-report` 内联补全成上次访问的 `…?event_id=6`：输入后先按 `Delete` 再 `Return`。
- 清理边界同 R419：只 `DELETE FROM mock_event_entries WHERE uid LIKE 'test-r420-%'`，其他表 `test-r420-%` 应为 0 行；`SELECT COUNT(*) FROM mock_events` 仍 4。
- 恢复 LS 后页面一次加载会新增 `apiSnap:/api/mock/events?uid=<anonUid>` 缓存键（30→31），属正常页面缓存，不是泄漏。

## R419 补充（testing agent）— 模考大赛（contest）页 / mock_events 去重取证
- 入口：首页「更多练习」`.more-c`「模考大赛」（home.vue L297 `goContest`）→ `#/pkgA/exam/contest`；卷库 list 页无入口，周报页也有入口。
- 选择器：hero `.card.hero` → `.hero-title`（场次标题）/`.hero-phase`（未开始/进行中）/`.hero-paper`（卷名·题数·分钟）/`.hero-meta .hm`（窗口、「N 人报名 · M 人交卷」或「本场首批报名开放中」）；upcoming 时 `.cta`「预约报名」→ 点后 `.cta.done`「已报名，开赛后可进入」+ toast「报名成功，周六见！」；往期 `.prow-t`/`.prow-s`（非参赛显示「未参加 · 看榜单 ›」）。1440 为双栏 `.ct-cols`。
- 每次 `GET /api/mock/events` 都会跑 `ensure_weekly_event()`（mock_event.py），去重回归口径：多次打开/F5 后容器 DB `SELECT id,title FROM mock_events ORDER BY open_at` 行数不变，且 `title LIKE '%第N+1期%'` 为 0；唯一索引 `idx_mock_events_window(series,open_at,close_at)` 可用 `sqlite_master` 核。
- 报名只写 `mock_event_entries(event_id,uid,registered_at,attempt_id,score,rank,nickname)`；清理 `DELETE FROM mock_event_entries WHERE uid LIKE 'test-r419-%'`，勿动 `u15` 行。upcoming 场次没有「进入考试」按钮，不会产生 exam_attempts。
- contest 页请求走 uni.request（XHR），`__exb`（fetch 钩子）抓不到，用 `__hdr`（响应钩子）核状态码，用页内 `fetch('/api/mock/events?uid=…')` 核 `next.my_state`。
- 陷阱：`fmtWindow` 按浏览器本地时区格式化，测试浏览器 TZ=UTC 会显示「9月12日 01:00 - 16:00」（真实东八区 09:00–24:00），不是数据错误；核开赛日期用 DB `open_at` 换算。
- 停 holder 时勿 `pkill -f "holdvw.py …"`（会连当前 shell 一起杀，exit -1）；用记录的 PID `kill`。

## R418 补充（testing agent）— 探针场次打标 / 真人聚合 / 排行榜取证
- `exam_attempts.probe` 在 `POST /api/exam/start` 由 `auth.probe_request` 写入（X-Kg-Probe:1 / `KG_PROBE_CIDRS` 网段 / UA 标记三路任一）。生产容器 `docker exec deploy-kaogong-1 printenv KG_PROBE_CIDRS` 可查网段；本机出口 `curl api.ipify.org` 命中网段则 GUI 会话天然 probe=1，**不要**用别的手段伪造 probe=0。跨用户聚合（`/api/exam/papers` takers/avg、SEO「已有 N 人模考」、`/api/exam/rank`、比赛分数池）用 `db.REAL_TRAFFIC = COALESCE(probe,0)=0`；排行榜 pool 是 `REAL_TRAFFIC OR uid=本人`，探针看自己报告 total≥1、board 有 me:true。
- 取证选卷：挑一张真人 takers=0 的卷（DB `SELECT COUNT(*),SUM(probe=1) FROM exam_attempts WHERE paper_id=? AND submitted_at IS NOT NULL`）——卷卡 `.pmeta` 在 takers 为 0 时不渲染「人考过」，SEO 页也无「人模考」，探针交卷后若变「1 人考过」立刻可见。卷库卡上「我的最好成绩 X 分 · 已考 N 次」「已练 n/62 题」是本人视角，不是聚合，勿混淆。
- `/api/exam/papers` takers 有 300 s SWR 内存缓存：交卷后等 ≥305 s 再连续 curl 两次，以第二次为准；用 `-H "X-Kg-Probe: 1"` 的 curl 只读不落库。
- 报告页排行榜卡选择器：`.r-title`「全卷排名」、`.r-tag`「样本 N 人」、`.r-beat-tiny`（total<10 时代替击败比例）、`.r-kv-i`「排名 r/total」「平均分」；「同卷排行榜」列表 `.r-brow` 在 `exam-board.js` `rows.length<2` 时整块不渲染（total=1 不显示是既定逻辑，不是 bug）。GET 响应体 `__exb.res` 为 undefined，取 JSON 用页内 `fetch('/api/exam/rank/<id>?uid=…')`。
- 容器内直接 `docker exec deploy-kaogong-1 python3 -c "from app import insights; insights.api_exam_rank(<attempt_id>, uid='<uid>')"`（工作目录已是 `/app/backend`，勿加 `-w /app`）。
- `cdp.C` 需要 target：`cdp.C(cdp.pick())`；大 LS 恢复走它的 `.eval` 避免 `Argument list too long`。`r391usr.py read <out.json>` 必须带输出路径。
- 基线漂移排查：`SELECT * FROM growth_events ORDER BY rowid DESC LIMIT 3` 看最新行的 uid/probe/created_at，能区分「本轮前其他探针会话产生」与「本轮泄漏」。

## R417 补充（testing agent）— 多选 picked 落库 / 历次作答 / 换 uid 的 LS 陷阱
- R417 起 `save_answer_log_detail` 用 `normalize_answer(picked)[:8]`（旧 `str(picked)[:2]`：多选 ABD 会落 AB）。核对口径：`SELECT question_id,picked,correct FROM answer_log WHERE uid=?` + `mistakes.user_answer` + 报告页「你选了 ABD」+ 错题本卡片展开后 `.attempts .att-pick`「选 ABD」（`toggleCard` 打开时才 GET `/api/attempts?uid&question_id`）。**不要伪造 probe=0** 去刷 most_wrong/易错项：测试 uid 的 answer_log 全为 probe=1，后台聚合不会计入，只核行与 UI。
- 练习页多选：`.multi-bar .multi-ok`「确认答案（n）」→ `POST /api/answer_log {uid,items:[{qid,correct,picked}]}`，source 取深链 `source=seo_q`。SEO `/tiku/q/<id>` 的 CTA「在线做这道题 + 同考点练习（免费）→」是普通 `<a href="…#/pages/practice/practice?qid=…&source=seo_q">`，原生点即落 practice、该题领跑。
- 请求体抓取：`holdbody414.py` 的 `window.__exb` 条目字段是 `{u, req, st, res}`（不是 url/body），`__hdr` 只有 `{url,status,ms}` 无 body。过滤要用 `x.u`。
- exam 页顶部「<」是 uni H5 navbar back：从卷库 list 原生点「开始模考」进入才有历史栈，点「<」回卷库会触发 `onUnload` flush 且**不重建 document**（`__hdr/__exb` 保留，可直接读 POST 数）；深链直达时无栈会走 `navigateBack fail → reLaunch list` 兜底。容器日志里 progress 请求 uid 在 body 不在 URL，只能按时间窗 `docker logs --since <ISO>` grep `exam/progress` 计数。
- 换 uid 陷阱：LS `examProgress`（模考快照）与 `pendingSession`（练习续做卡 `.ercard`「有一组未做完的练习」）都**不是 uid 作用域**。① 在 exam 页上换 uid 后再导航，`onUnload` 会把旧场快照写回 LS，导致新 uid 首次进 116 误弹「继续上次模考？」——先离开 exam 页（去首页/卷库）再 `removeItem('examProgress')` 再进；② 首页 `.ercard` 计数 1 可能是练习卡而非模考卡，要看 innerText 是否含「未交卷/模考」。
- 「恢复后仅新增标记」：答题卡跳题（idx 变）本身就会推一条 progress（marks []），标记后再推一条；判「标记触发同步」看最后一条 payload `marks:[qid]` 且 picks 不变。
- 清理时 `practice_progress` 也有 uid 行（练习页产生），审计脚本要包含。

## R416 补充（testing agent）— 只标记（旗标）不上送进度
- R416 起 `shouldPushProgress(picks, pushedBefore)` 不看 marks：进 exam 页只点「标记」（`.tbtn`→「已标记」）不答 → `POST /api/exam/progress` **0 条**、`exam_progress` 0 行；F5 不弹续考、直接新 attempt 并回收旧空场次（与 R415 不答一样）。一旦本场有过 POST（有作答），此后标记/取消都随 payload `marks:[qid,…]` 同步，清空作答后也会同步 `picks {}`。验证顺序建议：只标记 → 等 ≥5s 看 `__exb` → DB → F5；再 答 BD → 标另一题 → F5「已答 1/62」→ 继续 → 上一题看 `.opt.sel` + `.tbtn.on`。
- 「只标记就刷新 → 标记丢」在 R416 下依旧（本就不落库），是既定口径，不算 FAIL。
- 卷库 list 页 reload 会触发 `/api/exam/start`？不会，但 attempt 号可能跳号（本轮 288→290）——都是被回收的空场次，判「只剩 1 条」看 DB 不看编号连续。
- 诊断钩子：`holdhook.py` 常驻时每个新 document 自动重装 `__exb/__hdr/__cerr/__pexc`，仍需 **每段 reload 前** `r391usr.py read <file>` dump 一次才保留该段。
- 切视口时不要 `pkill -f "holdvw.py 375 812"`——会匹配到自己所在的 bash 命令行把整条命令杀掉；按 PID 文件 kill 或分两条命令跑。恢复 LS 大对象用 `cdp.C(pick()).eval(js)` 直接走 websocket，`python3 cdp.py eval "<50KB js>"` 会 `Argument list too long`。

## R415 补充（testing agent）— 模考「空场次」语义
- R415 起：进 `exam?paper_id=N` 不作答/不标记 → **不会** `POST /api/exam/progress`（首次防抖与 onHide/onUnload flush 都被 `shouldPushProgress` 拦），F5 也不弹「继续上次模考？」而是直接新 attempt；下一次 `/api/exam/start` 会删本人同卷「无 progress 行 / picks '' 或 '{}'」的旧 attempt（连 progress 行）以及 >24h 未交卷的。验证套路：LS `examProgress.data.attemptId` 前后对比 + 容器 DB `exam_attempts/exam_progress where uid=?`。
- 一旦本场推送过（或从快照恢复），之后清空作答也会同步 `picks {}`；再 F5 → 0 已答不弹 → 新场回收旧 `{}` 行。只标记不答会落 `{picks:{},marks:[...]}`，但 F5 后同样按空场次回收 → **标记丢失**（设计如此，记录即可）。
- 首页 `.ercard` / 卷库 `.card.resume` 由 `parseExamProgress` 过滤 answered 0；`/api/exam/resume` 仍会回 picks `{}` 的历史快照，不要以接口有返回判「有卡」。
- paper 116 运行时可能只有 62 题、273036 在 slot 23（不是 R414 记的 24）——每次以 LS `examProgress.data.items.findIndex(q=>q.id===273036)` 现场取 slot。
- `window.__hdr/__cerr/__pexc` 随 document 重建，**每次 F5/location.href 前先 `r391usr.py read <file>` dump**，否则该段诊断丢失（R415 375 前几段就漏了，只剩 `__exb`）。
- 用 `hold_restart.sh`/holdvw 切过 1440 后，`Emulation.clearDeviceMetricsOverride` 单独调用可能不生效（innerWidth 仍 1440）；先 `setDeviceMetricsOverride 1600x1017 mobile=false` 再 clear 再 `Page.navigate`（见 `/tmp/cdp174/r410_teardown.py`）。
- 容器日志 `POST /api/auth/wxlogin 503` 是 `auth.py` 未配 `WX_MINIAPP_SECRET` 的设计返回，外部小程序客户端会触发，不算本轮 5xx 回归。并发子会话（`test-w*-` uid）会让 growth_events 等基线漂移，只清自己前缀。

## R414 补充（testing agent）— 模考多选 / book·favorites 24rpx
- 模考含多选卷现已存在：paper **116**「2015年北京公务员考试《行测》」69 题，多选在 slot 19–24（273027 ABCD / 273028 ACD / 273030 BCD / 273031 ACD / 273032 BCD / 273036 BD）；paper 29 含 264342（ABC）、paper 31 含 275876（ACD）。进入 `#/pkgA/exam/exam?paper_id=116` 后必须 reload 才走 onLoad。
- **先进 exam 页再 F5 会弹「继续上次模考？（已答 0/62 题）」**：首次进页已 `exam/start` 并写 LS `examProgress`，F5 后按 0 进度也提示恢复（会多留一条空 `exam_attempts` + `exam_progress` 行，清理时计入）。想干净测 resume 就先答题再 F5；测「重新开始」时留意这条空 attempt。
- 模考多选选择器：题干下 `.multi-tip`（12px，文案「多选题：可选多项，已选 X，选完点「下一题」」）、选项 `.opt.sel`（多字母包含）、长按排除 `.opt.excl`（opacity .45）。单选点选后 ≈180ms `next()`，量「不跳题」要等 ≥500ms 再看 `n/62`。答题卡侧栏（1440 常显）/ 弹层（375）底部「已答 n/62」= `items.filter(q=>q._picked).length`，多选算 1。
- 进度对账最稳的是页内 body 钩子：`POST /api/exam/progress` 的 `picks` 是 `{qid: 'BD'}`（按 qid），`submit` 的 `answers` 是 `{slot: 'BD'}`（按 1 起 slot）；容器 `exam_progress.picks`/`exam_attempts.answers` 同样两套键。键盘 A–D 只在 `innerWidth>=1024 && !cardOpen` 生效，按同一字母第二次只去掉该字母（B→D→B 得 D）。
- 长按排除（`@longpress`）用 CDP `Input.dispatchTouchEvent` touchStart 后 sleep ≥600ms 再 touchEnd；只发 touchEnd 或短按不会触发。在按住期间读 `_excl/_picked` 最可靠。
- 报告页详情 `.dopt.right`=正确项、`.dopt.wrong`=错选项，`.dans`「正确答案 X，你选了 Y」；多选漏选时正确项全部 right、无 wrong；DB `mistakes (user_answer,correct_answer)` 存多字母如 `('AC','ACD')`，`answer_log.picked` 同。
- 找 Vue 实例：`el.__vueParentComponent` 沿 `parent` 找到含 `items`+`pick` 的 ctx；reload 后 `window.__exvm` 句柄失效要重找。钩子截断 response body 6000 字符，长 `exam/start` 响应别直接 `JSON.parse`。
- book 页 375 `.trendcard/.trend-*/.kbd` 是 `display:none`（桌面媒体查询才显示），量它们必须 1440；`.trend-kn` 只在 4 周内有 `mastered_at` 时渲染；`.sort-chip` 仅 CSS 定义、模板未使用（量不到属正常）。`.recap-name` 80px nowrap ellipsis、`.recap-n` 20px 用 `scrollWidth<=clientWidth` 判无溢出。
- 1440 下 book 想有数据可直接把 LS `anonUid` 切回 375 测试 uid（同前缀），不必再造数；`test-r414-%` 清理表：answer_log/exam_attempts/exam_progress/growth_events/mistakes/practice_progress/question_favs/review_log/user_profile（40 张含 uid 表自动枚举）。

## R413 补充（testing agent）— 多选题 / 复习吸底 / 收藏标绿
- 练习页默认「自动下一题」开启（LS `autoNextOff` 未设）：多选题点「确认答案」判分后会立刻切到下一题，看不到 ✓/✗ 标记。测标记前先经顶栏 ··· 菜单原生关掉「自动下一题」（写 `autoNextOff=1`），再深链重进。
- 深链 `#/pages/practice/practice?qid=N&module=changshi` 只在 `onLoad` 读 query，同页改 hash 不重进，需 `location.href=…; location.reload()`。每次 reload 清页内 HDR 钩子，换题前先 dump。
- 活跃多选 qid（answer 多字母）：264342 ABC（题干带「(多选题)」）、273027 ABCD、273028 ACD、273030 BCD、273031 ACD、273032 BCD、273036 BD、275876 ACD。多选 UI 选择器：`.multi-bar/.multi-hint/.multi-ok(.dis)`；选项态 `.opt.sel|right|wrong|dim`，标记 `.omark.good/.badm`；DB `mistakes.user_answer` 存拼接字母（如 `AC`），`answer_log.picked` 同。
- 考试/模考含多选卷：`/api/exam/papers` 里没有「2015 北京市考行测真题」卷（北京卷只有 2018–2023，且不含上述多选 qid），exam 模式多选目前只能标未测。
- 复习页 `.next-btn`（wd-button custom-class）：375 下 `position:sticky; bottom:58px`，长讲解时 scrollY 0 rect bottom 应 754（TabBar top 762）；讲解短时自然位就在视口内 sticky 不介入，要挑 docH>812 的题（243872 讲解长 docH≈1157；273028 ≈849；264342 ≈829）。1440 桌面无底 TabBar，按钮自然位即可。
- 收藏三处标绿选择器：错题本收藏 tab 展开 `.anscmp .ca`；收藏页 `.qitem` → `.opt.ans`；搜索 `?q=关键词` 自动搜 → 点卡 → `.q-opt.ans`。搜索页 `?q=` 同样只在 onLoad 生效，换词用搜索框原生输入。收藏 = 练习页顶栏 ⭐ → `POST /api/favs` + LS `favQuestions`，清理表含 `question_favs.uid`、`user_profile.uid`。
- 预存 P2（非 R413）：错题本收藏卡 `.anscmp` 23rpx=11.5px、卡内 tag 10–11px；收藏页 tag 10px。收藏/搜索页 innerText 里的「回答错误，正确答案 X」是 body 下 1×1 离屏 aria-live 播报 div，不是可见 UI。

## R412b 补充（testing agent）
- uni-app `<text>` 渲染为 `<uni-text class="x"><span>…</span></uni-text>`：对 `.edit`/`.nop`/`.qsb-link` 做中心 `elementFromPoint` 时命中的通常是内层 `span`（className 为空），判命中要用 `el.contains(hit)` 或 `hit.closest('.x')`，不要直接比 className。
- `.edit` 用 `min-height:40px + margin:-10px 0` 后 rect 会外溢 `.mynote` 上下各 ~3px，与相邻元素判相交要拿 `.edit` 自身 rect 比 `.report-link` bottom / `.qsb-row` top，而非只比 `.mynote`。
- teardown 清 375 仿真：holder 进程杀掉后新 CDP 会话直接 `Emulation.clearDeviceMetricsOverride` 可能不生效（innerWidth 仍 375），需在同一会话先 `setDeviceMetricsOverride(1600×1017, mobile=false)` 再 `clear` 再 `Page.navigate`（见 `/tmp/cdp174/r410_teardown.py`）。LS 恢复脚本 `/tmp/r4xx_ls_restore.js` 可能被清，最稳从最近的 `/tmp/r4xx_ls_backup.json`（可能双重 JSON 编码）重新生成。

## R412 社交栏（q-social-bar）热区/字号复验新经验（testing agent）
- 组件挂载点：practice.vue 答题后解析区（`.qsb` 前一兄弟是 `.report-link` 纠错，「下一题」在 fixed `.banner > .bnext`）、book.vue 错题卡「点开看答案与详解」展开处、复习卡。几何用 `getBoundingClientRect` 量 `.qsb-link/.nop/.edit`，注意 `.edit`「改」是 inline-block + padding 8px，实测高 = 8+line-height(19.2)+8 ≈ 35px，不到 40；整个 `.mynote` 块也绑定 `startEdit`。
- 「分享给队友」不是弹层：`POST /api/share/create` + 剪贴板 + toast「分享链接已复制，发给队友吧」约 2s 自动消失；会写 `shared_questions.from_uid` 一行，清理要包含该表（审计脚本的 uid 列枚举已覆盖）。「讨论」是 `navigateTo /pkgA/social/discuss?qid=`，页内 ‹ 返回练习页状态保留。
- 「🔥 热评」条需 `question_comments.status='ok'` 的题；生产目前全部 deleted（`/api/comments/count` 均 0），且规则不允许写讨论 → 只能标未测。`.firstc`「抢首评」在 `count===0` 时必现，可作字号抽查。
- xdotool `type` 会丢中文：textarea 需要中文时先原生输入 ASCII 部分，再用 CDP `setRangeText + dispatchEvent('input')` 补中文，保存仍走原生点击。
- 深链换 uid 时 `localStorage.setItem + location.href + reload` 会重置页面 HDR 钩子，每段先 dump；大 localStorage 恢复要用 `cdp.py evalfile <js>`（命令行参数会 Argument list too long）。

## R411 字号/空态 CSS 轮新经验（testing agent）

- **「全页 <12px 0 处」断言要分两层报**：先按改动 diff 里的选择器逐个量（`.hm-yl/.hm-note/.hm-lt/.tpct/.km-cov-in/.km-lg`…），再做 TreeWalker 全页叶子文本扫。stats 页有些卡片只在数据够多时才渲染（`predict-card` 需 ≥30 题作答、`.km-cov-in` 冷启动是 `--`），初始少量数据扫出 0 处不代表全页达标——先造够作答（同 uid 深链多练几轮）再扫一次。范围外组件（`components/predict-card`、uni tabbar 标签 10px）单列，不混进「本轮改动」判定。
- **热力图对齐口径**：`.hm-yl` 7 个标签 top 与首列 `.hm-col > .hm-c` 7 个 top 逐行比 |Δ|；`.km-cov-in` 用 `Range.selectNodeContents` 取文本 rect，与圆 rect 比包含。
- **1440 `scrollWidth != innerWidth` 不一定是横溢**：非 mobile 仿真有 15px 纵向滚动条，`documentElement.clientWidth` 也是 1425；判横溢用 `scrollWidth > clientWidth`。
- **待掌握清零专属空态**（`tab==='todo' && !kw && !hasFilter && items.length>0`）：批量标掌握后即使还在批量态也已显示；验通用文案回退 375 可用筛选 chip（不用打字），1440 用 CDP `Input.insertText` 搜索。恢复 1 条后「今日待复习」横幅会重新出现把 tab 行下推，再点 tab 前重新截图定位，否则会误触横幅进入复习模式（用「退出复习」退出即可，不写库）。
- **SEO 页展开解析**：`<summary>` 「先想一想，再看答案与解析」的 DOM rect 与屏幕坐标在 375 仿真下不一一对应，按截图里的实际位置点；误点到「同考点相似题」链接会跳到别的题，用 `alt+Left` 返回重做。
- **pkill 陷阱**：`pkill -f holdhook.py` 会匹配到当前正在执行该命令的 bash 自身（命令行含该字串）导致 exec 提前退出（exit -1），改用 PID 文件 `kill $(cat *.pid)`。
- 测试 uid 有 40 张含 uid 列的表（含 `review_cur.uid`）；本轮 3 错题 + 复习 + 续练 + 1440 6 错题共产 65 行，全部由 `test-r411-%` 模式覆盖。

## R410b 修复复量轮（同一审计口径复跑）新经验（testing agent）

- **bundle 变更后必须真实 F5**：只做 hash 导航（`location.href='#/pages/...'`）会沿用内存里的旧 chunk/CSS（本轮空态按钮先读到旧 36px，F5 后才是新 44px）。复量前用 `performance.getEntriesByType('resource')` 核实际加载的 `pages-book-book.*.js` / `book-*.css` 文件名与用户给的一致，再量几何。
- **页内 sheet 取代 uni.showActionSheet 后的量法**：`.mask > .sheet.more-sheet`，行 `.more-act`（`.danger` 删除 / `.cancel` 取消），`.mask.bottom` 375=762、1440=900；`.uni-actionsheet` 计数应为 0。桌面 Esc 关闭要用真实 `xdotool key Escape`，再查 `.more-sheet` 数量。1440 下 modal 关闭后 `.uni-modal` 元素仍在 DOM（父级 `display:none`），判关闭要看父级 display 而不是元素存在。
- **错因自评持久化证明**：sheet 内 `.more-reasons .rz` 点选 → HDR 钩子只记 `url/status`（`method` 可能为空），用 `/mistakes\/\d+/` 匹配 PATCH；持久化用 F5 后页面自身 GET 或 `curl -H 'X-Kg-Probe: 1' /api/mistakes?uid=`，再点同 chip 期望 `error_reason` 变 `''`（DB 里是空串不是 NULL）。
- **`rvstate.js` 的 `tgt` 是正确答案**（用于自动推进答对），要「答错」需自己取 `.opt` 中 `innerText != ans` 的元素点。复习循环脚本用 Vue 状态 + 实时 rect，不用固定坐标。
- **1440 视口在 1024 宽屏幕上的真实点击**：页面坐标 → 屏幕坐标约 `x*0.711`，`y*0.711+88`；只对大按钮用 GUI 点击，小控件用 CDP `Input.dispatchMouseEvent` 页面坐标。
- **SEO 缓存头**：`curl -I`（HEAD）拿不到 `x-edge-cache`/`age`，要 `curl -s -o /dev/null -D - <url>` GET。
- **localStorage 备份陷阱**：`cdp.eval('JSON.stringify(localStorage)')` 落盘的文件是**双重 JSON 编码**（`json.load` 得到 str），恢复前 `if isinstance(d,str): d=json.loads(d)`，否则会按字符写入十万个键；恢复用逐键 `setItem`（大对象内嵌到 eval 表达式易静默失败），最后核 `localStorage.length==30` 与 `anonUid`。
- 批量清空「待掌握」后的空态仍是通用「没有匹配的错题」（本轮只改了已掌握 tab 文案），复量时勿误判为回归。

## R410 错题本次级屏 375/1440 可用性审计（只审不改）新经验（testing agent）

- **审计轮只量不改**：缺陷理由一律用页面数据（`getBoundingClientRect` + `elementFromPoint` + `scrollWidth` + `getComputedStyle().fontSize`），不要用「竞品有 X」。阈值口径：375 热区 <40px 记 P2、<32px 记 P1、字号 <12px 记 P2；每条缺陷附 rect 数字 + 复现步骤。
- **FAB 与列表末卡**：375 下滚到底时 `.fab-main`（≈307–359 / 694–746）会盖住末卡 `.op.more`「···」（≈306–350 / 681–725），`elementFromPoint` 命中 `fab-main`；「已掌握」tab 只有 1 卡时同样复现。批量模式下 FAB 不渲染但 `.batchbar` 会盖 footer——两种都要量并分开记。
- **uni `showActionSheet` 几何**：外层元素高 0，量 `.uni-actionsheet__menu` 与各 `.uni-actionsheet__cell`；375 下 6 项菜单末行「删除」/「取消」会越过 tabbar 762；1440 居中弹层容器会裁切末行（看放大截图）。
- **复习「错因自评」只在复习答错后出现**（展开态卡片没有）；新错题 `next_review NULL` 即到期，`GET /api/review?uid=` 直接可用，不必改库。复习组件状态用含 `退出复习|复习 \d` 文案的元素回溯 `__vue__`/parent 取 `rItems/rIdx/cur`。答错一题会追加 2 道同类（`rItems` +2），完成层统计文案包含「加练同类题 N 道」。
- **只到确认层的破坏操作**（导出 PDF、批量删除、纠错提交）：截图后点取消，用 `paper_exports`/`question_reports`/`mistakes` 行数前后一致证明未写库。
- **AI 失败态回归可用浏览器内 CDP Fetch 拦截**（`/tmp/cdp174/r398_intercept.py` 对 `*mistakes/analysis*` 回 502），请求不到达生产；用完按 PID kill，并把该 502 从 non-2xx 统计里剔除。
- **页面内 HDR 钩子跨文档导航（stats/SEO 页）会重置**：每段结束先 `JSON.stringify(window.__hdr)` 落盘再跳页；漏了就用容器 `docker logs --since` 按 uid grep 状态码直方图补证据。
- 审计脚本自动枚举 uid 列时用 `c in ('uid','from_uid','user_id','owner_uid','to_uid') or c.endswith('_uid')`（当前 40 张表，含 `review_cur.uid`、`pk_matches.creator_uid/opponent_uid`、`teams.creator_uid`）。

## R402 只改生产数据的轮次：SSR 进程内缓存陈旧的判法（testing agent）

- **「只改了 DB 数据、rev/bundle 不变」的轮次先查 SSR 缓存**：`/tiku/q/<id>` 由 `backend/app/seo/pages.py _render_question` 渲染并 `@lru_cache(maxsize=4096)`。R402b（`dd13df6`）前缓存键只有 qid，隔离脚本改库后**不重启进程**页面仍是旧 HTML（237345 API 已 `explanation null` 但 SSR 仍两段含「解得 x=。」）。区分边缘缓存与进程缓存：加随机 query（`?x=随机`）拿 `x-edge-cache: MISS`，MISS 仍旧 → 进程内缓存，用 `message_parent` 上报根因并把 SSR 项按现状记 FAIL，等重启/修复后再复验并如实更新。R402b 之后缓存键含 `questions.updated_at`，理论上写库即刷新，但仍要看 `docker inspect StartedAt` 判断是否重启并复核一次。
- **边缘缓存窗口**：`cache-control: public, max-age=300`；部署后 ~15 分钟内无 query 的正式 URL 可能 `x-edge-cache: REVALIDATE age>300` 仍返回旧 HTML，之后才刷新。复验时既要测带随机 query（源站真值）也要测正式 URL（真人视角），报告里分开写。
- **JSON-LD 断言脚本**：页面 `script[type="application/ld+json"]` 可能是顶层数组，需 flatten 后取 `@type` 集合，`acceptedAnswer` 递归查找（`/tmp/cdp174/ssrcheck.js` 一次返回 skeleton/原解析/花生十三讲解/暂无解析 计数 + 正确答案 + types + accHead）。期望恰为 `{LearningResource, BreadcrumbList}` 两块，acceptedAnswer 以「正确答案：X。」+ hs 开头。
- **`/api/question/<id>` 返回包在 `item` 下**（`json['item'].explanation`），不是顶层字段。
- **中途换 rev 的处理**：练习/错题本/回归证据若在重启前采集且变更只涉及 SSR 文件、bundle 不变，证据仍有效；但在新 rev 上至少把核心链（CTA → 答错 → POST expLen → 错题卡）复跑一遍并标「post-fix」，报告写清哪些断言在哪个 rev 上取证（`__mist[].t0` 换算 UTC 与 StartedAt 对比）。
- 审计脚本列名先核：`mistakes` 无 `wrong_count` 列；脚本报错会让 `&&` 链短路导致 clean 未执行，看到 `LEFTOVER` 不为 0 前先看是否根本没跑到 clean。teardown 用显式 `pgrep -f 'python3 -u /tmp/cdp174/holdX.py'` + 排除自身 PID，避免 R401 的自杀问题。
- 容器日志数 5xx 用 `grep -E ' 5[0-9][0-9] '` 会误命中 `[indexnow] submitted 533 urls -> 200`，改用 `grep -oE '" [0-9]{3} ' | sort | uniq -c` 看状态码直方图。

## R401 数值位抠空解析隔离（base 置 NULL）生产复验 走查新经验（testing agent）

- **SSR 题目页解析默认折叠**：`/tiku/q/<id>` 的答案与解析在 `<details>`「先想一想，再看答案与解析」里，`innerText` 里直接数「本题用两集合容斥」会得 0；先原生点开 summary（或断言 `document.querySelector('details').open`）再数骨架/hs/「原解析」出现次数。`backend/app/seo/pages.py` 只在 hs 与 raw **都非空**时才渲染「花生十三讲解 / 原解析」两段，base 置 NULL 后页面只剩单段 hs、「原解析」计数应为 0（这是隔离成功的页面级信号）。
- **隔离前后判定口径**：`/api/question/<id>` `explanation === null`（不是空串）+ `hs_explanation` 非空；`mhook` `expLen == hs 长度`（288140 → 104）；clean 前 raw `mistakes.explanation` 同长度同前缀。R400 时同题 raw 是 167 字骨架乱文，R401 后应为 104 字 hs——报告里把这两个数字并列写。
- **用户给的「保留题/对照题」先查 `disabled`**：334672 在生产是 `disabled=1`（panduan），深链会被过滤、UI 不可用；正常对照仍用 264413（active，base 79 字）。答对照题时先看 `answer`（264413 答案 A），答对会自动跳下一题且不产生 mistake 行——答错才有快照，需带 `&v=N` 重进再答错；多出的一条 answer_log 在对账里要解释（本轮 answer_log 11 = 4+1(答对)+3+3）。
- 容器日志 404 若出现 `GET /api/questions/<id>`（复数），不是前端/自己的 `/api/question/<id>`（单数）探针，多为 lead 侧脚本；只在报告注明来源不明，不要归给应用。
- 宿主磁盘/负载要在**测试首尾各记一次**（`uptime` + `df -h /`）：本轮 20 分钟内从 96%/2.0 GB/load 1.5 变到 98%/1.5 GB/load 8，发现时用 `message_parent` 即时上报，不要等最终报告。
- `r400_teardown.py` 之类用 `pgrep -af holdvw.py` 杀 holder 时会连带命中包含该字符串的 `bash -c` 包装进程（自己的命令被 kill，exit -1）——把 teardown 脚本单独一条命令跑，或 pgrep 后过滤 `python`。

## R400 错题快照写入侧回落 hs + 公式丢失解析隔离 生产复验 走查新经验（testing agent）

- **「写入侧」与「读取侧」证据要分开**：R396b 起 `/api/mistakes`、`due_reviews` 读取侧已把空快照回落 hs，所以 API/错题卡显示 hs **不能**证明写入侧改动。写入侧证据链 = ① 页面上下文 XHR 钩子 `/tmp/cdp174/mhook.js` 记录真实 UI 触发的 `POST /api/mistakes` 请求体 `explanation` 长度/前 40 字（`window.__mist`）② 容器 DB raw：审计脚本 `ro` 模式打印 `select id,uid,question_id,length(explanation),substr(explanation,1,40) from mistakes where uid like 'test-rNNN-%'`，**必须在 clean 之前跑并落盘**（clean 后行消失）。对照题（有官方 base 的）同时答错一道，确认 raw 前缀是 base 而非 hs。
- **隔离题深链**：`/#/pages/practice/practice?qid=<id>&module=shuliang` 领跑该题，练习包后续题目来自同模块/考点，可能混入**未被隔离的骨架乱文题**（如 288140「…订阅报纸的家庭为，因此…」句首残缺、公式位空、不在 `explanation_quarantine`）——审计 ro 输出里逐条看 `substr(explanation,1,40)`，乱文样本要单列为观察并到 `/tiku/q/<id>` 截「原解析」作证；同时用 `select * from explanation_quarantine where question_id=?` 证明未隔离。
- **页脚剥离样本多为 `disabled=1`**（`/tiku/q/` 404，不可见页面），只能记 `/api/question/{id}` 层观察；找活跃替代样本时 `docker exec … sqlite3` 在 `questions` 里按 `options like '%《行测》真题%'` 的历史值反查（本轮 332501 `D: 6`），报告明确「UI 用替代样本」。
- 换 uid 复用同一浏览器时，首页模块进度卡（「言语理解 N/18294 · 正确率」）会沿用上一 uid 的 localStorage 缓存数值，服务端 `home_bundle.summary.today_n` 才是该 uid 真值；别把它记成后端 bug，也别用它做作答条数对账。
- 同一 `#/pages/practice/practice?qid=` 深链二次进入可能保留上一题包状态，需带一个变化的 query（`&v=2`）强制整页重载再答题。
- 请求数与点击对账口径：`__mist.length == 答错次数`；容器 `grep -c "POST /api/mistakes "`（尾随空格，排除 `/mistakes/analysis`）== 两 uid 答错总数；`mistakes/analysis` 行数 == 点「生成」次数。

## R399 AI 生成类接口主通道优先 生产复验 走查新经验（testing agent）

- **R399 后 `mistakes/analysis`/`ai/coach` 走 `llm.chat()`，成功路径零日志**：容器日志只剩 `[slow-req] Ns POST /api/mistakes/analysis` + access 200 行；`[llm] rescue … failed … fallback` 只会由 `chat_fast()` 调用方（题目抽取/申论）产生，对错题分析 grep 到 0 行是预期。`chat()` 主通道 5xx/额度码回落 rescue **也无日志**，所以「耗时偏长（如 53 s）是主通道慢还是静默回落」无法用日志区分，报告里要标成推断；建议下轮在 `chat()` 回落处加 warning 再复验。
- **结尾完整性口径**：`JSON.parse(__ai[n].resp).analysis` 末 40 字以 `。！？` 结束、不停在列表序号（R398 126 字止于「1」即截断形态）；同时比对 `uni-rich-text.innerText.trim().slice(-30)`。主通道 `finish_reason=length` 时日志会有 `[llm] finish_reason=length, content N chars returned as-is`，出现要原文记录。
- **耗时分布**：R399 三次真实请求 14.7 / 34.6 / 53.2 s，方差大，不要把单次超出「18–35 s」判 FAIL，记录事实并与 slow-req 秒数对应即可。
- `/api/ai/coach` 前端**没有入口**（`frontend-uni/src` grep `ai/coach` 0 命中），只能记「未触达」；不要用 curl 冒充 UI。
- 宿主 `/tmp` 可能有 lead 的同轮取证脚本（`r399_probe.py`/`r399_rescue_probe.py`/`r399_srs3.py`），收尾只删自己命名带 `_ta` 的副本（如 `r399_audit_ta.py`），先 `ls -la` 甄别。
- `r398_killvw.py` 会连带结束调用它的 shell 链（后续 `&&` 命令不执行），要单独一条命令跑，再另起命令启新 holder。
- 浏览器截图坐标空间就是 1024×768 的截图坐标（不用 ×2），超出范围的点击会被静默丢弃——点「生成」前后用 `__ai.length` 核对是否真发出请求。

## R398 错题本弹层让出 TabBar + AI 失败态可重试 生产复验 走查新经验（testing agent）

- **375 弹层几何口径**：H5 `.uni-tabbar` fixed top=762（812−50）、z 998；`.mask` z 99。断言 `document.querySelector('.mask').getBoundingClientRect().bottom===762`（未修前 812），底部按钮 `rect.bottom<=762` 且 `document.elementFromPoint(cx,cy).closest('.sheet-done'|'.sheet-export'|'.rf-alt')` 非空（未修前返回 tabbar 的 IMG）。1440 `.mask` 是 `[288,0,1345,900]`、computed `bottom:0px`——左 288 是桌面侧栏布局（既有），别当劣化。
- **强化卡只在 `/api/reinforce/suggest` 返回 `picked` 时出现**（需今日错题）；复习流可能比造出的错题多（到期/加练/重排），用 `/tmp/cdp174/r398_review.py`（按 `rItems/rIdx/reviewing` 找 Vue 组件后 CDP 点选项）做完到庆祝 sheet；别用坐标脚本盲点。
- **本机拦截制造 AI 502**：`/tmp/cdp174/r398_intercept.py`（`Fetch.enable` 匹配 `*mistakes/analysis*` → `Fetch.fulfillRequest` 502 `{"detail":"AI 未返回内容，请稍后再试"}`，头 `X-Kg-Intercepted`），请求**不到达生产**；先做真实成功→F5（清 `aiHtml` 短路）→装 `aihook.js`→启拦截→点生成→点重试（`__ai.length` +1）→按 PID kill 拦截器→再点重试等真实 200。dry-run 用 `/api/r398probe`（拦截时 502，放行后真实 404，会在容器日志留 404 行，报告里注明）。`window.__bk`（Vue 组件引用）F5 后失效要重找。
- **`__hdr`/`__cerr` 是每文档钩子**：地址栏深链、F5 都会清零，导出 `/api` 状态要在每次跨文档导航前 `cdp.py eval` 存文件；服务端 5xx 以容器日志直方图 `grep -oE '" [0-9]{3} ' | sort | uniq -c` 兜底。
- **R397 之后 `llm.py` 回落有日志了**：`[llm] rescue kimi-k3 failed (EmptyReply: …), fallback to deepseek-…`，可与 `[slow-req] 44s POST /api/mistakes/analysis` 行按时间对应，证明回落发生（回落次 ≈45 s，直出 ≈23–34 s）。
- 卷库路由是 `#/pages/exam/list`（不是 `exam/papers`）；地址栏带 `?r398=uid` 只是给 `r391usr.py prep` 用的标记，不会切 uid。
- 收尾杀 holder：`r398_killvw.py`（ps 按 `holdvw.py|r398_intercept.py` 匹配 + 排除自身 PID），`kill $(ps … | awk)` 循环里 `ps -eo pid,args | grep -c` 会把 grep 自己算进去，用 `grep "[r]398_intercept"` 写法。

## R397 AI 错题分析（`POST /api/mistakes/analysis`）空 200 修复 生产复验 走查新经验（testing agent）

- **AI 入口卡有门槛**：`book.vue` `v-if="tab!=='fav' && todoItems.length>=3"`，每个测试 uid 至少要造 **3 条待掌握错题**才会出现「AI 错题分析 · 生成」卡；最快是深链 `#/pages/practice/practice?qid=264672` 后用 `r396prac.py 1,2,3 3` 连错 3 题（同时顺带覆盖 R396 隔离题回落 hs 路径）。
- **抓 AI 响应用 XHR 钩子而不是 `__hdr`**：`/tmp/cdp174/aihook.js` 在页面上下文 monkeypatch `XMLHttpRequest.open/send`，对 `/mistakes/analysis` 记 `iso0/iso1/ms/status/responseText` 到 `window.__ai`；同文档内 tab 切换（hash 路由）钩子仍在，但跨文档导航（改地址栏/F5）会丢，要在进入错题本页前、同一文档里装。判定：`JSON.parse(resp).analysis.trim().length>0`；旧空 200 会让前端显示「分析失败，请稍后重试」（无冒号），新 502 路径显示「分析失败：<detail>」（有冒号）——凭冒号区分空 200 与 502。
- **服务端只有 access 行 + `[slow-req]`**：`llm.py` 的 `EmptyReply`/回落无日志，`grep EmptyReply` 必为 0；是否回落主通道只能由耗时推断（R397 实测 rescue 直出 ≈30 s，疑似回落 ≈52 s；R396 空 200 时 25–31 s）。`grep 502` 会命中 `/api/health` 行里的端口/时间片段，要看状态列而不是行数。
- **限流 10 次/300 s/uid**：每 uid 只触发 1 次即可；两视口用两个 uid。前端 `timeout: 420000`，30–60 s 不会超时；加载文案「约需 30-60 秒」。
- **收尾别用 `pkill -f holdvw.py` / `pgrep -af holdvw` 直接在 bash -c 里跑**：模式会匹配到当前 bash 自身把 shell 杀掉（exec 返回 -1）。用 `/tmp/cdp174/r397_teardown.py`（按 PID kill python holder、恢复 LS、`clearDeviceMetricsOverride`、导航回首页）。
- `hold_restart.sh W H 1` 的第三个参数要写 `true` 才是 mobile（脚本判 `== 'true'`），`1` 会得到 `mobile=False`。
- 审计脚本按轮次复制：`sed "s/test-r396c-%/test-r397-%/" /tmp/r396c_audit.py > /tmp/r397_audit.py`，末尾追加 `questions active (disabled=0)` 计数（预期 109371 / 总 156792）。

## R396c 读取层回落 hs（`db.list_mistakes` / `db.due_reviews`）生产复验 走查新经验（testing agent）

- **读取层修复要用「DB raw vs API」对照证明**：前端快照仍写 `q.explanation||''` 时，`mistakes.explanation` raw `length` 应仍为 0，而 `/api/mistakes` / `/api/review` 返回 hs（264672 → 121 字）。审计脚本 ro 模式打印 `length(explanation),substr(explanation,1,40)`，两者不一致才说明修复真的在读取层；同时对照一条 base 非空的快照（264413 79 字「从9个分项中选6项…」）确认 `eq_base:true eq_hs:false` 不被覆盖；断言响应文本 `/q_hs/.test(txt)===false`。
- **到期复习接口是 `GET /api/review?uid=`**（`study_api.py` `api_review_due`），不是 `/api/review/due`（404，会污染容器日志 404 直方图——报告里要注明是探针）。要在进入复习、答题之前取样，答完后该题 `next_review` 后移，due 列表会变空。
- **深链 `#/pages/practice/practice?qid=N` 对 `disabled=1` 的题会静默跳过**、落到默认模块包（例：236202「花生壳：核桃仁」为 disabled）。构造"无 base 无 hs"边界前先查 `/api/question/{id}` 的 `disabled`；生产 `disabled=0` 且两解析均空的题目数为 0，该边界在生产无法经 UI 构造。
- 375 卡片越界判定：`right>375` 的节点若全部是 `visibility:hidden`、`top≈-511` 的 400 px 测量 div（uni rich-text/textarea 影子节点），不算溢出；以 `documentElement.scrollWidth==375` + 卡片 `.card` right ≤ 375 为准。
- `hold_restart.sh` 的 `pgrep -f "^python3 -u …holdvw.py"` 在 pyenv 下匹配不到（cmdline 是完整路径），会残留多个 holder；收尾用 `pgrep -af holdvw.py` 按 PID kill 再 `clearDeviceMetricsOverride`。

## R396b 「解析串题」可逆隔离（`explanation_quarantine`）生产复验 走查新经验（testing agent）

- **解析来源要按路径分别验证**：交卷路径快照（`exam_api.py` `explanation or hs_explanation`）与试卷报告 / 练习页（读 `hs_explanation`）在隔离后都能显示 hs；但**练习路径**写入 `mistakes.explanation` 用的是 `q.explanation||''`，且 `db.list_mistakes` 不 JOIN `questions.hs_explanation` → 隔离题经练习页答错进错题本后，卡片「参考解析」与复习详解为空（R396b 复现 264672，`/api/mistakes` `explanation:""`）。验证隔离类改动时务必走一次「练习页答错隔离题 → 错题卡展开 → 复习详解」的对抗路径，别只走交卷路径。
- **练习页解析行口径**：「花生十三方法解析」行 = `cur.hs_explanation`，「解析」行 = `cur.explanation`（未被 hs 包含时才显示）。隔离题应只剩前者；保留 base 的题（如 264413）两行都在。检查 DOM 用 `[...document.querySelectorAll('uni-text,uni-view')].map(e=>e.innerText.trim())` 过滤 `==='解析'||==='花生十三方法解析'`，正则写在 `.js` 文件里用 `c.eval(open(f).read())`，避免 shell 转义把 `/…/` 弄坏（`Invalid regular expression: missing /`）。
- **375 模考页选项点击会自动跳下一题**：`r396exam.py` 那种「点选项 + 点下一题」在 375 会双步跳题（偶数位置全漏答）；用 `/tmp/cdp174/r396b_fill375.py 'pos:L,…'`：先用「上一题/下一题」原生按钮把 `__ex.idx` 导航到目标位置再点一次选项。
- **375 复习流不要用坐标脚本盲点**：`r396b_review375.py` 一旦选项识别失败会点到 tabbar（`AI问答` 在 x≈120,y≈590）把页面切走，复习会话虽保留（再进错题本从 `复习 7/10` 续），但录屏里很混乱。375 复习卡 A/B/C/D 按钮在 y≈300–400、`下一题` 在 y≈541（滚到底后），用 computer 工具逐题点更稳；复习会在答错题后追加 2 道「加练同类」（`x/10` → `x/13`）。
- **DB 审计口径加 `length(explanation)`**：`r396b_audit.py ro` 对每条 mistakes 打印 `source,length(explanation),substr(explanation,1,40)`，可直接佐证交卷路径快照 = hs（79–181 字）而练习路径隔离题 = 0；同时打印 `explanation_quarantine` 行数与卷 24 `expl_null/hs_nonempty/quarantined` 确认清理没动隔离表。
- **API 绕缓存**：`/api/question/{id}?v=rand` + `X-Kg-Probe:1` 均回 `cf-cache-status: DYNAMIC` 无 `age`，响应体在 `item` 下，题干字段是 `question`（不是 `stem`）。
- 已知 R396 P1 在 6b0cedf 仍在（不影响本轮结论）：375 强化卡「下次再说」rect 767–792 在 tabbar 762–812 下；`/api/mistakes` `source:'exam'` 项 `paper:null`；AI 分析 30 s 后 200 空体 → 「分析失败」被 tabbar 盖住。复习快照复活 375 未复现（`/api/review/cur` 返回 `{}`）。

## R396 错题本次级屏 UX 走查（生产、无新代码）新经验（testing agent）

- **375 下 tabbar 会盖住所有底部 sheet**：uni tabbar `position:fixed; z-index:998`，页面内 `.mask` z-index 100，任何 bottom sheet 的最后 50 px（762–812）都在 tabbar 下面。量化口径：目标控件 `getBoundingClientRect()` + `document.elementFromPoint(cx,cy)`，返回 tabbar 的 `IMG/.uni-tabbar__bd` 即"不可点"。可滚动 sheet（如筛选 sheet `overflow:auto`）滚到底能点到；不可滚动 sheet（复习完成强化卡的「下次再说」、AI 分析失败文案）会被完全遮住——这是 UX 缺陷不是测试问题，报告时标视口。
- **题库解析错位是可能的 P0**：错题卡展开/复习详解看到解析与题干不搭时，别当 UI 问题，取 `/api/exam/papers/{pid}` 的 `question_ids`，逐题 `GET /api/question/{id}` 对比 `question_type`/题干 与 `explanation` 首句题型关键词（图形/六面体/定义/类比/削弱），一卷 17 题一次脚本即可定位（R396 卷 24 `2022 安徽` 13/17 错位）。
- **复习快照"复活"是时序相关**：`exitReview → clearReviewSnap` 会清 timer，但庆祝弹层期间仍可能再 `saveReviewSnap`（1.5 s 延迟 POST `/api/review/cur`），完成后后退再进错题本会自动进入 `复习 2/2`。取证用组件 `reviewing/rIdx/rItems.length` + `GET /api/review/cur?uid=` 的 `snap.rIdx/ts`；同一步骤 375 可能不复现，报告写"非必现 + 触发序列"。
- **模考错题无 `paper` 字段**：`/api/mistakes` 中 `source:'exam'` 的项 `paper:null`，只有练习里做到的真题才有 `paper:{pid…}`；筛选 sheet「试卷」/卷源徽标/「练本卷」对交卷路径不成立，验证按卷功能要用练习路径造数据，否则会误判为"筛选坏了"。
- **AI 错题分析可能 200 空体**：`POST /api/mistakes/analysis` 25–30 s 后 200 但 `analysis` 空，前端渲染「分析失败，请稍后重试」且无重试；容器日志只有 `[slow-req]` 无 Traceback。在 `__hdr` 钩子里按 url 过滤等待，`timeout 420 s` 不要用固定 sleep。
- **375 uni-input 用 xdotool 打中文不生效**：`type` 动作 Chinese 文本对 `.searchinput input` 无效且 `activeElement` 仍是 BODY；用 CDP `Input.insertText` 前先 `input.focus()`（`Runtime.evaluate`），再原生截图看结果。搜索结果在首屏之下需滚动才能看到。
- **F5 会清空页面钩子数组**：`window.__hdr/__cerr` 随刷新丢失（holdhook 会重装钩子但数组从零开始），做「刷新后筛选保留」断言前先把当前段导出到 `/tmp/*_segmentN.json`，报告按段汇报。
- **批量模式空列表陷阱**：批量操作把当前 tab/筛选列表清空后，seg 行的「完成/批量」按钮消失，批量条仍在，DOM 里没有退出控件；测试时靠清筛选 chip 或切 tab 恢复，报告记 P2。
- **审计脚本要包含 `review_cur.uid`**：`pragma table_info` 枚举 39 列会自动带上 `review_cur/ask_cur/practice_progress/exam_progress`，清理后服务端复习快照一并清掉；R396 一轮双 uid 产生 175 行（mistakes 33 / answer_log 64 / exam_attempts 2 / review_log 47 / growth_events 29）。
- 复位顺序不变：LS 恢复 → kill holdhook/holdvw → `setDeviceMetricsOverride(mobile=False)` + `clearDeviceMetricsOverride`（`innerWidth` 回 1600）；PDF 下载会留在 `~/Downloads`（`错题重练卷 <日期>.pdf`），如需可删。

## R394 百度自适应标注（SSR/H5 壳 `applicable-device` meta + sitemap `mobile:mobile`）生产复验 走查新经验（testing agent）

- **`/tiku*` 部署后原生导航首访可能拿到部署前旧 head**：CF Pages functions `caches.default` 是 SWR 语义（`cf-cache-status: DYNAMIC` 但带 `age` 秒数 + `cache-control: public, max-age=300`），TTL 过期后首个请求仍回旧副本并后台回源，`age` 可达数小时（R394 见 `age: 16203`）。断言 DOM 前先用 CDP `Network.enable` 捕 `responseReceived(type=Document)` 记 `age/cf-cache-status/fromDiskCache/fromServiceWorker`，DOM 为旧就重试一次原生导航，两次都如实写进报告；`?v=rand`+`X-Kg-Probe`+`no-store` 的页面上下文 fetch 永远是新副本，不能替代 DOM 断言。`/` 壳由 SW 提供（`fromServiceWorker=true`），`age` 为 null。 注意 `caches.default` 按机房独立：Devin 走查恒落 PDX，看到的旧副本是自己（或同机房他人）上次访问留下的，与部署脚本 3b 预热（只刷 VPS 所在 ICN）无关，不能据此推断引擎/真人也会看到旧 head（R395 取证：14 天真人页面命中 swr 旧副本 0 次）。
- **原始 HTML 断言口径**：`/tiku/*` 用 `html.slice(vpEnd, adStart)===''` 证"紧随 viewport"；`/` 的 viewport 是 `document.write` 脚本产生的，只能证 `</script>` 与 ad meta 之间仅空白、ad 在 `<title` 之前；404 页要同时核 canonical 0、`og:url` 0、`robots noindex` 1（`_page(noindex=True)`）。
- **sitemap 断言要命名空间感知**：`DOMParser('application/xml')` 后用 `getElementsByTagNameNS('http://www.baidu.com/schemas/sitemap-mobile/1/','mobile')`，`querySelectorAll('mobile\\:mobile')` 在 XML 文档里不可靠；同时核 `parsererror` 0、每条 `url` 首子 `loc`/末子 `mobile:mobile`、`sitemap.xml` 根 `sitemapindex` 且文本不含 `sitemap-mobile`。`/sitemap-questions-1.xml` ~950 KB，`Runtime.evaluate` 要 `awaitPromise` 并把超时放到 ≥60 s。
- **跨文档导航（SEO 页 → 原生点 CTA → H5）会丢一次性钩子**：`Page.addScriptToEvaluateOnNewDocument` 的注册随 CDP 会话断开而失效，一次性脚本 `prep` 后跳到 SSR 页再回 H5，落地文档里 `__hdr/__conHook2` 为 undefined，落地前 3 条 `/api`（profile / question/:id / questions?limit=10&tag3=…）漏记。改用常驻进程 `/tmp/cdp174/holdhook.py`（保持会话并注册 HDR+CON2）再做 CTA 流程；漏记的用 `docker logs` 按 uid 补证状态码并在报告里标注。
- **地址栏输入会被 omnibox 内联补全**（输 `…/tiku/` 回车变成历史里的 `…/tiku/q/234080`）：`type` 后先按 `Delete` 再 `Return`。
- SEO 题目页 CTA 落地 `#/pages/practice/practice?qid=<id>&tag3=…&module=…&source=seo_q`，计数 `1/11`（所读题 + 10 题同考点），375 顶部有「刚才那题在这里作答，之后 10 题同考点练习」提示条；续练卡文案 `常识判断 · 已做 3/11 题`。
- 容器 `/tmp` 里可能有部署方自己的临时脚本（R394 见 `r394_origin.py`，容器时间 +8h），`rm -rf /tmp/*r394*` 会连带删掉，清理前先 `ls -la` 甄别并在报告里说明。
- 部署后日志里 `/tiku/q/999999999 404` 是预期 404 页（部署验证 + 本轮），`/sw.js 304` 是 SW 校验，都不算异常。

## R393 `PROBE_UA_MARKERS`+`devin/` / `humans.offhost_7d` / 看板「预览域名」尾缀 生产复验 走查新经验（testing agent）

- **看板候选真人行对账用页面自己那次 `/api/admin/ops_status`**（`r377.py HOOK` 存 `__r377.ops`），并记 `generated_at`；crawler cron 每小时 ~:23 刷新，用户口头给的数字可能过期。期望字串按 `dashboard.js humanRow` 拼：`detail + direct + offhost`，注意 `源站直连扫描 N（已剔除） · 预览域名 N（已剔除）`（`（已剔除）` 后有一个空格再 `·`），逐字比对时别手写漏空格。
- 尾缀 `direct`/`offhost` **仅非零显示**：生产两者非零时 `=0` 分支只能声明 untested，不要去改生产 JSON 造 0。
- `PROBE_UA_MARKERS` 含 `devin/` 后：本机受管 Chrome UA 若**不含** `Devin/1.0`，GUI 请求仍只走网段路打 probe=1；不要伪造 Devin UA 打生产制造数据，UA 路交给用户 VPS 侧隔离样本，报告标 untested。
- 管理台 375：`Page.addScriptToEvaluateOnNewDocument` 钩子在 `holdvw_admin.py` 触发的 reload 后不延续，reload 后要重装钩子再取 ops 响应；`.lb` 不逐字竖排的量化口径：标题文本 Range `getClientRects().length==1`、`.lb` 高 ≤60px、`.sub` 正常折 2–3 行（`subMinW` 最后一行可很窄，不是坏形态）、`documentElement.scrollWidth==375`、行 `flex-wrap:wrap` 使 `.tag` 掉到下一行属正常。
- 部署后容器日志若见 `GET /api/admin/ops_status 401` ×N，先到 Caddy 源站日志对 IP/UA：来自 `150.109.230.174 curl/8.5.0` 且随后 200 的是部署方自己 VPS 核数（无 token/错 token 试探），不是本轮 GUI；按时间戳单列。
- 短版审计行数参考：两 uid 各 3 题全错/部分错 → `mistakes` = 错题数、`answer_log` 6（probe=1）、`growth_events` 4–6；`answer_log` 清理后回 1090。
- `cdp.C.call(m, **p)` 只接关键字参数（`c.call('Emulation.clearDeviceMetricsOverride')`），传 dict 位置参数会报 `takes 2 positional arguments`。清 override 后要导航一次（不是 reload）才能看到 `innerWidth` 回 1600。

## R392 后端 monitor `internal` 标记 短版生产回归 走查新经验（testing agent）

- **后端 `probe_request` 三路判定**（`backend/app/auth.py`）：`X-Kg-Probe: 1` 头 / 出口 IP 命中 `KG_PROBE_CIDRS`（容器 env，`docker exec … printenv KG_PROBE_CIDRS`）/ UA 含 `python-requests|curl/|headlesschrome|playwright…`。GUI 浏览器发的请求（真人 Chrome UA、无探针头）**只走网段路**，验证前先确认本机出口 `curl ifconfig.me` 在 CIDR 内；报告里明确"本侧只能证 200 + 源站 IP/UA/无探针头，中心侧 `internal` 值由用户核对"。
- **要在页面 console 执行用户给定语句时**：DevTools Console 对 `type` 长语句会自动补全括号导致 SyntaxError（请求根本没发出）；改 `xclip -selection clipboard` 写入后 `ctrl+v` 粘贴。要记录 `Date.now()` 生成的 message 原文，在语句前加 `window.__r392msg='…'+Date.now()` 再引用它，body 语义不变；同时开着 `r391b_int.py watch` 拦截器可拿到 postData 原文与 response 200（同一 POST 记 request+response 两条，别算成 2 次上报）。
- **卷库卷数对账要用页面实际请求**：`pkgA/exam/list.vue` 请求的是 `/api/exam/papers?kind=zhenti&uid=…`（120），无参 `/api/exam/papers` 会多出 mock/retired（200 条）——直接比无参接口会误判不一致。卡片数可用叶子节点 text `开始模考` 计数 + `已刷 0/N 卷` 文案双核。
- 首页「专项练习」模块行的 `已做 N / 正确率` 是浏览器 localStorage 侧统计，同 profile 换 test uid 后仍显示上个 uid 的数字，不是后端串数据。
- 部署后 docker 日志若见 `POST /api/auth/wxlogin 503` 且源站 IP 在探针网段（curl/浏览器 UA），多为部署方自己的 5xx 转发验证，按时间戳与本轮 GUI 起止对照后单列，不要直接记为业务 5xx。
- `r391usr.py read` 需要第 2 个参数（输出 json 路径），`/api` 列表在 `hdr` 键；`restore_ls.py` 期望备份是 JSON **字串**（双重编码），若备份存的是原生对象需改用 CDP 直接 `localStorage.setItem` 写回。

## R391b `describeRejection` + `tabbar-badge.js fail:noop` 短版生产复验 走查新经验（testing agent）

- **角标/小工具模块可能被 Vite 拆成独立共享 chunk**（如 `/assets/tabbar-badge.<hash>.js`，home/book/ask 各 import 一次），主 bundle 里 grep `setTabBarBadge({…fail` 找不到调用点不等于没上线：先在主 bundle / 页面 chunk 里找 `import("./tabbar-badge.` 取哈希再拉该 chunk 断言 `fail:` 次数。主 bundle 里的 `setTabBarBadge` 字串是 uni 内部 API 名。
- 验证"fail 回调吞掉 rejection"的最小可信路径：分包 `fail404` 进错题本出 AsyncError 后**停留 ≥30 s**（上轮 `[object Object]` 出现在错误 UI 后 ~7.5 s），页面侧 `__pexc`（unhandledrejection 原始 reason，`JSON.stringify`）必须为空；再在 AsyncError 态下 `import('/assets/tabbar-badge.<hash>.js').then(m=>m.setBookBadge(1))`（导出名在 chunk 里核对）应无 rejection。想同时证明 describeRejection 可读，可从主 bundle 导出里取 uni 底层 `setTabBarBadge` **不带 fail** 调一次，上报应是 `unhandledrejection: setTabBarBadge:fail not TabBar page`——这是人为对照实验，报告里必须与产品路径分开写。
- **sendBeacon 走 CDP `Fetch` 拦截不稳定**（同一轮 1440 拦到、375 没拦到）：monitor POST 的证据用三方对账——页面 `navigator.sendBeacon` 包装 `__mon`（body 原文）+ `performance.getEntriesByType('resource')` 里 `initiatorType==='beacon'` 的 `responseStatus` + 容器/Caddy 源站 access log 时间戳；不要只靠拦截器 `monitor:[]` 判"0 上报"（正常路径要配合 `__mon` 0 + 源站该时段无该 IP 的 POST）。
- `r391usr.py` 钩子（`Page.addScriptToEvaluateOnNewDocument`）在 CDP session 断开后**不会**跟到下一个新文档：SEO 页 → CTA 进练习页是新文档，必须在练习页再跑一次 `hook`，否则 `__hdr/__pexc` 为 undefined；前几条 `/api` 只能靠 `performance` + 源站日志补。钩子里 `MutationObserver.observe(document.documentElement)` 在文档极早期可能为 null 抛错并中断后续 hook 安装——包 try/catch 或延后到 `readystatechange`。
- 受管 Chrome（`chrome-linux64/chrome --remote-debugging-port=29229`）在 AsyncError 点击 reload + 长时间 h3 停滞期间崩过一次：重启命令 `DISPLAY=:0 setsid nohup /opt/.devin/chrome/chrome/linux-*/chrome-linux64/chrome --remote-debugging-port=29229 --no-first-run --user-data-dir=/home/ubuntu/.browser_data_dir <url> &`（profile 是 `~/.browser_data_dir`，不是 `~/.config/devin-chrome`）；重启后的 Chrome 有 15 px 非 overlay 滚动条，375 视口下 `clientWidth=360`，属浏览器差异不是布局回归，报告时说明。崩溃会打断拦截器/holder，全部 PID 要重新 `ps -eo pid,args | grep` 精确 kill——**不要在同一条 bash 里 `pgrep -f` 再 kill**，会匹配到 bash 自身把命令杀掉（exit -1）。
- 短版 DB 审计行数：两 uid 各 3 answer_log + 1 mistakes + 3 growth_events（prep 期 1 条 `slow_load` + quit_keep + quit_end）= 14 行；`cdp.C` 只有 `call(m, **p)` / `eval(js)`，没有 `send`。

## R391 页面分包超时（`h5.async.timeout`）+ `app.config.errorHandler` → `/api/monitor/report` 生产复验 走查新经验（testing agent）

- **分包挂起/失败要用 CDP `Fetch.enable` 拦 `*pkgA-exam-list*.js` / `*pages-book-book*.js`，并且必须先 `Network.enable` + `Network.setCacheDisabled(true)`**：immutable 分包命中浏览器缓存就不会经过 Fetch 阶段，拦截器看起来"没生效"。每个拦截器进程只跑 1 个实例（多实例互相抢 `Fetch.requestPaused`）。`hold N` = 暂停 N s 后 `continueRequest`；`fail404` = `fulfillRequest 404`；`abort` = `failRequest`；"点击重载后恢复"若拦截器已 detach 会导致重载后再次卡住——恢复阶段改用 `Network.setBlockedURLs`（可随时解除）更稳。
- **监控 POST 的 body 只能靠 Fetch 拦 `*/api/monitor/report` 在 request 阶段读 `postData`**（sendBeacon 在 Network 事件里看不到 body）。页面侧再包一层 `navigator.sendBeacon`/`fetch` 记 `__mon`（body、via、`performance.now()`）作双证。终端 tail 的 JSON 会被截断，取原文要读 `.log` 文件或 `__mon`。
- 计时：hook 是原生导航后装的，`hashchange` 记不到 `navT0`（=0）；用 `performance.getEntriesByType('resource')` 里该分包的 `startTime` 作起点，MutationObserver 记 `.uni-async-error` 出现时刻，生产两视口均为 20000–20003 ms。uni AsyncError 文案 `连接服务器超时，点击屏幕重试`（点击 = `location.reload`）；chunk 迟到仍会正常渲染（不需点击），"放行后不点重试自行渲染"是核心断言。
- 去重口径 = message 前 200 字符：同文档第二个页面超时（错题本分包）不会再上报 `vue:chunk-timeout`（`<info>` 都是 `https://vuejs.org/error-reference/#runtime-13`），但 console.error 仍每次 2 条（产品保留 console.error + 钩子重复观测）——不要把 console 计数当上报计数。
- **本机 Chrome → Cloudflare 的 h3 连接会真实出现 60–120 s 停滞**（R390 一次、R391 四次：`performance` entry `fetchStart` 比 `startTime` 晚 ~60 s，或 `duration≈121 s` 后失败 `nextHopProtocol` 为空；这些请求根本没到 Fetch 拦截阶段，`curl` 同资源 <100 ms）。它会让"正常路径 0 上报"回归在卷库/错题本步骤失真：产品会按设计出 20 s 超时 UI 并上报 1 条 chunk-timeout；chunk 失败还会追加 `vue:chunk-load: Unable to preload CSS for /assets/book-*.css` 与 `unhandledrejection: [object Object]`（真实 reason `{"errMsg":"setTabBarBadge:fail not TabBar page"}`，钩子要对 unhandledrejection 的对象 reason 做 `JSON.stringify` 才能事后定位）。如实按"严格口径 FAIL + 业务流程 PASS"报告，并在源站日志里以本机出口 IP（`curl ifconfig.me`）对账每条上报——**sendBeacon 上报不带 `X-Kg-Probe`**，只能靠 IP/时段区分。若要可比的零误报数据，可在录屏前对同一分包 `curl` 预热或改用 `--disable-quic` 启动 Chrome（未验证）。
- 上报后端反查：容器日志只有 `POST /api/monitor/report 200` access line（内容转发到 zalize-monitor，中心侧无权限 = untested）；Caddy 源站 JSON 日志 `/var/log/caddy/kaogong-origin.zalize.com-access.log` 有 `Cf-Connecting-Ip`/UA/`X-Kg-Probe`，用它数"今日命中数"并逐条对拦截器 `.log` 的 `wall` 时间戳。拦截器输出文件名别复用（同名覆盖会丢早期尝试，本轮 1 条只能靠 IP 归属）。
- DB 审计：每次分包挂起/停滞都会让该 uid 多 1 条 `growth_events slow_load(probe=1)`，本轮 20 行 = 6 answer_log + 2 mistakes + 12 growth_events（8 slow_load + keep/end×2）。
- 收尾坑：`restore_ls.py` 原来硬编码 r366 备份路径（已改为 `argv[1]`），恢复后一定 `localStorage.length` 与备份键数对照（30）；`Emulation.clearDeviceMetricsOverride` 在别的 session 设过 override 时可能不生效（innerWidth 仍 1440），先 `setDeviceMetricsOverride(width=0,height=0,deviceScaleFactor=0)` 再 clear 即回 1600。截图工具坐标 = 屏幕 1024×768 坐标系（不要按 0.5 缩放图再 ×2）。

## R390 `/tiku/q/<id>` JSON-LD（LearningResource⊃Question）生产复验 走查新经验（testing agent）

- **`_page(..., [jsonld, breadcrumb])` 输出的是「一个」`<script type="application/ld+json">`，内容是 JSON 数组**（`[LearningResource, BreadcrumbList]`），不是两段脚本。解析时先 `json.loads` 再 `list` 展平 / 对象包成 list，否则 `.get()` 会在 list 上炸。类型集合断言用「恰好 {LearningResource, BreadcrumbList}」，另外 grep 全文 `QAPage`/`answerCount`/`mainEntity` 作旧版指纹（4403c9c 及之前）。
- 页面上下文 `fetch(url,{headers:{'X-Kg-Probe':'1'},cache:'no-store'})` 一律带随机 `?v=`（CF 对 `/tiku*` ~300s 边缘缓存），并核对响应头 `x-edge-cache`/`cf-cache-status` 为 MISS/DYNAMIC；但 JSON-LD 里 `LearningResource.url` 必须**不含** `?v=`（服务端用 `_url(f"/tiku/q/{qid}")` 生成，与请求 URL 无关）——这是一条独立断言，别只看后缀。
- 选项对照：页面 `a.opt b` 文本是 `K.`，JSON-LD `suggestedAnswer[].text` 是 `K. 选项文本`，比 `text[0]` 与 `b.textContent[0]` 的序列即可；`acceptedAnswer.text` 以 `正确答案：X。` 开头后接解析截断 500 字。无 tag3 的题（如 qid 1046924）`about.name` 回落为模块名（`言语理解`），CTA 也无 `tag3=` 参数——可作 fallback 分支的在线样本。
- 外部校验：validator.schema.org 按 URL 校验无需登录，结果页顶部显示 `N ERRORS / N WARNINGS / N ITEMS`，右侧可展开类型树；Google Rich Results Test（浏览器已登录 Google）对该页会报「检测到 1 项有效内容 — 路径（Breadcrumbs）」而**不是**「未检测到项目」，因为 BreadcrumbList 本身就是富结果类型；LearningResource 不是 Google 富结果类型所以不出现，也不算无效。截图只截结果区避开右上账号。
- 375 卷库分包 `pkgA-exam-list.*.js` 可能出现 60 s 的 h3/QUIC 拉取停滞（`performance` resource entry `duration≈60014`, `transferSize 0`, 之后正常渲染 120 卷），期间页面只有 spinner、`/api/exam/papers` 尚未发出；此时 `curl` 同资源只需 ~70 ms。属客户端/网络瞬态，不是后端问题，但会伴随 1 条 `console.error(ErrorObject)`——钩子用 `JSON.stringify` 记参数时 Error 对象会变成 `"{}"`，钩子应改成 `a instanceof Error ? a.message+'\n'+a.stack : JSON.stringify(a)` 才能事后定位。
- 前端 `slow_load` 埋点：如果 prep/hook 过程中标签操作超时（首页加载被 CDP 阻塞），该 uid 会在 `growth_events` 多出一条 `slow_load(probe=1)`，DB 审计会从固定 12 行变 13 行；对照 `growth rows` 输出解释后正常清理即可。

## R389 `manifest.h5.title` 覆写 index.html `<title>`（SEO 首页标题）生产复验 走查新经验（testing agent）

- **原始 HTML 与挂载后标题是两个不同断言，必须分开取证**：原始 `<title>`/`og:title` 用不执行 JS 的方式读（`curl -s /` 或页面上下文 `fetch('/',{headers:{'X-Kg-Probe':'1'},cache:'no-store'}).text()` 后正则 `<title>([^<]*)</title>`）；挂载后用 `document.title`，uni-app 会在路由渲染时用 `pages.json` 的 `navigationBarTitleText` 覆盖（首页 `刷题`、`pkgA/exam/list` `真题卷库`、`pages/book/book` `错题本`），浏览器标签条上也能看到，截图时让标签文字入镜作为可视证据。坏形态：挂载后 `document.title` 仍等于 SEO 长标题（uni 标题覆盖丢失）或原始 `<title>` 只剩 `错题邦`（构建没吃到 `manifest.h5.title`）。
- `/tiku/*` 是后端 SSR，不受 uni 构建影响：`/tiku/` 应为 `公务员考试题库_行测真题在线刷题_错题邦`，`/tiku/q/<id>` 为 `<题干截断>_<模块>题库_错题邦`；在同一标签原生输入 URL 打开即可，`document.title` 就是 SSR 标题（无 JS 改写）。`/tiku/q/234080` 是稳定可用的在线 qid。
- App.vue 无障碍 `h1`（`offscreen` 属性）文本 == 当前路由标题（首页 `刷题`、错题本 `错题本`），练习页也是 `刷题`；用 `document.querySelector('h1').textContent` 读。
- 卷库对账：钩子只记状态码/耗时时，`items.length` 需在页面上下文再 `fetch` 一次页面自己用过的同一 URL（`/api/exam/papers?kind=zhenti&uid=<uid>`，带 `X-Kg-Probe: 1`），与 `.card.paper` 数比较（本轮两视口 120 == 120）。
- 每轮流程里同一个 `test-<round>-` 前缀双 uid（1440 `a…` / 375 `b…`）做完 3 题→保留→结束本组 + 错题本，DB 审计固定形态是 12 行：`answer_log 6（probe 全 1）+ mistakes 2 + growth_events 4（practice_quit_keep/practice_quit_end ×2）`，`practice_progress 0`（结束本组会删）。偏离这个数就说明有多余操作，先解释再清理。
- `cdp.C(tab_dict)` 接收的是 `/json` 里的整条 tab 字典，不是 `webSocketDebuggerUrl` 字符串。

## R388 管理台「候选真人」行 + `ops_status.crawlers.humans.direct_7d` 生产复验 走查新经验（testing agent）

- **期望值要按 JSON 自己推，不要抄 PR/用户给的数字**：`parse_crawler_stats` 取 `raw.days[-7:]` 求和（`today = days[-1]`），所以 `humans.direct` 里窗口外的日期（本轮 08-25）不计入；先 `cat /home/ubuntu/kaogong-reports/crawler-stats.json`（VPS，容器内挂 `/reports`）读 `generated_at` + `days`，再和页面自己那次 `/api/admin/ops_status` 响应对账。cron 可能重生成 / UTC 零点会滚窗口，执行时再读一次 `generated_at`，变了就重新推。
- 候选真人行渲染在 `#dash-ops` 的「搜索引擎抓取（源站日志，近 7 天）」面板，`.hbar.hbar-wrap > .lb`（首文本节点 `候选真人`，`.sub` 含 `未经边缘的源站直连`）+ `.tag`；`direct_7d==0` 时尾缀 `· 源站直连扫描 N（已剔除）` 整段不渲染（生产 52，无法在线观测 0 分支，报告要标 untested）。
- 375 判「逐字竖排」用 `.lb` 文本 Range `getClientRects().length ≤ 2` 且 `.lb` 高 ≤ ~44px（本轮 37px/1 rect）；坏形态是高 > 80px。卷库页 `right > 375` 元素非 0 是正常的（年份/地区 `uni-scroll-view overflow-x:auto` 横滑筛选条），要看其最近 overflow 祖先再下结论，页面级只看 `cw = sw = bsw = 375`。
- 容器日志里可能有一条部署侧 `GET /api/admin/ops_status 401`（容器启动后 1–2 min、无 token），不是复验流量；按时间戳与自己的开始时间比对后如实披露即可。
- 容器内 SQL 建议 `scp` 脚本 → `docker cp` → `docker exec python3`，ssh 单引号内嵌 heredoc + 双引号极易静默输出空；`answer_log` 没有 `qid` 列（读 `uid, probe` 即可）。含 uid 的表用 `pragma table_info` 自动枚举（当前 34 张）。
- 恢复 localStorage 时按 `t['url'].startswith('https://kaogong.zalize.com')` 过滤标签，不要用 `'zalize.com' in url`——测速站 `tool.chinaz.com/speedtest/kaogong.zalize.com` 这类第三方标签会被误写。

## R387 index.html 路由预加载（`scripts/route-preload.mjs`）生产复验 走查新经验（testing agent）

- **只有 `<script data-kg-route-preload>` 带标记，生成的 `<link>` 没有任何标记**。`document.querySelectorAll('link[data-kg-route-preload]')` 恒为 0，不能用它判断「注入了/没注入」。
- **stats 等非白名单路由「modulepreload 数为 0」按字面不可观测**：Vite 运行时 `__vitePreload` 会在入口模块执行后自己插 `link[rel=modulepreload]`（stats 最终 DOM 6 条）。正确判据：`Page.addScriptToEvaluateOnNewDocument` 装 `MutationObserver`（`observe(document,{childList:true,subtree:true})`，不要 observe `documentElement`——此时可能还不存在），把「入口 `<script type=module>` 出现前」插入的 link 记为 R387 注入；非白名单路由 pre-entry 应为 0 且 `link[rel=preload][as=style]` 为 0。白名单路由 pre-entry 数 == HTML 里 M 表该路由长度（home 18 / practice 16 / book 19 / team-join 6）。
- 并行证据看 Network 事件：`pages-home-home.*.js` 的 `requestWillBeSent` 时间 < `index-*.js` 的 `loadingFinished`（home 47 ms < 85 ms）；未注入路由呈串行（stats 分包 97 ms > index 结束 54 ms），可当「坏了」的对照形态。
- "preloaded but not used within a few seconds" 警告是**延迟**触发的：load 后至少再排 CDP 事件 ≥ 8 s 再读 console，否则漏判。
- 冷载捕获用 `Network.setCacheDisabled(true)` + 新标签，并在导航前预置 `localStorage.anonUid=test-rNNN-*`；否则第一次冒烟会给受保护 uid 写一条 `growth_events`（本轮 stats 冒烟写了 `heatmap_view probe=1`），只能披露不能删。
- 卷库真实路由是 `#/pkgA/exam/list`（首页「全真模考」入口），**`#/pages/exam/papers` 不在 pages.json**：文档内改 hash 到未知路由会空白（既有 uni-app 行为），冷加载则回落首页。写计划前先 `grep pages.json` 核对路由。
- 独立 Lighthouse：`CHROME_PATH=/home/ubuntu/.local/bin/google-chrome npx -y lighthouse@12 <url> --only-categories=performance --form-factor=mobile --chrome-flags="--headless=new --no-sandbox" --extra-headers='{"X-Kg-Probe":"1"}' --output=json`；约 1–2 min。`network-requests` 里 `/` 会出现 2 次（Document + 应用自身 Fetch）、`kaogong.svg` 2 次（Image + Other），属既有行为，去重断言只看 `.js/.css`。得分随宿主时段波动（部署脚本 0.99 vs 复采 0.92）。
- DevTools 端口是 **29229**（不是 9222），`cdp.C` 的方法是 `call(method, **params)`。

## R386 探针打标三路（网段 / `X-Kg-Probe: 1` / 自动化 UA）+ 看板口径起点

- **所有对生产 `/api/*` 写入行为数据的脚本请求一律带 `X-Kg-Probe: 1`**（curl `-H 'X-Kg-Probe: 1'`、Playwright `extra_http_headers`、CDP `Network.setExtraHTTPHeaders`），不要只靠出口网段——网段一换（AWS 54.x → 140.232.64.x 已发生过）历史上整月流量就混进「真人」。边缘 `[[path]].js` 原样复制请求头，无需改边缘。
- 三路判定在 `backend/app/auth.py::probe_request`：显式头 → `KG_PROBE_CIDRS` 网段 → `PROBE_UA_MARKERS`（python-urllib/python-requests/curl//wget//headlesschrome/playwright/httpx//go-http-client）。**GUI 浏览器（含 Linux Chrome、iPhone 模拟）UA 不会命中**，testing agent 的 GUI 会话仍依赖网段或显式头。
- 反例断言（证明真人不被误标）：非探针 IP + 小程序 UA `... wv) ... MiniProgramEnv/android` 或 iPhone Safari UA、不带头 → `probe=0`。
- 看板副标题 `.pagehead .sub` 新增「探针口径自 YYYY/M/D 起生效，此前行无法区分、按真人计」，日期来自 `dashboard.probe_since`（`MIN(created_at) WHERE probe IS NOT NULL`，生产预期 2026-09-04）；与 API 对账时注意 `toLocaleDateString('zh-CN')` 输出 `2026/9/4` 格式。

### R386 生产复验 走查新经验（testing agent）
- **显式头会话要独立 CDP 进程保活**：`Network.setExtraHTTPHeaders` 是 per-session，ws 一关头就没了。用 `/tmp/cdp174/holdhdr.py` 之类的 holder（`setsid nohup … &`，记 PID）持有；结束按 **PID** kill，不要 `pkill -f`（会误杀自身 shell）。
- **证明头真的发出去了**：不要只靠 SQL probe=1（本机出口在 `KG_PROBE_CIDRS` 内，网段路径同样会打 1）。另开一个 CDP 会话 `Network.enable` 后监听 `Network.requestWillBeSentExtraInfo`，读 `headers['X-Kg-Probe']`；注意用 raw 非 await 的 `Runtime.evaluate` 触发请求，否则 `C.eval` 会把事件消息吞掉。报告里「仅显式头」路径要如实标 untested，除非能从网段外出口发请求。
- **对账用页面自己那次 dashboard 响应**：`r374.HOOK` 把响应存在 `window.S.dash`，在页内算 `new Date(S.dash.probe_since*1000).toLocaleDateString('zh-CN')` 与 `.pagehead .sub` 正则 `探针口径自 (\d{4}/\d{1,2}/\d{1,2}) 起生效` 抓到的日期比对；不要另发 fetch（缓存 5 分钟，可能拿到不同快照）。
- **375 `.sub` 折 4 行（h ≈ 80 px）是正常整句折行**，判「逐字竖排」看 `.kpi .lb` 文本 Range 的 `getClientRects()` 是否 1 个矩形（题库健康度带徽章为 3 个矩形也是紧凑单行），而非看总高度。
- 用户侧 hook 导航后可能丢失（`hdr:false`），进入练习页后重新 eval `r383.HDR` 并用 `JSON.stringify(window.__hdr||[])` 校验；hook IIFE 无返回值，eval 返回 `None` 属正常。
- 期望落库口径：每个 uid 3 题 → `answer_log` 3 行 probe=1；保留进度 → `growth_events practice_quit_keep probe=1` + `practice_progress idx=3`；结束本组 → `practice_quit_end probe=1` 且 `practice_progress` 行被删。growth 事件在会话结束前查不到，先原生退出再读 SQL。
- 收尾 `Emulation.clearDeviceMetricsOverride` 单独调用有时不生效（innerWidth 仍 375）：先 `setDeviceMetricsOverride(width=0,height=0,deviceScaleFactor=0,mobile=False)` 再 clear，等 1 s 复查。
- 看板 `today.probe_excluded` 当天可能为 0（复验作答都是当天 probe=1 但缓存 5 分钟），`yesterday` 会显示前一轮复验条数；文案条件是「今日或昨日 > 0」即显示。

## R385 SEO 深链 → tag3+module 抽题（`idx_q_tag3_pick` 覆盖索引）生产复验 走查新经验

- **SEO 深链契约**（`backend/app/seo/pages.py`）：`/tiku/q/<id>` 页面 CTA `.cta.cta-w` 的 href 形如 `https://<base>/#/pages/practice/practice?qid=<id>&tag3=<tag3>&module=<module>&source=seo_q`；选项 `.opt` 会再加 `&pick=X`。复验必须**原生点击渲染出来的 CTA**（375 下常在首屏外，先原生滚动），不要自己拼 practice URL。
- **领跑题断言**：`frontend-uni/src/leadq.js` 的 `mergeLead` 把 `qid` 对应题插到池首，`practice.vue` 并行发 `/api/question/<qid>` 与 `/api/questions?limit=10&uid=…&tag3=…&module=…`。预期：头部 `1/11`（10 题池 + 领跑题）、提示语「刚才那题在这里作答，之后 10 题同考点练习」、`items[0].id === qid`。页面自身的 `window.__pc` 有时在导航瞬间为 undefined（`Cannot read properties of undefined`），此时退回 DOM/截图断言即可。
- **抽题池 TTL**：`_PICK_TTL = 600` s。同一 `(tag3, module)` 在 600 s 内的第二次请求是**缓存命中**，不能当冷 miss 证据。要拿冷 miss：换一个从容器启动起从未被请求过的 `(tag3, module)`，或等部署预热那条请求超过 600 s 再点。用 `docker logs -t deploy-kaogong-1 --since <StartedAt> | grep "tag3="` 列出所有 tag3 请求的服务端时间戳，判断每条到底冷还是热。
- **取样 id 不要走公网 API**：用容器内 SQL 选 `tag3/module` 样本题 id（走 `/api/questions` 会把池预热掉，冷 miss 就没了）。
- **生产库路径是 `/data/data.db`**（不是 `/data/kaogong.db`，后者没有 `questions` 表，会报 `no such table: questions`）。只读打开用 `sqlite3.connect("file:/data/data.db?mode=ro", uri=True)`。
- **索引断言**：`select sql from sqlite_master where name='idx_q_tag3_pick'` + `EXPLAIN QUERY PLAN` 应出现 `SEARCH questions USING COVERING INDEX idx_q_tag3_pick`。注意旧索引在启动迁移时已被 DROP，**同条件 old/new A/B 在生产不可得**，只能与历史报告里的 slow-req 数值做参照，报告里必须说明。
- **客户端耗时 ≫ 服务端耗时的判读**：`[slow-req]` 阈值是 3.0 s（`backend/app/main.py:214`）。若客户端计时 5 s 但日志无 slow-req，说明瓶颈在服务端之外——用 `top`/`vmstat`/`docker stats` 取宿主证据（本轮 I/O wait 81–88%、swap 活跃时同一 URL 客户端 5069 ms，而容器内同条件 SQL 仅 0.079 s）。这种样本要如实记为计时失败并给出成因证据，不能因为 EXPLAIN 正确就判通过。
- **`source=seo_q` 的落库证据**：`answer_log.source='seo_q'`、`growth_events.source='seo_q'`；测试机出口网段会被标 `probe=1`（不计入用户指标）。清理脚本按 `uid like 'test-r385-%'` 删，读回时顺带核 `seo_q rows left 0`。
- **杀 holder 的自杀陷阱（再次踩到）**：`pgrep -af holdvw | grep python | xargs kill` 会匹配到调用它的 `bash -c` 自身而杀掉当前 shell（exit −1）。用 `ps -eo pid,args | grep "[h]oldvw" | grep -v "bash -c"` 拿 PID 再显式 kill。
- **管理台登录**：`cdp.pick()` 会排除 `/admin` 标签，用 `r374.pick_admin()`；令牌用 native setter 写 `#login-token`（`i.value=…` + `dispatchEvent(new Event('input',{bubbles:true}))`，绝不打印），再原生点「登录」。判断已登录看 `#dash-ops .hbar-wrap` 是否存在。`r383.install(s)` 需要带 `.c` 的 `S()` 会话对象；直接用 `C` 时手动 `call('Page.addScriptToEvaluateOnNewDocument', source=HDR)` + `eval(HDR)`。
- `cdp.C.eval(js)` 不支持 `await_promise`，异步取数要写成 `window.__x=null; fetch(...).then(...)` 再 sleep 后读 `window.__x`。管理台自查 dashboard 数值：`fetch('/api/admin/dashboard',{headers:{'X-Admin-Token':localStorage.admToken}})`，与 UI「在库/差评/待纠错/待审/下架存量」逐项比。
- 容器重启一段时间后管理台缓存头可能是 `X-Kg-Cache: stale` 而非 `cold`/`hit`（本轮 stats 690 ms stale、dashboard 221 ms stale），照实记录即可。

## R384 管理台 dashboard flagged COUNT 改写 + 「运维状态」/「LLM 通道」`.hbar-wrap` 生产复验 走查新经验
- **冷缓存窗口取证顺序**：容器重启后先 `docker logs deploy-kaogong-1 --since <StartedAt> | grep -c /api/admin/` 确认为 0，再登录管理台；登录后用 `docker logs -t | grep -E "/api/admin/(stats|dashboard|ops_status|llm_health)"` 拿服务端时间戳，与页面钩子的 `X-Kg-Cache: cold` + ms 互证（本轮 stats→dashboard 服务端间隔 0.3 s）。若头为 `hit`，用同一条 grep 找出是谁先访问（预热/其他人）。
- 修复后的 dashboard 冷访问已 ~0.3 s，登录页「验证中…」几乎不可见；但 `/api/admin/ops_status`、`/api/admin/llm_health` 仍没有 `X-Kg-Cache` 头，只记 ms。
- 看板 health 卡片 `差评 N` 对应 `dashboard.health.flagged`；生产当前 flagged=0，`COALESCE(disabled,0)=0` 与旧 `OR` 谓词数值上无法区分，报告里只主张「UI==API」+ 性能差，不要声称验证了谓词等价。
- 「运维状态」`tag(it,label)` 的「无记录」分支（`tag-gray`）在生产里通常不出现（每行都有记录），只能代码层面确认 `hbar-wrap`，报告归「未测」。
- 375 `.hbar-wrap` 量测复用 R383 方法；长 tag 换行后的行高 43（单行 tag）/60（双行 tag）属正常，与「逐字竖排」（`.lb` 高 90+、`.sub` 多个窄 rect）区分。
- **`kill $(pgrep -f "holdvw.py 375")` 会把当前 bash -c 自己也匹配上并 kill（exec 返回 -1）**：先 `pgrep -af holdvw | grep python` 看 PID，再 `kill <pid>`；同理 `pgrep -af x | grep -c python` 会把 bash -c 自己算进去，用 `ps -eo pid,args | grep "[h]oldvw"` 验证。
- admin 与用户标签页同源共享 localStorage：`admToken` 可能在用户侧 `localStorage.clear()`/恢复备份时被一并清掉，收尾时 `!!localStorage.admToken` 为 false 不代表异常，仍要恢复备份并核 `anonUid`。
- 用户侧「首页 → 言语理解 → 全部随机 → 3 题 → 退出 → 保留进度」最短回归：375 下专项练习列表在 scroll 10 格左右，「言语理解」卡 y≈215；题型弹层第一项「全部随机」；答对自动跳下一题，答错需点右下「下一题」；退出按钮在题头右上 `退出`；弹窗文案 `已做 N 题 · 答对 R · W 道进错题本`。预期 DB 行：answer_log 3、mistakes=错题数、growth_events 2（boot + practice_quit_keep）、practice_progress 1（idx=3）。

## R383 questions 索引 + 管理台 `.hbar-wrap` 行折行修复 生产复验 走查新经验
- **`X-Kg-Cache` 头（cold/hit/stale）只在 `/api/admin/stats|dashboard|governance` 设置**（admin_api.py `response.headers["X-Kg-Cache"]=state`）；`/api/exam/papers`、`/api/questions` 等用户端接口没有这个头，只有 Cloudflare 的 `cf-cache-status: DYNAMIC`。被要求「记录 X-Kg-Cache」时先 grep 代码确认接口是否设头，没有就如实报「无此头」，别当缺陷。
- 页面自有 fetch/XHR hook 记响应头：在 `fetch` 包装里 `r.headers.get('x-kg-cache')`/`cf-cache-status` 即可（服务端未加 `Access-Control-Expose-Headers` 也能读，因为同源）；XHR 用 `getResponseHeader`。`/tmp/cdp174/r383.py install(tab)` 已实现，记录 `[url,status,ms,xkg,cf]`。
- **管理台冷访问很慢**：首次登录 `/api/admin/stats` ~1.4 s cold、`/api/admin/dashboard` ~11.5 s cold（容器日志 `[slow-req] 11.3s`），期间登录页停在「验证中…」——等 15 s 以上再断言 dashboard DOM；二次 `dashboard` ~3 s `hit`。
- **判断「逐字竖排」修复的量测法**（对 `#dash-ops .hbar` 行）：`row.classList.contains('hbar-wrap')` + `getComputedStyle(row).flexWrap==='wrap'`；`.lb` 宽 ≥150 且高 ≈19（一行）；`.sub` 文本用 `Range.getClientRects()` 数行数、取最窄 rect 宽（修复前 minW≈12 即单字/行，修复后 ≥90）；tag 是否换行看 `tag.top >= lb.bottom-2`（短 tag 如 Baidu「0 次」允许同行）；再加 `documentElement.scrollWidth<=375` 与 `#dash-ops` 后代 `right>375` 计数 0。1440 无劣化：行高 ≈21、`|lb.top-tag.top|≤4`、`tag.right==panel.right`。
- 「运维状态」面板里其他行（每日备份上传 R2 / R2 副本周验证 / 宿主内存水位）**没有** `.hbar-wrap`，375 下 `.lb` 仍只有 43–49 px 宽、日期折 3 行——属既有现象，报告为观察而非本 PR 回归。
- 切换管理台 tab 视口：先 `pgrep -f "holdvw_admin.py 375"` 按 PID kill，再起 `holdvw_admin.py 1440 900`，`Page.reload` 后 `#login-token` 元素仍在 DOM（隐藏），要用 `#dash-ops .hbar-wrap` 是否存在判断已登录。
- 用户 tab 用 `r374_console.py user` 会 reload 页面 → 页面自有 hook 记录清零；先 `S.apis()` 汇总再跑 console 捕获。
- localStorage 备份 `/tmp/r383_ls_backup.json` 可能是被 JSON.stringify 两次的字符串：`bk=json.load(f); if isinstance(bk,str): bk=json.loads(bk)`，否则 `.items()` 报错且此时 `localStorage.clear()` 已执行——务必先解析再 clear。
- 1440 「去继续」断言：练习页表头 `常识判断 · 3/N`、`已答 2/N · 正确 R`，`__pc` 状态 `idx=2, picks=[..两项..], picked=''`；结束用「退出 → 结束本组」发 `progress {qids:[]}` + `track practice_quit_end`。
- 清理脚本 `/tmp/r383_clean.py` 由 `r382_clean.py` sed 改前缀得到，`docker cp` 进容器后 `ro` 审计 → `clean` → 回读 `LEFTOVER 0`，并 `rm` 容器内与宿主机 `/tmp` 副本。

## R382 卷库覆盖索引 + 管理台「搜索引擎抓取」真人行 生产复验 走查新经验
- **「卷库」UI 用的是 `/api/exam/papers?kind=zhenti&uid=`（exam_papers 表，~120 卷），不是 `/api/papers`（questions 表 src/paper 聚合，~26 条）**。`/api/papers` 只被 `practice.vue openPapers()` 调用且模板里没有调用者，UI 无触发路径；验证「/api/papers 相关索引」时：① 容器内 `EXPLAIN QUERY PLAN` 断言 `USING COVERING INDEX idx_q_paper_src`，② 从页面上下文 `fetch('/api/papers')` 单独计时，③ UI 卷数应与 `/api/exam/papers` items 数比对。别把「UI 卷数 == /api/papers 条数」当断言。
- 按卷练习入口：首页「更多练习 → 真题卷练习」→ `#/pkgA/exam/list` → 卡片「按卷练习」→ `GET /api/paper_questions?src=&pid=&uid=`；答 N 题后「退出 → 保留进度」是 navigateBack 回卷库列表（卡片立刻显示「已练 N/M 题 · 错 W 题」），需再点左上返回/首页 tab 才看到续练卡；`practice_progress.idx` 是当前题下标（停在第 2 题未点下一题时 idx=1），续练卡「已做 N/M」按 picks 数算。
- 换 uid 后首页「专项练习」各模块的已练数/正确率仍显示上一个 uid 的值（`loadPStats` 走 localStorage、非 uid 维度），不是 bug，别误报。
- 管理台「真人」行断言：hook 页面自身 `/api/admin/ops_status`（或用 `localStorage.admToken` 作 `X-Admin-Token` 再 fetch 一次），`h=crawlers.humans`，期望字串 `` `API ${h.api_7d.toLocaleString()} 次（今日 ${h.api_today}）· 页面 ${h.page_7d} · IP 日去重 ${h.ips_7d}（今日 ${h.ips_today}）· 5xx ${h.api5xx_7d}` `` 与 `#dash-ops .hbar` 中 `.lb` 以「真人」开头那行的 `.tag.innerText` 逐字比对；`tag-ok` 当 `api5xx_7d==0 && api_7d>0`。`crawlers` 的键是 `generated_at/stale/window_days/engines[]/humans`，`engines[]` 字段 `name/hits_7d/hits_today/err5xx_7d/tiku_7d/sitemap_7d/last_seen`。crawler-stats.json 会在部署后重新生成，用户口头给的数值可能过期，以页面自身接口为准并注明 `generated_at`。
- 375 管理台溢出检查：`documentElement.scrollWidth/clientWidth/body.scrollWidth` 三者 ==375 + `#dash-ops` 内 `getBoundingClientRect().right>375` 的节点数 ==0。注意「无横向溢出」不等于排版正常：`.hbar .lb` 标签列在 375 下很窄，长副标题会逐字竖排（真人行 316px 高），要截图报观察项。
- 管理台登录点「登录」后按钮会停在「验证中…」直到 `/api/admin/stats` 返回，该接口生产可到 10–15 s（`[slow-req]` 日志）；等待时用 `performance.getEntriesByType('resource')` 看 `/api/admin/*` 的 duration/responseStatus，别误判登录失败重复点击。
- `Page.captureScreenshot` 直接用 `C` 类时结果在 `r['result']['data']`（不是 `r['data']`）；`Sess.shot()` 已封装。`pgrep -f "holdvw.py 375 812"` 会同时匹配到启动它的 `bash -c` 包裹进程，杀 holder 前用 `ps -o pid,cmd -p` 过滤出 python 那个 PID。
- 客户端 `/api/questions?module=yanyu` 有时 4–5 s（同时段 home_bundle 2.9 s、exam/resume 2.7 s），服务端未必记 slow-req；报告里区分「客户端计时」与「容器日志 slow-req」。

## R381 index.html 隐藏 SEO 导航（`#kg-seo-nav`）+ 资料分析 grouped 拉题 + 同材料题组 SSR 生产复验 走查新经验
- 「挂载前 splash 盖住 / 挂载后 CSS 隐藏」这类断言，生产正常加载太快看不到 splash；用 CDP `Fetch.enable(patterns=[{urlPattern:'*index-*.js*'}])` 暂停 bundle 请求（`/tmp/cdp174/r381_cold.py`），在暂停期读 `#app.matches(':empty')`、`getComputedStyle(nav).display`（此时应是 `block`）、splash `position:fixed` rect 覆盖视口、`elementFromPoint(nav中心)` 落在 `#kg-splash` 内；`Fetch.continueRequest` 后再断言 `display==='none'`、`nav.getClientRects().length===0`、`document.body.innerText.includes('行测题库')===false`（innerText 排除 display:none，`textContent` 不排除，别混用）。判 `#app` 空用 `matches(':empty')`/`childElementCount`，`innerHTML===''` 会被注释干扰。
- 挂载前导航在正常流里有高度（1440≈57px、375≈82px），文档可滚动这一点 splash 遮不住 —— splash 是 fixed 所以仍盖住，但「任何滚动位置都看不见」不能做成绝对断言，报告里要写成已观察/未穷举。
- 布局稳定：`addScriptToEvaluateOnNewDocument` 里放 `PerformanceObserver({type:'layout-shift',buffered:true})` 累计 `value` 并记 `sources` 节点，断言 nav 相关 shift=0；生产首页 CLS 本身约 0.05–0.07（`::after`/`.hero-acts`/`.card`），不是本轮引入。
- 负对照要留截图：`nav.style.setProperty('display','block','important')` 后 `scrollTo(0,scrollHeight)` 再截图，然后 `removeProperty`；先截图再 revert，否则截出来和正常底部一模一样（本轮第一张负对照图 md5 与正常图相同，作废）。
- 资料分析 grouped 请求只在 `module==='ziliao' && !submodule && !tag3 && !realMode` 时加 `&grouped=1`：首页点「资料分析」会先弹题型 sheet，必须选「全部随机」；选具体题型会带 `submodule` 而无 grouped。断言 `__pc.items` 的 `material_hash` 连续成段、`group_seq` 为 `1/K…K/K`，DOM `.grp-tag` 文案 `同材料题组 i/K`。
- 同材料 SSR 页 `/tiku/q/N?v=<rand>`：`h2` 文本 `同材料题组（共 K 题）`、`li b` 为「本题」、其他 `li a[href^="/tiku/q/"]`；找样例可在容器 DB `select material_hash,count(*) from questions where module='ziliao' and disabled=0 and material_hash is not null group by 1 having count(*)>=2`。
- `S381.apis()` 返回 `(method,status,ms,url,body)` 五元组，过滤 URL 用 `a[3]`；helper 里 `api` 列表属性与 `api()` 方法同名会报 `'list' object is not callable`。
- 「导航不可见」别用 `body.innerText.includes('行测题库')`：首页 hero 卡文案含「10万+ 行测题库」会误判；改断言 nav 每个 `a.getClientRects().length===0` + 拼接的 nav 序列「行测题库言语理解判断推理…」不在 innerText 中。收口后（#600）挂载前应满足 `scrollHeight<=innerHeight` 且 `scrollTo(0,99999)` 后 `scrollY===0`。
- `hold_restart.sh` 的 `pgrep -f "^python3 -u"` 匹配不到 pyenv 全路径进程，不会杀旧 holder 且 pid 文件为空；换 1440↔375 时用 `pgrep -af "[h]oldvw.py"` 取 pid 显式 kill。
- 本机 `urllib` 直连 `/api/health` 会 403（无 UA 被 WAF 拦），用 `curl -A 'Mozilla/5.0'`。容器日志查 5xx 用 `grep -E '" 5[0-9]{2} '`，裸 ` 5[0-9]{2} ` 会命中 `[indexnow] submitted 533 urls` 之类。

## R380 练习中途「退出」保留进度弹窗（uni.showModal + practice/progress + /api/track 埋点）生产复验 走查新经验

- **纯前端 PR 也要核后端白名单**：`trackEvent()` 静默吞错，新事件名（如 `practice_quit_keep/end`）若不在后端 `/api/track` 白名单会 400 而 UI 毫无异常。复验埋点时不能只看 UI，要在页面 hook 里断言 `POST /api/track` 的 status，且到容器里 `select event,count(*) from growth_events where event like 'practice_quit%'` 回读。本轮 d702472 上即因此 400，热修 4584019 后才落库；报告里要区分「热修前 UI 证据」与「热修后埋点证据」。
- **弹窗断言**：`uni-modal` 标题在 `.uni-modal__hd`、正文 `.uni-modal__bd`、按钮 `.uni-modal__btn`（左 cancel=`结束本组`，右 confirm=`保留进度`）；`getComputedStyle(m).display!=='none'` 判可见。375 下弹窗 rect 37.5–337.5、标题两行换行属正常不是截断。全对分支标题精确 `已做 1 题 · 答对 1`（无尾句）。
- **凑「≥1 错」**：SSR 页 `details.ans` 的 textContent 含正确答案，点一个不同的 `a.opt` 即 `pick=错项`；第二题答对会 ~2 s 自动跳下一题，正好到 idx 2 未答态再点退出。
- **保留 vs 结束 的请求特征**：保留 → 同一批（<100 ms）出现 `POST /api/practice/progress`（含 qids/picks/idx/right/streak）+ `POST /api/track practice_quit_keep`；结束 → `progress {uid,qids:[]}` + `practice_quit_end`。两者都 `source` 随 `_source`（seo_q）。首页续练卡文案 `有一组未做完的练习 | {模块} · 已做 N/M 题 | 去继续 › | ✕`，用 `className.includes('ercard') && innerText.includes('未做完的练习')` 定位。
- **续练断言**：`__pc.idx===2`、`items[i]._picked` 保留、`right` 不清零、`picked===''`；URL 变成不带 query 的 `#/pages/practice/practice`。结束后 `ppClearedAt` 会让首页 30 s 内跳过 GET resume，卡消失靠本地状态。
- **同 document 证据**：进练习页后 `window.__mark380=Date.now()`，退出到首页后 mark 仍在 + `performance.getEntriesByType('navigation')[0].type==='navigate'` = 未 reload；`history.length` 只在 SEO 深链退出时 +1（switchTab），站内 navigateBack 不变。
- **模考回归**：迷你模考是 `/pkgA/exam/exam?mini=1` 独立页，不经 practice.vue `quit()`；抽查用页头返回即可，会留下 `exam_attempts/exam_progress` 各 1 行（首页出现「有一场未交卷的模考」卡），清理脚本要覆盖这两张表。
- **清理**：`growth_events` 列是 `created_at`（无 `ts`）；lead 烟测用的 uid（如 `utest_r380_wl`）也要加进 pats。本轮 17 行：answer_log 7 / growth_events 6 / mistakes 2 / exam_attempts 1 / exam_progress 1。
- **热修重部署后容器 StartedAt 会变**（15:31→15:41）但 RestartCount 仍 0，对照 `kaogong-reports/deploy-history.log` 与 `container-events.log` 判断是部署替换而非崩溃。
- **切换 1440↔375**：先 `kill <holder pid>`（`pgrep -af "[h]oldvw.py"` 取 pid，kill 单独一条 exec），再启另一个 holder；375 下屏幕坐标 ≈ (vx×0.64, 60+vy×0.64)。清仿真要先 `setDeviceMetricsOverride(1600×900, mobile=false)` 再 `clear` 才能回 innerWidth 1600。
- **共享 worktree 禁止 `git checkout origin/<branch>`**（会 detached HEAD），lead 的本地分支即最新代码。

## R379 SEO 题目页「选项即作答」+ 练习页 lead 提示条 / pick 自动判分 / 答错滚动 / 深链退出 生产复验 走查新经验
- SSR 新版式断言（`/tiku/q/N?v=<rand>` 绕边缘缓存）：`a.opt[rel=nofollow]` ×4，href 末尾 `&pick=A..D`；`p.meta` 文案精确比对；`a.cta.cta-w` 必须在 `details.ans` 之前（比 `compareDocumentPosition`），`details.ans.open===false`；**闭合 `<details>` 的 `innerText` 不含隐藏内容**，判「正确答案」在里面要用 `textContent`，判首屏不露答案才用可见文本/截图。无 tag3 的题没有「更多「××」考点题目」链接，属正常分支。
- 375 首屏深度用 `getBoundingClientRect().top` 记 CTA 位置并与上一轮取证值对比；底边可能略超 812（题干 3 行时 815），报告写清楚而不是判 fail。
- 练习页 lead 提示条 `.lead-tag` 只在 `idx===0` 渲染；`__pc.leadHint` 字符串在切到第 2 题后仍保留（只是不渲染），断言要看 DOM 而非 vm 字段。N = `items.length-1`，同考点题少时可能是「之后 1 题」。
- `pick=X` 自动作答：断言 `__pc.picked===X`、`autoTimer===false`、等 ≥4 s `idx` 仍 0；hook 里 `POST /api/answer_log` `items[0].picked/source`，答错还应看到 `POST /api/mistakes`。不带 pick 时 `picked===''`。
- 答错滚动（`revealAfter`）量化：`.after` rect.top+220 ≤ innerHeight−150（375 时 `.after` top 应 ≈442）、`scrollY>0`，并取「正确答案」`uni-text` top 与底栏（`position:fixed` 且含「正确答案」的 `uni-view`）top 比较；1440 高 900 时不会触发滚动，不要在 1440 断言 scrollY。
- 深链退出（F11）证明「同 document 无 reload」：点退出前 `window.__mark=Date.now()`，退出后标记仍在 + `performance.getEntriesByType('navigation')[0].type==='navigate'` + `history.length` 变化符合（switchTab 时 +0/+1、navigateBack 时不变）+ 首页「今日已练 N/20」不为 0。浅栈（新标签直开/SSR 点过来）走 `switchTab`，站内进入走 `navigateBack` 且首页滚动位置保留。
- 新标签直开深链时，CDP 视口 override 不会跟过去（回到窗口原生宽），要对新 tab 单独 `setDeviceMetricsOverride`；`Sess()`/`pick()` 默认选到第一个 zalize tab，多 tab 时用 `tabs()` 按 URL 片段（如 `qid=4641`）挑。做完关掉新 tab 再继续。
- 杀 holder 别用 `pkill -f holdvw` / `pgrep -f`（会匹配到自己的 bash 并把当前 exec 命令杀掉，exit -1）；用 `pgrep -af holdvw.py | grep -v pgrep` 拿 PID 再 `kill <pid>`，或写成脚本 `/tmp/cdp174/hold_restart.sh W H mobile`。
- `practice_progress` 没有 `source` 列（source 在 POST 体里但表结构不同），清理脚本别 select 它；本轮退出后该表已无测试 uid 行。`vibrateShort:fail` 是桌面 Chrome 的 uni API 平台 rejection，会进 `unhandledrejection` 列表，报告里单列。
- 恢复 localStorage 备份：`/tmp/r3xx_ls_backup.json` 是双重编码字串，`d=json.load(f); d=json.loads(d) if isinstance(d,str) else d`，否则会喷 8 万个单字符键并让站点新 mint 一个 uid。

## R378 SEO 题目页 CTA 直达同题（`?qid=` lead 题）生产复验 走查新经验
- 部署身份先核再录：并发部署会覆盖生产（本轮 `23cd5c5` 被另一会话的 `fef41da` 覆盖后重部署为 `0b6ef09`）。开录前、换视口前、收尾时各 `curl /api/health` 一次，rev 变了立刻停下问 lead；报告里写实际复验的 rev，不照抄任务描述。
- Cloudflare 对 `/tiku*` 有 ~300s 边缘缓存：SSR 页 CTA 可能公网还是旧文案而源站（VPS `curl -H 'Host: kaogong.zalize.com' http://127.0.0.1:8300/tiku/q/N`）已是新的。判定用源站 + 等缓存过期后公网复核，不要把旧 CTA 当回归；换题或加 `?v=<rand>` 也可绕过。
- 找「无 tag3」在线题：容器内只读 `select id,module from questions where disabled=0 and (tag3 is null or tag3='') and module='yanyu' limit 5`；CTA 断言 `a.href.includes('tag3')===false` + 文案精确 `在线做这道题（免费）→`。
- lead 题验证三件套：fetch hook 里同时看到 `GET /api/question/{qid}`（200/404）与 `GET /api/questions?…`（是否带 tag3）；`/tmp/cdp174/find.js` 找到 practice 组件 → `__pc.items[0].id===qid`、`ids.length===new Set(ids).size`（去重）、`__pc._source==='seo_q'`；再对照 SSR `<h1>`/正文前 40 字。10 题包 + lead 不重叠时 `n=11`，同考点题少时可能只有 `n=2`。
- 非法 qid：`qid=abc` 的断言是 **没有** `/api/question/abc` 请求（`leadQidOf` 只接受正整数）；`qid=999999999` 会在浏览器原生 console 留一条 `Failed to load resource … 404`（资源级，非应用抛错），应用级用 `window.onerror/unhandledrejection` 监听器 + `uni-modal/uni-toast` 为空判「无报错」，报告里把这条 404 单列为预期观察项。
- `POST /api/answer_log` 体为 `{uid, items:[{qid,module,submodule,correct,secs,picked,source}]}`，`source` 在 items 元素内；容器 DB 侧查 `answer_log where source='seo_q'` 对账 uid/question_id/probe=1。清理仍按 `test-r378-%` 遍历 uid 列（本轮命中 answer_log/mistakes/practice_progress）。
- 375 CTA 断言：`a.scrollIntoView({block:'center'})` 后取 rect，`right<=375 && bottom<=innerHeight`；原生点击时屏幕坐标 = 页面坐标 + 内容区顶部偏移（本机 ≈57px）。错选一题（选非正确项）可避免答对自动跳题，便于截解析区。

## R377 管理台「搜索引擎抓取」面板 + 迷你模考进入/退出 生产复验 走查新经验
- 面板选择器：`#dash-ops` 内标题文本「搜索引擎抓取（源站日志，近 7 天）」之后的 `.hbar` 行，每行 `.lb`（引擎名 + `.sub` 「最近 …/从未」）与 `span.tag.tag-bad|tag-warn|tag-ok|tag-gray`；底部 `统计生成于 <ISO>`，颜色对照 `getComputedStyle(document.documentElement).getPropertyValue('--t4'|'--error')`（生产 `#6E7280` / `#B91C1C`）。与接口对账用页面自身的 `/api/admin/ops_status` fetch hook（`/tmp/cdp174/r377.py`），不要另开 curl —— crawler cron 每小时 :23 刷新，任务描述里的参考值很可能已过期（本轮 Google 由「从未」变为有抓取），报告要按截获的 JSON 写，并把未触发的分支（`从未`/stale/null）列为未验证。
- 迷你模考只读进入/退出：首页「更多练习 → 迷你模考」卡 → `POST /api/exam/start {uid,mini:true}` + `POST /api/exam/progress`，会在 `exam_attempts`（`submitted_at=NULL`）与 `exam_progress` 各落 1 行；页头返回箭头（`uni-page-head` 左侧 svg）退出不交卷，回首页出现「有一场未交卷的模考」横幅。清理按 `uid like 'test-…%'` 删这两表即可（`exam_progress` 列：attempt_id, uid, picks, idx, updated_at, marks, secs, excl）。
- 生产容器 DB 只读/清理脚本：本机写 py → `cat | ssh 'cat > /tmp/x.py && docker cp /tmp/x.py deploy-kaogong-1:/tmp/ && docker exec deploy-kaogong-1 python3 /tmp/x.py'`，先 `ro` 再 `clean`，遍历所有含 uid/from_uid 列的表统计 LEFTOVER。
- SSH 变量 `TICKETS_VPS_SSH_HOST/USER/CREDENTIAL` 已在 shell 环境里，直接 `sshpass -p $TICKETS_VPS_SSH_CREDENTIAL ssh …`；不要用 exec 的 `env: secret:org:…` 绑定（该引用不存在会被拒绝）。
- `Emulation.clearDeviceMetricsOverride` 后 innerWidth 可能仍是 375 直到原生导航；若导航后仍窄，再 `setDeviceMetricsOverride(width=0,height=0,deviceScaleFactor=0,mobile=False)` + clear 一次即恢复 1600。

## R376 种子题去重键（seed_index/seed_runs，零前端）生产复验 走查新经验
- 分享页真实链接是 `https://kaogong.zalize.com/s/<sid>`（服务端 landing → `#/pkgA/share/share-q?sid=<sid>`）。share-q 读的是 `query.sid`，**不是** `id`；用 `share-q?id=…` 会得到「分享链接无效」的空 sid 分支，误判为 bug。「不存在 id 的文案页」用例用 `/s/<不存在的sid>` 才命中 404 分支。
- sid 取法：解析区原生点击「🔗 分享给队友」→ 在 fetch hook 里截 `POST /api/share/create` 响应（`reqs()`），或事后只读查 `shared_questions WHERE from_uid LIKE 'test-…%'`。清理时 `shared_answers` 的外键列叫 `share_id`（不是 `sid`）；sqlite 脚本中途抛错则整段未 commit，重跑前先看 BEFORE 计数。
- 验证「在线种子题一定被出题」：在容器只读 sqlite 里找 `seed_index` 映射且 `disabled=0`、且 `(module,tag3)` 组内在线题数很少（如 2 条）的题，用 `#/pages/practice/practice?tag3=<tag3>&module=<module>` deep link，运行时 `window.__pc.items` ids 必须 ⊇ 这些 id（`/tmp/cdp174/find.js` 找 Vue proxy）。验证「下线种子题不出题」：搜索页 `#/pkgA/search/search` 输入题干片段（CJK 用 CDP `Input.insertText`，xdotool type 中文不进 input）→ `/api/search` 0 结果 + 正向对照另一在线题片段有结果 + DB `disabled=0 AND question LIKE` 计数 0。
- seed 指纹短路的生产证据：`seed_runs.ran_at` < 容器 `StartedAt` 且重启后不变；`seed_index` 全量 join `questions` 无悬挂；`import_batch='seed'` 字段历史上只有个别行，报告要写成「部署后新增 0」而不是「种子题总数」。
- 清仿真后 `innerWidth` 若仍是旧 override 宽度（ow 1600 / iw 1440），原生导航一次页面即恢复；再核对 `iw==ow`。

## W3 集成本地验收（uvicorn + build 产物同源）走查新经验
- 本地后端 `DB_PATH=<tmp>/app.db IMPORT_TOKEN=xxx KG_BOOT_QUIET_S=0 uvicorn app.main:app --port 8765`（在 backend/ 下）会自动挂载 `../frontend-uni/dist/build/h5`，刚 `npm run build:h5` 的产物直接从 `http://127.0.0.1:8765/#/...` 打开，同源无需另起 vite preview 也无 CORS；Playwright over CDP（`chromium.connectOverCDP('http://localhost:29229')`）先 `localStorage.setItem('anonUid', 'test-w3-…')` 再 goto 报告页即可读到造数。
- 模考造数：`POST /api/exam/start {uid, mini:true}`（不是 `mode:'mini'`）→ `POST /api/exam/submit {uid, attempt_id, picks, secs}`，`picks`/`secs` 以 **1-based 题号字符串**为 key（不是 question_id），否则全部判未作答；报告 `GET /api/exam/report/{attempt_id}?uid=` 的 `attempt.per_module[mod]={n,answered,correct,secs}`。
- 周界/时间戳类断言：`t` 用毫秒且落在 30 天窗口内（`_client_ts` 超窗回退 now，构造过久的日期会「看似无效」）；周键对照用 `datetime.fromtimestamp(t, CST).strftime('%Y-%W')` 与 UTC 版比较，两者不同才是有效样本（周一 00:00–08:00 CST）。
- 内容清洗脚本预演：复制 WAL 模式库不要 `cp app.db`（会丢未 checkpoint 写入，出现「dry-run 有命中、apply 副本 0 命中」假象），用 `sqlite3.connect(src).backup(dst)`。
- 配速新旧对照：把 `src/exam-pace.js` 与 `git show origin/main:frontend-uni/src/exam-pace.js` 各存一份 `.mjs`，喂同一份 per_module JSON 跑 node，即可无 UI 复现「整模块未作答标偏快」。

## R374 管理台看板复验（探针剔除量外显 / 零前端）走查新经验
- 管理台登录：token 用 `docker exec deploy-kaogong-1 printenv ADMIN_TOKEN`（SSH），在 shell 里只 `echo ${#T}` 长度、通过 `KG_T` 环境变量传给 python，再用 CDP `Runtime.evaluate` 给 `#login-token` 赋 `value` + `dispatchEvent(new Event('input'))`，然后**原生点击**「登录」；token 存 `localStorage.admToken`，结束用 `localStorage.removeItem('admToken')` 退出（不点「退出登录」也可，避免 reload）。
- `cdp.pick()` 排除 `/admin` 标签页，管理台要用 `/tmp/cdp174/r374.py` 的 `pick_admin()`；375 仿真同理要用 `holdvw_admin.py`（复制 holdvw.py 改 pick）。管理台与用户端各自一个 holder，用各自 pid 文件杀。
- 「console 0 error」要**从 reload 开始**采集：hook 只能抓注入之后的错误。用 `/tmp/cdp174/r374_console.py admin|user N` —— 开 `Runtime/Log/Network` 域后 `Page.reload`，收 `consoleAPICalled(type=error)`/`exceptionThrown`/`Log.entryAdded(level=error)` 及 `/api/` 响应状态 N 秒。管理台与用户端首页在 1440/375 载入均 0 error 0 warning 可作为基线。
- KPI 与接口对账：接口有 5 分钟缓存，不要另开 curl 比对，直接在页面 fetch hook 里 `res.clone().json()` 截获页面**自己**那次 `/api/admin/dashboard` 响应（`window.__r374.dash`），与 `.kpi .v` 文本比。dashboard 的 DOM 选择器：`.pagehead .sub`（副标题）、`.kpi .lb`/`.kpi .v`、`.kpi .lb .tag-gray`（真人 tag，title=已剔除探针流量）。
- 375 溢出判读除 `clientWidth===scrollWidth` 外，再扫 `body *` 中 `getBoundingClientRect().right > clientWidth` 且可见的元素列表（应为空），并记录 `.pagehead .sub` 高度/行高 ≈ 行数证明换行。管理台 ≤767px 时 `.pagehead{flex-wrap:wrap}`、`.kpis minmax(140px)`，375 下 KPI 卡为单列（left 76 / right 363）。
- 本轮不造作答/不清数据时，仍要记录 StartedAt/restarts/VmSwap/slow-req 前后值作为运行时证据，并在报告里把入库侧打标（`answer_log.probe` 列、CIDR 匹配）列为「未验证」。

## R373 精简回归冒烟（纯后端调度改动、零前端）走查新经验
- `unhandledrejection` 钩子必须保存 reason 的 **JSON 序列化 + stack + Object.keys**，而不是 `reason.message||String(reason)`——uni promisified API 的拒绝是 `{errMsg:'xxx:fail …'}` 这类无 `.message` 的对象，只存 `String()` 会得到无法定位的 `rej: [object Object]`（R373 375 阶段捕到 1 条，事后无法复现也无法归因）。可直接沿用 `window.__r373rej` 的写法：`JSON.stringify(r)` 失败时回落 `String(r)`。
- 「答 N 题并提交」在本 app 意味着组内自动进下一题，没有独立「提交」按钮；N 题时用「已答 N/10 · 正确 X」+ hook 中 N× `POST /api/answer_log 200` 作为中间态证据，随后需答完 10 题才有完成页。375 上退出会话用页头「退出」，回到首页后「今日已练」应 +N。
- 本轮 375 CDP 仿真三页宽度全为 375（无 15px 滚动条差值）；同一台机不同轮可能得到 360，判读仍以 `clientWidth===scrollWidth` 为准。
- 卷库页头「‹」返回的是上一页栈（如错题本），不是首页；回首页点 tab「刷题」。
- 结束顺序固定：先 SSH 取容器检查点 + DB 对账/清理（base64 脚本 → `docker cp` → `docker exec python3`），再恢复 localStorage（不刷新），再 `kill $(cat holder.pid)`，最后 `Emulation.setDeviceMetricsOverride(mobile=False)` + `clearDeviceMetricsOverride`（只调 clear 不生效，innerWidth 仍 375）。
- 后台任务门控（`heavy_task_allowed`/`refresh_question_stats` 只写变化行）UI 不可观测；报告里要把它们归入「未验证」，只主张「用户流程无回归 + `docker logs … | grep -c slow-req` = 0 + StartedAt/VmSwap 不变」。

## R372 运行时/性能冒烟（零功能变化）走查新经验
- 「每页主要 API 耗时」用两路取证：`performance.getEntriesByType('resource')` 过滤 `/api/`（`duration` + `responseStatus`，Chrome ≥109）和 fetch/XHR 钩子 `window.__r372`（能拿到 POST 的 status 与耗时）；每次 hard nav 后 `performance.clearResourceTimings()` + 重装钩子，逐页把 JSON 追加到 `/tmp/rXXX_timings.jsonl` 便于最后出表。容器 `docker logs | grep slow-req` 会打印 >5s 的请求，可与前端记录互相印证。
- 出现 >5s 慢请求时**立刻**在同一分钟抓宿主证据：`uptime`（load）、`free -m`（宿主 swap_used）、`/proc/pressure/{cpu,memory,io}`、`top -bn1 | head`（同机 postgres 等进程）、容器 `/proc/1/status VmSwap/VmRSS/VmHWM`、`memory.events oom_kill`。这样能区分「本进程被换出」（VmSwap>0）和「宿主争用」（VmSwap 0 但 IO/CPU pressure 高）。
- `VmHWM` 是进程峰值 RSS，静默期（`KG_BOOT_QUIET_S` 默认 600s）结束后的预热/统计刷新会把它抬高（本轮 555→670 MB，上限 768 MiB），记录前后值并报告余量。
- 管理台 cold 路径要在 StartedAt+600s **之前**登录才能观测；ADMIN_TOKEN 在容器 env（`docker exec deploy-kaogong-1 printenv ADMIN_TOKEN`），SSH 高负载时 printenv 可能超时导致 `$TOK` 为空、`&&` 短路，建议先落到 `/tmp` 文件再用。`cdp.pick()` 刻意排除 `/admin` 标签，连管理台要自己 `tabs()` 过滤 `'/admin' in url`。
- 普通刷题到完成页：一组默认 10 题，答 2 题不会到完成页；键盘 `A` 选项 + 答错后 `Enter` 下一题（答对自动跳）最省事，10 题后自动进「本组完成」。
- localStorage 备份若用 `JSON.stringify(JSON.stringify(localStorage))` 导出会成为**双重编码字符串**，恢复前 `if isinstance(d,str): d=json.loads(d)`，否则会写入 8 万个单字符键；恢复后校验 `Object.keys(localStorage).length==18` 且 `anonUid` 为保护 uid。
- 375 用 CDP `setDeviceMetricsOverride(mobile=true)` 时 clientWidth/scrollWidth 可能都是 375（本轮）也可能是 360（有滚动条时），以 `clientWidth===scrollWidth` 判无溢出。

## R371 answer_log 服务端推进错题 SRS（reviewed[] / 不双计 / .fixreport）走查新经验
- 核心断言是 **网络 + DB 双对账**：页内 fetch/XHR 钩子（样例 /tmp/r371_hook.js，日志存 `sessionStorage.__r371log` 以跨 navigateTo 保留）记录 `POST /api/answer_log` 的 body（是否带 `mid`）与响应 `reviewed[]`，并统计 `/api/review/` 的 **POST** 数必须为 0——`GET /api/review/cur` 是既有轮询，别误判为双计。DB 端每个被纠正的 mistake `review_log` 行数应恰等于答对次数（1 次答对 → 1 行；重练后再对 → 2 行），`next_review-now` 约等于 `REVIEW_INTERVALS_DAYS[streak-1]` 天（1d、3d…）。
- 三种场次要分开造：①错题本「错题重练」（`/api/mistakes/redo`，items 带 `mistake_id`，body 带 `mid`，完成页 `.redoreport` 已纠正/仍错/达成掌握）；②卷库「只练错题」或按卷练习（卷 kind 会话，items 无 `mistake_id`，body 无 `mid`，服务端按 `question_id+uid` 回退命中，完成页 `.fixreport`「本组答对 N 道曾错题，复习计划已推进（M 道达成掌握）· 回错题本 ›」，mastered=0 时无括号段）；③随机模块刷题很难命中曾错题，用②覆盖「非重练场次」即可。redo 场次的 `.redoreport` 数字用组件 `items` 的 `_picked===answer` 自算对照。
- 错题本状态判据：`next_review<=now` 显示「今日待复习」+ 顶部「今日待复习 N 道」banner，否则按天数显示「明天复习」；纠正 1 题后 banner 计数应 -1，全纠正后 banner 消失。
- 375 CDP 移动仿真在桌面 Chrome 仍带 15px 纵向滚动条：`innerWidth=375` 但 `documentElement.clientWidth===scrollWidth===body.scrollWidth===360`，用「clientWidth===scrollWidth」判无横向溢出而不是硬等 375；全 DOM 扫 `getBoundingClientRect().right` 会命中 4 个 `visibility:hidden` 宽 400 的 uni 内部测量 div，忽略。
- 造数据阶段生产 503/524 时容器可能被重启（StartedAt 变化），作答走 offlineQueue 刷新后补齐；若发生，报告里要明确「StartedAt 全程不变」不成立、并说明功能证据采自重启后的稳定窗口。
- `/tmp/cdp174/restore_ls.py` 把备份路径写死为 r366，恢复 localStorage 时要自己 `json.load` 本轮备份再 `localStorage.clear()+setItem` 并核对键数（正常 18 键）；恢复后绝不再 reload/navigate。
- 本轮 uid 命中的清理表：mistakes / answer_log / review_log / growth_events；仍用 `PRAGMA table_info` 扫全部 uid/user_id 列删 `test-rXXX-%`。

## R370 完成页 CTA 重练「落 answer_log」走查新经验
- 「某轮作答不落库」类修复的核心断言是 **网络层 POST 计数**，不是完成页文案：装 fetch/XHR/sendBeacon 三钩子记录 `/api/answer_log` body（`items[].qid/correct/source`），并把日志同时写进 `sessionStorage`（F5 后内存钩子丢失，但 sessionStorage 还在）；每轮开始前记 mark，轮后断言「新增 POST 数 == 本轮题数」。
- 重练轮 items 的残留字段要枚举全集：`_picked/_saved/_mid/_secs/_logged/_excl/done`，其中 `_logged:true` 残留会让 `logAttempts` 的 `pending=[]` 静默不发请求——这是 R366 的 bug 根因。
- 长按排除（`@longpress`）在 H5 只能用 **touch 事件** 触发：CDP `Input.dispatchTouchEvent` type=touchStart（touchPoints=[{x,y}]）→ sleep ≥0.6s → touchCancel；鼠标 mousePressed 按住不触发。排除后 `cur._excl` 为字母数组，题面 `.opt.excl` 仅在选答前可见；重练轮断言 `.opt.excl` 数量 0 + item 无 `_excl`。
- 生产偶发 503/超时时作答进 `localStorage.offlineQueue`；**统计 DB 行数前先 F5 一次** 让队列 flush（toast「离线作答已同步」），否则 DB 会比 hook POST 数少几条而误判丢答。刷新后钩子要重装，且 `window.__mark` 之类要在重装钩子之后再设（否则 `undefined.length`）。
- 作答对账公式：uid answer_log 行数 = 各轮题数之和，且等于完成页「已累计刷 N 题」；source 分组（paper psource vs null）可分别核对按卷轮与普通轮。`review_log` 表也带 uid（做错题本重练会写），清理时靠全表 PRAGMA 扫 uid/user_id 列即可覆盖。
- 保护 uid 快照：测试前记 `max(id)` of growth_events/answer_log/mistakes；恢复 localStorage 后**不要再刷新/导航**（会触发 slow_load/stale_fallback telemetry），最后只用 CDP 校验 `localStorage.anonUid`。
- 清 375 模拟：holder 进程 kill 后 `Emulation.clearDeviceMetricsOverride` 单独调用可能不生效（innerWidth 仍 375），先 `setDeviceMetricsOverride(width=0,height=0,deviceScaleFactor=0,mobile=false)` 再 clear 即恢复；无需 reload。
- 不要 `import m375`：脚本在 import 时执行 `main()` 读 argv 会 IndexError，需要复用时把 JS 片段抽出来。

## R369 错题本 pidFilter「重练本卷错题」直达走查新经验
- 「不再请求 X、改请求 Y」类改动要在点击前装 **fetch+XHR 双钩子**（`window.__log=[]`，记录 url 与 track body）并在 navigateTo 之后（同一 SPA 页面对象仍在）读取；断言 `/api/mistakes/redo` 计数为 0、`/api/paper_questions?src&pid&uid` ≥1、`/api/track` body `event/source/ref`。整页 F5 会丢钩子与 console error 收集器，刷新后要重装，或改用 browser_console 工具读真实控制台。
- 「latest-answer 仍错」口径验证要刻意造 **先错后对** 的题：整卷答错 K 题 → 走 R367「只练错题」把其中 1 题答对 → 直达会话 `items.map(id)` 必须是 K-1 个且不含那题；错题本仍显示 K 张历史错题卡（mistakes 表不删），两者不一致是设计使然，别误报。
- 无错题回落是 practice 页 **modal**「本卷已练完 / 重新练一遍？」（uni-modal），而不是 action sheet；DOM 里可能残留上一轮的隐藏 `<uni-actionsheet>`（内部 `.uni-actionsheet` `visibility:hidden` 高度 0），用可见性判断而不是 querySelector 存在性。
- 从记住上次路由的页面直接改 hash 到 `#/pages/book/book?pid=133` 时，tab 页 onLoad 不一定重跑，组件可能仍是 `pidFilter=0`（标题「错题重练」）；需要用 F5 整页刷新或点徽标进入筛选态再断言。
- 375 长卷名挤压检查：量 `.redo-go` rect.right ≤ 375、`getComputedStyle(.redo-l).minWidth==='0px'`、`flexShrink==='0'`；再临时把 `.redo-t` textContent 换成 50+ 字长串复测，完毕用保存的原文恢复。
- 高负载时 `/api/paper_questions` 可能 503 / 50s+，前端 toast「加载试卷…」会一直挂着但自动重试成功后照常弹 modal；等 60–90s 再判断，别把加载中截图当失败。
- **恢复保护 uid 后不要再多刷生产页**：H5 boot 会以保护 uid 自动上报 `growth_events`（`slow_load`/`stale_fallback`/`boot`），使「前后快照不变」失败。本轮多出 4 行遥测，按 id+时间戳精确删除后快照才一致；最好恢复 localStorage 后直接停止操作，或先在空白页(about:blank)恢复。
- `pgrep -f "[h]oldvw"` 本身安全，但同一命令行里若再出现字面 `holdvw`（如 `echo "holdvw stopped"`）仍会自杀 exec 会话；kill 命令单独一行且不要在同行写该词。
- `ssh "docker exec -i A python3 -c …; docker exec -i B python3 -" < script.py`：stdin 会被第一个 `docker exec -i` 吃掉，第二个读到空；需要 stdin 的脚本单独一次 ssh。

## R368 错题本归卷（卷源徽标 / 按卷筛选 / 练本卷）走查新经验
- 归卷类功能要同时验 **API 形状** 与 **UI 分组**：`/api/mistakes?uid=` 每条 `paper` 为 `{pid,title,psource}` 或 `null`，用 `Object.keys(item)` 断言不泄露内部字段（如 `q_source/q_is_real`）；对照组用普通刷题答错一题（非该卷真题），它必须 `paper:null` 且卡片无 `.pbadge`。按卷不计时练习产出的 `mistakes.source` 为 NULL（saveWrong 不传 source），这正是归卷靶场景，可在清理前用 `select source,count(*) from mistakes where uid=? group by source` 佐证。
- 错题本 URL 同步在 hash query 里（`#/pages/book/book?pid=133&mod=…&sort=…`），非法值（`pid=0`/负/非数字）应 fail-closed 不筛选且 console 无 error；**桌面与 375 移动仿真都要在整页刷新后**各验一遍，因为 onLoad 解析与 syncUrl 是两条路径。
- 375 下长卷源文本的 ellipsis 用计算样式（`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:40vw`）+ 临时把 `.pbadge` 的 innerText 换成 40+ 字长串量 `getBoundingClientRect().right<=375` 与 `documentElement.scrollWidth===375` 验证；生产真题 psource 通常不够长，别只靠肉眼。
- 「练本卷 ›」→ `/pkgA/exam/list?pid=` 的 R365 深链在实现上是 **高亮 + `scrollIntoView({block:'center'})`**（`.paper.pinned` + `.pin-badge`「邀你挑战的卷」），卡片仍在原始位置（本轮 index 101/120），不是真正移到列表顶部；不要按「置顶」字面去断言 first child。
- `/api/track` 事件（如 `book_go_paper`）用页内 `fetch` 钩子在点击前装上（`window.__trk=[]; const of=fetch; fetch=(u,o)=>{if(String(u).includes('/api/track'))__trk.push(o&&o.body);return of(u,o)}`），跨页 navigateTo 前读取，避免整页刷新丢钩子。
- 清理表本轮命中 mistakes/answer_log/exam_attempts/growth_events/**exam_progress**（开始模考后退出会留 `exam_progress` 1 行）；用 `pragma table_info` 扫全表 uid/user_id 列删除即可，删前记 `answer_log` 总数（总数差应恰等于测试 uid 行数）。
- `pgrep -f "holdvw.py 1440" | xargs kill` 与 `pkill -f` 一样会匹配到自己所在 bash 命令行并把 exec 会话杀掉（exit -1）；改成 `pgrep -f "[h]oldvw.py"` 或在单独 exec 里只跑 kill，别把后续命令串在同一行。
- CDP 助手 `C.call(method, **params)` 用关键字参数，`Emulation.clearDeviceMetricsOverride` 直接 `c.call('Emulation.clearDeviceMetricsOverride')`。

## R367 卷卡错题数 + 已练完卷「只练错题」action sheet 走查新经验
- 「最近一次作答」口径的 wrong 计数要用 **同一 uid 两轮作答** 验证：整卷答错 K 题 → 卷卡 `已练完全部 N 题 ✓ · 错 K 题`、`/api/exam/papers?uid=` 该卷 `wrong===K`、`/api/paper_questions?src&pid&uid=` 中 `wrong===true` 的 id 顺序应等于卷面顺序（不是答题顺序）；再把这 K 题全答对后 `wrong` 必须回 0 且卷卡去掉「· 错」后缀。答错 id 序列在 UI 上不可见，靠 CDP 读组件 `items[i].answer` 与 `_picked` 记录。
- uni `showActionSheet` 在 H5 渲染为 `<uni-actionsheet>`，页内判断是否弹出用 `firstElementChild` 的 `display!=='none'`（元素常驻 DOM，不能只看存在性）；取消项文字「取消」，点击后断言组件 `session===false` 且 `items.length===0`。
- 「只练错题」入口与 R366 完成页 CTA 的重练 items 断言相同（id 序列/无 `done`/`wrong` 残留/`_ptitle`/`_source`），但 toast 文案不同：R367 是「只练本卷上次答错的题」，R366 是「只重练本卷错题」，别混用。
- 计时模考回归：「开始模考」直接进 `/pkgA/exam/exam?paper_id=…` 且不弹 sheet；退出未交卷后卷库顶部会留「未交卷」横幅 + `exam_attempts` 1 行，需点「放弃」并把 `exam_attempts` 纳入 uid 清理表（本轮命中 mistakes/answer_log/exam_attempts/growth_events）。
- 首页真实路由是 `#/`（tabBar），手敲 `#/pages/index/index` 之类未注册 hash 会得到空白页，F5 后才回首页；页内 hash 跳转后 `window.__errs` 之类注入的错误钩子会随整页刷新丢失，改用 browser console 直接看（正常只有 uni `showLoading/hideLoading 必须配对使用` 警告，无 error）。
- exec 的 `env` 参数不能写 `"$VAR"` 引用已有环境变量（会成字面量，ssh 报 Permission denied）；在命令里写 `SSHPASS="$TICKETS_VPS_SSH_CREDENTIAL" sshpass -e ssh …` 即可。
- 作答条数对账：首页「今日已练 N 题」应等于 answer_log 该 uid 行数（本轮 84=84）；配合 `docker inspect -f '{{.State.StartedAt}}' deploy-kaogong-1` 无变化即可排除容器重建丢数。

## R366 按卷完成页「重练本卷错题」走查新经验
- 完成页错题重练 CTA 是纯前端会话态：CDP 拿 practice 组件 proxy（`items/idx/session/_ptitle/_source`）后，断言 `items.map(q=>q.id)` == 本轮 `_picked!==answer` 的 id 序列，且每项无 `_picked/_saved/_mid/_secs/done` 残留；`_ptitle/_source` 不变即 归卷 保留。
- 375 下键盘快捷键（A–D/Enter）失效（桌面才启用），38 题卷手点太慢：用 CDP `Input.dispatchMouseEvent` 按选项 `getBoundingClientRect` 中心真点（脚本样例 /tmp/cdp174/m375.py：读组件 answer，指定第几题故意答错，答错后自动找「下一题」按钮点掉）。截图坐标≈(css_x*0.64, (css_y+87)*0.64)（1600 宽实屏映射 1024 截图）。
- 完成页底部横幅（「今日还有 N 题到期待复习」）会晚到几秒并把 CTA 往下推——点 CTA 前重新截图/取 rect，否则点空。
- 生产 `/api/answer` 失败时前端进 `localStorage.offlineQueue`（`{type,data:{answers:[{key,uid,item:{qid,correct,picked,source,t}}]}}`），下次启动/刷新 toast「离线作答已同步」再落库；DB 断言 answer_log 数量前先刷新一次让队列冲掉，队列里 `item.source` 也可当归卷证据。`deploy_h5.sh` 会顺带重建 `deploy-kaogong-1` 容器（`docker ps` 看 Up 时长），重启窗口内的作答可能既不进队列也不落库（本轮丢 ~8 条）——遇到条数对不上先查容器 StartedAt，别记成功能 bug。
- 清理：`sqlite_master` 枚举所有含 uid 列的表（本轮命中 mistakes/answer_log/growth_events）按 uid 删并回读 leftover=0；`pkill -f holdvw.py` 会连自己所在 bash 一起杀（模式匹配到命令行），单独一条命令跑或加 `pgrep -f "holdvw.py 375"`。

## R362 按卷练习 pid 对齐走查新经验
- pid 对齐最强对抗卷：2015 新疆卷 pid=133（卷卡 n=38，psource「2015年新疆省考行测真题」src 全集 120 题）——请求带 `pid=133` 时会话应 1/38，前端漏带 pid 会退回旧行为 1/120，一眼可辨。
- 断言四点一线：抓包 `paper_questions?src=…&pid=…&uid=…` → 会话 1/N → 卷卡「已练 X/N」→ R360/R361 弹窗分母同 N（三方分母一致即对齐成功）。
- DB 构造全练完必须用 **pid 响应的 qid 集**（页面内 fetch 带 pid 存 window 变量），不能用 src 全集 120 qids，否则分母被污染。
- 计时模考路径断言：`POST /api/exam/start {paper_id}`，该导航不发任何 paper_questions 请求（无 pid/uid 均正常）。
- Emulation.setDeviceMetricsOverride 在设它的 ws session 断开后可能残留 375：另开 session clearDeviceMetricsOverride 可能无效，重启 holdvw holder（重新 hold 1440）才恢复。

## R361 卷卡完成态/重练弹窗/source 归因走查新经验
- 完成态断言点：`.ppracticed.done` 文案精确「已练完全部 N 题 ✓」、computed color rgb(46,91,255)（--brand-text 在 :root 上 getPropertyValue 可能取空，直接比 computed color）+ font-weight 600；部分完成为绿 rgb(21,128,61) fw400 无 done class。
- 全练完弹窗：title「本卷已练完」content「本卷 N 题已全部练过，重新练一遍？」按钮 不用了/重新练；「不用了」停留在练习页准备骨架（无 1/N 会话计数即为未进会话）；timed 模考不弹（走 exam 页）。
- source 归因验证路径：错题卡「…」菜单→「同考点强化 5 道新题」（reinforceFromMistake → _source='reinforce'）答 1 题，再进按卷练习答 1 题，DB `answer_log.source` 应=卷 psource、无 'reinforce' 残值。
- **卷卡 n 与按卷练习会话题数可能不一致**：卡 n=卷 question_ids ∩ 活跃题（如 2015 新疆卷 n=38），但 paper_questions?src= 按 source 查询可返回更多题（同 source 120 题）——完成态构造/全练完弹窗以 **src 响应题数** 为准，选卷前先核对两者一致（2025 四川卷 75/75 一致，最稳）。
- DB 构造全练完：向 answer_log 插 `(uid,created_at,question_id,module,submodule,correct,secs,picked,source)`，qid 集取页面内 paper_questions 响应的 id；用独特 source 标记（如 r361-construct）便于追溯，清理按 uid 删即可。

## R360 按卷练习「只练剩余」走查新经验
- `GET /api/paper_questions?src=…&uid=` 带 uid 时每题含 `done:bool`（该 uid answer_log DISTINCT 命中）；只有 practice.vue untimed 分支拼 uid，模考走 `/api/exam/start`（paper_id），**根本不请求 paper_questions**——timed 回归断言应写成「无带 uid 的 paper_questions 新请求」而非「paper_questions 无 uid」。
- 续练弹窗断言：标题「继续上次进度？」内容「本卷已练过 X 题，只练剩下的 N-X 题？」确认=只练剩余/取消=从头练；只练剩余后核对三点：进度总数=N-X、当前题 qid==响应里首个 done!=true 的题（顺序保持=原第 X+1 题）、done:true 集合==抓包已答 qids。
- **同 VPS 共宿 recruit(postgres) 应用会周期性把 load 打到 15-21**，kaogong /api 会 12-20s 超时（前端 20s abort 后页面停在「正在准备练习…」）；answer_log 会 503 但**前端有本地重试队列**，等 load 回落（`uptime` 核对 `ps aux --sort=-%cpu` 看是否 recruit postgres）后重试队列会补写成功——practiced 计数暂时偏低不是产品 bug，先查 load 再判定。
- 本 app 的 `anonUid` 在 localStorage 里是**裸字符串**（非 uni 包装 JSON）——对它 JSON.parse 会抛异常导致 CDP eval 返回 null；直接 getItem 比较。
- 恢复保护 uid localStorage 后页面 reload 会刷新 `apiSnap:*` 缓存键值（apiSnapIndex + 各 apiSnap:URL）——想要 EXACT MATCH 需在恢复后把这几个键从备份再覆写一遍（属应用自身缓存，非用户数据漂移）。

## R359 卷卡「已练 X/N 题」走查新经验
- `GET /api/exam/papers?uid=` 每卷恒含 `practiced`（DISTINCT answer_log.question_id ∩ 卷内活跃题）；UI 行 `.ppracticed`（绿 rgb(21,128,61)）仅 `psource && practiced>0` 渲染。断言三角：UI 显示值 == 响应 practiced == DB `count(distinct question_id)` 交集（重复作答行不重复计，重答同题前先记 qid）。
- 构造「无 psource 卷 practiced>0」的合法 UI 路径：对该卷**交模考卷**（开始模考→答 1 题→立即交卷确认）——模考交卷会写 answer_log，从而 practiced>0 但卡上无已练行（fail-closed 强证），同时顺带构造 best_score/看报告 四按钮态。
- 按卷练习重进从第 1 题重新出题（不续上次进度），重答同 qid 是最省事的去重验证路径。
- 生产边缘对无浏览器 UA 的直连 API 请求可能 403——用已加载页面内 fetch 取响应即可，勿误判为应用故障。

## R358 放弃未交卷（drop:true）走查新经验
- R358 起「放弃未交卷」是服务端真删：卷库 dropResume()/首页 erDrop() 确认后 POST `/api/exam/progress` body `{uid, attempt_id, drop:true}` → 200 `{ok:true}`，后端 clear_exam_progress；断言点=抓包 drop 请求 + DB `exam_progress` 行删除 + **等 35s 越过 erClearedAt 30s 本地守卫后再硬刷**（30s 内不回填只证明本地守卫，30s 后不回填才证明服务端删除）。
- 全新 browser context 验证不回填：`Target.createBrowserContext`+`Target.createTarget` 会开**新窗口**（taskbar 出现第二个 Chrome 图标），且 CDP helper（oneshot/holdvw）按 `/json` 列表第一个 zalize tab 匹配，可能误连新 context 的 tab——用完立即 `Target.disposeBrowserContext`，或按 targetId 精确连。
- 模考未交卷阶段答案只存 `exam_progress`（drop 后连 answer_log 都没有）；留存数据主要是 `exam_attempts`（submitted_at NULL）+ growth_events boot。

## R357 卷库/按卷练习走查新经验
- 生产 SQLite 是 `/data/data.db`（容器 env `DB_PATH=/data/data.db`）；`/data/kaogong.db`、`/data/app.db` 是 0 字节空壳，连上查表会得 `TABLES: []`——查数前先 `printenv DB_PATH` 确认。
- practice.vue 的 `startPaper()`（practiceLaunch kind:'paper' 协议）R357 首版**无条件进模考态**（`examMode=true` + 120min 倒计时），卷名只以 toast 1.8s 一闪；任何声称「不计时逐题练」的按卷入口都要实际点进去核对计时 chip。R357b 后 `startPaper(p, untimed)` 有 untimed 分支——untimed 按卷练习断言点是 toast「不计时逐题练」+ 正计时 0:00 起 + 答错即时判分。
- 卷卡四按钮态（开始模考/按卷练习/看报告/导出 PDF）可快速构造：对有 psource 的卷开始模考→0 答直接交卷（生成 attempt + best_attempt_id）。
- 卷库「未交卷」条的「放弃」确认弹窗：连续快速点击（确认后立即点其它按钮）可能不生效，需等 1s 截图确认条已消失；且放弃后服务端 `exam_progress` 行可能仍残留（本地隐藏），清数据时要单独查。

## R356 本地日键/uni-storage 注入走查新经验
- **注入 localStorage 供 uni.getStorageSync 读取必须用包装格式** `{"type":"object","data":{...}}`（数字用 `{"type":"number","data":20}`）——裸 JSON 字符串（如直接 `{"days":{...}}`）getStorageSync 读不出、页面（统计 7 日趋势等）会静默不渲染，容易误判为 bug。
- **验证「UTC→本地 dayKey」类修复要制造时区差**：盒子是 UTC，本地键==UTC 键时新旧代码不可区分。CDP `Emulation.setTimezoneOverride {timezoneId:"Asia/Shanghai"}` 后（UTC 晚间时段上海已是次日），用上海日期做 pstats.days 键——修复代码命中显示计数，旧 UTC 代码查昨日键显示 0，天然鉴别。tz override 与 metrics override 一样**随 socket 关闭即丢**，需常驻 holder（/tmp/cdp174/holdtz.py）。
- practice 页「练习工具」面板行数随状态变化（背题开启后隐藏限时训练行），连续点击前每次都要重新截图定位，否则会误点 字号大小（点击循环 小/标准/大，多点两次可复位）。
- 背题模式断言点：开启后不作答即出「背题模式 · 答案 X」固定横幅，`document.querySelector('.wrap').className` 应含 has-banner（375 下 padding-bottom 200px），用解析末元素 bottom < banner top 断言不遮挡。

## R336 ask-link 走查新经验
- **分包 chunk 陈旧缓存坑**：主 bundle（index-*.js）核对为新版 ≠ 分包 chunk 也是新版。pkgA 异步 chunk（如 pkgA-stats-practice-history.*.js）可能命中浏览器/预取缓存跑旧代码，表现为"新功能不出现"。判别法：`performance.getEntriesByType("resource")` 看实际加载的 chunk 文件名，与 `fetch('/assets/index-*.js')` 里引用的 chunk 名比对；不一致就 CDP `Network.clearBrowserCache` + `Page.reload {ignoreCache:true}` 再测，避免把缓存误报为 bug。
- 断言 storage 驱动的 UI 入口时，可用 `el.__vueParentComponent`（沿 .parent 上溯）直读页面组件 data（如 seenAsk/pendingQid/detail 行字段），能精确定位是"数据没到"还是"渲染没做"。
- `/api/practice/history/detail` 返回行**顶层无 question_id**（题目 id 在 `d.question.id`），前端若用 `d.question_id` 恒 undefined——R336 曾因此练习历史回看入口全灭（P1）。造类似"字段名对不上"断言时先 dump 行 keys。
- ask 页 onShow 会把本地 askCurSession **自动 POST /api/ask/cur 回传服务端**：CDP 构造快照后只要进过 ask 页，测试 uid 就会留服务端 ask_cur 数据，清理清单要包含它。

## R335 练习历史走查新经验
- 练习历史造数最省路径：`POST /api/answer_log {uid,items:[{qid,correct,picked,secs}]}`（study_api.py:138）；同批写入同一时间戳即成一个会话（分组间隔 1800s，db.py `_HISTORY_SESSION_GAP`）。picked 省略即「未答」分支（askAnswerLetter 无效 → 删 redoAnswer 无 chip）。取有效题 id/正解用 `GET /api/questions?module=yanyu&limit=5`（/api/search/question/{id} 对不存在 id 可能长挂/非 JSON）。
- localStorage 恢复大备份（28+ keys）不要经 CLI 参数传 oneshot.py（Argument list too long），要在 python 内直连 ws 发 Runtime.evaluate。备份文件若是双重 JSON 编码字符串需 json.loads 两次。
- 生产共享宿主偶发不可达（HTTP 000/503 数分钟）：等待重试即可恢复，勿归因应用。

## R333 搜索页走查新经验
- 搜索框输入中文 CJK 用 computer type 会失败（xdotool 打不出汉字）：先 UI 点击聚焦输入框，再 CDP `Input.insertText` 注入文本（等价真实 input 事件，会触发 uni 的 v-model 与去抖搜索）。ASCII/数字可直接 type。
- code_hit 直达可用**纯数字题目 id**（如 `1274831`），带字母的语义码需匹配后端 `_QCODE_RE`（insights.py）且 parse 成功才命中。
- 埋点断言坑：新前端 trackEvent 事件名必须在后端 `/api/track` 白名单（backend/app/team.py api_track）内，否则 400「无效事件」——前端静默无感知，只有抓包/console 能发现。核对新增 *_click 类埋点时务必查白名单。

## R331 进行中会话刷新恢复走查新经验
- 测试 uid 注入的 localStorage 键是 **`anonUid`**（驼峰），不是 `anon_uid`——写错键页面会自动生成随机 uid，历史同步 GET 拿不到数据（表现为 askSessions 为空）。注入后须回读 `localStorage.getItem('anonUid')` 核对。
- 「进行中会话」快照键：`askCurSession`（uni 包裹 `{"type":"object","data":[...]}`）+ `askCurSid`（`{"type":"number","data":sid}`）；构造进行中态最省法 = API 造数历史会话后 UI loadSession 恢复。刷新恢复的强证据 = 硬刷后无任何点击讲解+追问自动呈现 + askCurSid 保留 + 「新对话」POST body sid 复用。
- 非法快照 fail-closed 断言：CDP 写 `askCurSession` 为字符串/含缺失、空 explanation 条目的数组后硬刷，sanitizeCurItems 仅回填合法条目；console error 用 Log.enable+Runtime.exceptionThrown 在 reload 期间监听取证。

## R330 删除墓碑/网络失败模拟走查新经验
- 模拟某类请求失败（弱网）：对目标 tab 的 CDP 连接 `Fetch.enable{patterns:[{urlPattern:'*api/ask/sessions*',requestStage:'Request'}]}`，对 method=DELETE `Fetch.failRequest(ConnectionFailed)`、其余 `continueRequest`；拦截随该 ws 连接存活，需常驻进程（硬刷不掉）。杀进程后拦截自动解除。注意 `pgrep -f 脚本名` 会匹配到自身 bash -c 命令行，判存活要用完整命令串或先 pgrep -a 核对。
- 墓碑断言口径：删除后读 localStorage `askDelTombs`（uni storage 包一层 `{"type":"object","data":{...}}`）；「不复活」的强证据 = 服务端 GET 仍返回该 sid + 硬刷后 UI 列表无该条（证明是 filterTombstoned 而非远端已删）。
- 多窗口切换前台不可靠时用 browser WS `Target.activateTarget{targetId}` 精确置前，再截图取证。

## R328 ask 历史会话跨设备同步走查新经验
- 多设备模拟：browser WS `Target.createBrowserContext`+`Target.createTarget{browserContextId}` 造隔离"设备"，各自注入同 anonUid（纯字符串）。注意 `Emulation.setDeviceMetricsOverride` 随 CDP 连接断开而失效——需常驻 holder 进程保持 ws 连接（见 /tmp/r328_holdB.py 模式）。
- 造数不触 LLM：注入本地 askSessions 一条造数会话 → UI 历史点开恢复（loadSession 会移除该条并 DELETE 远端）→ 点「新对话」走真实 archiveCurrent → POST /api/ask/sessions。全程 0 次 /api/explain 可用网络抓包 grep 断言。
- merge 语义本机优先（fail-open）：远端删除不会清掉本机已有副本；验证"远端已空"要用全新 context 同 uid 看历史空态。
- 归档 POST 失败静默（503 也不报错、本地照常归档）；重试回传 = 恢复该条再「新对话」（会产生新 sid）。
- 全新 context 首次加载会自动生成随机 anonUid 并发 GET（home_bundle/review 等），注入测试 uid 前的这些请求会带一次性随机 uid，报告清理时可说明。

## R327 redoAnswer 带作答走查新经验
- 断言口径：四入口（practice deepExplain=this.picked、book redo/askFromReview=历史 user_answer、report askDetail=detail.picked）跳 ask 页后，「你选的答案」chip 应高亮对应字母；storage `redoAnswer`/`redoQuestion` 在 ask onShow 消费后必须均为 null（CDP 读 localStorage 即可客观取证）。
- 串题清理分支验证法：先从有作答题进入一次，再从**未作答**题（mini mock 交卷时留 1 题不答）进入——chip 必须全不选中，若继承上一字母即缺陷。
- 复习流恢复的是**当初答错的 user_answer**，不是本次复习作答（本次答对也应恢复历史错选）。
- CDP websocket 直连新版 Chrome 需 `websocket.create_connection(url, suppress_origin=True)`，否则 403 Forbidden（remote-allow-origins 限制）。
- 生产 VPS 与 recruit 应用同机：遇 /api 大面积 503/超时先 curl /api/health + SSH 看 uptime/pip install，多为同机负载，等待恢复重试即可，不要误判为本轮前端缺陷。

## R326 AI 详解预填走查新经验
- **数据口径陷阱：mistakes.question_text 本身已含选项行**（practice.vue 写入时即 `q.question + '\n' + optText`），任何在错题本侧再拼 options 的预填逻辑都会把选项重复两遍——断言预填内容时必须检查选项行只出现一次，不能只 grep 到 "A." 就判过。报告浮层的 d.question 与刷题页 q.question 则是纯题干，无此问题。
- 错题本列表卡「AI 详解」op 不在「···」sheet 菜单里，而在**卡片展开态**（先点卡片「点开看答案与详解」）的 `.acts` 行（redo op，仅未掌握时显示）。
- ask 页跳转用 switchTab，浏览器后退回不了来源页；回报告页直接改 URL `/#/pkgA/exam/report?attempt_id=N`。报告 detail 浮层内「上一题/下一题」可切题，未答题同样能开浮层。
- 迷你模考可直开 `/#/pkgA/exam/exam?mini=1`（30 题），答 2 题即可交卷生成报告；报告题号 27+ 通常是资料分析题（detailMat 折叠材料），适合验证小题干口径。

## R52 练习历史页走查新经验
- 练习历史页选择器：会话行 `.item`>`.row`（`.time`/`.chip`/`.meta`/`.pct`，pct 语义色 `.hi`=--ok-strong `.lo`=--bad-strong）；展开逐题 `.d-row`（`.d-mark.ok/.bad`、`.d-q`、错题 `.d-ans`「我的答案 X · 正解 Y」、`.d-secs`）；重练按钮 `.btn-redo`；空态 `.empty`+「去刷一组题」。
- **逐题比对取证法**：作答时用 CDP 循环（Input.dispatchKeyEvent 'a'→sleep1.4s→读 `.omark.good` 所在 `.okey` 得正解、`.omark.badm` 判错→Enter）逐题记录 JSON 基准，再与历史 detail `.d-row` 全量比对——注意答对时 good 标记在 picked 选项上，若读到 ans=null&无 badm 即答对。
- 同游客 30min 内多组会并成一个会话（题数/正确率合并、错题按 question.id 去重），断言按合并后口径；重练组题目顺序=历史错题顺序。
- toast「错题重练开始」约 1.5s：点 `.btn-redo` 后 wait 0.8s 内截图才能抓到。
- practice 页无侧栏，完成页左上返回箭头会回到导航栈上一页（如历史页），不是首页。
- **pkill 自杀陷阱**：`pkill -f 'r45_ne[t].py'` 与 `nohup python3 r45_net.py …` 放同一条 exec 命令时，本 shell cmdline 含字面 r45_net.py 会被 pkill 匹配杀掉自己（exit -1）——kill 与重启必须分两次 exec。

## R51 a11y 扫尾走查新经验
- **新部署后旧标签页仍跑旧 bundle**：SPA 标签页不会自动换 bundle，断言前必须 `Page.reload {ignoreCache:true}` 并用 `[...document.scripts].map(s=>s.src)` 核对 index-*.js 是否为本轮 bundle，否则新特性断言会假失败。
- Lighthouse CLI 可直接后台批量跑：`npx lighthouse "https://kaogong.zalize.com/#/<page>" --only-categories=accessibility --chrome-flags="--headless=new" --output=json`，headless Chrome 是独立 profile（游客态），不影响测试浏览器。
- 掌握度地图解锁态（≥30 题）无需重刷 30 题：复用此前轮次留下的一次性游客 uid（如作答过 30+ 题的 uid），`localStorage.setItem('anonUid', …)`+刷新即可；冷启动态则 removeItem('anonUid') 生成全新 uid。
- placeholder→aria-label 镜像断言选择器：`uni-input input` / `uni-textarea textarea` 的 `aria-label` 应等于组件 placeholder 文本（App.vue markMain MutationObserver 全站生效）。
- 灰阶 token 判据：--ink-2 浅色 rgb(95,101,117)、深色 rgb(155,160,176)；--ink-3 浅色 rgb(138,144,160)（旧低对比值，出现即回归失败）。

## R50 刷题完成页/薄弱考点区块走查新经验
- 直开 `/#/pages/practice/practice` 会自动出一组 10 题；键盘流 `a`→等 1.2s→`Enter` 循环可快速做完全组（全选 A 天然产生跨考点错题，适合制造 `.weakrf` 薄弱考点区块）。
- 「全对完成一组」可行路径：完成页点某考点「强化 5 道新题」进入 5 题判断推理/定义判断强化组，逐题认真作答（定义判断类可推理答对）——5 题全对成本可接受，不要假设无法制造全对场景。
- 背题模式入口：答题页头部「···」练习工具面板 →「背题模式」行点击切换；开启后每题直显答案，`Enter` 连按即可走完，完成页显示「本组背完」（无正确率环/无 weakrf）。背题开关不持久化，刷新后回普通模式。
- 强化流取证：点强化按钮前用 CDP `Network.enable` 后台脚本捕获 `/api/questions?mode=reinforce&limit=5&module=…&tag3=…` 请求；toast「同考点强化开始：均为未做过的新题」出现约 1.5s，点击后立刻截图才能抓到。
- 完成页「再来一组」是 uni 组件不是原生 button，断言选择器用 `uni-button,button` 兜底再按 textContent 过滤。
- 「错题重练效果」卡（.redoreport）只在错题重练会话的完成页出现，普通新组完成页没有，勿据此判 weakrf 位置断言失败。

## R46 无障碍语义属性（role=main / aria-hidden）走查新经验
- 断言集：`document.querySelector('uni-page-body').getAttribute('role')==='main'` 且 `querySelectorAll('[role="main"]').length===1`；l-icon 判据用 `document.querySelectorAll('uni-image.l-icon img')` 每个 `closest('[aria-hidden="true"]')` 非空（aria-hidden 落在 uni-image 根元素上，img 靠祖先覆盖）；tabbar 用 `.uni-tabbar__icon img` 逐个 aria-hidden==='true'。
- navigateTo 栈测试注意：uni-h5 H5 端进入子页后 DOM 中可能只剩 1 个 uni-page-body（旧页被移除而非隐藏），所以「栈内旧页无 role」这一分支可能天然无从取证——用「进入/返回后 role=main 恒唯一且落在当前页」作为等价判据。
- MutationObserver 跟随验证走真实 UI：首页更多练习「讨论广场」入口（navigateTo）+ 左上返回 + 五 tab 切换（switchTab 重建节点），逐页断言 role。

## R45 /tiku 边缘缓存（CF Pages functions caches.default）走查新经验
- 取证法：浏览器真实导航的文档响应头用 CDP `Network.enable` + `Network.responseReceived`（type=Document）捕获（helper 模式见 /tmp/cdp174/r45_net.py，可同时 hold 视口）；curl 结果与浏览器一致但报告以浏览器为准。
- 判据：同一 /tiku URL 二访（300s TTL 内）`X-Edge-Cache: MISS→HIT`；HIT 响应带 `Cache-Control: public, max-age=300`。**实现细节大坑：首个 MISS 响应本身不带 Cache-Control/X- 也可能只带 X-Edge-Cache: MISS**——[[path]].js 只在缓存副本 cacheCopy 上 set Cache-Control，MISS 的直出 out 不带；断言时不要因 MISS 无 cc 判失败，用二访 HIT 证生效。
- 非 /tiku 范围泄漏检查：`/` 首页文档响应应无 X-Edge-Cache（原生 `public, max-age=0, must-revalidate`）。
- TTL 过期正常：隔 >300s 再访同 URL 会重新 MISS，非 bug。
- 再次确认 pkill/pgrep 自杀坑：即使模式用了方括号转义，如果同一命令串后半段还包含未转义的同名字符串（如 `nohup python3 r45_net.py …`），pgrep -f 仍会匹配本 shell——kill 与重启必须拆成两次独立 exec。

## R43 CLS/横移类断言走查新经验
- CLS/横移类断言取证法：用 CDP `Page.addScriptToEvaluateOnNewDocument` 注入 rAF 采样脚本（记录壳 rect.x + documentElement.clientWidth 去重序列），再 `Page.reload(ignoreCache)` 硬刷新，比对全程 x 零跳变。
- `scrollbar-gutter: stable` 生效判据 = computed 值 + 有/无滚动条页 body 右缘一致（clientWidth 可能一页 1440 一页 1425，以 body 右缘为准）。
- 375 overlay 滚动条下 iw=cw=sw=375 为零副作用判据。

## R31 收件箱「赞我的」双流走查新经验
- R31（bundle index-DBba9i5b.js 起）inbox 双流：like 条目匿名（type:"like"，无 nickname/content，仅 👍+「有人赞了我的评论」+我的评论摘要），reply/like 按 created_at 倒序混排取 50，unread 复用同一水位——进过一次收件箱后旧 like 已读，新 reply 到达时 badge 只计新增。取消点赞或删除回复后对应条目即时从 inbox 消失（like JOIN comment_likes、reply 要求双方 status='ok'）。空态文案「暂无消息／…收到回复或点赞会在这里提醒你」。
- 测试机无 emoji 字体：👍/💬 渲染为方框（tofu），属环境问题不判失败，报告需注明。
- 讨论页偶发卡「加载中…／共 0 条讨论」而 API 实际 200——Ctrl+Shift+R 硬刷即恢复，判断依据是页内 fetch /api/comments 返回 200 有数据。
- 登录成功后页面偶尔不跳转（视觉停在登录页），localStorage authUser 实际已写入——以 uid 回读为准，直接导航目标页即可。

## R30 讨论消息收件箱走查新经验
- 收件箱链路（bundle index-BoJNejSP.js 起）：GET /api/comments/inbox 只统计「别人回复我的顶层评论」且双方 status='ok'——测试法：A 发顶层评论，B 回复（楼中楼），A 才收到；unread=created_at>last_read 水位。POST /api/comments/inbox/read 在 inbox.vue onShow 拉取后自动调用（unread>0 时）——**本次进入蓝点仍显示，再次进入才消失**，「我的」页返回后未读数即清零。
- 「我的」页「讨论消息」cell 未登录时不发 inbox 请求且点击直接跳登录页（goInbox 守卫）；登录态 value 显示「n 条未读」。
- 收件箱条目=蓝点(.dot)+昵称+「回复了我」+时间+回复内容+「我的评论：…」摘要，点击 navigateTo discuss?qid=。删除回复（admin）后条目即从 inbox 消失，空态「暂无回复消息」。
- CDP websocket 直连 `webSocketDebuggerUrl` 需 `websocket.create_connection(url, suppress_origin=True)`，否则 403 Forbidden（Chrome 拒绝 localhost origin）。
- 管理台 F5 后需重新填 token 登录（登录态不持久），按 R29 取 token 法重登即可。

## R29 管理台「评论与举报」走查新经验
- /admin 登录：密码框 `#login-token` 填 X-Admin-Token → `#login-btn`。ADMIN_TOKEN 只在生产 `/home/ubuntu/kaogong-assistant/deploy/.env`（本地仓库 deploy/ 无 .env）；取法：`SSHPASS="$TICKETS_VPS_SSH_CREDENTIAL" sshpass -e ssh $TICKETS_VPS_SSH_USER@$TICKETS_VPS_SSH_HOST "grep ADMIN_TOKEN ..."`（env 变量已在本机 shell 中）。填 token 用 CDP 原生 setter，避免值出现在录屏/日志。
- 「评论与举报」页 `#/comments`（admin/pages/comments.js）：KPI 三卡（待审核=hidden 数/被举报评论/累计举报人次）+ 举报队列 + 评论浏览（status 下拉 ok/hidden/deleted）。恢复 confirm「恢复该评论（判定为误报，举报记录将清零）？」→ POST /api/admin/comments/{cid}/restore（status→ok + 清 comment_reports）→ toast「已恢复」；删除 confirm「删除该评论（判定为违规）？」→ DELETE → deleted。操作列按 status 显示：非 ok 有「恢复」、非 deleted 有「删除」。
- admin 是原生 JS confirm/toast；confirm 弹窗是浏览器原生 dialog，OK 按钮约在 (616,120)。管理台 375 视口是侧栏收缩+内容横向滚动（非响应式），布局不崩即算过。

## R28 评论举报/阈值隐藏走查新经验
- R28（bundle index-DAfhaa2y.js / PR #202 起）：非本人评论/楼中楼操作行显示「举报」（本人仍「删除」，discuss.vue L44-45/52-53）；点击 → ensureLogin → uni.showActionSheet 五理由（广告导流/人身攻击/违法违规/色情低俗/其他）→ POST `/api/comments/{cid}/report`。首报 toast「已收到举报，我们会尽快处理」，重复举报（INSERT OR IGNORE 幂等）toast「你已举报过这条评论」；去重举报人数 ≥3 时评论 status ok→hidden，返回 hidden:true，前端就地从列表移除；GET /api/comments 只查 status='ok'，刷新后不再返回。自举报 400「不能举报自己的评论」；评论不存在/已删 404；限流 cmt_report 10/600s。
- 多账号阈值测试法：注册 4 个测试账号（A 发评论、B/C/D 举报）。切换账号 = `localStorage.removeItem("authToken")+removeItem("authUser")` → 导航 `#/pkgA/user/login` UI 登录。**登录页会残留上一账号手机号**——先 triple_click+ctrl+a 全选再输入，否则「手机号或密码错误」。账号切换后讨论页有缓存（mine 标记不更新），需 F5 强刷。
- uni-app localStorage 值是 `{"type":"object","data":{...}}` 包装格式，读 authUser 需取 `.data`。页内 fetch 验证 API 时 GET/POST 都要带 `Authorization: Bearer <authToken.data>` 和 `X-Access-Code`，否则 403「无权访问该账号数据」。
- toast 约 1.5s 即消失：点击 actionSheet 选项后 wait 0.8s 截图才能拍到；wait 2s 会错过。
- 评论输入框真实元素是 `input.uni-input-input`，用 HTMLInputElement 原生 value setter + dispatch input 事件填中文，再真实鼠标点「发布」。

## R27 面试点评中断外显/重新生成走查新经验
- R27（bundle index-lnBfJwrY.js 起）：review 为空的 session 详情页显示「上次点评生成被中断，评分已保留」+ H5「重新生成点评」按钮（interview.vue L92-96）；点按钮 POST `/api/interview/sessions/{sid}/review/stream`（body {uid}），流式回填 DB；review 非空返回 400「点评已存在」；限流 itv_regen 10/600s。
- 制造中断 session：CDP 填 textarea + input 事件 → **真实鼠标点击**「提交作答」（JS 找 button 文本经常失败）→ 轮询 `document.body.innerText.includes("考官正在撰写点评")`（meta 已到）→ 立即 `location.href` 跳走。约 0.2s 轮询在 meta 后数秒内可完成中断。
- 详情页 URL `interview?session_id=N` 直接刷新可正常渲染详情（与旧经验不同）；但「再练一题」后 URL 不变，新 session 状态要从 history 重新进。
- R27b 守卫（bundle index-njTwWnwJ.js / PR #200 起）：`REVIEW_MIN_LEN=300`（interview.py L25/L266）——review.strip() <300 字仍允许 regen（不再被 400 锁死）；前端 `reviewMissing = review.trim().length<300`，短点评时正文 rich-text 与「点评可能不完整（生成被中断）」提示+按钮**同时显示**（interview.vue 两个独立 v-if，L91-98）。负例判据：≥300 字 session 直接调 regen API 应 400「点评已存在」。
- 中文无法用 computer type 输入到 textarea（IME 缺失，只出 ASCII）；用 CDP `ta.value=...; ta.dispatchEvent(new Event("input",{bubbles:true}))` 填充，再真实鼠标点提交。
- 点击地址栏坐标 (88,40) 会误开站点信息弹窗；导航建议用页面内链接（详情页底部「练习记录 ›」可回 history）。
- **生产 LLM 点评流不稳**：正常不中断流也可能结束却零内容（详情变中断卡），regen 也可能产出截断文本并原样回填 DB（截断后按钮消失、无法再 regen——400 点评已存在）。判定回归失败前先重试一次，并把截断/空点评报为上游 LLM 问题而非 UI bug。

## R26 学习日历 / 模考大赛赛后报告走查新经验
- 赛事窗口由 `backend/app/mock_event.py` `_saturday_window()` 自动生成，平日 `/api/mock/events` 常为 `current:null`（enter 会 400「比赛尚未开始」）。要真实走 contest-report 流程需临时改生产 DB `mock_events.open_at` 为过去时间（记录原值、测后恢复）；不要伪造 report——`/events/{id}/report` 无 entry score/attempt_id 时 404「尚无比赛成绩」。
- 真实流程：`/#/pkgA/exam/contest` 点「立即参赛」→ `exam?paper_id=&event_id=` 键盘 A-D 快速作答若干题 → 交卷确认 → 自动 redirectTo `contest-report?event_id=N`。禁止用保护 uid 打开 contest-report（ended 阶段 `_freeze_ranks` 会写库）。
- 赛后报告断点期望（PR #199，bundle index-e1d0dr7T.js 起）：≥1024 `.cr-cols` flex、`.cr-side` 420px sticky 在**左**（总分 hero+小样本提示+分数分布）、`.cr-main` flex:1 右；≥768 `.wrap` 1044、`.pbtn/.wrow:hover` cursor（scoped，读 styleSheets）。「逐题回顾」→ `report?attempt_id=`、「弱项练 5 题」/「去练」→ practice 页。
- 学习日历 `/#/pages/stats/calendar`：≥1024 `.cd-cols` flex、`.cd-main` 日历卡左 flex:1、`.cd-side` 420px sticky 右（里程碑卡→poster-btn）；375 为 block 单列 日历→里程碑→按钮。当月「›」按钮带 `dis` 类；「生成打卡海报」跳 `/pkgA/social/poster`。

## R25 讨论页桌面化 / 面试评分即落库走查新经验
- **面试落库行为自 PR #198 起变更**：`_save_session(review="")` 在评分完成后立即调用，SSE `event: meta` 的 JSON 带 `session_id`；点评流结束 `_update_review` 回填。中断 SSE（评分后硬刷/关页）记录仍在 history，详情评分在、点评显示「考官正在撰写点评…」空占位。R24 段的「流结束才落库」判据已过时。
- **登录账号态提交面试会 403**：`streamInterview()`（api.js）裸 fetch 不带 `authHeader()`，而后端 `guard_account_uid` 中间件要求账号 uid（u<id>）POST 必带本人 Bearer token → `{"detail":"无权访问该账号数据，请重新登录"}`。该 bug 已由 commit 946f837（bundle index-BUebEHnd.js 起）修复：headers 补 `X-Access-Code + authHeader()`，登录态提交已实测 200。旧 bundle 下仍会 403，判定前先核 bundle 版本。登录页表单注意：页面顶部 Chrome 翻译弹窗可能抢走首次点击导致输入落空，先关弹窗再点输入框。
- 讨论页 `#/pkgA/social/discuss?qid=N`：入口是刷题页/题目详情的社交栏「讨论」（q-social-bar）。≥1024 `.dc-cols` flex（`.dc-side` 380px sticky 题目摘要卡左 / `.dc-main` chips+评论+公约右）；≥768 `.wrap`/`.replying`/`.inputrow` max-width 1044 居中；<1024 单列。匿名用户输入框 placeholder「登录后参与讨论」、聚焦弹「需要登录」modal——发评论需真实注册（注册页无真实短信校验，任意手机号+密码即可）。hover cursor 规则只在 `:hover` 下（scoped `[data-v-...]`），静态 computedStyle 读不到，需读 document.styleSheets 或物理悬停。
- 直接 URL `interview?session_id=N` 进不了详情（回分类页）；要看 session 详情需从 history 列表点卡片。
- SSE meta 捕获法：页面上下文包一层 `window.fetch` tee response.body，匹配 `event: meta\ndata: (...)`；reload 会丢补丁需重注。

## R24 周学习报告 / 面试练习记录走查新经验
- ~~面试 session 只在点评 SSE 流式完整结束后才落库~~（**已被 PR #198 改为评分后即落占位，见 R25 段**）。分类页「已练 N」计数可作为落库与否的快速核对。
- history 页 `#/pkgA/interview/history`：≥1024 `.list` grid `1fr 1fr`（1440 实测 514px×2、1280 444px×2）+ `.item:hover` 阴影；<1024 flex column 单列。`.wrap` ≥768 max-width 1044。
- weekly-report 页 `#/pkgA/stats/weekly-report`：新游客必走空态卡（周报按上周聚合，本周作答无效），空态不渲染 `.wr-cols` 也无分享按钮——有数据双栏/分享弹层只能报 untested，可用 document.styleSheets 断言 ≥1024 `.wr-cols/.wr-side(420 sticky)` 与 ≥768 `.sheet(560px)/.mask(center)` 规则存在。注意 scoped 选择器带 `[data-v-xxx]` 后缀，正则匹配 selectorText 不要用 `\.sheet$`。保护 uid 不可打开周报页（会触发 markRead POST）。
- Chrome 若被误关，可用 `google-chrome --remote-debugging-port=29229 --user-data-dir=~/.config/google-chrome-for-testing URL` 重启，localStorage/游客 uid 保持不丢；重启后需重新 wmctrl 最大化并重设 CDP metrics。

## R22 答题 PK / 刷题小队走查新经验
- PK 页 `#/pkgA/pk/pk`：点「发起好友挑战」或「随机匹配对手」都直接进入 quiz 视图（10 题、每题 30s 倒计时），答完才落到 result 等待页——不要预期先出等待页。quiz/result 视图 `.pk-solo` 期望 width 680 居中；home 视图 `.pk-cols` flex、`.pk-left` 420 sticky。
- 双游客对局取证法：第一游客创建挑战记下挑战码 → `localStorage.clear()+reload` 变第二游客 → 输码「应战」→ 答完 10 题即出真实胜负结果页（对手比分来自服务端）。PK 页离开再回来会恢复上次 quiz/result 视图，需点「返回 PK 大厅」才能量 home 布局。
- team 页 `#/pkgA/team/team`：初版 `.tm-cols` 曾是 `row-reverse`（视觉侧栏左/列表右），commit 1572c1f 起改为普通 `row`（bundle index-C-l8IPg_.js 及之后）——桌面视觉应为「列表 .tm-main 在左、创建侧栏 .tm-side 360 sticky 在右」；DOM 中 `.tm-main` 始终在前，375 单列即 DOM 顺序。若发现方位与描述不符，先核对实际 bundle 版本再判定。panel 视图 `.tp-cols` 普通 row：排行 `.tp-side` 360 sticky 在左。创建弹层 ≥768 居中 sheet 520px，<768 贴底抽屉（mask flex-end、sheet 全宽）。
- 答题类页面用 computer-use 连点选项时选项 y 坐标随题干长度浮动，点前先截图校准；每题点击间隔 1.2s 足够。

## R17 AI 问答桌面操作台走查新经验（round-3 R17 轮）
- ask 页 `#/pages/ask/ask` 桌面空态：≥1024 时 `.camscreen` display:none、`.deskstart` display:flex（两 `.ds-col` 并排）；「最近讲解」`.reccard` 两端共用。textarea 中文输入用 CDP 设 value + 派发 bubbling input 事件（computer-use 打不出中文）。
- **拖拽陷阱**：uni-app H5 编译后 `@drop`/`@dragover` 绑在 uni-view 上可能不触发——合成 DataTransfer drop、CDP Input.dispatchDragEvent、真实 OS 拖拽（drop 事件带 files=1 且 trusted 到达 .ds-drop）三种方式均无法令 Vue 的 onDrop 运行，直接调组件方法则正常。生产拖拽功能可能真实失效，测试时用 document 级监听器（记录 dragLog）取证再下结论。
- Ctrl+V 图片：window paste 监听是原生 addEventListener，用合成 ClipboardEvent(paste, {clipboardData: DataTransfer含image File}) 可触发确认 sheet 且 defaultPrevented=true；纯文本 paste 应 defaultPrevented=false 无 sheet。
- 文字 LLM 流式讲解生产可用（deepseek 长 reasoning，整题 1–3 分钟耐心等）；视觉/图片通道 key 缺失时提交图片报「AI 服务未配置」，且失败会重新弹出文本 sheet（doExplain catch 里 `if(txt) textOpen=true`）。
- 文本讲解失败后 error banner 留在空态 deskstart 下方，重试点讲解按钮即可；错题本页偶发「连接服务器超时，点击屏幕重试」，点屏幕重试即恢复。
- r12.py 视口子命令是 `metrics W H [true]`（不是 emulate），恢复用 `clear`。

## R14 统计页双栏 masonry 走查新经验（round-3 R14 轮）
- 统计页 `#/pages/stats/stats`：`.sgrid` masonry 用 `column-count:2`（非 grid），断言用 computed columnCount=2 + 各卡 rect.left 只出现两个值（1440 下 363/823，各卡宽 448）；展开折叠项（成就勋章/AI 教练 lrow、模块分布/练习记录「展开全部」）后 masonry 会左右重排，属正常，不算破版。
- 折叠项可用性依赖数据量：错题模块分布「展开全部」需 >3 模块、练习记录卡需有 history、「展开全部 N 条」需 >6 条——数据少的游客 uid 下这些链接不出现，覆盖前先看数据形态。
- 学习日历页 `#/pages/stats/calendar` 是异步分包组件，生产首次打开 spinner 可挂 50-60s 并在 console 抛「Async component timed out after 60000ms」error，但随后仍会渲染成功——遇到时耐心等 + 复跑干净 console 监听区分历史回放（Runtime.enable 会回放 buffered console 条目）。

## R13 真题卷库桌面网格走查新经验（round-3 R13 轮）
- 真题卷库页 `#/pkgA/exam/list`：`.plist` 桌面 grid 两列的 `.wrap` 虽设 `max-width:1044px`，但**全局壳 UNI-APP max-width:1140px − 左侧栏 padding 208px 只留 932px**，实测 wrap=932px、grid 列 448px×2——桌面宽度断言以 932 为准，未来若要真 1044 需改壳级样式。
- 年份/地区筛选 chip 首次点击可能遇到 `/api/exam/papers?...` 网络级 `net::ERR_FAILED`（console 有 network error，页面停在「试卷加载中…」且保留旧列表）——重点同一 chip 或先点「全部」再点目标 chip 即恢复；console 监听脚本会回放历史 Log 条目，判断 0 error 要看时间戳是否属于本次 reload。
- practice.vue 模考态（R12 examMode）触发路径：**首页 → 更多练习 →「真题卷练习」卡 → sheet 选卷**（launch kind:'paper'）；真题卷库页的「开始模考」走的是独立 exam.vue 页（无 .pside 侧栏），两者勿混。模考态验证序列：未答按 Enter 不动 → 按 A–D 作答后 200ms 自动流转 → ← 回已答题按 Enter 仍不动；侧栏答题卡底部有「交卷」button。退出用顶部「退出」不交卷即零成绩数据。
- 列表页 bodyScrollHeight 取证：R13 后 1440 下约 10753（改前约 19822），是网格收敛最直观的量化证据。

## R5 首页 CTA 收敛 + 错题趋势卡走查新经验（PR#178 轮）
- 桌面/移动响应式 CSS（媒体查询）改视口即生效，无需 F5：`cdp.sh metrics 1440 900 false` / `375 812 true` 切换后直接量 `getBoundingClientRect()` 与 `getComputedStyle(el).display` 即可断言。
- 「继续目标 ›」紧凑宽断言方法：量按钮 width（~131px @1440 为 compact；375 下按钮+邻居宽度之和 ≈ 行宽即 flex:1 拉满）。
- 错题趋势卡 `.trendcard` 默认 display:none，≥1024 由 `@media` 改 block；柱状 DOM 顺序是 3周前→2周前→1周前→本周。数值口径：`created_at` 落入 [now-(i+1)*7d, now-i*7d)，可用 /api/mistakes 独立复算比对。
- 后台 kill CDP daemon 时 `pgrep|xargs kill` 有时连自己 shell 一起挂（exit -1）——用具体 pid kill，且 nohup 后台启动要用子 shell `( ... & )` 包裹，否则 `cd &&` 链会被 `&` 截断导致后续命令在错误 cwd。

## R4 首页新访客 landing 走查新经验（PR#177 轮）
- 新访客态制造法：先 `JSON.stringify(localStorage)` 备份到磁盘文件（含 anonUid/pstats 等 7 键），再 `localStorage.clear()` + F5。uni-app storage 值是 `{"type":...,"data":...}` 包装格式，判断 pstats.days 要看 `data.days`。测完用备份逐键 setItem 恢复。
- landing 显示条件 `!landingHide && pstats.days 为空`；✕ 写 `landingHide={"type":"number","data":1}`。清 landingHide 单键即可重现 hero，不必再次全清。
- **F5 后立即截图可能是旧渲染帧**（页面 spinner 还在转时 hero 仍显示）——断言 landing 是否消失必须等加载完成（tab spinner 停止）再截图 + CDP 查 `.landing`，否则会误判 failed。
- `/tiku/`（题库静态站）是整页跳转，生产首次加载可 30s+，曾出现 SPA 页面停在原地 spinner 长转——耐心等，curl 核 200 即非故障。
- 主 CTA「免注册立即开练」进 /pages/practice/practice 出题即可断言通过；点「退出」不作答则 pstats 不写入，hero 回首页仍在。

## R3 掌握度外显/模考分区走查新经验（PR#176 轮）
- 制造 `source='exam'` 错题的最快路径：首页→更多练习→迷你模考（/pkgA/exam/exam?mini=1），**点选项会自动跳下一题**（点完选项再点「下一题」会跳过一题留空），答 5 题左右故意错 2-3 题→答题卡→交卷→「还有 N 题未作答」确认弹窗→判分 10-20s。后端只保存「已作答且答错」的题，空题不产生错题。
- 掌握度断言先 curl `/api/mastery/map?uid=...` 取基线（modules[].mastery/level_name、subs[].tag3s[]），注意**交卷后 mastery 会立刻变化**（本轮常识 64%→63%），UI 复验要与交卷后的最新 API 对照而非旧基线；n=0 模块（如 shuliang）不应显示。
- 来源筛选验证顺序：筛选 sheet「来源」段仅在存在 exam 错题时出现 → 选模考（只剩新题+chip「模考错题 ✕」）→ 选练习（互补旧题+chip「练习错题 ✕」）→ 点 chip ✕ 恢复全部。历史 source=NULL 不显紫色「模考」徽标。

## 错题本桌面双栏走查新经验（PR#174 轮）
- 错题本页 ≥1024px 双栏为 float 布局（.bk-main float:left+clear:left / .bk-side float:right+clear:right，容器 920px）。**float+clear 会让主列元素卡在更高的侧栏元素之下**：非空态 tab 与搜索栏之间出现大段垂直空白（左列空洞），检查布局时除了横向重叠还要量各 bk-main 元素间的纵向间隙。
- 空态判定：`.wrap` 加 `noside` 类且 `.empty` 卡近容器满宽（1440px 时 ~908px）。切空态用随机新 `anonUid` + F5，测完恢复原值。
- CDP 视口 daemon 的 websocket 会在 `location.reload()`/F5 后断开（eval 返回 null 或超时）：需 pkill 后按 `/json` 当前 target id 重启 daemon 再继续；页面 target id 也随刷新变化，勿硬编码。
- 复习模式核验：进入后 `.wrap` 类变 `bookwrap-review`（max-width 760px 居中单列），只看不作答，「退出复习」应恢复双栏。批量模式只选择不点「标已掌握/删除」即可零数据变更。

## 批次2·B/C 生产走查新经验（骨架屏 / 双视口 / 并发部署）
- **生产验证前必须 curl `/` 核对 index bundle hash**（`curl -s https://kaogong.zalize.com/ | grep -o 'index-[^"]*\.js'`）：SW 缓存与**其他会话并发部署**都可能让线上跑旧 bundle（本轮实测被旧版覆盖过一次）；走查中途也要复核未回退。
- 375/1440 双视口用 CDP `Emulation.setDeviceMetricsOverride`（常驻 daemon 保持 ws 连接，依赖 `pip install websocket-client`）。
- 抓刷题直达骨架屏：`Network.emulateNetworkConditions`（~2500ms latency）放慢首题请求；触发「题目加载失败」重试面板：CDP `Fetch` 拦截 `*api/questions*` failRequest。
- 裸直达 `/#/pages/practice/practice` 自 PR#163 起自动按 lastModule 开练（旧版停「正在准备练习…」的行为已废弃）；若存在未完成组会先弹「继续上次练习?」续练弹窗（tryResume，预期）。
- 模考列表「N 人考过」数据源是 `/api/exam/papers` 的 `takers` 字段（非 `/api/papers`）。

## R28 审查轮新经验（SW v3 / 学习计划 / OMR 闭环 / 组队周报）
- SW v3（kg-shell-v3）后 asset 不经 SW：验证用 CDP `Network.responseReceived` 的 `fromServiceWorker` + `performance.getEntriesByType('resource')` 的 transferSize（二次访问==0 即 memory/disk cache）。断网 F5 仍进壳（导航兜底），但 `/static/tab/*.png` 图标离线缺失属预期降级。
- **懒加载 chunk 挂起与 SW 无关**：SW v3 不拦 asset 后周报页仍复现「spinner→连接服务器超时」，点击重试后 chunk 160ms 秒开——疑 HTTP/2 连接或反代层，别再拿 SW update 当修复手段。
- **POST 类接口客户端 60s+ 但服务端 slow-req 只记 5-7s**（export/pdf、scan_sheet、plan、profile）：差额在反代/隧道上游，audit 时要同时采集客户端 duration 和容器日志对照。
- 学习计划阶段验证：改画像考试日期即可切换 专项期(>30天)/真题期(>14)/冲刺期(≤14)；冲刺期 60min → 13专项+8真题=21 题；复习配额受「今日之前到期数」约束，UI 显示 min 值属正常。
- OMR 闭环可全真测：导出含答题卡 PDF → pymupdf 渲染 → 按 backend/app/omr.py 几何（bubble_rect）PIL 涂黑 → UI「扫描答题卡→拍照」走系统文件选择器选图 → 识别卷码/精确判分/自动记入。生产表是 `paper_exports`（无 `papers` 表），correct 答案查 `questions` 表。
- 组队打卡：pkgA/team/team 创建得 6 位邀请码，第二 uid 输码加入即 2 名队友；做题后队页「今日 N 题」实时联动。**队长昵称可能显示 null**（创建时无 pkNickname），周战报剪贴板可用 `navigator.clipboard.readText()` 读（先在页面点 Allow 授权弹窗）。
- `practice_results` 自 R426（rev `dc69266`）起有 `uid`/`probe` 列：清理时**按 uid 一并删**；R426 前的 286 行历史无 uid（全 NULL）不可归属、不删。清理团队要删 `teams` + `team_members` 两表。

## R26r 生产回归新经验（growth.total 口径 / 注册迁移 / 收藏页入口）
- R26 起时政完成态按 uid 隔离存 `szDaily:<uid>`（不再是裸 `szDaily`）；注册合并会把 `szDaily:<旧匿名uid>` 复制到 `szDaily:<账号uid>`。验证迁移要注册后 F5 再看首页时政卡。
- 统计页/我的页「累计做题/正确率」自 R26 用 `/api/growth` 的 `total`（answer_log 全量含时政）；旧口径是本地 pstats 模块和（不含时政）——构造「时政+行测」混合作答即可区分新旧口径。
- 收藏页 `#/pkgA/social/favorites` 的 UI 入口：错题本页 →「收藏」tab →「收藏夹与笔记」卡。我的页「我的收藏」不去收藏页，而是 `bookShowFavs=1` 后 switchTab 到错题本。
- 我的页「外观模式」cell 点击循环 跟随系统→浅色→深色，可代替 CDP 媒体仿真做深/浅色回归（用户可见、录屏友好）。
- 账号注册后 uid = `'u'+users.id`（如 u18）；**users 表没有 uid 列**，清理账号行按 id/phone 删。账号 uid 的 /api/mistakes 需 `Authorization: Bearer <authToken>`（浏览器 localStorage `authToken`），否则 403「无权访问该账号数据」。
- 服务器 SSH：env `TICKETS_VPS_SSH_HOST/USER/CREDENTIAL`（CREDENTIAL 是密码，用 sshpass）；容器内 sqlite 脚本若中途抛错则整个事务未提交，重跑前先查计数确认。
- SW 静态资源挂起（R8/R10 已知）本轮复现 2 次（懒加载 chunk 请求不发出→40s「连接服务器超时」）：`navigator.serviceWorker.getRegistration().then(r=>r.update())` + Ctrl+Shift+R 可恢复，无需重启 Chrome。

## R18 审查轮新经验（搜索/统计四卡/时政/申论/分享）
- **CDP 移动仿真要用常驻 daemon**：一次性 ws 连接断开后 `Emulation.setDeviceMetricsOverride` 会失效；用常驻脚本保持连接（本轮 /tmp/cdp_daemon.py 模式），测完 pkill。
- **CJK 搜索输入**：xdotool/type 会丢字；用 CDP 调 `HTMLInputElement.prototype.value` 原生 setter + dispatch `input` 事件写 `uni-input input`。
- 搜索考点结果深链走 `goTopic()`，方法忽略参数、裸跳 /pages/practice/practice——验证深链时看落地页是否发 `/api/questions` 请求即可判断是否真的带上了考点。
- 统计页三卡「已答题数」口径各自独立（预测卡/掌握度地图/热力图），审查时要交叉核对同页数字是否自洽；预测分进度可能不计入时政/混合练习。
- **分享全链路测法**：错题卡「···」→分享给队友 → sid 在剪贴板（xclip 读）；`/s/{sid}` 为 meta-refresh 秒跳 SPA，og 标签用 curl 看原始 HTML。访客视角切 uid 即可（同机注意 `pkNickname` 不随 uid 隔离，作答昵称会串号）；分享无删除接口，sid 记台账。
- 错题清理 API：`GET /api/mistakes?uid=` 拿 id，`DELETE /api/mistakes/{id}?uid=` 逐条删。
- localStorage 备份是双重 JSON 编码字符串，还原时要 `json.loads` 两次。
- 时政 szDaily 完成态存 localStorage 不按 uid 隔离，切换一次性 uid 前先备份、测后整体还原。

## R14 回归轮新经验（交卷兜底 / LLM 降级 / hb-gap 心跳）
- **模拟「请求已送达但响应丢失」**：CDP Fetch 用 `requestStage:"Response"` 拦截 `*api/exam/submit*` 再 failRequest——服务端已判分、客户端收失败，可验 exam.vue 的 report 确认分支（直进报告，不报「已交卷」）。`Request` 阶段拦截则验「作答保留+重交」分支。
- **触发 hb-gap 心跳上报的正确方式**：挂起必须发生在**文档提交之后**（旧页面已卸载、新壳 JS 未运行）。做法：① 页面 eval 删 SW cache 里的 `assets/index-*.js`；② 浏览器级 ws（/json/version 的 browser endpoint）`Fetch.enable` 拦 `assets/index-*` 挂 21s 放行；③ F5。挂起导航文档请求没用——旧页面存活期间心跳照写，gap 不超 15s（实测 81s/92s 文档挂起都只报 nav: 级 RUM、无 hb-gap，这是设计边界不是 bug）。
- **页面级 CDP Fetch 拦不到导航/SW 请求**，要用浏览器级 endpoint；且多个拦截脚本同时 enable 会互相抢事件导致请求悬死——测前 `pkill -f` 清干净旧拦截器。
- 生产容器应用端口映射是 `127.0.0.1:8300`（不是 8000）；admin token 可 `docker exec deploy-kaogong-1 printenv ADMIN_TOKEN` 直接取。
- AI 问答降级入口：`/#/pages/ask/ask` →「粘贴文字」→ CDP 写 textarea →「用花生十三方法讲解」；LLM 未配时 `/api/explain/stream` ~0.4s 返回红条「失败：AI 服务未配置，请重试」。`/api/access_info` 可先查是否需要访问码。
- uni-app 有的 textarea 用 `document.querySelector('textarea')` 写入会被 Vue 重置；改用更精确的 `uni-textarea textarea` 选择器 + value setter + input 事件即可。

## R13 审查轮新经验（模考大赛/时政/申论/PK 平局/slow_load RUM）
- **模考大赛 admin 路由前缀是 `/api/admin/mock`**（不是 `/api/admin/events`）：建临时场次 `POST /api/admin/mock/events` body `{title,series,paper_id,open_at,close_at}`（epoch 秒，open_at 设 now-60 即 running），删除 `DELETE /api/admin/mock/events/{id}`。paper_id=24 是 17 题小卷，适合快速全链路。
- 防泄漏口径：`/api/exam/start` items 只含 `_EXAM_ITEM_FIELDS`（无 answer/explanation），可用 r13-probe 类一次性 uid 直接 curl 验证（会留 exam_attempts 残留）。
- **造 PK 平局**：winner 判定为 分数→总用时→draw；双方都提交 `items:[]`（空作答）则 0 分且每题 ms 均按 PER_Q_MS_CAP 计 → 总用时相等 → draw。API 造局后浏览器切两个身份分别看结果页即可验证「🤝 平局！」与「（我）」。
- **生产 growth_events 在容器 `/data/data.db`**（app.db/kaogong.db 里没有该表）：`docker exec deploy-kaogong-1 python3 -c "...sqlite3.connect('/data/data.db')..."` 查 `event='slow_load'`。
- slow_load RUM 盲区：挂起型慢加载（chunk fetch 不完成、「点击屏幕重试」后重载）不满足 nav>10s/resource>8s 触发条件，自然慢加载可能不上报；判断 RUM 是否生效别只看有无记录。
- 捕获一闪而过的 uni.showToast：截图常错过；用 CDP 注入 200ms 轮询 `document.querySelector('uni-toast')` 收集 innerText 最可靠。
- CJK 无法用 xdotool type 输入（会丢字）：对 textarea 用 CDP 调 value setter + dispatch input 事件写入。
- 申论 AI 批改降级：LLM key 未配时 `/api/shenlun/grade` 返回 502「批改失败：AI 服务连接失败，请稍后再试」，但服务端等 ~22s 才失败（会打 slow-req）。

## R10b 回归轮新经验（SW 壳时效 / PK 续答）
- **验证回前台 SW 重校验**：`reg.update()` 的 /sw.js 请求不出现在页面 performance/CDP Network（由浏览器进程发出）；最可靠的取证是 SSH 看容器访问日志 `docker logs deploy-kaogong-1 --since 3m -t | grep "GET /sw.js"`，先确认 3 分钟基线为空，再切 tab 隐藏/切回，几秒内应出现一条。60s 节流：紧接着再切一次应无新请求。
- **/sw.js 的 FastAPI FileResponse 不处理 If-None-Match**（条件请求恒 200 全量）；SPA 壳 `/` 由 StaticFiles 提供、304 正常。核验时别把 sw.js 的 200 误判为 no-cache 失效。
- **制造 PK「未交卷离开」**：uni-app H5 是 SPA，同 tab 改 hash 或点返回不销毁答题内存态，F5 有时也被计时器抢跑（超时自动作答推进，答满会自动交卷）。可靠做法是导航到 `about:blank` 再回来。
- PK 续答（PR#137 后）：我的对局「待作答」点入会重新 pkJoin 拉同题组从第 1 题重答（不是从中断处继续），creator/opponent 均可；已交卷局点入进等待/结果页。
- 非参与者输他人挑战码：后端 409，前端按设计跳观战结果页，但 my_side=null 时「（我）」标签取错名（P2 已报告）。
- pk/submit 偶发 ~60s 长尾仍存在（请求未落库）；#136 重试卡 + 「重新提交」可救回，验证时提交后先 `GET /api/pk/match/{code}?uid=` 查 done 再下结论。

## R10 审查轮新经验（SW 旧 shell/PK 断网重试/小队与海报）
- **发版后已装 SW 的浏览器会继续跑旧 bundle**：即使生产文件已更新（curl 可证），页面加载的 index/chunk 可能仍是旧版（旧 chunk 在服务器上甚至已 404 但被 cache 命中）。测新功能前必须核对 `performance.getEntriesByType('resource')` 里的 chunk hash 与生产 index.html 引用一致；不一致时 `navigator.serviceWorker.getRegistration().then(r=>r.update())` + Ctrl+Shift+R。
- **模拟 PK 提交失败**：CDP `Fetch.enable`（urlPattern `*api/pk/submit*`）+ `Fetch.failRequest(ConnectionFailed)` 稳定复现；失败卡片文案「提交未成功（作答已保留），网络恢复后可重试」。注意作答只保留在内存，刷新后该局在「我的对局」显示「待作答」但点进去只有等待页、无法续答（P2 已报告）。
- 日历页 `/#/pages/stats/calendar` 出现过 chunk 请求不发出→40s「连接服务器超时」→点击重试后 renderer 彻底挂死（CDP eval 无响应、tab 从 /json 消失）；只能重启 Chrome。sw-asset-timeout 救不了发生在 fetch 事件之前的挂起。
- 错题删除 API：`GET /api/mistakes?uid=` 取 id，`DELETE /api/mistakes/{id}?uid=`。
- 小队测法：/pkgA/team/team 创建得邀请码，切第二 anonUid F5 后输码「加入」即成 2 人；「提醒 TA」「复制周战报」都写剪贴板（xclip 验证）；「退出小队」入口存在，双 uid 退出即可清理（小队空壳无解散接口）。中文队名在 H5 input 可能丢失（本轮实建名只剩 ASCII 部分）。
- 打卡海报入口：日历页底部「生成打卡海报」→ /pkgA/social/poster，「保存图片」直接触发 PNG 下载。周报 /pkgA/stats/weekly-report 是上周口径，新 uid 恒为空态。

## R9 回归轮新经验（部署核验/PK 提交长尾/深链）
- **验证「修复已部署」不能只看 PR 状态**：对前端静态资源直接 curl 生产文件比对特征串/md5（如 `curl /sw.js | grep sw-asset-timeout`，与 `git show <branch>:frontend-uni/src/static/sw.js | md5sum` 对比）。R9 实测 PR#134 的 SW 修复宣称已上线但生产文件仍是旧版——部署可能只更新了部分产物。
- **PK 提交可能整机长尾**：/api/pk/submit 偶发 20s+ 前端超时且请求根本未达应用层（容器无日志），同期 `[slow-req]` 可见 admin 接口 10-17s——疑服务器资源争抢。前端超时 toast 转瞬即逝、页面停留题目页**无重试按钮**，答完的局会永久 waiting。测试时若首局提交卡死，重开一局通常正常（0.2s）。
- module-only 深链 `/#/pages/practice/practice?module=xx` R9 起已支持直开（约 3s 加载），可用 performance resource 里的 `/api/questions?module=` 佐证。
- 首页「今日已练」实现为 `Math.max(服务端 today_n, 本地 pstats 今日)`——并非严格「服务端为准」；测污染场景注意 pstats 按 uid 维度隔离。
- localStorage 备份文件可能是双重 JSON 编码（`json.load` 后仍是 str，需再 `json.loads` 一次）。
- uni-app localStorage 值为包装格式 `{"type":"string","data":"..."}`，还原时按原样 setItem 即可。

## R8 回归轮新经验（分享幂等/PK/SW 挂起）
- **SW 静态资源分支挂起是首页/刷题页卡 spinner 的根因**：现象是 chunk 请求根本不发出、console 报 `Async component timed out after 60000ms`、页面内 `fetch('/assets/...')` 永久挂起，而同期 curl 服务器正常。sw.js v2 只给 navigate 分支加了 8s 超时，asset 分支（cache-first）无兜底。恢复法：按 /proc argv 重启托管 Chrome；注意重启命令若直接 `tr '\n' ' '` 拼 argv，UA 字符串会被拆成多个假 URL 标签页，需事后用 CDP `/json/close/{id}` 关闭。
- 直接 URL 打开 `/#/pages/practice/practice?module=xx` 会停在「正在准备练习…」不发 /api/questions——练习页依赖首页入口传参，测试必须从首页模块卡片进入。
- 分享幂等验证法：判错后连点「🔗 分享给队友」，每次点击都会发真实 /api/share/create（可用 performance.getEntriesByType('resource') 数请求数），用 `xclip -o` 读剪贴板比对 sid。
- 写已答记录可直接 `POST /api/answer_log {uid, items:[{question_id,correct,answer}]}`，无需 UI 逐题作答，适合 reinforce uid 排除测试。
- PK 多选过滤按 answer 长度（len>1）实现，**题干标注「(不定项选择)」但库内 answer 为单字母的脏数据会漏网**，验证时要逐题看题干。
- 慢请求日志：`docker logs deploy-kaogong-1 | grep slow-req`（服务器容器名 deploy-kaogong-1，SSH 凭据 TICKETS_VPS_*）。注意浏览器端 duration 含网络，比服务端计时大，3.3s 前端耗时可能不触发 3s 服务端日志线。

## 原生小程序 miniapp-native（Linux 微信开发者工具）
- 工具：`/opt/apps/io.github.msojocs.wechat-devtools-linux/files/bin/bin/wechat-devtools`；登录二维码约 1 分钟过期需手动刷新；未登录时编译输出 `touristappid` 且模拟器不渲染，只能做静态核查。
- **「开启 Skyline 渲染调试」在 Linux 版会让编译卡死在 theme.json**：详情→本地设置取消勾选，改用 WebView 渲染即可正常编译。
- **模拟器滚动输入不生效仅限 skyline 渲染期**：PR#129 起 app.json `renderer: webview`，滚轮滚动正常。若仍需整页一屏目视，可在机型下拉选「自定义」添加高分辨率机型（如 375×1400）。
- 小程序直连生产 API（`miniprogram/utils/request.ts` BASE_URL=https://kaogong.zalize.com），模拟器匿名 uid 会真实写 answer_log/mistakes，测完要列清理清单。
- 统计页薄弱提示触发条件：≥2 个模块 done≥5 且某模块正确率低于均值 ≥10 个百分点；混练约 3 组 10 题可构造。

## R7 审查轮新经验（分享/PK/reinforce）
- **生产 API 有间歇性 10–60s 长尾**（reinforce 回退路径、/api/pk/submit 实测 60.2s、首页偶发卡 45–75s）。遇到 UI 卡「判分中…」或首页 spinner 时先等 60–90s 再判失败，并用 `performance.getEntriesByType('resource')` 抓实际请求耗时作证据，勿直接归因浏览器。
- reinforce covering 索引 idx_q_reinforce **只覆盖 tag3 精确条件**（db.py `cond.startswith("tag3=")`），submodule/module 回退是慢路径——采样时延要分开测两类路径。
- 分享闭环：任意判分后的 q-social-bar「🔗 分享给队友」只出 toast+写剪贴板（`xclip -selection clipboard -o` 取链接）；同人同题连点会生成多个 sid。/s/{sid} 可 curl 断言 OG/noindex；无效 sid 302 回首页；分享者视角直接见答案，挑战者需先作答；同 uid 二次作答 409（UI 无反应）。
- PK 双人流程可单机完成：创建方答完 10 题拿挑战码 → CDP 改 anonUid/pkNickname → F5 → 输码应战。PK 作答不写 answer_log（不计入 checkin/今日已练），周榜昵称会留残留。
- 本地 pstats/首页「今日已练」缓存不按 uid 隔离（practiceHistory 已修，pstats 未修），切 uid 测试计数断言以 `/api/checkin/summary` 为准。

## 本地 H5 测试环境（PR #32 起）
- 本地后端：`cd backend && ADMIN_TOKEN=devtoken IMPORT_TOKEN=devtoken LLM_API_KEY=x LLM_BASE_URL=http://localhost:1/v1 APP_CORS_ORIGINS="http://localhost:5173" uvicorn app.main:app --port 8300`；SQLite 在 **仓库根** `data.db`（不是 backend/data.db）。
- H5：`cd frontend-uni && npm run dev:h5`（:5173）；要打到本地后端需建 `frontend-uni/.env.local` 写 `VITE_API_BASE=http://localhost:8300`（勿提交）。
- 浅色主题录屏：设 `localStorage.themeMode='light'` 不够——OS 深色时 Chrome 的 prefers-color-scheme 仍为 dark。用 CDP `Emulation.setEmulatedMedia`（prefers-color-scheme: light）并**保持 websocket 常连**（断开即失效）；连 ws://localhost:29229 需 `suppress_origin=True` 否则 403。
- 已知桌面端浅色瑕疵：`App.vue` 的 `.theme-dark page { background:#15161c }` 被 uni H5 编译成裸 `body{background:#15161c}`，浅色模式下宽屏内容以下区域呈深色（若未修可在报告中注明，非测试环境问题）。
- 时政「时效」标签（admin #/content）：即将过期=到期前 ≤90 天、已过期=date+12 月已过；种子数据全为时效内，可临时 INSERT 旧日期行验证后删除。admin 令牌存 localStorage `admToken`。

## 生产站 /admin 与模考（P5）
- 线上 https://kaogong.zalize.com/admin 管理令牌 = 容器 `IMPORT_TOKEN`；纠错处理的「已修复/驳回」用原生 JS `prompt` 弹窗填备注。
- 纠错去重键为 `uid+question_id`：同一 uid 重复提交同一题会更新同一条记录（内容取最新）。
- 全真模考「中途退出恢复进度」依赖本机 localStorage + 服务端未完成 attempt：测试恢复必须用同一浏览器重进同一套卷。

## 社区功能（PR #21：讨论区 / 收藏夹+笔记 / 打卡海报）
- 账号登录：`POST /api/auth/register` body `{"phone","password","nickname"}` 可先建号（如 13900000002/pass123），UI 在 `#/pkgA/user/login` 登录，token 存 localStorage `authToken`。
- 已知坑：讨论区 `discuss.vue` 的 `logged` computed 依赖非响应式 `getToken()`——从登录页返回后登录态不刷新，必须 F5 后才能发帖。
- CJK 无法用 computer `type` 直接输入（会丢字）：用 `printf '中文' | DISPLAY=:0 xclip -selection clipboard` 再 ctrl+v 粘贴到输入框/uni modal。
- 讨论区频控 3 条/60 秒（第 4 条 toast「操作过于频繁」）；违规词表在 `backend/app/social.py` `_BANNED_WORDS`（如「加微信」）。
- 打卡海报入口：统计→学习日历页底部按钮恒可用；刷题首页横幅链接需 todayCount ≥ dailyGoal，dailyGoal 存 localStorage `dailyGoal`（UI 最小档 20，可注入小值触发）。保存图片会下载 `~/Downloads/kaogong-checkin-YYYY-MM-DD.png`。
- 收藏夹页 `#/pkgA/social/favorites`：点收藏项展开出现「移动到…/讨论区/取消收藏」操作行；新建夹用 uni editable modal（粘贴填名）。

## P6：学习计划 / 考点树 / 时政
- 时政每日一练完成态存本机 localStorage `szDaily`，同日重测需先清该 key。
- 后台「考点树」在生产 tag3 全空时列表恒「暂无题目」；验证编辑闭环可先 API 打标一题（`PATCH /api/admin/questions/{id}` body `{"tag3":code}`，header `x-admin-token`）再经 UI 清空还原。
- 服务器 DB 精确核对：容器 `deploy-kaogong-1` 内 `/data/data.db`（不是 /app/data/kaogong.db；`answer_log.created_at` 为 epoch 秒非日期串，判分列名为 `correct`）。容器内无 sqlite3 CLI，用 `docker exec deploy-kaogong-1 python3 -c` + sqlite3 模块查询。

## tag3 三级考点
- tag3 覆盖率核对须过滤 disabled（已下架题 tag3 恒空属预期）。
- 抽审队列 API `/api/admin/tag3_review`（x-admin-token=容器 IMPORT_TOKEN）；容器内无 curl，用 python urllib。
- 错题本三级子行仅对有 question_id 的错题显示（tag3_name 由 /api/mistakes join questions 注入）。
- POST /api/mistakes 造数时 `question_type` 必须用前端分组名（如「历史人文」，勿带「常识判断-」模块前缀），否则错题本 kp3 行选中后列表为空/redo 集合不全（kp3 态 redoAll 仍带 qtype 参数）。
- 测 t3 过滤要构造「同二级分组不同 tag3」对抗样本（如 CS-LS-01 vs CS-LS-02），以区分 t3 过滤生效与 qtype 转发的既有效果。

## P7 多端分包路由
- P7 起 exam 三页/shenlun/login 在 pkgA 分包，H5 路由为 `#/pkgA/exam/list|exam|report`、`#/pkgA/shenlun/shenlun`、`#/pkgA/user/login`；旧 `#/pages/...` 路径由 App.vue onLaunch 重定向到 pkgA。
- H5 的 API base 为空串同源相对路径（api.js `BASE_URL`），非 H5 端为 `https://kaogong.zalize.com`。

## R21 裂变链路（share-q 组队引导 / 周排行 / 周战报）
- 匿名 uid 存 localStorage `anonUid`：设置新值 + F5 即可切换身份（测「击败 X%」需新 uid 作答）。
- 后端 :8300 直接服务已构建的 H5（`frontend-uni/dist/build/h5`），无需起 vite dev server。
- 小队周排行与 `q_stats`（击败 X%）均派生自 `answer_log`：可直接向仓库根 `data.db` 用 python sqlite3 种入 answer_log 行造数据。
- 验证复制类功能（周战报/分享文案）用 `xclip -selection clipboard -o` 读剪贴板。

## 题目纠错 (question reports, PR #2)
- Admin console requires `ADMIN_TOKEN` env var on uvicorn (e.g. `ADMIN_TOKEN=testtok`); login at `/admin` with that token. 纠错处理 tab badge = count of open `question_reports`.
- H5 entry points: practice answer view link「题目有问题？纠错」below the explanation card (must answer first; scroll down), and 错题本 expanded item footer「纠错」/ ··· sheet「题目纠错」. Sheet requires picking a type chip before 提交纠错 enables.
- Dedupe: `POST /api/question_report` with same uid+question_id updates the existing row and returns `{"updated":true}`. The H5 anon uid is `localStorage` — easiest to read it from a row already inserted in `question_reports`.
- Admin 标记已修复/驳回/重新打开 all pop a JS `prompt` for a note; paste CJK via xclip + ctrl+v into the prompt.
- If the managed Chrome crashes (wrapper `~/.local/bin/google-chrome` fails with "connect to localhost:29229 refused"), relaunch the real binary: `DISPLAY=:0 setsid /opt/.devin/chrome/chrome/linux-*/chrome-linux64/chrome --remote-debugging-port=29229 --no-first-run --user-data-dir=~/.config/devin-chrome &`.

## Run the app
```
cd /home/ubuntu/repos/kaogong-assistant/backend
LLM_BASE_URL=$LLM_RELAY_BASE_URL LLM_API_KEY=$LLM_RELAY_API_KEY LLM_MODEL=gpt-5.6-terra \
  uvicorn app.main:app --host 0.0.0.0 --port 8000
```
**IMPORTANT (recurring failure): bind `LLM_RELAY_BASE_URL`/`LLM_RELAY_API_KEY` via the exec tool's `env` parameter. Writing `secret:personal:...` literally into the command string passes it through unresolved and every explain request returns 502. Verify after start: `tr '\0' '\n' < /proc/$(pgrep -f 'uvicorn app.main')/environ | grep -c '=secret:'` must be 0.**

Before testing backend changes, verify the running process is newer than the edited files: compare `ps -o lstart= -p $(pgrep -f 'uvicorn app.main')` with the file mtimes — if the process is older, restart it (with secrets bound via exec env params) or you will test stale code.

H5 explain now uses `POST /api/explain/stream` (SSE: `event: meta`, then `data: {"d": delta}`, `event: done`). To verify streaming visually, take two screenshots a few seconds apart and confirm content grows. For image-question tests, generate a Chinese question image with PIL + wqy-zenhei font.

Practice mode: `GET /api/questions?module=&limit=&submodule=` (URL-encode Chinese submodule values) returns random questions + per-module counts; `GET /api/submodules?module=xxx` lists second-level question types with counts. Clicking a module card opens a bottom sheet to pick a submodule (direct start when <2 submodules; 混合刷题 / smart-weak entry / stats deep-link start directly with no sheet); pre-fetch answers via API to deliberately answer right/wrong in the UI. Seed bank lives at `knowledge/questions_bank.jsonl` (imported on startup, deduped by question text UNIQUE).

Frontend served at http://localhost:8000 — uni-app H5 build (`frontend-uni/dist/build/h5`) if present, else legacy `frontend/index.html`. Rebuild after frontend changes: `cd frontend-uni && npm run build:h5`. SQLite DB at repo root `data.db`.

## Devin Secrets Needed
- `LLM_RELAY_BASE_URL`, `LLM_RELAY_API_KEY` (OpenAI-compatible relay)

## API testing
- Access codes were cancelled 2026-07 but RESTORED in prod later (deploy/.env ACCESS_CODE set): `GET /api/access_info` returns `{"required":true}` and AI 功能（问答/申论/面试）提交前会弹访问码框。访问码值向 lead/用户索取，只在浏览器运行时输入，勿写入任何提交/报告/计划文件。若 AI 返回 503「AI 服务暂时不可用」，先怀疑中转站渠道/模型下线（曾发生 gpt-5.6-terra 下线，切 grok-4.5 恢复），报 lead 而非自行改配置。
- `POST /api/explain` is multipart form: fields `text`, `user_answer`, optional file `image` (≤8MB). Responses take 20–90s — always run curl in background and wait.
- Verify cited method names really exist: `grep -r '方法名' knowledge/references/`.
- 错题本 CRUD: `POST/GET /api/mistakes`, `DELETE /api/mistakes/{id}`, stats at `GET /api/stats`.
- 错题字段更新: `PATCH /api/mistakes/{id}` body may set `error_reason` (错因标签) and/or `mastered` (0/1, 已斩). Mastered items are excluded from `/api/review`.
- 复习模式: `GET /api/review` (due items), `POST /api/review/{id}` body `{"correct": bool}` — two consecutive correct reviews return `mastered: true` and auto-remove the item from the review queue. When verifying auto-mastery, call the API against a mistake id you created this run instead of walking the live review UI (which would touch the user's due items).
- Frontend localStorage keys: `fontLv` (答题字号档 0/1/2) and `dailyGoal` (10/20/50) persist across sessions; cycle them back to defaults after UI tests if changed.
- To create due review test data, `POST /api/mistakes` (no access code needed) with a `correct_answer` letter field — new mistakes are immediately due. To reset due times, edit `next_review` in `data.db` via python3's sqlite3 module (no sqlite3 CLI on this box).

## 试卷导出 / 手动录入答案（R119）
- 导出 PDF 响应带 `X-Paper-Code` 头；前端把卷码写入 `localStorage.recentPapers`，测试时可直接读取。参考答案可用 pymupdf 从导出 PDF 的答案页提取用于比对。
- 手动判分（`POST /api/paper_answers`）与扫描答题卡共用 `_judge_paper`：写 answer_log、错题按 question_text 去重合并进错题本。
- 手动录入弹层内题目列表是内部 scroll-view，「交卷判分」按钮初始可能在视口外，需先滚动弹层内部再点击。

## Browser UI testing gotchas
- `computer type` drops CJK characters (xdotool). To enter Chinese text, install xclip (`sudo apt-get install -y xclip`), pipe text via `xclip -selection clipboard`, then ctrl+v into the field.
- The three tabs are a bottom fixed tabbar: 拍题讲解 / 错题本 / 薄弱分析. Save button 存入错题本 appears at the bottom of the explanation card; success is a native alert.
- Mobile check: shrink window with `wmctrl -r :ACTIVE: -e 0,50,30,400,720`.
- Desktop layout breakpoint is 768px (App.vue): at ≥768px the bottom tabbar becomes a 208px left sidebar and fixed banners/masks shift right by 208px. To verify, resize Chrome to ≥1200px wide and hard-refresh.
- localStorage `pstats` is stored wrapped as `{"type":"object","data":{...}}` — JSON.parse the raw value and read `.data`; preserve the wrapper when writing back.
- After a correct answer the practice page auto-advances in ~1.2s; screenshot the green-answer state immediately after clicking, without waits.
- Sound effects (H5 WebAudio): toggle stored as `sfxOff` ('1'=off, ''=on). To verify sound fires, hook `window.AudioContext` constructor via console/CDP BEFORE starting a practice group (`practice.vue` caches `_actx`), then count constructions after a graded answer.
- To test empty states, back up `localStorage.getItem('pstats')` fully before clearing and write it back afterwards (keep the `{"type":"object","data":{...}}` wrapper).

## Production testing
- Live site: https://kaogong.zalize.com（AI 功能需访问码，见 API testing 节）. LLM model: grok-4.5 (LLM_MODEL/LLM_TEXT_MODEL, since 2026-08), fallback deepseek-chat; base URL 不带 /v1（后端自动追加）。
- When testing against production, record the pre-test `/api/mistakes` id list first and only delete records created during the test.
- NEVER delete pre-existing mistake ids even if they don't match an older baseline — the owner uses the live app on his phone, so unknown recent ids are likely REAL user data. Only delete ids you created yourself this run; escalate discrepancies instead of cleaning them.
- Practice mode auto-saves wrong answers to the mistake book (no manual button) — every deliberate wrong answer creates a production record; record the id baseline before testing.
- The online review queue includes all due production items and cannot skip them; when testing requeue, answer production items correctly (minimal impact) and note it in the report.
- Verify deployment freshness by comparing the `assets/index-*.js` hash in the live index.html against local `frontend-uni/dist/build/h5/index.html`.

## DB backup for destructive tests
- SQLite DB is at repo root `data.db` (not backend/). Before destructive tests: `cp data.db /tmp/backup.db`; restore single rows via python sqlite3.

## Dark mode testing
- Use DevTools undocked window + Ctrl+Shift+P "Emulate CSS prefers-color-scheme: dark". Emulation is lost when DevTools closes.

## R22 增长功能（徽章/PK 战绩分享）生产测试
- 徽章连击造数据：SSH 进服务器 `sudo docker exec deploy-kaogong-1 python3` 往 `/data/data.db` 的 answer_log INSERT 3 行（created_at=今天/昨天/前天 epoch 秒，source='qa23类前缀'，question_id 取任一存在题如 1046924）。徽章 API `/api/checkin/badges?uid=...` 由 answer_log 推导连击。
- 「🏅 解锁新徽章」弹窗由**本地 pstats.days**（非服务端）计算 streak 触发：仅设 anonUid 不够，需把 localStorage `pstats`（wrapped 格式）的 `days` 写成连续 3 天各≥1，并清 `badgeSeenMax`，再在练习页答 1 题。
- 我的页顶部「连续打卡」用本地 pstats，徽章墙「当前连续/历史最长」用服务端 answer_log——同页两处可能不一致，属已知设计（换 uid 未同步本地数据时明显）。
- PK 无真正"自动开局机器人"：`random_match` 无等待局时只是新建 waiting 局。要打完一整局，用第二个 anonUid（改 localStorage 后刷新）join 同一 code 并作答，双方都提交后 status=finished。
- PK 昵称默认存本地（同浏览器两个 uid 会显示相同昵称如 考友5CD9），非 bug。
- 战绩落地页 `#/pkgA/share/pk-result?rid=CODE`；边界 rid（不存在/waiting）应显示「战绩不存在或对局未结束」，API `/api/pk/result/{code}` 返回 404。
- 落库核对表 growth_events：pk_result_open/pk_result_copy（source=pk_share）、badge_unlock（source=badge, ref=天数）。注意 pk_result_open 对任意 rid（含无效）都会记一条。
- share-q 页出现「一键加入小队」CTA 的条件：分享者本人在某小队（后端 `_sharer_invite`）；找 `shared_questions` 表里 from_uid 为小队成员的 sid 来测。
- 深色模式生产站可直接用 我的→外观模式 循环切换（跟随系统→浅色→深色），比 DevTools emulation 稳，测完记得切回跟随系统。

## 讲解（hs_explanation）批量抽查
- 抽查指定题号的讲解与结论最快走 SEO 页 `https://kaogong.zalize.com/tiku/q/{id}`：解析块优先展示 hs_explanation（seo.py `hs_explanation or explanation`），可用 curl 批量抓取后正则提取「正确答案：X」与结尾「确认答案为X」比对，无需 UI 逐题定位。
- 迷你模考入口在首页「更多练习→迷你模考」（30 题/30 分钟），可只答几题从答题卡交卷；交卷生成 `attempt_id`（成绩页 URL `#/pkgA/exam/report?attempt_id=N`），模考中答错的题也会自动写入错题本（saveExamWrong）——生产测试记得把这些 mistake id 一并列入清理清单。
- 组队落地页：我的→刷题小队→创建小队→「复制邀请链接」得 `#/pages/team/join?code=XXXXXX`，可直接开新标签验证渲染；测试小队记下邀请码，测完可点「退出小队」清理。

## 生产服务器与 /admin 令牌（R1 审查轮）
- 生产服务器即 TICKETS_VPS（env：`TICKETS_VPS_SSH_HOST/USER/CREDENTIAL`，sshpass 登录），仓库在 `/home/ubuntu/kaogong-assistant`，令牌在 `deploy/.env` 的 `ADMIN_TOKEN`（32 位）；取值管道到 `xclip` 粘贴进 /admin 登录框，勿落盘。
- /admin 登录按钮首次点击可能无响应且无提示（已报 P2），再点一次即可进入。
- 375px 视口：Chrome 窗口最小宽度 >375，无法用 wmctrl 缩窗实现；用 CDP `Emulation.setDeviceMetricsOverride`（375×812, mobile）+ 常连 websocket（cdp_hold.py 模式）。注意该 override 在断开/clearDeviceMetricsOverride 后可能仍卡在原 tab——桌面视口测试直接开新标签页最省事。
- H5 匿名 uid/pstats 等 localStorage 值都是 `{"type":"string|object","data":...}` 包装格式，切换测试身份必须写包装格式，否则页面读不到。

## R3 审查轮新经验
- 生产站有 Service Worker（/sw.js，拦截所有同源 GET 含 navigate）：SW 线程一旦挂起，/admin 及所有同源导航会永久 pending（curl 正常但浏览器转圈、渲染进程 JS 无响应）。解法：在任一还活着的同源 H5 tab 里执行 `navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))` 后重开标签页。管理台「退出登录」点击后曾触发此挂起。
- /admin 静态资源版本号自 PR#130 改为文件 mtime（`core.js?v=<epoch>`），HTML `cache-control: no-cache`——普通刷新即拿新脚本，不再需要强刷。注意 `curl -I /admin`（HEAD）返回 404，探活要用 GET。
- 抽题正确性 API 断言要点：默认路径真题≈60%（`round(limit*0.6)` 从 real 层抽）、花生讲解层优先（has_hs DESC）、`exclude=set(done)` 按 uid 去已答；grouped 资料分析按 `material_hash` 分组、`group_seq` 形如 "1/5"。`mode=reinforce` 冷触仍可能 5s 级（未纳入 id 池预热）。
- 统计页「练习记录」读浏览器本地存储、不按 uid 隔离：切换 anonUid 测试时会看到旧身份的模考记录，与顶部按 uid 的「学习统计」不一致，核对以 `/api/exam/attempts?uid=` 为准。
- 迷你模考交卷时立即截图可捕捉「判分中…」toast（无需网络节流）；错题删除可直接 `DELETE /api/mistakes/{id}?uid=`。

## R4 回归轮新经验（PR#132 后）
- sw.js 已升 v2（CACHE `kg-shell-v2`）：不再拦截 /admin、/tiku、/s/ 导航，SPA 导航 fetch 有 8s 超时兜底。验证激活版本用 `navigator.serviceWorker.getRegistration()`（active.state=activated）+ `caches.keys()` 含 kg-shell-v2；v2 activate 会自动删 v1 cache。
- 若此前用 unregister 强杀过 SW，Chrome profile 的 SW 子系统可能进入卡死态：registration 存在但无 worker，`register()`/`unregister()` 均永久挂起。解法：重启整个 Chrome（保留 user-data-dir 即可），重启后自动装上新 SW。
- 重启 Devin 托管 Chrome：从 `/proc/<pid>/cmdline` 取原 argv（user-agent 含空格，不能整串丢给 bash），kill 后用 python subprocess.Popen 按 argv 重启，DISPLAY 用 `ls /tmp/.X11-unix`（通常 :0）。
- `/api/checkin/summary` 的 days/today_n/streak 自 PR#132 起 = answer_log + review_log 合并，复习作答计入今日已练；`cleared_today` 只数当日 review_log correct=1。
- 统计页「练习记录」自 PR#132 起按 uid 隔离：写入带 uid，展示按当前 anonUid 过滤；存量无 uid 记录会在首次打开统计页时一次性归属当前身份（测试切身份前注意先备份 practiceHistory）。
- HEAD /admin 已修复返回 200，可直接用 HEAD 探活。

## SEO 页（/tiku/*）测试
- `/tiku/q/{id}` 详情页有 `lru_cache`：改 DB 后必须重启 uvicorn/容器才会反映新数据。
- 本地起后端可能需先 `pip install reportlab`（pdf_export 依赖）。
- sitemap/试卷页 HTML 为单行：统计 URL 数用 `grep -o '<loc>' | wc -l`，不能用 `grep -c`。

## R19 回归轮经验
- 箱内 Chrome profile 是 `~/.config/google-chrome-for-testing`，重启 Chrome 需带 `--user-data-dir` 指向它；重启后 kaogong localStorage 可能丢失，测前先备份（如 /tmp/*_ls_backup.json）再还原。
- 需要「答对指定比例」时：先 XHR monkey-patch 捕获 `/api/questions` 响应里的 answer 字段，再按字母点选（参考 /tmp/r19_answer.sh 模式）。

## R20 审查轮新经验（错题深链路/大赛/计划/组队）
- 手动录入/扫描答题卡测法：先在错题本筛选 sheet 导出错题卷拿卷码（H5 下 rememberPaper 写 recentPapers）；`pdftoppm` 转 PNG 后用 PIL 按答题卡框线坐标涂黑即可喂给 `/api/scan_sheet` 上传（OMR 识别可靠）。
- 组队入口在「我的」页；team API 为 `/api/team/create|join|leave|mine`。R25 起队长退出且队伍仍有人时 `creator_uid` 顺延给最早加入队员，末位成员退出才删除队伍。
- 模考大赛每周六 09:00-24:00（东八区）开赛，非窗口期只能测报名+空态。

## R30 审查轮新经验
- 迁移边界坑：注册合并 `auth.py` 的 `_UID_TABLES`/`_UID_PK_TABLES` 不含 `user_profile` → 匿名学习计划注册后丢失（R30 实证 P1）。测迁移时务必核对该表列 vs 实际数据面。
- R29 昵称清洗只在 team/pk create/join/share 写入路径；`api_team_panel` 用 `m["nickname"] or "匿名考友"`，字面 `'null'` 字符串是 truthy → 存量脏数据仍渲染「null」。测显示路径可直接 UPDATE 自己测试行昵称为 'null' 再刷新队页。
- 团队页正确路由是 `/pkgA/team/team`（不是 /pkgA/social/team——错误路由表现为整页空白且无 chunk 请求，容易误判为 chunk 挂起）。
- ~60s 请求停滞的量化证据：`performance.getEntriesByType('resource')` 里 duration≈60016ms，或点击后 API 请求 60s 后才发出（发出后服务端仅百余 ms）。记录 UTC 时间戳供 Caddy 对照，不要直接判服务端缺陷。
- 登出后本机 pstats 等缓存不清 → 匿名视图可能残留账号统计数字（DB 实为 0）；判断迁移隔离要以 DB/API 为准。
- shizheng 每日一练每答错 1 题自动进错题本（uid 归属当前登录账号）——清理时错题数按「行测错题+时政错题」总数算。
- Chrome 崩溃后 localStorage 回滚到 leveldb 上次提交态；崩溃恢复后先核对 anonUid 再继续，避免把原始 uid 的本机数据 merge 进测试账号（login/register 都会触发 merge_anon）。

## R25 回归轮新经验
- 错题删除只有 `DELETE /api/mistakes/{id}?uid=`（`POST /api/mistakes/{id}/delete` 不存在且静默无效）。
- 团队面板对本人显示「我」标签（is_me 优先于 is_creator）；验证队长身份需切队友视角或查 DB `teams.creator_uid`。
- 本地统计缓存键名即 `pstats`（不带 uid 前缀）；R25 起统计页/我的页累计口径以 `/api/growth` modules 服务端为准，清 pstats 不再归零。

## R7 走查新经验（/tiku SEO design-v3 + mastered_at 运行时）
- /tiku SEO 页 JSON-LD 仅题目页（/tiku/q/{id}）注入；列表/考点/试卷页 `_page(jsonld=None)` 不输出 script——验证 SEO 时不要按"每页都有 JSON-LD"断言。
- 「恢复复习」按钮不在 ··· action sheet（sheet 对已掌握项无该项），在已掌握 tab 点「点开看答案与详解」展开卡片后的操作行里。
- 取消掌握后 UI 可能显示旧帧（趋势卡仍 3/1），API 已即时生效；F5 后 UI 回落。以 /api/mistakes 为准再核 UI。
- 长驻 CDP daemon 会挂死；用 /tmp/cdp174/oneshot.py（每次从 /json 找 zalize tab 新建 ws）更可靠，偶发 timeout 直接重试即可。注意本机常开 localhost:8899 本地 tab，oneshot 按 URL 含 zalize 过滤，browser_console 工具则打到"当前活动 tab"，两者目标可能不同。
- 生产 tab 偶发被关闭/崩溃（/json 里消失）；重开 tab 后 localStorage（同源）仍在，先核 anonUid 再继续。

## R8 走查新经验（列表页 JSON-LD + 掌握即时更新）
- R8 起 /tiku/、/tiku/papers/、模块页、题型页均有 CollectionPage+BreadcrumbList JSON-LD（`_collection_ld`）——R7 段"仅题目页有 JSON-LD"的说法自 R8 起过时；断言时核对 breadcrumb.itemListElement 名称与可见 `.crumb` 文本一致即可。
- R8 起已掌握项 ··· action sheet 增补了「恢复复习」项（在「分享给队友」与「删除」之间），无需展开卡片。
- action sheet 里点「恢复复习」可能首次点击 sheet 关闭但 PATCH 未发出/未生效——点完立即查 /api/mistakes；若 mastered 仍为 1，重开 sheet 再点一次。PATCH 生效到 API 可见也可能有数秒~20s 延迟，判失败前多等再查。
- master() R8 已本地同步 m.mastered/m.mastered_at，趋势卡/摘要无需 F5 即时更新；toast（已掌握！/已恢复复习）持续极短，CDP 截图很难捕捉，靠趋势卡/API 证明即可，报告中如实标注 toast 未捕获。

## R9 走查新经验（load() _loadSeq 并发防护）
- R9 起 book.vue load() 有 _loadSeq 序号防护（L885/890/906），旧快照 GET 返回不再覆盖乐观更新——R8 段「首次点击可能不生效需重试」的现象在 R9 已修复；5 轮快速往返均首次点击即生效，API mastered/mastered_at 即时写入（无 R8 观察到的 ~20s 延迟）。
- 快速往返测试节奏：待掌握 tab（284,157）↔ 已掌握 tab（391,157），首条卡片 ···（575,260），6 项 sheet 第 5 项「标为已掌握/恢复复习」（460,393）。tab 切换后 sheet 项位置一致，可组合成单次 actions 序列高效执行。

## R10 走查新经验（桌面键盘快捷键）
- R10 起 book.vue 有全局 keydown（仅 H5 且 innerWidth≥1024）：列表 J/↓、K/↑ 移动 .kbf 蓝描边（outline 2px var(--brand)），Enter/空格=toggleCard；复习模式未作答 A–D=pick、已作答 Enter=nextReview、多选已选 Enter=confirmMulti。批量/弹层/庆祝页不响应；INPUT/TEXTAREA/SELECT/contentEditable 与 ctrl/alt/meta 不拦截；切 tab 时 kbId=null 描边清除。
- 验证 .kbf 用 `document.querySelectorAll('.kbf').length` + zoom 截图描边；描边较细，直接 zoom 卡片区域取证。
- 列表搜索框仅在 items.length>5 时渲染——错题少时测输入保护可展开卡片点「纠错」，用纠错 sheet 的 textarea 输入 jk（不要提交，避免产生服务端数据）。注意卡片需先展开，收起状态点「纠错」不会开 sheet。
- 复习键盘作答会真实推进 SRS/review 记录（服务端数据变化），只能在授权测试 uid 上做。
- 复习完成后出现庆祝弹层「今日复习已清零！」，toast「本轮复习完成！」在切视口截图时偶可捕获。
- CDP oneshot 在页面 reload 前后易连续 timeout：restore localStorage 脚本要循环重试并在执行后回读 `{n:localStorage.length,uid}` 确认再 reload，否则可能恢复未生效。

## R11 走查新经验（快捷键提示卡与速查面板）
- R11 起 book.vue 侧栏模块分组卡之后有 .kbdcard 提示卡（<1024 display:none），底部「按 ? 查看全部 ›」与 Shift+/ 均打开 .mask/.sheet 速查面板（三组：错题列表/复习模式/通用）；Esc、再按 ?、点遮罩、右上 ✕ 四种方式关闭；面板打开时其余快捷键（J/K/Enter）被阻断，可用 `{kbf:(document.querySelector('.kbf')||{}).id,mask:!!document.querySelector('.mask')}` 一次核对。
- 纠错 sheet 的 textarea 同样可用于验证 `?` 输入保护（Shift+/ 应输入字符 `?` 而不开面板），验证后点 ✕ 关闭不提交。
- 生产 tab 可能在长会话中崩溃关闭（CDP /json 里 zalize target 消失、oneshot StopIteration）：ctrl+t 重开生产 URL 即可，localStorage 同源保留；崩溃前旧 tab 的渲染可能停留在旧数据视图，以新 tab + localStorage 回读为准。
- console 监听脚本不要硬编码 target id（会 500 No such target）：每次从 http://localhost:29229/json 取当前 zalize page target 再连 ws。

## R12 走查新经验（刷题页桌面操作台）
- R12 起 practice.vue ≥1024px 有常驻右侧栏 .pside（答题卡题号网格 + 键盘提示卡，<1024 display:none），.wrap.pdesk 拓宽 1044px。网格状态类：cur=蓝框当前、ok=绿答对、bad=红答错、未答灰（acardClass L1433）。
- 键盘 onPKeydown（L1461）：A–D 仅未作答时 pick；Enter 已作答且非模考时 next；←/→ jumpTo；<1024、修饰键、INPUT/TEXTAREA/SELECT/contentEditable、任一弹层（cardOpen/toolsOpen/reportOpen/paperSheet/customOpen/setupOpen）均不响应。工具 sheet 阻断可用「开 ··· → 按 A → 已答数不变 → 关 ✕ → 按 A 生效」取证。
- 裸直达 #/pages/practice/practice（无启动参数）会按 lastModule 自动开练（onShow L678-681），新游客 uid 也能直达开练，无需从首页选模块；题库首次加载有数秒 loading。
- 「答对自动跳下一题」默认开启：按键答对会自动进下一题（无需 Enter）；答错停留在本题，此时才用 Enter 验证下一题。
- websocket-client 直连 CDP ws 需 `suppress_origin=True`，否则 403 Forbidden（Rejected origin）；旧 oneshot.py 若超时可改用 /tmp/cdp174/r12.py（已带 suppress_origin + 动态 target）。
- 模考态（examMode）不响应 Enter 由自动流转接管——普通练习流程无法触发，需真题卷模考入口，未覆盖时如实标 untested。

## R13–R15 走查新经验（真题卷库网格 / 统计 masonry / 全局壳拓宽）
- exam list `.plist`（R13）与 stats `.sgrid`（R14）的桌面双列断言法：computed columnCount/grid-template-columns + 各卡 rect.left 只应出现两个值；masonry 展开折叠项后重排属正常。
- 页面级 `max-width:1044px` 会被全局壳约束：≥1366px 壳体 1280px（R15 App.vue）内容区≈1068-1072；1024-1365px 壳体 1140px 内容区≈932。断言 wrap 宽度时按视口档取对应期望值。
- 滚动条 15px 使 `calc(100vw...)` 定位与壳体居中有 ~7px 理论差、scrollWidth 常为 1425(<1440)，均属正常非破版。
- 学习日历分包首载偶发 50-60s spinner + 「Async component timed out after 60000ms」，重试/等待后仍能渲染；筛选类 API 偶发 net::ERR_FAILED 重试即成功——报告时区分历史 console 回放与本次干净 reload。

## R16 走查新经验（我的页四分组 masonry）
- profile.vue ≥1024px：`.wrap.profile` max-width 1044（1440 下实测 1072）、`.pgrid` column-count:2、4 个 `.psec`（打卡徽章/学习/偏好设置/其他）left 两值各宽≈514(1440)/444(1280)；账号卡/资产行/退出/页脚在 .pgrid 外整宽。375 下 columnCount=auto 单列。页高 1440 实测 1049（改前 ~1557）。
- 游客态即可覆盖全部交互：每日目标 cell 点击 20→50→100 循环 + toast；锁定徽章点击 toast「连续打卡 N 天即可解锁」；未登录账号卡点击 → /pkgA/user/login；学习日历/我的收藏 cell 正常 navigateTo。已解锁徽章→poster 分支需有打卡数据的 uid 才能触发。
- CDP ws 偶发连续 2 次 recv timeout（r12.py），间隔几秒重试即恢复，无需重开 tab。

## R18 申论专区走查新经验
- 申论路由 `#/pkgA/shenlun/shenlun`，桌面断点 ≥768 sheet 居中 / ≥1024 两列（1440 列宽 498px、1280 列宽 442px；详情 d-cols row、d-right sticky）。375 回退：qgrid/mgrid display=block、mask align-items=flex-end（贴底抽屉 sheet.bottom=视口高）。
- 草稿存 `slDraft:{qid}`（localStorage，不写服务端）；批改 POST /api/shenlun/grade 会写服务端历史（游客 uid 可用）。生产文字 LLM 已恢复后批改可真实出结果（1-3 分钟）。

## R19 收藏与笔记页走查新经验
- 路由 `#/pkgA/social/favorites`。桌面断点：≥768 `.wrap` max-width 1044（1440 壳实测 1068、1280 壳 932）；≥1024 `.fav-cols` flex、`.fav-left` 300px sticky、`.ngrid` 笔记两列（1440 列宽 510px）。375 回退：`.fav-cols` display=block、fav-left 全宽 351、上下堆叠。
- folder 行 `···`（.fops）是 H5 条件编译入口，仅自定义夹（f.id 非 0）显示，移动宽度也显示；点它弹 actionSheet（重命名/删除）。默认夹无 `···`。
- **收藏页 API 可能瞬时极慢（实测 62s）**：新建夹/删除夹后 UI 「加载中…」滞留或新夹不显示 ≠ 失败——第一次 POST 往往已成功（重试会 409「已有同名收藏夹」），用 `performance.getEntriesByType("resource")` 看 /api/ 耗时，再 F5 核对。
- 收藏数据自建：练习页星标 toggleFav；答对题在解析 q-social-bar「📝 写笔记」写笔记（需题有 id）。部分收藏为 `_local`（存 favQuestions 本地），展开卡只有「取消收藏」无「移动到…」，取消走 localStorage 无 XHR——别误判请求丢失。
- **页面 F5 会清掉 CDP 的 setDeviceMetricsOverride**（视口回壳宽）；每次 reload 后需重新 `r12.py metrics W H` 再取证/点击，否则坐标全错。XHR hook 也随 reload 丢失需重装。
- 部署后首次 reload 可能仍是旧 bundle，需 Ctrl+Shift+R 强刷并等待异步加载后再核对 script src。
- 多 tab 时 r12.py 需按 URL 关键字（如 shenlun）选 CDP target，否则可能连到别的页面。

## R21 面试陪练/模考大赛走查新经验
- 面试页 `/#/pkgA/interview/interview` 三步态：分类（.cat-list ≥1024 grid 两列）→ 作答（.iv-cols flex，.iv-left 420px sticky）→ 报告（.rp-cols flex，.rp-left 420px）。提交按钮 ≥20 字启用；真实考官点评 LLM 流式约 2-4 分钟，报告页先出五维评分再流式点评，等 `生成中` 字样消失判定完成；「参考思路要点」在流式结束后才渲染。
- 模考大赛 `/#/pkgA/exam/contest`：≥1024 .ct-cols flex、.ct-side 360px sticky；榜单 .sheet max-width 560px 但 box-sizing 是 content-box，含 padding 视觉宽约 588px——按 clientWidth-padding 断言 560，勿误报。375 下 mask align-items=flex-end 贴底抽屉。「预约报名」会写服务端报名数据，走查时禁点。
- `location.reload()` 后 CDP 视口覆写可能被清且紧跟的 metrics 调用会竞态失败（ws timeout）——reload 后 sleep 数秒再重试 metrics 并回读 innerWidth。

## R20b 搜索页桌面化走查新经验
- 路由 `#/pkgA/search/search`。≥1024 且 tab=全部 且有考点/试卷命中时 `.res-cols` 加 `two` 类（flex 双栏：`.res-side` 300px sticky + `.res-main`）；tab≠全部或无侧栏命中时 `two` 不加、display=block 单列。**注意 375 下 `two` 类仍可能在（class 绑定只看 tab/hasSide），单列由媒体查询保证——判据看 computed display 而非 classList**。
- 好用的搜索词：「成本」命中考点(利润折扣/最优方案)+21 题；「国考」命中试卷；纯题号 code（如 1274894）只命中题目→验证 hasSide=false 单列。
- 中文搜索词输入：用 CDP 原生 value setter + dispatch input 事件最可靠（xdotool type 中文不稳）。
- 干净 console 检查若需指定视口：在同一 CDP ws 会话里先 `Emulation.setDeviceMetricsOverride` 再 `Page.reload`，override 会随本次 reload 保留（脚本 `/tmp/cdp174/console_clean_vw.py W H`，会回读 innerWidth 验证）；而普通 F5/其他会话 reload 会清掉 override。

## R23 真题做卷页/成绩报告页走查新经验
- 做卷页 `#/pkgA/exam/exam?mini=1`（迷你模考 30 题 30 分钟，游客可开卷；会写 attempt 数据，务必用新游客 uid）。进入时若本地有未交卷进度会弹「继续上次模考？」——点「重新开始」开新卷，属正常流程非 bug。
- ≥1024 桌面态：`.ex-cols` flex、`.ex-side` 320px sticky 常驻答题卡（倒计时/题号 grid/已答统计/交卷/快捷键提示）、navrow position=static 且 `.acard-btn` display=none；<1024 时 ex-side display=none、navrow fixed bottom 含「答题卡」按钮、答题卡浮层 mask flex-end 贴底。
- H5 键盘（复刻 R12 practice）：A-D 选中即自动跳下一题、←/→ 翻题、Enter 下一题/最后一题交卷；焦点在 body 即可，xdotool key 直接可用。
- 交卷有确认 modal（提示未答数量），确认后判分并 redirectTo `#/pkgA/exam/report?attempt_id=N`——report 页可用该 URL 直接重进（换视口取证方便）。
- 报告页 ≥1024：`.rp2-cols` flex、`.rp2-side` 420px sticky 在左（分数 hero+排名+模块得分）、`.rp2-main` 右（历次成绩/薄弱考点/逐题）；≥768 逐题解析弹窗 mask center + sheet 640px、`.wrow` hover soft-bg；<768 解析退回贴底抽屉。
- 页面刚加载或恢复弹窗未处理完时跑几何 eval 会因元素为 null 报 TypeError——先截图确认题目渲染完再量。

## R32 讨论页「消息」入口走查新经验
- R32（bundle index-BHj4cLVt.js 起）讨论页 chips 行右侧新增「消息」入口（.msg：铃铛+文字+v-if unread 的红色 .msg-badge）。unread 含 reply+like 双流，B 回复+点赞会让 badge 显示 2 而非 1，属预期。
- 守卫判据：游客态 performance.getEntriesByType("resource") 无 /api/comments/inbox 即未发请求；点击入口应弹「需要登录」modal 而非跳 inbox。
- 从 inbox 点左上返回箭头回讨论页，onShow 重拉 unread，badge 应立即消失（进 inbox 即打读水位）。
- 375 挤压判定：取 .msg 与 .cnt 的 getBoundingClientRect，gap>0 且 sw==375 即无挤压/溢出。

## R33 讨论广场走查新经验
- R33（bundle index-QbEsMS27.js 起）：GET /api/comments/plaza 游客可直接 curl 验证（按题聚合 ok 评论，last_at 倒序）；C 端入口在首页「更多练习」grid 末尾「讨论广场」卡（home.vue goPlaza），页面 /pkgA/social/plaza，≥1024px .list 为 grid 两列（computedStyle gridTemplateColumns 出两值），窄屏 flex 单列。
- CDP 多 tab 陷阱：按 'zalize' 过滤 tabs 会同时命中 /admin 管理台 tab，Emulation 清除/设置可能打到错误 tab——脚本应额外排除 '/admin'；且 clearDeviceMetricsOverride 后需 location.reload() 才恢复真实 innerWidth。

## R34 解析区热评卡走查新经验
- 在刷题页命中指定 qid 的通用方法：`/api/search/question/{id}`（需 curl 带默认 UA，python urllib 直连会 403）取完整题对象，CDP 写 localStorage `redoSet`（uni 包装 `{"type":"object","data":[题对象数组]}`），再开 /pages/practice/practice 即以该题组开练；可放「有评论题+无评论题」两题同时覆盖热评卡与切题清空。
- 刷题页答对会自动跳下一题——要看解析可用 ← 键回上一题（解析状态保留）；热评卡 .hotc 位于解析区「写笔记/讨论(n)/分享给队友」行下方，count>0 才发 `/api/comments?sort=hot`（performance 资源列表可作零请求证据）。
- 刷题页 reload 后会弹「继续上次练习?」对话框，且离开再进其他页面也可能弹——测试收尾应清 localStorage 的 redoSet/practiceSession/practicePreset/practiceLaunch。
- 游客态请求会带 uid=保护 uid 参数（只读 GET 无害），mutation 类操作绝不可在该态执行。

## R35 /tiku SSR 考友讨论区块走查新经验
- /tiku/q/{qid} 为 SSR 纯 HTML，可先 curl grep「考友讨论（N 条）」「参与讨论（免费）」「discuss?qid=」做数据前提确认，再浏览器取视觉证据；无评论题应 grep 0 命中（含 QCOMMENTS 占位符——占位符残留即注入断）。
- 区块位置：相似题「同考点相似题」卡之后、页脚之前；CTA 是 SPA hash 链接（#/pkgA/social/discuss?qid=），点击后直接落 App 讨论页。
- 地址栏陷阱：ctrl+l 后 type URL 可能被历史自动补全劫持（回车进了补全项）；输前缀后按 Delete 删除内联补全再回车，或点击地址栏+ctrl+a 重输。
- CDP Emulation override 在 websocket 断开后即失效——需要保持视口的交互期间脚本不要 close 连接，或每步重设；console_clean_vw.py 报的 VW 才是 reload 时真实生效宽度。

## R36 抢首评引导条/focus 直达走查新经验
- q-social-bar 状态判据：DOM 查 `.firstc`（count===0 引导条）与 `.hotc`（count>0 热评卡）数量即可量化互斥（应恰一为 1、另一为 0）。
- 聚焦断言别只看截图：用 CDP `document.activeElement===document.querySelector('input.uni-input-input')` 佐证；游客态应为 BODY，登录+focus=1 约 300ms 后应为 INPUT。
- practice 页 reload 会把当前会话重写回 practiceSession——想重进 redoSet 题组，必须先导航离开 practice（如首页），再 removeItem('practiceSession') + 注入 redoSet，最后重开 practice；页面开着时清 storage 会被页面回写覆盖。
- 用 tty 后台脚本保持 375 override 时，测完务必 kill 该 shell，否则后续页面（含 SSR 页）会一直窄渲染；kill 后需 Ctrl+Shift+R 恢复真实宽度。
- 登录 A 后回刷题页测题组，可用键盘 ← 回上一题看解析；答错停留当前题更省事（选明显错项）。

## R37 /tiku/discuss/ 考友热议聚合页走查新经验
- 数据前提 curl 判据：`/tiku/discuss`（无斜杠）应 301 → `/tiku/discuss/`；页面 grep「考友热议题目（N 题）」「/tiku/q/{qid}」「进入讨论广场参与互动」；首页 `/tiku/` grep「考友热议题目 →」；`/sitemap-pages.xml` grep `/tiku/discuss/`。
- 首页入口链接在段落尾部会随文案换行断成两截（如「考/友热议题目 →」跨行）——点击要瞄准链接文本本体（第二行行首），点段落空白处不会导航。
- SSR 卡片题干 h2 链接点击也要点在文本上；点卡片留白不导航（整卡非链接，与 App 端整卡可点不同）。

## R38 讨论页多行 textarea 走查新经验
- uni-app 的 `<textarea class="ipt">` 渲染为 `UNI-TEXTAREA` 自定义元素：`document.querySelector('textarea.ipt')` 命中 0，正确取法是 `document.querySelector('.ipt')`（wrapper）+ `w.querySelector('textarea')`（真实 textarea）；聚焦断言 `document.activeElement.tagName==='TEXTAREA'` 仍直接可用。
- auto-height/封顶判据：wrapper `clientHeight` 单行约 52px、逐行长高、封顶 120px（240rpx@2）；封顶后 `textarea.scrollHeight > clientHeight` 即内滚生效。
- 回车不发布判据：多次 Enter 后列表 `.tx` 数量不变、页顶「共 N 条讨论」不变即可，无需抓包。
- ASCII 多行内容可直接用 computer type + Return 原生输入（中文才需 native setter），能同时天然验证「回车=换行」。
- 删除评论/回复：每条的「删除」链接→弹「删除这条讨论?」确认框点「确定」；回复需与顶层评论分别删除（非级联一键）。
- 坑：清 authToken/authUser 后浏览器另一 localStorage key 里 uid 仍是 u27，干净重载会出一条 `api/comments?...uid=u27` 403 console error——先跑 `restore_ls.py` 恢复保护 uid 再做 console 干净重载检查即可回 0 error。
- practice?mode=redo 若打开的是残留 10 题会话而非注入题组：清 practiceSession → 重跑 r34_redoset.py → reload（同 R36 坑）。

## R39 账号 uid 403 自动脱困走查新经验
- 卡死态制造法：登录后仅删 authToken/authUser、保留 anonUid=u<id>，F5 即触发首个 403；伪 token 态则把 authToken 设为 `{"type":"string","data":"xxx"}`（uni storage 包裹格式）。
- 保护 uid 隔离手法：**登录前**先把 anonUid 设成一次性随机值（uR39tmp…），登录 merge 与 deviceAnonUid 只关联该一次性值，保护 uid 全程零关联；收尾删 deviceAnonUid 后跑 restore_ls.py。
- 复位判据：clearAuth 后 anonUid=deviceAnonUid（有）或删除（无，下次随机再生 L266-273）；「后续请求 200」用页面内点「最新」排序 tab 触发新 fetchComments 取证（performance.getEntriesByType('resource') 读 responseStatus）。
- toast「登录已过期，请重新登录」duration=2500ms，F5 后 ~1.5s 内截图可稳定捕获。
- 复位当页 Vue 的 logged 状态是 mount 时算的，clearAuth 后输入框 placeholder 可能仍显登录态文案，再刷新才更新——非 bug，断言以 storage/网络为准。
- 收藏页路由是 `#/pkgA/social/favorites`（不是 /pkgA/user/favorites，后者白屏）。
- 375 视口 override 随 CDP ws 断开即失效；要拍 375 截图需后台脚本保持连接（hold375.py 模式），拍完 pkill。

## R40 查询收敛（N+1→单 SQL）类后端-only 改动走查经验
- 这类「响应结构/语义不变」的 perf 改动，UI 断言锚点靠**逐卡配对**：先 curl `/api/comments/plaza` 与 `/tiku/discuss/` 记下每张卡的 题干↔模块↔cnt↔最新评论昵称/内容 配对与 last_at 倒序顺序，再在浏览器逐卡核对——JOIN 错配会表现为字段跨题串行，而非页面报错。
- App 讨论广场入口：首页滚到「更多练习」网格最后一张卡「讨论广场（考友热议·每题讨论）」，点击直达 `#/pkgA/social/plaza`；广场整卡可点跳 discuss?qid=。
- 已知讨论数据锚点（截至 R40）：三题 243872（R25 评论）/427044（考友0001）/319808（测试小助手），plaza 与 SSR 页应同为这 3 卡同序。
- 地址栏输入 kaogong 首页 URL 极易被历史自动补全劫持到 /tiku/q/243872——输入完整 URL 后补一个多余字符再 Backspace 可绕过补全。

## R41 authChanged 全局广播走查新经验
- R41 起 setAuth/clearAuth 末尾 `uni.$emit('authChanged')`，discuss/profile/stats onLoad $on：403 复位后**当页不刷新**即时更新（placeholder 变「登录后参与讨论」、账号卡变未登录）——R39 记录的「刷新才更新」滞后已消除，旧断言注意更新。
- 大坑：hash 路由 SPA 已加载的旧 bundle 常驻内存，仅 hash 导航不换 chunk——部署新 bundle 后先 `Ctrl+Shift+R` 硬刷新，否则新监听不存在会误判失败。可 curl 生产 index 确认 bundle 名、curl 对应 pkgA-social-discuss.*.js 确认含 `authChanged`。
- 即时更新取证法：登录态打开 discuss → CDP 只删 authToken/authUser（保留 anonUid=u<id>）→ 页内点「最新」tab 触发 403 → 无需刷新观察 toast+placeholder 同帧变化，前后截图对比。
- profile 页无被动请求时，切到 stats 再回来或直接看账号卡即可（profile/stats 均为监听者）。
- 讨论页游客守卫弹窗「需要登录」的「去登录」直达 login 页，登录成功自动返回 discuss 且 placeholder 已是登录态（广播+onShow 双保险）。

## R42 掌握度地图（mastery-map）走查新经验
- 冷启动阈值 need=30 来自 `/api/mastery/map?uid=`；解锁最快法：一次性游客 anonUid → practice 页键盘 A/Enter 连按（每组 10 题，「再来一组」续组）。
- **大坑：后端 `_MASTERY_CACHE` 60s 进程内缓存**（db.py MASTERY_CACHE_TTL=60）——刚答完题 map 页仍显旧 n_total/cold 态，等 60s 再刷新即可，勿误判为作答未入库。
- 桌面（≥1024）判据：`.side-nav` display:block/width 220/sticky、`.tabs` display:none、首行 `.tile` 5 个 cursor:pointer、点格 `.sheet` w=720（含 padding 744）translateX 居中（左右差≈滚动条 15px 属正常）、`.cold` max-width 560 且作为 .page flex 子项内容收缩（宽<560 也正常，看页内左右 margin 相等即居中）。
- 375 判据：side-nav display:none、tabs block、首行 tile 3 个、sheet x=12/rightGap=12 横贯。
- 桌面 .page 有全局壳层偏移（x≈288/w≈1072 @1440），居中断言要相对 .page content box 算，不能只看 viewport 左右 gap。
- 「练 10 题」写 practiceLaunch 跳 practice；出题接口偶尔 10s+ 慢加载（页面显「网络较慢」），耐心等待勿重试。
- 坑：`pkill -f xxx.py` 若命令串含同样文本会杀掉自己的 bash（exit -1）——改用 pgrep 找 pid 再 kill，或 pattern 避开自身命令行。

## R44 深色模式走查新经验
- 深色开关：`localStorage.setItem('themeMode','dark')` 普通字符串+刷新（html 挂 `.theme-dark`）；测后 `removeItem('themeMode')`。
- 原生导航栏返回箭头断言：选择器 `uni-page-head .uni-page-head-btn path` 的 computed fill（深色 rgb(242,243,247)、浅色 rgb(0,0,0)）。
- CDP 后台 python 脚本 print 需 `-u` 或 `flush=True`，否则 sleep 持连时输出被缓冲。
- `pgrep/pkill -f` 的模式若出现在本 shell 命令串会匹配自身导致自杀（exit -1）：用方括号转义（如 `pgrep -af 'holdv[w]'`）或先定位精确 PID 再 kill。

## R47 内联关键 CSS 走查新经验
- 断言「无 stylesheet link」须区分静态与运行时：curl 静态 HTML 应为 0 link/3 段 `<style>/* inlined: ... */`；SPA 启动后 Vite 会为懒加载 chunk 动态插入 `link[rel=stylesheet]`（l-icon/wd-*/home-*.css 等，首页约 6 个）——这是预期行为，非内联失败。运行时判据应改为「无 uni./index-/zalize-tokens 关键 CSS link」+ inlined 标记 3 个。
- 内联 tokens 生效判据：`getComputedStyle(document.documentElement).getPropertyValue('--zl-brand-600')` 应为 `#2e5bff`（深浅色皆然）；深色 bodyBg=rgb(21,22,28)、浅色 rgb(246,247,251)。

## R304 成绩海报走查新经验
- Canvas 海报类功能的 QR 客观取证法：img.src 为 data:image/png;base64 时，base64 落盘 PNG 后用 `zbarimg -q <file>` 解码二维码落点（`sudo apt-get install -y zbar-tools`），不要目测推断。
- uid 注入的 localStorage 实际键为 `anonUid`（api.js anonUid() 读该键），不是 `uid`。
- 模考报告接口为路径参数 `/api/exam/report/{attempt_id}?uid=`；成绩在 `attempt.score`，顶层无 score。

## R308 走查新经验
- 生产 DB 清理可走 TICKETS_VPS_SSH_* 环境变量 + `sshpass -e ssh … "docker exec -i deploy-kaogong-1 python3 -"` 内联脚本：全表 PRAGMA table_info 扫 uid/user_id 列按测试前缀 DELETE，并回读 leftover=0。
- 报告页键盘断言注意：逐题 75 个对错圆圈均在 Tab 序列内，Tab 至页尾 CTA 需 ~75 次；用 CDP Input.dispatchKeyEvent 循环 + activeElement 轮询客观定位目标。
- 卷库横滚 chips 行（年份/地区 scroll-view）滚动后各 chip 屏幕坐标会变：点击前先截图核对当前坐标，误点后用「全部年份/全部地区」复位；「全部刷完 🎉」分支可在生产安全构造——选一个仅含 1 张已考卷的 year+region 范围即可。
- 模考交卷 API 的 picks 以题号（1 起）为 key、选项字母为值（如 `{"1":"A",…,"75":"A"}`）：全选 A 可稳定得到 >0 分，配合空 picks 0 分即可构造同卷高低分双 attempt，验证 best_attempt_id 类契约。

## R312 纠错弹层走查新经验
- computer type 向 uni-app textarea 键入中文可能丢字（仅落 ASCII）；可改在页内对聚焦元素执行 `document.execCommand('insertText', false, '中文内容')`——会触发 input 事件、v-model 正常更新，提交内容以 DOM value 回读为准。

## R314 错因自评走查新经验
- 注入临时 uid 时 `anonUid` 必须存纯字符串（`localStorage.setItem('anonUid','test-xxx')`）；存 JSON 包裹形式会被 api.js anonUid() 原样当 uid 拼进请求，报告页表现为「暂无成绩报告」空态。
- 错题本 book 页的错因 chips 只在复习流答错后出现；快速同源取证可直接看侧栏「按错因」聚合卡计数，不必走完整复习流。

## R316 标记贯穿走查新经验
- 做卷页点选选项会自动跳到下一题：需要「答某题并标记」时应先点「标记」再选选项（或标错后用顶部标记按钮当场取消）。
- 解析浮层底部导航（.dnav-mid/.dnav-btn）屏幕坐标随浮层内容高度浮动：点击前用 CDP 读 getBoundingClientRect 并按「屏幕x≈css_x*0.64, 屏幕y≈css_y*0.64+88」（1600 视口最大化窗口）换算，避免点到遮罩误关浮层。

## R317 跨设备续考走查新经验
- 跨设备/多身份场景可用 CDP `Target.createBrowserContext` + `Target.createTarget` 建全新隔离浏览器 context（helper /tmp/cdp174/devb.py），给新 context 的 URL 加 `?devb=1` 之类标记便于按 URL 选 tab；所有按 `'zalize' in url` 选 tab 的老 helper 会误选新 context 的 tab，多 context 时必须加排除过滤。
- 新 context 是独立 Chrome 窗口：不要用 ctrl+w（会整窗关闭销毁 context）；硬刷会清掉 CDP 设的模拟视口，需要重施。

## R318 逐题用时同步走查新经验
- SPA 内部路由跳转会抹掉 URL 上人为附加的 `?devb=1` 之类标记，按 URL 过滤 tab 的 helper 会失配：可用 `history.replaceState(null,'',带标记的URL)` 无副作用重打标记，或改按 targetId/浏览器 context 选 tab。
- 做卷页当前题计时在切题时才 flush 到 `_secs`：验证 secs 上报必须答完并切到下一题后再抓去抖 POST 包，否则当前题秒数尚未计入 payload。

## R319 长按排除干扰项走查新经验
- uni-app H5 的 longpress 由 touchstart 起 350ms 定时器派发（单指、位移 <10px）；CDP 自动化长按用 `Input.dispatchTouchEvent touchStart → 等 ≥500ms → touchCancel`——必须以 touchCancel 结束而非 touchEnd：touchEnd 会补发合成 click 触发选项 pick，把刚排除的选项又选中（真机手指长按无此 click）。helper 存 /tmp/cdp174/longpress.py（参数：选项 0-based 序号）。

## R321 刷题页排除干扰项走查新经验
- 刷题页 `pendingSession` 仅在作答/`next()` 等路径 `saveSession()`（R321 后长按排除也触发保存）；方向键 `jumpTo()` 不保存——验证刷新持久化时若走旧 bundle 或依赖 jumpTo 切题，可能得到假失败，先作答一题或长按排除后再刷新。
- 伪造/校验 uni storage 键（如把 ppClearedAt 改为过去时间模拟 30s 守卫过期）必须读写包装格式 `{"type":"number","data":<ms>}`；直接 `localStorage.getItem` 断言原始数字会得到 null/误判。
- 多 tab CDP 场景：devb 隔离 tab 一旦整页导航会丢失 `?devb=1` URL 标记，「取第一个 zalize tab」的 helper 会命中错 tab——应记录 `Target.createTarget` 返回的 targetId 并按 id 定向连 WebSocket，勿依赖 URL 标记。

## R324 Web Push 走查新经验
- 定向发推送必须用 `docker exec deploy-kaogong-1 python -c "from app.push_api import _send_daily; _send_daily(only_endpoint='<ep>')"`（只发该 endpoint 且不写 push_last_day 水位）；**绝不裸调 `_send_daily()`**，会推给全体订阅用户。
- 订阅入口：我的→学习提醒（/#/pkgA/settings/reminders）→「每日一练离线推送」switch。先 CDP `Browser.grantPermissions`(notifications) 再点开关；首次点开关可能不落订阅（perm granted 但 endpoint=null），可在页面内手动 `reg.pushManager.subscribe()` 打通后再点 UI 开关即成。endpoint 从生产 `push_subs` 表查。
- 通知点击→SW `notificationclick`→`c.navigate(url)` 只对**被 SW 控制**的页面窗口生效：硬刷（Ctrl+Shift+R）后页面 `navigator.serviceWorker.controller=null`，点通知会消费掉但不导航——先普通刷新确认 `controlled:true` 再点；并关掉多余同源 tab 防止 navigate 落错窗口。
- 后端「今日」用 CN_TZ（Asia/Shanghai）`strftime('%Y-%m-%d')`；SSH 造 `daily_set_entries` 行时勿用 sqlite `date('now')`（UTC），日期可能差一天导致分支误判，应在 python 里用 `datetime.now(CN_TZ)` 生成 day。
- 错题到期口径 `db.due_review_count`：mastered 空/0 且 next_review 空或 <=now；SSH 改 `mistakes.next_review` 到过去/未来即可切 due>0/due=0。

## R325 字号三档走查新经验
- 字号口径统一在 `frontend-uni/src/font-size.js`（Q=[26,30,34]rpx、OPT=[25,29,33]rpx，1440 视口折算 .q=13/15/17px、.otext=12.5/14.5/16.5px）；断言用相邻档 computed fontSize 严格递增，勿只看单档。
- **`uni.getStorageSync('fontLv') || 1` 会把合法的 0（小档）吞成 1**——exam/book/practice/profile 均如此，测「小」档必然回落标准；这类 falsy 陷阱在其它数值型 storage 键也可能出现，遇到 0 值不生效先查 `||` 兜底。
- 做卷页 `pkgA/exam/exam.vue` 有未交卷 attempt 时进页会弹「继续上次模考？」uni-modal，此时 `.q/.otext` 查询返回 null——CDP 度量前先查 `!!document.querySelector('uni-modal')` 并先在 UI 上处理弹窗；临时 uid 若开过卷未交，后续任何进 exam 页（含刷新）都会弹。
- 错题本列表态 `.q`（约13px）不绑字号，复习态 `.q`/解析 rich-text 外层才绑——量错元素会误判「列表态被影响」。

## R329 会话同步删除类功能走查新经验
- 测删除/清除类功能务必抓包核对响应码而非只看 UI：失败静默口径下 DELETE 503 时 UI 照常本机移除，但服务端残留，刷新后条目会从远端重新同步「复活」——UI 断言应配合刷新后复核 + GET 服务端回读。
- 生产同机 recruit 负载（postgres 长查询+pip install）过载时 503/health 超时可持续 10+ 分钟，watchdog 会自愈；遇到时每几分钟重试即可，勿误判为被测代码问题。

## R332 进行中会话跨设备同步（/api/ask/cur）取证口径
- storage 键名是 `anonUid`（驼峰），不是 `anon_uid`——R328/R332 两轮都踩过，注入前先 `localStorage.getItem('anonUid')` 核对。
- 进行中态最省构造法：API 造数一条 ask_sessions 历史会话（POST /api/ask/sessions），真实 UI loadSession 恢复即产生进行中态并触发去抖回传，无需触发 /api/explain。
- cur 同步断言四件套：A 去抖 POST /api/ask/cur body 含 sid+非空 items；B（无本机快照隔离 context 同 uid）打开 ask 页自动 GET 并无点击回填；A 硬刷本机优先 0 次 GET；「新对话」POST items:[] 后对端硬刷空态。
- askCurSid 恢复断言用 CDP 读 storage：`uni` storage 实际落 localStorage，键 `askCurSid`。

## R334 收藏页 AI 入口走查新经验
- 收藏造数最省路径：`POST /api/favs {uid, question_id}`（题 id 可用 1274831），收藏页即显「默认收藏夹 1 题」，无需真实 UI 刷题收藏。
- Lighthouse 需用 `npx --no-install lighthouse`（PATH 无全局 bin），headless flags `--headless=new --no-sandbox`。
- 375 视口 holder 结束后 `Emulation.clearDeviceMetricsOverride` 需再 `Page.reload` 一次才真正恢复桌面宽度（首次 clear 后 innerWidth 仍 375）。

## R337 「回看 AI 详解」多场景走查新经验
- ask 页是常驻 tab：`restoreCurSession()` 在 `results.length` 非空时直接 return——仅改 storage 里的 `askCurSession` 后切回 ask tab 内存态可能不刷新，注入快照前必须让整页硬刷再断言。
- 复杂中文/嵌套 JSON 注入 localStorage 勿用 shell 单引号 oneshot（引号/转义必坏）：用 Python WebSocket 脚本 + `json.dumps(json.dumps(snap))` 双重编码后经 `Runtime.evaluate` 注入。
- `pkill -f <脚本名>` 可能匹配并杀掉承载它的 bash 自身：先 `pgrep -f` 过滤确认，或用精确进程名/记录 pid 后 kill。

## R338 刷题/错题本回看入口走查新经验
- ask 常驻 tab 的 onShow 会把内存中的会话列表**回写覆盖** localStorage 的 `askSessions`——切到 ask tab 一次后再断言注入数据会发现被清空。正确顺序：注入 → `location.reload()` 整页硬刷 → 再走 UI；切 tab 触发 onShow 不算安全。
- 刷题页练习中界面隐藏侧栏 tab，切页需先点右上「退出」回刷题首页；重进用「去继续」可恢复会话与作答态（含解析区）。刷题页 computed（如 curAskSeen）依赖 askSeenTick/cur，注入 storage 后按 →/← 换题一次即可强制重算，无需整页刷新。
- 展开卡内小按钮（.op）点击易差几像素命中卡片本体导致收起：先 CDP 读 `getBoundingClientRect()` 换算工具坐标再点（1600 实宽→1024 工具坐标 ×0.64，浏览器 chrome 顶部偏移约 157 实 px）。
- 验证 `@click.stop` 不收起卡片的客观方法：CDP 给 `.mcard` 挂 bubble 阶段计数 listener，UI 点击子按钮后读计数=0 即证明冒泡被阻断（book onShow 会 reload 列表重置 open 态，返回后卡片收起不能作为反证）。
- 造「无命中」错题反例最省路径：CDP 只读 `cur.answer` 后 UI 故意点错选项，错题自动入本（无需 API 造数）。

## R339 查看原题反向深链走查新经验
- 清空服务端 ask_cur 的可靠路径是走 UI「新对话 → 删除新归档会话」：直接删本机 askCurSession 后 reload 会被 `GET /api/ask/cur` 从服务端拉回，越清越回。

## R340 错题本错因筛选走查新经验
- 错因打标最省 UI 路径：错题本「开始复习」→ 答错后点「错因自评」chip（book.vue 复习流，自动 PATCH /api/mistakes/:id 持久化），无需手工 curl。
- 服务端清理可复用模式：docker cp 或容器内 python sqlite 按 `uid LIKE 'test-<round>-%'` 扫 16 张业务表；刷题+复习场景最常见写入面是 mistakes/answer_log/review_log/growth_events 四表。

## R341 报告错因画像走查新经验
- 抓包 daemon 复制 r335 模板时必须检查 URL 白名单：旧模板只捕 track/explain/practice/answer_log/ask，模考交卷与 /api/mistakes PATCH 会静默漏抓——直接用 `PAT=('/api/',)` 捕全量。
- 「无错题报告」反例最省真实 UI 路径：mini 模考 0 答直接交卷（picked 空 → reasonRecap/redoCount 均不渲染），无需 CDP 注入。

## R342 重练错因过滤走查新经验
- report 深链为 `/#/pkgA/exam/report?attempt_id=<id>`；地址栏输入 hash 深链不触发 onLoad，需再硬刷一次才加载。
- `redoSet` 被 practice 页消费即删：重练集合断言不要读 storage，改核对抓包里 `/api/mistakes/redo` 响应 items（或 apiSnap 缓存）与练习页题数。

- 内嵌交互组件（如 q-social-bar）挂进带整卡 click toggle 的容器（如错题本列表卡）时，必测「内部链接点击是否被冒泡吞掉」（R346 实景抓到写笔记被 toggleCard 收起）；笔记类文本断言用 ASCII 内容（xdotool type 中文丢字）。

## R348 部署基线与 SW 缓存走查新经验
- 每轮生产验证前先核对部署基线：`git merge-base --is-ancestor <前几轮修复 commit> <本轮部署 rev>`——R348 首版 f33c79f 从旧基线切出，R346/R347 已上线功能生产静默回退（q-social-bar 消失、track 事件 400），仅靠 UI 回归测试才发现。
- 每轮部署验证前必须核对页面真实运行的 bundle：`performance.getEntriesByType('resource')` 看实际加载的 `index-*.js`，而非只 curl 首页 HTML；PWA service worker 会继续服务旧 bundle，需 Ctrl+Shift+R 硬刷后再开始断言，否则会把缓存旧版误判为功能回退。

## R350 复习流 AI 详解走查新经验
- ask 页对 `redoAnswer`/`redoQuestion` 是消费型读取（onShow 读后立即 removeStorageSync）：断言预填要看 UI 上的作答 chip，事后查 localStorage 必为 null，不能作为反证。
- 从复习流切走 tab（含点「AI 详解本题」跳 ask 页）后返回错题本，复习会话不保留（回列表态）、本轮加练题作废：多步复习断言尽量一轮内完成；中断后需重造错题开新复习轮续测。

## R351 复习会话快照恢复走查新经验
- `reviewSnap`（localStorage 裸 JSON 字符串）由 book.vue 各判分/换题/入库写点维护；exitReview（完成复习/退出）与「放弃」都会清。断言横幅用 `document.querySelector('.resumecard')`。
- fail-closed 注入测试可先注入一条**合法快照作阳性对照**（v:1、uid=当前 anonUid、ts=now、rIdx 合法、items[].question_text 非空）确认横幅检测有效，再逐个注入坏 JSON/uid 不符/ts 超 2h/rIdx 越界，reload 期间用 Log.enable+Runtime.exceptionThrown 监听 console error。
- 与 R350 结论相反：从复习流点「AI 详解本题」跳 ask 页后**点错题本 tab 返回，内存会话可能保留**（R351 实测保留、复习卡原位）；整页硬刷才是稳定的丢失路径，测横幅恢复用 Ctrl+Shift+R。
- 复习第 1 题答错（原有 2 道 due）触发加练后总数为 5（2 原题 + 1 requeue + 2 加练）；横幅题号 x/n 的 n 含加练与 requeue。

## R352 跨设备复习同步走查新经验
- 双设备模拟：`Target.createBrowserContext` + `createTarget` 造隔离 context（独立 localStorage），注入相同 `anonUid` 即同一账号；每个 context 的 `Emulation.setDeviceMetricsOverride` 绑定在发它的 CDP websocket 上，**socket 一关 override 就丢**——需要每个 context 各挂一个常驻 holder 进程（参照 holdvw.py / r352_devB.py 模式）。
- `/api/review/cur` 断言点：saveReviewSnap 去抖 1.5s 后 POST（抓包看 body.snap.rIdx/items）；本机快照命中时 onShow 0 次远端 GET（本机优先）；「放弃/完成」POST `{"snap":null}`；跨设备清除用全新 context 验 GET 后无 `.resumecard`。
- 地址栏改 `?rz=` 等 hash query 不触发 onLoad，需 F5 一次才生效（同 R342 深链经验）。

## R353 首页续卡回归数据构造经验
- R323 续练卡/R288 模考卡的触发前提是**非主动中断**（答题后硬刷/关页）；练习页「退出」按钮的 quit() 会清 pendingSession 与服务端进度，tab 切换也可能不落盘——造首页续卡回归数据一律用「答 1 题 + 硬刷」路径。

## R354/R355 生产并发部署与路由顺序回归经验
- 长流程生产测试中若突然出现成批 4xx 或接口行为突变，先复查 `/api/health` 的 rev 与浏览器实载 bundle——生产可能被其他会话并发重新部署（本例 b26cc70 中途被 PR #558 旧基线 merge 覆盖为 a4fa410，R339–R354 全被回退）。发现后立即 message_parent 上报并中断本轮录制，不要把两种 rev 的证据混在一起。
- `/api/review/cur` 对 FastAPI 路由注册顺序敏感：必须先于 `/api/review/{mid}` 注册。回归指纹：`POST /api/review/cur → 422 {"type":"int_parsing","loc":["path","mid"],"input":"cur"}`、`GET /api/review/cur → 404`。
- R354 庆祝卡小结断言点：混合轮（首答对 X（P%）/答错 Y·纠正 Z/加练 M·答对 K）三行逐字核对；全对轮仅第 1 行 100%；`_res` 会随 reviewSnap 持久化并出现在 POST /api/review/cur 的 items 里（抓包可直接验证 `"_res":true`）。

## R363 按卷练习续练归卷 source/卷名走查新经验
- 归卷断言四点一线：POST `/api/practice/progress` body 含 `source`/`ptitle` → 首页续练卡副标题=卷名（ptitle || prModName）→「继续上次练习？」弹窗 content 前缀「卷名」→ 恢复后新答行 `answer_log.source == psource`。旧版 broken 指纹：卡显通用模块文案 + 恢复后 source=NULL。
- 反向残留断言：从首页「去刷题」起普通练习后，progress body 应为 `"source":"","ptitle":""`，新答行 source=NULL（≠psource）；首页卡无卷名残留。注意服务端 practice_progress 只有一个槽位——起普通练习会覆盖卷练进度，需先测完卷路径再测普通路径（或重造）。
- 跨设备弹窗用 `Target.createBrowserContext` 新 context 注同 uid 进 /pages/practice/practice 即触发（同 R352 模式）；answer_log 表 uid 列名是 `uid` 非 `user_id`。
- 首页续练卡与普通练习入口：module 为空时副标题回落「上次练习」，属正常而非缺陷。
- holdvw.py 用 `(setsid nohup … &)` 起，普通 nohup 后台在同 shell 里可能随命令退出被回收导致 override 立即丢失（表现：打印 held 但 iw 不变/进程消失）。

## R364 按卷完成页归卷态走查新经验
- 完成页归卷断言：`.big` 文案「本卷练完」、`.sub.ptl` 卷名品牌色 rgb(46,91,255)/fw600、主按钮「回卷库」→ /pkgA/exam/list、整页 innerText 不含「再来一组」；普通练习完成页反例保持「本组完成/再来一组」。
- **375 视口下练习页键盘快捷键（A-D/Enter）不生效**（桌面宽度才启用），移动视口批量答题只能点选。选项 y 坐标随题干长度浮动：可在同一题上连点 3-4 个候选 y（已答后再点选项无副作用），再点固定底部「下一题」，每 4-5 题截图校验进度。
- 保护 uid 正确拼写是 `umteojq4sltdhorhm`（umte-**ojq**）；上游消息里可能误写成 umtejoq…。做保护 DB 前后对比前先 `select distinct uid … like 'umte%'` 校验，否则 after 快照全 0 造成假警报。
- 生产站桌面 Chrome 下可能出现少量 `Uncaught (in promise) Object`（无 description）的 EXC——弹窗取消/答错均复现不出、无 UI 影响，属未归因背景噪音；断言口径建议区分 console.error（应为 0）与该类 promise 噪音（单独列报）。
- 经 ssh+docker exec 跑多行清理脚本时，内嵌 heredoc 可能静默产出空输出；改用 base64 编码脚本 → 远端解码 → `docker cp` 进容器再执行，输出稳定。

## R365 分享文案归卷走查新经验
- 读分享剪贴板：`Browser.grantPermissions clipboardReadWrite` 后 `navigator.clipboard.readText()` 仍可能 NotAllowedError（焦点/权限 quirk）。稳定做法：在页面 hook `navigator.clipboard.writeText`（存 `window.__cap` 再透传原实现），点「分享成绩」后读 `window.__cap`。注意 F5/整页 reload 会清掉 hook，需重装。
- 分享埋点在 net 抓包里查 `POST /api/track`，字段是 `{"event":"share_result_copy","source":"practice","ref":"paper|<module>|daily"}`——label 落在 `ref` 字段。
- 每日一练重做入口：`/#/pages/practice/practice?daily=1` + F5 整页 reload（SPA 内 hash 跳转不会重挂载会话）。若 `daily_set/submit` 遇 503（共宿负载抖动），服务端未记完成，reload 后可整组重做直至 200；daily 分享分支需要 submit 成功后 dailyStats 到位（完成页出现「今日排行榜」再点分享）。
- 完成页按钮 y 坐标会因 dailyStats/登录条等动态区块变化，点「分享成绩」前先截图确认，否则可能误点「再来一组」把完成页顶掉。
- 生产部署后旧 bundle chunk 名会 404（页面预取旧 hash 资源，console 里成串 `assets/*.js 404`）——属部署换 hash 的已知噪音，与 console.error 口径分开列报。
- 收尾 reload 页面（清 hook）会让 app 以保护 uid 重新拉 `/api/profile` 并新增一个 `apiSnap:*` 缓存键、更新 `apiSnapIndex`——localStorage 相对备份多这两处属 app 正常行为，非污染。

## R423 面试模块 SSE 走查经验
- 入口：ask 页「面试」/ 我的页「AI 面试陪练」→ `/pkgA/interview/interview`；提交 body 是 JSON `{uid,question_id,answer,duration_sec}`（非 FormData）。流：`POST /api/interview/answer/stream`（meta=分数 → thinking 逐秒 → 正文 delta → done{session_id}）与 `POST /api/interview/sessions/{sid}/review/stream`（regen，仅点评 <300 字时允许，否则 400「点评已存在」属设计）。
- 判定口径：meta ≤6 s（打分已关推理）；`event: thinking` 键恰 `{secs,chars}`、间隔 ~1 s、done 前 5 s 内 0 个；正文首字 30–50 s 是上游推理行为不算缺陷；正文 ≥300 字且不含 `<think`/「思考过程」等推理泄漏；响应头 `text/event-stream` 且无 `content-encoding`，`encodedBodySize==decodedBodySize`。
- **触发「重新生成点评」的可靠方法**：提交后在 thinking 阶段 F5 中断（评分已落库、点评空）→ 经「练习记录」重进该 session → 出现「上次点评生成被中断，评分已保留」+ 按钮。旧 <300 字 session 通常属他人 uid，跨 uid 访问 `session_id` 会有预期 404。
- 空正文指纹（R423b 已修）：thinking 数十个后直接 done、正文 0 字、DB review 空；容器日志 `[llm] stream <model> finish=length content=0 …` 告警——出现即预算不足，不是网络问题。
- 含图 `/api/explain/stream` 只收一个 `image` 字段，重复字段只取最后一张；低清 360px JPEG q35 仍可识题命中缓存键。取材料题样本用 `/api/questions?module=ziliao&grouped=1&limit=5`，**不要在高负载时段对生产库跑无索引全表 LIKE**（一次 >10 min 未返回）。
- 清理：`interview_sessions` 按 uid 删；探针含图讲解会新增 explain_cache 行（无 uid），按 `question_text like` 定位删回基线。

## R424 面试点评关推理 / 讲解存疑兜底 走查经验
- 点评口径更新：`/api/interview/answer/stream` 与 regen 流 `event: thinking` 应为 **0**、正文首字距 meta ≤10 s（实测 1.3–1.6 s）；占位只会出现「考官正在撰写点评…」约 1.5 s 一闪，「考官正在思考…（已 N 秒）」不再出现。若 thinking >0 说明上游忽略了 `thinking.disabled`，如实记录个数不算 FAIL。
- 存疑判定口径：兜底拦截 = `tMeta == tFirstDelta == tDone` 单事件秒回 + `module/question_type` 均 null + 正文首行「【答案】题目存疑」+ **不写 explain_cache**（`select count(*) from explain_cache where question_text like '<题干前缀>%'` 为 0）；模型自判存疑有 module、正文说明缺什么，且会写缓存。合法短题干样本：`3, 6, 12, 24, ( )？ A.36 B.48 C.42 D.30`（B）、`儿童：女童：未成年 A.… D.…`（D）应走模型讲解。
- `explain_cache` 正文列是 `explanation`（无 `content` 列）、`created_at` 为 epoch REAL；`interview_sessions` 无 `probe` 列；容器内无 `sqlite3` CLI，转储用 python `sqlite3.Connection.backup`。
- 清理 `test-*` uid 时 `ask_cur`（当前 ask 会话指针）会留 1 行，需一并删；`ins_ta.py` 在 375 弹层可能误报 textarea 长度 0（双 textarea 镜像延迟），以 `querySelectorAll("textarea")` 复核。
- `pkill -f <pattern>` 不要与同一命令行里含该模式的字符串串联（会杀掉自身 shell）。
- 复验窗口看到的 `POST /api/auth/wxlogin 503` 若不是你触发，用 caddy 日志按 IP/UA 归因（本轮为 vivo V2405A 真实设备、`WX_MINIAPP_SECRET` 未配的设计返回），不要算进本轮 5xx。

## R426 练习完成页 practice_result uid/probe 走查经验
- H5 的 `/api/practice_result`、`/api/mistakes`、`/api/answer_log` 走 **XMLHttpRequest**（uni `request`），只克隆 `window.fetch` 的钩子抓不到——网络钩子要同时包 `XMLHttpRequest.prototype.open/send` 并在 `loadend` 读 `responseText`（参考 `/tmp/cdp174/holdnet426.py`）。第一组做完前先用一次已知请求验证钩子确实有记录。
- 完成时 body 为 `{uid: anonUid(), module, n: items.length, correct, secs}`；服务端按三路（`X-Kg-Probe: 1` / 出口网段 / UA 签名）写 `practice_results.probe`。GUI 会话 UA 与真人无异且不带头 → 依赖网段命中；若 DB 写成 probe=0 说明网段未命中，会污染「击败 X%」池（`n>0 AND probe=0`，≥10 样本才显示），**必须立刻按 uid 删**。
- 「击败 X%」断言用 `document.querySelectorAll('.beat').length===0` + `body.innerText` 不含「击败」；注意 `.beat.dsbeat` 是每日同题另一元素，普通模块练习不出现。响应在 probe=0 池为空时恒为 `{"percentile":null,"samples":0}`，属预期不算回归。
- 常识判断组内可能出现多选题（需点多个选项再点「确认答案」），故意答错时选全选即可；完成页「答对 X/10」与 body `correct` 必须一致，逐题记录对错以便对账。
- 管理台没有渲染 `/api/admin/stats` 的 `daily_usage`（`core.js` 只在登录校验调用它）；概览页「近 14 天作答量趋势」来自 `/api/admin/dashboard.trend`（answer_log）。验 `daily_usage` 要在 admin 页用带 `X-Admin-Token: localStorage.admToken` 的 fetch 直接读 JSON，再和 DB 按 `date(created_at,'unixepoch')` 分 probe 分组对账。
- 清理：`practice_results` 现在可按 uid 删；`growth_events` 会因完成页 nudge 留 `push_nudge_show/login_nudge_show` 行，与 `answer_log/mistakes` 一并按 uid 删；全库扫描 `pragma table_info` 含 `uid` 的表以确认 LEFTOVER 0。
- 管理台退出登录后 Chrome 会弹「Save password?」，点 Never，避免 token 存入密码管理器；本机拉的 token 临时文件用完即删。

## R427 答题 PK（pk_matches.probe）走查经验
- 入口：「我的」页 `wd-cell` 「答题 PK」→ `/pkgA/pk/pk`；分享链接直接打开 `https://kaogong.zalize.com/#/pkgA/pk/pk?code=XXXX` 会在 onLoad 自动 join。
- 所有 pk 接口都是 XHR 且带 `uid: anonUid()`（含 `GET /api/pk/leaderboard?uid=`），网络钩子 PAT 用 `['/api/pk/']` 即可（`/tmp/cdp174/holdnet427.py`）。切身份只需 CDP 写 `localStorage.anonUid` 后 F5。
- 答题页：点选项 350 ms 后自动锁定并下一题，每题 30 s 超时自动空答；第 10 题后自动 `POST /api/pk/submit` 进结果页。别在答题中途跑长 shell 查询，会有题目超时（如实记录即可）。
- 随机匹配隔离断言要选**只有真人（probe NULL/0）等待局**的模块（当时 shuliang 只有 `ZBFS14`）；「混合」池里可能有 `creator_score=0` 的探针等待局（非 NULL 也算）会 matched:true 并改写他人行。先用 DB 列出 `status='waiting' AND opponent_uid IS NULL` 的 code/module/probe/creator_score 再决定。
- toast 「暂无对手，已为你开局等待匹配」只显示约 1.5 s，截图常错过；可即刻查 `document.querySelectorAll('uni-toast')` 的 innerText 兜底取证。
- 榜隐私口径：匿名/第三方 uid → `items:[]`；参与者 uid → items 含 `r427-u***` 且胜者有 `my_rank`。curl 无 uid 与 UI 有 uid 两条都要对照。
- 紧接 chip 点击后立刻点「发起好友挑战」曾出现一次 XHR status 0（未到服务端），等 1–2 s 再点即可；如再现请上报。
- 1440 模拟视口大于物理屏时，computer 截图会裁切；用 CDP `Page.captureScreenshot` 取全视口证据（`r['result']['data']`）。holdvw 杀掉后 override 可能残留，需 `setDeviceMetricsOverride(width=0,height=0,deviceScaleFactor=0)` + `clearDeviceMetricsOverride` + reload 才回 1600×1017。
- 排查时切勿用 curl 直打 create/join 等写接口——会在生产留行（本轮 `r427-ui-probe-curl` 需额外清理）。
- 清理：pk 行按 `creator_uid/opponent_uid LIKE 'r427-%'` 删；本轮 `growth_events` 等表无命中（PK 页不产生 nudge 行）。

## R428 分享作答多选题（share-q 勾选后确认 / 后端 normalize_answer 判分）走查经验（testing agent）
- 分享页 `/s/<sid>` 的 `/api/share/*` 请求走 uni.request(XHR)+fetch 混用且 F5 / 落地页跳 hash 是新 document，页面级 `window.__net` 钩子记录会丢；改用 CDP `Network` 域长连接（`/tmp/cdp174/holdnetcdp428.py <out.jsonl>`：`Network.enable` 后收 `requestWillBeSent`/`responseReceived`/`loadingFinished`，`getResponseBody` 期间收到的其他事件要排队处理），把 `/api/` 的 method/URL/postData/status/响应体追加成 JSONL，跨导航可靠。
- 多选断言口径：`GET /api/share/<sid>?uid=` 的 `question` 键恰为 `[id,image,module,multi,options,question,submodule]`；未揭晓 `.multi-bar` 存在、`.multi-ok` 文案「确认答案（N）」、空选时带 `.dis`；勾选期间 `/answer` POST 必须为 0；确认后 body `picked` 已是升序去重（`ADC` 点法也发 `ACD`）；揭晓后 `.opt.right` 按字母包含、`.opt.wrong` = 选中且不在答案里；同 sid 换 uid 前用 CDP 写 `localStorage.anonUid` 再 F5。单选题 `multi:false`、无 `.multi-bar`、点选即 POST。
- `POST /api/share/create` 同人同题**幂等复用 sid**（`team.py` 查 `question_id+from_uid+team_id` 直接回旧 sid），日志里 create 200 次数可多于 `shared_questions` 新增行数，不是漏写。
- `holdvw.py`/holder 的 pid 文件若写 `$!`（`bash -c … &` 包装）记到的是 wrapper pid，`kill $(cat pid)` 杀不掉 python 子进程；新旧 holder 同时存活会导致 1440 override 与 375 互相覆盖（表现：页面渐白/空白、CDP 截图仍 375×812）。切分辨率前先 `ps aux | grep holdvw` 按真实 pid 清干净，再启新 holder。
- 1440 仿真下 `Page.captureScreenshot` 返回结构是 `{'id','result':{'data'}}`（`cdp.py call` 不解包），取 `['result']['data']`。
- `/tmp/r428_ls_orig.json` 这类 LS 备份是双重 JSON 字符串，恢复用 `json.loads(json.load(f))`（见 `/tmp/cdp174/r428_restore_ls.py`）。
- 清理台账：分享流程会在 `growth_events` 留 `share_open`/`share_answer` 行（本轮 14 行），按 uid 一并删；`answer_log` 基线若与清理后不符，先查窗口内其他 probe uid（如并发的 `um…` 探针）再下结论。

## R429 每日一练（daily_set_entries.probe）走查经验
- 入口深链 `/#/pages/practice/practice?daily=1`（首页「继续目标/免注册立即开练」= `launch({kind:'daily'})` 同链路）。切 uid 后除 `anonUid` 外还要删 `dailyPlan` / `dailySet` / `dailyDone:<uid>` 缓存再 F5，否则可能复用旧题组或已完成态。
- 全站同题 10 题按日固定（`/api/daily_set` 边缘缓存 60s），同一天两 uid 拿到同一组题，可提前记答案让第二组少走「下一题」。答对会 350ms 自动跳下一题，答错需点「下一题」（375 底部固定条 ≈ 屏幕 (202,553)，1440 ≈ (822,641)）；最后一题按钮变「完成」，点后 `next()` → `markDailyDone()` 才发 `POST /api/daily_set/submit`，随后 `GET /api/daily_set/board?uid=<anonUid>`。1440 双栏有键盘快捷键 A–D 选项 / Enter 下一题，可快速做题。
- 完成页断言选择器：`.dsbeat`（「你是今天第 1 位完成者」/「成绩已记录（首次 N 对） · P 人完成」/「击败 X%」）、`.dsboard`（含 `.rr-t` 今日排行榜 + `.dsb-mine` 我的名次 + `.dsb-row`）。
- 幂等验证：完成页 F5 只会从第 1 题重开、不会自动重发 submit；要触发 `already:true` 需再做一组（会多写 10 行 answer_log + 1 行 practice_results，清理时一并删），或按用户许可在页面上下文 fetch 重放同 body。
- 每日一练还会写 `review_log`（uid 列）与 `growth_events`（daily_open / push_nudge_show / login_nudge_show / slow_load），清理请全库扫 uid 列而不只按用户列出的表。
- 匿名口径核 `GET /api/daily_set` `stats.participants` 与 `GET /api/daily_set/board`（无 uid）；SEO `/tiku/daily/` 用 `?x=<随机>` 绕边缘缓存并看 `cf-cache-status`。
- `cdp.py` 的 `C.call(method, **params)` 用关键字参数（`c.call('Page.captureScreenshot', format='png')['result']['data']`）；清 viewport 需 `setDeviceMetricsOverride(0,0)` + `clearDeviceMetricsOverride` + reload，然后新建连接读 `innerWidth`。

## R430 统计次级屏簇（掌握度地图 / 练习历史 / 打卡日历 / 周报）CSS 字号下限走查经验
- **入口路径**（成长页 `#/pages/stats/stats`）：hero「学习日历 ›」`.hero-cal` → `#/pages/stats/calendar`；「考点掌握度地图」卡 `.km-entry` → `#/pkgA/stats/mastery-map?mod=<module>`；「练习记录 · 逐题回看 ›」`.hist-link` → `#/pkgA/stats/practice-history`；周报 `#/pkgA/stats/weekly-report` 首页仅在有报告时显示「看周报 ›」，新 uid 直达 URL 即可。
- **掌握度地图解锁门槛**：`MASTERY_COLD_START_N = 30`（`n_total` = 该 uid `answer_log` 行数），<30 显示「再练 N 题解锁掌握度地图」冷态，无 `.cov-t/.lg/.tab-pct/.tile-meta`。3 组 × 10 题（可含 1 组「每日一练」`?daily=1`，会额外写 `daily_set_entries` 1 行）刚好 30。`.dot` 只在 tile `due_mistakes>0`（mistakes `mastered=0 AND next_review IS NULL OR <=now`）时渲染，答错即到期，所以故意答错就有 `.dot`。
- **周报状态**：新 uid `GET /api/report/weekly?uid=` → `{"status":"empty","range":"上周一 ~ 上周日"}`，UI `.empty`「上周没有学习记录」；「生成分享图」`.pbtn.main` 与分享面 `.sheet-x` **只在有上周记录的正文里**，新 uid 无法量 `.sheet-x`，如实标 untested。正确接口是 `/api/report/weekly`，不是 `/api/weekly_report`（打错会在容器日志留 404）。
- **字号扫描口径**：uni H5 375 宽 1rpx=0.5px → 24rpx=12px、36rpx=18px；1440 宽下 rpx 按 750 基准 clamp，同样得 12px（`.side-item` 用 px 14）。扫描：`body *` 中有直接文本子节点且 `getClientRects().length>0` 的元素 `parseFloat(getComputedStyle().fontSize)<12` → 期望 `[]`；`uni-tabbar__label` 10px 是 uni 内置 tabbar，非页面 CSS，在 tab 页（错题本/成长页）扫描结果里剔除说明。`.tab-pct` 在 1440 隐藏（`rect 0×0`，桌面用 `.side-nav`），fs 仍可读。
- **吸底条量测顺序**：`.sheet-s` 只在点 tile 后存在，量测脚本要在 `pick()` 之后再跑一次，否则 `fs:[]`（R430 漏了这一步，只能视觉取证）。
- **1440 布局判读**：`uni-app` `max-width:1280; margin:0 auto`（≥1366），`uni-page-wrapper padding-left:208px` 为全局桌面侧栏保留列（App.vue 既有），所以子页 `.page` 左 280.5 / 右 87.5 不对称是设计而非 bug；居中断言看 `uni-app` rect 左右各 72.5。物理屏 1024 宽时 1440 视口在录屏中按 ~0.63 缩放显示，原生点击坐标 ≈ page_x×0.634+8；取证用 `Page.captureScreenshot`。
- **日历 ‹ ›**：`.cal-btn` 40×40，‹ → 上月（badge「本月打卡 0 天」「本月共练 0 题」），› 回本月后带 `.dis`；`.cal-grid > *` 取 `offsetLeft` 唯一值 7 个、宽高一致即无错位。返回：子页导航栏「<」是 H5 navbar back，栈里有多层时要连点（周报 ← 日历 ← 成长页）。
- **bundle 变更后首进 stats 的旧 SW 问题**：浏览器若持旧 `index-*.js`（SW 预缓存），点统计 tab 动态 import 旧 chunk `pages-stats-stats.<oldhash>.js` 会 404，前端把它显示成「连接服务器超时，点击屏幕重试」并计 `__cerr` 2 + `__asyncErr` 1；点重试后走新 bundle 恢复。这是可复现的真实体验问题，要单列上报，不能当钩子噪音；如需纯净口径先硬刷（`Page.reload ignoreCache`）再开始。`holdnetcdp429` 只落 `/api` 请求，静态 chunk 404 要靠 `__cerr` 或 Network 域全量抓。
- 清理：本轮 uid 涉及 `mistakes / practice_results / answer_log / growth_events(daily_open, heatmap_view, login_nudge_show, push_nudge_show) / daily_set_entries`（每日一练组），用 `pragma table_info` 全表扫 uid 列，脚本 `scp → docker cp → docker exec python3 <script> ro|clean`，清后 `rm` 两侧副本。

## R430b 旧壳 chunk-load 自愈（errorHandler → staleShellHeal）走查经验 / 「造旧壳现场」方法
- **机制**：`monitor-client.js installVueErrorHandler(app, report, consoleError, onChunkLoadError)` 仅 `classifyVueError==='chunk-load'`（`Failed to fetch dynamically imported module` / `Loading chunk`）时回调；`main.js` 回调=既有 `staleShellHeal`：`visibilityState==='visible'` 且无 `sessionStorage.kg_sh_reload` → `fetch('/',{cache:'no-store'})` 比对 `assets/index-<hash>.js` → 不一致才 `kg_sh_reload=1`+`location.reload()`。既有触发只有 load+15 s 定时一次与 SW `kg-sw-updated`；**后台（hidden）tab 收到 SW 消息会被 visibility 守卫跳过，旧壳会一直留到用户切回并再触发**——所以「先开 tab 再切走等发版」能稳定保留旧壳现场。
- **自然旧壳 404 不一定能复现**：本次发版后上一版分包（`pages-stats-stats.QZ0CcByq.js` 等）仍 200（服务器/边缘保留了上一版 assets），旧壳导航不会 404，R430 那次 404 是因为浏览器持的是再前一版 SW 预缓存壳。先用 `curl -o /dev/null -w %{http_code} -H 'Cache-Control: no-store' https://kaogong.zalize.com/assets/<旧chunk>` 判断，404 才走 (c) 自然路径，否则直接上方案 B。
- **方案 B（CDP Fetch）脚本 `/tmp/cdp174/r430b_fetch.py <tabIdPrefix> chunk404|fakeroot <chunkName> [maxhits]`**：Request 阶段把 `*/assets/<chunkName>.*.js` 前 maxhits 次 `fulfillRequest 404`；`fakeroot` 再在 Response 阶段把 `/` 的 `assets/index-<hash>.js` 改写成 `index-FAKE0000.js`。三个坑：① `staleShellHeal` 的 `fetch('/')` 在 `Fetch.requestPaused` 里 `resourceType` 是 **`XHR`**（不是 Fetch），只判 Fetch 会漏改写 → 变成第二个 fail-closed 样本；② urlPattern 用 `*mastery-map*` 会同时拦到 `mastery-map-*.css`，而 `cdp.C.call()` 在等回包时会**丢弃**期间到达的事件 → css 请求永远 paused → Vite preload 不结算 → 20 s 后是 `Async component timed out`（classify 非 chunk-load，正确地不自愈），务必 pattern 只匹配 `.js` 且把等待期事件入队；③ urlPattern 里 `?` 是单字符通配，`https://host/?*` 会匹配 `/api/...`、`/precache.json`，改写函数要在 `orig=None` 时原样放行（本次 `/api/practice/history`、`/api/report/weekly` 都经过了改写函数但内容未变）。
- **同一 document 内 chunk 只会失败一次**：模块 URL 拉取失败后 Chrome 模块表记为失败，再进该路由**不发网络请求**直接 reject（第二条 chunk-load 但无 404 记录）；fail-closed 后想再验该路由必须整页 reload。uni 原生「连接服务器超时，点击屏幕重试」点击 = 整页 reload（`navt=reload`），用户可自救。
- **取证口径**：404 → `GET /`（Fetch/XHR，no-store）间隔 8–21 ms；heal 时 `GET /` 后约 60–110 ms 出现 Document `GET /`（`fromSW`）+ 新 `index-*.js`；`performance.timeOrigin` 变化 = 真 reload；`sendBeacon` 的 `POST /api/monitor/report` 在 reload 瞬间 CDP 记 `FAIL net::ERR_ABORTED`，但 `docker logs -t` 可见服务端 200 已收（用 `-t` 取时间戳对齐），不能把它计入 `/api` 非 2xx。
- **数据**：只看成长页/日历/周报不做题时，本轮 uid 只写 `growth_events(heatmap_view, probe=1)`，每次进 stats 一行；`daily_set_entries` 不受影响。

## R431 部署第 4 步（compose 重建）失败归因 / 宿主取证经验
- 归因先看三样：`/tmp/kg-compose.log`（软链→当次 `/tmp/kg-compose-<rev>-<utc>.log`）末行有无 `KG_COMPOSE_EXIT rc=N`；`sudo -n journalctl -u docker --since ...`（`Control/Solve ... context canceled` = client 侧取消，不是 buildkit 错）；`sudo -n journalctl -k`/`dmesg` 找 `Out of memory|oom-kill|Killed process`——**free 很低 ≠ OOM，无内核记录就不能写 OOM**。
- `session healthcheck failed fatally ... only one connection allowed` 每次 build 收尾都会打，成功也打，不是原因。
- 本地部署日志里 `compose-started` 之后若无 `Timeout, server not responding`/`closed by remote host`，则 ssh 没掉线；旧写法下 launcher ssh 返回时刻 ≈ compose 进程消失时刻，可用来对齐 dockerd 日志时间。
- bash 陷阱：`ssh R "cd X && nohup cmd > log 2>&1 & echo ok"` 的 `&` 作用于整个 `cd && nohup` 列表，子 shell 会持有 ssh 管道等 cmd 结束；要立即返回用 `setsid -f nohup cmd > log 2>&1 < /dev/null && echo ok`。远端验证法：`ps -o pid,ppid,sid,pgid,cmd` + `ls -l /proc/<pid>/fd` 看 fd1/2 是 pipe 还是日志文件。
- `deploy/host_probe.sh` 可单独跑：`ssh R bash -s < deploy/host_probe.sh` → `mem_avail=… disk_avail=… load=… other_builds=N`；`other_builds` 用 `[d]ocker` 写法防 pgrep 匹到自身，验证时远端 `bash -c 'exec -a "docker compose up -d --build" sleep 30' &` 造一个假进程看计数。
- 部署脚本改动的验证 = 真跑一次 `--skip-build` 部署看 `host:`/`compose-started`/`poll:`/`KG_COMPOSE_EXIT` 四行 + `/api/health` rev + 容器 healthy/RestartCount + 容器日志 5xx/Traceback/locked，无 DB 写入无需清理、无 UI 无需 testing agent。

## R432 访问归档 gzip / 只读查库口径经验
- 容器内数据库是 `DB_PATH=/data/data.db`（`/data/kaogong.db`、`/data/app.db` 是 0 字节空壳，连上去 `no such table`）；只读用 `sqlite3.connect("file:/data/data.db?mode=ro", uri=True)`，脚本经 `cat x.py | ssh R 'docker exec -i deploy-kaogong-1 python3 -'` 送入（inline heredoc 套 docker exec 会空输出）。
- `answer_log.created_at` / `mistakes.created_at` 是 Unix 秒 real，按日分桶用 `date(created_at,'unixepoch')`，别 `substr(created_at,1,10)`。`mistakes/review_log/interview_sessions/shared_answers/users` 没有 `probe` 列，判断某行是否真人只能经 uid 关联 `answer_log.probe`（三路计数 p0/p1/NULL 都要看，混合 uid 不能整体归真人）。
- `scripts/` 与 `deploy/cron_access_report.sh` 不走 `deploy_h5.sh` rsync：改完 scp 到 `/home/ubuntu/kaogong-assistant/` 同路径并两端 md5 核对。
- 归档改读侧/压缩的验证 = 改前先留基线（`cp crawler-stats.json /tmp/before.json`；`cat *.jsonl | access_log_report.py - --days 7 > /tmp/before.txt`），改后用新脚本对同目录重算，`json` 除 `generated_at` 外逐键比、周报 `diff` 要为空；`gzip -t` 每个 .gz；再看下一次 :17 归档 / :23 日报 cron 自然跑完 `generated_at` 更新、`.state` 正常。压缩用 `nice`，全部 415 MB 只要 3 s，不会挤宿主。

## R433 卷内快照归档 / 运维脚本同步经验
- `deploy/kaogong-ops.sh` 部署在 VPS `/home/ubuntu/kaogong-ops.sh`（cron 40 3 CST），不走 `deploy_h5.sh` rsync。scp 覆盖前**先 `diff` 生产副本**——R433 发现生产有未入库改动（本地备份保留 7→3 份），直接覆盖会把它回退；回收进仓库再 scp、两端 md5 核对，并 `cp -p x x.bak-rNNN` 留旧版。
- `/data` 卷顶层只该有 `data.db`(+wal/shm)、`qimg/`、`iter-r3b/` 与各轮 `r*-*.json` 处置记录；`app.db`/`kaogong.db` 是 0 字节空壳。手工全库快照（`*.db.gz`/`*.bak*`）不能长期留在卷内：容器内 `gzip -t` → `docker exec C cat f | rclone rcat --size N r2:zalize-backups/kaogong-sqlite/archive/f` → `rclone size --json` 字节数 + `rclone cat | md5sum` 真回读一致 → 才 `rm`；178 MB 一份上传+回读约 70 s，别在半途 kill。`rclone lsl` 对空前缀返回 rc=1 不是失败。
- 每日 ops 日志会写 `VOLUME-SNAPSHOT N file(s) M MB: …`（只报不删）；看到就按上面口径归档。演练用 `head -c 2097152 /dev/zero > /data/r-selftest.db.gz` 触发、看完删掉。整脚本手工实跑一次 ≈150 s（含 167 MB R2 上传 + 回读校验），会覆盖当天 `data-<date>.db.gz`（同名重传，无副作用）；容器无 `sqlite3` CLI，`.backup` 走 python 回落是既有行为不是报错。
- 宿主磁盘问题别再往 kaogong 名下找：R432/R433 后 kaogong 自有可动项已清空，剩余是 recruit pgdata / containerd / SoftCopyright / build cache（别家，不动、不 prune）。

## R434 R2 前缀清理作用域经验
- `rclone delete` **默认递归**：对 `r2:zalize-backups/kaogong-sqlite/` 加 `--min-age 30d` 会连 `archive/` 一起清。现行写法 `--max-depth 1 --include "data-*.db.gz"`；任何改动清理命令前先 `--dry-run --min-age 1s` 把作用域列全再看 `--min-age 30d`。R2 对象 mtime 取上传时刻（`rclone rcat` 不带 `--metadata` 时），归档「年龄」= 归档日不是快照日。
- archive/ 对象一律 gzip；大对象整理走流式 `rclone cat x | gzip | rclone rcat x.gz` + `rclone cat x.gz | gunzip | md5sum` 对照 `rclone cat x | md5sum`，370 MB 一份 ≈100 s，宿主不落盘；用 `setsid -f nohup … > log` 跑，别在 ssh 前台等。
- bucket `zalize-backups` 是多产品共用（`d1/ honestcv-kv/ probe/ recruit-pg/`），只动 `kaogong-sqlite/`。

## R435 备份对账 / WAL / 依赖钉版经验
- 备份 vs 活跃库对账：宿主 `gunzip -c ~/kaogong-backups/data-<date>.db.gz > /tmp/x.db` 后 python `sqlite3.connect('file:/tmp/x.db?mode=ro', uri=True)`；活跃库同样 `mode=ro` 只读。逐表比 `count(*)` + `max(rowid)`；本库**没有** `favorites`/`reminders` 表（收藏是 `question_favs`/`fav_folders`/`shenlun_qfavs`/`shenlun_mat_favs`，提醒是 `reminder_prefs`；先查 `sqlite_master` 再对账），`no such table` 不是 0 行别写成「一致」。当日 `data-<date>.db.gz` 会被手工整跑 ops 脚本覆盖，对账前先看它的 mtime。
- `-wal` 文件大小 ≠ 活跃数据：读 `-shm` 前 136 字节，`mxFrame`（偏移 16）× 4096 才是活帧；`nBackfill`（偏移 96）= 已回填帧数。想立刻收回历史峰值只能 `PRAGMA wal_checkpoint(TRUNCATE)`（返回 `(0,0,0)` = 无 busy、全部回填、已截）；有读事务在跑时会返回 busy=1 不是错误，稍后重试。R435 起连接带 `journal_size_limit=64 MiB`，之后 WAL 重置会自动截回，不必再手工。
- 镜像依赖：`docker exec deploy-kaogong-1 pip freeze | sort | diff - <(grep -v '^#' backend/requirements.txt | grep . | sort)` 必须为空；不为空 = 有人绕过 requirements.txt 或本地漏推。本地 venv 版本与清单不一致时先 `pip install -r backend/requirements.txt` 再跑 pytest，别拿本机旧版当生产结论。buildkit 日志 `/tmp/kg-compose-<rev>-*.log` 里 `RUN pip install` 下一行是 `CACHED` 还是 `Collecting` 能看出这次部署有没有重装依赖。

## R436 前端构建可复现性核查
- 判「本地 bundle = 线上 bundle」不要只看文件名 hash：`find dist/build/h5 -type f -exec md5sum {} + | sort` 构建前后各存一份 `diff`，0 行才算字节级可复现（R436：119 文件全同）。锁与安装树用 `node_modules/.package-lock.json` 与 `package-lock.json` 逐包比 `version`，`npm install --dry-run` 的「added N」含 optional 平台包、不能当缺包证据。
- `error_reason` 列在 `mistakes` 表；对 `answer_log` 查会 `no such column`。关联 probe=0 时用 `exists(select 1 from answer_log a where a.uid=m.uid and a.probe=0)`。
- 本机系统 SQLite 3.37.2 比生产（python:3.12-slim，3.46.1）老；新语法（`->>`/RETURNING/STRICT/unixepoch）本地会先报错，别把本地失败误判成生产问题。

## R437 应用日志取证边界
- `docker logs deploy-kaogong-1 --since 24h` 的实际覆盖 = 当前容器 `StartedAt` 至今（部署日常常只有几十分钟），先 `docker inspect --format '{{.State.StartedAt}}'` 再下「N 小时无异常」结论。更早的应用日志看 `/home/ubuntu/kaogong-reports/app-log/kaogong-app-<rev>-<startedAt>-to-<now>.log.gz`（R437 起每次重建前归档，保留 14 天，行首 UTC 时间戳）：`zcat … | grep -E 'Traceback|" 5[0-9]{2} '`。
- caddy 24 h 非 2xx 归因先按 `Cf-Connecting-Ip` 分三桶：探针网段（140.232.64.x）= 历轮走查负向用例；为空 = 直连源站扫描（403 正确）；其余再看 UA/路径。`sitemap-questions-<n>` 越界 404 是分片按 OFFSET 切的设计内行为，引擎请求旧分片号不算问题。
- 部署机没有 `brotli`，1b 的 WARN 是常态（R367 起）；线上 br 变体由边缘压出，5b 通过即可，别把该 WARN 记成本轮回归。

## R438 SRS 到期点口径
- R438 起 `mistakes.next_review` 一律落在中国日历日 00:00（`cn_day_start()+N×86400`）；断言写 `nr % 86400 == 16*3600` 且 `now < nr <= now+86400`（1 天档），不要再写 `nr > now + 0.5 天` 之类的滚动口径。错题**重新写入**仍是 `next_review=time.time()`（立刻到期），二者不要混。
- 生产走查复习后要看「明天复习」标签：改后无论几点复习，次日 00:00 前都应是「明天复习」、00:00 起「今日到期」；如看到当天下午才变到期，先查 `next_review` 是否 % 86400 != 57600（说明是 R438 前的旧行或有新写入路径绕过了 `_advance_review`）。
- 现存行对齐记录在 `/data/r438-next-review-realign.json`（29 行 old/new），回滚：把 `r438_verify.py` 的 `restore` 分支灌进容器 `python3 -`。
- 小程序 `miniapp-native` 没有客户端到期判断/「明天复习」标签，首页/练习页「今日到期 N 题」全取 `GET /api/review` 的 `total`；核到期口径只需看服务端，不要去小程序找标签代码（R439）。「今天 0 点」只用 `db.cn_day_start(ts)`（`_day_start(offset)` 是它的偏移封装），不要再内联 `int(t+8*3600)//86400*86400-8*3600`。

## R440 首页今日计划复习副标 / 首页 24rpx 字号 / 「往期 ›」热区走查经验
- 首页两套「到期」口径：任务卡 `.tk-sub`「今日到期 N 题」与到期卡 `.duebar` 取 `GET /api/daily_plan?uid=`（注意不是 `/api/plan`，那是 404）的 `due_mistakes`，**含今日新错**；今日计划卡取 `GET /api/plan/today?uid=` 的 `tasks[key=review]`（`due` 用 `created_before=cn_day_start()` 排除今日新错，`new_today` 只进副标）。`review_target=min(m_review, reviewed+due)`，为 0 时 tasks 里**没有** review 项——只有今日新错的新 uid 计划卡不出现复习行是预期。
- 造「到期已清 + 今日新错」现场最省事：`POST /api/mistakes {uid,module,question_text,correct_answer,user_answer}` 得 mid → `POST /api/review/{mid} {uid,correct:true}`（review_log +1，next_review 推到明天 00:00）→ 再原生在练习页答错 1 题。练习页题目对同 uid/同会话稳定（本轮两 uid 都拿到 qid 286402，正确 C），先选 A 基本能判错。
- 今日计划卡需 `user_profile` 才出现：首页「制定我的学习计划 → 去制定 ›」3 步 sheet（考试日期 picker 滚月/日列 → 完成 → 下一步 ×2 → 生成我的学习计划）写 `POST /api/profile`；清理表清单在 R430 基础上加 `user_profile`、`review_log`、`practice_progress`（每个 uid 一行）。
- `.hero-ds-arc`「补练往期 ›」只在 `dsMeta` 存在时渲染（每日一练有数据即有）；`.sz-arc`「往期 ›」在时政卡内。负外边距热区断言：arc rect.height 41，父行 `.hero-ds` 17；`.sz-s` 375 下本身折 2 行（h 34）不是被撑大，对比 1440 下 h 17 即可分辨。
- R440 新副标 375 下会折成 2 行（`.task-sub` 247px 宽放不下 30 个字），属正常换行不是溢出；扫 `scrollWidth>clientWidth` 仍应为 `[]`。
- 提醒设置页路径：「我的」→ 偏好设置「学习提醒」→ `#/pkgA/settings/reminders`。`.warn-s` 只在「每日刷题提醒」开启且 `Notification.permission!=='granted'` 时渲染：原生点开关（只写 LS `reminder` 设置）即出现，Chrome 弹权限框用右上 ✕ 关（perm 保持 default，不改站点设置），量完再点关回。`.push .hd/.appico` 在「提醒样式预览」卡内始终渲染。
- holder 要带探针头：`holdtab440.py` = `holdtab.py` + `Network.setExtraHTTPHeaders({"X-Kg-Probe":"1"})`；切视口时 kill 旧 holder 再起新参数，reload 后 `innerWidth` 确认。

## R441 Lighthouse 预算 / 日界公式 / 归档日志走查经验
- **`/` 的 LH 移动模拟 LCP 基线 ≈ 2.73 s（预算 2500）**：不是偶发、不是宿主负载——LCP 元素是壳内联 `#kg-splash > div.s`，observed TTFB ~60–100 ms、render-blocking 0；看到 6b `/` LCP 27xx WARN 先对 `lcp-breakdown-insight`（TTFB/render delay）与 `network-requests` 首屏资产收完时间，只有 TTFB 或资产时间异常才归服务端/宿主。LH 13 的 lhr 里 `largest-contentful-paint-element`/`render-blocking-resources`/`third-party-summary` 已改名为 `*-insight`，按 key 模糊匹配取。
- `perf-budget.sh` 的 lhr 随 `$TMP` 删除；要留证据直接 `npx lighthouse <url> --output=json --output-path=/home/ubuntu/rNNN_lhr.json --chrome-flags="--headless=new --no-sandbox"`，横向比较必须同看 `environment.benchmarkIndex`（devin-box 2 vCPU 在 1800–3700 波动），主包成本看 `bootup-time.details.items[url~index-]` 的 `scripting` 与 `long-tasks`。
- 「中国日历日 0 点秒」只允许 `db.cn_day_start(ts)`；查克隆用 `grep -nE "8 \* 3600|28800" backend/app`，`strftime(gmtime(t+8h))` 日期字串与 `weekday` 计算不是同一语义、不算克隆。
- R437 归档 app-log 用 `grep -cE " 5[0-9]{2} "` 会误匹配 `[indexnow] submitted 533 urls -> 200`，计数 >0 先看原文。
- caddy 源站按 `ts` 数「发版后」窗口时，探针网段 `140.232.64.x` 的 `curl/7.81.0` 4xx 是 testing agent 探路径（R440 为 `GET /api/plan`，正确是 `/api/plan/today`），不算产品非 2xx。

## R442 前端两版 dist 同机 A/B 走查经验
- 疑似「主包变慢」先做同机交替 A/B 再归因：`git worktree add <旧 commit>` + 复用 `node_modules` 软链（锁未变时）→ `npm run build:h5`；两版各起 `python3 /home/ubuntu/r442/proxy.py <dist> <port>`（静态 + `/api/*` 代理生产并加 `X-Kg-Probe: 1`），`ab.sh` A1 B1 A2 B2… 交替 ≥5 轮只比 `bootup-time` 主包 scripting / TBT / long-tasks；本地静态不压缩，FCP/LCP 绝对值不能和生产比。
- Lighthouse 单机数值必须同看 `environment.benchmarkIndex`（devin-box 正常 3550–3730）；bench <2500 或本机同刻在跑 pytest/部署/其他 lighthouse 时的 scripting/TBT 高值先当噪音、隔离后复测，不直接登记为回归。
- 用完 `git worktree remove --force` + `prune`；node_modules 软链先 `rm` 再 remove。

## R443 Lighthouse simulate vs 真节流 / LCP 双峰归因走查经验
- **LH 默认 simulate 的 FCP/LCP 不是观测值**：先看 `audits.metrics.details.items[0].observedFirstContentfulPaint`（`/` 在 devin-box 只有 110–180 ms）；模拟值由 Lantern 按「观测 FCP 前收完的 High/VeryHigh 请求」折算。判定某次 LCP 落在哪个峰：数 `network-requests` 里 `priority ∈ {VeryHigh,High}` 且 `networkEndTime <= observedFCP` 的条数/字节——23 个 216 KB → 2.73 s；主包 `index-*.js` 晚于观测 FCP 几 ms 被排除 → 22 个 87 KB → 2.0 s。这是量测机竞态，**不登记为回归**。
- 要看真实弱网首绘用 `--throttling-method=devtools`（`/` FCP=LCP≈0.7 s），会带 runWarning「loaded too slowly」且 TBT 与 simulate 不同口径、跑 60–90 s；只做旁证，预算脚本历史水位全是 simulate，不换口径。
- 老 LHR 没有 `largest-contentful-paint-element` 时用 `audits['lcp-breakdown-insight']` 拿 LCP selector / TTFB / render delay。
- `perf-budget.sh` `/` LCP 线现为 3000（R443 校准）；若某天 27xx 之外再出 >3000，先按上面数进图请求数与字节、再看 `benchmarkIndex`，字节涨了才是真信号（主包/预加载分包变大）。

## R444 CLS 元素级归因走查经验
- LH `audits['layout-shifts'].details.items` 只给每次位移的「首个节点 + 分值」，`boundingRect` 是末态 DOM 快照（可能已在视口外），要看谁被推了多少：`lighthouse … --save-assets` 后读 `*-0.trace.json` 的 `LayoutShift` 事件 `args.data.impacted_nodes[].old_rect/new_rect`（node_id 是后端节点号，需再映射）。
- 更直接的是 Playwright 对生产 `add_init_script` 注一个 `PerformanceObserver({type:'layout-shift',buffered:true})` 读 `entries[].sources[].node/previousRect/currentRect`，同时采 `#kg-splash` 的 `classList`/`opacity` 判断位移是否在启动屏遮盖下（脚本样例 `/home/ubuntu/r444/cls_sources.py`；Chrome 用 `/home/ubuntu/.local/bin/google-chrome`，pip 的 playwright 没装浏览器）。请求头带 `X-Kg-Probe: 1`。
- `had_recent_input=true` 在 LH/Playwright 仿真视口下是常态（视口事件算「输入」），LH 对视口事件后 500 ms 内的位移无条件计入，不要据此把位移当「用户触发」排除。
- `PRAGMA journal_size_limit` 是连接级：只读探针连接读到 -1 不代表应用连接没设（R435 在应用连接设 64 MiB、R436 已读回），核对要在应用进程内或看 WAL 是否在 checkpoint 后被截到限值以下。

## R445 经验：拦截 `/api/*` 验证「首帧占位 / CLS」时的坑
- 只 abort 某个 GET 接口（CDP `Fetch.failRequest` / Playwright route.abort）**不等于**前端拿到错误态：`frontend-uni/src/api.js` 的「GET 最近成功快照兜底」会在超时/网络错误时用 localStorage `apiSnap:<path>` 回填并上报 `track stale_fallback`。要复现「数据从未到达」（首访/无缓存）路径，拦截前先 `localStorage.removeItem('apiSnap:/api/xxx')`（首页每日一练还需删 `dailySet`），结束后正常加载会自然重建，无需手工恢复。
- 对比拦截 / 不拦截的 `getBoundingClientRect().y` 时要在**同一视口同一 holder**下量；更有力的证据是 `Page.addScriptToEvaluateOnNewDocument` 注入 rAF 逐帧采样（记录目标元素文案 + `.top` + `performance.getEntriesByType('resource')` 里该接口的 `responseEnd`），可直接看出回包前后元素 y 是否变化。
- 桌面宽视口（≥1024）下 uni H5 `showActionSheet` 是居中 popover，`.uni-actionsheet__action`（取消）`display:none`，只能点遮罩关闭；判断"已关闭"用 `getComputedStyle(.uni-actionsheet).visibility=='hidden'`，元素本身不会移除。
- 用 `nohup python3 xxx.py &` + `$!` 记 pid 后再 `kill`，有时进程仍存活（本轮 holder/abort 各一次）——收尾务必 `pgrep -af holdtab|r445_abort` 按真实 pid `kill -9`，否则视口/Fetch 拦截会一直残留导致后续 reload 仍被拦。
- 只读走查也会写 `growth_events`（`boot` / `stale_fallback`，`probe=1`），收尾按 `uid + created_at>=开始时间 + probe=1` 删即可。

## R446 经验：到期项复查加 `growth_events` probe=0 逐 uid
- `growth_events`（`/api/track` 落库）没有任何看板读它，只能容器内只读查：`SELECT uid, event, COUNT(*) FROM growth_events WHERE probe=0 AND created_at>=? GROUP BY 1,2`；再用 caddy 按 `?uid=` 归因 IP/UA（`Cf-Ipcountry` 源站收不到，geo 要另查）。它能看到「来了没做题」的访客，`answer_log` 看不到。
- 老 uid 回访的 `answer_log` 行 probe=NULL 是 R374（09-04 06:53Z）前历史，别误判为写侧漏标；先查 `probe IS NULL AND created_at>=1788504780` 应为 0。
- `stale_fallback` 同秒成批（7/13 行）= 断网/拦截走查形态，真人极少同时全部接口失败。

## R447 经验：验证首页浮动文字链（`.hero-ds-arc float:right`）与首帧 x 漂移
- 右对齐不变量用 `arc.right - 4 == .hero-bar.right`（`margin-right:-8rpx` = -4px 故意外扩热区）而不是绝对 x；桌面视口绝对 x 会随「是否有占位滚动条」漂 7.5px（docSw 1425 vs 1440），先打印 `documentElement.clientWidth` 再和预期比。
- `.hero-ds` `scrollWidth` 比 `clientWidth` 大 4px、`innerText` 里文字与链接之间出现 `\n`，都是浮动元素副作用，不是折行/溢出；判单行看 `.hero-ds` rect h≈17 + 用 TreeWalker 收集非 arc 文本节点的 Range `getClientRects()` top 是否相同（uni `<text>` 会把文字包在 span 里，直接 `childNodes` 拿不到文本节点）。
- 首帧 x 漂移用 `/tmp/cdp174/r447_frames.py <tabPrefix> <out.json>`：`Page.addScriptToEvaluateOnNewDocument` 注入 rAF 采样 7 s（文案 / arc rect / `.hero-acts.top` / 今日任务卡 top / daily_set responseEnd），reload 后打印「变化帧」与 distinct rect 集合；正常加载能直接看到回包前后那一帧 arc x 是否跳。拦截态照 R445：先清 `apiSnap:/api/daily_set` + `dailySet` 再起 `r445_abort.py`。
- 已完成分支（`dsMeta && dsDone`）只能靠原生做完当天 10 题触发（hero「继续目标 ›」→ 每日一练 → 最后一题点「完成」→ `POST /api/daily_set/submit` 写 LS `dailyDone:<uid>`）；练习页选项 `.opt`、底部「下一题/完成」按钮位置固定，`/tmp/cdp174/r447_opt.py` 可打印选项中心坐标。做完会写 5 张表（mistakes=答错数、answer_log=10、practice_results 1、daily_set_entries 1、growth_events ~3，probe=1），清理用 `/tmp/r447_db.py` 前缀版。
- 长文案边界（rank+streak）真实数据难造，可在 `.hero-ds` 内临时挂隐藏 span 用同 font 量文本宽度推算，报告时明确标「推算」。
- `/tmp/r4xx_ls_orig.json` 的 LS 备份可能是二次 JSON 编码的字符串，恢复前 `if isinstance(orig,str): orig=json.loads(orig)`。

## R448 经验：验证绝对定位文字链 + 注入长文案 + 按钮顶部热区
- `.hero-ds-arc` 改 `position:absolute; right:-8rpx; top:50%; translateY(-50%)` 后，短文案几何与 R447 float 版像素一致（375 arc (280.4,477.4,64.6,41)；1440 含滚动条 `clientWidth=1425` 时 x=1217.9，无滚动条 1440 时 1225.4），仍用不变量 `arc.right-4 == .hero-bar.right` 判右对齐；`.hero-ds` `padding-right` 计算值 62px（124rpx）保证文字不钻到链接下面。
- 长文案（`· 🔥 连 N 天`，streak≥2）无真实数据时按用户授权只做 DOM 注入：`/tmp/cdp174/r448_inject.js` 用 TreeWalker 找 `.hero-ds` 下非 arc 文本节点、替换第一个并清空其余，`void offsetHeight` 后量 `Range.getClientRects()` 行数、arc 中心 vs `.hero-ds` 中心、`arc.bottom` vs `.hero-acts.top`、`.hero-acts.top` 相对短文案 +17。量完 `location.reload()` 恢复真实 DOM。本机无 emoji 字体（`fc-list | grep -i emoji` 为 0），🔥 渲染成豆腐块，宽度与真机可能略差，报告要写明。
- 按钮顶部热区截胡：arc 41px 热区（padding 12px 上下）在短文案下与 hero 按钮 top 有 **2px 重叠**（375 y 516.4–518.4、x 280.4–345，仅覆盖「今日计划」；「继续目标 ›」x 34–243 不受影响），R440 起既有。用 `document.elementFromPoint` 逐 px 判归属，再用 `/tmp/cdp174/r448_click.py X Y`（`Input.dispatchMouseEvent` 可信输入 + 捕获阶段 click 监听记录 `clientX/Y/target`）在 CSS 精确坐标点击验证。computer-use 截图坐标→CSS 有 ±1.5px 误差（1600×1200 显示、截图 1024×768、页面顶栏约 88 截图 px），点「顶部 4px」前先在无害位置点一下读 `__lc` 校准。
- 原生做完 10 题的可复用脚本 `/tmp/cdp174/r448_answer.py [optIdx]`：选项 `.opt` 中心 + 底部「下一题/完成」按钮（叶子文本节点 rect 可能为 0，向上找 h≥20 的父级）；**答对会自动跳下一题**（无「下一题」按钮），脚本按 q 序号推进即可。做完后首页 onboarding「免费刷 10万+」卡消失，hero 整体上移（arc y 477.4→156），比较 y 用相对量。
- 远端诊断别用 `eval "$R" '…$(…)…'` 拼 ssh 命令（`$(...)`/`\"` 会在本机先展开，出现「docker ps accepts no arguments / no such object」），改成本机写 `/tmp/r4xx_diag_remote.sh` 后 `sshpass -e ssh … 'bash -s' < 脚本`。

## R449 经验：验证「热区边界 == 按钮 top」这类 1–2px CSS 改动
- 用 `elementFromPoint(cx, y)` 以 1px 步长扫 `arc.bottom−3 … +3`，并同时记录 `arc.bottom`/`.hero-acts.top`/`.hero-btn.sub.top` 三个值；判据是「边界 y 起归按钮，边界前归链接，无 y 同时归两者」。桌面视口（1440）hero 按钮左对齐，与右侧链接 x 不相交，链接下方是 `.hero-acts` 空白，扫描要分别在链接中心 x 和按钮中心 x 做。
- 可信点击前必须过环境守卫：`{innerWidth, clientWidth, .hero-ds width, arc.bottom, acts.top}`；原生点击/导航后再 reload，holder 可能 5s 后才重申 `Emulation.setDeviceMetricsOverride`，期间 cw 变 360（经典滚动条）、rpx 按 360 算、hero 下移 17px，此时得到的点击结果全部作废。做法：reload 前先重启 holder，等 3s 再量。
- 可信点击证据用 capture 阶段监听 `document.addEventListener('click', e=>window.__t=[x,y,target], {capture:true})` 记录真实 target，再配合 `.mask .sheet` 标题文本判断是「往期」还是「制定学习计划」sheet（`.uni-actionsheet__cell` 判往期）。
- 1440 下用 (100,100) 点遮罩关 uni 计划 sheet 会连带触发桌面左侧导航（落到错题本/提醒页），回首页用 `location.hash='#/'`，不要 `history.back()`。
- 长文案注入（`r448_inject.js`）预期值：375 onboarding 卡在时 arc.bottom 526.9 / acts 535.4（短文案 518.4 + 17），间隙 8.5；用相对量判断。
- 网络 jsonl 字段是 `u`/`st`，拦截失败的 `st` 为字符串 `"FAIL net::ERR_FAILED"`，统计非 2xx 前先按类型分流。

## R450 经验：验证 PK / 小队 / 分享 多页字号下限与热区高度（写入型两 uid 流程）
- 两 uid 同 tab 切换：`localStorage.setItem('anonUid','<uid>')` 后 `Page.navigate`（不要只 reload hash 路由），B 侧 PK 应战 / 小队加入 / `/s/<sid>` 作答均可在同一 tab 完成；PK 结果双方 finished 需 A 侧再进 PK 首页点 `.m-row` 查看。
- PK 答题助手要先 `scrollIntoView({block:'center'})` 再算选项坐标，否则第 4 题起选项在视口外会停住让计时器跑完；一局 10 题 30s/题，卡住可直接等超时进入结果页。
- toast 文案查 `uni-toast` 元素 innerText（`.uni-toast__content` 类选择器为 null）。PK/小队 join 输入框统一是 `input.join-input`。
- 分享 sid 只能从 holder 抓 `POST /api/share/create` 响应拿（页面只复制到剪贴板）；多选题分享用 deep link `#/pages/practice/practice?qid=273031&module=changshi` 让 A 选多项 → `.multi-ok` 确认后再点「🔗 分享给队友」；B 在 `/s/<sid>` 也走 `.opt` 多选 + `.multi-ok`。
- `.remind-btn` 只在对方 `today_n==0` 时渲染：先量 `.remind-btn`，再让对方作答；切 1440 时若双方当天都有作答则量不到，需在流程顺序上前置。
- 清理：`shared_answers.share_id` 是 `shared_questions.id`（整数），不是 sid；按 sid 删需 `share_id in (select id from shared_questions where sid in (...))`；pk_matches 无子表（participants 内嵌列），teams→team_members 用 team_id；uid 列枚举 `uid | *_uid | user_id` 共 41 张表（`/tmp/r450_db2.py`）。
- holder 重启后 reload 若出现 cw 360 / DPR1（目标类读 11.52px）是仿真掉了，不是回归；重启 holder 让其周期重申 `Emulation.setDeviceMetricsOverride` 后重量。

## R451 经验：无 `probe` 列的表不能单看计数；同网段兄弟自动化不带头
- `weekly_reports`/`push_subs`/`mistakes`/`review_log` 等 30 张带 uid 但**无 `probe` 列**的表（枚举：`pragma table_info` 里有 uid 无 probe），到期项复查时「计数 0→N」不能直接当真人旁证，必须 `join answer_log on uid` 看该 uid 的 probe 分布：`select probe,count(*) from answer_log where uid=? group by probe`。R451 首例 `weekly_reports` 1 行 = 全 probe=1 uid。
- 同 /24（`140.232.64.0/24`，`KG_PROBE_CIDRS` 已覆盖）的其它 Devin 会话 Playwright 不带 `X-Kg-Probe` 头、UA 为设备描述符原文（`iPhone OS 15_0`），只靠网段一路打标；caddy 归因用 `Cf-Connecting-Ip` 对 `KG_PROBE_CIDRS`，别按「无头」就判真人。
- 1440 下条件渲染元素（`v-if="!m.today_n"` 的 `.remind-btn`）量不到时，可在 `uni-page-body` 下追加带页面 `data-v-xxxx` 属性的 `uni-view.<class>` 合成元素量真实 scoped CSS（脚本 `/home/ubuntu/r451/remind_1440.py`），报告里注明「合成元素、非条件渲染」。
- 新装的 Playwright python 找不到 headless shell 时用 `p.chromium.launch(executable_path="/home/ubuntu/.local/bin/google-chrome", args=["--no-sandbox"])`，不要 `playwright install`。

## R452 经验：探针识别 ~70% uid 只靠网段一路
- 7 天 caddy 复算：1233 个带 `uid=` 的 uid 里 ~864 个只靠 `Cf-Connecting-Ip ∈ KG_PROBE_CIDRS` 打标（GUI 走查 UA 与真人无异、多数会话不带 `X-Kg-Probe`）。到期项复查时若日报 `humans.ips` 或 `answer_log probe=0` 新 uid 突增，**先核 `KG_PROBE_CIDRS` 是否落后于当前出口**（`curl -s ifconfig.me` 对比 `docker exec deploy-kaogong-1 env | grep KG_PROBE`），再谈真人。
- 复算脚本 `/home/ubuntu/r452_caddy.py`（scp 到 VPS `/tmp` 跑；按 `auth.probe_request` 三路同口径），输出「非探针 uid 逐个 IP/UA」「网段单路 uid」「网段外自动化签名」三段。VPS 自身出口 `150.109.230.174` 的 curl/python-requests 走 UA 一路，正常。

## R453 经验：「像真人的移动 UA」先看 sw.js 的 UA；直打 VPS 的流量别只查 origin 日志
- 归因 iPhone/Android 描述符访客时，同会话 `/sw.js` 请求的 UA 若是 `X11; Linux x86_64`，就是无头 Chrome 移动仿真（SW 注册请求不吃页面级 UA 覆写），不是真机；再看是否与 `Hello from Palo Alto Networks` 这类扫描器 UA 同秒/相邻 IP 成对。
- 宿主 Caddy 现在只有 `kaogong-origin.zalize.com` 块（R453 删了旧 `kaogong.zalize.com` 块）；直打 `--resolve kaogong.zalize.com:443:150.109.230.174` 应得 TLS alert（curl rc 35）。若又出现「无 CF 头却 200」的日志，先核 Caddyfile 是否被回滚/重写。R422 那种 SSE 直连复现改走 `kaogong-origin` 块 + `X-Kg-Edge` 头，或容器 `127.0.0.1:8300`。
- 对账日报 `humans.ips` 时看 `X-Kg-Ua` 全文（不要截 60 字：`ShapBot/0.1.0` 截成 `ShapBo` 会误判没进 BOT_GENERIC），并用 `crawler_stats.py <archive> /tmp/x.json --exclude-ip-file probe-ips.txt` 本地同参数重算对生产 json。
- `.trend-kn` 合成量测脚本 `/home/ubuntu/r453/trend_kn.py`（book 页 `data-v-bcbaf750`，探针头只读）。
- 改宿主 Caddyfile 前看 `journalctl -u caddy --since "10 min ago" | grep tls.renew`：reload 会 `context canceled` 正在进行的续签（自动重试，但要复查）。

## R454 经验：pages.dev 预览域名是扫描器第二入口；journal 看不到直打握手
- 「像真人的 UA」第二判据：同秒 `/sw.js` 的 UA（R453）；R454 又抓到功能机描述符 `SonyEricssonW810i` + `HeadlessChrome/143` sw.js 的组合。这类经 `kaogong-h5.pages.dev` 的流量在 origin 日志里 `X-Forwarded-Host`≠正式域名、referer 为 pages.dev，日报已按 offhost 单列。到期项复查加一条：`(zcat -f archive/*.jsonl*; cat live.log) | 过滤 X-Forwarded-Host 含 pages.dev`，看 **POST 数 / 引擎 UA 数 / 日均**；出现 POST `/api/track`·作答、引擎 UA 抓 pages.dev、或日均 > 50 再立项 301（优先 CF Bulk Redirects，别为此改 `_routes.json` 把 `/` 收回函数）。
- 删了未知 SNI 的站点块后，Caddy 默认日志**不记录**握手失败（直打只得 TLS alert、journal 0 条），别把「journal 没噪音」当「没人直打」；要计数只能 `ss -tn state established '( sport = :443 )'`/tcpdump 抓 SNI。
- 复查 journal error 时先按 `logger`+`msg` 计数，再用同秒窗口逐个对 `/var/log/caddy/*access.log` 判归属（`http2: stream closed` 一类 reverse_proxy 错误不带 host 字段）；宿主上 api-video / jobs / kaogong 三块共用一个 caddy journal。
- `growth_events` 列为 `id,uid,event,source,ref,created_at,probe`（`ref` 形如 `v:<bundle>;sw:0|1`）；`error_reason` 在 `mistakes` 表；生成查询脚本时别在 Python 双引号字串里嵌 SQL 双引号（R454 第一版两次语法错）。

## R455 经验：判断 WAL 是否「该 checkpoint 了」直接数帧
- `-wal` 大小换算帧数：`(size-32)/(page_size+24)`；再逐帧读 24 B 帧头（`>6I`：pgno, commit_dbsize, salt1, salt2, ck1, ck2）对 32 B 文件头的 salt，salt 一致即当前有效帧。有效帧 < 1000（`wal_autocheckpoint` 默认）时文件只增是预期，不是泄漏；≥1000 后由写连接 PASSIVE checkpoint 复用、大小停在高水位；仅 > `journal_size_limit`（应用连接 64 MiB）才截。到期项只在 `-wal` > 64 MiB 且持续 > 1 天时立项。
- `ckpt_seq 0` + 主库 mtime 早于容器启动 = WAL 跨重启被接续（进程未 close 连接），属正常恢复路径。
- 历史归因写「Rxxx 设计」前先 `git log -S'<字面>' -- <文件>` 找首次引入提交（R454 把 `_routes.json` 排除 `/` 误记 R271，实为 Pages 迁移 `3d28c33`）。

## R456 经验：WAL 跨重启保留是既定形态
- 应用停机（SIGTERM 优雅关闭）不会 checkpoint：线程本地 SQLite 连接不 close。重启后 `-wal`/`-shm` 仍在、`ckpt_seq` 不变、主库 mtime 早于容器启动都是**正常**，不要当异常登记。本地复现法：`DB_PATH=/tmp/x/t.db KG_BOOT_QUIET_S=0 python3 -m uvicorn app.main:app --port 8456 &` → POST 几条 `/api/track` → `kill -TERM` → 比对 `ls -l --time-style=+%T t.db*`。
- 本机 `~/.local/bin/uvicorn` 绑的 Python 没有 fastapi，跑后端要用 `python3 -m uvicorn`（pyenv shim）。
- 生产前一容器的停机日志拿不到：`app_log_snapshot.sh` 在停容器前归档，`docker events` 缓冲对该容器为空。
- 探针出口复核一行：origin 24 h 按 `X-Kg-Ip` 分「`140.232.64.0/24` 内」与「段外 + UA 含 HeadlessChrome/Playwright/Devin + 无 `X-Kg-Probe`」两桶；段外常见是 `40.77.*`/`199.30.*`（微软/Bing 渲染抓取，引擎口径已覆盖），不是 Devin 出口漂移。

## R457 经验：部署窗口时序怎么拉
- 停机耗时看 dockerd journal：`journalctl -u docker.service --since '<本地时间>'`（宿主是 **+08:00**，UTC 时刻要 +8 再传给 journalctl）两行 `stopping restart-manager` → `received task-delete event` 之差即 SIGTERM→退出。
- 新进程 listening 时刻用 `docker logs --timestamps deploy-kaogong-1 | head`（`Application startup complete`）；容器 `StartedAt` 只是 runc 起进程，Python 到 listening 还要 ~2 s。
- 窗口是否有流量：origin access log 按 ts 列窄窗（±90 s）逐行看，`/api/health` curl/7.81.0 来自部署轮询、每 ~13 s 一条；「窗口内 0 请求」≠「无停机」。
- 7 天 5xx 反查先排 `wxlogin` 503（`WX_MINIAPP_SECRET` 未配）与 handoff 已登记的 00:35 共宿抖动，再对 `/tmp/kg-compose-*.log` 文件名时间戳看是否落在部署段。

## R458 经验：autoheal / 强杀 / 盘满 怎么查
- `docker inspect --format {{.RestartCount}}` 为 0 **不等于**没被 autoheal 重启：autoheal 走 `docker restart t=30`（原地重启、ID 不变、只有 `StartedAt` 变、RestartCount 不加）。要看 `docker logs deploy-autoheal-1 --since <ISO> | grep kaogong`（形态 `found to be unhealthy - Restarting container now with 30s timeout`）和 `/home/ubuntu/kaogong-reports/container-events.log`（60 s 轮询，`prev=[id StartedAt state health rc oom] cur=[…]`，能抓到 `exited unhealthy 137` 即 SIGKILL）。
- 部署窗口归因不能只靠 `/tmp/kg-compose-*.log`（09-06 13:47Z 起才有）：用 `deploy-history.log`（每次部署完成时刻 + rev）+ `container-events.log`（新旧容器 ID/StartedAt）+ `journalctl -u docker.service | grep -E "stopping restart-manager|task-delete|failed to exit within"`（宿主 +08:00）。`Container failed to exit within 10s of signal 15 - using the force` 含 64 位容器 ID，前 8 位 grep `container-events.log` 判是否 kaogong；宿主 swap 高压时 Recreate 窗口可达 30+ s（正常 5.5 s）。
- origin access log 出现「空窗」先排盘满：`journalctl --since … | grep -ci "no space left"`；caddy 自己会在 journal 打 `write error: write /var/log/caddy/kaogong-origin.zalize.com-access.log: no space left on device`，此时空窗是盲区不是无流量。kaogong 该窗口有无写入用容器内 `mode=ro` 查 `answer_log`/`growth_events` `created_at`（**epoch 浮点**，不要用字符串日期比较）+ `pragma quick_check`。
- 到期项 probe=0 计数一律 `WHERE probe=0`（严格）：`COALESCE(probe,0)=0` 是产品聚合口径，会把 R374 前 NULL 历史行算进去（answer_log 1001 行 / growth 480 行），不是到期项口径。


## R459 经验：宿主历史日志 / autoheal 签名 / dockerd↔containerd 迟滞怎么查
- 宿主 journal 自 09-05 14:43Z 盘满后**只剩那一秒起的档**（`journalctl --list-boots` 首条 = 盘满首秒），查 09-05 前的 dockerd/earlyoom/kernel 一律用 rsyslog：`grep -h <pat> /var/log/syslog /var/log/syslog.1`（08-30 起明文）、`zgrep -h <pat> /var/log/syslog.*.gz`（到 08-09）；`journalctl -u earlyoom` 为空 ≠ earlyoom 没动。
- dockerd 行读法（`sed -E 's/^(.{19}).*msg="([^"]{0,70}).*container=([0-9a-f]{12}).*/\1 \2 \3/'` 压成一行）：`failed to exit within **30s** of signal 15` = autoheal（宿主只有它用 30 s，14 天 21/21 全 kaogong），可直接当 autoheal 动手计数并与 `docker logs deploy-autoheal-1` 逐 ID 对多重集；`within 10s of signal 15` = compose Recreate / 手工 `docker restart`（ID 不变 = restart，ID 变 = Recreate）；`within 10s of kill - trying direct SIGKILL`、`failed to delete container from containerd`、`healthcheck failed fatally … only one connection allowed` 都是 dockerd↔containerd 迟滞/会话断连，**不是应用问题**，只把停机窗口拉长。
- kaogong 容器 ID 归属：`connecting to shim <id>` 后 ≤3 s 内 `sbJoin … ep=deploy-kaogong-1`（启发式，兄弟容器同秒起会误归；精确归属优先 autoheal 日志 / `container-events.log` 里的 ID）。
- earlyoom 形态：`sending SIGTERM to process <pid> … "uvicorn": badness N, VmRSS M MiB` → 10 s 后 `kill failed: Timer expired`（被无视）→ 只有 `escalating to SIGKILL after 1.5 seconds` + `process exited` 才是真杀，随后 containerd `shim disconnected` + dockerd `restarting container`（restart policy，会加 RestartCount）。

## R460 经验：成长页 / 周报 / 知识点趋势簇怎么审
- `/api/growth` 的 `weeks` **只含有作答的周**（`strftime('%Y-%W', …, '+8 hours')`），前端不能把数组末两项直接叫「本周 / 上周」；判定用 `checkin.js::cnWeekKey(cnToday)` 与服务端同口径（周一起算、首个周一前 = 第 00 周，`2024-53`/`2025-00` 边界已单测）。改周键逻辑先用 Python `date.strftime('%Y-%W')` 逐日对拍再改。
- 热力图「学习 N 次」合计与 12 列格子必须同起点（本周周一 −77 天）；任何「从 today 往前 N 天」的合计都要和网格起点对一遍。
- 生产量测成长卡 / 知识点地图：Playwright CDP 只读 + `X-Kg-Probe:1`，先 `goto /` 写 `localStorage.anonUid` 再 `goto /#/pages/stats/stats`（或 `/#/pkgA/stats/mastery-map`），量 `.gw-wk/.gw-pct/.gw-delta/.gw-tab`、`.tab/.tile/.side-item` 的 `getBoundingClientRect` + `fontSize`。375×812 DPR2 仿真 `clientWidth` 常报 **360**（24rpx → 11.52px），要用 1440 对照（12px）+ 源 CSS 判定，不据此改字号（R449 同现象）。
- 一个 CDP 连接开两个 context 并行量测会撞 `service_worker` target attach 报错并断连 → 按视口串行、每次新连接。
- 该簇涉及页：`stats.vue`（成长/热力图）、`calendar.vue`（今天标记用设备本地日期，R438 口径）、`weekly-report.vue`（loading/旧快照/empty/pending/error）、`mastery-map.vue`（375 `.tabs` 横滑行 vs 1440 `.side-nav`，条件渲染，量哪个看视口）。
- 到期项 `weekly_reports` / `mistakes` 无 `probe` 列：关联用 `EXISTS(SELECT 1 FROM answer_log a WHERE a.uid=x.uid AND a.probe=0)`；`weekly_reports` 列是 `week_start/payload/created_at/read_at`（无 `week`）。首开周报即惰性生成一行（`read_at==created_at` 说明是页面自己 GET+`/read`），量测某 uid 的周报页也会写这张表——先看 origin 日志里该行 `created_at` 秒的 `Cf-Connecting-Ip`/UA/`X-Kg-Probe` 再归因。
- probe=0 增量归因套路：`answer_log WHERE probe=0 GROUP BY uid` 拿 `MAX(created_at)` → origin 日志同分钟 `POST /api/answer_log` 的 `Cf-Connecting-Ip` + UA + 有无 `X-Kg-Probe`；vivo `V2405A` UA + 移动网段 = R425/R446 已知内部验收设备，不是外部真人。

## R461 经验：一段 probe=0 会话先认客户端，再谈「看到了哪版 UI」
- 归因 probe=0 会话**先看 UA/Referer 定客户端**再下结论：`MicroMessenger … MiniProgramEnv/android|ios` + Referer `https://servicewechat.com/<appid>/<ver>/page-frame.html` = 微信原生小程序（appid 对 `miniapp-native/project.config.json`），**不是 H5**；H5（含微信内置浏览器打开的 H5）Referer 是 `kaogong.zalize.com`。前端发版后的复验样本若是小程序会话，H5 改动它一条也看不到，(c) 旧壳 404 口径也与它无交集。
- 会话打的接口集合可以反推**它跑的是哪条分支的构建**：把日志里的 `/api/...` 路径逐条 `git grep -l <path> <ref> -- miniapp-native`，对 main 与各活跃 `origin/devin/*` 分支比命中数；main 0/10、某分支 10/10 即为该分支构建（commit / 体验版·开发版不可知，如实写）。
- Caddy access log 的 `ts` 是**响应完成时刻**，慢请求起点 = ts − duration；多条同接口「完成时刻相近、时长各异」先反推起点再判是否并发。几个 20–40 s 的 `POST /api/mistakes/analysis` 起点间隔 ~10 s 从一台设备来，优先查客户端 in-flight 守卫（H5 `book.vue::aiAnalysis` 判 `aiLoading`；小程序 `book.ts::onAiAnalysis` 要同判 `aiLoading`）。
- 空态只能按响应字节推断（`/api/predict` 34 B = `{"status":"cold",…}` 设计冷态、`/api/shenlun/stats` 51 B 无记录），写「字节推断」不写「空态」；小程序真机渲染无服务端证据。
- 发现的缺陷在**他人活跃分支**（未合 main）时不改他人分支：取证文档登记 + 在该 PR 评论给一行修法与证据链接；`git merge-base --is-ancestor A B` 先确认哪条分支包含另一条，评论挂在包含者上。

## R462 经验：预判两条长分支的合并冲突，用「模拟合并 + 对方源锁」量化，不用肉眼看 diff
- 宿主 git 2.34 没有 `git merge-tree --write-tree`；等价只读做法：`git worktree add --detach /tmp/wt origin/main` → `git merge --no-ff -m t <分支A>` → `git merge --no-commit <分支B>` → `git diff --name-only --diff-filter=U` 拿冲突集合 → `git merge --abort`，全程不碰主工作区，最后 `git worktree remove --force`。
- 多条派生分支（W6/W7 都从 W5 分出）冲突集合相同时，先 `git merge-base A B C` 找共同祖先，再对祖先跑一次：冲突根在祖先就不要逐条给下游 PR 评论。
- 「能不能机械解」用**对方分支的 vitest 源锁**当尺：`-X ours` / `-X theirs` 各合一次、把对方 `frontend-uni/tests/*.test.js` 拷到 `tests/` 根目录（不能放子目录，源锁用相对路径）跑 `npx vitest run`（本仓库没有 `--reporter=basic`），失败数 = 该方向的回退条数；再 `git grep -c <功能符号> <分支> -- src/pages src/pkgA` 区分「换写法误报」与「功能不存在」。
- `-X theirs` 仍失败的条目 = 非冲突 hunk 带回的回退，最容易在人工解冲突时漏掉，单独列。
- 合并顺序论证要先核 `origin/main` 是否落后于生产 rev（`git merge-base --is-ancestor`）：main 落后时「先合谁」不是对称问题。

## R463 经验：两条分支各有「热区下限」时，先分层再比数字
- 先问规则落在哪一层：组件层（设计系统 token + `::after`/padding 撑高，视觉高度不变）还是页面层（每个可点元素直接 `min-height`）。两层可并存；合并验收只看「每个可点元素实际命中高 ≥ 页面层下限」，源锁正则要同时接受 `min-height: 40px` 与 `var(--hit-min)`/`::after` 形态。
- 组件层规则最常见的漏洞是「把信息标签组件（KgTag 20px）当按钮用」和「裸 `<text>` 链接」：`git grep -n '<kg-tag' | grep '@click'` + `git grep -n 'class=\"[a-z-]*\" .*@click' -- '*.vue' | grep '<text'` 两条就能列全。
- 审计簇选择要覆盖 `pkgA` 分包页：R430–R460 五次都没选到 `shenlun.vue`，它从 R242 建页起字号/热区没动过。快速排查：`grep -n -E 'font-size: (1[0-9]|2[0-3])rpx' <page>.vue`（375 下 <12px）+ 量测脚本 `/home/ubuntu/r463_shenlun.py`（CDP 375，`X-Kg-Probe: 1`，只 GET）。
- 本机 Playwright ↔ 已运行 Chrome 的 `connect_over_cdp` 第二次连接可能被 `service_worker` target 断言打崩（`targetInfo type service_worker`）：一进程只连一次、多视口在同一连接里开多个 context，或先在页面里 `navigator.serviceWorker.getRegistrations()` 后注销再连。

## R464 经验：带底色小标签当按钮时用 `::after` 撑命中区 + 本地 dist 预检
- 「带底色/描边的 20px 小标签」（如 `.q-paper.tappable`）如果直接 `min-height: 40px` 会变成大药丸、与并排信息标签不一致；改 `position: relative` + `::after { content:''; position:absolute; left:0; right:0; top:50%; height:40px; transform:translateY(-50%) }`，视觉不变。uni H5 `<text>`→`uni-text` inline 元素上此写法可用（Chrome 已验），父级不能 `overflow: hidden`。
- 验证命中带别只看 `getComputedStyle(el,'::after').height`，要 `document.elementFromPoint(cx, cy±19)` 命中 / `±21` 不命中，两边都测才算 40px；源锁正则同时锁 `top: 50%`/`translateY(-50%)`/`height: 40px`。
- 部署前可用本地 dist 做一次同脚本预检：`python3 -m http.server 8765` 起 `dist/build/h5`，Playwright `ctx.route('<base>/api/**')` 把 GET 转发到生产（带 `X-Kg-Probe: 1`、非 GET abort），与部署后生产数值逐项比对一致才算「本地=线上」。多视口在**同一个** `connect_over_cdp` 连接里开多个 context（R463 二连崩掉的规避法）。
- `.chip.sm` 之类子变体去掉自己的 `font-size`/`padding` 竖向值，让高度/字号继承父规则，源锁里反向锁「子变体不含 min-height/font-size」防以后又各写一套。

## R465 经验：审计选簇别绕过主循环页 + header 内可点文字的 40px 法
- 历轮按「簇」选审计对象（每日一练/复习流/分享/成长/申论）会系统性绕过「每题必经」的作答页本体；每 10 轮 SOP-10 至少把 `pages/practice` `pages/book` `pages/index` 三个主循环页跑一遍 `r465_scan.py` 式只读读数（`getBoundingClientRect` + `fontSize`，`.tag .sheet-x .op .fontbtn` 等）。
- 判「谁该撑高」先 `grep -o 'class="[^"]*"'` 出所有挂 `@click` 的元素再核外层容器，纯信息标签（`.real-tag .cnt .mchip .exp-k`）只改字号；模板里 `<text @click>` 的文字链要撑 40px 得改成 `<view class="x"><text class="x-t">`（外层 flex 40px + 负外边距，视觉/省略号搬到内层），`<text>` 上直接 `min-height` 在 uni H5 是 inline 不生效。
- header 单行里的可点文字（`.tag .op`）用 `min-height:40px; margin:-10px 0`，复验必须同时读 `.rhead` 行高（改前后都 20px）与 `elementFromPoint` 命中带，两者缺一即算回退。
- 字号 22→24rpx 会让 nowrap+ellipsis 的标签在 375 多出省略号：复验读 `el.scrollWidth > el.clientWidth`，超出时先收同行 `gap`/水平 padding，不缩字号。
- `min-height: 44rpx` 这类「看起来有热区」的 rpx 值（=22px）是无效值，源锁正则只认 `min-height:\s*40px`。
- 死规则（模板已不引用的选择器）一并抬字号让「样式块内无 <24rpx」一条正则可锁，文档里列清哪些是死规则，不在审计轮删。

## R466 经验：「读数小」先核外层再定改不改 + 到期项脚本两个坑
- 只读读数小于 40 的元素先判三件事：模板是否直接挂 `@click`（`grep -n '@click' | grep class`）、所在行高是否就等于自身高（`getBoundingClientRect` 父级）、抬高会不会抬整行。三者都「是」才修；抬整行会破坏布局的（输入框行 `.sbar`、评论底行 `.ft`、页脚两行文字链）用 `min-height:40px + margin:-Npx 0`，独立行（页签行 `.tabs`、排序 chip 行 `.chips`）直接撑到 40 不算回退。
- 页名 ≠ 源码路径：`search`/`discuss` 在 `pkgA/search/`、`pkgA/social/`，先 `find src -name '*.vue' | grep -i <关键词>` 再写路径，不按页名猜。
- uni H5 同页只改 hash query（`#/pkgA/search/search?q=…`）**不触发 `onLoad`**，要验带参初始态需 `ctx.new_page()` 重新打开；搜索历史 storage key 是 `kgSearchHist`（`uni.getStorageSync`），只在 kw 为空时渲染。
- 到期项脚本判「某表 X 时刻后有写入」必须先 `PRAGMA table_info` 看 `created_at` 类型：TEXT 型（`question_text_backup` 的 `'2026-08-02 …'`）与 `strftime('%s',…)` 比较是字串比较、恒真误报；只对 INTEGER 型列做 epoch 比较。
- WAL「是否复用」不能只看字节：读 32 B 头 `ckpt_seq` + 逐帧 salt 是否与头一致（`struct.unpack('>IIIIII')`），有效帧数 < 帧槽数即已 checkpoint 复用；主库 mtime = 最近一次 checkpoint 写回时刻。


## R467 经验：热区量测的三个假阴性来源 + 部署脚本 600 s 中止后的必做动作
- `elementFromPoint` 命中带测试前必须 `el.scrollIntoView({block:'center'})`：目标在视口外或贴边时中心点 ±19 落到别处，会把已达标元素报成未命中（R467 第一版 `.ann-x .mg-go` 假阴性）。
- 负外边距撑出的 40px 带会被**下方兄弟元素盖住**（`.pbadge-hit` 1440 +19、`.recap-h` 375 下半段）：这是真不命中，不是量测问题；修法 `position:relative; z-index:1`，源锁一起锁。
- 「读数小」先看模板有没有 `@click`：`home.vue` `.tk-go` 16px 无 `@click`，外层 `.tk-row` 52 整行可点 → 不改，源锁反向锁「`.tk-go` 不含 min-height 且 `.tk-row` 挂 `@click`」防以后有人把它当漏审再抬。
- 首页源码是 `src/pages/home/home.vue`，不是 `pages/index`（R465/R466 handoff 写错）。
- `deploy_h5.sh` 远端 `compose up --build` 轮询上限默认 600 s（R468 核过 19 次常态 build p50 82 / max 149 s，不改默认）；宿主层缓存被清 + load >10 时 build 要 17–28 min，脚本会 FAIL 退出但 compose 仍在后台跑。**R468 起中止后按脚本自己打的四行做**：① `ssh … tail -1 /tmp/kg-compose-<rev>-*.log` 等到 `KG_COMPOSE_EXIT rc=0` 且 `/api/health rev` = 目标；② `DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` 续跑 4a–6（不 rsync 不重建；4a rev 闸仍在，容器没换到会被拒）——否则 `/` 静态层仍指旧 bundle 半发版，且 `deploy-history.log` 缺行；③ `KG_COMPOSE_EXIT rc≠0` 才是真失败，预见宿主被挤时可 `DEPLOY_WAIT_SECS=1500` 起新部署（R468 本轮 1500 也超了，1650 s）。别在 compose 没退时第二次全量 `--skip-build` 去追（叠第二个 build）。FAIL 现场 `other_builds=2` 是本次部署自己的 `bash -c` 壳 + `docker compose` CLI，不是别家 build（要看别家用 `ps -eo pid,ppid,etimes,cmd | grep -E '[b]uilder prune|[c]ompose'` 看谱系）。
- **宿主层缓存被清 / dockerd 卡死的第一嫌疑是同机 recruit_app 的 15 分钟磁盘守护（R469 坐实）**：`/etc/cron.d/recruit-disk-maintenance` 第二行 `*/15` 跑 `/usr/local/bin/recruit-disk-guard.sh`，盘 ≥80% 即 `docker image prune -f` + `docker builder prune -f --keep-storage 1GB`（整机三产品共享 1 GB），高负载下一次 3–16 min。查它：`sudo grep -hE 'recruit-disk: guard' /var/log/syslog | tail`（`high-water tier ran`→`ran` 两行相减 = prune 段耗时，CST 时间戳）、`sudo tail /var/log/recruit-disk-maintenance.log`、`ps -eo pid,ppid,etimes,cmd | grep -E '[p]rune|[d]isk-guard'`。R469 起 `host_probe.sh` 多打 `prunes=N`，4-pre 见 prune 也让行（300 s 上限）。`docker exec/system df/buildx du` 120 s 无响应时先看是不是撞上它，到期项改走宿主直读卷：`sudo sqlite3 "file:/var/lib/docker/volumes/deploy_kaogong-data/_data/data.db?mode=ro" '…'`（`error_reason` 在 `mistakes` 表不在 `answer_log`）。caddy 日志按 `ts` 过滤时 epoch 常量用 `python3 -c 'import datetime;…timestamp()'` 算，别手写（R469 首版写成 2025 年）。别去改 recruit_app 的脚本——宿主级改动是老板/该仓库的权限，本仓库只登记 + 让行。
- pip 层 `exit code: 4294967295` 且内核无 OOM → 先查同宿主是否有 `docker builder prune`/其它 build 并发（`ps -eo pid,etimes,cmd | grep -E 'buildkit|builder prune|compose'`），不是 requirements 问题。

## R470 经验：模考簇只读量测法 + 「盒小但命中带够」的判读 + 4-pre 让行实况
- 考试页 `pkgA/exam/exam` 进入即 `POST /api/exam/start` 建 attempt（probe 头也会落 `exam_attempts`）。只读量测答题卡几何时在浏览器侧 `ctx.route('**/api/**')` 拦截该 POST，用 `GET /api/exam/papers/{pid}` + `GET /api/questions?limit=N` 合成 `{attempt_id:0, paper, items}` 回包 `fulfill`，其余非 GET 一律 `abort`；报告页用已提交的 probe attempt（`SELECT id FROM exam_attempts WHERE submitted_at IS NOT NULL ORDER BY id DESC` 宿主直读卷）+ `localStorage.anonUid` 设为该 uid 后打开 `#/pkgA/exam/report?attempt_id=`。
- 弹层打开后 `querySelector('.sheet-x')` 会先命中背景层隐藏节点：过滤 `getBoundingClientRect().height>0` 取最后一个可见节点再量；报告纠错 chip 用 `[class*=type]` 在 375 抓到的是两行容器（87.7），单个 `.rp-chip` 要 1440 或本地 dist 直读。
- 「盒 20px 但 hits −21/−19/0/+19 全命中、+21 不命中」= `::after` 撑出的 42px 命中带在生效（practice `.fontbtn`），不是缺陷，别按 `h` 一列就立项；反过来 `h=40` 但 ±19 有 false 才是被邻元素盖住（R467 `z-index`）。
- `<11.9px` 叶节点计数只在 1440 下当结论用；375 仿真 `clientWidth` 360 把 24rpx 算成 11.52px 会把全页达标节点都数进去（home 56 / book 138 / list 526 全是这个）。
- 源锁禁 `min-height: Nrpx` 时只锁可点元素的选择器（`.rp-chip`），别全文件 `not.toMatch`——textarea / 卡片的 `min-height: 140rpx` 是合法尺寸规则（R470 首版误伤 `.rp-detail`）。
- 4-pre 让行实况：别家 `compose up --build` 一跑 45 min+，让行 300 s 到点必然 WARN 继续，之后本家构建大概率再离群（R470 ~1500 s：pip 413 s + exporting layers 344 s）；直接按 R468 路径走：600 s FAIL 文案出来后 `tail -1 /tmp/kg-compose-<rev>-*.log` 轮询到 `KG_COMPOSE_EXIT rc=0` 再 `DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build`，别重跑第一段。`journalctl -u caddy` 里的 502 是同机别家域名（api-video / mx-ux），kaogong 源站非 2xx 只看 `/var/log/caddy/kaogong-origin.zalize.com-access.log`。

## R471 经验：失败态热区全仓一次扫 + 「改 display 会改布局」+ grep 同名 class 的假命中
- 「加载失败 → 重试 ›」失败态在生产**可以只读稳定制造**：Playwright `ctx.route('**/api/**', abort)` 全 abort 即可，不需要真故障、无 DB 写入；同一脚本对本地 dist（`npx serve dist/build/h5` 端口）复跑就是预检，改前/改后两份 JSON 都要落盘（R471 改前只在终端回显、只剩范围 18–22px 可登记）。
- 同一类控件（`.retry`）别按簇修：`grep -rl 'class="retry"' src` 一次列全（17 页），历轮按簇只修了 6 页；源锁用「递归发现 + 阈值 ≥N」防漏扫，阈值是防漏扫下限不是页面总数断言。
- **补 `min-height` 时改了 `display` 就是改布局**：`<view>` 在 uni H5 默认 `display:block`，`inline-flex` 会让「`加载失败：{{err}}<view class="retry">`」同容器的重试从独占一行变成贴着错误文案同行（R470 list + R471a 5 页，源锁/vitest 拦不住，生产失败态截图才看见）。要独占一行 + 40px 命中带用 `display: flex; align-items: center; justify-content: center`（R464 shenlun 写法）；只有 `.retry` 是独立子节点（父 `.empty` 是 flex 列）时 `inline-flex` 才等价。每次改 `display` 都要截一张失败态图，别只看 `h`/hits。
- `git grep <组件名>` 命中的文件先看是 `<rank-card>` 标签还是本地同名 class（team.vue 的 `.rank-card` 是 `.card` 的修饰 class），别把同名 class 登成「另一挂载点」。
- 宿主 TZ=CST：在宿主上用 python 过滤 caddy JSON `ts` 时 `datetime(...).timestamp()` 是本地时区 → 窗口提前 8 h（R471 把 R461 vivo 会话 272 行数进「新容器后」）；一律 `datetime(..., tzinfo=timezone.utc)`，或用 caddy 自带的 `-o cat` + `--since` 在 journalctl 侧过滤后再核 host。
- `DEPLOY_RESUME=1` 前别先提 docs commit：4a rev 闸比的是本机 HEAD，HEAD 一动就被拒（设计如此）；先 resume 再提文档，或 `git checkout <部署 rev>` 跑完再切回分支。
- `/api/monitor/report` 上报体只转发中心不落本地；核来源用 caddy 行的 `Cf-Connecting-Ip` + UA（`moto g power (2022)` = Lighthouse 移动仿真、本机出口 IP = 自己的 6b），别把部署 Lighthouse 触发的 1 条当用户侧 JS 错误。
- 4-pre 让行 WAIT 期间别家 build 退出会提前放行（`other_builds=0`），不一定等满 300 s；但之后本家构建照样冷启（守护 `builder prune` 常驻），600 s FAIL → 等 `KG_COMPOSE_EXIT rc=0` → `DEPLOY_RESUME=1` 路径已是常态，不必每轮再登记为异常。

## R472 经验：回扫「谁改过 display」要整行抽、要看父容器
- 本仓 `<style>` 大量单行规则 `.x { display: inline-flex; min-height: 40px; ... }`，`grep '^\+\s*display:'` 只命中独占一行的写法（R472 第一版据此得出「R410 起只新增 3 条 display」的假结论，实为 87 条）。回扫用 `git diff <起点>~1 HEAD -- frontend-uni/src | grep -E '^[+-]'` 后按 `display:\s*([a-z-]+)` 在整行抽，再按 (文件, 选择器) 归并 `-`/`+` 集合看净变化。
- 判「改 display 会不会改行」只看三件事：元素默认（uni H5 `<view>` block / `<text>` inline）、父容器是否 flex/grid（是 → 子项 blockified，inline-* 与 block 等价，不会改行）、同容器有没有行内兄弟（`<text>`/裸文本/inline 规则的元素）。父 block + 有行内兄弟 + 块级↔行内变化 = R471a 形态，必须截失败态图；父 block 无行内兄弟只是宽度从撑满变内容宽（居中靠父 `text-align`）。
- 制造失败态的页面参数要按 `onLoad` 实际读的 key：exam/report 是 `attempt_id`（传 `aid` 走到无参分支 → 「暂无成绩报告」空态不是失败态）；search 要 `?q=` 或真的输入回车才发请求。

## R473 经验：需要登录态才会发请求的页面，用 `add_init_script` 注假 token 再 abort
- 登录态判定在 `api.js getToken()` = `uni.getStorageSync('authToken')`，H5 下就是 `localStorage.authToken`。`onShow()` 里先判 token 的页面（如 `pkgA/social/inbox`）无 token 根本不发请求、`route().abort()` 制造不出失败态；`context.add_init_script("localStorage.setItem('authToken','probe-fake')")` 在页面脚本之前写入即可，不用真登录。配合 `**/api/**` 全 abort 无任何写入。
- SOP-10 §4 硬指标一次性全路由复扫模板：`/home/ubuntu/r473_axe.py`——`add_script_tag(content=axe.min.js)`（本机 `~/.npm/_npx/*/node_modules/axe-core/`）后 `axe.run(document,{runOnly:['color-contrast','link-in-text-block']})`，同页再读 `documentElement.scrollWidth` vs `clientWidth` + 遍历 `body *` 找 `right>cw+1 || left<-1` 的非 fixed 元素。越出命中先看 `visibility` 与祖先 `overflow`：uni resize-sensor 的 `visibility:hidden` 探测 div（宽 100000 / 400 等）和 `uni-scroll-view overflow-x:auto` 里的 chip 都不是缺陷，别当溢出登记。

## R474 经验：「功能触达率」怎么只读盘点 + Caddy 时序/字节的两个口径坑
- 触达率一律分 6 层写：代码存在 → 接口被请求 → 接口 200 → 数据落表 → 前端渲染 → 真实用户走完整流程；各层证据源不同（源码 / caddy / caddy status / DB / 无一手只能写「未验证」）。模考报告簇的用时·模块统计·历史·目标分·rank·推荐五张卡都以 `submitted_at` 非空为前提，一个 `exam/submit`=0 就是五个 0，别写成五条独立缺口。
- 非探针口径三件套：排除 `Cf-Connecting-Ip` 在 `140.232.64.0/24`、排除带 `X-Kg-Probe` 头、`exam_attempts.probe` 三分（NULL=加列前历史不可归因 / 0 / 1）分别列。`probe IS NULL` 的 29 条 attempt 不能算真人也不能算探针。
- Caddy access log `ts` 是**响应写出**时刻，长 LLM 请求的起点要 `ts - duration` 反推；同一秒内多条重叠请求用 `Cf-Ray` 单调性 + 请求 `Content-Length` 判是否同体重复。源站每个 site 块都 `encode gzip`，`size` 是压缩后字节，不能反推正文字数（`mistakes/analysis` 845 B ≠ 正文很短）。
- 生产 `explain_cache` 可宿主直读核 AI 讲解是否真落正文（`length(explanation)`）；`mistakes/analysis` 无结果表，只能用 status+size 判「服务端成功」，渲染与否无证据。
- 小程序客户端识别：Referer `https://servicewechat.com/<appid>/<版本号>/page-frame.html`，版本号 `0` 是开发/体验版（推断）；同一用户几秒内出口 IP 切换是移动网络常态，别当两个人。
- 同 uid 同请求体的 AI 接口在飞行中重复（explain ×2 / analysis ×4）是 R474 登记的 R475 候选：先查客户端为何重发（本机无微信开发者工具复现不了），再论服务端 single-flight；`rl` 只限量不去重，`book.vue aiLoading` 守卫只管同一页面实例。

## R475 经验：AI 接口飞行中重复的归因与服务端 single-flight 生产验证
- 先认客户端：Referer `servicewechat.com` = 原生小程序 `miniapp-native`，**不要拿 H5 `frontend-uni` 源码去核守卫**（R474 犯过）；再用 `git log --all -S'<函数名>'` / `git show <commit>~1:<path>` 取事发时刻之前的版本，兄弟会话分支（如 `origin/devin/w7-mp-flat-v3`）的提交说明常已写明「生产实测」线索。
- 重发形态判别：同页面重入 = 起点间隔十几秒、每条 duration 完整、全 200；超时重发 = 间隔 ≈ 客户端 timeout 且前一条 duration 也 ≈ timeout；页面栈多实例 = 起点几乎同刻。`gzip size` 各异 = 各自独立生成（合并后同 size 同刻结束）。
- 验证 single-flight（探针 `X-Kg-Probe: 1`，写库 0）：同 uid 4 个 `curl` 并发（`&` + `wait`）比 `sha256(analysis)`/长度/结束时刻 → 应同 sha、Caddy 同 size、结束时刻差 ≤ 几十 ms；紧接再发 1 次应 sha 不同且耗时完整 = 成功未缓存、槽已清。脚本样板 `/home/ubuntu/r475_probe.sh`（生产 `ACCESS_CODE` 未配、`check_access` 直接放行，不用带头；uid 必须已有待掌握错题，否则走「错题本还没有待掌握的错题」短路不打 LLM、测不到合并）。
- 后端单进程（`Dockerfile.runtime` uvicorn 无 `--workers`）→ 进程内字典即全局；改多 worker 前先换共享介质。请求体若加字段，合并键必须并入（当前 `body: dict` 只读 `uid`）。
- 单测里 mock `llm.chat` 的并发用例要 `await asyncio.sleep(0)` 多轮让任务真正跑到 await（`_spin()`），否则断言早于协程进入合并点。
- Caddy 按 IP 归因 UA 时用 `Counter` 取全量再下结论：141.11.46.193 是 `VivoBrowser`（系统浏览器）不是微信，R474 凭机型联想会错。

## R476 经验：「要不要做聚合端点」先量墙钟；面试/任意功能漏斗的浏览形态判别；小程序两条官方硬约束
- 「N 个并发请求要不要合成 1 个」不要凭请求数拍板：Playwright over CDP（`connect_over_cdp('http://localhost:29229')`，`X-Kg-Probe: 1`、探针 uid）+ `Network.emulateNetworkConditions`（4G latency 100 / 3G 300）在生产页面上量 `request→requestfinished` 的合并墙钟，同页同网况再 `fetch` 一个既有单端点作对照（脚本形态见 `/home/ubuntu/r476_fanout.py`，每网况 ≥5 轮、首轮冷启离群单列）。HTTP/2 下 9 并发 ≈ 1 RTT + 80–150 ms，收益 <1 RTT 就不值得把可独立渲染的卡片绑成最慢者决定首绘。R62 `home_bundle` 的前提是当时 origin 45 s 长尾，先核 Caddy 端点 p99/>1 s 条数确认前提还在不在。
- Caddy 端点时延分布一次取：按 `uri.split('?')[0]` 归端点，`duration` 排序取 p50/p90/p99/max，`>1.0` 单列样本；「onShow 扇出」用同 (ip, uid) 2 s 窗口内 distinct 端点数 ≥5 聚簇即可复现每次切页的请求组。
- 功能漏斗「有 A 请求没 B 请求」先看停留时长与前后页：同 uid 时间线里 A 后 3–6 s 下一请求已是别的页面、且 4–5 min 内十几个页面每页 2–8 s = 浏览一遍形态，不是「想做没做成」；写结论只能说「日志未观测到 B」，不立项提醒/自动续做。`interview_sessions` 只在回答成功后写入，question 请求 ≠ 面试。
- 部署后 (c) 补量的时间 filter 用 `docker inspect -f '{{.State.StartedAt}}'` 的秒（本轮与脚本常量同秒），不要用 deploy 日志或估算。
- 微信官方文档（`developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html`）两条核过的硬约束：`wx.request` 最大并发 **10**（一页 onShow 9 连 + 飞行中 AI 长请求即顶满，多余的排队）；Referer `servicewechat.com/{appid}/{version}/` 的 `{version}=0` = 开发版/体验版/审核版三者、`devtools` = 开发者工具，报告里写「非正式版」不要写死「开发版」；进入后台 5 s 内未结束的请求回调 `fail interrupted`。


## R477 经验：「同 uid 重复 AI 请求」判端侧成因的三件一手
- 看**前置请求**：小程序问答页 `submitText/submitImage → ensureAccess()` 每次手动提交前会发一次 `GET /api/access_info`（无访问码时；全小程序只有 `ask.ts` 调它，`git grep fetchAccessInfo` 核），Caddy 里每条 `explain/stream` 前 1–2 s 有没有它，直接区分「手动重点」vs「代码自动重发」；`streamPost` 失败的降级路径是**非流式** `/api/explain`，看它有没有到源站再判降级是否发生。
- 看**留存表**：`ask_cur.items[*].ts` 是端侧 `Date.now()`，与 Caddy 起点（`ts − duration`）对齐即可判断哪一次提交留了下来；rec 只在 `onMeta`/成功后 `unshift`，`catch` 不插入 → 「N 次请求只留 1 条 rec」= 只有 1 次端侧成功。`explain_cache` 是 `INSERT OR REPLACE`（同一条流末尾 3 ms 内写 `key` + `raw_key` 两行），分不出前一次有没有落过库，别拿它当次数证据。
- 看**出口 IP 是否永久切换**：旧 IP 此后 0 新请求 + 新 IP 接管全部后续 = 网络切换；Caddy 对端侧已放弃的流仍记 200 + 完整时长 + 完整字节，源站「跑满」不能反推端侧收到了。
- 只读查询模板：`ask_cur` / `ask_sessions` 行的 uid 先用 Caddy 三路（140.232.64.x / `X-Kg-Probe` / 自动化 UA）归类再谈「真实留存」；`api_ask_cur_get` 有 7×24 h 口径，过期时间 = `updated_at + 7 d`。
- `docker logs --since/--until` 取容器日志时若返回极少（本轮 1 行），先确认容器日志是否落在同窗口（部署重建后 `docker logs` 只含新容器），别把「没日志」当「没异常」。

## R478 经验：uid 归类与探针 uid 卫生
- **探针一律用专用新 uid**（`anonUid()` 形态随机生成即可），不得复用任何在 R446/R452 身份表、`growth_events probe=0`、`ask_cur`/`ask_sessions` 里出现过的老 uid：R475 拿 `umsacie728f4ghcv8`（R446 判「身份不可考」）当探针，把「09-05 非探针会话」与「09-07 探针」混在同一 uid 下，R477 据此把它整条归成探针（R478 勘误）。
- 给 `ask_cur`/`ask_sessions`/`explain_cache` 等**无 probe 列**的表归类时，不能只看当前 Caddy 文件（文件起点前的会话不可见）：对每个 uid 用 `pragma table_info` 枚举含 `uid`+`probe` 列的表（`answer_log`/`exam_attempts`/`growth_events`）统计 p0/p1/NULL，再与 R446/R452 身份表交叉；p1 行的时间若全在某次探针之后，之前的行不能算探针。
- `kaogong-reports/app-log/*.log.gz` 的覆盖起点 = 首个归档的 StartedAt（当前 09-06 15:11Z），不是「14 天」（那是保留期）；下「N 天无 `[llm] stream` 告警」结论前先 `ls` 最早文件。uvicorn 访问日志行的时间是**响应开始**（流式请求 = meta 之前），与 Caddy `ts − duration` 反推起点在 ±30 ms 内可互证。
- `explain/stream` 的 `event: error`（含 `chat_stream` 中途 `httpx` 异常）在服务端**不写日志**、Caddy 仍记 200：B 路径（meta 后失败）只能从端侧 / 用户反馈 / `ask_cur` 空 explanation 侧面看，服务端日志 0 ≠ 未发生。

## R479 经验：问答页 / 面试簇只读量测怎么把结果态与 sheet 渲染出来
- **uni H5 的 `uni.setStorageSync` 落 localStorage 是包装格式** `{"type":"object","data":<value>}`：要让问答页恢复结果态 / 历史 sheet 有行，必须写 `askCurSession` / `askSessions` 为该格式（裸数组页面读不到，R479 首版量测空态误判）。占位 item 用 `explain_key:'r479-local-only'`、`saved:false`，只在浏览器本地渲染、不落库。
- 面试记录页 `/api/interview/history` 用 `page.route(...).fulfill()` 浏览器侧占位回包，不在生产制造记录；注意有数据态下空态 `.btn-primary` / 失败态 `.retry` 不渲染，量不到要如实写「源码 + 源锁」。
- **选簇依据用 `git log <生产 rev> -- <路径>` 查触碰史**：R410 后只有功能改动触碰的页面 = 未过审簇（R465 practice / R470 exam / R479 ask+interview 都是这样找到的），比按文档逐字复核快且不漏。
- sheet 关闭 ✕ 抬到 40px 用 `min-width/min-height:40px` + 负外边距（`margin:-6px … -6px 0`），改后要读 `.sheet-h` 高度确认头行没被抬（R479 改前/改后都是 28）；命中判定用 `elementFromPoint` 中心 ±19 / ±21（脚本 `/home/ubuntu/r479_hits.py`）。
- 375 叶节点字号下限：360 仿真下 24rpx = 11.52 px，阈值 11.9 会把 24rpx 自身留在 ≥ 侧、只抓 ≤23rpx；uni tabbar label 10 px 是框架全站样式，历轮都不计入页面命中。

## R481 经验：有登录门槛的分包页怎么在生产只读进入有数据态
- **`api.js getToken()` 读的是裸 `uni.getStorageSync('authToken')`**（字符串），H5 落 localStorage 时**不是** `{type,data}` 包装（那是对象/数组值才有的格式）：`add_init_script` 写 `localStorage.setItem('authToken','r481-local-fake')` 即可让 inbox 走过 `onShow` 的 `getToken()` 门；写成包装格式页面读不到、仍落登录分支（R481 首版误判）。
- 有数据态占位回包要按页面的时间契约给值：plaza / inbox `fmtTime(ts)` 是 `new Date(ts*1000)`，占位必须给 **Unix 秒整数**，给毫秒或字符串会渲染 `NaN-NaN NaN:Na`（占位数据错误，不是产品缺陷）。
- 进有数据态同时要 `route.abort()` 非 GET（inbox 进页会 `readCommentInbox()` 回写已读），保证 0 库写入。
- 复用 sheet ✕ 负外边距法前先读该组件 `.sheet-h` 改前高度：头行本来 <28（export-confirm 22.7）时 `-6/-6` 会把头行抬到 28，要在文档如实登记而不是只写「不抬」。

## R482 经验：monitor「真人行」口径与 `Script error.` 的判法

- **真人 monitor 行**必须两侧交叉：中心 `GET /api/errors?site=kaogong`（key 从 VPS deploy `.env` 取、只在远端 shell 用、不打印）按 `internal=0` 初筛后，还要剔除出口在 `KG_PROBE_CIDRS`（`140.232.64.0/24`）的行——R392 之前的历史行 `internal` 全为 0，不代表真人；再用 Caddy **全部** `kaogong-origin.zalize.com-access*`（含 `.gz`）的 `POST /api/monitor/report` 按 `Cf-Connecting-Ip` / UA / `X-Kg-Probe` 归类对账，两边条数对得上才算口径闭合（R482：114 条里真人 2 条）。
- `message="Script error."` + `stack=NULL` 是跨源脚本脱敏（规范 muted errors：`filename=""`、`error=null`），**不是本站代码抛错的证据**：本页脚本全同源（主 bundle `crossorigin`、内联 splash / route-preload），CSP 白名单里的 `career.zalize.com/nav.js` 已下线。判法：`rg "createElement\('script'"` / `rg career.zalize` 前端源码为 0 → 只能是页面外注入脚本。R482 起 `main.js` 已过滤（`isMaskedCrossOriginError`：message 匹配 ∧ 无 `error` ∧ 无 `filename`），生产复验用 `window.dispatchEvent(new ErrorEvent('error',{message:'Script error.'}))` 应 **0** 条 `/api/monitor/report`，而 `new ErrorEvent('error',{message:'Script error.',error:new Error('x')})` 或 `filename` 非空应照常上报。将来若加第三方 SDK，`<script>` 必须带 `crossorigin` 且对方返回 CORS 头，否则其报错也会被浏览器脱敏而被这道闸丢掉。
- 中心告警阈值是 `internal=0` **≥1 条 / 15 min**（站点 1 h 节流），所以任何一条噪音真人行 = 一封告警；核「有没有发」只能查 D1 `alert_state`（无 HTTP 读接口，需 wrangler 登录态），本机没有时如实写「按代码应触发、送达未核」。
- **部署前看宿主盘**：`deploy_h5.sh` 4/6 让行只等其它 compose build/prune 最多 300 s、超时不阻塞；若 `df` 非 root 可用已是 0（兄弟项目构建期常见），要手动中止（`kill_shell`），不要让它超时后在 0 B 盘上起重建。此时 1/6–3b 只 rsync + 预热、对运行容器无影响（dist 在镜像内，非 bind 挂载）。盘满时线上写入是否受影响用 `X-Kg-Probe: 1` 的 `POST /api/track {"event":"boot"}` 探（容器 uid 0 可用 ext4 root 保留块 ≈2.1 GB），落库后查 `growth_events` probe=1 行。

## R483 经验：时政题号撞 `questions.id` 与「按题号聚合」类核法
- `shizheng_questions.id` 与 `questions.id` 是两套自增、必然撞号；任何按 `question_id` 聚合 / JOIN / 去重 / 推进 SRS 的路径（`refresh_question_stats`、`list_mistakes`/`due_reviews` `LEFT JOIN questions`、`_find_open_mistake`、`save_mistake` 去重）都必须先确认行的 `module` 是行测五模块。核法：`SELECT module, question_id IS NOT NULL, COUNT(*) FROM answer_log|mistakes GROUP BY 1,2` —— `('时政', 1, n)` 有行即撞号污染；`questions` 外显统计是否被污染用「该 qid 在 answer_log 里按 REAL_TRAFFIC 口径的**行测**作答行数」对照 `attempt_count`。R483 起服务端 `foreign_module_qid()` 置空，新行不应再出现；再出现先看 module 是否空字符串（空 module 仍信题号）。
- 历史修复走 `scripts/r483_shizheng_qid_null.py`（`DB_PATH` 指库；默认 dry-run，`--apply --record x.json` 置空并留 `{表:{id:旧 qid}}`，`--restore x.json`）。生产顺序：容器内 `python3 -c "sqlite3.connect('/data/data.db').backup(sqlite3.connect('/data/data.db.rNNN-before'))"` + `quick_check` → `docker cp` 脚本进容器 → dry-run 对表 → apply → re-dry-run 0 → **手动** `POST /api/admin/refresh_stats`（容器内 `python3 urllib` 打 `127.0.0.1:8000`、`X-Admin-Token` 取容器 `$ADMIN_TOKEN`；容器无 curl）让 stale 分支把只剩非行测作答的题统计清 NULL（不手改 `questions`），写前/写后各拉一次这些 qid 的 `attempt_count/correct_ratio/most_wrong` 对照。
- `refresh_question_stats` 只在 `_stats_refresher` 每 6 h + 启动静默期后跑，且受 `_wait_heavy_task_slot` 门控；改了 answer_log 想立即看外显统计要走 admin 端点，不要等。
- Caddy 补量脚本若用 `/var/log/caddy/*.log` 必须按 `request.host` 含 `kaogong` 过滤——同宿主还有 `api-video` / `jobs` 站点日志，否则会把别站 UA 当成本站非探针流量。

## R484 经验：时政 `_sz` 源边界要沿「裸 qid 往下传」全路径核，不只看落库
- R483 修的是 answer_log/mistakes 写入；同页凡读 `this.cur.id` / `q.id` 往别处传的（`redoQid` → ask 页 `pendingQid` → `explain/stream question_id` → 服务端 `questions_by_ids`；`findAskSid` 本地匹配；`askViewUrl` 深链）都要按 `_sz` 守卫核一遍。`askQid()` 只校验正整数，不辨源表，不要指望它拦。服务端 `foreign_module_qid` 只挂在 answer_log/mistakes，`explain/stream` 的 `question_id` 没有 module 上下文可兜底 → 端侧是唯一闸。
- 盘「按 question_id JOIN/聚合」是否吃别表 id：取 `shizheng_questions` id 集，对每张带 qid 的表做 `qid ∩ 集合` + 文本交叉（撞号≠污染：`mistakes` 有 1 行 `ziliao` qid 41 撞号但文本=行测题）；`interview_sessions.question_id` 属静态 `backend/app/data/interview_questions.json`、`shenlun_answers` 属 `shenlun_questions`，与 `questions` 对不上是正常的，不要当孤儿。`practice_progress` 列是 `psource` 不是 `source`。
- 生产库 `created_at` 是 epoch **real**，算「某容器起之后」的窗口用 `docker inspect --format '{{.State.StartedAt}}'` 换算，先 `select created_at, typeof(created_at) ... order by id desc limit 1` 核一眼，别手写日期 epoch（本轮首版写成 2025 年把全表算进窗口）。
- 端侧验「有没有写某个 storage 键」不能事后读：ask 页 onShow 即 `getStorageSync + removeStorageSync` 消费 `redoQid`，点击 1.5 s 后再读必为 null。在点击前 `Storage.prototype.setItem` 包一层记 `window.__setLog`（switchTab 是 SPA 内跳转，window 不换）。uni H5 的 storage 值格式：字符串原样、其它为 `{"type":"number","data":N}`，注入 `practiceLaunch` 也要按此格式写 `{type:'object',data:{...}}`。
- 时政场次 CDP 入口：先落 `practiceLaunch {kind:'shizheng'}` 再 `goto #/pages/practice/practice`；`.deep`（AI 详解深链）只在选了选项后渲染，选项一点就发 `answer_log`/`mistakes`（记成探针写入，带 `X-Kg-Probe: 1`）。
- Caddy 统计**只读 `/var/log/caddy/kaogong-origin.zalize.com-access.log`**；同目录还有兄弟站点（storyboard/drama/vidgen/major/job 等）的访问日志，`glob('/var/log/caddy/*.log*')` 会把它们的流量算成 kaogong（R485 首版出现「陌生 IP 1001 请求」假象）。真实出口看 `Cf-Connecting-Ip`，`remote_ip` 是 CF 边缘。
- 说「服务端会按错 qid 取题喂 LLM」之前先跑 `engine.extract_from_qbank(row, text)`：它按题干前 40 字逐字命中 fail-closed，qid 与题文对不上返回 None（R485 勘误 R484）。`explain/stream` 的缓存命中分支 `meta0` 不回传 `qid`，端侧 `askQid(m.qid) || qid` 的回落是为它保留的，别当 bug 删。
- 小程序端契约核对：W7 `api/social.ts streamExplain()` 不带 `question_id`、main 小程序无问答页——`explain/stream question_id` 发送方全产品只有 H5 `ask.vue`；`git grep -n <关键词> origin/devin/w7-mp-flat-v3 -- miniapp-native` 只读核即可，不动 W7 文件。
- 生产库「题文 ∩ 题库」交叉不要写成 SQL `replace(question,...) LIKE ?` 对 `questions`（157k 行）循环——R486 跑 >15 min 不返回；kill 本地 ssh 后宿主上 `sudo python3 -` 子进程仍在跑（`pgrep -af "python3 -"` 查、手动 kill）。正确做法：Python 一次 `select id,question from questions where disabled=0 or disabled is null` 取活跃题干前 12 字建 dict（≈4.5 s），再对目标文本滑窗查 dict；宿主脚本一律 `sudo timeout 200 python3 -`。
- 判断「R421 qid 直通有没有真跑过」看 `explain_cache.qid`（R423 起才记；缓存命中分支不写）；`ask_cur.items[].qid` 只说明端侧带了 qid，不说明服务端走了直通。
- H5 页面间跳转全是 `uni.switchTab`/`navigateTo`（SPA 内路由），后续 API 请求的 Caddy `Referer` 永远是**首次进站 URL**（`/`、`/s/<code>`），不能用 referer 证明「从 A 页到 B 页」；只能靠 `growth_events` 埋点。核某入口触达前先 `grep -n "trackEvent('" frontend-uni/src` 确认它有埋点——R487 前 6 个问答入口只有练习页那个没有。给新入口加埋点必须同步 `backend/app/team.py` 白名单（`test_track_whitelist_sync` 会锁），`ref` 里时政题记 `'sz'` 不记数字（撞号）。
- 小程序流量在 Caddy 里的 Referer 是 `https://servicewechat.com/<appid>/<ver>/page-frame.html`、UA 含 `MiniProgramEnv/android|ios`；appid 与 `miniapp-native/project.config.json` 对得上才归 W7。W7 `explain/stream` 不发 `question_id`，看到 `explain_cache.qid NULL` 先分端再判。
- `deploy/perf-budget.sh` 出现「Lighthouse 运行失败」时（R488 起）同一行带 `rc=` 与 loadavg、下面跟 lighthouse stderr 末 20 行——先读它分类（interstitial / 超时 / Chrome 起不来 / 协议错误），再决定是否手动复跑 `./deploy/perf-budget.sh /`。R488 前的部署日志（含 R487 那次）stderr 已被 `2>&1 >/dev/null` 吞掉、不可追溯，别回头猜根因。手动复跑必须 `--output-path=/tmp/lh_N.json` 落盘再读 `categories.performance.score` / `audits.*.numericValue` / `environment.benchmarkIndex` / `runWarnings`——R487 口头记的「perf 0.57」没落盘就无法复核。判读以 LCP/CLS 数值 + 83 份部署日志分布（`/` OK 0.90–1.00、FAIL 仅 0.81/0.84/0.86 三次）为准。`CHROME_PATH` 指向不存在文件时 lighthouse 不会失败（chrome-launcher 自行找 Chrome），不能用它构造失败路径；构造失败用 `SITE=https://<不存在域名>`。
- 生产 Caddy 站点日志轮转文件名是 `kaogong-origin.zalize.com-access-<date>.log.gz`（R489）：全历史扫描 glob 用 `/var/log/caddy/kaogong-origin.zalize.com-access*`，写成 `…-access.log*` 只会匹配当前文件、悄悄漏掉轮转前的全部（09-05 18:44Z 前的 `explain/stream` 就在轮转文件里）；仍然禁止 `/var/log/caddy/*.log*`（兄弟站点污染）。查「某入口有没有人点过」先 `select event,probe,count(*) from growth_events where event like '%<name>%' group by event,probe`（全表、分 probe），再用 `X-Kg-Probe: 1` 拉当前 bundle 各分包 grep 事件名确认埋点确实在线上，两步都 0 才谈「未触达」；`error_reason` 列在 `mistakes` 不在 `answer_log`。
- 发版前先 `pgrep -af "compose up -d --build"`（含 cwd `ls -l /proc/<pid>/cwd`）——同宿主 `/opt/SoftCopyrightAgent` 等兄弟项目构建期盘可掉 1–5 G（R482 曾到 0 B）；等它退出、`docker ps` 里兄弟容器 Up 后再跑 `deploy_h5.sh`。
- 数「某功能有几个入口」不要按页面数、要按**调用点**数（R490）：`book.vue` 复习态 `askFromReview()` 与列表展开卡 `redo(m)` 是两个问答入口、埋点各自独立，R487/R489 按页数成「6 入口」漏了后者，排除法结论随之错。可靠做法：`grep -n "uni.switchTab({ url: '/pages/ask/ask' })"`（或目标路由）列全调用点，逐个核方法体有无 `trackEvent`；已加源锁「所有写 `redoQid` 的方法体必有 `*_ask_click`」。给自然用户归属 SPA 内入口时用「同一秒的伴随 API 指纹」：列表展开卡 = `/api/attempts`+`/api/notes?…question_id`+`/api/comments/count` 三请求同秒（`/api/attempts` 全 book.vue 只在 `toggleCard`），复习态无 `/api/attempts`；再看两秒内有无 `POST /api/track`——有埋点的入口必有，没有就是无埋点那个。
- 审「列表 + 当前态」类功能（问答历史 sheet / 错题本筛选 / 收藏夹）必跑一条**「删的就是正在看的那条 → 再做会触发归档/保存的操作（新对话/切换/退出）」**用例（R491）：只删非当前项看不出 `archiveCurrent()` 类回写复活；判定看本机列表 + 有没有多出 `POST /api/ask/sessions`。历史 sheet 的 `.rec-row`/`.rec-brief` 与结果区「最近讲解」同名，选择器要限定 `.sheet .rec-row`、删除按钮用行内 `.rec-del`（别按 `.nth(k)` 数全页）；修后「新对话」按钮随 `results` 清空而消失，脚本要按是否存在分流。
- 改前后同一脚本对照：`frontend-uni/dist/build/h5` 直接 `python3 -m http.server <port>` 起来、`ctx.route('**/api/**')` 全 mock/abort 后跑同一 CDP 脚本（`R491_BASE=http://localhost:<port>`），H5 hash 路由不需要后端；发版后再对生产跑一遍即三点对照，0 库写入 0 LLM。
- 源站 Caddy 日志按探针网段判身份要取 `Cf-Connecting-Ip` 头，`request.remote_ip` 是 Cloudflare 边缘 IP（104.23.* / 172.68.*），按它判网段全部非命中会把探针算成真人（R491 首版）。
- 审「一次请求 → 结果缓存在页面实例」类 AI 面板（错题本 AI 分析 / 教练建议 / 周报点评）必跑一条**「成功后关闭 → 让输入数据变化（切 tab 回来 `onShow → load()`）→ 重开」**用例（R492）：tab 页 `switchTab` 不销毁实例，`if (this.aiHtml && retry !== true) return` 这类成功缓存会把结果冻结到整页 reload；判定看「重开 0 次新请求」+ 结果态 DOM 里有没有能带 `retry=true` 的按钮。给刷新入口时 catch 要分叉（已有结果 → toast 保留旧结果；无结果 → 失败态），否则 `v-else-if="aiErr"` 会盖住旧结果且重开也回不来。
- AI 面板 CDP 审计不造 LLM 流量的做法（R492 `~/r492_ai.py`）：`ctx.route('**/api/**')` 里对 `POST /api/mistakes/analysis` 按模式 `fulfill`（`ok` 短 Markdown / `fail` 502 `{detail}` / `empty` `{"analysis":"   "}` / `nopending` 后端确定性文案 / `long` 14 段 / `hang` 不应答），`GET /api/mistakes?` 回本地占位错题（`id 9000xx`、`question_id 0`），其它非 GET abort；所有 analysis 调用连同模式与相对时刻记进 `calls[]`，每段用 `calls[n:]` 切片断言次数。改后 Caddy 窗口 `non-probe non-bot 0` + 探针 POST 仅 track 可证生产后端 0 次 analysis。
- `mistakes` 表**没有 `probe` 列**（探针归因只在 `answer_log`/`growth_events`/`exam_attempts`），写 `mistakes where probe=0` 直接 `no such column`；按 uid 分探针要 JOIN `answer_log` 或按 uid 前缀（`uprobe*`、`umr4*`、`test-r*`）排除。任何生产 SQL 先 `pragma table_info(<表>)`。
- `~/r4xx_post.sh` 类补量脚本是**远端 payload**（`ssh … bash -s < 脚本`），直接本机 `bash` 会对本机 docker 报 `no such object: deploy-kaogong-1`、`df` 读到本机盘（R492 误跑一次）——看到 `70G`/`load 0.1x` 这种与生产量级不符的数先怀疑跑错机器。
- Playwright 点 `.mask` 关闭弹层要指定 `position={x:20,y:120}` 之类在页头以下、sheet 以上的点，默认中心点会落到 `.uni-page-head`/sheet 上被 `intercepts pointer events` 卡 30 s（R492）；先 `elementFromPoint(20,120)` 核该点 className 是 `mask` 再点。
