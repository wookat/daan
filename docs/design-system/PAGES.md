# 页面架构 v4 · H5 32 页 + 小程序 14 页

> 前置：[SPEC.md](SPEC.md)、[COMPONENTS.md](COMPONENTS.md)。页面清单以 `frontend-uni/src/pages.json`（8 主包 + 24 pkgA）与 `miniapp-native/miniprogram/app.json`（14 页）为准，本轮重新读取。
> 逐页现状与问题的一手证据在 `research/03-our-pages-audit.md` §2（H5，`[生产]` 375/1440 × 浅/深截图）与 §7（小程序，`[代码]`），本文不重复截图描述，只给决定。
> 本文第 5 节是四个并行实施组的文件清单与「必须做 / 不要碰」边界，是并行开工的合同。

---

## 1. 五个页面模板（≤5，每页必选其一）

| 模板 | 结构（移动 <768） | ≥768 | ≥1024 双栏 | 用于 |
|---|---|---|---|---|
| **T1 流** Feed | 顶部条（标题/搜索）→ `KgHeroCard` 或 `KgStatRow` → 纵向卡片流（`KgSectionHeader` 分区） | 单列居中 640 | **主列 640–720 + 辅栏 320**：辅栏放「今日目标/连签」「快捷入口」「日历」等本页第二优先级卡 | home, book, stats, profile, calendar, offline, favorites, interview, contest, team, pk, ask（会话流变体） |
| **T2 列表** List | 吸顶筛选区（`KgChipRow` ×1–2 / `wd-segmented`，`--z-sticky`）→ `KgPaperCard`/条目卡列表 → 分页「加载更多」 | 单列 640 | 主列 = 列表；辅栏 = 筛选面板（chip 行在桌面展开为可见的复选列表）+ 本页统计卡 | exam/list, shenlun, search, discuss, plaza, inbox, practice-history, interview/history, mastery-map（列表态） |
| **T3 作答** Answer | 顶栏（模块 tag · 进度 `.num` · 计时 · 退出 44 命中区）→ `KgQuestionCard` → `KgOptionGroup` → (作答后) `KgAnalysisCard` → **固定底部 `KgActionBar layout=answer`** | 题目列 max 640 | **题目列 ≤760 + 辅栏 320**：辅栏 = 答题卡网格（`KgReportSection kind=answers` 复用）+ 快捷键说明；`KgActionBar` 不再 fixed 改为题目列底部 sticky（`exam.vue:606` 现有） | practice, exam/exam, exam/mini(小程序), share-q(只读态), pk 对局中, ask（`layout=input` 变体） |
| **T4 报告** Report | `KgHeroCard variant=brand`（分数/主数字）→ `KgStatRow` → `KgReportSection` ×N → 底部 `KgActionBar layout=actions`（重考 / 回错题本） | 单列 640 | 主列 = hero + modules/advice；辅栏 = answers 网格 + 分享/导出 | exam/report, contest-report, weekly-report, pk-result, practice 结算段, 小程序 exam/report |
| **T5 工具** Form | 单列居中 max 480；可选 `KgHeroCard plain/brand` 说明 → 输入（`wd-input`）→ **1 个** `KgButton primary lg block` → 说明文字 `--fs-sub --ink-3` | 居中 480 | **不双栏**，仍 480 居中，页面底 `--bg` | login, team/join, reminders, poster, search（输入态）, pk 发起段 |

规则：一个页面只能有一个模板；模板内组件顺序可省略不可重排；T5 永不双栏；T3 的辅栏内容只允许答题卡与快捷键（不能塞广告/推荐）。

---

## 2. 桌面 ≥1024 双栏规则

- 壳：左侧 208px 导航栏（现有 `App.vue:269`，Tab 五项 + 二级入口），内容区 max 1140（≥1366 时 1280），**居中**。
- 双栏：`grid-template-columns: minmax(640px, 720px) 320px; gap: 24px`；≥1366 主列 `minmax(640px, 760px)`。辅栏 `position: sticky; top: 24px`。
- 主列内容宽度即阅读宽度：题干/解析/讨论正文**不超过 760**。
- 辅栏内容来源只能是本页已有信息的「第二优先级」，不新增数据请求（辅栏是布局重排，不是新功能）。
- 1024–1365：hover 态启用（`@media (hover:hover)`），卡片 `--sh-2` 抬升、按钮 hover = pressed 色。
- 深链打开（SSR `/tiku/q/N` → practice）与 Tab 页在桌面一致走同一壳。
- 现状差异：`App.vue` 的 1280/1366 两个断点只是壳宽，页面内部的双栏是 practice/exam 各自写的 `@media (min-width: 1024px)`（24 处）；v4 把双栏收成 `KgTwoCol` 布局组件（`slot main / aside`，`[foundation]`），页面组只填 slot。

---

## 3. H5 逐页架构（32 页）

列：任务 / 首屏必含 / 功能清单（**留**保留 · **删**删除或降级 · **增**新增，附理由）/ 模板 / 复合组件 / 导航去向。行内 `#n` 指 `research/03` §2 表行号。

### 3.1 主包 Tab 页（组 `h5-tab-pages`）

