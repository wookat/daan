# 迭代工作流台账（workflow backlog）

> 每轮（W*）结束时：勾掉本轮已完成工作项，追加本轮 deferred；下轮开工先读本文件与对应 w*.md，不重复立项。

## 已完成

- [x] R348-B1（W1，P0，backend）账号 uid 归属守卫补洞（Content-Type 大小写 + multipart scan_sheet）、写接口畸形数字 400、连签口径统一 —— 已合入 `devin/wf-w1-integration`，本地全绿 + uvicorn 实测；生产回归待部署后做（见 w1.md §5）
- [x] R348-C1（W1，P0，content）下线 SKIP/数据矛盾题与伪中文 yanyu AI 批次、剥离 hs 管线括注，规则入 quality.py 与 hs 导入口 —— 代码与脚本已合入；临时库 dry-run/apply/复扫一致；生产 `--apply` 已按 C1b 收窄词表执行（下线 3736 / 剥括注 2438，备份 `/data/data.db.bak-r348`，复扫全 0，详见 w1.md §5）
- [x] R348-M1（W1，P1，miniapp）海报操作区 `.bar`→`.actions`、账号 uid 403 清登录态回退匿名、刷题页渲染题图可预览、分享页模块名中文 —— 已合入；typecheck + lint（`ESLINT_USE_FLAT_CONFIG=false`）全绿；真机/开发者工具走查未做（无 Linux 版）
- [x] W2-A（W2，P1，backend）`/api/*` ValueError/TypeError → 统一 400、`api_save_mistake` question_id 整型化、`idx_mist_uid` 索引、SEO 页脚「10万+ 行测题 · 1.5万+ 历年真题」、`normalize_cjk_spaces`/`HS_META_RE` + `scripts/w2_content_cleanup.py`、生产广场 3 条测试评论已软删 —— 已合入 `devin/wf-w2-integration`，本地 ruff/pytest 266/pyright 全绿 + uvicorn 实测；**已上线（PR #564 → rev b31708d）并生产回归全过；清洗脚本生产 apply 已执行（改写 7700 + hs 2398 / rescored 10088，备份 /data/data.db.bak-w2）**，apply 预演暴露 UNIQUE 碰撞缺陷已修（见 w2.md §5.0）
- [x] W2-B（W2，P1，frontend-h5）index.html/manifest/og-card/share-q/pk-result 口径残留清零、`weak-spots.js` 薄弱考点同名合并、`exp-dup.js` 解析复读隐藏、contest 零人数文案 —— 已合入；lint/vitest 469/build:h5 全绿，本地 build 产物 Chrome 走查通过；生产 view-source/SW 核对待部署后做
- [x] W2-C（W2，P1，miniapp）连签 hero/stats 改服务端优先、`utils/offline.ts` answer_log/mistakes 离线队列、exam 错误态+重试、`page` 高度约束、首页题数 `/api/question_counts` 动态化、README Skyline→webview —— 已合入；typecheck/lint/vitest 7 全绿；**微信开发者工具走查未做**（断网→恢复落库、连签三处一致、14 页滚到底 + login 回归、page 高度对 navbar/底栏影响）

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
- [ ] [工程·P3] miniapp-native `npm run lint` 被仓库根 `eslint.config.mjs`（R213）误切 flat config 报 `Invalid option '--ext'`；package.json 加 `ESLINT_USE_FLAT_CONFIG=false` 或迁移 flat config。
- [ ] [工程·P3] miniapp `api/types.ts Question` 补 `image_credit?: string | null` 类型声明（M1 wxml 透传运行时可用但无类型）。

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
- [ ] [miniapp·P3] README/工程说明安装步骤需与 webview 现状同步复核（W2-C 只改渲染层描述与删除「基础库 3.x（Skyline 需要）」）；`npm run lint` 需 `ESLINT_USE_FLAT_CONFIG=false` 工程债见上。
- [ ] [miniapp·待走查] W2-C 微信开发者工具验收清单（重开项目确保非旧 .js 产物）：断网完成 3 题→恢复→`/api/answer_log` 落库=3（test-w2-* uid，`/api/checkin/summary` 核对当日 n）；首页 hero/任务卡/统计页连签一致且等于 `/api/checkin/badges.streak`；模考 tab 断网错误态+重试；14 页滚到底、login 页无截断；首页题数与 `/api/question_counts` 一致；结束清理 test-w2-* 数据。
- [ ] [运营·P2·新需求] 模考大赛冷启动：不做假数据；contest 页展示历史场次真实累计参与人数替代单场零值（W2-B 已先以「本场首批报名开放中 · 全站同卷」文案兜底）。
- [ ] [监测·P2] 首访「60 秒等待」W2 未复现，继续保留观察项（见 W1 条目），不立项。
- [ ] [部署后回归·W2] W2-A：`POST /api/export/pdf ['abc']` → 400 JSON、`/tiku/` 页脚 10万+、清洗脚本生产 dry-run（预期 CJK 空格约 12807 / hs 元句约 2398）→ 核对 → `--apply`（备份 `/data/data.db.bak-w2`）→ 抽 20 题含 332719/246674/1274976 → `docker restart` 刷 lru_cache；W2-B：新 bundle ≠ `index-Bm2wz5mH.js` + SW 更新、view-source meta/og/JSON-LD/og-card.png、share-q 不存在 id 文案、test-w2-* 完成页无重名、contest 零人数文案。部署前 `git merge-base --is-ancestor` 逐项核对近期 merge 点（R355 教训）。
