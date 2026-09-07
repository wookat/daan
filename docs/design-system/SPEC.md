# 设计规范 v4 · Token 体系与一源多端

> 状态：待 foundation 实施。本文是四路调研（`research/01`–`04`）的收口，只写决定与取舍，证据一律回指调研文档、仓库文件或官方链接。
> 适用端：H5（`frontend-uni/`，uni-app + wot-design-uni 1.14）、微信小程序（`miniapp-native/`，原生 TS + tdesign-miniprogram 1.9）。Flutter 作为第三个生成目标，本轮只留接口不做验证。
> 配套：[COMPONENTS.md](COMPONENTS.md)（组件）、[PAGES.md](PAGES.md)（页面架构与四组实施边界）。
> 标记：`[生产]` 在 kaogong.zalize.com 实测；`[仓内]` 仓库代码；`[官方]` 官方文档；`[待核]` 本轮未验证、foundation 必须先核。

---

## 0. 十条硬规则（先看这个，其余是解释）

1. **颜色只允许 `var(--…)`**。页面 `<style>`/`.wxss` 不得出现 `#hex`、`rgb()`、`rgba()`（渐变、`box-shadow` 也走 token）。现状 H5 32 页 157 个色值、小程序 100 个（`research/03` §6）。
2. **字号只有 7 档**，写 px（`--fs-*`），禁止 rpx 字号、禁止 11px 及以下、禁止 18/19/21/26 等档间值。
3. **字重只有 400 / 500 / 600**。`700/800/bold` 全部替换为 600（依据：PingFang SC 无 Bold、Android 中文只映射 400，`research/04` §1.3）。
4. **间距只有 9 个值**：4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48（px）。
5. **圆角只有 5 档**：6 / 10 / 14 / 20 / 999，且**外 > 内**。
6. **阴影只有 3 层**（外加 `none`）。深色模式不用阴影，用表面提亮。
7. **动效只有 4 个时长 + 3 条曲线**；作答反馈 ≤150ms；`prefers-reduced-motion` 一律降级。
8. **图标只有 Lucide，尺寸 16 / 20 / 24 / 32**。
9. **语义色「亮档」只做图标/背景，作文字必须用 `-strong`**（对比度实测见 §2.6）。
10. **token 唯一来源是 `tools/design-tokens/tokens.json`**。`uni.scss` / `App.vue` / `app.wxss` 只 import 生成文件，不手写值；生成文件带「禁止手改」头，`--check` 不过则 lint 失败。

---

## 1. 体系结构：三层，不多不少

```
原始层 raw       color.brand.500 = #2e5bff        ← 只在 tokens.json 出现，页面禁止引用
语义层 semantic  --brand = {color.brand.500}      ← 页面/组件唯一允许引用的层
                 --brand-press = {color.brand.600}
组件层 component --wot-button-primary-bg-color: var(--brand)   ← 只在 App.vue / app.wxss 做库变量映射
```

**为什么三层而不是两层**：Khan Academy（`--wb-semanticColor-action-primary-progressive-press-background`）与 Brilliant（`--panda-colors-bg-success-primary/-hover/-active/-disabled`）都把交互态放进语义层，页面从不接触原始色阶（`research/01` §借鉴 #1–#3）。我们现状是 H5 `uni.scss` 有原始层 `$kg-primary-*`、`App.vue` 有语义层 `--brand`，但小程序页面直接用 `--brand-500` 这种原始名（`pages/**/*.wxss` 里 `var(--t3)` 63 处、`--brand-500` 多处），所以三端同一个「主色」在小程序是 `--brand-500`、H5 是 `--brand`、Flutter 是 `KgColors.brand`，值还不一样（`research/02` §2）。三层的意义就是：**页面只认语义名，换色只改一处**。

**为什么不采用 TDesign / Wot 的 token 名作为我们的语义层**：两套库前缀不同（`--td-*` / `--wot-*`），任选一套另一端就得翻译；并且库变量是「组件层」粒度（`--wot-cell-title-fs`），不是产品语义。做法是反过来：库变量映射到我们的语义层（§6.3）。

**命名**：沿用 H5 现有语义名（`--brand / --ink / --ok / --bad / --warn / --info / --line / --fill / --card / --bg`），不加 `kg-` 前缀。理由：H5 `pages/ + pkgA/ + components/` 现有 1,316 处 `var(--…)` 引用（其中 `var(--ink*)` 608 处，本轮 rg 统计），改前缀是纯机械 churn；与 `--wot-*`/`--td-*` 不会撞名。小程序现有 `--t1/--t2/--success/--border/--surface/--r-*` 在过渡期以别名指向新名（§6.4），页面组按 PAGES.md 逐页替换。

---

## 2. 色彩

### 2.1 品牌原始色阶（raw，页面禁止引用）

上游是 `@zalize/brand`（`frontend-uni/src/static/brand/zalize-tokens.css`，由 `scripts/sync-brand-tokens.mjs` 同步，禁止手改）。`tokens.json` 的 `color.brand.*` 抄录上游值并在 `build.mjs --check` 里比对，值漂移即报错。

| 阶 | 值 | 现状对应 |
|---|---|---|
| 50 | `#eef3ff` | `uni.scss $kg-primary-50` / `app.wxss --brand-50` |
| 100 | `#dbe6ff` | 同上 100 |
| 200 | `#b8ccff` | 同上 200 |
| 300 | `#8aa9ff` | `app.wxss --brand-300`（H5 缺） |
| 400 | `#5c82ff` | `app.wxss --brand-400`；**H5 `$kg-primary-500` 写的是这个值——阶位错位，v4 纠正** |
| 500 | `#2e5bff` | 主色。`App.vue --brand` / `app.wxss --brand-500` / `zalize --zl-brand-600` |
| 600 | `#1e44d9` | `$kg-primary-700` / `--brand-600` |
| 700 | `#1735ab` | `--brand-700` |