**`pages/home/home` · 刷题（Tab1）** `#1` · T1
- 任务：立刻开始今天该做的题。
- 首屏必含：① 有记录用户 = `KgHeroCard`（今日已练 N/20 + 续练/开始 1 个主按钮 + 连签）；零作答用户 = `KgHeroCard` 一句价值 + **1 个** CTA「免注册开练」；② 五模块 `KgModuleCard row` 列表。首屏到此为止（≤ 1 屏 812px）。
- 留：今日目标、续练卡（合并进 hero）、时政每日一练（降为 `KgModuleCard grid` 的一格）、五模块、更多练习（收成 `grid` 4 格：模考 / 申论 / 错题重练 / 拍题讲解）、公告（`KgBanner` 可关闭）。
- 删：营销 hero 四卖点卡（对零作答用户只留一句 + 1 CTA；`showLanding` 逻辑保留但内容缩）；「今日任务 1/3」与「今日已练 0/20」双进度 → 只留 0/20；三个「计划」入口（今日计划 / 制定学习计划 / 学习计划与报考画像）→ 合一张「学习计划」卡（未制定→去制定，已制定→今日任务）；9 宫格 → 4 格；随机练入口（并入模块列表末行「随机」）。理由：`[生产]` 375 高 2,484px、4 个「开始刷题」入口，`#1`。
- 增：无（首页减法）。
- 组件：KgHeroCard, KgModuleCard(row/grid), KgSectionHeader, KgBanner, KgStreakBadges, KgSheet（题型选择）, KgSkeleton(hero)。
- 导航：→ practice（模块/随机/续练）、exam/list、shenlun、book(redo)、ask、calendar、search、offline。≥1024 辅栏：连签日历（calendar 摘要）+ 更多练习 grid。

**`pages/book/book` · 错题本（Tab2）** `#2` · T1（有数据时列表段 = T2 行为）
- 任务：看今天该复习哪些错题并开始。
- 首屏必含：`KgStatRow`「今日待复习 N · 预计 M 分钟 · 累计 K」+ 主按钮「开始复习」；下方 `KgChipRow` 模块筛选 + 错题卡列表。空态：`KgEmptyState` 双 CTA（去刷题 primary / 拍题录入 secondary），并解释右下「＋」。
- 留：待复习 banner（并入 StatRow）、模块/考点分组、chip 筛选、redo 重练、pid 筛选、批量操作、笔记、浮钮「＋」。
- 删：批量操作 sheet 7 项平铺 → `KgSheet` 菜单分组（复习 / 整理 / 导出）；本页 16 个独占色值 → 错题状态只用 `ok/warn/bad` 三 tag。
- 增：首屏数字行（竞品错题本标配，`docs/design-benchmark/report.md`）。
- 组件：KgStatRow, KgChipRow, KgCard(selected), KgTag, KgEmptyState, KgSheet, KgActionBar(actions，多选时), KgQuestionCard(错题卡只读), KgAnalysisCard(详情)。
- 导航：→ practice(redo/pid)、export-confirm、ask(拍题)。≥1024 辅栏：模块分布 + 遗忘曲线说明。

**`pages/ask/ask` · AI 问答（Tab3）** `#3` · T3（`KgActionBar layout=input`）
- 任务：拍一道题让 AI 讲。
- 首屏必含：会话列表（有历史）或空态引导（拍题 / 粘贴题目两个动作）；底部固定输入条（拍照 icon + 输入 + 发送）。桌面（无摄像头）首屏改「粘贴题目 / 上传图片」。
- 留：拍单题、文字输入、相册、会话历史、prefill、深讲。
- 删：「整页批改 · 即将上线」占位按钮；「面试」快捷入口（与 `pkgA/interview` 重复，保留在首页更多练习）；取景框在桌面隐藏。
- 增：会话列表作为可见入口（现藏在「历史」圆钮）。
- 组件：KgActionBar(input), KgEmptyState, KgCard(消息气泡用 soft), KgSkeleton(lines)。
- 导航：→ practice（同考点练）、book（加入错题本）。≥1024 辅栏：会话列表。

**`pages/stats/stats` · 统计（Tab4）** `#4` · T1
- 任务：知道我学得怎样、哪里弱。
- 首屏必含：`KgHeroCard plain`（`KgStatRow` 3 数字 + 「学习日历 ›」）；0 数据时整页折叠为 1 张「再答 N 题解锁统计」`KgHeroCard plain` + 进度 + 主按钮。
- 留：热力图、五模块雷达、错题模块分布、高频错题型、掌握度地图入口、成就勋章。
- 删：「AI 学习教练」「数据备份与迁移」cell → 移到 profile；登录提示文字链 → `KgBanner` 带 lg 按钮；0 数据时 6 个空模块不再铺开。
- 增：能力预测卡用 `predict-card`（现有组件）统一位置。
- 组件：KgHeroCard(plain), KgStatRow, KgStatCard, KgProgress(环), KgSectionHeader, KgEmptyState(compact), predict-card。
- 导航：→ calendar、mastery-map、weekly-report、practice-history、practice（弱项）。≥1024 辅栏：日历 + 勋章。

**`pages/profile/profile` · 我的（Tab5）** `#5` · T1
- 任务：找设置、找我的记录。
- 首屏必含：用户卡（头像/昵称/登录按钮 lg）+ `KgStatRow` 3 数字；第一组 cell「学习」。
- 留：wd-cell 分组结构（本页最干净，作为 cell 规范样板）、偏好设置（字号 / 深色 / 音效 / 提醒）、其他、门户链接、版权。
- 删：打卡徽章 6 格大块 → 一行 `KgStreakBadges`（点击 → calendar）；「AI 面试陪练 / 答题 PK / 刷题小队」功能入口从「我的」删除（首页更多练习保留一处）；「模考记录」cell 改名「真题卷库」（它实际跳 exam/list，`#14`）。
- 增：从 stats 移来的「AI 学习教练」「数据备份」两 cell。
- 组件：KgCard, KgStatRow, KgStreakBadges, wd-cell/wd-cell-group, wd-switch, KgButton。
- 导航：→ login、reminders、favorites、inbox、practice-history、exam/list、interview/history、offline。≥1024 辅栏：徽章 + 最近模考。

