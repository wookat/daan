# 组件规范 v4 · 基础组件与复合组件

> 前置：[SPEC.md](SPEC.md)（所有尺寸/颜色/动效只写 token 名）。页面级用法与复用矩阵见 [PAGES.md](PAGES.md)。
> 原则：**如无必要勿增实体**。能用 wot-design-uni（H5）/ tdesign-miniprogram（小程序）配 token 解决的不自研；自研的必须是「薄封装」——只做布局与 token 映射，不重造交互。
> 命名：H5 自研组件 `Kg*`（easycom 自动注册 `frontend-uni/src/components/kg-*/kg-*.vue`）；小程序 `miniapp-native/miniprogram/components/kg-*/`。
> 标记同 SPEC：`[生产]` / `[仓内]` / `[官方]` / `[待核]`。

---

## 0. 复用/自研总表

判断顺序：① 库里有且能靠 `--wot-*`/`--td-*` 变量对齐 token → 直接用；② 库里有但要在 5+ 个页面重复写同一组 props/class → 薄封装；③ 库里没有、或库的实现与作答场景冲突（如选项组）→ 自研。

| 组件 | H5 | 小程序 | 依据 |
|---|---|---|---|
| 按钮 | `wd-button` + 薄封装 `KgButton` | `t-button` + 薄封装 `kg-button` | 8 处 `wd-button` + 18 个文件自写 `.btn`（`research/03` Top20 #2）；两库都有 4 类型 3 尺寸 |
| 输入 / 搜索 | `wd-input` / `wd-search` 直接用 | `t-input` / `t-search` 直接用 | 现 5 处裸 `<input>`（login ×3 / join / search），全是自写样式 |
| chip / tag | `wd-tag`（tag）；`KgChipRow`（横向滚动筛选行，自研） | `t-tag` / `t-check-tag`；`kg-chip-row` | 11 文件自写 chip；库 tag 没有「横滚 + 右渐隐 + 单选」 |
| 卡片 | `KgCard`（自研薄壳） | `.card` 工具类（现有）→ `kg-card` | 27 文件 `.card` 4 种圆角 2 种阴影；`wd-card` 是带标题栏的业务卡，不合用 |
| 列表行 | `wd-cell` / `wd-cell-group` 直接用 | `t-cell` / `t-cell-group` 直接用 | `profile.vue` 已用 wd-cell 且是最干净的页（4 个色值） |
| 分段控件 | `wd-segmented` 直接用 | 自研 `kg-segmented`（TDesign 1.9.7 无 segmented，`t-tabs` 语义不同） | 6 文件自写 `.seg` |
| 底部操作条 | `KgActionBar`（自研） | `kg-action-bar` | 库无此物；exam `.navrow` / practice `.banner` / 12 处 mask+sheet 各写一份 |
| 空态 | `KgEmptyState`（自研，不用 `wd-status-tip`） | `t-empty` + 薄封装 `kg-empty` | `wd-status-tip` 从 npmmirror 拉远程插图（`urlPrefix` 默认 registry.npmmirror.com，`[仓内]` 1.14.0 `types.ts`）——不可控网络依赖；小程序 `t-empty` 支持 slot 图标 |
| 骨架屏 | `wd-skeleton` 直接用 | `t-skeleton` 直接用 | 现只 2 页有自写骨架 |
| Toast | `uni.showToast` 封装为 `toast.js`（规则层，非组件） | `wx.showToast` 封装 `utils/toast.ts` | 218 / 62 处直接调用，规则不统一 |
| 弹层 / sheet | `wd-popup` + 薄封装 `KgSheet` | `t-popup` + `kg-sheet` | 12 处自写 mask/sheet、4 种遮罩色 |
| 进度 | `KgProgress`（自研，线性/环形） | `t-progress`（线性）；环形自研 | wot `wd-progress`/`wd-circle` 可用但 6 处进度条的高度/槽色需统一，且深色漏网在槽色 |
| 图标 | `l-icon`（现有，加 `tone`） | 新建 `l-icon`（同 paths） | SPEC §5.2 |

**为什么 H5 空态不用 `wd-status-tip`**：它的价值是自带插图，而插图来自远程 CDN；我们空态只要 Lucide 图标 + 一句话 + 一个按钮，插图是负资产（加载慢、深色不适配、风格不统一）。
**为什么小程序要扩大 TDesign 使用**（open question #2）：它已经在 `package.json` 里，`miniprogram_npm` 构建产物已在包内，「装了不用」是最差状态——付了体积不拿收益。扩到 button/empty/skeleton/toast/tag/cell/popup/progress 8 个，视觉全部靠 `--td-*` 映射（SPEC §6.3），不改库源码。不扩到 `t-tabs/t-tab-bar/t-navbar`（现有 custom-tab-bar/navbar 已适配 Skyline 与安全区，换掉是增风险）。

---

## 1. 基础组件

