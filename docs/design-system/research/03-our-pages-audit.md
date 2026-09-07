# 03 · 我们自己的页面：全页面信息架构与内容审计（W5）

> 生产实查日期 2026-09-06（UTC 00:00–00:40）。生产 `GET /api/health` 返回 `{"ok":true,"rev":"50f6f26"}`，本轮所有截图/DOM 探针都取自这个 rev。
> 仓库代码口径 = `origin/main` @ `bcf4662`（Merge #601）。

## 0. 先说清楚：哪些是"看到的"，哪些是"读到的"

这份报告刻意把三类证据分开写，避免"有代码 = 验证过"：

| 标记 | 含义 | 本轮怎么拿到 |
|---|---|---|
| **[生产]** | 在 https://kaogong.zalize.com 上真实打开、截图、读 DOM/computed style 得到 | Playwright(Chromium 151) 逐页 `goto` hash 路由 → `reload` → 等 networkidle 2.5 s → 全页截图 + 探针脚本 |
| **[代码]** | 仓库源码里存在，但本轮未在生产触发（多数是登录后 / 带参数 / 作答后才出现的分支） | `frontend-uni/src/**`、`miniapp-native/miniprogram/**` 静态阅读 + 正则扫描 |
| **[文档]** | 既有研究结论，直接引用不重做 | `docs/design-benchmark/report.md`、`docs/design-v3/DESIGN.md`、`docs/design/miniapp-v2/tokens.md`、handoff R383 |

生产探针的身份是**匿名未登录**（`localStorage.anonUid = test-w5-audit-h5`，未作答、未登录）。所以报告里凡是"空态"，是**这个身份**看到的真实首屏，不代表老用户看到的首屏；凡是登录后/作答后的内容，只按代码写并标 **[代码]**。

小程序 14 页**没有模拟器登录态**，全部按 `pages/*/*.wxml|wxss|ts` 结构审计，标 **[代码]**。

- 每页 4 张截图：`shots/<slug>--{375,1440}-{light,dark}.jpg`，共 128 张，全部 ≤ 200 KB（最大 199 312 B，1440 宽按 0.6 缩放 + JPEG 渐进压缩，375 宽原尺寸）。
- 探针脚本 & 原始 JSON：`shoot.py` / `probe-*.json`（未入库，写法见附录 A）。
- 关于 R383：任务描述说 R383 节在 `docs/handoff-context.md` 末尾，但 `origin/main` 的 handoff 目前止于 R382；R383 内容在远端分支 `origin/devin/1788633425-ui-type-scale` 上。本文引用的"30 种字号 / 36 种圆角 / 131 种色值"来自该分支，不冒充 main。

---

## 1. 全站一眼看

**[生产]** 32 页 × 4 组合 = 128 次加载，0 页面 JS 报错、0 个 ≥400 的 API 响应（探针把 `page.on('pageerror')`、`console.error`、所有 `/api/*` 响应状态都记了）。这一点很好，本文后面挑的全是设计/IA 问题，不是坏页。

**[生产]** 但把 32 页首屏并排看，会立刻看到三件事：

1. **首页在做全站的活**。`pages/home/home` 375 宽下页面高 2 484 px、DOM 节点 363 个，一屏里挤了：品牌 hero（"免费刷 10万+ 行测题"，4 个卖点小卡 + 2 个按钮）、今日目标卡、今日任务 3 行、"制定我的学习计划"卡、品牌升级公告条、时政每日一练卡、5 模块专项练习列表、随机练、更多练习（模考/申论/PK/面试…）。错题本 / 统计 / 我的 三个 Tab 的首屏则都以"未登录 + 0 数据"开场（`book` 813 px、`stats` 1 337 px）。信息密度在 Tab 之间失衡。
2. **13 个页面首屏是"链接缺参数 / 请登录 / 还没有数据"的空态**（exam-report、contest-report、weekly-report、discuss、inbox、plaza、favorites、share-q、pk-result、mastery-map、practice-history、interview-history、book）。这些空态是对的（未登录理应如此），但它们长得**每页都不一样**——见 §4 Top 20 第 1 条。
3. **深色模式整体是切过去的，但有 6 处硬编码漏网**（首页模块图标底色、掌握度地图进度槽、PK 榜前三名徽章、学习提醒 wd-switch、迷你模考顶部进度条、练习页真题 tag）。全部有 computed style 证据，见 §4 第 5–8 条。

1440 宽 **[生产]**：Tab 页有左侧竖向 Tab 栏 + 居中内容列（≈ 960 px），子页无侧栏、内容居中；练习页在 1440 下有右侧"答题卡 + 键盘快捷键"双栏（`practice--1440-light.jpg`），这是全站唯一一个真正利用了宽屏的页面，其余都是"手机页放中间"。探针 `scrollWidth` 1425 vs `clientWidth` 1425 → 无横向溢出（1425 = 1440 − 15 px 滚动条）。

---

## 2. 逐页审计表（H5 32 页）

列说明：**用户任务**= 用户来这页要完成什么；**现有内容**= 本轮匿名身份 **[生产]** 首屏实际看到的 + 关键 **[代码]** 分支；**问题**= IA/内容/一致性/状态/深色；**建议**= 内容与功能清单；**P0** 影响主流程或明显 bug 级，**P1** 一致性/可用性，**P2** 锦上添花。

