# 答岸 · 视觉识别系统（VIS）v1

> 唯一事实源：`tools/design-tokens/tokens.json`（编译产物 `frontend-uni/src/static/tokens.css`、`miniapp-native/miniprogram/styles/tokens.wxss` 等 6 个文件，`node tools/design-tokens/build.mjs --check` 校验）。
> 本文回答「看起来像答岸」的全部规则；组件清单见 [COMPONENTS.md](COMPONENTS.md)，页面结构见 [PAGES.md](PAGES.md)，落地页补充口径见 `landing/DESIGN.md`。

## 0. 设计哲学

**严格扁平、功利主义（flat, utilitarian）**。深度靠底色分层和 hairline 描边表达，不靠投影。观感锚点：像一张放大的微信小程序原生界面，而不是营销站。

- DNA 供体：IBM Carbon（无阴影、单一品牌蓝、底色分层）× Vercel（hairline 哲学）× Duolingo（按压微交互，仅按钮）。
- 一句话检验：**白卡 + 1px 描边 + 实色按钮 + 零渐变零投影**。
- 三端同口径：小程序（tdesign-miniprogram + kg-*）、H5（wot-design-uni + Kg*/kg-*）、落地页（静态页）共用同一 tokens，用户在任何端看到的东西必须像同一个产品。

## 1. 标志系统

**图形标「对勾旗上岸」**：岸上插旗、旗杆即「对勾」——答对 → 上岸，一笔双关。扁平单色（品牌蓝底白形 / 单色白底 / 透明蓝标）。当前以 AI 生图 PNG 为母版：`brand/mark-blue.png`、`mark-white.png`、`lockup-src.png`（SVG 为嵌 PNG 过渡壳，待矢量化）。

**字标**：「答岸」三字，字重 700；英文标 `DAAN` 全大写、+0.08em 字距、12px 级。

**吉祥物「岸仔」**：白色圆角小人 + 品牌蓝学士帽，仅用于营销/空状态/分享物料，不进界面组件层。文件：`brand/mascot-*.png`。

**禁则**：不改比例、不换非品牌色、不置于渐变/照片底上；最小清晰尺寸 24px；图形标四周安全区 ≥ 标高 1/4。

## 2. 色彩系统

### 2.1 品牌蓝（唯一 accent）

| token | 值 | 用途 |
|---|---|---|
| `--brand` | `#2e5bff` (brand.500) | 按钮底、选中态、链接、主强调 |
| `--brand-press` | `#1e44d9` (brand.600) | 按压/hover 深化、按压阴影色 |
| `--brand-text` | `#1e44d9` → 深色 `#8fa8ff` | 蓝底白字之外的「蓝色文字」 |
| `--brand-soft` | `#eef3ff` → 深色 `#1e2a4a` | 浅蓝底（选中底、标签底、图标容器） |
| `--brand-soft-2` | `#dbe6ff` → 深色 `#24345c` | 次浅蓝底、进度槽、hover 描边 |
| `--on-brand` / `--on-brand-2` | `#fff` / `rgba(255,255,255,.78)` | 蓝底上的文字两级 |

**纪律**：全屏只允许一个 accent 色。品牌蓝大面积使用仅限：主 CTA、数据带、选中态——不铺背景、不做渐变（`--brand-grad` 仅登录/品牌时刻专用）。

### 2.2 中性阶 ink（文字与界面灰）

`ink.900 #17181c` 正文 → `ink.700 #40434e` 次要文 → `ink.500 #6b7280` 辅助/占位 → `ink.300 #b0b4c0` 弱提示/禁用 → `ink.200 #e7e9f0` **hairline 描边/分隔线** → `ink.100 #f2f3f7` → `ink.50 #f6f7fb` 页面底。

近黑不纯黑：`--ink`=#17181c，禁用 `#000`。

### 2.3 功能色（每色三态：本体/strong 文字/soft 底）

| 语义 | 本体 | strong | soft | 深色 |
|---|---|---|---|---|
| ok 成功/正确 | `#16a34a` | `#15803d` | `#ecfdf5` | `#4ade80`/`#0e2b1e` |
| bad 错误/淘汰 | `#dc2626` | `#b91c1c` | `#fef2f2` | `#f87171`/`#331416` |
| warn 警示/计时 | `#d97706` | `#b45309` | `#fffbeb` | `#fbbf24`/`#33230e` |
| streak 连续打卡 | `#ff8a3d` | — | `#fff1e8` | `#3a2418` |

用法：**soft 底 + strong/本体文字**，本体色只用于图标、小色块、进度条实心段。