**决策：主色 `#2e5bff`，不是 `#3B6FF5`**。三端里 H5、小程序、`@zalize/brand` 都是 `#2e5bff`，只有 Flutter `theme.dart:5` 与 `docs/design-v3/DESIGN.md` §3.1、`docs/design/miniapp-v2/tokens.md` 写 `#3B6FF5`（`research/02` §2）。按「品牌 token 唯一来源是 zalize-brand 仓」规则取 `#2e5bff`；后续修 Flutter 与两份旧文档。这是 open question #1，但**不阻塞**：token 生成时颜色先按 `#2e5bff` 出。

### 2.2 语义色（semantic，页面唯一允许引用）

每个 token 四列：名 / 浅色值 / 深色值 / 用途；最后一列是禁止用法。对比度数字用 `research/04` 附录 A 脚本算（WCAG 2.2 公式）。

#### 品牌
| token | 浅 | 深 | 用途 | 禁止 |
|---|---|---|---|---|
| `--brand` | `#2e5bff` (500) | `#2e5bff` | 主按钮底、选中态边框、进度条、链接图标。白字在其上 5.18:1 ✓ | 深色下**不得作文字/细线**（对 `#1d1f28` 卡只 3.17:1），文字用 `--brand-text` |
| `--brand-press` | `#1e44d9` (600) | `#1e44d9` | 主按钮 `:active` / `hover-class`、选中态按压 | 不用 `opacity` 做按压（粉笔 `:hover{opacity:.8}` 是反例，`research/01` §3） |
| `--brand-text` | `#1e44d9` (600) | `#8fa8ff` | 品牌色文字、`--brand-soft` 上的字（6.55:1）、深色下的链接与图表线（7.20:1） | 不作大面积背景 |
| `--brand-soft` | `#eef3ff` (50) | `#1e2a4a` | ghost 按钮底、选中 chip 底、解析卡浅底 | 其上不得放 `--brand`（对比 3.9:1，作文字不达标），放 `--brand-text` |
| `--brand-soft-2` | `#dbe6ff` (100) | `#24345c` | 进度槽、热力图 lv1、hero 内浅块 | — |
| `--brand-grad` | `linear-gradient(135deg, #5c82ff, #2e5bff)` | 同 | **仅** hero 卡背景 | 不用于按钮（v4 主按钮平色，见 COMPONENTS §1.1） |

`--brand-strong`（现 `#1d4ed8`）并入 `--brand-text`：两者用途重叠（都是「浅底上的品牌字」），值相差一档。过渡期别名保留。

#### 状态色（ok / bad / warn / info）
四组同构，各 3 个 token：亮档（图标/背景/边）、`-strong`（文字、实心按钮底）、`-soft`（浅底）。

| token | 浅 | 深 | 用途 | 禁止 |
|---|---|---|---|---|
| `--ok` | `#16a34a` | `#16a34a` | 答对边框、对勾图标、进度条 | **作文字**（对白 3.30:1 ✗，仓内 14 处要改） |
| `--ok-strong` | `#15803d` | `#4ade80` | 答对文字、绿色实心按钮底（白字 5.02:1） | — |
| `--ok-soft` | `#ecfdf5` | `#0e2b1e` | 答对选项底、已掌握 tag 底 | — |
| `--bad` | `#dc2626` | `#dc2626` | 答错边框、叉图标（对白 4.83 作文字勉强可，仍建议 `-strong`） | 深色作文字 |
| `--bad-strong` | `#b91c1c` | `#f87171` | 答错文字、danger 按钮底 | — |
| `--bad-soft` | `#fef2f2` | `#331416` | 答错选项底、待复习 tag 底 | — |
| `--warn` | `#d97706` | `#d97706` | 警示图标、时政暖色点缀 | **作文字**（3.19:1 ✗，仓内 9 处） |
| `--warn-strong` | `#b45309` | `#fbbf24` | 警示文字、低置信标注 | — |
| `--warn-soft` | `#fffbeb` | `#33260e` | 真题 tag 底（修 `practice.vue:2551` `#fef3c7` 漏网） | — |
| `--info` | `#0284c7` | `#0284c7` | 信息图标 | 作文字（4.10:1 ✗） |
| `--info-strong` | `#075985` | `#7dd3fc` | 信息文字 | — |
| `--info-soft` | `#f0f9ff` | `#0e2233` | 信息横幅底 | — |

**取舍**：小程序现值 `--success #10b981 / --error #f43f5e / --warning #f59e0b / --info #0ea5e9` 全部弃用，改用 H5 值。理由：小程序这组作文字对比 2.54 / — / 2.15 / 2.77，全不达标且 23 处在用（`research/04` §6.8）；H5 值与 design-v3 一致。**不**用 TDesign 的 `--td-success-color`（`#00b578` 系）：换成第三套值没有收益。

小程序独有的 `--accent-500 #ff8a3d / --gold #f5b83d`（打卡火焰、徽章）**降为组件 token**：只在 `KgStreakBadges` 内部使用，命名 `--streak` / `--streak-soft`，不进入语义层通用色。白字在 `#ff8a3d` 上 2.35:1，禁止做实心按钮（`research/04` §6.8 末行）。

#### 中性色
| token | 浅 | 深 | 用途 | 禁止 |
|---|---|---|---|---|
| `--ink` | `#17181c` | `#f2f3f7` | 标题、题干、主要数字 | — |
| `--ink-2` | `#40434e` | `#c3c7d4` | 正文、解析、选项文字（9.86:1） | — |
| `--ink-3` | `#6b7280` | `#8a8ea0` | 辅助说明、时间、来源（对白 4.83、对 `--bg` 4.52，贴线） | **不要再降**；不用于 12px 以下 |
| `--ink-4` | `#b0b4c0` | `#5c6070` | placeholder、禁用文字、装饰性图标（2.07:1） | **任何需要阅读的文字**。仓内 9 处 `color: var(--ink-4)` 逐条核 |
| `--line` | `#e7e9f0` | `#2b2e3a` | 分割线（1px）、平铺卡描边、进度槽 | 不与阴影同时用在同一卡 |
| `--fill` | `#f2f3f7` | `#23252f` | 输入框底、未选 chip 底、骨架块、禁用底 | — |
| `--card` | `#ffffff` | `#1d1f28` | 卡片/面板表面 | — |
| `--bg` | `#f6f7fb` | `#15161c` | 页面底 | — |
| `--mask` | `rgba(23,24,28,.45)` | `rgba(0,0,0,.6)` | 遮罩 | 现状 4 种遮罩色全部收敛到此（`research/03` Top20 #11） |
| `--on-brand` | `#ffffff` | `#ffffff` | 品牌底/实心按钮上的文字与图标 | 不写 `#fff` 字面量 |