每个组件给：结构 / props / 尺寸间距 / 状态 / 复用页面 / 现有实现 / 库映射。尺寸全为 px。

### 1.1 按钮 `KgButton` ← `wd-button` / `t-button`

**4 级 × 3 尺寸 × 6 状态。**

| 级别 `variant` | 用途 | 底 | 字 | 边 | 按压 |
|---|---|---|---|---|---|
| `primary` | 页面唯一主行动 | `--brand` | `--on-brand` | — | 底 `--brand-press` |
| `secondary` | 次要行动（与 primary 并排） | `--brand-soft` | `--brand-text` | — | 底 `--brand-soft-2` |
| `ghost` | 弱行动、取消 | `--card` | `--ink-2` | 1px `--line` | 底 `--fill` |
| `text` | 行内链接式（「查看全部 ›」） | 透明 | `--brand-text` | — | 字 `--brand-press` |

危险动作（删除错题、退出）：`variant="ghost" tone="bad"`（字与边用 `--bad-strong`），不单设 danger 级。

| 尺寸 `size` | 高 | 字号 | 水平 padding | 圆角 | 用途 |
|---|---|---|---|---|---|
| `lg` | 44 | `--fs-body` / 600 | 24 | `--r-full` | 底部操作条、hero 主按钮、空态 CTA、登录 |
| `md` | 36 | `--fs-body` / 500 | 16 | `--r-full` | 卡内行动、sheet 内 |
| `sm` | 32 | `--fs-sub` / 500 | 12 | `--r-full` | 列表行右侧、chip 旁；命中区用 `::after` 扩到 44 |

`block` 撑满；图标用 `l-icon` `--icon-md`（sm 用 `--icon-sm`），图标与文字 gap `--sp-8`。

状态：default / pressed（底色深一档，`--dur-instant`）/ disabled（整体 `opacity: .4`，`pointer-events: none`，**不改色**）/ loading（`wd-button loading`，文字保留，禁点）/ focus-visible（桌面 2px `--brand` outline，offset 2）/ hover（≥1024 才有，底色 = pressed 色）。

Props：`variant: 'primary'|'secondary'|'ghost'|'text'`，`size: 'lg'|'md'|'sm'`，`tone?: 'brand'|'bad'`，`block`，`disabled`，`loading`，`icon?`；事件 `click`。

映射：H5 `KgButton` 内部渲染 `<wd-button :type :size :plain :block :loading :disabled custom-class>`（primary→`type=primary`；secondary→`type=primary plain`（wot plain 底透明，`custom-class` 加 `--brand-soft` 底）；ghost→`type=default`；text→`type=text`；lg/md/sm→`large/medium/small`，高度在 `tokens.generated.css` 用 `--wot-button-large-height: 44px; --wot-button-medium-height: 36px; --wot-button-small-height: 32px`（wot 默认 44/36/28，`[仓内]` `variable.scss` L135–151）。小程序 `kg-button` 渲染 `<t-button theme="primary|light|default" size="large|medium|small" variant="base|text">`（`[待核]` 1.9.7 t-button 的 `theme/variant` 取值，foundation 对 `tdesign-miniprogram/miniprogram_dist/button/props.js` 核）。

现有实现：`wd-button` ×8（profile/reminders/login 等）；自写 `.btn/.hero-btn/.paper-btn/.empty-btn` 等 18 文件（`research/03` §6.1）；小程序 `app.wxss:142 .btn-primary`（渐变、700 字重、26rpx 竖 padding → 全部改）。

命中区：`sm`（32）/`md`（36）视觉高度低于 `--hit-min`（44），`KgButton` 用 `::after` 把可点区上下扩到 44（wot 默认 `overflow:hidden` 与 text 变体 `::after{display:none}` 一并覆写）；`md` 去掉 wot 自带 `min-width:120`，宽度由内容+padding 决定（行内工具位如错题本「筛选/批量」放不下，且会挤压同排分段控件）。

**取舍**：为什么不直接裸用 `wd-button` 而要 `KgButton`：4 级到 wot `type/plain` 的映射不是一一对应（secondary 需要 custom-class），18 个文件各自翻译一遍就是现状；薄封装 30 行。为什么主按钮不用渐变：小程序 v2 与 home hero 用渐变按钮，但渐变没有对应的 press 态（深一档渐变要再造两个 raw 色），Khan/Duolingo/Brilliant 主按钮全是平色（`research/01` §3）。

### 1.2 输入 / 搜索 ← `wd-input` / `wd-search` / `t-input` / `t-search`