| # | 路径 | 用户任务 | 现有内容（首屏 → 下滑） | 问题 | 建议内容 & 功能清单 | 优先级 |
|---|---|---|---|---|---|---|
| 1 | `pages/home/home` (Tab 刷题) | 立刻开始今天该做的题 | **[生产]** 品牌 hero（4 卖点卡 + "免注册立即开练/浏览题库"）→ 今日已练 0/20 + 继续目标/今日计划 → 今日任务 1/3（刷题/错题复习/打卡）→ 制定学习计划卡 → 品牌升级公告 → 时政每日一练 → 5 模块列表（进度条）→ 随机练 → 更多练习 9 宫格。高 2 484 px，363 节点 | ① 首屏被营销 hero 占掉 ~40%。**[代码]** `showLanding` 在有作答日或点过 ✕ 后隐藏（`home.vue:558`），所以只有零作答用户看到——但对这个用户，hero 的 `免注册立即开练` 与下方 `继续目标`、模块列表是同一动作的三个入口，且 hero 下面仍然铺满了给回访用户的今日目标/任务/计划卡；② 三个"计划"入口（今日计划 / 制定我的学习计划 / 学习计划与报考画像）语义重叠；③ "今日任务 1/3"进度和"今日已练 0/20"两套进度并列；④ 顶部"选择考试 ▾ + 搜索"与 hero 抢首屏；⑤ 深色：5 个 `.mod-ico` 内联 `#e8effe/#fbf1e0/#f1eafd/#fce8ec/#e6f5f3` 浅底漏网（computed `rgb(232,239,254)` 等，见 `home--375-dark.jpg`）；⑥ 模块色表 `COLORS` 与 practice/discuss/favorites 三页各自维护、且首页那份色值与其他三页不同（`#e8effe/#2e5bff` vs `#DBEAFE/#1D4ED8`） | 零作答用户：只留 hero（1 个 CTA）+ 模块列表，今日目标/任务/计划卡等有记录再出现；有记录用户：首屏 = **[今日目标 + 续练 CTA]** 单主卡；三个计划入口合并为一个"学习计划"卡（未制定→去制定，已制定→今日任务）；模块列表保留但收成 chip 行或 2 列网格；`COLORS` 抽到 `src/module-meta.js` 单一来源并给深色配对 | P0 |
| 2 | `pages/book/book` (Tab 错题本) | 看今天该复习哪些错题并开始 | **[生产]** 空态："错题本还是空的 / 去拍题讲解或刷题… / 去刷题"按钮 + 右下 "＋" 浮钮。**[代码]** 有数据时：待复习 banner、按模块/考点分组、筛选 chip、`redo` 重练、pid 筛选、批量操作 sheet（`.m-op`×7）、笔记 | ① 空态 CTA `去刷题` 是 44 px / 9 px 圆角 / 14 px 字，和其他页的空态 CTA（`999rpx` 胶囊）不一致；② 浮钮 "＋" 无文字说明（**[代码]** `book.vue:512` 点开是「拍题录入 / 手动录题」两项，但空态文案没有提到它）；③ **[代码]** book.vue 45 个色值、17 个字号、16 个圆角，是全站第二大样式源，其中 16 个色值只在本页出现（`#0f766e #12b76a #2a7a2a #3aa53a #c33 #ccfbf1 …`）——错题状态色（已掌握/待复习/仍错）没有走 `--ok/--warn/--bad` token | 空态加"拍题录入"和"去刷题"双 CTA 并解释浮钮；错题状态色收敛到 3 个语义 token；首屏加"今日待复习 N · 预计 M 分钟"数字（**[文档]** 竞品错题本首屏都有数量） | P1 |
| 3 | `pages/ask/ask` (Tab AI 问答) | 拍一道题让 AI 讲 | **[生产]** 标题区"AI 问答 · 花生十三方法体系"+ 历史/错题两个圆钮 → 相机取景框（"将题目放入框内拍下"）→ 拍单题 / 整页批改(即将上线) / 文字输入 / 相册 / 面试 快捷钮 → 底部输入条"先拍题或粘贴题目开始 / 发送"。**[代码]** 会话列表、prefill、深讲 | ① "整页批改 · 即将上线"是占位噱头，占了一个主按钮位；② "面试"快捷入口与 `pkgA/interview` 页重复；③ 桌面 1440 下取景框是个空黑框（无摄像头），应退化为上传/粘贴优先；④ 深色：`.cam-quick` 用 `rgba(255,255,255,.1)` 是刻意的半透明，OK；⑤ 本页 14 个圆角值，4 个只在本页出现（`0 0 0 8rpx` 之类取景角） | 去掉"即将上线"钮或改成灰 chip 说明；桌面端首屏改"粘贴题目/上传图片"；把"历史"改成可见的会话列表入口 | P1 |
| 4 | `pages/stats/stats` (Tab 统计) | 知道我学得怎样、哪里弱 | **[生产]** 登录提示条 → 学习统计 3 数字（0/0%/0）→ 能力预测分"数据积累中 0/30" → 热力图 12 周（全灰）→ 五模块雷达空态 + 去刷题 → 错题模块分布 暂无 → 高频错题型 TOP10 暂无 → 掌握度地图入口 → 学习计划 / AI 学习教练 / 成就勋章 0/8 / 数据备份 4 个 cell。高 1 337 px | ① 0 数据时仍把 6 个空模块全部铺开，首屏没有一个可以点的正向动作（第一个 CTA `去刷题` 在 800 px 以下，且只有 33 px 高、13 px 字——不达 v3 44 px 规范）；② 登录提示 `登录/注册 ›` 是 17 px 高的文字链，跟"我的"页 44 px 胶囊按钮不一致；③ "AI 学习教练"、"数据备份与迁移"是设置类入口，放统计页尾巴不合逻辑；④ **[代码]** 18 个字号（全站最多）| 0 数据时折叠成 1 个"解锁统计需再答 N 题"进度卡 + 主 CTA；空模块合并；把 AI 教练 / 备份挪到"我的" | P1 |
| 5 | `pages/profile/profile` (Tab 我的) | 找设置、找我的记录 | **[生产]** 未登录卡 + `登录 / 注册` 胶囊 → 3 数字 → 打卡徽章 6 格 → 学习(6 cell) → 偏好设置(7 cell) → 其他(4 cell) → 门户链接 → 版权。高 1 801 px | ① 结构是最清楚的一页（wd-cell 分组），但"打卡徽章"大块放在第二屏顶部，对未登录用户是 6 个锁；② "AI 面试陪练 / 答题 PK / 刷题小队"三个是功能入口不是"我的"，和首页"更多练习"重复；③ 深色良好（`profile--375-dark.jpg`） | 徽章块折叠成一行；功能入口只留一处（首页更多练习 or 这里），另一处删 | P2 |
| 6 | `pages/practice/practice` | 做题、看解析、纠错 | **[生产]** 顶栏 `言语理解 · 1/10 ▾  0:03 ✓0 ✗0 ☆ ··· 退出` → 真题 tag → 题干 → 4 选项 → (作答后) 解析区。1440 下双栏（答题卡+快捷键）。**[代码]** 作答后：正确答案、`全站数据`（难度★/全站正确率/人次/易错项，`attempt_count≥5` 才显示）、花生十三解析、第二名师视角、解析、考点链、来源、深讲 CTA、讨论/收藏条 | ① 顶栏 6 个操作用了 3 种按钮形态（chip、图标、纯文字 `退出`），`标记/收藏` 在这页是 ☆，在模考页是文字 `标记`；② 作答前看不到考点/难度——**[文档]** 竞品（粉笔）在题面就给难度与考点；③ 缺**平均用时**（代码只有本人 `用时 Ns / 目标` 且仅限限时模式）；④ 深色 1440 下 `.real-tag` `rgb(254,243,199)` 浅黄漏网（375 抽到的题无真题 tag 所以未复现）；⑤ 47 个色值（全站最多），对/错/警示色有 `#16a34a #15803d #22c55e #10b981 #059669` 五种"绿" | 题面顶部加"考点 · 难度★ · 全站正确率"一行 meta（数据已在接口里）；解析区加 `平均用时`（需后端 `avg_secs`）；顶栏统一为 icon-button 一种形态；对错色收敛到 `--ok/--bad` | P0 |
| 7 | `pages/stats/calendar` | 看打卡、补打卡海报 | **[生产]** 月历（今天描边）+ 图例 → 连签里程碑 + 6 徽章 → `生成打卡海报`（36 px 高、9 px 圆角） | ① 徽章 6 格在本页、"我的"页、（代码里）海报页三处重复实现；② 深色：`本月打卡 0 天` 绿字 tag 对比不够（`calendar--375-dark.jpg`）；③ CTA 36 px 不达 44 | 徽章抽 `KgStreakBadges`；CTA 用统一主按钮 | P2 |
| 8 | `pages/team/join` | 凭邀请码入队 | **[生产]** 蓝 hero 卡 + 输入框 + `加入小队` + 登录链接 | ① 页头标题直接用了 SEO `document.title`："队友邀请你加入刷题小队，一起打卡冲上岸 - 错题邦"，375 下被截成"队友邀请你加入刷题小队，一…"（`team-join--375-light.jpg`）；② 与 `pkgA/team/team` 页的"输入 6 位邀请码 / 加入"是同一功能两处实现 | 导航栏标题固定"加入小队"，`document.title` 只给分享；输入框+按钮复用 team 页组件 | P1 |
| 9 | `pkgA/shenlun/shenlun` | 找一道申论题练 | **[生产]** 3 Tab（真题题库/素材范文/作答记录）→ 4 筛选 chip（地区/年份/题型/收藏）+ 重置 → 题卡列表（题型 tag、年份卷 tag、题干、`20 分 · ≤200 字`、`去作答 ›`）。高 2 976 px | ① 题卡里的"去作答 ›"是纯文字链，卷库页同类动作是胶囊按钮；② 筛选 chip 样式（描边 + ▾）和卷库页的实心/描边 chip 不同；③ 列表无分页/懒加载（一次渲染 462 节点） | 统一 chip / 列表 CTA；分页 | P1 |
| 10 | `pkgA/user/login` | 登录 | **[生产]** Logo + 登录/注册切换 + 手机号 + 密码 + `登录`（46 px/9 px 圆角）+ `Zalize 统一账号一键登录` + 说明 | ① 主按钮 46 px / 9 px 圆角，全站其他主按钮 44 px 胶囊；② 深色良好 | 按钮走统一 token | P2 |
| 11 | `pkgA/user/offline` | 下载题包离线刷 | **[生产]** 存储占用条 → 5 模块题包 cell（彩色首字方块 + `下载` 文字链）→ 说明段 | ① 模块图标是"资/数/言/判/常"彩色首字方块，首页是 Lucide 图标 + 浅底——同一语义两套视觉；② `下载` 是 12 px 文字链，无进度态（**[代码]** 有 downloading 状态） | 模块图标复用 `KgModuleIcon`；下载改按钮 + 进度 | P2 |
| 12 | `pkgA/exam/list` | 挑一套卷开考 | **[生产]** 迷你模考横幅（`开始`）→ 已刷 0/120 卷进度 → 状态 chip（全部/没考过/考过）→ 年份 chip 行（横滑）→ 地区 chip 行（横滑，28 个）→ 120 张卷卡，每卡 3 个胶囊按钮（开始模考/按卷练习/导出 PDF）。**高 21 236 px、2 158 节点** | ① 120 卷全部渲染，无分页/虚拟列表，375 上要滑 26 屏；② 每卡 3 个等权按钮 = 360 个按钮，"导出 PDF"不该是一级动作；③ 两行横滑 chip 在 375 下看不出还能滑（无渐隐）；④ 深色良好 | 分页 20/页或按年份折叠；卡内主按钮 1 个 + `···` 收次动作；chip 行加右侧渐隐 | P0 |
| 13 | `pkgA/exam/exam?mini=1` | 答完 30 题交卷 | **[生产]** 顶栏（模块 tag + ⏱ 29:57 + `标记`）→ 进度条 1/30 → 题卡 → 底栏 `上一题 / 答题卡 / 下一题`（胶囊 44 px）。**[代码]** 答题卡 sheet、交卷确认 | ① 底部三键与练习页"自动跳题 + 顶栏退出"是两套作答交互（**[文档]** 竞品作答页统一为底部三键）；② `标记` 是文字按钮，练习页同义是 ☆ 图标；③ 深色：顶部进度条槽 `rgb(219,230,255)` 浅蓝漏网（`exam.vue:534` `.progress{background:#dbe6ff}`，`exam--375-dark.jpg`） | 练习页与模考页共用 `KgAnswerBar`；标记统一图标；进度槽走 `--line` | P1 |
| 14 | `pkgA/exam/report` | 看成绩、看弱项 | **[生产]** 无参数空态"暂无成绩报告 / 请从模考交卷或「模考记录」进入 / 去卷库"。**[代码]** 分数 hero、正确率/用时、模块得分、薄弱考点、逐题回顾、重考、错题入本 | ① 空态文案提到"模考记录"，但全站没有一个叫"模考记录"的页面（我的页有 cell "模考记录" → 实际跳卷库）；② **[代码]** 缺排名/百分位与雷达（**[文档]** 竞品模考报告标配） | 空态 CTA 指向真实页；加"击败 N%"与模块雷达（数据 `per_module` 已有） | P1 |
| 15 | `pkgA/exam/contest` | 报名/参加周赛 | **[生产]** 期次卡（未开始 tag、赛卷、时间、倒计时、`预约报名`）→ 往期 4 场（未参加 · 看榜单 ›）→ 赛制说明折叠 | ① 4 场"往期"日期 09-05/09-05/08-15/08-08 且都"未参加"，对新用户是空信息；② 深色良好 | 往期折叠到 1 行；首屏留"本期"即可 | P2 |
| 16 | `pkgA/exam/contest-report` | 看大赛成绩 | **[生产]** 空态"链接缺少赛事参数 / 去模考大赛" | 与 #14 同款空态但文案模板不同（"暂无成绩报告"vs"暂无大赛报告"） | 共用 `KgEmptyState` | P2 |
| 17 | `pkgA/stats/weekly-report` | 看上周周报 | **[生产]** 空态"上周没有学习记录 / 2026-08-24 ~ 2026-08-30 / 去刷题 ›"（文字链） | 空态 CTA 是文字链，其他页是按钮 | 共用 `KgEmptyState` | P2 |
| 18 | `pkgA/search/search` | 搜题/考点/卷 | **[生产]** 输入框 + 取消 → 5 类 chip → 说明文字 | 无热搜/最近搜索，空态只有说明 | 加最近搜索、热门考点 | P2 |
| 19 | `pkgA/social/discuss` | 看这题的讨论 | **[生产]** 最热/最新 tab + "共 0 条讨论" + `消息` → 空态"链接缺少题目参数 / 去讨论广场"（33 px 按钮）→ 社区公约 | ① 无参数时仍渲染 tab 和"共 0 条"，空态之上有一层假 UI；② CTA 33 px | 无参数直接全屏空态 | P2 |
| 20 | `pkgA/social/inbox` | 看回复/点赞 | **[生产]** 🔐 emoji + "登录后查看消息" + `去登录`（36 px/9 px） | emoji 图标 + 36 px 按钮，与其它空态不同 | 共用 `KgEmptyState`（icon 用 l-icon） | P2 |
| 21 | `pkgA/social/plaza` | 看全站热议 | **[生产]** 💬 emoji + "还没有讨论"+ 说明，**无 CTA** | 空态没有出口 | 加"去刷题" | P2 |
| 22 | `pkgA/social/favorites` | 找收藏的题 / 笔记 | **[生产]** 收藏题目/我的笔记 segmented → 默认收藏夹 cell + 新建收藏夹 → 7 模块 chip → 空态卡 | ① 未登录仍展示收藏夹 + 模块筛选 chip（假可用）；② 模块 chip 第三套样式（实心蓝 + 灰底）| 未登录/0 数据先空态 | P2 |
| 23 | `pkgA/social/poster` | 保存打卡海报 | **[生产]** 海报卡（连续打卡 第 0 天 + 4 数字 + 二维码）+ `保存图片`（36 px）| ① 0 天海报也能生成，分享出去是"第 0 天"；② 深色导航栏是纯黑与页面 `#15161c` 不一致（`poster--375-dark.jpg`） | 0 天时引导去打卡；导航栏颜色走 theme | P2 |
| 24 | `pkgA/interview/interview` | 抽一题练面试 | **[生产]** 蓝 hero → 5 分类 cell（共 N 题 · 已练 0）→ `随机抽一题` → 练习记录 › | 结构清楚；hero 与 team/pk/join 页是同一套蓝渐变 hero 但各自实现（`.hero` 4 份） | 抽 `KgHeroCard` | P2 |
| 25 | `pkgA/interview/history` | 看面试记录 | **[生产]** 3 数字（0/—/—）+ 空态 + `去练一题` | 0 数据仍显示 3 个 "—" 统计 | 0 数据时隐藏统计 | P2 |
| 26 | `pkgA/team/team` | 建队/入队 | **[生产]** 蓝 hero + 空态说明 + `创建小队` + 邀请码输入/加入。**[代码]** 有队：成员打卡榜、催学 | 与 `pages/team/join` 重复输入区 | 合并 | P2 |
| 27 | `pkgA/share/share-q` | 打开队友分享的题 | **[生产]** 空态"分享链接无效 / …10万+ 题库仍可免费刷 / 去刷题" | 空态复用问题 | `KgEmptyState` | P2 |
| 28 | `pkgA/share/pk-result` | 看 PK 结果 | **[生产]** 空态"战绩链接无效 / 发起我的 PK 对局" | 同上 | `KgEmptyState` | P2 |
| 29 | `pkgA/pk/pk` | 发起/应战 PK | **[生产]** 蓝 hero → 6 模块 chip → `发起好友挑战` / `随机匹配对手` → 挑战码输入 + `应战` → 本周胜场榜 3 人 → 我的对局 空 | ① 深色：榜单 r1/r2/r3 徽章 `#fef3c7/#e5e7eb/#fde8d7` 硬编码浅底（`pk--375-dark.jpg`）；② 模块 chip 第四套样式（描边胶囊 + 实心选中） | 徽章色走 token；chip 统一 | P1 |
| 30 | `pkgA/settings/reminders` | 开/关提醒 | **[生产]** 2 个 wd-switch cell + 时间 cell → 提醒样式预览 → 说明。 | ① 深色：`wd-switch` 关闭态轨道 `rgb(234,234,234)` 浅灰、圆点纯白，wot 组件没有跟 `.theme-dark`（`reminders--375-dark.jpg`）；② 这是全站唯一用 wd-switch 的页面，其他开关（音效）在"我的"页是 cell 文字 | 给 wot 组件写 `.theme-dark` CSS 变量覆盖（`--wot-switch-*`）；开关语义统一用 wd-switch | P1 |
| 31 | `pkgA/stats/mastery-map` | 看考点掌握度 | **[生产]** 空态卡"再练 30 题解锁 / 进度槽 0/30 / 去刷题"（36 px 胶囊） | ① 深色：`.cold-bar` `rgb(238,241,247)` 白色进度槽横在深色卡上（`mastery-map--375-dark.jpg`）；② **[代码]** 本页 339 行 style 只有 3 处 `var()`，用了 `12px/14px` 绝对像素字号和 `8px/12px` 圆角（全站唯二 px 字号），基本游离在 token 体系外 | 整页样式重写到 token；进度槽复用 `KgProgress` | P1 |
| 32 | `pkgA/stats/practice-history` | 回看练过的题 | **[生产]** "还没有练习记录 / 去刷一组题" | 空态复用问题 | `KgEmptyState` | P2 |