**`pages/stats/calendar` · 学习日历** `#7` · T1
- 任务：看打卡、补打卡海报。
- 首屏必含：月历（今天描边 `--brand`，打卡日 `--brand-soft-2`/`--brand`）+ 图例 + 连签 `KgStreakBadges`。
- 留：月历、里程碑、徽章、生成海报。
- 删：徽章本页私有实现（→ 组件）。
- 增：无。CTA 统一 `KgButton primary lg`（现 36px）。0 天时海报按钮 disabled + 说明。
- 组件：KgCard, KgStreakBadges, KgButton, KgTag。
- 导航：→ poster、practice。≥1024 辅栏：本月统计 StatRow。

**`pages/team/join` · 加入小队** `#8` · T5
- 任务：凭邀请码入队。
- 首屏必含：`KgHeroCard brand`（队名/邀请人一句）→ 邀请码输入（`wd-input` 6–8 位 `.num`）→ `加入小队` lg block → 「先登录」text。
- 留：全部。
- 删：无。**导航栏标题固定「加入小队」**（`pages.json` 已是；但页面用 `document.title` 覆盖成 SEO 长句，`[生产]` 375 截断 —— 只保留 `<title>`/分享用，不改 navigationBarTitle）。
- 增：与 `pkgA/team/team` 共用同一个 `KgJoinForm`（局部组件，放本组内 `pages/team/join-form.vue` `[待定]`：因跨组共享需进 `components/`，本轮由 foundation 建 `KgInviteInput`）。
- 组件：KgHeroCard, wd-input, KgButton。
- 导航：→ team（成功后）、login。

### 3.2 作答与模考（组 `h5-practice-exam`）

**`pages/practice/practice` · 练习作答** `#6` · T3
- 任务：做题、看解析、纠错。
- 首屏必含：顶栏（模块 tag · `1/10` · 计时 · ✓✗ · 退出）→ `KgQuestionCard` **含 meta 行（考点 · 难度★ · 全站正确率 · 真题）** → `KgOptionGroup` → 底部 `KgActionBar answer`。
- 留：全部作答逻辑（自动跳题、长按排除、键盘、字号三档、限时、redo/pid/lead/seo_q 各来源、结算段、退出保留进度 modal、离线队列）。
- 删：顶栏 6 个操作 3 种形态 → 全部 icon-button（44 命中）；`.real-tag/.opt/.after` 等本页 47 个色值 → token；5 种绿 → `--ok/--ok-strong`；`word-break: break-all`。
- 增：题面 meta 行（数据已在接口，`q-stat.js` 口径）；解析「平均用时」（依赖后端 `avg_secs`，无则隐藏）；解析默认折叠 3 行；与模考页共用 `KgActionBar answer`（标记/排除图标一致）。
- 结算段：T4 形态，`KgHeroCard brand`（本组正确率）+ `KgReportSection advice`（`.redoreport/.fixreport` 文案保留）+ `KgActionBar actions`（再来一组 / 复盘错题）。
- 组件：KgQuestionCard, KgOptionGroup, KgAnalysisCard, KgActionBar(answer/actions), KgHeroCard, KgReportSection, KgSheet(设置/答题卡), KgTag, q-social-bar, KgSkeleton。
- 导航：← home/book/exam-list/SSR 深链；→ discuss、ask（深讲）、book。≥1024 辅栏：答题卡网格 + 快捷键。

**`pkgA/exam/list` · 真题卷库** `#12` · T2
- 任务：挑一套卷开考。
- 首屏必含：迷你模考横幅（`KgCard raised` + 1 按钮）→ 已刷 N/120 `KgProgress` → 状态 `wd-segmented`（全部/没考过/考过）→ 年份 `KgChipRow`（右渐隐）→ 前 20 张 `KgPaperCard`。
- 留：筛选维度（状态/年份/地区）、置顶、进度、URL 状态（`exam-list-url.js`）。
- 删：一次渲染 120 卡（→ 分页 20 + 「加载更多」，或按年份折叠；R383 分支已做过分页，`[仓内]` `origin/devin/1788633425-ui-type-scale` 可参考但**未在 main**）；每卡 3 等权按钮 → 1 主 + `···` 菜单（按卷练习 / 只练错题 / 导出 PDF）；地区 chip 28 个横滑 → 桌面辅栏复选，移动收进「地区 ▾」sheet。
- 增：chip 行右渐隐。
- 组件：KgPaperCard, KgChipRow, wd-segmented, KgProgress, KgSheet, KgCard, KgEmptyState。
- 导航：→ exam/exam（mini=1 或 pid）、practice(pid)、report、export-confirm。≥1024 辅栏：筛选面板 + 我的模考 StatRow。

**`pkgA/exam/exam` · 全真/迷你模考作答** `#13` · T3
- 任务：答完 30 题交卷。
- 首屏必含：顶栏（模块 tag · 倒计时 `.num` · 标记 icon）→ `KgProgress` 4px（槽 `--brand-soft-2`，修漏网）→ `KgQuestionCard`（无解析）→ `KgOptionGroup` → `KgActionBar answer`（上一题 ghost / 答题卡 icon / 下一题 primary；末题变「交卷」）。
- 留：答题卡 sheet、交卷确认、进度同步（`exam-progress-sync.js`）、标记、排除（`exam-excl.js`）、导航标题带时间戳 → 改「迷你模考」固定（`#13` 问题②）。
- 删：`.navrow` 私有底栏、`标记` 文字按钮。
- 增：与 practice 共用底栏；桌面辅栏答题卡常显（`exam.vue:606` 现有行为纳入 `KgTwoCol`）。
- 组件：KgQuestionCard, KgOptionGroup, KgActionBar(answer), KgProgress, KgSheet, KgReportSection(answers), KgTag。
- 导航：→ report。