- 输入框：高 44，底 `--fill`，圆角 `--r-sm`，字 `--fs-body` `--ink`，placeholder `--ink-4`，focus 边 1px `--brand`；错误态边 `--bad` + 下方 `--fs-sub --bad-strong` 提示（**inline，不用 toast**，SPEC 提示决策表）。带清除按钮。
- 搜索框：`wd-search` 高 36（`--wot-search-input-height`），胶囊 `--r-full`，底 `--fill`，左 Lucide `search` `--icon-md --ink-3`；`search.vue` 的 `focus` 自动聚焦保留。
- 邀请码 / 手机号这类 6–11 位输入：`type=number`、`maxlength`、字母数字用 `.num`（tabular）。
- 复用：`pkgA/user/login`（3 个）、`pages/team/join`、`pkgA/search`、`pages/ask` 底部输入（这个用 `KgActionBar` 的输入变体，见 1.7）。
- 现有：全部裸 `<input class="input|join-input|sinput">`，无 focus 态、无错误态。
- 库变量：`--wot-input-fs: var(--fs-body); --wot-input-cell-padding: 10px; --wot-search-input-height: 36px; --wot-input-placeholder-color: var(--ink-4)`。

### 1.3 Chip / Tag

两个东西，别混：**chip 可点（筛选/选择）**，**tag 只读（状态/分类）**。

**Tag ← `wd-tag` / `t-tag`**：高 20，字 `--fs-caption` 500，水平 padding 8，圆角 `--r-xs`，无边。`tone`：`brand`（`--brand-soft`/`--brand-text`）、`ok`（`--ok-soft`/`--ok-strong`）、`bad`、`warn`、`neutral`（`--fill`/`--ink-3`）、`module`（`--mod-*-soft`/`--mod-*`，用于模块标；图标+文字）。真题 tag = `warn`（修 `practice.vue:2551` 漏网）。映射 `wd-tag :type :color :bg-color` → 只传 `custom-class`，颜色由 class 内 token 决定，不传 hex。

**Chip（自研 `KgChipRow`）**：横向滚动单选行。chip 高 32，胶囊，字 `--fs-sub` 500，padding 0 14；未选 `--card` 底 + 1px `--line` + `--ink-2` 字；选中 `--brand` 底 + `--on-brand` 字（`book.vue:1699–1700` 现值即此，保留）；按压 `--fill`。行右侧 24px 渐隐（`mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent)`，小程序 `[待核]` mask-image 支持，退化为不渐隐）。
Props：`options: {value,label,count?,icon?}[]`，`modelValue`，`size?: 'md'|'sm'`(32/28)，`scrollToSelected`。
复用：book（模块筛选）、exam/list（年份/类型）、favorites、discuss、practice-history、mastery-map、search、shenlun；小程序 book。
现有：`.chip` 11 文件（`research/03` Top20 #5）。

### 1.4 卡片 `KgCard`（自研薄壳）

- 底 `--card`，圆角 `--r-md`，padding `--sp-16`，卡间距 `--sp-12`（上下相邻）。
- `variant`：`flat`（默认：1px `--line` 描边，无阴影）/ `raised`（`--sh-1`，无描边；用于 hero、续练卡、悬浮提示）/ `soft`（`--fill` 底，无边无影；用于卡内嵌套块、提示）。**描边与阴影不并用**（现 `exam/list .card` 两者都有）。
- 可点卡：整卡 `hover-class`→底 `--fill`（flat）/ 抬到 `--sh-2`（raised，≥1024 hover 同）。右侧 chevron `l-icon chevron-right --icon-md --ink-4`。
- 选中卡（错题多选、答题卡）：边 `--brand` + `box-shadow: 0 0 0 2px var(--brand-soft)`（`book.vue:1730 .mcard.bsel` 现值）。
- slots：`header`（可放 `KgSectionHeader`）/ 默认 / `footer`。Props：`variant`, `clickable`, `selected`, `padding?: 16|12`。
- 嵌套：卡内块圆角 = `--r-xs`（6）或 `--r-sm`（10），不得 ≥14。
- 现有：`.card` 27 文件（4 种圆角、2 种阴影），`App.vue --radius 28rpx`；小程序 `app.wxss:103 .card`（`--r-l` 18px、`padding 32rpx`、`--sh-1`）。
- 为什么不用 `wd-card`：它是「标题 + 内容 + 底部」的业务卡，带自己的标题栏样式，我们 27 处卡有 20+ 处没有标题栏。

### 1.5 列表行 ← `wd-cell` / `wd-cell-group` / `t-cell` / `t-cell-group`

- 直接用库。高 ≥52（`--wot-cell-line-height 24` + 上下 padding 14），左 padding 16，标题 `--fs-body --ink`，右值 `--fs-sub --ink-3`，箭头 `--ink-4`，分割线 `--line` 左缩进 16，按压底 `--fill`。
- 行内左图标：`l-icon --icon-md`，底 `--brand-soft` 32×32 圆角 `--r-xs`（profile 现状风格）。
- 带开关的行：`wd-switch`（补深色 `--wot-switch-*` 映射，修 reminders 漏网）。
- 复用：profile、reminders、settings 类；小程序 profile。
- 库变量：`--wot-cell-title-fs: var(--fs-body); --wot-cell-value-fs: var(--fs-sub); --wot-cell-padding: 16px; --wot-cell-tap-bg: var(--fill); --wot-cell-border-color: var(--line)`。
- 自写列表（错题卡、卷卡、讨论条目）不是「列表行」，是复合卡（§2）。

