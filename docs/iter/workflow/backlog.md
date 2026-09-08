# 迭代工作流台账（workflow backlog）

> 每轮（W*）结束时：勾掉本轮已完成工作项，追加本轮 deferred；下轮开工先读本文件与对应 w*.md，不重复立项。

## 已完成

- [x] R348-B1（W1，P0，backend）账号 uid 归属守卫补洞（Content-Type 大小写 + multipart scan_sheet）、写接口畸形数字 400、连签口径统一 —— 已合入 `devin/wf-w1-integration`，本地全绿 + uvicorn 实测；生产回归待部署后做（见 w1.md §5）
- [x] R348-C1（W1，P0，content）下线 SKIP/数据矛盾题与伪中文 yanyu AI 批次、剥离 hs 管线括注，规则入 quality.py 与 hs 导入口 —— 代码与脚本已合入；临时库 dry-run/apply/复扫一致；生产 `--apply` 已按 C1b 收窄词表执行（下线 3736 / 剥括注 2438，备份 `/data/data.db.bak-r348`，复扫全 0，详见 w1.md §5）
- [x] R348-M1（W1，P1，miniapp）海报操作区 `.bar`→`.actions`、账号 uid 403 清登录态回退匿名、刷题页渲染题图可预览、分享页模块名中文 —— 已合入；typecheck + lint（`ESLINT_USE_FLAT_CONFIG=false`）全绿；真机/开发者工具走查未做（无 Linux 版）
- [x] W2-A（W2，P1，backend）`/api/*` ValueError/TypeError → 统一 400、`api_save_mistake` question_id 整型化、`idx_mist_uid` 索引、SEO 页脚「10万+ 行测题 · 1.5万+ 历年真题」、`normalize_cjk_spaces`/`HS_META_RE` + `scripts/w2_content_cleanup.py`、生产广场 3 条测试评论已软删 —— 已合入 `devin/wf-w2-integration`，本地 ruff/pytest 266/pyright 全绿 + uvicorn 实测；**已上线（PR #564 → rev b31708d）并生产回归全过；清洗脚本生产 apply 已执行（改写 7700 + hs 2398 / rescored 10088，备份 /data/data.db.bak-w2）**，apply 预演暴露 UNIQUE 碰撞缺陷已修（见 w2.md §5.0）
- [x] W2-B（W2，P1，frontend-h5）index.html/manifest/og-card/share-q/pk-result 口径残留清零、`weak-spots.js` 薄弱考点同名合并、`exp-dup.js` 解析复读隐藏、contest 零人数文案 —— 已合入；lint/vitest 469/build:h5 全绿，本地 build 产物 Chrome 走查通过；生产 view-source/SW 核对待部署后做
- [x] W2-C（W2，P1，miniapp）连签 hero/stats 改服务端优先、`utils/offline.ts` answer_log/mistakes 离线队列、exam 错误态+重试、`page` 高度约束、首页题数 `/api/question_counts` 动态化、README Skyline→webview —— 已合入；typecheck/lint/vitest 7 全绿；**微信开发者工具走查未做**（断网→恢复落库、连签三处一致、14 页滚到底 + login 回归、page 高度对 navbar/底栏影响）
- [x] W3-A（W3，P1，backend）`/api/questions/export` 复用 import 令牌 401、`growth_stats` 周键 `+8 hours`、`_client_ts` 接受 items[].t（秒/毫秒、[now−30d, now+5min] 外回退 now）、`/api/rate` `rl(60/600s)` —— 已合入 `devin/wf-w3-integration`；ruff/pyright 0/pytest 342（+24）全绿，本地 uvicorn 实测 export 401·t 落昨日·CST 周键 2026-35·第 61 次 429；**生产回归待部署**（当前 rev e58779f export 仍 200）
- [x] W3-B（W3，P1，miniapp+H5）小程序 stats 页 `fetchGrowth` 服务端优先/pstats 降级、离线队列与在线上报 items 带 `t`、types GrowthResp/`AnswerLogItem.t`/`Question.image_credit`、lint 脚本内置 `ESLINT_USE_FLAT_CONFIG=false`；H5 `buildPaceRows` 读 `answered`（整模块未作答→「未作答」、部分作答按已答折算）、`goTask` real_mode 进卷库 —— 已合入；typecheck/lint 0、lint/vitest 523/build:h5 全绿；本地 build 产物报告页 Chrome 实测 skip「未作答」灰标 + 折算注；实施方生产 API 级回归已做并清理（test-w3-b-pace leftover 0）；**小程序未真机、goTask 未端到端点击、H5 报告页生产 UI 待部署**
- [x] W3-C（W3，P2，content）`quality.sanitize_explanation`（抓取源统计前缀/「解析」标签族 + 广告尾句 + CJK 空格归一，数字/字母空格保留）+ `scripts/w3_content_cleanup.py`（dry-run 默认、`--apply` 备份 `.bak-w3`、rescore、不下线）—— 已合入；test_quality_penalties 11（+3）；本地临时库 dry-run 2500 → apply → 复扫 0，非 explanation 列不变；生产只读快照 dry-run rewrite 10,068（prefix 5383 / ad 192 / space 10045）；生产 `--apply` 已于 2026-09-04 17:11Z 执行（容器内 dry-run 8,282 人审后，含 #594 规则），09-05 复扫 0 / 台账 7,997 题核对一致 / 空 0，记录见 w3.md §4.5
- [x] W9-A（W9，P1，backend）`/api/push/subscribe|unsubscribe` 改 `def(body: dict)`（非 JSON Content-Type 422）+ subscribe 显式 `owns_uid` 403、`guard_account_uid`/`scan_sheet` 的 owns_uid 与 OpenCV 走 `run_in_threadpool`、`init_db` 建 `idx_q_reinforce` 前补 `_ensure_question_stat_cols`、`quality.answer_letter_conflict` 扣 30（只降分）—— 已合入 `devin/wf-w9-integration`；ruff/pyright 0/pytest 525（+9）全绿，本地新库 uvicorn 实测 form 422 且 0 行 / JSON 无 token 403 / 匿名 200→unsubscribe 200 / scan_sheet 非法图 422 / 新库含 correct_ratio 且 adaptive 200；**生产回归待部署**（见 w9.md §5.1）
- [x] W9-B（W9，P1，frontend-h5）桌面 208px 让位仅 `uni-page[type="tabBar"]`、tabBar `fontSize 12px`、`exam-weak.js`/`report.vue` 薄弱模块按 `answered`/`ansPct` 判定（answered=0 或 <3 不判、部分作答附「（按已答 a/n 题折算）」）、焦点环 `var(--brand)` —— 已合入；lint/vitest 843/build:h5 全绿；本地 dist CDP 375/1440 实测非 tab 页 paddingLeft 0、tab 页 208、label 12px 单行、整模块未答 attempt 无 CTA、对照组有 CTA（w9.md §4.4）；**生产 UI 待部署**
- [x] W9-C（W9，P2，miniapp）`kg-exam-report.ts` 薄弱判定与 H5 同口径（集成时兜底文案逐字对齐）、`report.ts` 映射 answered/ansPct、`practice_result` 带 `uid: anonUid()`、`profile.ts` 抽 `refresh()` 退出登录后重拉、删零引用 `utils/exam-progress.ts` —— 已合入；tsc/lint 0、源锁 vitest 9；本地 uvicorn 实测 practice_result 落 uid；**运行时未核**（Linux 无微信开发者工具）
- [x] W10-A（W10，P0，backend）`_ConnProxy.execute/executemany` 异常即 rollback + 绑定失败 → `ValueError("参数格式错误")`→400（一次畸形 JSON 写不再泄漏写锁 30 s 500）、`get_conn` 残留事务兜底、`deps.clamp_limit` + db.py 11 处 `min(max(limit,0),N)`（负 limit 不再全表）、`exam_attempts.question_ids` 题序快照（start 写 / submit·report 读，老 attempt 回退）、迷你模考排名池跨 `kind='mock'`、`_sharer_invite` 对分享者/已入队者返 null、卷库 takers<5 不透出 takers/avg_score —— 已合入 `devin/wf-w10-integration`；ruff/pyright 0/pytest 548（+13）全绿，本地新库 uvicorn 实测 11/11（畸形 module ×3 → 400 各 <10 ms、外部 BEGIN IMMEDIATE 立即成功、随后写 200、limit=-1 → 0 条、disable 题后报告不错位、两 uid mini 排名 total 2 且探针不计、team_invite 本人/队员 null、低样本卷 0/None）；**生产回归待部署**（见 w10.md §5.1）
- [x] W10-B（W10，P1，frontend-h5）「我的」页学习分组补「PK 对战」→ `/pkgA/pk/pk`、「学习小队」→ `/pkgA/team/team` 两条 wd-cell（与小程序 profile 对齐；副标只读 `/api/team/mine` 本地快照零新增请求）+ 源锁测试 3 例 —— 已合入；lint/vitest 870/build:h5 全绿；本地 dist（uvicorn 同源托管）CDP 375/1440 实测 7 条 cell h=52/x/图标/标题位完全一致、两入口导航目标正确、pageerror 0（w10.md §4.4）；**生产 UI 待部署**
- [x] W10-C（W10，P2，miniapp）`pkgGrow/mastery-map/mastery-map.wxml:18` `class="sec head"` → `class="sec" body-class="head"`（flex 从组件宿主移到 `kg-card__body`，环形进度与标题横排）—— 已合入；tsc/lint 0；静态核对 kg-card `externalClasses ['body-class']` 契约成立；**运行时未核**（Linux 无微信开发者工具）
- [x] W11-A（W11，P1，backend）`auth.py` merge_anon 归并覆盖通用化：删 `_UID_TABLES(6)`/`_UID_PK_TABLES(11)` 与 13 行 `_ensure_*` 前置，改 `_uid_columns(conn)` schema 自省（`sqlite_master` + `PRAGMA table_info/index_list`，列名 `uid`/`*_uid`，排除 merged_anon/users/auth_tokens/zalize_bindings）+ `merge_uid_rows`（PK/唯一索引列 `UPDATE OR IGNORE`+DELETE 目标优先，否则 UPDATE），merged 键 `table.col`；覆盖 38 列/22 keyed，新增 20 表 21 列（team_members/teams/shared_*/growth_events/comments/mock_event/weekly_reports/daily_set/practice_progress/ask_*/review_cur/interview/pk_matches/push_subs/practice_results/question_reports）+ 源锁/全表造数/目标优先/幂等测试 4 例 —— 已合入 `devin/wf-w11-integration`；ruff/pyright 0/pytest 561（+4）全绿，本地新库 uvicorn 实测匿名建队+续练+今日同题 → 注册 → merge → team/mine 见队、resume 恢复 3 题、匿名行 0、二次 merge 全 0、u99 400；**生产回归待部署**（见 w11.md §5.1）
- [x] W11-B（W11，P2，frontend-h5）`stats.vue` 五维能力 `axes()` 两分支带作答数 `n`，`weakAxes`/`hasRadar` 由 `a.pct > 0` 改 `a.n > 0`（0% 全错模块进「最薄弱」、全错新用户不再判「还没有能力数据」）+ 源锁/求值测试 6 例 —— 已合入；lint/vitest 895/build:h5 全绿；本地 dist（uvicorn 同源托管 + CDP 只 mock `/api/growth`）375/1440 实测 weak 态 rs-row=[数量 0%, 言语 80%] 非空态、empty 态 kg-empty，pageerror 0（w11.md §4.3）；**生产 UI 待部署**
- [x] W11-C（W11，P2，miniapp）`stats.ts` `StatAxis extends RadarAxis {n}`，growth `s.n` / pstats `s.done`，`weakAxes`/`hasRadar` 改 `a.n > 0`，wxml/wxss 零改动；源锁测试 4 例落 `frontend-uni/tests/miniapp-w11-weak-axes.test.js`（`miniapp-native/.gitignore:3` 忽略 `miniprogram/**/*.js`）—— 已合入；tsc/lint 0；**运行时未核**（Linux 无微信开发者工具，见真机清单）