**`pkgA/exam/report` · 成绩报告** `#14` · T4
- 任务：看成绩、看弱项。
- 首屏必含：`KgHeroCard brand`（分数 `--fs-display` + 用时/正确率 `KgStatRow`）→ `KgReportSection modules`。
- 留：模块得分、薄弱考点、逐题回顾、重考、错题入本、分享（`exam-share.js`）、`rank-card`（现有组件）。
- 删：空态文案「模考记录」（不存在）→ CTA「去卷库」指向 exam/list；`88rpx/800` 分数样式。
- 增：「击败 N%」（`rank-card` 已有数据源 `[待核]`）；模块雷达（复用 stats 雷达画法，数据 `per_module` 已有）。
- 组件：KgHeroCard, KgStatRow, KgReportSection(modules/answers/advice), rank-card, KgActionBar(actions), KgEmptyState。
- 导航：→ exam(重考)、practice(pid 只练错题)、book、poster。≥1024 辅栏：answers 网格 + 分享。

**`pkgA/exam/contest` · 模考大赛** `#15` · T1
- 首屏：本期 `KgPaperCard`（状态 tag + 倒计时 + 1 按钮）。留：赛制说明折叠、往期。删：往期 4 场平铺 → 折叠 1 行「往期 N 场 ›」。组件：KgPaperCard, KgCard, KgTag, KgButton, KgSheet。→ exam、contest-report。

**`pkgA/exam/contest-report` · 大赛报告** `#16` · T4
- 与 report 同构（多一个排名区 `KgReportSection` + `rank-card`）。空态与 report 共用 `KgEmptyState` 文案模板「暂无{X}报告」。→ contest。

**`pkgA/share/share-q` · 队友分享的题** `#27` · T3（只读）
- 首屏：`KgQuestionCard` + `KgOptionGroup readonly`（可作答一次后 reveal）→ `KgAnalysisCard` → `KgActionBar actions`（去刷题 / 看队友答案）。空态 `KgEmptyState`（链接无效 → 去刷题）。→ practice、team。

**`pkgA/share/pk-result` · PK 战绩** `#28` · T4
- 首屏：双方 `KgHeroCard brand`（比分 `--fs-display` ×2 + 皇冠）→ `KgReportSection answers`（逐题对比）→ `KgActionBar actions`（再战 / 发起我的 PK）。空态 → pk。→ pk。

**`pkgA/pk/pk` · 答题 PK** `#29` · T1（对局中切 T3）
- 首屏：`KgHeroCard brand`（本周胜场）→ 模块 `KgChipRow`（统一第四套 chip 样式）→ 两按钮（发起 primary / 随机匹配 secondary）→ 挑战码输入（T5 段，`KgInviteInput`）。留：胜场榜、我的对局。删：榜单 r1/r2/r3 硬编码徽章底 → `KgTag warn/neutral/module`。组件：KgHeroCard, KgChipRow, KgButton, KgInviteInput, KgCard, KgTag, KgEmptyState。→ pk-result、practice。

### 3.3 pkgA 其余（组 `h5-pkgA-rest`）