### 1.6 分段控件 ← `wd-segmented` / 小程序自研 `kg-segmented`

- 高 36，外底 `--fill` 圆角 `--r-sm`，内 padding 3；选中项 `--card` 底 + `--sh-1` + `--ink` 600，未选 `--ink-2` 500；切换 `--dur-fast`。2–4 项，等宽。（`book.vue:1721–1723 .seg` 现值即此结构，沿用。）
- 与 chip 的分界：**≤4 项互斥视图切换用分段；>4 或带计数/图标的筛选用 chip 行。**
- 复用：book（今日复习/全部）、shenlun、search（范围）、mastery-map（视图）、favorites、login（登录/注册）。
- H5 映射 `wd-segmented :options v-model size="middle"`，变量 `--wot-segmented-*` `[待核]` 是否暴露高度/圆角变量；不够则 `custom-class`。

### 1.7 底部操作条 `KgActionBar`（自研，三端同构）

`position: fixed; bottom: 0; z-index: var(--z-bar)`，底 `--card`，顶 1px `--line`，内 padding `12 16`，`padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px))`，进场 `--dur-base --ease-decel` 上滑。≥1024 时 **不再 fixed**，改为随主列底部 sticky（`exam.vue:606` 现有做法）。

三个变体（props `layout`）：
- `actions`：1 个 primary lg + 最多 1 个 ghost lg（左 ghost 右 primary，gap 12；单个时 primary block）。用于：结算页、报告页、sheet 底、错题多选。
- `answer`（= 调研里的 `KgAnswerBar` / `q-action-bar`，Khan 模式）：左 进度 `N/M` `.num --fs-sub` + 进度点/细条（4px，`--brand-soft-2` 槽 `--brand` 填）；中 图标按钮组（标记 `bookmark`、排除 `eye-off`、收藏 `star`，`--icon-lg` 44×44 命中区）；右 primary lg「下一题/提交」。作答后左侧区域切换为「正确答案 B」文案（`practice.vue:2680 .banner` 现行为）。练习与模考**共用**（`research/03` Top20 #12：两页标记/排除交互不一致）。
- `input`：ask 页底部输入（`wd-input` + 发送 icon 按钮 lg），键盘弹起随动。

页面内容底部要留 `padding-bottom: 88px + safe-area`（组件 expose `height`，或用固定 class `.has-bar`）。
现有：`exam.vue:563 .navrow`、`practice.vue:2680 .banner`、ask 输入条、book 多选底条、shenlun 提交条，5 份。

### 1.8 空态 `KgEmptyState`（自研）/ 小程序 `t-empty` + `kg-empty`

结构：Lucide 图标（`--icon-xl` 32，底 `--fill` 64×64 圆，图标 `--ink-3`）→ 标题 `--fs-body 500 --ink` → 一句说明 `--fs-sub --ink-3`（≤2 行）→ CTA `KgButton primary lg`（**必有**，除纯只读结果外）→ 可选 `text` 级次链接。上下 padding `--sp-32`，居中，最大宽 280。
`compact` 变体（卡内空态）：横排，图标 `--icon-lg`，padding `--sp-16`，CTA 用 `sm`。
Props：`icon`, `title`, `desc?`, `ctaText?`, `ctaTo?`（url 或事件）, `secondaryText?`, `compact`.
规则：未登录态 → 文案讲清能得到什么 + 「登录」CTA；无数据 → 指向能产生数据的动作（「去刷 10 题」而不是「暂无数据」）；CTA 必须指向**存在的页面**（修 `exam/report` 空态指向不存在的「模考记录」）。
现有：`.empty` 16 文件、6 种 CTA 规格（`research/03` §2 #3）。目标：CTA 规格 = 1 种（lg）+ compact 1 种（sm）。

### 1.9 骨架屏 ← `wd-skeleton` / `t-skeleton`

- 骨架块底 `--fill`，圆角 `--r-xs`，行高 = 对应字阶行高，shimmer 用库默认（`--dur-slow` ×3 循环）；`prefers-reduced-motion` 下静止。
- 只在 ≥300ms 仍未返回时显示（避免闪）；首屏 hero/列表首 3 项给骨架，其余不给。
- 规则：**加载态用骨架，不用 spinner**（除按钮 loading）；空态与骨架互斥。
- 三套预设（props `preset`）：`hero`（一块 120 高）/ `cards`（3 张 88 高）/ `lines`（标题 + 3 行）。
- 现有：home / practice 各一份自写。

### 1.10 Toast 规则（`frontend-uni/src/toast.js` / `miniprogram/utils/toast.ts`，函数不是组件）

