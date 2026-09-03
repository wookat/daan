---
name: testing-kaogong-assistant
description: How to run and test the 考公错题助手 (FastAPI + uni-app H5 frontend + 花生十三 knowledge base)
---

# Testing 考公错题助手

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