## Deferred（W2 上线回归追加）

- [ ] [content P2] 76 对「同题异格式」在线重复（去汉字间空格后题干同文，台账 `/data/w2_cleanup_ids.json` 的 `collisions`，如 1046534/241427、298750/320495）：42 对答案+选项一致可直接按重复簇规则下架晚入库者，20 对选项格式不同需人审，其余题干同文选项/答案需核；决定去留后对幸存题再跑一次清洗脚本。458 题的 twin 已下架，题干暂保留空格，本轮不动。
- [ ] [content P2] 存量约 7300 题题干/选项含汉字间空格（主要 id≥1046924 AI yanyu 批次）：**不得再用通用去空格规则一刀切**（2026-09-04 事故：逻辑填空选项分词/题干空位被毁，题干改写又被 `_seed_questions` 当新题重插 1928 条，已从 `/data/data.db.bak-w2` 全量回滚，见 w2.md §5.1）。前置条件：① 按 `question_type` 排除填空/选词题型并用选项“空格分隔的 2–4 字词”形态二次拦截；② 为 `_seed_questions` 换去重键（source+序号 或 归一后指纹）或同步改 `knowledge/questions_bank.jsonl`；③ 临时库 apply 后必须模拟一次启动 seed 核 questions 总数不变。

## Deferred（W1 追加）