| 场景 | 用什么 | 不用什么 |
|---|---|---|
| 操作成功且无后续（已收藏、已复制） | `toast.ok(text)`：1.5s，icon `check`，≤10 字 | 不用 modal |
| 网络/同步失败但可自动重试（离线队列） | 顶部横幅 `KgBanner`（`--info-soft`/`--warn-soft`，可关） | 不用 toast（会消失，用户看不到状态） |
| 表单校验 | 输入框下 inline 错误 | 不用 toast |
| 需要用户选择（退出保留进度） | `uni.showModal` / `t-dialog`，标题 ≤12 字 + 两按钮 | 不用 toast |
| 结算/成绩 | 页面或 sheet | 不用 toast |
| 长任务（导出 PDF） | 按钮 loading + 完成后 `toast.ok` | 不用 `showLoading` 全屏遮罩超过 3s |

同屏最多 1 个 toast；`duration` 固定 1500（成功）/ 2500（错误文案）；文案不带句号；不用 toast 报 5xx 细节。现状 218 处直接 `uni.showToast`（`research/04` §7）。H5 用 `wd-toast` 还是 `uni.showToast`：**继续 `uni.showToast`**，wot toast 需要每页放 `<wd-toast>` 占位组件，32 页 ×1 是增实体。

### 1.11 弹层 `KgSheet` ← `wd-popup position="bottom"` / `t-popup placement="bottom"`

- 顶圆角 `--r-lg`（20），顶部 36×4 拖柄 `--line`，标题 `--fs-h3` 600 + 右上关闭 `x --icon-lg`，内 padding `16 16 (16+safe)`，`max-height: 70vh` 内滚，遮罩 `--mask`，进出 `--dur-base --ease-decel/accel`；底部若有行动用 `KgActionBar layout=actions`（非 fixed，随 sheet）。
- ≥1024：宽 480 居中改为 dialog 形态（`position="center"`，圆角 `--r-lg`）。
- 复用：home 题型 sheet、practice 设置/答题卡、exam 答题卡、book 筛选/导出、shenlun、team、mastery-map、weekly-report、contest —— 现 12 处 mask+sheet，4 种遮罩色。
- 层级：`--wot-popup-z-index` 对齐 `--z-overlay`（`[待核]` 变量名）。

### 1.12 区块标题 `KgSectionHeader`（自研，10 行）

左 `--fs-h3` 600 `--ink`，右 `text` 级按钮「查看全部 ›」（44 高命中区，`--fs-sub --ink-3`）；上 margin `--sp-24` 下 `--sp-12`。现 `home.vue:1302 .sec-h` 等 8+ 份。

### 1.13 进度 `KgProgress`（自研）/ 小程序 `t-progress` + 环形自研

- 线性：高 4（细，hero/卡内）或 8（模块进度），槽 `--brand-soft-2`（深色 `#24345c`，**修 mastery-map / exam 两处 `rgb(238,241,247)/(219,230,255)` 漏网**），填 `--brand` 或 `--mod-*`，圆角 `--r-full`，填充动画 `--dur-slow --ease-decel`（reduced-motion 下无动画）。
- 环形：直径 48 / 72 / 96，描边 6，`conic-gradient`（现有做法），中央 `.num`。
- 必带 `aria-label` / 文本读数（`research/04` §5 图表可及性）。
- 现有：hero-bar、mod-bar、cold-bar、exam .progress、stats ring —— 6 处各写。

### 1.14 图标 `l-icon`（现有，加 `tone` + 尺寸收敛）

见 SPEC §5.2。Props 变化：`size: 16|20|24|32`（其他值 dev 下 warn），新增 `tone: 'ink'|'ink-2'|'ink-3'|'ink-4'|'brand'|'ok'|'bad'|'warn'|'on-brand'|'module:<key>'`，`color` prop 保留但标记 deprecated（页面组必须迁到 `tone`）。实现：组件内读 `getComputedStyle` 不可行（小程序），改为 `tone → 变量名` 表 + 在 `App.vue`/`app.wxss` 生成文件里为每个 tone 输出一份浅/深实色（`--icon-tone-brand: #2e5bff` …），组件按当前主题取值（H5 读 `theme.js` 状态，小程序 `wx.getSystemInfoSync().theme` + `onThemeChange`）。

---

## 2. 复合组件

由 §1 组合而成；页面只传数据，不写样式。每个给：结构 / props / 复用页 / 现有实现。

### 2.1 题目卡 `KgQuestionCard` + 选项组 `KgOptionGroup` + 解析卡 `KgAnalysisCard`

三件套拆开是因为模考页不显示解析、分享页/错题详情不需要可点选项、申论只要题干。