| 页 | 任务 | 首屏必含 | 留 / 删 / 增 | 模板 | 组件 | 去向 |
|---|---|---|---|---|---|---|
| `shenlun/shenlun` 申论专区 `#9` | 找一道申论题练 | `wd-segmented`（题库/素材/记录）→ `KgChipRow`（地区/年份/题型/收藏）→ 前 20 张卷卡 | 留 三 Tab、筛选、草稿（`shenlun-draft.js`）、词汇；删 「去作答 ›」文字链 → `KgPaperCard` 主按钮、462 节点一次渲染 → 分页；增 chip 右渐隐 | T2 | KgPaperCard, KgChipRow, wd-segmented, KgSheet, KgEmptyState | → 申论作答（本页内态）、favorites |
| `user/login` 登录 `#10` | 登录 | Logo → `wd-segmented`（登录/注册）→ `wd-input` ×2–3 → `登录` lg block → Zalize 一键登录 secondary → 说明 | 留 全部；删 46px/9px 私有按钮；增 inline 校验 | T5 | wd-input, wd-segmented, KgButton | ← 任何需登录处 |
| `user/offline` 离线题包 `#11` | 下载题包离线刷 | 存储占用 `KgProgress` → 5 个 `KgModuleCard row`（右侧 `KgButton sm` 下载 / 进度环 / 已下载 tag） | 删 「资/数/言/判/常」首字方块 → module 图标；下载 12px 文字链 → 按钮 + 进度 | T1 | KgModuleCard, KgProgress, KgButton, KgTag | → practice(offline) |
| `stats/weekly-report` 周报 `#17` | 看上周周报 | `KgHeroCard plain`（本周 4 数字）→ `KgReportSection modules/advice` | 空态文字链 → `KgEmptyState`（去刷题 lg） | T4 | KgHeroCard, KgStatRow, KgReportSection, KgEmptyState | → practice, mastery-map |
| `search/search` 搜索 `#18` | 搜题/考点/卷 | `wd-search` 自动聚焦 → 范围 `KgChipRow`（题号/题干/考点/申论/卷）→ 最近搜索 chips（增）→ 结果列表 | 增 最近搜索（本地）、热门考点（接口有则出，`[待核]`）；删 纯说明空态 | T2 | wd-search, KgChipRow, KgCard, KgEmptyState | → practice(qid)、shenlun、exam/list |
| `social/discuss` 讨论区 `#19` | 看这题的讨论 | 题干摘要 `KgCard soft` → `wd-segmented`（最热/最新）→ 讨论条目卡 → `KgActionBar input`（发言） | 删 无参数时的假 tab + 「共 0 条」 → 直接全屏 `KgEmptyState`（去广场） | T2 | KgCard, wd-segmented, KgActionBar(input), KgTag(module), KgEmptyState | → plaza, inbox, practice(qid) |
| `social/inbox` 讨论消息 `#20` | 看回复/点赞 | 消息条目列表（头像 / 一句 / 时间 `--ink-3`） | 删 🔐 emoji + 36px 按钮 → `KgEmptyState`（Lucide `lock`，登录 lg） | T2 | KgCard, KgEmptyState | → discuss(qid) |
| `social/plaza` 讨论广场 `#21` | 看全站热议 | 热议条目卡（题干摘要 + 模块 tag + 热度） | 增 空态 CTA「去刷题」（现无出口） | T2 | KgCard, KgTag, KgEmptyState | → discuss |
| `social/favorites` 收藏与笔记 `#22` | 找收藏的题/笔记 | `wd-segmented`（收藏/笔记）→ 收藏夹 cell → 模块 `KgChipRow` → 条目 | 删 未登录时假可用的收藏夹 + chip → 先 `KgEmptyState`；第三套 chip 样式 → KgChipRow | T1 | wd-segmented, wd-cell, KgChipRow, KgQuestionCard(只读), KgEmptyState | → practice(qid), login |
| `social/poster` 打卡海报 `#23` | 保存打卡海报 | 海报预览（canvas）→ `保存图片` lg block | 删 0 天可生成 → 0 天 disabled + 说明「打卡 1 天后可生成」；导航栏深色纯黑 → theme | T5 | KgButton, KgStreakBadges(海报内) | ← calendar, profile, report |
| `interview/interview` AI 面试陪练 `#24` | 抽一题练面试 | `KgHeroCard brand`（已练 N）→ 5 分类 wd-cell（共 N · 已练 M）→ `随机抽一题` lg | 删 私有 `.hero`（4 份之一） | T1 | KgHeroCard, wd-cell, KgButton | → 面试作答（本页态）、history |
| `interview/history` 面试记录 `#25` | 看面试记录 | `KgStatRow`（0 数据隐藏）→ 记录卡列表 | 删 0 数据时的 3 个「—」 | T2 | KgStatRow, KgCard, KgEmptyState | → interview |
| `team/team` 刷题小队 `#26` | 建队/入队；看队内榜 | 无队：`KgHeroCard brand` + `创建小队` lg + `KgInviteInput`；有队：成员打卡榜 + 催学 | 删 与 join 重复的输入区实现 → 共用 `KgInviteInput` | T1 | KgHeroCard, KgInviteInput, KgCard, KgStreakBadges, KgButton, KgSheet | → join(分享)、share-q |
| `settings/reminders` 学习提醒 `#30` | 开/关提醒 | 2 个 wd-switch cell + 时间 cell（`wd-datetime-picker`）→ 预览 → 说明 | 修 wd-switch 深色（foundation 的 `--wot-switch-*`），本页只去裸值 | T5 | wd-cell, wd-switch, wd-datetime-picker | ← profile |
| `stats/mastery-map` 掌握度地图 `#31` | 看考点掌握度 | 解锁前：`KgEmptyState compact` + `KgProgress`（修 `.cold-bar` 漏网）；解锁后：`wd-segmented`（视图）→ 考点网格/列表（`KgTag module` + `KgProgress` 8px） | 整页 339 行 style 重写到 token（本页几乎无 var()） | T2 | wd-segmented, KgProgress, KgTag, KgCard, KgEmptyState | → practice(tag3) |
| `stats/practice-history` 练习历史 `#32` | 回看练过的题 | 日期分组 → 会话卡（模块 tag · N 题 · 正确率 `.num` · 时间） | 空态 → `KgEmptyState` | T2 | KgCard, KgTag, KgEmptyState | → practice(重练) |

---

## 4. 小程序逐页架构（14 页，组 `miniapp`）

Tab：首页 / 错题本 / 模考 / 统计 / 我的（与 H5 不同：无「AI 问答」Tab，模考占 Tab 位；**保留此差异**，小程序不做拍题问答，open question #5）。所有页统一：`navbar` 组件（现有）、`page` 底 `--bg`、内容 padding `--page-x 16`、TDesign 组件按 COMPONENTS §0 使用、`t-empty/t-skeleton` 替代 emoji 与自绘。

