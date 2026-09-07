# R500：SOP-10 四维审计（R490–R499 登录/退出/清态簇收口复盘 + R410 后未整页过审页面清单 + 非探针真实路径漏斗 + 对标粉笔一手）→ 选簇「卷库 / 真题卷」功能面一手量测；命中「回忆版真题卷 69/221 缺模块（58 卷缺资料分析）而卷卡默认整卷齐全」→ 最小修（`ccdbf58`：`/api/exam/papers` 补 `mods` + 卷卡「常识 31 · 言语 24 · 数量 5 · 判断 21 · 缺资料」），生产 `7c50b27` → `ccdbf58`；否决「批量补建国考/缺项卷」（无一手 + 卷本身不全）

日期：2026-09-07（UTC）。改动：`backend/app/db.py`（`_paper_module_counts()` + `_list_exam_papers_base()` 单独一趟 `SELECT id, module … WHERE disabled=0 AND id IN (…)` 走 `idx_q_disabled_module` 覆盖索引，每卷 `mods = {module: n}` 只含 >0、按 `MODULE_ORDER`）、`frontend-uni/src/exam-paper-mods.js`（`paperModsText()` 纯函数）、`frontend-uni/src/pkgA/exam/list.vue`（卷卡 `.pmods` 一行 24rpx）、源锁 `backend/tests/test_paper_mods.py`（5 用例）/ `frontend-uni/tests/exam-r500-paper-mods.test.js`（10 用例）。**不改**：卷的构成 / 题库 / `build_zhenti_papers.py` / 模考判分 / `psource` 判定 / 原 `SELECT id, source, is_real` 覆盖索引查询 / 小程序端。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量（§1）**：R499 容器（15:22:02Z 起）至本轮发版 103 请求；本轮新容器（16:01:18Z 起）43 请求；两窗口 5xx / assets404 / monitor / Traceback / 小程序 UA 异常全 0；非探针 POST 0；非探针非 bot 3 条 = `15:50:23Z/15:50:30Z GET / 403`（`remote_ip 180.101.245.247`，**Host 是源站域 `kaogong-origin.zalize.com`、无 `Cf-Ray`/`Cf-Connecting-Ip`**，Chrome/87 桌面 UA → R388 无边缘头 403 规则命中的源站直连扫描）+ `15:59:27Z /api/health curl`（本机部署预检出口）；`*_ask_click` 真人 0 → `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；时政且 qid 非空 0/0；`error_reason` ≥09-11 0；probe=0 `answer_log` 53/2、growth 26/4；nudge `dismiss/fail/ok/click` 真人 0；`push_subs` 0；`umsacie7…` 0 回访、`umst3…` 无第二段作答；登录/提醒分包、`POST logout` 非探针全历史 0；WAL 4,124,152 B 同字节；harness uid 落库 0 行。
2. **四维复盘（§2）**：① R490–R499 登录/退出/清态簇 10 轮收口——8 处修（nudge 出口埋点、登录页栈分流+合并失败可见、退出清态、401/403 清态监听 4 页、picker 热区、错题写失败 catch、飞行竞态守卫）全部生产 verified、生产触发面全为 0（`logout`/账号域 401/403 非探针全历史 0），簇内**无遗留命中**，按统筹者指令收口不再深挖。② **R410 后未整页过审页面清单：0 页**（`pages/*` + `pkgA/*` 共 32 页对 `docs/iter/round-3/r41x–r49x` 逐页对账，唯一 grep 漏匹配的 `pkgA/exam/exam` 已由 R414/R415/R470/R474 覆盖）。③ 主循环三页（home/book/practice）375/1440 强制只读读数：可点元素 <40 px 仅 `searchbar` 33.3/37（R470 已登记为搜索框非按钮）和 practice `.fontbtn/.iconbtn` 19.9×29.5（R465 已登记「顶栏字号/更多按钮外层 40 撑高」的子元素读数）；<11.5 px 叶节点 375 只有 5 个 uni tabBar 原生 label 10 px（框架级，历轮登记）、1440 为 0；无横向溢出。④ **非探针真实路径漏斗**：probe=0 growth 26 行 10 种事件（`heatmap_view 8 / boot 4 / comeback_view 3 / reminder_optin 2 / review_entry_click 2 / share_copy 2 / share_open 2 / login_nudge_show 1 / push_nudge_show 1 / review_similar_auto 1`），`exam_attempts` probe 为 NULL/0 的已交卷 10 行 9 uid 中 `u6/u26/u32/test-w4-mp` 为内部账号、其余 5 个匿名 uid 全在 R374 探针打标前（08-29～08-30）或为 R386 网段命中前的兄弟自动化——**可确认外部真人模考交卷 0**；因此本轮不能拿「真人模考数据」做功能立项，只能拿「产品当前对外承诺 vs 实际数据」做。
3. **对标粉笔一手（§3）**：公开面（未登录）`fenbi.com` 首页 + `/spa/tiku/guide/home/xingce/xingce?labelId=1` 真题页：一级导航「公务员行测/申论/面试」、「国考」「国考模拟题/省考模拟题」分区、地区筛选、「共36套」、2026/2025 国考卷、难度标签；点卷即弹登录/注册，**作答/错题/复习内部行为未核**。与本产品卷库对照，公开面差距只有两项：粉笔真题卷**按考试类别（国考/省考）+ 年份全卷成套**；本产品 `zhenti` 120 卷里 **仅 1 卷标题含「国考」**（`questions.source` 含国考 766 题、30 个 source 分散、最大 81 题地市级），且卷卡不显示卷的模块构成。
4. **一手量测命中（§4）**：生产库只读跑 `_list_exam_papers_base()` 同形查询：221 卷（`zhenti 120 + mock 100 + retired 1`）引用 13,341 活跃题；**≥5 题的卷里五模块齐全 152、缺项 69、无 module 0**；缺项形态 `缺资料 58 / 缺数量+资料 5 / 缺常识+资料 2 / 缺常识 2 / 缺言语+资料 1 / 缺数量 1`（资料分析图表题 PDF 回忆版基本没收进来）。卷卡此前只显示 `75 题 · 70 分钟 · N 人考过 · 平均 X 分`，用户点「开始模考」前无法知道这是不含资料分析的卷——对以行测五模块为常识的考生来说是**信息误导**（R398 SOP-10 已定的原则：不默认整卷齐全）。`build_zhenti_papers.py --dry-run` 显示可补建的国考卷 3 张（2023/2024/2025 地市级 71/69/81 题）**同样全缺资料**、且 2025 地市级实考 130 题只回忆到 81 题；批量补建 = 把「不全的卷」冒充「国考真题卷」再多 16 张 → **否决**（无一手证据说用户需要、且违背不造假原则），登记等题源。
5. **最小修（§5，`ccdbf58`）**：后端在 `_list_exam_papers_base()` 里对每卷活跃题按行测五模块计数、只含 >0、按 `MODULE_ORDER` 顺序，新字段 `mods`；前端卷卡在 meta 行下一行如实外显「常识 19 · 言语 25 · 数量 9 · 判断 18 · 资料 4」/「常识 20 · 言语 22 · 数量 12 · 判断 21 · **缺资料**」（缺项按顺序列在末尾、没有任何已知模块时整行不渲染）。**首版把 `module` 加进原 `SELECT id, source, is_real` 一条查询会让 SQLite 从 `COVERING INDEX idx_q_active_src` 退化为 `INTEGER PRIMARY KEY (rowid=?)` 回宽行表（R383 冷读 85 MB 回归）**——改为单独一趟 `SELECT id, module … disabled=0 AND id IN (…)`，`EXPLAIN QUERY PLAN` = `SEARCH questions USING COVERING INDEX idx_q_disabled_module (disabled=?)`，生产库只读实测 13,341 题 24.8 ms（源查询不变）+ 50.9 ms（module 查询）。门 pytest 514 / ruff / `backend/` pyright 0；vitest 775 / eslint / build:h5 绿。
6. **发版 + 三点对照（§6）**：宿主 avail 5.5 G / load 0.26 / 无兄弟构建（首查「兄弟构建 3 个」是 `grep` 自匹配，逐进程核为 0），`--skip-build` 一次 rc=0；容器 `16:01:18.931Z` healthy 0 重启 `rev=ccdbf58`；`pkgA-exam-list.DuZhjzCa.js` 线上=本机 md5 `9a7f0fc0d057`；7/7 200；perf `/` 0.99·1.00 LCP 940.7 / `/tiku/` 1.00·1.00 LCP 935.6。生产 `GET /api/exam/papers?kind=zhenti` 120 卷 **120/120 带 `mods`、69 卷 <5 模块**，3 次 0.21–0.35 s（与改前同量级）；生产 bundle CDP 375/1440 探针头只读：`.pmods` 120/120 渲染、69 条含「缺」、独占一行（`ownLine true`、宽 = `.paper-meta` 308.1/486）、字号 11.52/12 px（24rpx 下限）、`small_n 0`、`docSW 360/1425` 无溢出、`errs []`、非 GET 0。

## 1. (c) 补量 / 到期项

`~/r500_post.sh` → `~/r500_post.out`（发版前）/ `~/r500_post2.out`（发版后）。两窗口计数、DB 观察项见 §0.1；`probe=0 growth events by name` 与 `answer_log` 两 uid 末次时间戳（`umsacie7…` 1788782276、`umst3…` 1788782427 = 09-07 12:00Z 段）与 R499 完全相同。两条 `GET / 403` 归属见 §0.1（源站域直连、无 Cf 头）。

## 2. 四维复盘

- **簇收口表（R490–R499）**：R490 每日一练完成态 / R491 问答会话 sheet / R492 错题 AI 结果态 / R493 完成态 → 0 命中或登记；R494 nudge 3 埋点；R495 登录页栈分流 + 合并失败 toast；R496 退出清态；R497 401/403 `authChanged` profile/stats + picker 热区；R498 home/book 监听 + 错题写失败 catch；R499 `request()` GET 回包身份守卫。生产触发面：`POST /api/auth/logout` 全历史 0、账号域 401/403 非探针 0、登录/提醒分包非探针 0 → 8 处修全是「可达未触发」路径，已 verified 即收口。
- **R410 后页面清单法**：`git log 2541413..HEAD -- <page>` × `grep -l <page> docs/iter/round-3/r4*.md`，32 页全部有 ≥1 篇 R41x+ 取证文档引用。
- **主循环三页读数**：`~/r500_scan.py <375|1440>` → `~/r500_scan_*.out` + `~/r500_{home,book,practice}_*.png`；结果见 §0.2③。

## 3. 粉笔一手

`~/r500_fenbi.py` / `~/r500_fenbi2.py`（CDP 访问公开页，未登录、未注册）→ `~/r500_fenbi_home.html`、`~/r500_fenbi_tiku.png`、`~/r500_fenbi_xingce.png`、`~/r500_fenbi_paper.png`（点卷 → 登录/注册弹窗）。只能作证公开信息架构，不能作证其作答/错题/复习算法与学习效果。

## 4. 一手量测：卷库构成

- `~/r500_appq.sh` → `~/r500_appq.out`：生产库 `mode=ro` 复现 `_list_exam_papers_base()` 的 qid 回表 + module 计数，输出 §0.4 分布 + 样例（`2025年四川 75 题 五模块齐` / `2025年贵州 75 题 缺资料` / `2025年黑龙江 93 题 缺资料`）；`module null/other among active paper qids 0`。
- `~/r500_bench.sh` / `~/r500_bench2.sh` → 同机 A/B：合并进原查询 vs 单独一趟；`EXPLAIN QUERY PLAN` 与耗时见 §0.5。
- `~/r500_guokao.sh` / `~/r500_guokao2.sh` → `~/r500_guokao*.out`：`source` 含国考 30 组 766 题、`papers` 标题含国考 1 卷；候选 3 卷 `noexp/noans/noopt 0`、`has_hs 100%`，但模块只有常识/言语/数量/判断。
- `~/r500_takers.sh` → `~/r500_takers.out`：`exam_attempts` 已交卷按 probe 分布 `(NULL 10 / 1 14)`，NULL 的 9 个 uid 逐个归属见 §0.2④；`user_profile.exam_type` 全部 9 行为「国考」（8 行地区 NULL，唯一 probe=0 用户 `umst3…` 亦为国考）——这是用户「想考什么」的一手，但**不是**「需要国考卷」的一手（该用户没进过卷库）。
- `python3 scripts/build_zhenti_papers.py --dry-run` → `~/r500_dryrun.out`：可补建 16 卷（含 3 张国考地市级）、跳过 40 卷已成卷 + 1 卷 233 题疑似多卷混装；16 卷全部缺资料分析。

## 5. 修法与取舍

- 只改**展示契约**：卷是什么就显示什么，缺什么就写「缺 X」；不改卷、不补卷、不改判分与报告。
- 后端 `mods` 只含 >0 模块、只认 `MODULE_ORDER` 五模块（`shenlun/mianshi/时政` 等不计）、只算 `disabled=0`；前端 `paperModsText()` 只认正整数、非法/0 视为缺、无任何已知模块返回空串（fail-closed，不渲染）。
- 索引：`SELECT id, source, is_real` 一条不动（`idx_q_active_src`），`SELECT id, module` 单独一趟走 `idx_q_disabled_module`，IN 段 30,000（module 查询每次 IN 都整段扫索引，段越少越好）。
- 源锁：后端 5 用例（活跃题计数 / 顺序 / 跳过 disabled / 跳过未知模块 / 纯函数空与部分映射），前端 10 用例（齐全 / 缺资料 / 多缺 + 非法值 / 6 种 fail-closed 输入 / 卷卡模板挂载 / `paperModsText(p.mods)` 调用 / 24rpx 与 `display:block; width:100%`）。修 fixture 时的两处教训（题干唯一约束撞车 → 加 `tag`；未知模块用 `shenlun` 会与 `test_shenlun_hub` 共享库状态互扰 → 改 `mianshi`）见 SKILL。

## 6. 发版与复验

- `~/r500_deploy.log`：4-pre 预检 / 4 停旧起新 / 5 健康 / 6a 7 路 200 / 6b Lighthouse 全过；数值见 §0.6。
- `~/r500_papers_ui.py <375|1440>` → `~/r500_prod_papers_{375,1440}.out` + `~/r500_papers_{375,1440}.png`：读数见 §0.6；`over.bad` 里的 `.fchip` 是 `<scroll-view scroll-x class="fscroll">` 内的筛选 chip（页面 `docSW == cw`），不是溢出。
- `~/r500_papers_post.json`：改后生产 API 原始回包。

## 7. 登记 / 不改

- 国考卷成套（粉笔公开面最大差距）：等资料分析图表题源；`build_zhenti_papers.py` 候选 16 卷全缺资料，不批量补建。2015 吉林 233 题需人工拆卷。
- 卷库排序 / 「国考」「省考」分区：现有筛选为年份 + 地区，无一手用户证据要求加考试类别维度；`user_profile.exam_type` 全国考但该用户未进卷库。
- `mods` 未接入小程序端（W7 分支自有卷库列表，合 main 时可顺带读 `mods`）。
- `exam/exam` 模考作答页 / 报告页 `per_module` 已按实际模块出分，未受影响；未复跑。

## 8. 如实说明

CDP 非真机；本轮向生产 0 真实模考/作答/账号/LLM 请求（`posts_blocked []`、非探针 POST 0）；粉笔只核公开面；可确认外部真人模考交卷 0，功能立项依据是「产品对外信息 vs 数据实况」而非用户反馈；`mods` 对小程序端无感；无 testing agent 录屏（未另行授权）。