**`KgQuestionCard`**（`KgCard variant=flat`）
- 头部 meta 行（新增，`research/03` 建议 P1 / 对标 `docs/design-benchmark/report.md` §2）：`KgTag module` + 考点 `--fs-sub --ink-3`（可点 → 同考点练习）+ 难度 ★×n `--warn` + 全站正确率 `.num --fs-sub`（`attempt_count ≥ 5` 才显示，`q-stat.js` 现有口径）+ 真题 `KgTag warn`。
- 材料（资料分析/同材料题组）：`soft` 块可折叠，`同材料题组 i/K` tag（`.grp-tag` 现有）。
- 题干：`--fs-body`×用户档（`font-size.js` 三档保留）、`--ink`、行高 1.7、`line-break: strict; overflow-wrap: anywhere`；题号 `.num --ink-3`。
- 图片：`<image mode="widthFix">` 圆角 `--r-sm`，可点放大。
- Props：`q: {id, module, submodule, tag3, stem, material?, images?, difficulty?, accuracy?, isReal?, groupSeq?}`, `index`, `total`, `fontLevel`, `showMeta`.
- 现有：`practice.vue` 题面区（L100–135 段）、`exam.vue`、`share-q.vue`、`book.vue` 错题卡、小程序 `practice.wxml/exam.wxml`。

**`KgOptionGroup`**
- 选项行：`KgCard`-like 行，圆角 `--r-sm`，边 1px `--line`，padding `12 16`，行距 `--sp-12`，左 26×26 圆字母 `.num --fs-sub` 600（底 `--fill`），文字 `--fs-body`（×用户档）`--ink-2` 行高 1.6。
- 状态：`idle` / `selected`（边 `--brand`，底 `--brand-soft`，字母底 `--brand` 白字）/ `right`（边 `--ok`，底 `--ok-soft`，字母 `--ok` 白字 + `check`）/ `wrong`（`--bad` 系 + `x`，`shake` 0.3s）/ `dim`（其他项 `opacity .5`）/ `excluded`（长按排除：`opacity .45` + 删除线，`practice.vue:2640` 现有）/ `disabled`（只读展示）。切换 `--dur-fast`；`right` 的 `pop` 过冲动画是 SPEC §5.1 允许的唯一例外。
- 多选（判断推理多选/申论选择）`multiple`；键盘 A–D、Enter 下一题（H5 现有 `a11y-focus.js` 行为保留）。
- Props：`options: {key,text,image?}[]`, `modelValue`, `answer?`, `revealed`, `excluded: string[]`, `multiple`, `readonly`, `fontLevel`; 事件 `select`, `exclude`.
- 现有：`practice.vue:2624–2720 .opt*`、`exam.vue` 选项、`share-q`、小程序 `practice.wxss`。

**`KgAnalysisCard`**（作答后 / 错题详情）
- `KgCard variant=soft`（`--brand-soft` 底可选），标题行「正确答案 **B**」`--fs-h3` + 你的答案 tag（对 `ok` / 错 `bad`）；正文 Markdown（`md.js` 现有）`--fs-body --ink-2` 1.7；**默认折叠 3 行**，「展开解析」text 按钮（`research/01` 借鉴 #9：解析卡默认折叠）；底部数据行：全站正确率 · 易错项 · 平均用时（**需后端 `avg_secs`**，`[待核]` 接口，无则隐藏）；来源 `--fs-sub --ink-3`；考点链 chip。
- 社交行：`q-social-bar`（现有组件 `components/q-social-bar/`）放在解析卡底部，不重写。
- Props：`answer`, `picked?`, `analysis`, `stats?: {accuracy, wrongTop?, avgSecs?}`, `source?`, `tags?`, `collapsed`.
- 现有：`practice.vue:135 .after` 区块、`book.vue` 详情、小程序 practice 解析区（缺数据/考点/来源三行，`research/03` §7）。

### 2.2 练习入口卡 `KgModuleCard`

- 一行式（首页模块列表现状）：左 `l-icon module:<key>` 44×44 底 `--mod-*-soft` 圆角 `--r-sm`（**修首页 5 个 `.mod-ico` 深色漏网**），中 名称 `--fs-body 600` + 副文 `--fs-sub --ink-3`（「已练 120 · 正确率 72%」），右 `KgProgress` 线性 60×4 或 chevron。整卡可点 → practice。高 72。
- 网格式（`grid`，华图 4 卡模式，`research/01` 借鉴 #10）：2 列，每卡 高 96，图标 32 + 名称 + 一行副文；用于首页「更多练习」（模考 / 申论 / 错题重练 / 时政）。
- 数据源：`module-meta.js` 的 label/icon/color，**页面不再持有 COLORS**。
- Props：`module: key`, `layout: 'row'|'grid'`, `progress?: {done,total,acc}`, `badge?`（今日新增/待复习数）.
- 复用：home、practice 结算页「换模块」、offline、小程序 home。现有：`home.vue:1326–1329 .mod-*`、`offline.vue`、小程序 `home.wxml` 模块区。

### 2.3 卷卡 `KgPaperCard`（模考/真题卷、申论卷）