| 页 | 任务 | 首屏必含 | 留 / 删 / 增 | 模板 | 组件（kg-* = 小程序自研薄组件，t-* = TDesign） |
|---|---|---|---|---|---|
| `home` (Tab) | 开始今天的题 | `kg-hero-card`（今日已练 N/goal + 继续 1 按钮 + 连签）→ 今日任务 3 行 → 五模块 `kg-module-card` | 结构已是 v3 IA（`research/03` §7：比 H5 首页更对），**只做 token 化**：16 个裸色 → var、`.hero` 渐变 → `--brand-grad`、题型 sheet → `t-popup` | T1 | kg-hero-card, kg-module-card, kg-section-header, kg-streak-badges, t-popup |
| `book` (Tab) | 复习错题 | `kg-stat-row`（待复习 N · 预计 M 分）→ chips → 错题卡 | 留 三态（本页最全）；删 `m-op` 7 平铺 → `t-popup` 分组菜单；chips → `kg-chip-row` | T1 | kg-stat-row, kg-chip-row, kg-card, t-tag, t-empty, t-skeleton, t-popup, kg-action-bar |
| `exam` (Tab 模考) | 选卷开考 | 迷你模考 `kg-card raised` + 1 按钮 → `kg-stat-row` ×3 → `kg-paper-card` 列表（分页） | 删 📄/📶 emoji 空态/错误态 → `t-empty` + `l-icon`；「二期上线」文案保留但用 `t-empty` | T2 | kg-paper-card, kg-stat-row, t-empty, t-skeleton, t-button |
| `exam/mini` | 答 30 题 | topbar（计时 `.num` · 标记 icon）→ `kg-progress` 4px → `kg-question-card` → `kg-option-group` → `kg-action-bar answer` | 与 H5 exam 同构；答题卡 sheet → `t-popup` | T3 | kg-question-card, kg-option-group, kg-action-bar, kg-progress, t-popup |
| `exam/report` | 看报告 | `kg-hero-card brand`（分数）+ 4 `hstat` → `kg-stat-row` → 薄弱考点 / 模块得分 / 逐题 | 增 百分位（同 H5，数据 `[待核]`） | T4 | kg-hero-card, kg-stat-row, kg-report-section, kg-action-bar(actions), t-progress |
| `stats` (Tab) | 看统计 | `kg-stat-row` ×3 → 热力图 → 弱项提示 | 增 0 数据折叠为一张解锁卡（同 H5） | T1 | kg-stat-row, kg-hero-card(plain), kg-section-header, t-empty |
| `profile` (Tab) | 设置/记录 | 用户卡（`t-button` ×2）→ 3 数字 → `t-cell-group` ×N | 自绘 `us-cell` → `t-cell`；`u-btn` → `t-button` | T1 | t-cell, t-cell-group, t-button, kg-stat-row, kg-streak-badges |
| `practice` | 做题 | `p-head`（idx/计时/✓✗/字号）→ `kg-question-card`（**增 meta 行**）→ `kg-option-group` → `kg-analysis-card` → `kg-action-bar answer` | 增 解析区「全站数据 / 考点 / 来源」三行（H5 有，小程序缺，`research/03` §7）；`share-op` → `kg-action-bar actions` | T3 | kg-question-card, kg-option-group, kg-analysis-card, kg-action-bar |
| `login` | 登录 | `t-input` ×2 + `t-button`（现状，唯一用 TDesign 的页） | 保留；按钮尺寸/圆角随 `--td-*` 映射（COMPONENTS §0 决策：全站扩到 TDesign，本页不再是孤例） | T5 | t-input, t-button |
| `team` | 建队/入队 | `t-empty`（无队说明 + 建队按钮）+ 邀请码 `t-popup` | 一致，token 化 | T1 | t-empty, t-button, t-popup, kg-invite-input |
| `team/panel` | 看队内打卡 | `week-head` → 成员榜 → 催学按钮 | **增 empty**（队内无人/本周无打卡，`research/03` §7 缺） | T1 | kg-card, kg-stat-row, t-empty, t-button |
| `share/share` | 打开分享题 | 题卡 → 解析 → CTA | 三态齐；token 化，题卡换 `kg-question-card readonly` | T3(只读) | kg-question-card, kg-option-group, kg-analysis-card, kg-action-bar |
| `share/pk-result` | 看 PK 结果 | 双方比分 `kg-hero-card` + 皇冠 → 逐题 | **增 empty**（对局未结束/无效） | T4 | kg-hero-card, kg-report-section, t-empty, kg-action-bar |
| `social/poster` | 保存海报 | canvas 预览 → 保存 `t-button` | 0 天 disabled（同 H5） | T5 | t-button |

小程序单位：字号/间距/圆角全部 px（SPEC §4.1 取舍，open question #5）；深色只靠 `tokens.generated.wxss` 的 `prefers-color-scheme` 块，页面 wxss 不写 `@media dark`。验收：微信开发者工具深色模式实测 home / profile / book / exam / panel（`research/03` §7 列为待验证的 5 页，裸 hex 分别 16/8/7/7/7 处）。

---

## 5. 四个实施组：文件清单与「必须做 / 不要碰」

### 5.0 共享规则（四组都适用）

**foundation 先行**（一个会话，SPEC §7 F1–F6）产出：`tools/design-tokens/*`、生成文件、`uni.scss`/`App.vue`/`app.wxss` 接线、`frontend-uni/src/components/kg-*/`、`l-icon` 改造、`module-meta.js/.ts`、`miniapp-native/miniprogram/components/{kg-*,l-icon}/`、`toast.js`/`utils/toast.ts`、`KgTwoCol`、stylelint/lint-pages。**四组在 foundation 合入 main 之后才开工**，各自从 main 切分支。

所有页面组**不要碰**（只允许 foundation 修改；页面组若发现缺口，在自己分支的 PR 描述里列「需要 foundation 补」，不自行改）：
```
frontend-uni/src/uni.scss
frontend-uni/src/App.vue
frontend-uni/src/styles/**            （生成文件）
frontend-uni/src/components/**        （含 l-icon、predict-card、rank-card、q-social-bar、export-confirm、kg-*）
frontend-uni/src/module-meta.js
frontend-uni/src/toast.js
frontend-uni/src/pages.json           （tabBar / easycom；页面组不新增页面）
frontend-uni/package.json、frontend-uni/.stylelintrc
miniapp-native/miniprogram/app.wxss
miniapp-native/miniprogram/app.json
miniapp-native/miniprogram/styles/**
miniapp-native/miniprogram/components/**   （navbar、custom-tab-bar 除外——见 miniapp 组）
miniapp-native/miniprogram/utils/module-meta.ts、utils/toast.ts
miniapp-native/package.json
tools/**
backend/**                            （`avg_secs` 等接口需求另开后端任务）
docs/design-system/**                 （改规范走独立 PR）
```

