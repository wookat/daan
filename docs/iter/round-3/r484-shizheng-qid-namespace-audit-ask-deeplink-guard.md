# R484：R483 发版后 (c) 补量 + 全部「按 question_id JOIN/聚合」路径时政撞号盘点 → 命中 H5 AI 详解深链 / 回看 AI 详解两处漏 `_sz` 守卫 → 最小修上线（生产 `df9d6be` → `7acf57b`）

时间：2026-09-07 08:3x–09:10Z。方法：生产 Caddy `kaogong-origin` 日志 + 卷内 `data.db` 只读（`mode=ro`）+ 源码 grep + 生产 CDP 行为一手（`X-Kg-Probe: 1`）。除 §4.2 明示的探针写入外 0 库写入。

## 0. R483 发版后 (c) 补量 + 到期项（08:5xZ；R483 容器 08:29:42Z 起）

- 容器 healthy、restarts 0、rev `df9d6be`；app-log Traceback / `database is locked` / `disk is full` 0（唯一 `[slow-req] 13.6s POST /api/admin/refresh_stats` 是 R483 我手动触发的统计刷新）。
- Caddy 自容器起 35 请求：2xx 35、`/assets/*` 404 0、5xx 0、`/api/monitor/report` 0、小程序 UA/Referer 0；出口 `140.232.64.4`（本机）34 + `52.167.144.180`（bingbot 段，1 条 GET）；**非探针 `mistakes/analysis` 0、`explain/stream` 0、`umst3tuisd7lgzaka` 0 请求**。
- DB：`answer_log module='时政' AND question_id IS NOT NULL` **全表 0 / R483 后 0**；`mistakes` 同 **0 / 0**（R483 服务端兜底 + 回填生效）。R483 后新增 answer_log 2 行（`ziliao` probe=1 qid 48、`时政` probe=1 qid NULL = R483 写入侧探针）、mistakes 0。
- 到期项无增量：`error_reason` 非空 7 / ≥09-11 **0**；answer_log probe=0 33 行 / 1 uid；growth_events probe=0 20 / 4；push_subs 0；weekly_reports 2；exam_attempts probe=0 1/64；WAL 4,124,152 B 同字节。
- 时间戳口径勘误（自纠）：`answer_log.created_at` / `mistakes.created_at` 是 Unix epoch **real**（`typeof` = real），首版补量脚本把 R483 起点写成了 `1757233782`（2025 年）→ 「R483 后」窗口把全表都算进去；用 `docker inspect StartedAt` 换算 `1788769782`（08:29:42Z）后重跑，本节数字为修正后结果。

## 1. 「按 question_id JOIN/聚合」路径全盘点（生产只读，`/home/ubuntu/r484_probe2.py`）

撞号规模：`shizheng_questions` 140 行 id ≤ `max(questions.id)`，其中与 `questions.id` 实际撞号 **96**（`questions.id <= max sz id` 共 4051 行）。任何拿到「裸数字 qid」的路径都无法靳凭数值区分源表，必须靠 module / `_sz` 上下文。