**为什么 `--ink-2` 从 H5 现值 `#5f6575` 改为 `#40434e`**：现状 `--ink-2 #5f6575` 与 `--ink-3 #6b7280` 亮度几乎一样（两者对白 5.9 vs 4.8），三级文字实际只有两级可辨；`#40434e` 是 `uni.scss $kg-text-2` 与 design-v3 `t2` 的原值，`App.vue` 那次改动没有同步。这是 open question #3（会让全站正文略深）。

**为什么不用 alpha 黑白做中性色**（Brilliant 做法，`research/01` 借鉴 #4）：alpha 文字叠在 `--brand-soft`/`--ok-soft` 这类彩色浅底上会偏色，且小程序 `<image>` 渲染的 Lucide 图标不支持 `currentColor`（`research/04` §5），alpha 无法传给图标。用实色成对定义更可控，代价是深色值要单独维护 —— 由生成脚本保证成对。

#### 模块色（五大模块）
单一来源 `frontend-uni/src/module-meta.js`（foundation 新建）与 `miniapp-native/miniprogram/utils/module-meta.ts`，两者都由 `tokens.json` 的 `color.module.*` 生成，替代现有 4 份 `COLORS` 表（`home / practice / discuss / favorites`，两套色值，`research/03` §2 #1 ⑥）。

| 模块 | `--mod-*` 主色 | `--mod-*-soft` 浅 / 深 | 备注 |
|---|---|---|---|
| ziliao 资料分析 | `#0d9488` | `#e6f5f3` / `#0e332f` | 对白 3.74:1 —— 只做图标/条形，文字用 `--ink` |
| shuliang 数量关系 | `#2e5bff` | `#e8effe` / `#1c2742` | = `--brand` |
| yanyu 言语理解 | `#e11d48` | `#fce8ec` / `#3b1520` | |
| panduan 判断推理 | `#7c3aed` | `#f1eafd` / `#291f45` | |
| changshi 常识判断 | `#d97706` | `#fbf1e0` / `#3a2b0e` | = `--warn` |

主色取 design-v3 §3.1 / `uni.scss $kg-mod-*`（H5 已在用）；弃用小程序 v2 的 `#14b8a6 / #f43f5e / #8b5cf6 / #f59e0b`。**规则**：模块色只出现在模块图标底、模块 tag、模块条形图，**不做页面主色、不做按钮**（design-v3 §3.1 原话）。

### 2.3 深色映射规则

- H5：`.theme-dark uni-page-body { … }`（三档设置见 `frontend-uni/src/theme.js`，class 挂 `html`）。小程序：`@media (prefers-color-scheme: dark) { page { … } }` + `app.json darkmode: true`（现状如此，不改机制）。
- **只替换语义层的值**，原始层不变、组件层不变（组件层引用语义层自然跟随）。这就是 6 处深色漏网（`research/03` §3.5）的根治：它们全是页面写了原始值。
- 深色不是反色：品牌/状态亮档不变，文字档提亮（`--brand-text #8fa8ff`、`--ok-strong #4ade80`），浅底换深底。每个深色对都过一遍对比度（§2.6）。
- 深色**不用阴影**：`--sh-1/2/3` 在深色下输出 `none`，层次靠 `--card` 比 `--bg` 亮一档（`#1d1f28` vs `#15161c`，已如此）。
- wot 组件深色：`App.vue` 已有 8 个 `--wot-*` 覆盖；v4 补 `--wot-switch-*`（修 `reminders` 页 wd-switch 轨道 `rgb(234,234,234)` 漏网）。TDesign 自带 `prefers-color-scheme` 整包覆盖（`research/02` §4），只需把 `--td-brand-color-*` 映射到我们的值。

### 2.4 禁止用法汇总（颜色）
- 页面写 `#hex/rgb/rgba` → stylelint（H5）/ 简单 rg 脚本（小程序）拦截，见 §7。
- 用 `opacity` 做按压态；用 `--ink-4` 写可读文字；`--ok/--warn/--info` 亮档作文字。
- `--brand` 直接用于深色下的文字/细线。
- 引用原始阶（`--brand-500`、`$kg-primary-600`）—— 过渡期别名存在，但新代码不许写。

### 2.5 z-index（新增，四档）
`--z-sticky 10`（吸顶筛选行）/ `--z-bar 50`（固定底部操作条，`exam.vue:563 .navrow` 现值）/ `--z-overlay 100`（遮罩+sheet）/ `--z-toast 200`。wot `wd-popup`/`wd-toast` 的默认层级 `[待核]`（本机未装 node_modules），foundation 用 `--wot-*` 变量对齐到这四档。参照 Brilliant 十档（`research/01` 借鉴 #7），我们四档够用。

### 2.6 对比度验收表（生成脚本内置断言）
`build.mjs --check` 跑以下断言，任一不达标则失败：正文对 `--card`/`--bg` ≥4.5（`--ink/--ink-2/--ink-3/--brand-text/--*-strong`，浅+深）；`--on-brand` 对 `--brand`、`--*-strong` ≥4.5；图标/边框 `--brand/--ok/--bad/--line-strong` 对 `--card` ≥3。当前值全部通过（本轮实算：`--ink-2` 9.86、`--brand-text` 浅 6.55（对 soft）/ 深 7.20、`--ok-strong` 对 `--ok-soft` 4.76、`--bad-strong` 对 `--bad-soft` 5.91、`--warn-strong` 对 `--warn-soft` 4.84、`--info-strong` 对 `--info-soft` 7.09）。`--ok-strong` 对 `--ok-soft` 4.76 贴线，不要再调浅。

