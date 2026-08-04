# 原型 vs 实现 对齐审计（第二轮）

范围：管理后台十模块（backend/app/admin）+ 客户端 H5 第一轮未覆盖页面（frontend-uni/src）。
方法：本地起后端（:8300，含种子数据）与 H5 dev（:5173），Playwright 浅色主题 375×812（客户端）/ 1440×900（管理端）截图，与 docs/design-v3 原型逐页并排比对。
分级：P0 = 功能/布局结构性偏差；P1 = 明显样式/信息偏差；P2 = 细节差异或有意状态差异（标注不修）。
第一轮报告见 ALIGN-AUDIT.md（主 Tab 五页 + 练习/详情等已对齐）。

图例：左 = 原型（docs/design-v3/png、docs/design-v3/admin/png），右 = 实现截图（docs/design-v3/audit2，`impl-*` 为修复前、`after-*` 为修复后）。

---

## 一、管理后台（十模块）

管理端实现整体采用与原型一致的 232px 侧边导航 + 顶栏 + 内容区结构、同套设计 token（admin.css 取自原型），本轮偏差集中在顶栏搜索、页内筛选与个别字段列缺失。

### A1 数据看板 dashboard
| 原型 | 实现 |
|---|---|
| ![](admin/png/dashboard.png) | ![](audit2/after-admin-dashboard.png) |

- ✅ KPI 四卡、趋势图、待办清单、模块分布与原型一致。
- 【P1·已修】顶栏全局搜索占位为「跳到题目 ID…」且无 ⌘K 快捷键提示 → 改为「搜索题目 ID / 用户 / 批次…」+ ⌘K 徽标，并支持 Cmd/Ctrl+K 聚焦（全模块共用顶栏，一次修复全局生效）。
- 【P2·标注】原型头部有时间范围切换（近 7/14/30 天）与「导出报表」按钮；实现趋势固定 14 天、无导出。属功能差异（后端接口固定 14 天，不改后端业务逻辑），保留现状。

### A2 题库管理 questions
| 原型 | 实现 |
|---|---|
| ![](admin/png/questions.png) | ![](audit2/impl-admin-questions.png) |

- ✅ 筛选行（模块/状态/关键词）、表格列、行内编辑抽屉、上下架与原型一致。
- 【P2·标注】原型底部有「共 N 条 · 分页页码」，实现为上一页/下一页翻页（接口按 offset 返回，总数已在头部展示）。

### A3 批次导入审核 batches
| 原型 | 实现 |
|---|---|
| ![](admin/png/batches.png) | ![](audit2/impl-admin-batches.png) |

- ✅ 待审批次卡（抽样预览、通过/驳回）、历史批次表与原型一致；侧边导航待审徽标一致。
- 无 P0/P1。

### A4 考点树 taxonomy
| 原型 | 实现（修复后） |
|---|---|
| ![](admin/png/taxonomy.png) | ![](audit2/after-admin-taxonomy.png) |

- 【P1·已修】原型树上方有模块筛选 chips（全部/资料分析/数量关系/言语理解/判断推理/常识判断），实现缺失 → 已补充，点击按模块过滤树。
- ✅ 左树右详情双栏、三级展开、题量 tag、UNKNOWN 行为一致。

### A5 考点抽审 review
| 原型 | 实现 |
|---|---|
| ![](admin/png/review.png) | ![](audit2/impl-admin-review.png) |

- ✅ 抽审队列、题目卡（题干/选项/当前考点/改判操作）与原型一致。
- 【P2·标注】本地库 UNKNOWN 为 0 时呈空态；原型展示有队列的状态，属数据状态差异。

### A6 纠错处理 reports
| 原型 | 实现 |
|---|---|
| ![](admin/png/reports.png) | ![](audit2/impl-admin-reports.png) |

- ✅ 状态筛选 chips、纠错表（类型 tag/题干/状态/处理动作）与原型一致（本地种子 3 条验证）。
- 无 P0/P1。

### A7 内容治理 governance
| 原型 | 实现（修复后） |
|---|---|
| ![](admin/png/governance.png) | ![](audit2/after-admin-governance.png) |

- 【P1·已修】原型页头有「▶ 立即扫描」按钮，实现缺失 → 已补充（重新拉取治理扫描结果）。
- ✅ 四 KPI（损坏题/重复题组/答案偏斜/缺解析）、答案分布堆叠条、批次分布表、差评缓存表一致。

### A8 时政与申论 content
| 原型 | 实现（修复后） |
|---|---|
| ![](admin/png/content.png) | ![](audit2/after-admin-content.png) |

- 【P1·已修】原型时政表有「时效」生命周期列（时效内/即将过期/已过期 + 截止月），实现缺失 → 已按日期+12 个月推算补充（纯前端展示，不改后端）。
- ✅ 时政题库表、申论真题卷/素材库双栏与原型一致。
- 【P2·标注】原型有「作答/正确率」列与自动下架；后端未提供该统计口径，不改业务逻辑，保留现状。

### A9 用户与运营 users
| 原型 | 实现 |
|---|---|
| ![](admin/png/users.png) | ![](audit2/impl-admin-users.png) |