---

## 3. 每页九问的补充（只写表里放不下的）

### 3.1 用户任务 vs 首屏层级
- **[生产]** 首页把"营销给陌生人"的 hero 放在"给回访用户的今日目标"之上。探针身份是零作答匿名用户，hero 出现合理（**[代码]** `showLanding` = 未 dismiss 且 `pstats.days` 为空，`home.vue:558`）。问题在于两套内容同时出现：hero 说"免注册立即开练"，紧接着的今日目标卡说"继续目标"、今日任务说"去刷题"、模块列表又是一排入口——零作答用户一屏内看到 4 个"开始刷题"。
- **[生产]** 统计页首屏 3 数字 + 能力预测分 + 热力图 全是 0/灰，第一个可点的正向 CTA 在 ≈800 px 处。
- **[生产]** 卷库页首屏 = 迷你模考横幅 + 进度 + 3 行筛选 chip，第一张卷卡在 ≈420 px 才出现，而它是页面的主体。

### 3.2 导航可达 / 会不会迷路
- **[生产]** 5 Tab（刷题/错题本/AI问答/统计/我的）与 **[文档]** v3 IA 一致。所有 pkgA 子页有返回箭头。
- **[生产]** 但有 3 类"死胡同"：① `plaza` 空态无 CTA；② `exam/report` 空态引导去"模考记录"，该页不存在，"我的 → 模考记录" 实际跳的是 `pkgA/exam/list`；③ `team/join` 导航标题被 SEO 长标题占用，用户看不出在哪。
- 同一功能多入口：面试（首页 9 宫格、AI 问答快捷钮、我的页 cell）、小队（首页、我的、join 页）、PK（首页、我的）。入口多不是问题，**每个入口的视觉重量一样**才是问题——用户分不清哪个是主路径。

