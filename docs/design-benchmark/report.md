# 竞品 UI/UX 设计对标报告（粉笔 / 华图在线 / 一起公考 vs 我们）

日期：2026-08-05 ｜ 分支：`devin/design-benchmark`（基于 `origin/devin/p5-integration`）

## 1. 取证方式与合规说明

- 在 Android x86_64 模拟器（AVD `bench30`，Android 11，1080×2280@440dpi）上安装了粉笔（`com.fenbi.android.servant`）与华图在线（`com.huatu.handheld_huatu`）官方渠道 APK。两者均使用商业加固（网易易盾 / 360 加固），原生库仅提供 arm64 实现，在 x86_64 模拟器上启动即崩（`UnsatisfiedLinkError`）。**遵守「不破解」约束，未做任何脱壳/绕过**。
- 改用同样真实的合规界面来源：
  - 官方应用商店产品截图库：`fenbi/appstore/`、`huatu/appstore/`、`yiqi/appstore/`（一起公考作为腰果公考的替代样本，腰果官方渠道未提供可下载 APK）。
  - 官方 H5 题库页：`fenbi/web-tiku.png`、`huatu/web-tiku.png`。
- 我们自己的产品为真机实测：Flutter APP 用 `flutter build apk --debug` 装同一模拟器逐页截图（`ours-app/`），网页端 https://kaogong.zalize.com 桌面浏览器截图（`ours-web/`）。
- 未抓取任何竞品题库内容。

## 2. 截图库索引

| 目录 | 内容 |
|---|---|
| `fenbi/appstore/` | 粉笔：练习首页/职位报考/题库列表/直播课/互动 |
| `huatu/appstore/` | 华图：选考目标/做题首页(专项练习带刷题量与正确率)/模考/成绩报告/历年真题/课程/错题本 |
| `yiqi/appstore/` | 一起公考：题库首页/真题列表(完成状态+展开操作)/其他 |
| `ours-app/` | 我们 Flutter APP：首页/作答/解析/错题本/AI问答/统计/我的/模考列表 + 深色模式全套 |
| `ours-web/` | 我们网页端：全部主页面 + 深色模式 |
| `after/` | P0 改进实施后的验证截图（浅色+深色） |

## 3. 逐页对比审计（布局/间距/字阶/配色/信息层级/微交互/空态/插画）

### 3.1 首页

- 竞品：华图专项练习每个模块显示「刷题量: 2352/2868 正确率: 82%」+「继续做题」按钮（`huatu/appstore/huatu-02.png`）；粉笔首页有模块完成进度与多学习入口（`fenbi/appstore/fenbi-01.png`）。
- 我们（改前 `ours-app/01-home.png`）：专项练习仅有「模块名 + 箭头」，无任何数据与进度，信息层级过平；用户无法判断该练哪块。
- 网页端已具备模块统计，APP 与网页端不一致。

### 3.2 刷题作答页

- 竞品：作答页底部固定「上一题 / 答题卡 / 下一题」工具栏，选项用圆形字母徽章、卡片式选中态（华图/粉笔通用范式）。
- 我们（改前 `ours-app/06-answer.png`）：底部唯一操作是「提前结束」，不能回看上一题、不能跳题、没有答题卡；选项字母为普通文本，无视觉锚点；选项最小高度不足 48dp。

### 3.3 解析页

- 竞品：粉笔解析分「答案 + 正确率/平均用时 + 考点 + 分步解析」，层级丰富。
- 我们（`ours-app/07-analysis.png`）：即时判分与解析卡已具备（绿/红着色 + 收藏/笔记/讨论），但缺少本题正确率、平均用时、考点标签、分段解析（P1）。

### 3.4 错题本

- 竞品：华图错题本按模块分组并显示「N 道题」计数（`huatu/appstore/huatu-07.png`），支持导出。
- 我们（`ours-app/02-book.png`）：已有待掌握/已掌握/收藏 + 今日复习入口 + 导出，功能不落后；空态为裸文本无插画无 CTA（改前）；缺模块分组视图（P1）。

### 3.5 模考 / 报告页

- 竞品：华图模考含考前提醒、万人排名、成绩报告雷达图（`huatu/appstore/huatu-03.png`、`huatu-04.png`）；一起公考真题列表显示完成状态与「最新成绩/逐题练习/整卷考试」展开操作（`yiqi/appstore/yiqi-02.png`）。
- 我们（`ours-app/08-exam-list.png`）：模考列表朴素，无完成状态标记；报告页数据密度低（P1/P2）。

### 3.6 个人中心

- 我们（`ours-app/05-profile.png`）功能齐全但视觉平淡；竞品用头部卡片聚合学习资产（P2）。