- `KgCard flat clickable`。标题 `--fs-body 600 --ink` ≤2 行；meta 行 tags：年份/地区（`neutral`）、题量·时长 `--fs-sub --ink-3`、状态 tag（未做 / 进行中 / 已完成 `ok` + 分数 `.num`）。
- **只有 1 个主行动**（右下 `KgButton md primary`：开始 / 继续 / 查看报告），其余（重做 / 只练错题 / 导出 PDF）收进右上 `more-horizontal` 图标 → `KgSheet` 菜单。修 `exam/list` 每卡 3 个等权按钮 ×120 卡 = 360 按钮（`[生产]` `research/03` §2 #5）。
- 置顶卡：边 `--brand`（`list.vue:338 .paper.pinned` 保留，去掉品牌色阴影）。
- Props：`paper: {id, title, year?, region?, count, minutes, status, score?, pinned}`, `primaryAction`, `menu: []`.
- 复用：exam/list、shenlun、profile「最近模考」、contest；小程序 exam（卷列表）。现有：`list.vue:317–348 .paper*`、`shenlun.vue`、小程序 `exam.wxml`。

### 2.4 统计数字卡 `KgStatCard` / 数字行 `KgStatRow`

- `KgStatRow`：一行 2–4 个 KPI，每个：数值 `.num --fs-h1`（24）`--ink` + 单位 `--fs-sub --ink-3` + 标签 `--fs-sub --ink-3`；分隔 1px `--line`；`trend?` 用 `--ok-strong`/`--bad-strong` 小箭头 + 数值。用于 hero 内、报告页顶。
- `KgStatCard`：单个 KPI 独立卡（`KgCard flat`），数值 `--fs-h1`，可带 mini 图（`KgProgress` 环 48）。2 列网格。
- 0 数据：不显示 `0`/`--`，整卡替换为 `KgEmptyState compact`「再答 N 题解锁」（`research/03` 第三刀）。
- Props：`items: {label, value, unit?, trend?, tone?}[]`。
- 复用：stats hero、weekly-report、exam/report、contest-report、practice-history、profile；小程序 stats、exam/report。现有：`stats.vue:915 .hero-kpis`、`report.vue` `.hero-meta`、`weekly-report`、小程序 `stats.wxss .kpi`。

### 2.5 Hero 进度卡 `KgHeroCard`

- `KgCard raised`，底 `--brand-grad`（**全站唯一允许渐变的地方**），圆角 `--r-lg`（外层最大），padding `--sp-20`，所有文字 `--on-brand`（次级用 `rgba(255,255,255,.85)`，这是组件内 token `--on-brand-2`，不是页面裸值）。
- 结构：左上 标签 `--fs-sub`（「今日目标」）+ 右上 `KgStreakBadges`；中 大数字 `.num --fs-display`（32）+ `/20 题` `--fs-body`；`KgProgress` 4px 白槽；底部 1 个 `KgButton lg`（白底 `--brand-text` 字，`variant=primary tone=inverse`）+ 可选 1 个 ghost（白 16% 底）。**最多 2 个按钮**（首页现 hero + 4 个「开始刷题」入口，`[生产]` `research/03` §2 #2）。
- 变体 `plain`：`--card` 底（统计页 hero 现状），用于非首页。
- Props：`label`, `value`, `total?`, `unit?`, `progress?`, `primary: {text, to}`, `secondary?`, `streak?`, `variant: 'brand'|'plain'`.
- 复用：home（今日目标/续练合一）、stats、exam/report 分数 hero（`variant=brand`，数值 = 分数）、contest-report；小程序 home/stats/report。现有：`home.vue:1286–1299 .hero*`（`#5b8af8` 裸值 + 品牌阴影）、`stats.vue:911`、`report.vue:688–693`（`88rpx/800` 分数）、小程序 `home.wxss .hero`。

### 2.6 成绩报告块 `KgReportSection`

报告页（exam/report、contest-report、weekly-report、practice 结算）共用的分区：
- `KgSectionHeader` + `KgCard flat`，内容三种 `kind`：
  - `modules`：每模块一行：`KgTag module` + 名称 + `KgProgress` 8px（填 `--mod-*`）+ 右 `.num` 正确率/用时 + 与全站均值差（`exam-mod-avg.js` 现有）`--ok-strong/--bad-strong`；
  - `answers`：答题卡网格，每格 40×40 圆（`exam.vue:580 .acard-n` 现值），`ok-soft/bad-soft/fill` 三态 + 标记角标，点击跳题解析；
  - `advice`：≤3 条建议，每条 `l-icon --icon-md --brand` + 一句 `--fs-body --ink-2` + text 按钮。
- 空态：`KgEmptyState compact`，CTA 指向真实页面（exam/list）。
- 桌面 ≥1024：`answers` 网格上辅栏，`modules/advice` 在主列（PAGES §2）。
- Props：`kind`, `title`, `data`, `more?`.
- 现有：`report.vue` 分区、`contest-report.vue`、`weekly-report.vue`、`practice.vue` 结算段（`.redoreport/.fixreport`）、小程序 `exam/report`。

### 2.7 其他薄组件（调研 §6.4 清单里剩余项）