### 3.3 核心 vs 噱头 vs 重复（全站视角）
- 核心闭环 **[文档 v3]**：刷题 → 错题本 → 复习 → 模考 → 报告。**[生产]** 这五步都在，且都能从首页 2 次点击内到达。
- 噱头/占位（建议降级或删）：AI 问答的"整页批改 · 即将上线"；首页"品牌升级公告"常驻条；面试陪练在 3 处露出；卷库每卡的"导出 PDF"一级按钮；0 天打卡海报。
- 重复实现（同语义不同实现）：模块色表 ×4；邀请码输入 ×2；蓝渐变 hero ×5（home landing / interview / team / join / pk）；徽章格 ×2（profile / calendar）；空态 ×16（§6）。

### 3.4 空态 / 加载 / 错误态
- **[生产]** 空态：13 页首屏即空态，全部有文案，**12/13 有 CTA**（plaza 没有）。
- **[生产]** 加载态：探针在 networkidle 后截图，未捕到 loading。**[代码]** H5 页面中 `loading` 骨架/spinner 的写法各异（`wd-loading`、自绘 `.spin`、纯文字"加载中…"），未统一；`exam/list` 120 卷一次渲染，无分页态。
- **[生产]** 错误态：0 个 ≥400 响应，未触发。**[代码]** `exam/list`、`book`、`exam` 有 `loadErr + 重试`，其余大多只 toast。小程序这块比 H5 规整（§7）。