- [x] [frontend-h5 打包·下轮直接消费·P2] 三处一行修：a) UTC 日键 → 统一 dayKey；b) 背题模式底部留白 `picked || beiMode`；c) 首页「11万+」口径 —— **已由 R356（PR #561，生产 rev 7a9bb2f）完成**；home.vue 之外的口径残留由 W2-B 清零。
- [ ] [content 后续·P1] yanyu b2026* 剩余 2882 条（命中 <3）及其他模块同批次在线题（changshi 10405 / shuliang 9450 / panduan 2506 / ziliao 860）质量未抽检；建议用既有 `/api/admin/batches/{bid}/sample` + sample_reviews 按批次 10 题抽审并 decide，或引入现成中文流畅度模型（perplexity 打分）替代正则作主判、正则只做兜底。
- [ ] [content 复核·P2] 17 条「数据矛盾/官方解析有误」题下线后，需人工核对是否为 hs 生成误判（可能题干含图表数据未 OCR），确认后可恢复并补图。C1b 已剔除 `数据矛盾`，实际下线仅 8 条 ziliao 真管线内话（#253397 #264583 #262250 #245921 #295348 #295351 #320802 #321451），待复核范围收窄为这 8 条。
- [ ] [backend 设计题·P2] quality_score 目前仅 admin 排序用（`db.py:1740-1749`），random_questions/daily_set 不参考；是否让低分（如 <40）题默认不进抽题池，需先统计各分段真实错误率再定阈值，勿拍脑袋。
- [ ] [未复现·待证据] 首访计划/刷题「60 秒等待」：生产 `/api/questions` 0.38s、`/api/home_bundle` 0.30s；handoff R14 记有「学习日历分包 Async component timed out 偶发 60s」，更可能是 H5 分包首载/SW 预缓存问题而非后端；需前端 performance 资源时序截图再立项。
- [ ] [新需求·竞品] 两套模考入口合并、原生导航字体统一、错误态文案统一属 P2/P3 体验项，本轮未复核证据，下轮由 UX 走查带截图立项。
- [ ] [新需求·内容] hs_explanation 中「官方解析误将…」类纠错信息有价值，可在 quality 治理后单独抽出为「题目勘误」提示而非直接下线（需产品决策）。
- [ ] [新需求·安全巡检] 把 guard_account_uid 三路径回归 curl（application/JSON、无 Content-Type、multipart scan_sheet，uid=u999999 无 token → 403 且不落库）写入 `.agents/skills/testing-kaogong-assistant` 走查清单，每轮上线后跑一次。
- [x] [工程·P3] miniapp-native `npm run lint` 被仓库根 `eslint.config.mjs`（R213）误切 flat config 报 `Invalid option '--ext'`；package.json 加 `ESLINT_USE_FLAT_CONFIG=false` 或迁移 flat config。—— **W3-B 已在 package.json lint 脚本内置该环境变量**（flat config 迁移未做）。
- [x] [工程·P3] miniapp `api/types.ts Question` 补 `image_credit?: string | null` 类型声明（M1 wxml 透传运行时可用但无类型）。—— **W3-B 已补**。

## Deferred（W2 追加）