---

## 3. 字阶

### 3.1 七档（px 优先；rpx 仅作 375 换算参考，全部偶数）

| token | px | rpx@375 | 行高 | 字重 | 用途 | 禁止 |
|---|---|---|---|---|---|---|
| `--fs-display` | 32 | 64 | 1.2 | 600 | 模考分数、hero 今日已练大数字（配 `.num`） | 正文、标题 |
| `--fs-h1` | 24 | 48 | 1.25 | 600 | 页面级标题（报告页「成绩报告」）、统计卡数字 | 卡片标题 |
| `--fs-h2` | 20 | 40 | 1.3 | 600 | hero 标题、结算卡标题 | — |
| `--fs-h3` | 17 | 34 | 1.3 | 600 | 导航栏标题、区块标题（`KgSectionHeader`）、卡片标题 | 正文 |
| `--fs-body` | 15 | 30 | 1.55 | 400 / 500 强调 | 正文、题干（基准档，题干 ×`font-size.js` 用户档）、选项、按钮 lg/md、cell 标题 | — |
| `--fs-sub` | 13 | 26 | 1.45 | 400 / 500 | 辅助说明、来源、时间、按钮 sm、chip | — |
| `--fs-caption` | 12 | 24 | 1.4 | 500 | tag、tabbar、图例、徽标 | **≤11px 一律禁止**（现 `$kg-font-caption 22rpx` = 11px 删除） |

**与调研的差异说明**：`research/04` 建议 8 级（display 28 / h1 22 / h2 17 / body-lg 16 / body 15 / sub 13 / caption 12 / num 24–40）。本文改为 7 档 32 / 24 / 20 / 17 / 15 / 13 / 12，理由：① 用户要求 ≤7；② 28/22 两档在 375 下对应 56/44rpx 与现有 hero 数字（`uni.scss $kg-font-num 56rpx`=28、小程序 v2 hero 40px）、统计卡数字（v2 26px）都对不上，需要额外的 `num` 档才能覆盖，反而超 7；32/24 直接吃掉「大数字」和「统计数字」两个用途；③ `body-lg 16` 只服务题干，而题干本来就走 `font-size.js` 的用户三档缩放（现 13/15/17px 口径），不需要独立 token。design-v3 §3.2 的 24/20/17/15/13/12 与本表 h1 以下完全一致。

**数字样式 `.num`**：不是字号档，是修饰：`font-variant-numeric: tabular-nums; line-height: 1.1; font-weight: 600; letter-spacing: -0.01em`。用于倒计时、分数、正确率、统计数字。小程序 `.num` 现 `font-weight: 800` 改 600。

**题干/解析排版**（`KgQuestionCard` 内部，页面不重复写）：`line-height: 1.7; line-break: strict; overflow-wrap: anywhere; word-break: normal`；flex 子项 `min-width: 0`。**删除全部 `word-break: break-all`**（H5 9 处，`research/04` §1.5：它会掰开题干里的英数串）。

### 3.2 字重
只允许 `400 / 500 / 600`。生成 `--fw-regular 400 / --fw-medium 500 / --fw-semibold 600`。H5 110 处、小程序 46 处 `700|bold`、小程序 `.sec-t/.num/.btn-primary` 的 `800` 全部改 600（`research/04` §1.3；小程序 v2 稿「hero 数字有意用 800」的意图由 `--fs-display` 的尺寸对比承担，不靠字重）。

### 3.3 字体栈
`Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'HarmonyOS Sans', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif`（`App.vue:119` 现值，与 `@zalize/brand` 一致），小程序同栈写进 `page`。不加载任何中文 Web 字体。

### 3.4 禁止
- `font-size: Nrpx`（现 1,020 条 rpx 字号声明，307 条奇数，`research/03` Top20 #4）。
- 页面写 `font-size: 14px` 之类的裸 px（`mastery-map.vue` 12/14px 是反例）。
- 用 `transform: scale()` 缩小文字。

---

## 4. 间距、圆角、阴影、布局

### 4.1 间距（8 基准，4 为半步）
| token | px | 用途 |
|---|---|---|
| `--sp-4` | 4 | 图标与文字间隙、tag 内水平 padding 的一半 |
| `--sp-8` | 8 | chip 之间、按钮内图标与文字、列表行内竖向间隙 |
| `--sp-12` | 12 | **卡片之间**、按钮之间、列表行竖向 padding |
| `--sp-16` | 16 | **页面左右留白**、**卡片内 padding**、列表行水平 padding |
| `--sp-20` | 20 | hero 卡内 padding |
| `--sp-24` | 24 | 区块之间、桌面双栏 gap |
| `--sp-32` | 32 | 空态上下留白、登录页大留白 |
| `--sp-40` | 40 | 结算页 hero 与内容间 |
| `--sp-48` | 48 | 桌面页面顶部留白 |

命名用值而不用序号（`--sp-3`）：读到 `--sp-16` 就知道是 16px，不必查表；现有 `uni.scss $kg-space-1…8` 是序号制且是 rpx（8/16/24/32/40/48/64/96rpx = 4…48px），过渡期别名映射。**禁止**：6 / 10 / 14 / 18 / 28 / 36 等非表内值；`margin: 30rpx` 这类 rpx 间距（改 px，理由同字号：R383 记录的奇数 rpx 亚像素问题）。

小程序端间距也用 px。取舍：rpx 的本意是让 375 稿在 414 屏等比放大，但 16px 页边距在 414 屏变成 17.7px 没有任何设计价值，反而让 1px 线在 3× 屏变 0.67px；TDesign 小程序 spacer 也是 px（`research/02` §4 `_spacer.wxss`）。

### 4.2 圆角（外 > 内）
| token | px | 用途 | 嵌套规则 |
|---|---|---|---|
| `--r-xs` | 6 | tag、徽标、进度条端（细条用 999） | 最内层 |
| `--r-sm` | 10 | 按钮（非胶囊）、输入框、chip（非胶囊）、选项行 | 卡内元素 |
| `--r-md` | 14 | **卡片**（默认，= `App.vue --radius 28rpx` 现值） | 页面级容器 |
| `--r-lg` | 20 | 底部 sheet 顶角、hero 卡、模态框 | 最外层 |
| `--r-full` | 999 | 胶囊按钮、chip、头像、细进度条 | — |