### 3.5 深色模式硬编码漏网（**[生产]** computed style 逐条）
| 页面 | 元素 | 浅色值仍显示 | 源码位置 |
|---|---|---|---|
| home | `.mod-ico` ×5 | `rgb(232,239,254)` `rgb(251,241,224)` `rgb(241,234,253)` `rgb(252,232,236)` `rgb(230,245,243)` | `home.vue:497` `COLORS` 内联 `:style` |
| mastery-map | `.cold-bar` | `rgb(238,241,247)` | `mastery-map.vue:206` |
| pk | `.lb-rank.r1/.r2/.r3` | `rgb(254,243,199)` `rgb(229,231,235)` `rgb(253,232,215)` | `pk.vue:579-581` |
| reminders | `.wd-switch` / `__circle` | `rgb(234,234,234)` / `rgb(255,255,255)` | wot-design-uni 默认变量未随 `.theme-dark` 覆盖 |
| exam (迷你模考) | `.progress` 槽 | `rgb(219,230,255)` | `exam.vue:534` `#dbe6ff` |
| practice (1440) | `.real-tag` | `rgb(254,243,199)` | `practice.vue:2551` `#fef3c7` |

其余 26 页深色 **[生产]** 扫描（阈值：可见元素面积 > 400 px²、背景亮度 > 0.6、非 `.theme-dark` 内刻意的白字按钮）未发现漏网。首页 landing hero 内 `.ld-btn.main` 纯白按钮是设计意图（蓝底白钮），不算漏网。

---

## 4. 全站一致性问题 Top 20

按"影响面 × 修复成本低"排序，每条附证据。

1. **空态没有一个统一组件**。**[代码]** `.empty` 在 16 个页面各写一份；**[生产]** 空态 CTA 出现 5 种规格：44 px 胶囊（practice-history 等）、44 px/9 px 圆角（book）、36 px 胶囊（mastery-map）、36 px/9 px（inbox、poster）、33 px（stats、discuss）、17 px 文字链（stats 登录、weekly-report）。图标有 emoji（🔐💬）、有 l-icon、有无图标。
2. **主按钮圆角三分天下**：胶囊 `999rpx`（33 个文件）、`9–10px`（book/login/calendar/poster/inbox 的主 CTA）、`var(--radius)`（11 个文件）。**[生产]** 同一"去刷题"文案在 book 是 9 px 圆角、在 mastery-map 是胶囊。
3. **主按钮高度**：44 / 46 / 36 / 33 / 17 px 五种 **[生产]**；v3 规定 ≥44 **[文档]**。
4. **半像素字号**：**[生产]** 首页 computed 字号出现 `10.5 / 11.5 / 12.5 / 13.5 / 14.5px`（375 下 1rpx=0.5px，源码 `21/23/25/27/29rpx`）。**[代码]** 全 H5 `font-size: Nrpx` 声明 1 020 条，其中奇数 rpx 307 条（30%）。R383 提过，本轮在生产复现。
5. **模块色表 4 份、2 套值**（§2 #1 ⑥），且全部是浅色硬编码 → 首页深色漏网。
6. **wot-design-uni 组件未接深色**（reminders 页 wd-switch）。全站只在 5 处用 wot 组件（`wd-cell` 20、`wd-button` 8、`wd-cell-group` 3、`wd-switch` 2、`wd-datetime-picker` 1），其余按钮/卡片/弹层全是自绘——**组件库形同虚设，却又没有自己的组件层**。
7. **模块 chip 至少 4 套样式**：卷库（实心蓝选中/描边）、收藏（实心蓝 + 灰底）、PK（描边胶囊）、申论（描边 + ▾ 下拉）。**[生产]** 截图 `exam-list / favorites / pk / shenlun --375-light`。
8. **模块图标两套**：首页 Lucide 图标 + 浅底方块 vs 离线题包页"资/数/言/判/常"彩色首字方块。
9. **蓝渐变 hero 5 份实现**（home landing、interview、team、join、pk）。padding、圆角（28/32rpx）、副标题字号各异。
10. **`.card` 27 份实现**：圆角 `28rpx / var(--radius) / var(--radius,24rpx) / 16rpx`，阴影 `0 2rpx 8rpx rgba(23,24,28,.04)` vs `0 4rpx 16rpx rgba(31,36,48,.05)`，有的带 `1rpx solid var(--line)` 有的不带。**[生产]** 同一屏（首页）里今日任务卡与模块卡阴影不同。
11. **弹层/Sheet 12 份实现**（`.mask/.sheet/.modal/.popup`），遮罩色 `rgba(0,0,0,.45)` / `rgba(15,18,30,.5)` / `rgba(15,18,25,.45)` / `rgba(15,18,26,.5)` 四种。
12. **"标记/收藏"图标不统一**：练习页 ☆ 图标，模考页文字 `标记`。
13. **作答交互两套**：练习页答对自动跳 + 顶栏退出；模考页底部三键。
14. **同一动作文案不一**："去刷题 / 去刷一组题 / 去练一题 / 去卷库 / 去模考大赛 / 免注册立即开练 / 继续目标"。
15. **导航栏标题来源不一**：`team/join` 用 SEO 长标题；`exam` 用"迷你模考 09-06 08:19"（带时间戳）；其他用短名。
16. **状态色不走 token**：绿色有 `#16a34a #15803d #22c55e #10b981 #059669 #12b76a #2a7a2a #3aa53a #0d9488 #0f766e` 10 种；红色 `#ef4444 #dc2626 #b91c1c #f04438 #e5484d #c33 #b03030 #f43f5e`。`uni.scss` 里明明有 `--ok/--bad` **[代码]**。
17. **进度条 5 种**：home `.hero-bar/.mod-bar`、exam `.progress`、exam-list `.prog-*`、mastery-map `.cold-bar`、calendar；两处深色漏网都来自它。
18. **统计数字块 3 种**：profile 3 数字（卡片）、stats 3 数字（横排）、interview-history 3 数字（"—"占位）。
19. **筛选 chip 行横滑无提示**：卷库两行 28 个地区 chip，375 下被截断，无渐隐/更多。
20. **0 数据仍渲染完整骨架**：stats（6 个空模块）、favorites（收藏夹 + 模块 chip）、discuss（tab + 共 0 条）、interview-history（3 个"—"）。

---

## 5. 候选公共组件清单（不新增组件库，只在 wot-design-uni 之上封装）