- [ ] [backend 安全·P1·资源缺口] `auth.py SmsProvider.verify` 恒 True，注册任意手机号+密码即通（仅 IP 10/h 限流）。真实修复需老板提供阿里云/腾讯云 SMS 凭证（一次性申请资源，不阻塞）；到位后实现 send/verify + 验证码有效期/次数限制。若长期不接短信，改为产品决策：注册页去掉验证码字段、明示「手机号仅作登录名」。
- [ ] [content·P1·需人审] original 来源题（抽样每模块 10-20/50）hs 存在臆测错因/泛泛句风险，W2 未逐题验证；按 quality_score 低分 + hs_down>0 抽 200 题人工/单次 LLM 复审，不重复触发生成管线。
- [ ] [content·P2·设计题] original ziliao/shuliang「四地快递业务量/粮食产量…」模板家族（同模板换地名与数字）在同组练习中相邻出现；quality.py 加题干骨架哈希（去数字/地名）与家族标记，抽题同家族限 1 题/组；与上方「quality_score 抽题阈值」合并论证（样本/标签/对比证据先出）。
- [ ] [content·P3·不建议] hs 80%（199/250）以「确认答案为X。」收尾、11% 含「秒杀」——花生体系风格模板非缺陷；去模板化属整体 hs 重写（LLM 成本），不立项。
- [ ] [backend·P2] `mock_event.ensure_weekly_event` check-then-insert 无唯一约束，并发首访可能重复建同窗口场次；`UNIQUE(series, open_at)` 迁移 + INSERT OR IGNORE。生产目前仅第 3 期一场未重复。
- [ ] [backend·P2] `_pick_paper_id` 无合格真题卷时 `create_mock_paper` 落库新卷（W2 本地临时库首访 `/api/mock/events` 即生成 1 条 kind='mock' 卷，复现落库行为）；先查生产 `exam_papers kind='mock'` 计数再定是否收口。
- [ ] [backend·P3·架构债] db.py ~4.8k 行/215 函数、域模块直持 SQL；不做大重构，按域逐轮抽离（先 mistakes/answer_log 域），须有测试护栏后进行。
- [ ] [frontend-h5·P2] `/api/questions` 不返回 tag3_name（仅 `/api/mistakes` 补齐）；若后续多个页面需要三级考点名，改为 qbank_api 统一附带 tag3_name（复用 taxonomy.topic_index），并去掉 W2-B `weak-spots.js` 的前端合并逻辑。
- [ ] [frontend-h5·P2·未验证] 首屏信息密度、深色态对比、真机 iOS/Android 字体与 emoji 渲染缺真机截图证据（Linux Chrome 字体差异不能作缺陷）；真机走查后再立项。
- [ ] [miniapp·P2] 首页 loadPlan/loadDueReview、stats 热力图降级仍静默（书本页已有 toast）；统一一个轻量「数据可能不是最新」提示条而非逐页 toast。
- [ ] [miniapp·P3] README/工程说明安装步骤需与 webview 现状同步复核（W2-C 只改渲染层描述与删除「基础库 3.x（Skyline 需要）」）；lint 环境变量工程债已由 W3-B 收口。
- [ ] [miniapp·待走查] W2-C 微信开发者工具验收清单（重开项目确保非旧 .js 产物）：断网完成 3 题→恢复→`/api/answer_log` 落库=3（test-w2-* uid，`/api/checkin/summary` 核对当日 n）；首页 hero/任务卡/统计页连签一致且等于 `/api/checkin/badges.streak`；模考 tab 断网错误态+重试；14 页滚到底、login 页无截断；首页题数与 `/api/question_counts` 一致；结束清理 test-w2-* 数据。
- [ ] [运营·P2·新需求] 模考大赛冷启动：不做假数据；contest 页展示历史场次真实累计参与人数替代单场零值（W2-B 已先以「本场首批报名开放中 · 全站同卷」文案兜底）。
- [ ] [监测·P2] 首访「60 秒等待」W2 未复现，继续保留观察项（见 W1 条目），不立项。
- [ ] [部署后回归·W2] W2-A：`POST /api/export/pdf ['abc']` → 400 JSON、`/tiku/` 页脚 10万+、清洗脚本生产 dry-run（预期 CJK 空格约 12807 / hs 元句约 2398）→ 核对 → `--apply`（备份 `/data/data.db.bak-w2`）→ 抽 20 题含 332719/246674/1274976 → `docker restart` 刷 lru_cache；W2-B：新 bundle ≠ `index-Bm2wz5mH.js` + SW 更新、view-source meta/og/JSON-LD/og-card.png、share-q 不存在 id 文案、test-w2-* 完成页无重名、contest 零人数文案。部署前 `git merge-base --is-ancestor` 逐项核对近期 merge 点（R355 教训）。

## Deferred（W3 追加）

- [ ] [部署后回归·W3] W3-A：`GET /api/questions/export?limit=1` 无头 → 401（当前生产 200，hs 管线若用 export 需配 `X-Import-Token`）、test-w3-* uid `POST /api/answer_log` items 带 `t`=昨日 → `/api/checkin/summary` days 落昨日、`/api/growth` weeks 键与北京时间一致、`/api/rate` 连发 61 次第 61 次 429、核心刷题/错题/模考/统计 200；W3-B：新 bundle ≠ `index-C7wGv3is.js` + SW 更新、某模块全空模考报告页「未作答」灰标；W3-C：已完成（apply 09-04 17:11Z，09-05 复扫 0、262611/235535 外显干净、容器已重建刷缓存，见 w3.md §4.5）。test-w3-mp / test-w3-cmp01 遗留造数已于 09-05 按 uid 精确清除（test-w3-% 余 0）。部署前 `git merge-base --is-ancestor e58779f <deploy_rev>` 核对。
- [ ] [backend·P2·一行补] 入库防再污染：`sanitize_explanation` 接到 `db.import_questions` / qbank import 入口（W3-A 已合入，同文件可补）。
- [ ] [backend·P3·待证据] async def 端点内同步 SQLite/CPU：~~push_api.py subscribe/unsubscribe~~、ai_api.py api_explain 的 `db.get_explain_cache`、~~exam_api.py scan_sheet~~、~~main.py guard_account_uid 的 owns_uid 查库~~、etag_conditional 对 SSR 全文 md5 —— **W9-A 已收口有 5s 上限网络阻塞（owns_uid）与 OpenCV 及 push 两端点**；其余毫秒级小查询未拿到与 R372 长尾的因果证据，待 slow-req 日志佐证再做。
- [ ] [backend·P3·成本中] `_ensure_*` 运行时懒迁移 22 函数 / 161 处调用（每请求 CREATE TABLE IF NOT EXISTS），R375 已引入 add_column_if_missing，建议统一收敛到 startup 一次性 migrate；收益未量化。
- [ ] [backend·P3·口径] `/api/questions?limit=0` 返回 1 条（生产实测）—— 疑 `max(1,…)` 兜底，属边界口径而非缺陷，需确认是否有前端依赖。
- [ ] [backend·P3·待量化] 错题写放大（同一题多次答错重复 upsert）与 `/api/mistakes` 合并口径 —— 本轮未拿到量化证据，需先在 answer_log/mistakes 抽样。
- [ ] [frontend-h5·P2·产品决策] 首页「每日目标 dailyGoal(20/50/100，本地+profile.daily_goal)」与「学习计划 planToday.tasks 目标」两套目标并存（home.vue:95-120 vs 166-178），需产品定口径后合一。
- [ ] [frontend-h5·P3·随手] `practice.vue:2228 exportPaper` 无引用死代码；home.vue dayKey 已复用 checkin.js。
- [ ] [frontend-h5·未验证] 收藏双数据源、main.js 动态 import 拆包、book.vue fabmenu 遮挡等 W3 前端发现本轮未逐条复核；`home.vue goTask` real_mode → 卷库跳转未端到端点击验证（本地临时库无 real_mode 阶段计划）。
- [ ] [miniapp·未验证] 真机渲染/键盘/安全区、stats 页服务端优先/pstats 降级、断网补传后 `t` 落作答当日（依赖 W3-A 部署）—— Linux 无开发者工具，需 macOS/Windows 会话补一次真机走查（W2-C 清单一并）。
- [ ] [content·P3·先统计] hs 讲解模板化句式（「确认答案为X」「用关键词定位法」高频重复）—— 人味问题但改法涉及 LLM 重写，受「不反复触发 AI」约束，先统计句式频次再决定。
- [ ] [content·P2·需人审] 「微信/关注」等词在常识题解析中出现（q320965/185847/239781/260004）需人工判断是题目正文还是广告残留，不能规则一刀切。
- [x] [content·P2·apply 前人审，已完成，公式缺失另走 R400 缺陷线] W3-C 已知边缘：抓取时丢失公式图片留下的「容量为 毫升」类空格会被并成「容量为毫升」（与 W2 题干规则同口径，ziliao 41 条/部分 shuliang 可能含）；「解析 」标签扩展规则超出工作项原文两条常量。
- [ ] [新需求提案·增长/留存·待下轮按数据排期] 5 题微组（碎片时间刷题）；邀请落地页预览（复用 team._sharer_invite）；Web Share API 替代复制链接；周报实时化；分享者与被分享者作答对比；学习地图游戏化；AI 先提示后解析模式；5 分钟微模考。
- [ ] [运维·外部卡点] 生产性能长尾根因归因（R372/R373 已缓解未归因）、竞赛/PK/组队活跃态在生产的真实数据观察（R374 起需 probe 口径过滤积累数日）、AI 实时回复体验。
- [ ] [流程] 每轮先核对 `/api/health` rev 与 main 的祖先关系，避免把「已上线未合入」或「已合入未上线」当缺陷（W3 集成时 e58779f 已是 HEAD 祖先，无漂移）。
- [ ] [环境·P3] main 在最新 fastapi 0.141 / starlette 1.6 下有 8 例既有测试 `database is locked`（test_int_params_400 / test_llms_txt / test_material_group×2 / test_mistakes_paper×4，均 conftest.seed_questions；W3-A 实施方两套 venv 对照确认为基线问题）；Dockerfile `pip install fastapi` 未钉版本，重建镜像时关注。fastapi 0.115.12 / starlette 0.46.2 下 342 全绿。**W9 集成（fastapi 0.141.1 / starlette 1.6.0，Python 3.12）pytest 525 全绿未复现 locked**，可能已被后续 conftest 改动消解，保留观察。