同心规则：内元素圆角 = 外圆角 − 内边距（卡 14、padding 8 → 内块 6）。**主按钮统一胶囊 `--r-full`**：现状胶囊 33 文件 vs 9–10px 圆角 5 文件 vs `var(--radius)` 11 文件（`research/03` Top20 #2），少数服从多数。小程序 `--r-l 36rpx(18px)` 卡片改 14，`--r-xl 48rpx(24)` 改 20 —— 这是刻意收敛，不是漂移。

### 4.3 阴影（3 层）
| token | 浅 | 深 | 用途 |
|---|---|---|---|
| `--sh-1` | `0 2px 8px rgba(23,24,28,.06)` | `none` | 悬浮卡（hero、续练卡）；平铺卡默认**无阴影** 用 1px `--line` 描边或底色差 |
| `--sh-2` | `0 8px 24px rgba(23,24,28,.12)` | `none` | 底部 sheet、下拉、popover、桌面 hover 抬升 |
| `--sh-3` | `0 12px 32px rgba(23,24,28,.18)` | `none` | 模态框、toast |

**决策：不保留品牌色投影**（`--sh-brand`、`rgba(46,91,255,.25/.3/.45)` 5 种）。理由：Khan/Brilliant 主按钮无投影靠 `press` 深一档反馈；小程序 v2 稿的 `sh-brand` 是审美选择而非信息，且和「阴影 ≤3 层」冲突。`research/01` 借鉴 #12 建议「阴影基色改品牌冷调 rgba(46,91,255,.08)」，本文不采纳：冷调阴影在 `--warn-soft`/`--ok-soft` 彩底卡上会显脏，中性 ink 阴影通用。这是 open question #4。

### 4.4 边线
`--line` 宽 **1px**（不是 `2rpx`/`0.5px`）。卡内列表用 inset 分割线（左缩进 16 对齐内容），卡之间不画线靠 12px 间距。

### 4.5 断点与桌面双栏
| token | 值 | 行为 |
|---|---|---|
| `--bp-md` | 768 | ≥768：底部 tabbar 变 208px 左侧栏（`App.vue:263` 现有），内容单列居中 max 640 |
| `--bp-lg` | 1024 | ≥1024：**双栏**，主列 640–720 + 辅栏 320，gap 24；壳体 max 1140（现在这个值挂在 `App.vue:314` 的 1280 断点上，v4 提前到 1024） |
| `--bp-xl` | 1366 | ≥1366：主列可到 760，壳体 1280（`App.vue:341` 现值） |

收敛：删 `700px` 断点（`App.vue:228`，并入 768）；`1280` 断点删除，其壳宽 1140 规则前移到 1024（1024–1279 现在没有限宽，内容拉满，`[生产]` 1440 截图里 1280 以下未测）。哪些页面双栏、辅栏放什么，见 PAGES.md §2。题干列宽不超过 760px（`research/04` §3.2）。

### 4.6 安全区与触控
- 固定底栏：`padding-bottom: calc(var(--sp-12) + env(safe-area-inset-bottom, 0px))`，SCSS `@mixin kg-safe-bottom`、WXSS `.safe-b`；小程序自定义 tabBar 用 `wx.getWindowInfo().safeArea`（`custom-tab-bar/index.ts` 现未引用 `safeArea`，本轮 rg 确认，foundation 补）。
- 触控目标 ≥ 44×44px（按钮 sm 32px 高时用 `padding` 或 `::after` 扩展命中区到 44）。

---

## 5. 动效与图标

### 5.1 动效 token
| token | 值 | 用途 |
|---|---|---|
| `--dur-instant` | 100ms | 按压反馈、chip 切换 |
| `--dur-fast` | 150ms | 选项对错着色、hover、icon 切换（**作答反馈上限**） |
| `--dur-base` | 250ms | sheet 进出、卡片展开、tab 切换 |
| `--dur-slow` | 400ms | 结算卡进场、进度条从 0 到值 |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 默认（M3 standard） |
| `--ease-decel` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | 进场 |
| `--ease-accel` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | 退场 |

现 `uni.scss $kg-ease cubic-bezier(.2,.8,.2,1)` 过渡期别名指向 `--ease-standard`（曲线略不同，视觉可接受）；`practice.vue:2630` 的 `pop 0.35s cubic-bezier(0.2,0.8,0.2,1.4)` 过冲动效保留为 `KgOption` 内部唯一的例外，时长改 `--dur-base`。来源：M3 motion tokens、Apple HIG Motion（`research/04` §4.1）。

规则：动画不作为唯一信息载体（对错必须有颜色+图标+文字）；`@media (prefers-reduced-motion: reduce)` 全局降级（`App.vue:138` 已有，小程序 `[待核]` 真机是否响应）；小程序动效只用 WXSS `transition/animation` 或 `this.animate()`，**禁止 `setData` 驱动帧动画**；当前 `renderer: webview`，切 Skyline 前需先补 `line-break/overflow-wrap/font-variant-numeric` 的替代（Skyline 不支持，`research/04` §1.6）。不引入 Lottie。

### 5.2 图标
| token | px | 描边 | 用途 |
|---|---|---|---|
| `--icon-sm` | 16 | 1.5 | 行内、chip、tag 内 |
| `--icon-md` | 20 | 2 | 按钮、cell、tabbar |
| `--icon-lg` | 24 | 2 | 导航栏、顶栏操作 |
| `--icon-xl` | 32 | 2 | 空态、大按钮装饰 |