### 2.4 模块色（五大行测模块固定色，不可改）

| 模块 | 色 | soft | 深色 soft | 图标 |
|---|---|---|---|---|
| 资料分析 | `#0d9488` | `#e6f5f3` | `#0e332f` | chart-pie |
| 数量关系 | `#2e5bff` | `#e8effe` | `#1c2742` | calculator |
| 言语理解 | `#e11d48` | `#fce8ec` | `#3b1520` | message-square |
| 判断推理 | `#7c3aed` | `#f1eafd` | `#291f45` | puzzle |
| 常识判断 | `#d97706` | `#fbf1e0` | `#3a2b0e` | lightbulb |

生成 `module-meta.js/.ts`，四端（home/practice/discuss/favorites）共用，禁写死色值。

### 2.5 皮肤槽（用户可换，accent.json 三选）

`default` 品牌蓝 / `forest` 森林绿 `#16a34a` / `sunset` 暖橙 `#ea580c`，每套覆盖 brand/press/grad/text/soft/soft2 及深色映射。存 `kg_theme_accent` → `theme_pref` 多端同步。

### 2.6 深色模式

`night` 阶：bg `#15161c` → card `#1d1f28` → `#23252f` → 描边 `#2b2e3a` → 文字 `#c3c7d4`/`#8a8ea0`。每个语义色有独立 `$dark` 映射（见 tokens sem 层），**禁自动反色/禁压暗浅色底硬凑**。

## 3. 字体系统

字族：`-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`；数字专用 `.num` 字族 `ui-monospace, "SF Mono", Consolas, monospace`（计时器/分数/题号等宽对齐）。

**字阶 7 档**（token `fs.*`，值 px；rpx=px×2 且必须为偶数）：

| token | px | lh | 用途 |
|---|---|---|---|
| display | 26 | 1.2 | 大盘数字/开屏 |
| h1 | 20 | 1.25 | 页面主标题 |
| h2 | 17 | 1.3 | 区块标题 |
| h3 | 15 | 1.3 | 卡片标题/题干加粗 |
| body | 13 | 1.55 | 正文/题干 |
| sub | 12 | 1.45 | 次要说明 |
| caption | 12 | 1.4 | 标签/角标 |

**字重纪律**：400 正文、500 次要强调、600 标题与按钮（主力）、700+ 仅大盘数字与落地页展示字（≤800）。

## 4. 图形语言

| 元素 | 规则 |
|---|---|
| 圆角 | `r.xs 6`（tag/chip）· `r.sm 10`（按钮内件）· `r.md 14`（卡片标准）· `r.lg 20`（大容器/sheet）· `r.full 999`（pill 按钮/chip）——**不新增圆角值** |
| 描边 | 唯一分隔手段：`1px solid --ink-200`（#e7e9f0）；深色 `--night-600` #2b2e3a。禁虚线、禁双侧描边、禁左侧竖线装饰 |
| 阴影 | **产品内零阴影**。唯一例外：主按钮按压阴影 `0 3px 0 brand-press`（实色偏移零模糊，`:active` 塌落至 `0 1px 0`+translateY 2px） |
| 图标 | Lucide 线性族，尺寸 `icon.sm 16 / md 20 / lg 24 / xl 32`，描边 1.8，`l-icon` 的 `tone` 属性取语义色 |
| 动效 | `dur.instant 100 / fast 150 / base 250 / slow 400`ms；`ease.standard (0.2,0,0,1)` 默认 / `decel` 入场 / `accel` 离场。禁弹性曲线、禁 hover 位移缩放 |

## 5. 空间与栅格

间距 token `sp.*`：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48（8px 基准栅格，4 为最小步进）。

| 组件口径 token | 值 | 含义 |
|---|---|---|
| `--page-x` | 16 | 页面左右安全边距 |
| `--card-pad` | 14 | 卡片内边距 |
| `--card-gap` | 10 | 卡片纵向间距 |
| `--cell-h` | 44 | 列表行高 |
| `--hit-min` | 44 | 最小可点区域 |
| `--tab-h` | 52 | tabbar 高（不含安全区） |
| `--btn-h-lg/md/sm` | 40/32/30 | 按钮三档 |
| `--input-h` 40 · `--chip-h` 28 · `--tag-h` 18 · `--bar-h` 60 · `--opt-letter` 22 · `--acard-cell` 36 | | |

断点 `bp.md 768 / lg 1024 / xl 1366`：H5 ≥1024 用 `kg-two-col` 双栏（内容列+侧栏），<768 单列。落地页区块节奏 76-84px、网格 gap 20-28。