原则 **[老板]**：优先复用 wot-design-uni；自己封装的只做"语义层"（把 token 与业务语义绑死），内部尽量套 wot 组件；组件放 `frontend-uni/src/components/kg-*/`（现有 `l-icon`、`rank-card`、`predict-card`、`q-social-bar`、`export-confirm` 已在这里，沿用 easycom）。

| 组件 | 替代掉什么 | 关键 prop | 内部复用 | 消灭的漂移 |
|---|---|---|---|---|
| `KgEmptyState` | 16 页 `.empty`、13 个首屏空态 | `icon`(l-icon 名) `title` `desc` `cta` `ctaTo` `secondary` | `wd-button` | Top20 #1 #14 #20 |
| `KgButton`（或直接 `wd-button` + 主题变量） | 18 文件 `.btn/.pbtn/.act-btn`、全部 `.hero-btn/.ld-btn` | `variant=primary/ghost/text/danger` `size=lg(44)/md(36)/sm(30)` `block` | `wd-button` + `--wot-button-*` 覆盖 | #2 #3 |
| `KgCard` | 27 文件 `.card` | `padding` `flat`(无阴影) `clickable` | 无（纯容器） | #10 |
| `KgSectionHeader` | 7 文件 `.sec-t` + 右侧 `›` 链接 | `title` `more` `moreTo` | — | — |
| `KgModuleTag` / `KgModuleIcon` | 4 份 `COLORS` 表、11 文件 chip/tag、离线页首字方块 | `module` `size` `variant=tag/icon/chip` | `src/module-meta.js`（新建单一数据源，含浅/深配对） | #5 #7 #8 |
| `KgChipRow` | 卷库/收藏/PK/申论 筛选行 | `options` `modelValue` `scroll`(带右渐隐) | 自绘（wot 无等价） | #7 #19 |
| `KgHeroCard` | 5 份蓝渐变 hero | `title` `sub` `meta` `slot:actions` | `KgButton` | #9 |
| `KgProgress` | 5 种进度条 | `value` `max` `color`(token 名) `thin` | `wd-progress`（评估） | #17 |
| `KgStatRow` | 3 种数字块 | `items=[{v,k}]` `placeholder="—"` `hideWhenZero` | — | #18 #20 |
| `KgSheet` | 12 份 `.mask/.sheet` | `show` `title` `slot` | `wd-popup`（position=bottom） | #11 |
| `KgAnswerBar` | 练习页顶栏 + 模考页底栏 | `prev/next/card/mark/quit` 事件 | `KgButton` | #12 #13 |
| `KgStreakBadges` | profile / calendar 徽章格 | `current` `best` `milestones` | — | §2 #7 |

token 侧配套（**代码即架构**）：`uni.scss` 已有 `--radius`，需再补 `--radius-pill / --radius-card / --radius-ctl`、`--btn-h-lg/md/sm`、`--fs-*` 偶数 rpx 字阶（v3 的 24/20/17/15/13/12 px → 48/40/34/30/26/24rpx），并在 ESLint/stylelint 加规则：页面 `<style>` 禁止裸 `#hex`（白名单 `#fff` 用于蓝底白字）。

---

## 6. 代码侧统计

### 6.1 口径
- 扫描范围：`frontend-uni/src/pages/*/*.vue`、`src/pkgA/*/*.vue`（32 页）+ `src/components/*/*.vue`（5 个）。只扫 `<style>` 内容；模板 `:style`/`color=` 内联色另列"模板内联色"。
- 正则：颜色 `#hex3/4/6/8 | rgba?() | hsla?()`；字号 `font-size:\s*([^;}]+)`；圆角 `border-radius:\s*([^;}]+)`（原值去空格，不做等价归一，如 `28rpx` 与 `var(--radius)` 记作两个值）。
- 与 R383（30 字号/36 圆角/131 色）不完全可比：R383 扫 38 个 .vue 含 App.vue 与 components；本轮拆成"页面 32 + 组件 5"，且颜色把 `rgba` 也算进去。**同口径下本轮全 H5：157 色值 / 29 字号 / 36 圆角**；单文件独占色值 88 个。

### 6.2 每页独有值（"仅本页"= 全 H5 只有这一个文件用到）

| 文件 | 色值 | 仅本页色值 | 字号 | 仅本页字号 | 圆角 | 仅本页圆角 | var() 引用 | style 行数 | 模板内联色 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `pages/practice/practice.vue` | 47 | 11 | 15 | 0 | 13 | 0 | 214 | 322 | 2 |
| `pages/book/book.vue` | 45 | 16 | 17 | 0 | 16 | 2 | 162 | 278 | 6 |
| `pages/home/home.vue` | 39 | 15 | 15 | 0 | 11 | 2 | 111 | 239 | 2 |
| `pkgA/exam/report.vue` | 25 | 0 | 11 | 0 | 12 | 1 | 101 | 153 | 0 |
| `pkgA/pk/pk.vue` | 24 | 4 | 13 | 0 | 7 | 0 | 63 | 118 | 2 |
| `pages/stats/stats.vue` | 21 | 6 | 18 | 0 | 10 | 1 | 111 | 223 | 2 |
| `pkgA/stats/mastery-map.vue` | 18 | 7 | 10 | 2 | 7 | 2 | 3 | 339 | 0 |
| `pages/ask/ask.vue` | 17 | 9 | 12 | 0 | 14 | 4 | 68 | 135 | 4 |
| `pkgA/interview/interview.vue` | 14 | 3 | 11 | 1 | 5 | 0 | 24 | 77 | 3 |
| `pkgA/stats/weekly-report.vue` | 14 | 2 | 13 | 0 | 7 | 0 | 35 | 71 | 0 |
| `pkgA/team/team.vue` | 14 | 1 | 12 | 0 | 9 | 0 | 42 | 101 | 1 |
| `pkgA/exam/contest.vue` | 12 | 4 | 10 | 0 | 6 | 0 | 42 | 68 | 0 |
| `pkgA/exam/exam.vue` | 12 | 1 | 10 | 0 | 7 | 0 | 48 | 94 | 0 |
| `pkgA/stats/practice-history.vue` | 11 | 2 | 9 | 0 | 4 | 0 | 15 | 57 | 0 |
| `pkgA/exam/contest-report.vue` | 10 | 0 | 10 | 0 | 4 | 0 | 30 | 64 | 0 |
| `pkgA/share/pk-result.vue` | 9 | 0 | 11 | 0 | 4 | 0 | 16 | 41 | 0 |
| `pkgA/share/share-q.vue` | 8 | 0 | 10 | 0 | 5 | 0 | 42 | 66 | 0 |
| `pages/stats/calendar.vue` | 7 | 1 | 9 | 0 | 5 | 0 | 23 | 52 | 0 |
| `pages/team/join.vue` | 7 | 0 | 7 | 0 | 3 | 0 | 10 | 27 | 1 |
| `pkgA/shenlun/shenlun.vue` | 7 | 0 | 10 | 0 | 6 | 0 | 65 | 97 | 4 |
| `pkgA/social/favorites.vue` | 7 | 0 | 9 | 0 | 7 | 0 | 34 | 58 | 2 |
| `pkgA/interview/history.vue` | 6 | 0 | 7 | 0 | 3 | 0 | 10 | 40 | 1 |
| `pkgA/settings/reminders.vue` | 6 | 0 | 8 | 0 | 5 | 0 | 17 | 38 | 2 |
| `pkgA/social/discuss.vue` | 6 | 0 | 10 | 0 | 7 | 0 | 37 | 62 | 4 |
| `pkgA/search/search.vue` | 5 | 0 | 5 | 0 | 3 | 0 | 32 | 63 | 2 |
| `pkgA/user/login.vue` | 5 | 2 | 5 | 0 | 5 | 1 | 16 | 117 | 0 |
| `pages/profile/profile.vue` | 4 | 0 | 9 | 0 | 6 | 0 | 18 | 49 | 4 |
| `pkgA/social/inbox.vue` | 4 | 0 | 6 | 0 | 4 | 0 | 11 | 32 | 0 |
| `pkgA/exam/list.vue` | 3 | 1 | 11 | 0 | 3 | 0 | 41 | 58 | 0 |
| `pkgA/social/plaza.vue` | 2 | 0 | 6 | 0 | 3 | 0 | 12 | 27 | 1 |
| `pkgA/social/poster.vue` | 2 | 1 | 3 | 0 | 2 | 0 | 7 | 10 | 0 |
| `pkgA/user/offline.vue` | 2 | 0 | 6 | 0 | 3 | 0 | 19 | 25 | 2 |