所有页面组**必须做**：
1. 本组页面 `<style>`/`.wxss` 裸 `#hex/rgb/rgba` → 0；`font-size` rpx → `--fs-*`；`font-weight 700/800/bold` → 600；圆角/间距/阴影 → token；`word-break: break-all` → 0。验收：`lint-pages.mjs`（或 stylelint）对本组文件 0 error。
2. 本组页面的空态全部换 `KgEmptyState`/`t-empty`，CTA 指向存在的页面。
3. 本组页面按第 3/4 节的「留/删/增」执行；业务逻辑（接口、埋点、路由参数、localStorage 键）**不改**，除非清单里明确写了。
4. 每页 375 × 1440 × 浅/深 四组截图（复用 `research/03` 附录 A 探针脚本），附在 PR。
5. 本地验收：H5 `npm ci && npm run lint && npx vitest run && npm run build:h5`（Node 22）；小程序 `cd miniapp-native && npm ci && npx tsc --noEmit -p . && npx eslint miniprogram`。不跑 CI（本组织 Actions 禁用）。
6. 不引入新依赖、不新建 `components/` 下的组件；页面私有的小块可放页面同目录（`pages/home/home-*.vue`）但不得被其他组页面引用。

### 5.1 组 `h5-tab-pages`
文件（只读+写）：
```
frontend-uni/src/pages/home/home.vue
frontend-uni/src/pages/book/book.vue
frontend-uni/src/pages/ask/ask.vue
frontend-uni/src/pages/stats/stats.vue
frontend-uni/src/pages/profile/profile.vue
frontend-uni/src/pages/stats/calendar.vue
frontend-uni/src/pages/team/join.vue
（以及这些页面同目录下的私有辅助文件，若有）
```
必须做（除 5.0 外）：首页首屏减法（§3.1 home：hero 1 CTA、三计划合一、9→4 格、双进度合一）；book 首屏数字行 + 双 CTA 空态；ask 删占位按钮 + 桌面首屏改粘贴/上传 + 会话列表入口；stats 0 数据折叠 + 迁出两 cell；profile 徽章折一行 + 删三功能入口 + 收两 cell + 「模考记录」改名；calendar CTA 统一；join 标题修复。
不要碰：`pages/practice/**`、`pkgA/**`、5.0 清单。`home.vue` 内 `COLORS` 表删除并改引 `module-meta.js`（foundation 已建）。

### 5.2 组 `h5-practice-exam`
文件：
```
frontend-uni/src/pages/practice/practice.vue
frontend-uni/src/pkgA/exam/list.vue
frontend-uni/src/pkgA/exam/exam.vue
frontend-uni/src/pkgA/exam/report.vue
frontend-uni/src/pkgA/exam/contest.vue
frontend-uni/src/pkgA/exam/contest-report.vue
frontend-uni/src/pkgA/share/share-q.vue
frontend-uni/src/pkgA/share/pk-result.vue
frontend-uni/src/pkgA/pk/pk.vue
frontend-uni/src/*.js 中仅限：exam-*.js、practice-*.js、q-stat.js、font-size.js、quit-summary.js、review-*.js、leadq.js、material.js（只允许为接入组件做最小改动，不改口径）
```
必须做：practice/exam 共用 `KgActionBar answer`（标记/排除图标一致）；practice 题面 meta 行 + 解析折叠 + 平均用时（有 `avg_secs` 才显示）；exam/list 分页 + 单主按钮 + 菜单；exam 进度槽/标题修复；report 空态 CTA 修正 + 百分位/雷达；pk 徽章 token；`practice.vue` `COLORS` 删除改引 `module-meta.js`。作答核心逻辑（自动跳题、排除、键盘、进度保存、离线队列、埋点事件名）**不改行为**，回归用 `.agents/skills/testing-kaogong-assistant/SKILL.md` 里 R379–R380 的断言。
不要碰：`pages/` 其他页、`pkgA/` 其他目录、5.0 清单、`backend/`。

### 5.3 组 `h5-pkgA-rest`
文件：
```
frontend-uni/src/pkgA/shenlun/shenlun.vue
frontend-uni/src/pkgA/user/login.vue
frontend-uni/src/pkgA/user/offline.vue
frontend-uni/src/pkgA/stats/weekly-report.vue
frontend-uni/src/pkgA/stats/mastery-map.vue
frontend-uni/src/pkgA/stats/practice-history.vue
frontend-uni/src/pkgA/search/search.vue
frontend-uni/src/pkgA/social/discuss.vue
frontend-uni/src/pkgA/social/inbox.vue
frontend-uni/src/pkgA/social/plaza.vue
frontend-uni/src/pkgA/social/favorites.vue
frontend-uni/src/pkgA/social/poster.vue
frontend-uni/src/pkgA/interview/interview.vue
frontend-uni/src/pkgA/interview/history.vue
frontend-uni/src/pkgA/team/team.vue
frontend-uni/src/pkgA/settings/reminders.vue
frontend-uni/src/*.js 中仅限：shenlun-*.js、search-url.js、favorites-url.js、mastery-url.js、weak-spots.js、checkin.js、reminder.js（同上，最小改动）
```
必须做：§3.3 表逐页；`mastery-map.vue` 整页 style 重写（339 行、3 处 var）；discuss/favorites 的 `COLORS` 删除改引 `module-meta.js`；shenlun 分页；search 最近搜索；plaza 空态 CTA；poster 0 天禁用；team 接 `KgInviteInput`。
不要碰：`pkgA/exam/**`、`pkgA/share/**`、`pkgA/pk/**`、`pages/**`、5.0 清单。

