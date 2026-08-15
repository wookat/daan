---
name: testing-kaogong-assistant
description: How to run and test the 考公错题助手 (FastAPI + uni-app H5 frontend + 花生十三 knowledge base)
---

# Testing 考公错题助手

## R28 审查轮新经验（SW v3 / 学习计划 / OMR 闭环 / 组队周报）
- SW v3（kg-shell-v3）后 asset 不经 SW：验证用 CDP `Network.responseReceived` 的 `fromServiceWorker` + `performance.getEntriesByType('resource')` 的 transferSize（二次访问==0 即 memory/disk cache）。断网 F5 仍进壳（导航兜底），但 `/static/tab/*.png` 图标离线缺失属预期降级。
- **懒加载 chunk 挂起与 SW 无关**：SW v3 不拦 asset 后周报页仍复现「spinner→连接服务器超时」，点击重试后 chunk 160ms 秒开——疑 HTTP/2 连接或反代层，别再拿 SW update 当修复手段。
- **POST 类接口客户端 60s+ 但服务端 slow-req 只记 5-7s**（export/pdf、scan_sheet、plan、profile）：差额在反代/隧道上游，audit 时要同时采集客户端 duration 和容器日志对照。
- 学习计划阶段验证：改画像考试日期即可切换 专项期(>30天)/真题期(>14)/冲刺期(≤14)；冲刺期 60min → 13专项+8真题=21 题；复习配额受「今日之前到期数」约束，UI 显示 min 值属正常。
- OMR 闭环可全真测：导出含答题卡 PDF → pymupdf 渲染 → 按 backend/app/omr.py 几何（bubble_rect）PIL 涂黑 → UI「扫描答题卡→拍照」走系统文件选择器选图 → 识别卷码/精确判分/自动记入。生产表是 `paper_exports`（无 `papers` 表），correct 答案查 `questions` 表。
- 组队打卡：pkgA/team/team 创建得 6 位邀请码，第二 uid 输码加入即 2 名队友；做题后队页「今日 N 题」实时联动。**队长昵称可能显示 null**（创建时无 pkNickname），周战报剪贴板可用 `navigator.clipboard.readText()` 读（先在页面点 Allow 授权弹窗）。
- `practice_results` 表无 uid 列（全局聚合），测试产生的行无法归属、不清理。清理团队要删 `teams` + `team_members` 两表。

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
