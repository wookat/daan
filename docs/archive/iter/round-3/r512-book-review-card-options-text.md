# R512（2026-09-08）错题本复习作答页 375/1440 只读整页审 → 命中「联查题库的错题在复习卡上只画 A–D 裸字母，选项文本不渲染」→ 最小修上线

> 生产 `0c532532` → `8a4bc53e`。前端 3 文件（`pages/book/book.vue` + 新 `src/review-opts.js` + 源锁 `tests/book-r512-review-options-text.test.js`）；后端未动。
> 全部生产取证为 GET + `X-Kg-Probe: 1`，非 GET `/api/**` 在网络层全部 abort；用只读 uid `umst3tuisd7lgzaka`（疑内部设备、有 30 题到期）。**如实**：为量「答后态/下一题态」harness 实际点击了一次选项 A 与「下一题」，对应 `POST /api/review/1953`、`POST /api/review/cur`、`POST /api/track` 均被 abort（见 §5 0 写入核）。

## 1. (c) 补量 + 到期项（`~/r512_pre.sh` → `~/r512_pre.out`；发版后 `~/r512_post.sh` → `~/r512_post.out`）

| 项 | 结果 |
|---|---|
| R511 容器（`21:42:01Z` 起，179 请求） | 5xx 0 / assets 404 0 / monitor 0 / mpUA 0 / 非探针非 bot 0 / 非探针 POST 0 / 401·403 0 / Traceback 0；WAL `4,173,592` 同字节 |
| R512 容器（`22:02:50Z` 起，45 请求，发版后） | 同上全 0；WAL 同字节；healthy 0 重启 |
| probe=0 | `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、harness uid 落库 0 |
| 复习真人证据 | 全史非探针 `POST /api/review/<id>` **1 条**（09-06 08:58Z `/api/review/1952` 200，`39.158.40.85`）；`review_log` 自 09-07 起 0 行；probe=0 `review_entry_click` 12 / `review_done_celebrate` 3 / `review_similar_auto` 1（最后 09-06） |
| 公告「详情」/ `mistakes_total` 非探针触达 | 无样本（两个容器非探针 `/api/*` 请求 0） |
| profile | **9 行**，已过/今天/未来 1/0/8——R511 发版后核为 11 行（`~/r511_post.out`），本轮少 2；`user_profile` 无 `probe` 列，R511 判 W9 探针写入 2 行正是 +2 → **推断**为兄弟 W9 会话事后清理了自己的探针行（本轮容器日志/Caddy 无非探针 profile 写，我未动库），未向 W9 求证 |
| 到期项 | `www.zalize.com` 证书 10-04；`WX_MINIAPP_SECRET` 未配；R385 第二冷样本未达标——均未变 |

→ 无新的外部真人证据。

## 2. 命中面（DB 一手）

- 到期/未掌握错题全库 **294**，其中联查题库且题库有结构化 `options` 的 **266（90%）**；按 uid：`umsacie` 31/31、`umst3` 30/21、`u26` 16/16、`umtg4` 15/15、`umtpn` 15/12 …——即绝大多数到期复习题在复习卡上都走「题库联查」分支。
- `backend/app/db.py::_hydrate_mistake`：联查命中时 `question_text` 被替换为题库**规范题干**（不含 A–D 行），选项放进结构化 `options`，`explanation` 回落 `hs_explanation`。手录/时政/加练题无 `options`，`question_text` 仍是原始「题干+选项」整段。

## 3. 改前生产整页审（`~/r512/review_audit.py 375|1440` → `~/r512/review_{375,1440}.out` + 截图）

| 视口 | 项 | 读数 |
|---|---|---|
| 375 | 错题本头 | 「30 题 今日待复习 / 16 分钟 预计 / 32 题 累计错题」+ CTA「开始复习」309×44；`docSW==cw` 375 |
| 375 | 复习卡 Q1（资料分析，`mistake 1953`） | 「复习 1/20」+「退出复习」60×32；题干 309×674（641 字、15px，**无 A–D 行**）；**选项 4 个只画裸字母 A/B/C/D，各 71.3×46 横排** |
| 375 | 答后态（点 A，POST abort） | A `bad` / B `ok` / C、D `dim`；判词「又错了，看讲解（稍后本轮会再出现）（下次复习：0 天后）」309×43；「下一题」309×44；解析卡 + 「还不稳？练 3 道同类题巩固 ›」「看不懂？AI 详解本题 ›」各 309×36；进度变「1/23」（错题重排 + 自动加练 2 道同类题，与状态机一致） |
| 375 | Q2（判断-定义，70 字） | 题干 309×93；仍裸字母 |
| 1440 | 同 Q1/答后/Q2 | 卡 760 宽、题干 726×279、选项 4×裸字母；`docSW==cw` 1425 |
| 两视口 | 页面错误 / 横向溢出 | `pageerror []`；`docSW==cw` |

**判定**：题干无选项文本 + 选项只有字母 → 真人到期复习中 ~90% 的题在复习卡上**不可据选项作答**（只能凭记忆或先「看讲解」）。这是「练习 → 错题 → 复习」主循环里复习一步的功能性缺口，命中即修，不是样式打磨。

## 4. 修（`8a4bc53e`）

- 新 `frontend-uni/src/review-opts.js`（纯函数、fail-closed）：`reviewOptions(cur)` 只接受 `options` 为对象、键为单个大写字母、值为非空字符串、**≥2 项**时返回 `[{k,t}]` 按字母排序；否则回退 `A–D` 裸字母（手录/时政/加练题不臆造选项）。`reviewOptionsFull(opts)` = 任一 `t` 非空。
- `pages/book/book.vue`：作答卡 `v-for="o in curOpts"`，`.opts.full` 竖排、`.opt.full` 左对齐 `<text class="opt-k">` + `<text class="opt-t">`（`word-break`、`--lh-body`），`aria-label="A. 文本"`，仍调 `pick(o.k)`，单选/多选/自评状态机与 `optClass()` 不变；「问 AI」/列表入口 `askPrefill(question_text, options)`（此前传 `null`，模型拿不到选项）。
- 源锁 `tests/book-r512-review-options-text.test.js` 12 例：排序/空对象/null/数组/小写键/非字符串值/少于 2 项回退、加练题裸字母、模板用 `curOpts`/`.opt-t`/`pick(o.k)`/整行样式、AI 预填带 options、不再有 `askPrefill(..., null)`。
- 门：vitest 全绿（+12）/ eslint / lint:tokens / lint-pages 0 error / `build:h5` 绿；`git diff --check` 空；后端未动。

## 5. 发版 + 改后复采

- 预检：宿主 mem_avail 398 MB / 5.9 G / load 0.41 / 兄弟构建 0。`./deploy/deploy_h5.sh --skip-build` rc=0（谱系闸 OK：线上 `0c532532` 是 HEAD 祖先）；容器 `22:02:50Z rev=8a4bc53e` healthy 0 重启；7/7 200；6b `/` perf 0.93 / a11y 1.00 / LCP 2800 / CLS 0.06、`/tiku/` 1.00（`~/r512_deploy.log`）。
- 改后生产（`~/r512/post/prod_{375,1440}.out` + 截图）：

| 视口 | Q1 选项（4 项竖排，`full`） | 答后态 | Q2 长选项 |
|---|---|---|---|
| 375 | 「A 煤炭开采和洗选业」… 各 **309×44**，字母 + 文本 14px，`aria-label` 带文本 | A `bad` / B `ok` / C、D `dim`，判词/下一题/同类题/AI 入口同改前 | 4 项各 **309×61.4**（自动两行） |
| 1440 | 各 **726×44** | 同上 | — |
| 两视口 | `docSW==cw`（375 / 1425）、`pageerror []`、非 GET abort 列表 = `POST track ×2 / review/1953 / review/cur` | | |

- **0 写入核**（`~/r512_post.out` 尾）：`mistake 1953` `review_count 0 / next_review NULL / mastered 0` 未变；`umst3` 自 22:00Z 起 `answer_log` / `growth_events` / `review_log` 新增 0；`review_log` 最后一条仍 09-06。
- 局部→整页：本地 dist 代理复采（`~/r512/local_{375,1440}.out`）与改后生产逐值相同（309/726 宽、44 / 61.4 高）。

## 6. 登记 / 不做

- 复习页「错因自评」chip 行横向可滚且末项被裁（375），是既有形态，未量命中率不动。
- 多选题（`curMulti`）复习卡本轮 uid 无到期样本，只过源锁（`pick(o.k)` 与旧 `pick(o)` 同参），未在生产量 375 几何。
- 小程序端复习卡是否同形态（W7/main `miniapp-native`）未核，登记给 W7。
- 复习真人证据仍只有 09-06 那 1 条 POST；本轮 harness 的点击/POST 均被 abort，**不是**外部真人复习验证。
- 如实：全部读数为本机 CDP 非真机；无 testing agent 录屏（未另行授权）；`umst3` 疑内部设备。

## 7. 文件

- 改动：`frontend-uni/src/review-opts.js`、`frontend-uni/src/pages/book/book.vue`、`frontend-uni/tests/book-r512-review-options-text.test.js`。
- 取证：`~/r512_pre.sh`/`~/r512_pre.out`、`~/r512_post.sh`/`~/r512_post.out`、`~/r512_deploy.log`、`~/r512/review_audit.py`、`~/r512/review_{375,1440}.out`（改前生产）、`~/r512/local_{375,1440}.out`（本地 dist）、`~/r512/post/prod_{375,1440}.out`（改后生产）、`~/r512/**/review_q1{,_answered}_{375,1440}.png`、`~/r512/**/review_q2_{375,1440}.png`。