## 6. 组件规范（口径级，清单见 COMPONENTS.md）

- **按钮**：pill `r.full`；primary=实色 brand+按压阴影，secondary=白底 hairline，ghost=无底 hairline，text=纯文字。三档高度 40/32/30。
- **卡片**：`kg-card` 白底+hairline，`variant=flat`（标准）/ `selected`（brand-soft 底+brand 边）。**无 raised 投影变体**——raised 语义=hairline 加深。
- **tag/chip**：`kg-tag` 高 18、soft 底+strong 字；`kg-chip-row` 横滚筛选 chips、选中态 brand-soft+brand 字。
- **分段器**：`kg-segmented`/`wd-segmented`（真题卷|模考大赛、全部|没考过|考过的），sm 尺寸、ink-100 底+pill 选中块。
- **sheet**：`kg-sheet` 底部弹层，r.lg 顶圆角 + hairline 顶边，遮罩 `rgba(23,24,28,.45)`。
- **空态**：`kg-empty`/`kg-empty-state`：l-icon 40px ink-300 + h3 标题 + sub 描述 + 可选 CTA。
- **骨架**：`kg-skeleton`/`t-skeleton` 段落式，ink-100 底 gradient 扫光——禁 spinner 满屏转。
- **导航**：`navbar` 56px 纯色底+hairline 底边；tabbar 52px+safe-area，选中 brand 色。
- **答题卡**：`opt-letter` 22px 字母圈、选中=brand 实色、对错=ok/bad 语义色。
- **进度**：`kg-progress` track=`--prog-track`（brand-100/深色 night-600）、fill=brand。

## 7. 状态覆盖（所有可交互元素必备）

| 状态 | 规则 |
|---|---|
| hover（H5） | 只改 `border-color → brand-soft-2` 或底色 → soft；**禁 translateY/scale/投影** |
| active/按压 | 按钮塌落（见 §4）；卡片 `bg → ink-50` |
| focus-visible | `2px solid brand` outline + 2px offset |
| disabled | `ink-300` 文字 + `ink-100` 底 + `cursor: not-allowed`，不删元素只降级 |
| 选中 | `brand-soft` 底 + `brand` 字/边 |
| ::selection | `brand-soft-2` 底 |
| reduced-motion | 关全部过渡/平滑滚动（`prefers-reduced-motion` media 全覆盖） |

## 8. 页面类型骨架

- **Tab 主页**（练题/错题/统计/我的）：navbar → 内容卡列（card-gap 10）→ tabbar；首屏卡可为 brand-soft 数据卡。
- **详情/作答页**（刷题/模考）：顶部进度条或题号器 → 题干卡 → 选项组 → 底部 `kg-action-bar`；无装饰元素。
- **列表页**：筛选区（segmented+chip-row）→ 卡列表 → 「加载更多」ghost 按钮；空态走 §6 规范。
- **落地页**：单独口径见 `landing/DESIGN.md`——是同一 VIS 的营销放大版，不是另一套皮肤。

## 9. 物料规范

- **favicon/app icon**：`brand/icon-*.png`（144–1024），对勾旗标白形蓝底，无文字。
- **截图壳**：白底 + hairline + 8px padding，r.lg 比例圆角——禁黑色手机壳 mockup。
- **OG/分享卡**：`scripts/gen_og_card.py` 生成，纯色底+白砖蓝标+标题，1200×630。
- **PDF 导出**：页眉 logo+卷名，水印「答岸」，答案区用 ok/bad 色。

## 10. 视觉溯源（2026-10 研究，8 站逐字拆解）

采纳：IBM Carbon 无阴影底色分层 · Vercel hairline 哲学 · Duolingo 按压按钮+横滚 chips · Mintlify/Khan pill CTA · Carbon 列分隔 hairline。
已拒绝并记档：IBM 全直角、Brilliant 衬线、Wise 900 billboard、hover scale、Notion 暖灰、Vercel shadow-as-border。
完整报告：`acc-db/vis-study.html`（会话交付件）。

## 11. Definition of Done（新页面/组件自查）

1. 只引用 `sem` 层变量，无色值硬编码（lint `lint-pages.mjs` 兜底）；
2. 零阴影/零渐变/零新圆角值；分隔只用 `--ink-200` hairline；
3. 深色模式 `.theme-dark` 下逐元素过一遍（sw/描边/soft 底都要换）；
4. 可点元素 ≥44px、focus-visible 有品牌环；
5. 数字用 `.num` 等宽；模块色只用 `mod` 层；
6. tokens 改动走 `build.mjs` 生成，`--check` 必须过。