### 5.4 组 `miniapp`
文件：
```
miniapp-native/miniprogram/pages/**            （14 页的 .wxml/.wxss/.ts/.json）
miniapp-native/miniprogram/components/navbar/**        （仅 token 化，不改 props）
miniapp-native/miniprogram/custom-tab-bar/**           （token 化 + safeArea 让位）
miniapp-native/miniprogram/utils/*.ts（除 module-meta.ts / toast.ts）
```
必须做：14 页 §4 表逐页；页面 `.json` 按需声明 `t-*` 与 `kg-*`（`usingComponents` 是页面文件，允许改）；全部 rpx 字号/间距 → px token；emoji 图标 → `l-icon`；`team/panel`、`share/pk-result` 补 empty；practice 解析补三行 meta；home/exam/book 的 sheet → `t-popup`；开发者工具深色实测 5 页并附截图。
不要碰：`app.wxss`、`app.json`（Tab、darkmode、renderer 不变）、`styles/**`、`components/kg-*/`、`components/l-icon/`、`utils/module-meta.ts`、`utils/toast.ts`、`package.json`、`project.config.json`、`frontend-uni/**`。**不切 Skyline**（`renderer: webview` 保持）。

### 5.5 冲突面检查
四组文件集合两两无交集（已按路径核对：`pages/practice` 归 practice-exam 而不归 tab-pages；`pkgA/share`、`pkgA/pk` 归 practice-exam；`pkgA/team/team` 归 rest 而 `pages/team/join` 归 tab-pages——两页共用的输入组件 `KgInviteInput` 因此必须由 foundation 提供，不能由任一组自建）。`frontend-uni/src/*.js` 工具文件按前缀切分，如有一个 js 被两组同时需要（例如 `checkin.js` 被 home 与 poster 都用），**只读引用不算冲突**，改动权归上表所列组，另一组在 PR 中提需求。

---

## 6. 取舍一览
| 决策 | 选 | 不选 | 理由 |
|---|---|---|---|
| 页面模板数 | 5 | 按页各设计 / 3 个 | 3 个装不下「作答」与「表单」的固定底栏/单列差异；>5 就是没有模板 |
| 首页零作答首屏 | 一句 + 1 CTA + 模块列表 | 四卖点营销 hero | `[生产]` 4 个同义入口、2,484px；小程序首页（无营销 hero）反而更对 |
| 桌面双栏 | 640–720 + 320，T5 不双栏 | 全页双栏 / 保持单列 | 题干阅读宽 ≤760；表单页双栏无内容可放 |
| 辅栏内容 | 本页第二优先级信息 | 新功能/推荐 | 双栏是重排不是加功能，避免页面组各自造数据请求 |
| 卷库 | 分页 20 + 单主按钮 | 虚拟列表 | 虚拟列表在 uni-app H5 需引组件（增实体）；分页 20 已在 R383 分支验证过可行 |
| 小程序 Tab | 保留「模考」Tab（与 H5 不同） | 对齐 H5 五 Tab | 小程序无拍题问答能力；模考在小程序是主场景 |
| 页面组与 foundation 分工 | foundation 独占共享文件、页面组只改自己的页面 | 各组按需改共享文件 | 四组并行改 `App.vue`/`app.wxss` 必冲突 |
| 团队邀请输入 | foundation 建 `KgInviteInput` | tab-pages 或 rest 组自建 | 跨两组共用 |
| `frontend-uni/src/*.js` 工具 | 按前缀划归组，只允许最小接入改动 | 全部锁定 | 全锁会让 practice 组无法接 `KgActionBar` |

## 7. Open questions（不阻塞，默认按「选」执行）
1. 首页零作答用户是否完全去掉营销四卖点卡（默认去，保留一句 + 1 CTA；若增长侧要 A/B，保留 `showLanding` 开关）。
2. profile 删除「AI 面试陪练 / 答题 PK / 刷题小队」三入口、只留首页更多练习一处（默认删；或反过来）。
3. 报告页加「击败 N%」/ 雷达 是否本轮做（默认做，数据已有；`rank-card` 百分位口径 `[待核]`）。
4. `avg_secs` 后端是否本轮提供（默认不阻塞：无字段则隐藏）。
5. 小程序保留「模考」Tab 不做 AI 问答（默认保留差异）。
6. exam/list 分页 20 vs 按年份折叠（默认分页 20）。
7. ask 页桌面端是否完全隐藏取景框（默认隐藏，改上传/粘贴）。

## 附录 · 证据
- 页面清单：`frontend-uni/src/pages.json`（本轮读取：8 + 24 页，tabBar 5 项）、`miniapp-native/miniprogram/app.json`（14 页，tabBar 首页/错题本/模考/统计/我的）。
- 逐页现状：`research/03-our-pages-audit.md` §2 表（32 行，`[生产]` 截图 `shots/*.jpg` 在该分支）与 §7 表（14 行，`[代码]`）。
- 桌面壳现状：`frontend-uni/src/App.vue` L228–360（700/768/1280/1366 断点、208px 侧栏、1140/1280 壳宽）；页面内双栏 `@media (min-width: 1024px)` 24 处（`research/04` §3.1）。
- 竞品 IA：`research/01-competitor-frontend.md` §借鉴 #8–#10（Khan 底部固定操作栏、华图 4 卡入口、粉笔卷列表行）；`docs/design-benchmark/report.md` §2（题面 meta、报告排名）。
- v3 IA：`docs/design-v3/DESIGN.md` §2（五 Tab 树，本文沿用并按生产路径落实）。