只用 Lucide（`l-icon` 内嵌 60 个 path，`research/02` §5）。现 14 种尺寸收敛：13/14/15→16、17/18→20、22→24。`l-icon` 增加 `tone` 属性（`ink/ink-2/ink-3/brand/ok/bad/warn/on-brand`），组件内查语义变量取值，页面不再传 hex（因 `<image src=data:svg>` 不支持 `currentColor`，这是方案限制不是写法问题）。小程序端 `[待核]`：现无 l-icon 等价组件，页面 emoji（📄📶🔐💬）替换为同一套 Lucide（foundation 在 `miniapp-native/miniprogram/components/l-icon/` 建同款组件，paths 由同一 `icons.json` 生成）。

---

## 6. 一源多端：tokens.json → uni.scss / App.vue / app.wxss

### 6.1 决策：零依赖脚本，不上 Style Dictionary，不手写同步

三个方案对比：

| | 手写同步（现状） | Style Dictionary 5（`research/02` §8 PoC） | **零依赖 Node 脚本（本文选）** |
|---|---|---|---|
| 依赖 | 无 | +1 devDep（ESM-only，含 transitive deps） | 无（Node 22 内置 `fs/path`） |
| 需要写的代码 | 0，但要人肉同步 3 份 | 3 个自定义 transform（duration / cubicBezier / px-to-double）+ 配置 ≈ 120 行 | ≈ 200 行（解析 + 3 个 emitter + check） |
| 已发生的漂移 | success `#16a34a` vs `#10b981`；brand-400/500 阶位错位；圆角 5 档两端值不同 | — | — |
| 深色模式 | 各写一遍 | 需按 mode 拆多份 tokens 文件 | `$dark` 字段就地成对 |
| 校验 | 无 | 需另写 | `--check`：幂等 + 对比度断言 + 与 `@zalize/brand` 一致 |

手写同步的成本不在「写」而在「漂」：`research/02` §2 列出的三端漂移全部是手写同步的结果，且没有任何机制会报错。Style Dictionary 是成熟方案，但 PoC 证明我们三个目标里最重要的 Flutter 输出默认就是非法 Dart，内置格式的收益被自定义 transform 抵消；对 ~130 个 token、3 个目标，配置文件比生成器本身长。零依赖脚本的风险是「自己造轮子」，控制方法：**输入格式用 W3C DTCG（`$value/$type`），任何时候都能无损迁到 Style Dictionary**。

### 6.2 源文件格式：`tools/design-tokens/tokens.json`

DTCG 格式（`$type/$value`），加两个约定：`$dark` 给深色值；`{a.b.c}` 引用。原始层与语义层在同一文件、不同顶层键。

```jsonc
{
  "$schema": "https://tr.designtokens.org/format/",
  "color": {                                   // 原始层：不生成任何 CSS 变量
    "brand": { "50": {"$type":"color","$value":"#eef3ff"}, "500": {"$type":"color","$value":"#2e5bff"}, "600": {"$type":"color","$value":"#1e44d9"} },
    "ink":   { "900": {"$type":"color","$value":"#17181c"}, "700": {"$type":"color","$value":"#40434e"} },
    "green": { "600": {"$type":"color","$value":"#16a34a"}, "700": {"$type":"color","$value":"#15803d"}, "50": {"$type":"color","$value":"#ecfdf5"} }
  },
  "sem": {                                     // 语义层：每个键生成一个 CSS 变量 --<path>
    "brand":       { "$type":"color", "$value":"{color.brand.500}" },
    "brand-press": { "$type":"color", "$value":"{color.brand.600}" },
    "brand-text":  { "$type":"color", "$value":"{color.brand.600}", "$dark":"#8fa8ff" },
    "ink":         { "$type":"color", "$value":"{color.ink.900}",   "$dark":"#f2f3f7" },
    "ok":          { "$type":"color", "$value":"{color.green.600}" },
    "ok-strong":   { "$type":"color", "$value":"{color.green.700}", "$dark":"#4ade80" },
    "mask":        { "$type":"color", "$value":"rgba(23,24,28,.45)", "$dark":"rgba(0,0,0,.6)" },
    "sh-1":        { "$type":"shadow", "$value":"0 2px 8px rgba(23,24,28,.06)", "$dark":"none" }
  },
  "fs":   { "display": {"$type":"dimension","$value":"32px","$lineHeight":1.2}, "body": {"$type":"dimension","$value":"15px","$lineHeight":1.55} },
  "sp":   { "4": {"$type":"dimension","$value":"4px"}, "16": {"$type":"dimension","$value":"16px"} },
  "r":    { "xs": {"$type":"dimension","$value":"6px"}, "md": {"$type":"dimension","$value":"14px"}, "full": {"$type":"dimension","$value":"999px"} },
  "dur":  { "fast": {"$type":"duration","$value":"150ms"} },
  "ease": { "standard": {"$type":"cubicBezier","$value":[0.2,0,0,1]} },
  "icon": { "md": {"$type":"dimension","$value":"20px"} },
  "z":    { "bar": {"$type":"number","$value":50} },
  "mod":  { "ziliao": {"$type":"color","$value":"#0d9488","$soft":"#e6f5f3","$softDark":"#0e332f","label":"资料分析","icon":"bar-chart-3"} }
}
```

规则：① 顶层键即 CSS 变量前缀（`sem.brand` → `--brand`，`fs.body` → `--fs-body`，`sp.16` → `--sp-16`）；`sem` 例外——不带前缀；② `color.*` 原始层不生成变量；③ `$dark` 缺省 = 浅色值；④ `fs.*.$lineHeight` 额外生成 `--lh-<name>`；⑤ `mod.*` 同时生成 CSS 变量与 `module-meta.js/.ts`（label/icon 一并带出，这就是 4 份 `COLORS` 表的替代品）。

### 6.3 生成目标与接线