| 表 / 路径 | 行数 | 核法 | 结果 |
|---|---|---|---|
| `mistakes` | 258 非空 qid | 行文本前 20 字 vs `questions.question` | 2 处不一致均为 `changshi` 标点归一化差异（`，`/`,`），非时政 id；R483 后 `时政` 行全 NULL |
| `mistakes` 普通模块 qid ∈ 时政 id 集 | 1 / 258 | 文本交叉 | `test-r375-oimf` `ziliao` qid 41，文本与 `questions.41` 一致 = 真行测题，仅数字撞号，非污染 |
| `question_favs` / `question_notes` / `question_comments` / `question_reports` / `shared_questions` | 8 / 5 / 17 / 6 / 16 | qid ∩ 时政 id 集 | 全 **0** 重叠（写入口都在行测题页；`question_reports` 6 行 qid 全在 `questions`） |
| `ask_cur` / `ask_sessions` | 5 / 1 | items 内 `qid` | 唯一非 0 qid = `umsacie728f4ghcv8` 234494（R378/R421 SEO 深链、`questions` 存在、非时政）；其余 qid 0 |
| `pk_matches` | 27 | 解析 qids 列表 ∩ 时政 id 集 | 27/27 `sz-range 0`；module 分布 `None 12 / changshi 12 / shuliang 2 / yanyu 1`（无 `时政`） |
| `practice_progress` | 5 | (module, psource) | `(NULL,direct) 1 / (NULL,redo) 2 / (panduan,link) 1 / (ziliao,seo) 1`；`qids` 全行测题，时政不走此表（`practice.vue` 时政场次不存 pendingSession/progress） |
| `explain_cache` | 82 | module 分布 + qid | `changshi 9 / panduan 5 / shuliang 41 / yanyu 21 / ziliao 6`，非空 qid 0，无 `时政` |
| `review_log` | 37 | 按 `mistake_id` 外键（无 qid） | 不按 qid 聚合；R483 后 mistakes 时政行 qid 已 NULL，SRS 推进路径（`save_answer_log_detail` → `_find_open_mistake`）被 `foreign_module_qid` 拦在前面 |
| `interview_sessions` | 13 | `question_id` vs `questions` | 1 行「孤儿」（id 3，qid 21，组织计划「邻里节」）—— **不是污染**：面试题库是静态 `backend/app/data/interview_questions.json`（80 题 id 1–80，id 21 正是该题），与 `questions` 无关；`interview.py` 只在本 bank 内 `question_by_id()`，不 JOIN `questions` |
| `shenlun_answers` | 6 | qid vs `shenlun_questions` | 6/6 存在，独立命名空间、不 JOIN `questions` |

结论：**服务端持久化侧除 R483 已修的两处外，再无时政 id 落进行测题聚合的生产证据**。剩余风险在端侧「拿裸 qid 往别的流程传」。

## 2. 命中：H5 `practice.vue` 两处把时政 `q.id` 当行测题号往 AI 问答流程传（源码 + 生产一手）

R483 补的是 answer_log 条目；同文件还有两处读 `this.cur.id` 无 `_sz` 守卫：

```js
// curAskSeen(): 「回看 AI 详解 ›」是否显示 —— 按 id 在本地 askSessions 里找历史讲解
return findAskSid(uni.getStorageSync('askSessions'), uni.getStorageSync('askCurSession'), this.cur && this.cur.id);
// deepExplain(): 「用花生十三方法详解这道题 ›」→ 写 redoQid 跳问答页
const qid = askQid(q.id);
if (qid) uni.setStorageSync('redoQid', qid);
```

`askQid()`（`ask-link.js`）只校验正整数，不辨源表。下游（`ask.vue`）拿 `redoQid` → `pendingQid` → 提交 `POST /api/explain/stream` 带 `question_id` → 服务端 `_linked()` `db.questions_by_ids([question_id])` 按 **`questions`** 取题给 LLM 做「题库答案入提示」（R421）；rec 落 `qid` → 「查看原题」深链 `/pkgA/search/search?qid=N`、「存入错题本」`question_id: askQid(r.qid)`。时政题 id 118 撞 `questions.118`（`panduan`「某部门要从甲、乙、丙、丁四人中选派两人出差…」）→ 讲解提示被喂另一道题的题干/答案、「查看原题」打开别的题、存错题本落成行测题号。

生产落库为 0（§1 `ask_cur` 仅 1 条非 0 qid 且是行测），原因是时政题「AI 详解」入口至今无人点过——路径可达、结果错误、只是尚未触发；按 R483 同法算「可复现的源边界缺陷」，最小修 2 行。

### 修法（`7acf57b`，仅 `practice.vue` 2 行 + 源锁 2 条）

```js
this.cur && !this.cur._sz && this.cur.id      // curAskSeen：时政不按 id 匹配历史讲解（题干仍会带过去，只是不显示「回看」）
const qid = q._sz ? 0 : askQid(q.id);         // deepExplain：时政不写 redoQid → ask 页走纯文本识题路径（R422），不带 question_id
```

行测题路径不变（qid 照传）。W7 小程序端对应位置登记给 W7 合并，不在 #619 动 W7 文件。门：vitest **723/723**（+2，`tests/practice-r483-shizheng-qid.test.js` 新增 `describe('practice.vue 时政题号不进 AI 详解深链')`）、eslint rc=0、`build:h5` 绿。

## 3. 部署（生产 `df9d6be` → `7acf57b`）