- ✅ KPI（注册/活跃/留存）、用户表、匿名/注册标识与原型一致。
- 无 P0/P1。

### A10 系统设置 settings
| 原型 | 实现 |
|---|---|
| ![](admin/png/settings.png) | ![](audit2/impl-admin-settings.png) |

- ✅ 环境信息、LLM 配置、令牌管理、数据库信息分卡与原型一致。
- 【P2·标注】原型含「危险操作」区块（清空缓存等），实现仅差评缓存删除入口（在治理页）；属功能取舍差异。

---

## 二、客户端 H5（本轮页面）

### C1 真题卷库 exam-list
| 原型 | 修复前 | 修复后 |
|---|---|---|
| ![](png/exam-list.png) | ![](audit2/impl-exam-list.png) | ![](audit2/after-exam-list.png) |

- 【P0·已修】迷你模考卡：原型为暖色浅底（#FFF7ED→#FFFBEB 渐变）+ ⚡ 图标 + 蓝色「开始」主按钮；实现为蓝色渐变卡白字白底按钮，视觉层级相反 → 已改为原型样式。
- ✅ 筛选 chips、卷卡（题数/时长/最高分）、历史成绩一致。
- 【P2·标注】实现多出「导出 PDF（含答题卡）」按钮，功能多于原型。

### C2 模考作答 exam
| 原型 | 修复前 | 修复后 |
|---|---|---|
| ![](png/exam.png) | ![](audit2/impl-exam.png) | ![](audit2/after-exam.png) |

- 【P1·已修】倒计时：原型为红色 ⏱ 居中显示，实现为黑色靠右 → 已改为红色 ⏱ 居中。
- 【P1·已修】底部操作：原型为固定底栏「上一题 / 答题卡 / 下一题」三键，实现「答题卡」在顶部、页内两键不固定 → 已改为固定三键底栏。
- ✅ 模块 chip、进度条、选项态、答题卡浮层（图例/宫格/交卷确认）一致。

### C3 成绩报告 exam-report
| 原型 | 实现 |
|---|---|
| ![](png/exam-report.png) | ![](audit2/impl-exam-report.png) |

- ✅ 总分卡、模块得分条、错题跳转与原型结构一致。
- 【P2·标注】原型展示雷达图与历史对比曲线；实现为条形分布（数据源一致），视觉表达差异。

### C4 时政每日一练 daily
| 原型 | 实现 |
|---|---|
| ![](png/daily.png) | ![](audit2/impl-home.png)（首页入口卡） |

- ✅ 首页「时政每日一练」入口卡（每日 10 题/去练习）与练习流程可用（本地种子 120 题验证）。
- 【P2·标注】原型为独立日历式每日一练页；实现复用练习页 + 首页入口，属信息架构差异（第一轮已记录，功能等价）。

### C5 申论列表 shenlun
| 原型 | 修复前 | 修复后 |
|---|---|---|
| ![](png/shenlun.png) | ![](audit2/impl-shenlun.png) | ![](audit2/after-shenlun.png) |

- 【P1·已修】三 Tab：原型为 chips 风格（选中蓝底浅色），实现为 segmented 灰底 → 已改 chips。
- 【P1·已修】筛选行：原型为「地区 ▾ / 年份 ▾ / 题型 ▾ + 重置」，实现为题型横滑 chips + 「筛选」抽屉 → 已改为三下拉 chips + 重置（点击打开筛选抽屉，抽屉含题型/年份/地区）。
- 【P1·已修】题目卡：原型题型蓝 tag 在前、卷名灰 tag 在后，右下为「去作答 ›」文字链接；实现卷名琥珀 tag 在前、「去作答」蓝色胶囊 → 已按原型调整（tag 顺序/配色、文字链接）。
- ✅ 字数/建议时长 meta、收藏星标、已作答记录 Tab 一致。

### C6 申论作答 shenlun-detail
| 原型 | 修复前 | 修复后 |
|---|---|---|
| ![](png/shenlun-detail.png) | ![](audit2/impl-shenlun-detail.png) | ![](audit2/after-shenlun-detail.png) |

- 【P1·已修】原型作答区标题右侧有「已自动保存 · N 字」实时提示，主按钮文案为「提交 AI 批改」；实现无字数提示、按钮为「AI 批改」 → 已补充。
- ✅ 作答要求置顶、给定资料抽屉展开、参考要点「写完再看」门控、历史作答一致。

### C7 申论批改 shenlun-review
- ✅ 批改结果在作答页内呈现（采分点/档位），带「AI 参考，非官方评分」标注。
- 【P2·标注】原型为独立批改结果页；实现内嵌 detail 页，属信息架构差异，功能等价。

### C8 学习计划 plan
| 原型 | 实现 |
|---|---|
| ![](png/plan.png) | ![](audit2/impl-home.png)（首页计划卡） |

- ✅ 制定计划向导（考试日期/每日任务）、首页「继续目标/今日计划」卡与原型一致（第一轮已核）。
- 无新增 P0/P1。

### C9 登录 login
| 原型 | 修复前 | 修复后 |
|---|---|---|
| ![](png/login.png) | ![](audit2/impl-login.png) | ![](audit2/after-login.png) |

