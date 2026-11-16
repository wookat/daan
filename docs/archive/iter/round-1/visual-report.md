# Round 1 视觉走查报告（网页端 + Flutter APP）

- 时间：2026-08-05
- 范围：生产网页端 https://kaogong.zalize.com （移动/桌面 × 浅色/深色）+ Flutter APP（Android 模拟器 Pixel 风格 1080×2280，浅色/深色）
- 对照：`docs/design-v3/DESIGN.md` 设计 token、`docs/design-benchmark/report.md` P1/P2 清单
- 截图：`screenshots/web-*`（网页端）、`screenshots/app/*`（APP，before-*/after-* 为本轮修复前后对比，anno-* 为标注图）

## 一、结论摘要

- 网页端整体已与 design-v3 对齐较好（P0 轮成果保持），主要剩余问题集中在**信息密度/层级**与竞品差距（P1 功能类），以及少量深色模式细节。
- Flutter APP 浅色模式观感良好；**深色模式存在多处浅色 token 泄漏**（近白进度条、亮黄题干高亮、浅灰错因チップ、结算页浅色圆环/宫格），本轮已全部修复。
- 底部导航选中态深色下为高饱和蓝色胶囊，与网页端克制的深色选中态不一致，本轮改为深色品牌底（brandBg）胶囊。
- flutter analyze：0 error（全仓）。

## 二、APP 深色模式问题与本轮修复（已实施，纯样式）

| # | 页面/组件 | 问题 | 修复 | 证据 |
|---|---|---|---|---|
| A1 | 能力预测分卡（统计/我的，`widgets/predict_card.dart`） | 进度条轨道用浅色 `KgColors.fill`，深色下呈**近白长条**，t2/t3 文本也是浅色静态 token | 全部改 `context.kg.*` 主题 token | `anno-before-dark-profile.png` vs `after-dark-04-stats.png` / `after-dark-05-profile.png` |
| A2 | 刷题页题干重点高亮（`practice_page.dart`） | 高亮硬编码 `#FEF3C7/#92400E`，深色下大片**亮黄色块**刺眼 | 深色改为暗琥珀 `#3A2E10` 底 + `#FBBF24` 字，浅色不变 | `anno-before-dark-graded.png` vs `after-dark-08-graded.png` |
| A3 | 错因自评标签（`practice_page.dart`） | 未选中态用浅色 `KgColors.fill/t3`，深色下呈浅灰白胶囊 | 改 `context.kg.fill/t3` | `anno-before-dark-analysis.png` vs `after-dark-09-analysis.png` |
| A4 | 结算页（`practice_page.dart`） | 成绩圆环轨道、题目回顾宫格底色/文字为浅色静态 token | 改 `context.kg.fill/successBg/errorBg/t3` | 代码 diff |
| A5 | 底部导航选中态（`theme.dart`） | 深色下 indicator 为 `brandDeep` 高饱和蓝胶囊，观感突兀、与网页端深色 tabbar 不一致 | 深色 indicator 改 `KgSemantic.dark.brandBg`（深蓝底 + 亮蓝图标） | `before-dark-01-home.png` vs `after-dark-01-home.png` |
| A6 | 我的页（`profile_page.dart`）、统计页进度轨道（`stats_page.dart`） | 多处 `KgColors.t3/t4/fill` 静态 token | 改 `context.kg.*` | 代码 diff |

浅色模式回归：`after-light-practice.png`、`after-light-stats.png` 与修复前一致，无回归。

## 三、走查发现（未实施，仅列清单）

### 网页端

| # | 页面 | 问题 | 级别 | 建议 |
|---|---|---|---|---|
| W1 | 桌面端首页（`web-d-home.png`） | 双栏布局右栏偏空，大屏信息密度低于粉笔（粉笔首页有考试倒计时/课程/活动位） | P2 | 右栏增加今日待办/预测分/日历摘要聚合 |
| W2 | 真题卷列表（`web-m-exam-list.png`） | 长列表无完成状态区分、无「最近得分/重做/逐题练」操作（对标粉笔真题库），一屏信息重复度高 | P1（功能） | 卷卡片加完成态徽标 + 上次得分 + 快捷操作 |
| W3 | 错题本（`web-m-book.png`） | 平铺列表，缺少按模块分组统计入口（粉笔按模块聚合并显示题数） | P1（功能） | 顶部加模块分组条 |
| W4 | 统计页（`web-m-stats.png`） | 雷达图冷启动占位面积大，层级弱 | P2 | 占位卡压缩高度并给出引导按钮 |
| W5 | 深色模式整体（`web-m-dark-*.png`） | 主要页面对比度达标；申论/日历个别次级文字略暗（≈t4 级） | P2 | 次级文字统一提到 t3 |

### Flutter APP

| # | 页面 | 问题 | 级别 | 建议 |
|---|---|---|---|---|
| F1 | 全局圆角 | 代码中圆角混用（2/4/6/8/10/12/14/16/20/99/999），design-v3 规范为 999/10/14/20 四档 | P2（涉及面广，本轮不动） | 收敛为四档常量并全局替换 |
| F2 | AI 问答页（`before-dark-03-ask.png`） | 空态插画为拟物白色气泡贴图，与整体线性图标风格不符；「粘贴文字」描边深色下偏亮 | P2 | 换线性风格插画/图标，描边用 kg.border |
| F3 | 首页更多练习宫格 | 8 宫格图标全部同色（品牌蓝），模块识别度低于首页五模块彩色图标体系 | P2 | 按功能语义分色或统一加浅底色块 |
| F4 | 答题页 | 无答题卡内已答/未答比例摘要；选项命中率、平均用时等竞品字段缺失 | P1（功能） | 见 benchmark P1 清单 |
| F5 | 剩余静态 token | `ask_page/home_page/pk_page/search_page/exam_report_page` 等仍有大量 `KgColors.*` 静态引用，深色下部分次级文字对比度偏低但可读 | P2 | 下轮批量迁移到 `context.kg.*` |

## 四、与粉笔等成熟产品的观感差距（摘要）

1. **数据密度**：粉笔练习首页、真题库单屏信息量更高（正确率、进度、上次得分内联展示）；本产品卡片留白偏多、字段少。
2. **状态可见性**：粉笔对「做过/没做过/做到一半」有强状态区分；本产品真题卷列表/模块卡缺少完成态。
3. **解析分层**：粉笔解析页有正确率/平均用时/考点标签 + 分步解析折叠；本产品解析为整段文本，层级靠标签色块。
4. **图表表达**：粉笔报告页雷达图 + 维度诊断文案成熟；本产品雷达冷启动占位多、缺诊断文案。

以上均为功能/结构类，列入后续迭代清单，不在本轮实施。

## 五、验证

- `flutter analyze`：No issues found（0 error / 0 warning）。
- 模拟器前后对比截图见 `screenshots/app/`（before-* / after-*）。
- 网页端截图为生产环境实测（临时测试账号，凭证未入库）。