读法：
- 三个 Tab 主页（practice/book/home）贡献了 131/413 = 32% 的色值声明，独占色值 42 个——**收敛 token 先打这三页**就能砍掉一半漂移。
- `mastery-map.vue` 339 行 style 只有 3 处 `var()`，且是全站唯一用 `px` 字号的页面——它不是"漂移"，是"没接入"。
- `profile.vue` 只有 4 个色值、18 处 var()，是全站最干净的页，因为它用了 `wd-cell` —— 反证"用组件库就没漂移"。

### 6.3 全站高频值（用于定 token 名）
- 字号（文件数）：`24rpx` 34、`26rpx` 30、`22rpx` 29、`28rpx` 27、`23rpx` 25、`30rpx` 24、`27rpx` 24、`25rpx` 23、`21rpx` 21。奇数 rpx 5 个值进入前 9 → 直接映射到 v3 偶数字阶时需要"就近取偶"。
- 圆角（文件数）：`999rpx` 33、`8rpx` 18、`50%` 17、`16rpx` 16、`24rpx` 15、`18rpx` 13、`28rpx` 13、`12rpx` 12、`var(--radius)` 11、`20rpx` 10。
- 颜色（文件数前列）：`#fff`、`rgba(23,24,28,.04)`（阴影 A）、`#b45309`、`rgba(255,255,255,.85)`、`rgba(31,36,48,.05)`（阴影 B）、`#2e5bff`、`#5b8af8`、`#f59e0b`、`#ef4444`、`#fef3c7`。—— 两套阴影、品牌蓝硬编码而非 `var(--brand)`、琥珀色 `#b45309/#f59e0b/#fef3c7` 三件套在 11+ 文件重复。

### 6.4 页面之间重复实现的 UI 片段
| 片段（class 家族） | 文件数 | 差异点 | 抽成 |
|---|---:|---|---|
| `.card` | 27 | 圆角 4 种、阴影 2 种、有无边框 | `KgCard` |
| `.empty / .empty-t / .empty-s` | 16 | padding 30–120rpx、字号 25–28rpx、CTA 有无/形态 | `KgEmptyState` |
| `.btn / .pbtn / .act-btn / .hero-btn / .ld-btn` | 18 | 高度、圆角、字号 | `KgButton` |
| `.mask + .sheet / .modal / .popup` | 12 | 遮罩色 4 种、sheet 顶圆角 24/28/32rpx | `KgSheet`(wd-popup) |
| `.chip / .tag / .pill` | 11 | 见 Top20 #7 | `KgChipRow` / `KgModuleTag` |
| `.sec-t`（区块标题） | 7 | 字号 28–32rpx、右侧 more 有无 | `KgSectionHeader` |
| `.opt / .option`（选项行） | 7 | practice / exam / share-q / pk / interview 各自实现 | `KgOption` |
| `.stat / .hstat / .num` | 6 | — | `KgStatRow` |
| `.hero`（蓝渐变） | 5 | — | `KgHeroCard` |
| `.tabs`（segmented） | 3 | favorites/shenlun/discuss | `wd-tabs` 直接用 |
| `const COLORS = {…}`（模块色表） | 4 | 2 套色值 | `module-meta.js` |

wot-design-uni 现用量 **[代码]**：`<wd-cell` 20、`<wd-button` 8、`<wd-cell-group` 3、`<wd-switch` 2、`<wd-datetime-picker` 1。共 34 处，对比自绘按钮/卡片/弹层 100+ 处。

---

## 7. 小程序 14 页（`miniapp-native/miniprogram`）— 代码结构审计

> **无模拟器登录态**：本节全部 **[代码]**。页面清单来自 `app.json`；tabBar = 首页 / 错题本 / 模考 / 统计 / 我的（5 Tab，与 H5 的"AI 问答"Tab 不同——小程序把模考放到了 Tab 位）。`app.json` `"darkmode": true`，`app.wxss` 声明 79 个 CSS 变量，其中 `@media (prefers-color-scheme: dark)` 块覆盖 24 个。tdesign-miniprogram 1.9.7 在依赖里，但**只有 `pages/login/login.json` 引了 `t-input`/`t-button`**，其余 13 页零 tdesign 组件，全部自绘 + 自有 `components/navbar`。