- `KgStreakBadges`：连续打卡火焰 + 天数 `.num`，颜色 `--streak`（组件私有 token，SPEC §2.2）；home hero、profile、小程序 home。
- `KgBanner`：顶部横幅（网络/同步/公告），`--info-soft`/`--warn-soft`，`l-icon` + 一行文字 + 关闭；替代 home 公告条与离线提示条。
- `predict-card` / `rank-card` / `export-confirm` / `q-social-bar`（`frontend-uni/src/components/` 现有 4 个）：保留，foundation 只做 token 化（去裸值、字重 700→600、圆角/间距对 token），不改 props。

---

## 3. 尺寸速查（组件层常量，写进 `tokens.generated.*` 的 `/* component */` 块）

| 名 | 值 | 用在 |
|---|---|---|
| `--btn-h-lg / md / sm` | 44 / 36 / 32 | KgButton、wot/td 按钮变量 |
| `--input-h` | 44 | 输入框 |
| `--chip-h` | 32 | KgChipRow |
| `--tag-h` | 20 | KgTag |
| `--cell-h` | 52 | wd-cell / t-cell |
| `--bar-h` | 64（+safe） | KgActionBar，页面底部预留 |
| `--card-pad` | 16 | KgCard |
| `--card-gap` | 12 | 卡间距 |
| `--page-x` | 16 | 页面左右留白 |
| `--opt-letter` | 26 | 选项字母圆 |
| `--acard-cell` | 40 | 答题卡格 |
| `--hit-min` | 44 | 最小命中区 |

---

## 4. 取舍一览

| 决策 | 选 | 不选 | 理由 |
|---|---|---|---|
| 按钮 | `KgButton` 薄封装 wot/td | 裸用库 / 全自研 | 4 级↔库类型非一一对应；18 文件各译一遍即现状 |
| 主按钮视觉 | 平色 + press 深一档 | 渐变 / 3D 底边（Duolingo） | 渐变无 press 态；3D 需自研（增实体） |
| 空态 H5 | 自研 `KgEmptyState` | `wd-status-tip` | 远程插图依赖；我们只需图标+CTA |
| 小程序库 | TDesign 扩到 8 个组件 | 仅 login / 全自绘 | 已付体积；自绘 13 页是现状问题 |
| 分段（小程序） | 自研 | `t-tabs` | 语义与视觉都不是 tabs |
| Toast H5 | `uni.showToast` + 规则层 | `wd-toast` | 每页要放占位组件 |
| 作答条 | 练习/模考共用 `KgActionBar layout=answer` | 各自控件 | 两页标记/排除交互不一致 |
| 选项组 | 自研 | `wd-radio-group` / `t-radio` | 对错着色、排除、过冲动画、键盘，库 radio 都没有 |
| 卷卡按钮 | 1 主 + 菜单 | 3 等权 | 360 按钮/页 |
| 图表 | `KgProgress` + 现有 conic/canvas | ECharts / uCharts / `wd-circle` | SPEC §8 |
| 现有 4 组件 | 保留 + token 化 | 重写 | 不增实体 |

---

## 5. Open questions（不阻塞）
1. TDesign 扩大使用的范围（默认 8 个，见 §0）。
2. `KgAnalysisCard` 平均用时依赖后端 `avg_secs`（`question_stats` 表是否已有 `[待核]`；无则本轮隐藏该列）。
3. 小程序 `mask-image` 渐隐、`prefers-reduced-motion`、`this.animate` 在真机/Skyline 的表现，foundation 在开发者工具 + 一台 Android 真机验。
4. `l-icon` 深色取值方案（组件内查表 vs 生成两套 data-uri）默认查表；若 60 个图标 ×10 tone ×2 主题的 base64 计算有性能问题再换。
5. `KgHeroCard` 是否保留渐变（默认保留，是全站唯一渐变）。

## 附录 · 证据
- wot 1.14.0 组件目录 102 项、`wd-button` 类型 `primary|success|info|warning|error|default|text|icon` 与尺寸 `small|medium|large`、`wd-segmented size large|middle|small`、`wd-status-tip urlPrefix`、`wd-tag type`：本轮从 `unpkg.com/wot-design-uni@1.14.0/components/**/types.ts` 读取。
- tdesign-miniprogram 1.9.7 目录 80 项（含 `button cell empty popup progress skeleton tag toast`，无 `segmented`）：本轮从 jsdelivr 文件清单读取；组件 props 取值 `[待核]`。
- 现有实现行号：`practice.vue:2551/2624–2720/2680/2787`、`home.vue:1286–1329`、`exam/list.vue:317–348`、`exam/report.vue:686–693`、`exam/exam.vue:563/578–582/606`、`stats.vue:910–915`、`book.vue:1680–1779`、`app.wxss:103/142/153/163–179`、`components/*`（本轮 rg）。
- 页面重复统计：`research/03-our-pages-audit.md` §6.1 表、Top20。