- 【P1·已修】原型顶部为居中品牌区（渐变圆角 logo + 「考公错题助手」+ 副标题），实现为左对齐「登录账号」标题 → 已改为居中品牌区。
- ✅ 手机号/密码表单、登录/注册切换、本机记录合并提示一致。
- 【P2·标注】原型有微信/Apple 第三方登录与忘记密码；实现未接入（端差异注明 H5 以手机号为主），保留现状。

### C10 个人中心 profile
| 原型 | 实现 |
|---|---|
| ![](png/profile.png) | ![](audit2/impl-profile.png) |

- ✅ 头像区、功能列表（收藏/离线题包/学习提醒/主题/关于）、退出登录与原型一致（第一轮已修头部渐变）。
- 无新增 P0/P1。

### C11 导出弹层 pdf-export
| 原型 | 实现 |
|---|---|
| ![](png/pdf-export.png) | ![](audit2/impl-book-sheet.png) |

- ✅ 错题本 ⋯ 菜单 → 导出错题卷 PDF（含筛选范围、仅导出答案开关）功能可用。
- 【P2·标注】原型弹层含版式（单栏/双栏）与含错误标注开关；实现为固定版式（后端 PDF 生成参数固定，不改后端）。

### C12 学习日历 calendar
| 原型 | 修复前 | 修复后 |
|---|---|---|
| ![](png/calendar.png) | ![](audit2/impl-calendar.png) | ![](audit2/after-calendar.png) |

- 【P1·已修】头部：原型为「‹ 2025 年 10 月 ›」居中切换 + 绿色「本月打卡 N 天」徽标；实现为左标题 + 右侧「上月/下月」文字钮、打卡数混在副标题 → 已改为箭头贴月份 + 绿色徽标。
- ✅ 打卡热力格（1-9 题/≥10 题/今天）、图例、生成海报按钮一致。

### C13-C19 无原型页面（功能多于原型，状态差异标注）

以下页面在 docs/design-v3 22 页原型中无对应页，均为实现侧新增功能，按「不删线上已有功能」原则保留并仅做体检：

| 页面 | 截图 | 结论 |
|---|---|---|
| 搜索 search | ![](audit2/impl-search.png) | 布局与全局 token 一致，无 P0/P1 |
| 讨论区 discuss | ![](audit2/impl-discuss.png) | 一致，无 P0/P1 |
| 收藏夹 favorites | ![](audit2/impl-favorites.png) | 一致，无 P0/P1 |
| 打卡海报 poster | ![](audit2/impl-poster.png) | 一致，无 P0/P1 |
| 答题 PK pk | ![](audit2/impl-pk.png) / ![](audit2/after-pk.png) | 【P1·已修】「应战」按钮为黑底（#17181c），与全局品牌蓝体系不符 → 改为 var(--brand) |
| 面试练习 interview | ![](audit2/impl-interview.png) | 一致，无 P0/P1 |
| 学习提醒 reminders | ![](audit2/impl-reminders.png) | 一致，无 P0/P1 |
| 离线题包 offline | ![](audit2/impl-offline.png) | 一致，无 P0/P1 |

---

## 三、修复清单汇总

| # | 级别 | 页面 | 偏差 | 修复文件 |
|---|---|---|---|---|
| 1 | P0 | 真题卷库 | 迷你模考卡配色/结构与原型相反 | frontend-uni/src/pkgA/exam/list.vue |
| 2 | P1 | 模考作答 | 倒计时非红色居中；底部无固定三键栏 | frontend-uni/src/pkgA/exam/exam.vue |
| 3 | P1 | 申论列表 | Tab/筛选行/题目卡样式偏差 | frontend-uni/src/pkgA/shenlun/shenlun.vue |
| 4 | P1 | 申论作答 | 缺自动保存字数提示；按钮文案 | frontend-uni/src/pkgA/shenlun/shenlun.vue |
| 5 | P1 | 登录 | 缺居中品牌区 | frontend-uni/src/pkgA/user/login.vue |
| 6 | P1 | 学习日历 | 月份切换/打卡徽标样式 | frontend-uni/src/pages/stats/calendar.vue |
| 7 | P1 | 答题 PK | 应战按钮黑底偏离品牌色 | frontend-uni/src/pkgA/pk/pk.vue |
| 8 | P1 | 管理端顶栏 | 搜索占位/⌘K 缺失 | backend/app/admin/index.html, core.js |
| 9 | P1 | 考点树 | 缺模块筛选 chips | backend/app/admin/pages/taxonomy.js |
| 10 | P1 | 内容治理 | 缺「立即扫描」按钮 | backend/app/admin/pages/governance.js |
| 11 | P1 | 时政与申论 | 时政表缺「时效」列 | backend/app/admin/pages/content.js |

P2（标注不修，共 9 项）：看板时间范围/导出报表、题库分页页码、抽审空态、时政作答统计列、设置危险操作区、导出弹层版式开关、成绩报告雷达图、每日一练独立页、申论批改独立页。

构建验证：`npm run build:h5` 与 `npm run build:mp-weixin` 通过（见 PR）。