| 页 | 用户任务 | 结构（wxml 顶层块） | loading / empty / error | 一致性 & 问题 | 建议 |
|---|---|---|---|---|---|
| `home` | 开始今天的题 | hero(今日已练 N/goal + 进度 + 继续目标) → 今日任务 3 行(`tk-row`) → 错题复习 → 每日打卡 → 模块 chips → sheet(题型选择, `sheet-*`) | 无 loading/empty（首页永远有内容） | 与 H5 首页相比**没有营销 hero、没有 9 宫格**，首屏就是目标 + 任务——比 H5 更符合 v3 IA；`home.wxss` 16 个色值是小程序最多 | H5 首页可以直接抄小程序的首屏层级 |
| `book` | 复习错题 | 顶部 chips 筛选 ×4 → 列表 → 批量操作 `m-op` ×7 → sheet ×3 | loading ✓ empty ✓(2 处) error ✓(重试) | 三态最全的一页；`m-op` 7 个操作平铺 | 操作收进 1 个 sheet |
| `exam` (Tab 模考) | 选卷开考 | `hero-mini`(迷你模考宣传 + 按钮) → `mh-stat` ×3 → 卷列表 | loading ✓ empty ✓(📄"二期上线") error ✓(📶 重试) | 空态用 emoji 图标；与 H5 卷库同样把迷你模考放最上 | emoji → 图标组件 |
| `exam/mini` | 答 30 题 | topbar(计时/标记) → 题卡 → 答题卡 sheet | loading ✓ | 与 H5 exam 页对应，结构一致 | — |
| `exam/report` | 看报告 | hero(分数 + 4 `hstat`) → 薄弱考点 → 模块得分 → 逐题回顾 → 重考 | loading ✓ | 无排名/雷达（同 H5） | 加百分位 |
| `stats` | 看统计 | `num-t` ×3 → 热力图(`hm-*`) → 弱项提示 `weak-tip/weak-go` → `sec-t` | empty ✓（1 处） | 只有 1 个空态，其余模块 0 数据时如何显示需看 ts | 0 数据折叠 |
| `profile` | 设置/记录 | 用户卡 `u-btn` ×2 → 3 数字 `r-k/r-v` ×5 → `us-cell` ×4 | 无 | 与 H5 我的页结构一致 | — |
| `practice` | 做题 | `p-head`(idx/计时/✓✗/字号钮) → 题卡 → 选项 → `exp-card`(正确答案/我的答案/花生十三解析 ×3 `exp-block`) → `share-op` | loading ✓ | 解析区没有"全站数据/考点/来源"行（H5 有），缺三项元数据 | 补齐与 H5 同款 meta |
| `login` | 登录 | t-input ×2 + t-button | loading ✓ error ✓ | 唯一用 tdesign 的页；按钮样式与其他页自绘 `hm-btn/u-btn` 不一致 | 要么全站用 tdesign button，要么这页也别用——别两套 |
| `team` | 建队/入队 | 空态 + 建队 + 邀请码 sheet | loading ✓ empty ✓ | 与 H5 team 一致 | — |
| `team/panel` | 看队内打卡 | `week-head` → 成员榜 `rank-*` → `remind-btn` | loading ✓ | 无 empty（队里没人时？） | 补 empty |
| `share/share` | 打开分享题 | 题卡 ×3 `card` → 解析 `exp-k` → `tc-*` CTA | loading ✓ empty ✓ error ✓ | 三态齐 | — |
| `share/pk-result` | 看 PK 结果 | 双方 `sc/nm/meta/crown` | loading ✓ error ✓ | 无 empty（对局未结束？） | 补 |
| `social/poster` | 保存海报 | canvas + `poster` + `tip` | loading ✓ error ✓ | 与 H5 同：0 天也可生成 | 同 H5 |

小程序样式统计 **[代码]**（`pages/*/*.wxss`，同口径）：100 色值 / 24 字号 / 23 圆角；页面级 wxss 全部没有 `prefers-color-scheme`，深色完全靠 `app.wxss` 的 token 覆盖——这比 H5 干净（H5 有 3 页自带 `.theme-dark` 局部覆盖），但同样意味着页面里任何裸 `#hex`（home 16 个、profile 8、book 7、exam 7、panel 7）在深色下都会漏。本轮无法在模拟器验证，列为**待验证**。

小程序 vs H5 结论：小程序首页的首屏层级（目标 → 任务 → 复习 → 打卡 → 模块）就是 v3 想要的；H5 首页反而在其上叠了营销 hero 和 9 宫格。两端"空态"的完备度：小程序 book/exam/share 三页有 loading+empty+error 三态，H5 对应页面只有 empty，error 靠 toast。

---

## 8. 建议怎么落（按"代码即架构"）

**第一刀（P0，1 个会话）**
1. `src/module-meta.js`：模块名/图标/浅深两套色 单一来源；4 份 `COLORS` 删掉。顺手修掉首页深色漏网。
2. `KgEmptyState` + `KgButton`（薄封装 wd-button 并写 `.theme-dark` 下的 `--wot-*` 变量）：先替换 13 个首屏空态和 reminders 的 wd-switch 深色。
3. `exam/list` 分页 + 卡内动作收敛；`team/join` 导航标题；`exam/report` 空态 CTA 指向真实页。

**第二刀（P1，1–2 个会话）**
4. `uni.scss` 补 `--radius-pill/card/ctl`、`--btn-h-*`、偶数 rpx 字阶；stylelint 禁裸 hex。
5. practice/book/home 三页按 token 重写 style（它们占 32% 的色值）；练习题面加"考点 · 难度 · 全站正确率"meta 行。
6. `KgCard / KgChipRow / KgModuleTag / KgSheet / KgProgress`，按 §6.4 表逐个替换。

**第三刀（P2）**
7. 首页 IA：hero 只给零作答用户；三个计划入口合一；统计页 0 数据折叠。
8. 小程序补三态（panel/pk-result empty）、practice 解析 meta；决定 tdesign 用不用（现在是"装了不用"）。

每一刀的验收都是：`npm run lint && npx vitest run && npm run build:h5` 本地绿 + 重跑附录 A 探针，`lightBg` 漏网数为 0、空态 CTA 规格 ≤ 2 种。

---

## 附录 A · 探针方法（可复跑）

```
Playwright(Chromium 151, headless) → 对 32 个 hash 路由 × {375×812 mobile, 1440×900} × {light, dark}
  new_context(viewport, is_mobile, has_touch, color_scheme, locale=zh-CN)
  addInitScript: localStorage.anonUid='test-w5-audit-h5'; themeMode= 'system'(跟随 color_scheme)
  goto(wait_until=networkidle) → reload → wait 2500ms → screenshot(full_page, 高度上限 3200/2600)
  evaluate: title / location.hash / clientWidth / scrollWidth / scrollHeight / html.theme-dark
            / innerText(前 2000 字) / 可见按钮的 {class,text,height,radius,bg,fontSize}
            / 全 DOM computed font-size & border-radius 去重
            / dark 时扫 body * : 面积>400 且背景亮度>0.6 的元素 → lightBg
  监听: response(/api/) status, console.error, pageerror
```
样式扫描：`frontend-uni/src/{pages,pkgA,components}/*/*.vue` 取 `<style>` 段，正则见 §6.1；小程序同法扫 `pages/*/*.wxss`。

## 附录 B · 截图索引
`shots/<slug>--<375|1440>-<light|dark>.jpg`，slug：home book ask stats profile practice calendar team-join shenlun login offline exam-list exam exam-report contest contest-report weekly-report search discuss inbox plaza favorites poster interview interview-history team share-q pk-result pk reminders mastery-map practice-history（32 × 4 = 128）。

本文引用的关键图：`home--375-dark.jpg`（模块图标漏网）、`mastery-map--375-dark.jpg`（白进度槽）、`pk--375-dark.jpg`（榜单徽章）、`reminders--375-dark.jpg`（wd-switch）、`exam-list--375-light.jpg`（120 卷 × 3 按钮）、`team-join--375-light.jpg`（SEO 标题截断）、`practice--1440-light.jpg`（唯一的宽屏双栏）、`stats--375-light.jpg`（0 数据全铺开）。