## Deferred（W9 追加）

- [ ] [部署后回归·W9] W9-A：form Content-Type 打 `/api/push/subscribe` uid=u999999 → 非 2xx；JSON 匿名 test-w9-* subscribe→200 后立即 unsubscribe 清理；`/api/scan_sheet` 非法图 → 422；`/api/questions?adaptive=1&uid=test-w9-x&module=yanyu` 200；容器内只读抽样核 `answer_letter_conflict` 命中率 ≈1‰（本地无生产库未 dry-run）。W9-B：1440 `#/pkgA/exam/list|report|settings/reminders` `uni-page-wrapper paddingLeft 0`、五 tab 页仍 208、375 tab label 12px 单行、test-w9-* 整模块未答 attempt 报告页无 CTA 后清理、Lighthouse a11y 不低于 R509。W9-C：macOS/Windows 微信开发者工具核 `practice_results` uid 非空 / 退出登录角标即时回匿名 / 报告页整模块未答无 CTA。部署前确认 R510/R511 分支已合 main 且 `git merge-base --is-ancestor 35be115c <deploy_rev>`（`main.py` 两侧改动 merge-tree 预演无冲突）。
- [ ] [miniapp·P2·API-first 先行] stats 页 onShow 扇出 9 个请求（heatmap/growth/slStats/mastery/examTrend/predict/load…）：先在后端提供聚合 `/api/stats_bundle?uid=`（复用 home_bundle 模式，只做拼装不改各子查询），H5 stats.vue 与小程序 stats.ts 再各自切换；本轮未量化真机耗时，不立项。
- [ ] [miniapp·P2·设计后做] utils/request.ts 缺 H5 api.js 的超时分级/幂等 GET 重试/apiSnap 快照/stale-uid 丢弃四项韧性；应作为一次请求层对齐（一个文件 + 调用点零改动），需先定小程序侧存储配额与快照键口径，避免与 offline.ts 队列双写。
- [ ] [miniapp·待真机·P2/P3] 源码级读数、Linux 无开发者工具未核：pkgExam/shenlun/shenlun.wxml 无 page-scroll 结构（其他主页面有）；pkgSocial/pk-result.wxss 中列固定 72px 可能裁切结果标签；kg-chip-row track 自带 page-x 内边距在嵌套容器内双重缩进；app.json 无 preloadRule（分包首开）；首页/统计降级静默（W2 已登记）。合并进 W2-C/W3 的 macOS/Windows 真机走查清单一次处理。
- [ ] [frontend-h5·P3] predict-card.vue mounted().load() 与 stats.vue onShow → $refs.predict.load() 首次进入重复请求 /api/predict 一次；一行去重（onShow 跳过首帧）但价值低。
- [ ] [frontend-h5·P3·产品/设计] pkgA/settings/reminders.vue 用 kg-two-col aside-first 把主控件（提醒开关/时间）放 aside：移动端顺序正确，≥1024 主控件落在 320px 右栏、主列只剩说明；是否改为 main 放控件需设计定稿，同类 9 处 aside-first 页面一起看。
- [ ] [frontend-h5·P3·待截图] favorites.vue `.ngrid`（≥1024 两列、row-gap 0）内 kg-card 依赖 `.kg-card + .kg-card` 兄弟边距排版，第二列首项可能多出 margin-top；生产需有笔记数据才能复现，list.vue 已用 `.plist .paper + .paper{margin-top:0}` 页面级覆盖——若复现，同法一行覆盖，不动 kg-card 组件。
- [ ] [frontend-h5/miniapp·P3] md.js 行内输出 hex 颜色 vs md.ts 输出 token class：渲染层口径不一致，深色态可能分叉；待深色截图证据后统一为 class。
- [ ] [frontend-h5·P3·待证据] kg-streak-badges 零状态 opacity/配色、practice 完成页薄弱考点逻辑、mastery-map/exam/list 桌面网格密度等 H5 视觉读数本轮未逐条复核（多为 R479–R495 已修范围），下轮带 375/1440 截图再议。
- [ ] [frontend-h5·P3·a11y 既有] `#/pkgA/exam/report` Lighthouse a11y 0.95 两项既有失败：配速 kg-tag「偏快」#6b7280/#f2f3f7 对比度 4.35:1；`.cta` aria-label 与可见文案不一致（label-content-name-mismatch）—— W9-B 实施方本地 dist 发现，非本轮引入。
- [ ] [backend·P3·量化后做] `_ensure_*` 懒迁移 22 函数/161 处调用与 async 端点内其余毫秒级同步 SQLite（ai_api get_explain_cache、etag md5）：W9-A 只收口有 5s 上限的网络阻塞与 OpenCV；其余按 W3 台账等 slow-req 日志佐证。
- [ ] [backend·P2·契约] `/api/profile` 仍接受已过考试日期（R505/R506 登记）；小程序 picker start 本地日期；`mistakes_total` 三处口径——已在 handoff 登记给 W7 簇，本轮不重复立项。
- [ ] [content·数据结论] 解析结论字母与 answer 冲突：生产随机 5 模块×150 题、1451 个解析段中命中 1（q283745），≈1‰；W9-A 只加扣分规则，是否批量下线/改答案需 admin 按 quality_score 低分抽审后决定，不做脚本 apply。
- [ ] [content·P3·维持不立项] hs 模板句式（「确认答案为X」80%）、original 题「同模板换地名」家族、机器味解析——W2/W3 台账已判：去模板化=LLM 重写成本，受「不反复触发 AI」约束；家族标记需先出骨架哈希统计。
- [ ] [content·P2·需人审·沿用台账] 76 对同题异格式重复、7300 题汉字间空格（禁一刀切）、yanyu b2026* 批次抽审、8 条 ziliao「数据矛盾」复核、「微信/关注」词人审——均在 backlog，不重复。
- [ ] [数据结论·W9] 生产探针打标自 2026-09-03 起，此前流量不可分类；R505–R509 连续 (c) 核对显示 probe=0 的 answer_log/growth/push_subs/mistakes_total 触达为 0 或个位数，user_profile 9 行全默认——当前没有足够真人样本支撑留存/漏斗结论，任何「用户不用某功能」的判断都不能下；下一步是获客而非再做功能推断。
- [ ] [新需求提案·沿用 W3 清单] 5 题微组、邀请落地页预览、Web Share API、周报实时化、分享者作答对比、AI 先提示后解析、5 分钟微模考、模考大赛真实累计人数展示、SMS 凭证到位后注册验证码——待有真人流量数据再按转化排期。
- [ ] [流程] 每轮先核 `/api/health` rev 与 main 祖先关系：W9 集成时生产 `10e2eb82` 在 R510 分支（`origin/devin/1788816465-r510-precache-practice-first`）上，是 main `35be115c` 的后代（+7 提交，含 R511 `0c532532`），生产 = main 超集无漂移；**R510/R511 尚未合 main**，合 main 时与 W9-A 的 `main.py` 改动 merge-tree 预演无冲突。