- 发版前宿主 `df` 非 root 可用 3.5 G、load 1.5–3.3（无兄弟构建，未让行）；`DEPLOY_WAIT_SECS=1500 ./deploy/deploy_h5.sh --skip-build` 一次 `compose_rc=0`，谱系闸 OK；新容器 `2026-09-07T09:03:23Z` 起 healthy、restarts 0；`/api/health` `{"ok":true,"rev":"7acf57b"}`；bundle `index-DYSsqDo0.js` 线上=本机；7/7 回归 200；perf `/` 0.99 / a11y 1.00 / LCP 860 ms，`/tiku/` 1.00 / 1.00 / 942 ms。
- 路由分包 `pages-practice-practice.sbe-gR5r.js` 线上与本机构建 **逐字节一致**，编译后含 `const s=e._sz?0:me(e.id)`（= `q._sz ? 0 : askQid(q.id)`）。

## 4. 改后生产一手

### 4.1 端侧行为（CDP 375×667、`X-Kg-Probe: 1`、`/home/ubuntu/r484_verify.py`）

拦截 `Storage.prototype.setItem` 记录 `redo*` 写入（ask 页 onShow 会立刻消费并删除 `redoQid`，事后读 storage 读不到——首版脚本即因此读到 null，改为写时记录）：

| 场次 | `cur` | 点「用花生十三方法详解这道题 ›」后 `setItem` 记录 |
|---|---|---|
| 时政（`practiceLaunch {kind:'shizheng'}`） | `id 118, _sz true, module 时政`「关于嫦娥七号任务突破的关键技术…」 | `redoQuestion`（题干+选项）、`redoAnswer A`；**无 `redoQid`** |
| 行测 `changshi` | `id 376403, _sz false` | `redoQuestion`、**`redoQid {"type":"number","data":376403}`**、`redoAnswer A` |

`shizheng_questions.118` 与 `questions.118`（`panduan`）在生产库里确为撞号对；两场次点击后 hash 均到 `#/pages/ask/ask`，脚本未提交讲解（0 `explain/stream`）。

### 4.2 (c) 补量（新容器 09:03:23Z 起，09:09Z 读）

- Caddy 100 请求：2xx 98、3xx 2、`/assets/*` 404 0、5xx 0、monitor 0；出口全部 `140.232.64.4`（本机）。POST 全带 `X-Kg-Probe`：`track 1 / answer_log 4 / mistakes 3 / practice/progress 1`（= 4.1 两场次各选一次选项 + 部署回归）。
- DB 新增：answer_log 4 行 probe=1 `[('时政',1,NULL),('changshi',1,297276),('时政',1,NULL),('changshi',1,376403)]`；mistakes 3 行 `[('时政',NULL),('时政',NULL),('changshi',376403)]` → **时政行 qid 全 NULL**（服务端兜底 + H5 守卫双重）；`时政 AND question_id IS NOT NULL` 全表仍 **0 / 0**；WAL 同字节；app-log 错误 0。

## 5. 如实说明

- §1 为「生产库当前行 + 源码路径」盘点，不是穷举所有历史版本的写入口；`review_log` 37 行只核了外键形态未逐行回溯其 mistake 的原 qid（R483 回填前时政 mistakes 3 行若曾被复习会留 review_log，但按 `mistake_id` 关联不受撞号影响）。
- §2 是「可达 + 结果错误」的源边界缺陷，**生产 0 条时政讲解落库**，修的是未触发路径；不改 `askQid()` 语义（W7 / search 深链共用）。
- §4.1 为 Chrome CDP 仿真非真机；`setItem` 拦截法只证明写入与否，未在 ask 页实际发 `explain/stream`（避免制造 LLM 流量）；探针写入 answer_log +4 / mistakes +3（probe=1）。
- W7 小程序端同形态未修（服务端 `foreign_module_qid` 只覆盖 answer_log/mistakes，不覆盖 `explain/stream` 的 `question_id`——小程序若把时政 id 传进去服务端仍按 `questions` 取题；登记给 W7）。
- 仍无可确认外部真人作答者；无 testing agent 录屏（未另行授权）。

脚本：`/home/ubuntu/r484_host1.sh`（补量首版，时间戳错）/ `r484_host2.sh`（修正）/ `r484_probe2.py`（§1 盘点）/ `r484_verify.py`（§4.1）/ `r484_host3.sh`（§4.2）。