| 目标 | 内容 | 谁 import |
|---|---|---|
| `frontend-uni/src/styles/tokens.generated.scss` | 仅 `$` 变量（`$fs-body: 15px; $r-md: 14px; $bp-lg: 1024px; $brand: #2e5bff …`）供编译期用（`@media (min-width: $bp-lg)`、mixin） | `uni.scss` 顶部 `@import 'styles/tokens.generated.scss';`（uni.scss 被注入每个组件，**只能放变量**，否则每个组件都复制一份 CSS） |
| `frontend-uni/src/styles/tokens.generated.css` | `page { --brand: … }` 全部浅色 + `/* #ifdef H5 */ .theme-dark uni-page-body { … } /* #endif */` 深色 + `--wot-*` 组件层映射块 | `App.vue` `<style>` 第一行 `@import './styles/tokens.generated.css';`，随后删除 App.vue 手写的 `--*` 声明 |
| `miniapp-native/miniprogram/styles/tokens.generated.wxss` | `page { … }` + `@media (prefers-color-scheme: dark) { page { … } }` + `--td-*` 映射块 + `.safe-b/.num/.tabular` 工具类 | `app.wxss` 第一行 `@import "styles/tokens.generated.wxss";`，删除手写 token 块 |
| `frontend-uni/src/module-meta.js` / `miniapp-native/miniprogram/utils/module-meta.ts` | `export const MODULES = { ziliao: { label, icon, color: 'var(--mod-ziliao)', soft: 'var(--mod-ziliao-soft)' }, … }` | home / practice / discuss / favorites / offline / 小程序 home / practice |
| `app-flutter/lib/kg_tokens.g.dart`（阶段 2，`[待核]` 本机无 Flutter SDK） | `class KgTokens { static const brand = Color(0xFF2E5BFF); static const durFast = Duration(milliseconds: 150); … }` | `theme.dart` |

组件层常量（`--btn-h-lg/md/sm --input-h --chip-h --tag-h --cell-h --bar-h --card-pad --card-gap --page-x --opt-letter --acard-cell --hit-min`，值见 COMPONENTS.md §3）写在 `tokens.json` 的 `comp.*` 组，与语义层一起生成到三个目标文件的 `/* component */` 块。

组件库变量映射（写在生成文件末尾的固定模板里，不是 tokens.json 内容）：
- wot：`--wot-color-theme: var(--brand); --wot-button-primary-bg-color: var(--brand); --wot-button-large-height: 44px; --wot-button-medium-height: 36px; --wot-button-small-height: 32px; --wot-button-*-radius: var(--r-full); --wot-cell-title-fs: var(--fs-body); --wot-color-white: var(--card); --wot-cell-tap-bg: var(--fill); --wot-switch-*: …`（wd-button 默认 28/36/44 三档高与 2/4/8px 圆角，来源 `wot-design-uni@1.14.0/components/common/abstracts/variable.scss` L135–151，本轮从 unpkg 核过）。
- TDesign：`--td-brand-color: var(--brand); --td-brand-color-active: var(--brand-press); --td-brand-color-light: var(--brand-soft); --td-success-color: var(--ok); --td-error-color: var(--bad); --td-warning-color: var(--warn); --td-text-color-primary: var(--ink); --td-text-color-secondary: var(--ink-2); --td-text-color-placeholder: var(--ink-4); --td-bg-color-container: var(--card); --td-bg-color-page: var(--bg); --td-radius-default: var(--r-sm); --td-radius-large: var(--r-md)`（变量名以 `tdesign-miniprogram@1.9.7/miniprogram_dist/common/style/theme/_light.wxss` 为准，`[待核]` 逐名核对）。

### 6.4 过渡期别名（生成文件内的 `/* compat */` 块，foundation-2 删除）
- H5：`--brand-strong: var(--brand-text); --brand-50: var(--brand-soft); --ink-1: var(--ink); --muted: var(--ink-3); --danger: var(--bad); --soft-bg: var(--fill); --radius: var(--r-md)`；SCSS `$kg-primary-600: $brand; $kg-radius-l: $r-md; $kg-font-body: $fs-body`（rpx 变量改为 px 值，这是有意的）。
- 小程序：`--brand-500: var(--brand); --brand-600: var(--brand-press); --brand-50: var(--brand-soft); --t1: var(--ink); --t2: var(--ink-2); --t3: var(--ink-3); --t4: var(--ink-4); --border: var(--line); --surface: var(--card); --success: var(--ok); --success-deep: var(--ok-strong); --success-bg: var(--ok-soft); --error*: --bad*; --warning*: --warn*; --r-s: var(--r-sm); --r-m: var(--r-md); --r-l: var(--r-md); --r-xl: var(--r-lg); --sh-1/--sh-2` 同名保留。
- 别名让四个页面组可以并行：页面组把 `var(--t3)` 改成 `var(--ink-3)` 是「必须做」，但即使没改完，页面也不会坏。

### 6.5 脚本：`tools/design-tokens/build.mjs`
- 位置 `tools/`（仓库根），因为输出跨 `frontend-uni/`、`miniapp-native/`、`app-flutter/` 三个包。Node 22（仓库已要求）。
- 命令：`node tools/design-tokens/build.mjs`（写文件）/ `--check`（不写，比对现有输出 + 跑 §2.6 对比度断言 + 校验字号 px 偶数换算、间距/圆角在白名单内、`@zalize/brand` 一致；任一失败 exit 1）。
- 接入：`frontend-uni/package.json` `"lint": "node ../tools/design-tokens/build.mjs --check && eslint src tests && npm run lint:edge"`；小程序 `"lint"` 同样前置。不进 CI（本组织 Actions 禁用），本地 lint 即门禁。
- 生成文件头：`/* GENERATED by tools/design-tokens/build.mjs from tokens.json — DO NOT EDIT */`。
- 幂等：二次运行 `git diff` 为空。

### 6.6 页面禁止裸值的拦截
- H5：`frontend-uni/.stylelintrc`（新增 devDep `stylelint` + `stylelint-scss`，是 lint 工具不是运行时依赖）规则：`color-no-hex`、`declaration-property-value-disallowed-list: { 'font-size': ['/rpx$/'], 'font-weight': ['700','800','bold'], 'word-break': ['break-all'] }`、`function-disallowed-list: ['rgb','rgba']`（`var()` 内允许），`allow` 列表只放生成文件。open question #6：若不想加 stylelint，退化为 `tools/design-tokens/lint-pages.mjs` 的 rg 扫描（约 40 行）。
- 小程序：同一个 `lint-pages.mjs` 扫 `miniprogram/pages/**/*.wxss`。