## Deferred（W10 追加）

- [ ] [部署后回归·W10] 部署前 `git merge-base --is-ancestor 22a38390 <deploy_rev>`；部署后 `/api/health` rev 为 W10 集成提交、`docker logs` Traceback/locked/5xx 0。W10-A：`POST /api/mistakes uid=test-w10-a module={}` → 400，紧接 `POST /api/answer_log` 200 <1 s；`/api/shenlun/questions?limit=-1` items ≤20；test-w10-a/b 各起一场 mini 交卷 → `/api/exam/rank` total ≥2；test-w10-a 分享后本人 GET share `team_invite` null；`/api/exam/papers?kind=zhenti` 无 takers<5 且带 avg_score 的卷；结束按 uid 精确清理 test-w10-* 于 mistakes/answer_log/exam_attempts/exam_progress/shared_questions/shared_answers/team_members（LEFTOVER 0），不动 umteojq4sltdhorhm。W10-B：生产 `#/pages/profile/profile` 375/1440 两入口可达、console/pageerror 0。W10-C：macOS/Windows 微信开发者工具核 mastery-map 顶卡横排。
- [ ] [miniapp·P2·集成方新发现·1 行] `pkgSocial/reminders/reminders.wxml:36` `<kg-card variant="soft" padding="12" class="tip">` 与 W10-C mastery-map 同类：`reminders.wxss:14 .tip{display:flex;align-items:flex-start;gap;background}` 挂在组件宿主，`l-icon + .tip-t` 在 body 内 → 图标与文字纵向堆叠、gap 无效（background 仍生效）。改法：宿主留 `class="tip"`（background）、flex/gap 拆到 `body-class`；W10-C 受「只改一个文件」约束未动。同 grep 其余命中（team.wxml `t-row` display:block；practice/offline/pk-result 已走 body-class）为正常用法。
- [ ] [miniapp·真机清单追加·W10] mastery-map 顶卡「环形进度左 + 标题/副标/图例右」单行横排、深色态 raised 无阴影；reminders tip 卡修后同核；与 W9-C/W2-C/W3 既有清单一起在 macOS/Windows 微信开发者工具走一次；Skyline/深色/原生分享/订阅消息 0.6.0 体验版仍未真机验证。
- [ ] [backend·P3·结构] db.py 11 处 limit 夹紧未字面用 `deps.clamp_limit`（deps→auth→db 循环导入），用等价 `min(max(limit,0),N)`；统一需把 clamp_limit/as_int 下沉到不依赖 auth 的模块，属 W2 #46 db.py 分域抽离的一部分。
- [ ] [backend·P2·口径] `mock_event.py` 比赛报告仍按当前活跃题列表重解释 slot（W10-A 只改 exam_api start/submit/report 三处），需改读 attempt `question_ids` 快照并回退。
- [ ] [backend·P2·沿用 W2 #45] 迷你模考每场 `create_mock_paper` 落新卷（生产 kind=mock 已 79 张）：W10-A 只修排名池口径；卷表增长需另定——mini 卷改为不落 exam_papers（attempt 已持 question_ids 快照后可行）或定期清理无 attempt 的 mock 卷。
- [ ] [backend·P3·可选] `_ConnProxy` 级回滚落地后，评估把 `save_*` 写函数统一改为 `with conn:` 上下文（sqlite3 原生提交/回滚），一次性替代散落 commit/close；属 W2 #46，需测试护栏后做。
- [ ] [content·P1·运营/内容线] 真题卷缺题：生产 zhenti 120 卷中 196/200 卷 n<100，最差 id 24《2022 年安徽省行测》仅 17 题活跃（R348-C1 下线 3736 题 + 后续隔离，`api_exam_papers` 仅过滤 n<5）。修法是内容侧逐题复核可恢复/重抓/补图而非前端隐藏；先容器内只读统计每卷 `len(question_ids)` vs 活跃 n 与 disabled 原因分布，再定「n/总题数 <60% 标『缺题卷』或暂下」口径。W10-A 题序快照是其前置（否则恢复题会再次错位历史报告）。
- [ ] [content·P1·新需求/数据结论] 题库无国考卷、无 2026 卷：生产 zhenti 年份 2015–2025（2025 仅 5 卷），region 无「国考」。属内容采购/抓取问题需老板定是否开国考真题源；`exam_paper_filters` 已支持任意 region/year，工程零改动。
- [ ] [frontend-h5+miniapp·P2·设计决策] 收藏本地缓存 `favQuestions` 不按 uid 隔离：practice.vue toggleFav 对有 qid 题双写（服务端 setFav + 本地），favorites.vue/favorites.ts 把本地项当 `_local` 合并展示，退出/换账号后上一账号收藏仍以本地项出现；book.vue 收藏 tab 只读本地。两端同口径一次定：a) 本地只留无 qid 时政题（有 qid 以 `/api/favs` 为准）或 b) 存储键带 uid（`favQuestions:<uid>`）登录/退出切换；需产品定后 H5 practice/book/favorites/report 与小程序 favorites.ts/report.ts 一起改（practice.vue/book.vue 亦是并行热点文件）。
- [ ] [frontend-h5·P2·并行会话文件] 首页只读本机 `pstats`（home.vue）与服务端 growth/checkin 口径不一致；home.vue 正被并行会话修改，待合入后按 W3-B「服务端优先/本地降级」模式改首页，一并处理 W3 #64 双目标口径。
- [ ] [frontend-h5·P2·设计决策/先量化] 练习页解析主次权重倒置（hs 讲解 vs 官方解析视觉层级）需 UX 定稿；练习页作答后 share/comments/stat 每题并发扇出先用 CDP 网络面板量化每题请求数与耗时再决定合并 bundle 端点（复用 home_bundle 拼装），与 W9 #79 stats_bundle 同一「聚合端点」议题一起做。
- [ ] [frontend-h5·P2·#498 待处置] 模考列表多主按钮/筛选 chip/低样本文案（list.vue）与报告页机器标题/下一卷推荐（report.vue、exam-next.js）与开放 PR #498（R308，09-02 起冲突未更新）范围重叠；需先决定 #498 rebase 合入还是关闭重做再立项，避免双改同文件。低样本外显已由 W10-A 服务端门控覆盖。
- [ ] [miniapp·P2·组件层补齐] practice.wxml 48 行注释自证「kg-question-card / kg-option-group 小程序版未落地：页内按 T3 结构实现」，题卡/选项手写结构与 H5 不共享；需先在小程序落两个 kg-* 组件再替换 practice/exam/report 三处，成本中，待真机走查后排期。
- [ ] [miniapp·P2·不重复立项] stats 页 onShow 扇出（W9 #79 stats_bundle）、`utils/request.ts` 韧性四项（W9 #80）—— 沿用 W9 台账。
- [ ] [content·数据结论·沿用 W9 #90] hs 结论字母与 answer 冲突：W10 审计 5/1338（≈3.7‰）与 W9 抽样 1/1451（≈0.7‰）同量级，`answer_letter_conflict` 已扣 30；批量处置由 admin 按 quality_score 低分抽审决定，不做脚本 apply。
- [ ] [content·P3·沿用台账] 解析模板化 / explanation 与 hs 重复 /「确认答案为 X」句式：W2 #43、W3 #68、W9 #91 已判 LLM 重写成本受「不反复触发 AI」约束，不立项。
- [ ] [数据结论·沿用 W9 #93] 单一 uid 主导历史 answer_log：09-03 起 `REAL_TRAFFIC`/`PRACTICE_POOL` 已在 refresh_question_stats、排名、卷库 takers、分享统计等全部聚合处过滤，此前流量不回填；报告簇非探针 0 次、`attempt_count>=1` 仅 911/109371 题 —— 无真人样本支撑留存/漏斗结论，下一步是获客而非功能推断。
- [ ] [流程] W10 集成时生产 `/api/health` rev=`22a38390` = #640 head，已是 main `bd6514f6` 祖先（`merge-base --is-ancestor` 成立）→ 生产 = main 子集无漂移；W10 三分支基于 `241bafd6` 未 rebase，靠 merge-tree 预演 + 集成分支实合三次无冲突。W9 登记的「R510/R511 尚未合 main」已随 #640 合入解决。

## Deferred（W11-C 内容审计追加，详见 w11c-content-human.md）
- [x] [content·P1] hs 内部字母自相矛盾（q192759 比对句「与选项A一致」/ q178903 引文「D项“集中；贩卖”」贴错字母）：`quality.hs_self_conflict` 与 `answer_letter_conflict` 同档扣 30，535 题回放仅命中这 2 题、0 误报；数据本身留 admin 低分人审，不改库。
- [x] [content·P2] SEO 题页原解析被 hs 整段包含时双份渲染（16/535，`/tiku/q/181497`）：`_render_question` 与 H5 `exp-dup.js` 同口径去重。
- [ ] [content·P2·生成期] hs 尾句「确认答案为X。」417/535，panduan 109/109，35 个 10 题组里 21 组连续 ≥5：需在 hs 生成 prompt 加「结尾不用固定句式」+ 后处理轮换收束句；受「不反复触发 AI」约束，只对新生成批次生效，存量不重写。
- [ ] [content·P2·生成期] hs 不提任一非答案选项 336/535（shuliang 106/109）、且无排他词 222/535：生成 prompt 加「至少一句说明其它选项为何不成立」；静态规则 R5 只打标不扣分（数量题以过程为主属正常）。
- [ ] [h5·P3·并行会话范围] home.vue kg-hero-card label「拍题 AI 讲解 · 错题按遗忘曲线复习 · 迷你模考」仍是中点串，待 R5xx 线合入后改为一句焦点句。
- [ ] [content·未验证] hs 方法名（关键词定位法 / 关系层级法 / 415 份数法）是否忠实花生十三体系原教材，需教研核对。

## Deferred（W11 追加，详见 w11.md §5）

- [ ] [部署后回归·W11] 部署前 `git merge-base --is-ancestor f4d52d67 <deploy_rev>`；部署后 `/api/health` rev 为 W11 集成提交、`docker logs` Traceback/locked/5xx 0。W11-A：匿名 `test-w11-a1` `POST /api/team/create` + `POST /api/practice/progress` → 注册临时账号 → `merge_anon` → `/api/team/mine?uid=账号` 见队、`/api/practice/resume` 恢复；再调一次 merged 全 0；结束按 uid 精确清理 `test-w11-*` 于 teams/team_members/practice_progress/daily_set_entries/merged_anon 与临时账号（LEFTOVER 0），不动 `umteojq4sltdhorhm`。W11-B：生产 `#/pages/stats/stats` 375/1440 只读打开无报错（探针无数据 → 空态不变）。W11-C：macOS/Windows 微信开发者工具核统计页。Python 3.10 下 backend pytest 未实跑（本机 3.12）。
- [ ] [backend·P2·需产品决策] 模考交卷 `exam_api.api_exam_submit` 不校验 `started_at+duration_min`（进度保存 L369 校验、交卷不校验）：客户端「时间到自动交卷」与 submitFailPlan 重试天然晚于截止（exam.vue L282/L412-422），硬切会打断核心流程；需先定宽限（如 +120s 后拒收/降级不计榜）再做；模考榜当前低样本、无真实用户证据。
- [ ] [backend·P3] `answer_log.correct` 完全信任客户端（db.save_answer_log_detail L2640），服务端有 questions.answer 可复判：目前无榜单/对抗功能消费 answer_log（模考榜用服务端判分 attempts），仅自我统计；需先定多选/不定项/判断的答案归一口径；无用户证据暂缓。
- [ ] [backend·P3·1 行] `exam_api._judge_paper`/扫描答题卡的 log_items 不写 `source='exam'`（mistakes 有写）：answer_log.source 唯一消费方 practice_history 只回传、两端均不读；模考会话在「练习记录」按刷题会话展示。下次触碰 exam_api 顺手补 `"source": "exam"`，不单独立项。
- [ ] [frontend-h5·P3] App.vue L199-239 桌面 ≥768 旧卡片壳：`.card/.stat-c` 全仓 0 使用（死 CSS），`.cellcard`（profile/reminders/interview 的 wd-cell-group）同时得 border+sh-1，违反 SPEC「描边与阴影不同时出现」；影响仅桌面 3 页，删死规则 + cellcard 去阴影约 15 行，并入下次 H5 样式轮。
- [ ] [frontend-h5·P3·1 行加固] kg-tag.vue `.kg-tag__t` 未显式 `white-space:nowrap`（生产实测 uni-text 继承 pre-line；375 生产 9 页 41 个 tag 0 换行，当前无缺陷），作为组件层加固与下次 kg-* 组件改动合并。
- [ ] [miniapp·P3·1 行+真机] `components/kg-card/index.wxss .kg-card--raised` 用 `--sh-2`（H5 kg-card raised 用 `--sh-1`，SPEC 悬浮卡=sh-1），且 contest/exam list/discuss/plaza/reminders 共 11 处静态页卡用 raised 与组件注释「页面静态内容一律 flat」相悖；Linux 无开发者工具无法截图定级，并入真机清单一起核。
- [ ] [miniapp·真机清单追加·W11-C] 统计页「能力」组：growth 数量 n=3 c=0（其余模块 n=0）时「最薄弱」应显示「数量 0%」且不出「还没有能力数据」空态；本机 pstats 降级同口径（done>0）。另：pkgGrow/daily 结果页三按钮堆叠布局候选（源码 kg-button lg/lg/md block 三段，未见异常，无运行时证据）。Linux 无微信开发者工具，运行时留 macOS/Windows 会话与 W9-C/W10-C 清单一起核。
- [ ] [miniapp·工程·P3] 小程序页面源锁测试目前只能落 `frontend-uni/tests/miniapp-*.test.js`（`miniapp-native/.gitignore:3` 忽略 `miniprogram/**/*.js`，且 -f 强加会被打进小程序包）；若要回归小程序目录需改 .gitignore + project.config.json packOptions 排除 `*.test.js`，与既有 miniapp-w9/r506 同址惯例一起决定。
- [ ] [content·P2·需成本论证] W11-C 审计「缺非答案选项排错」336/535、「原解析空」38/535：属真实质量缺口但需 LLM 批量补写（成本/不重复触发 AI 端点纪律），先出样本 30 题人工评审 + 单题成本，再决定是否立项。
- [ ] [content·未验证] 方法名是否与花生十三教材术语一致（W11-C 遗留），需对照教材目录抽样后再定（同上条，不重复）。
- [ ] [W9/W10 既有 deferred 原样保留] 小程序 stats onShow 9 请求量化、request.ts 韧性、H5 predict/stats 重复请求、reminders aside-first、favorites grid、md.js/md.ts、密度类、报告页 a11y 两项、async 端点其余同步 SQLite、profile 日期口径、收藏 `favQuestions` 口径（统筹方倾向方案 a「有 qid 以 `/api/favs` 为准、本地只留无 qid 时政题」，本轮调研未发现反证亦未动代码）、reminders.wxml:36 tip 卡 body-class —— 均不重复立项。
- [ ] [流程] W11 集成时生产 `/api/health` rev=`03f7d826`（#650）是 main `f4d52d67` 祖先（`merge-base --is-ancestor` 成立）→ 生产 = main 子集无漂移；三分支 merge-base 均 `6cec81dd` 未 rebase，集成实合三次无冲突。