### 3.7 深色模式

- 我们（改前 `ours-app/dark-03-answer.png`）：大量 `KgColors.*` 浅色常量硬编码，深色下出现刺眼浅色边框（选项卡白边）、低对比辅助文字；解析卡浅蓝渐变在深色下突兀。
- 网页端深色模式（`ours-web/dark-*.png`）整体协调，APP 与之不一致。

### 3.8 空态与插画

- 竞品空态均有插画与行动引导；我们统计页/错题本空态为一行灰字（`ours-app/04-stats.png`），用户断流。

## 4. 改进清单（P0 / P1 / P2）

### P0（本 PR 已实施，验证见 `after/`）

| # | 页面 | 问题（我们现状） | 竞品依据 | 改法（已实施） | 验证 |
|---|---|---|---|---|---|
| P0-1 | 全局深色模式 | 浅色 token 硬编码致深色下白边/低对比（`ours-app/dark-03-answer.png`） | 竞品深浅色 token 成对 | 新增 `KgSemantic` ThemeExtension（t1-t4/border/fill/surface/状态底色成对），`context.kg` 取用；替换首页/作答/错题本/统计高频硬编码 | `after/dark-01-answer-after.png` |
| P0-2 | 首页专项练习 | 模块行仅名称+箭头，无数据（`ours-app/01-home.png`） | `huatu-02.png` 刷题量/正确率/继续做题 | 模块行显示「已练 N 题 · 正确率 X%」+ 模块色进度条 +「开始/继续做题」胶囊按钮，数据来自 `Api.growth()` | `after/01-home-after.png` |
| P0-3 | 作答页 | 无上一题/跳题/答题卡，仅「提前结束」（`ours-app/06-answer.png`） | 华图/粉笔作答页底部工具栏范式 | 底部固定工具栏「上一题/答题卡/下一题」；答题卡 bottom sheet 网格显示对/错/未答与当前题，可跳题，「提前交卷结算」移入其中 | `after/02-answer-after.png`、`after/04-answer-card-after.png` |
| P0-4 | 作答页选项 | 字母为普通文本，无选中态锚点，高度不足 | 竞品圆形字母徽章范式 | 圆形字母徽章（答对绿底/答错红底反白），选项最小高度 56dp，圆角 12 | `after/03-answered-after.png` |
| P0-5 | 空态 | 统计/错题本空态为裸文本 | 竞品插画+CTA 空态 | 新增共享 `EmptyState` 组件（品牌色晕圈插画+标题+描述+CTA），应用于统计两卡与错题本三 tab | `after/06-stats-empty-after.png` |

### P1（建议下轮迭代）

1. 解析页信息分层：本题正确率/平均用时、考点标签、分步解析分段（依据粉笔解析页范式）。
2. 模考列表完成状态标记 + 「最新成绩/重新做」展开操作（依据 `yiqi-02.png`）。
3. 报告页增加能力雷达图与模块耗时分布（依据 `huatu-04.png`）。
4. 错题本增加按模块分组视图与计数（依据 `huatu-07.png`）。
5. 首页顶部增加考试倒计时（报考目标日期已在计划设置中采集）。

### P2

1. 个人中心头部学习资产卡片（连续打卡/总题量/预测分）。
2. 更多练习金刚区图标分色（当前统一品牌蓝，竞品为多彩图标）。
3. 首页 banner 位/运营位预留。
4. 打卡海报视觉升级。

## 5. P0 实施代码

- `app-flutter/lib/theme.dart`：新增 `KgSemantic` ThemeExtension 与 `context.kg`。
- `app-flutter/lib/widgets/empty_state.dart`：新增共享空态组件。
- `app-flutter/lib/pages/home_page.dart`：模块行改造（进度/正确率/CTA）+ 深色适配。
- `app-flutter/lib/pages/practice_page.dart`：底部工具栏 + 答题卡 sheet + 选项徽章 + 深色适配。
- `app-flutter/lib/pages/book_page.dart`、`stats_page.dart`：空态升级。

`flutter analyze` 通过（No issues found）；`flutter build apk --debug` 构建并装机验证。

## 6. Rebase 说明

devin/p5-integration 后续合入 PR#40（B1-B4，home_page/stats_page 全量重写）。本分支已 rebase 到最新集成分支：以 B1-B4 新页面结构为基底重新叠加 5 项 P0 视觉改进（模块行进度条+CTA 胶囊、答题卡 sheet、选项徽章、KgSemantic 深色 token、EmptyState），去除与上游重复的简版答题卡实现。复验截图见 `after/rebase-*.png`。