---

## 7. 实施顺序（foundation 阶段，一个会话内可完成）

| 步 | 内容 | 验收 |
|---|---|---|
| F1 | 新建 `tools/design-tokens/{tokens.json,build.mjs}`；生成 4 个文件；`--check` 通过 | `node build.mjs && git diff --stat` 只多 4 个新文件 |
| F2 | `uni.scss` / `App.vue` / `app.wxss` 改为 import + 别名块，删手写值 | H5 `npm run lint && npx vitest run && npm run build:h5`（Node 22）；小程序 `npx tsc --noEmit -p . && npx eslint miniprogram`；`research/03` 附录 A 探针 32 页 ×4 组合像素 diff 仅在被收敛的值上变化 |
| F3 | `l-icon` 加 `tone`；小程序建 `components/l-icon`；`module-meta.js/.ts` 生成并让 home/practice/discuss/favorites 引用（删 4 份 COLORS） | 首页深色 `.mod-ico` 漏网 = 0 |
| F4 | COMPONENTS.md §1–§2 的 Kg* 组件（含 `KgTwoCol` 桌面双栏布局与 `KgInviteInput`，PAGES.md §2/§5.5）、`toast.js` / `utils/toast.ts` 落到 `frontend-uni/src/components/` 与 `miniapp-native/miniprogram/components/` | 每个组件一个最小 demo 页（`pkgA/dev/kit`，仅 dev 构建）|
| F5 | stylelint / lint-pages 接入 `lint`，对现存页面先 `warn` 不 `error`，页面组交付时改 `error` | lint 通过 |
| F6 | 更新 `docs/handoff-context.md` 加 R384 节 | — |

回滚：F1–F2 只要删 import 行、恢复手写块即回到现状；生成文件不动业务代码。

---

## 8. 取舍一览（为什么不选另一个）

| 决策 | 选 | 不选 | 一句话理由 |
|---|---|---|---|
| 主色 | `#2e5bff` | `#3B6FF5` | 三端两端 + 品牌包都是前者；后者只在 Flutter 与两份旧稿 |
| 字号单位 | px | rpx | 30% 奇数 rpx 落半像素（`[生产]` computed 10.5/11.5…px）；字号不需要随屏宽等比放大 |
| 字阶 | 7 档 32/24/20/17/15/13/12 | 8 档 28/22/17/16/15/13/12/num | 用户上限 7；32/24 直接覆盖大数字与统计数字 |
| 中性色 | 实色成对 | alpha 黑白 | 彩色浅底上 alpha 偏色；`<image>` 图标吃不到 currentColor |
| 阴影 | 3 层中性 | 品牌色投影 / 冷调阴影 | 与 ≤3 层冲突；彩底卡上冷调显脏 |
| 圆角 | 主按钮胶囊 | 10px 圆角 | 33:5 文件多数 |
| token 名 | 沿用 H5 语义名 | `--kg-` 前缀 | 1,400+ 处引用零 churn；不与库前缀冲突 |
| 生成 | 零依赖脚本 + DTCG 输入 | Style Dictionary / 手写 | 见 §6.1 |
| 组件库 | Wot 1.14 + TDesign 1.9 保留 | Wot v2 / @tdesign/uniapp / Vant / WeUI | `research/02` §1–§4：换库无杠杆、0.x、微信绿 |
| 图标 | Lucide 60 个按需 | 全量字体 / 第二套 | 285KB vs 现 60 path；不增实体 |
| 图表 | CSS/canvas 自绘 | ECharts/uCharts | 1MB / 停更；无 tooltip 需求 |
| 小程序动效 | WXSS / `this.animate` | setData 帧动画 / Lottie | 官方性能文档；无插画动画需求 |

---

## 9. Open questions（不阻塞，默认按「选」列执行）

1. 主色 `#2e5bff` vs `#3B6FF5`（默认前者；若选后者需同步 `@zalize/brand` 上游）。
2. 小程序 TDesign 用到什么程度：仅 login（现状）还是扩到 `t-button/t-empty/t-skeleton/t-toast/t-tag`（默认扩，见 COMPONENTS §0）。
3. `--ink-2` 由 `#5f6575` 改 `#40434e`，全站正文略深（默认改）。
4. 去掉品牌色投影（默认去；若要保留只允许主按钮 hover 一处）。
5. 小程序字号/间距是否全部改 px（默认改；风险是 rpx→px 的替换量约 4,100 行 wxss，由 miniapp 组按页做）。
6. H5 是否引入 stylelint 做裸值门禁（默认引入 devDep；否则用 rg 脚本）。
7. Flutter 何时接入生成（默认 foundation 后独立 spike，需有 Flutter SDK 的机器跑 `flutter analyze`）。
8. 小程序切 Skyline 的时间（默认不切，直到 `line-break/overflow-wrap` 有替代）。

---

## 附录 · 证据索引
- 竞品/国际 token 结构：`research/01-competitor-frontend.md` §借鉴 #1–#12（Khan `cdn.kastatic.org` CSS、Brilliant `--panda-*` 703 变量）。
- 库选型与 PoC：`research/02-library-selection.md` §1–§9；wot 1.14.0 组件目录（102 项）与 `variable.scss` 按钮尺寸、tdesign 1.9.7 目录（80 项）本轮经 unpkg/jsdelivr 核过。
- 生产审计：`research/03-our-pages-audit.md` §2–§6（32 页 ×4、157 色值 / 29 字号 / 36 圆角、6 处深色漏网）。
- 排版/动效/对比度：`research/04-spec-typography-motion-charts.md` §1–§6、附录 A。
- 现状 token：`frontend-uni/src/uni.scss` L15–60、`frontend-uni/src/App.vue` L74–360、`miniapp-native/miniprogram/app.wxss` L1–101、`docs/design-v3/DESIGN.md` §3、`docs/design/miniapp-v2/tokens.md`、handoff R383（在 `origin/devin/1788633425-ui-type-scale`，**未在 main**）。
