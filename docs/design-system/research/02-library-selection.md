# 02 · 三端设计体系 / 组件库 / 图标 / 图表 / 动效选型论证

- 日期：2026-09-06　分支：`devin/w5-research-libs`
- 范围：frontend-uni（uni-app Vue3 H5）、miniapp-native（原生微信小程序）、app-flutter
- 前置资料（已读、不重复）：`docs/design-benchmark/report.md`、`docs/design-v3/DESIGN.md`、`docs/design/miniapp-v2/tokens.md`、`docs/handoff-context.md` R383（H5 30 种字号 / 36 种圆角 / 131 种色值）
- 证据分级：**[源码]** 本机 `npm i` 后逐文件读取（安装目录 `~/libscan/node_modules`，非仓库依赖）；**[仓库]** 本仓库代码 / 本机 `npm run build:h5` 实测；**[官方]** 官方文档 / npm registry / pub.dev / GitHub API；**[推断]** 由前三者推出，未直接验证。没有标 [推断] 的数字都能在给出的路径 / URL 复现。

---

## 0. 一页结论（TL;DR）

| 问题 | 结论 | 一句话理由 |
|---|---|---|
| H5 组件库 | **保留 wot-design-uni 1.14，不换库、暂不升 v2** | 全站只用了 5 个 wd 组件（cell×20 / button×8 / cell-group×3 / switch×2 / datetime-picker×1）[仓库]，换任何库收益都覆盖不了改动面；v2 是新包名 + API 破坏性升级 [官方] |
| 小程序组件库 | **保留 tdesign-miniprogram，按需声明** | 全站只声明了 `t-input`/`t-button` 两个组件 [仓库]；TDesign 是候选里唯一自带完整 `--td-*` token 层 + 暗色 + 无障碍属性（50/104 wxml 含 aria）的库 [源码] |
| 是否引入 TDesign uni 版 | **不引入** | `@tdesign/uniapp` 确实存在（0.10.3，MIT，2026-08-06）[官方]，但仍是 0.x，且 H5 换库没有必要（见上） |
| Flutter | **保留自研 theme + Material 3 骨架** | `useMaterial3: true` + `KgColors/KgSemantic` ThemeExtension 就是 M3 推荐的做法 [仓库]，缺的是 token 来源而不是库 |
| 设计体系参照 | **以 TDesign token 结构为骨架命名，视觉值用我们自己的品牌** | 4 家里只有 TDesign 三端（小程序 / uni / 通用 token 仓）同源；AntD Mobile / Arco 仅 React 官方实现 [官方] |
| 图标 | **保留 Lucide，统一版本并补一个语义映射表** | 三端已都是 Lucide；问题是版本三分（H5 内嵌 0.525.0、Flutter `lucide_icons` 停更于 2023-06、上游 1.41.0）[仓库][官方] |
| 图表 | **继续轻量自绘（CSS conic-gradient / canvas / Flutter CustomPainter）**；Flutter 若出现折线交互再评估 fl_chart；**不选 charts_flutter、不引 ECharts** | 我们只有环形进度、柱状分布、雷达三类静态图 [仓库]；ECharts 核心 1.02MB 是小程序单包 2MB 的一半 [源码]；charts_flutter pub.dev 已 discontinued [官方] |
| 动效 | **共享 motion token（时长 3 档 + 曲线 2 条）→ CSS transition / `uni.createAnimation` / Flutter `Duration+Cubic`；不引 Lottie** | 三端现有动效全是 CSS/Canvas/CustomPaint，无插画动画需求 [仓库]；lottie-miniprogram 最后发版 2022-05 [官方] |
| 共享 token 源 | **可以，Style Dictionary 5 JSON → SCSS / WXSS / Dart 已本机跑通** | 默认 Flutter 转换会把 `250ms`/`cubic-bezier` 原样吐进 Dart（非法），需自定义 3 个 transform（见 §7） |
| 第一步 | **先收敛品牌主色**：H5/小程序/`@zalize/brand` 都是 `#2e5bff`，只有 Flutter/design-v3 是 `#3B6FF5` | 这是 token 生成前必须由设计侧拍板的唯一冲突 [仓库] |

---

## 1. 现状核查（不是"我们以为"，是代码里实际在用什么）

### 1.1 H5（frontend-uni）

| 项 | 实测 | 证据 |
|---|---|---|
| 组件库 | `wot-design-uni@1.14.0`，easycom `^wd-(.*)` | `frontend-uni/package.json`、`src/pages.json` |
| 实际使用的 wd 组件 | `wd-cell`×20、`wd-button`×8、`wd-cell-group`×3、`wd-switch`×2、`wd-datetime-picker`×1，**共 5 种** | `grep -rhoE "<wd-[a-z-]+" src` |
| uni-ui | easycom 已配 `^uni-(.*)`，页面模板里 **0 处** `<uni-*>` 标签 | 同上 |
| 图标 | 本地 `l-icon` 组件：`paths.js` 内嵌 **60 个** Lucide path（注释 `lucide-static v0.525.0, ISC`），运行时拼 SVG data URI 交给 `<image>`；页面实际用到 **49 个** 图标名 | `src/components/l-icon/l-icon.vue`、`paths.js` |
| token | `uni.scss` 的 `$kg-*`（色 / 字阶 / 间距 / 圆角 / 动效）+ `App.vue` 的 CSS 变量（`--brand` 等，含 `.theme-dark` 一整套暗色覆盖 + `--wot-*` 覆盖）+ `@zalize/brand` 同步生成的 `static/brand/zalize-tokens.css`（禁止手改） | `src/uni.scss`、`src/App.vue` L60–200、`scripts/sync-brand-tokens.mjs` |
| 暗色 | 自研三档（`theme.js` 监听 `prefers-color-scheme`，`html.theme-dark`），并已手工覆盖 8 个 `--wot-*` 变量 | `src/theme.js`、`App.vue` L176–184 |
| 减弱动效 | 已有 `@media (prefers-reduced-motion: reduce)` 全局压到 0.01ms | `App.vue` L138–146 |
| 图表 | 环形进度 = CSS `conic-gradient`；分享图 = canvas；stats 页 `.ring/.poly` 纯 CSS | `pages/stats/stats.vue` L944–945 等 |
| 动效 | CSS transition / keyframes，出现的时长 0.15/0.25/0.3/0.35/0.4/0.6s，骨架屏 1.2s；`uni.createAnimation` **0 处** | grep 结果 |
| 构建体积（Node 22，`npm run build:h5` 本机实测） | dist 1.8MB；JS 合计 1,032,613B（主包 `index-*.js` 372,847B）；CSS 合计 333,422B | `dist/build/h5/` |
| Wot 在产物中的占比 | `wd-icons--*.ttf` **53,948B** + `wd-icon-*.css` 17,903B + `wd-cell-*.css` 5,383B ≈ 77KB。全站没用 `wd-icon`，字体仍被打进产物 | `dist/build/h5/assets/` |

> 结论：H5 对 Wot 的依赖只有 5 个基础控件；核心界面（题卡、进度、错题本、统计）全是自研。Wot 换成任何库，改动只在这 5 个控件，但收益也只在这 5 个控件——换库没有杠杆。

### 1.2 小程序（miniapp-native）

| 项 | 实测 | 证据 |
|---|---|---|
| 组件库 | `tdesign-miniprogram ~1.9.7`（npm 当前 1.16.0）；`packNpmManually: true`、`lazyCodeLoading: requiredComponents` | `package.json`、`project.config.json` |
| 实际声明 | 只有 `pages/login/login.json` 声明 `t-input`、`t-button`；wxml 中 `<t-input>`×3、`<t-button>`×2。**其余 9 个页面 0 个 TDesign 组件** | grep 结果 |
| token | `app.wxss` 198 行：`--brand-50…500`（500=`#2e5bff`）、语义色、模块色、圆角、阴影，`@media (prefers-color-scheme: dark)` 覆盖；`app.json` `darkmode: true` | `miniprogram/app.wxss` L3–8、L74 |
| 图表 / 动效 | conic-gradient + keyframes，无图表库；`createAnimation` 0 处 | grep 结果 |
| `miniprogram_npm` | 本机未构建（目录不存在），故 TDesign 在真实分包中的落地体积**未实测**，见 §4.3 | `ls miniprogram_npm` |

### 1.3 Flutter（app-flutter）

| 项 | 实测 | 证据 |
|---|---|---|
| 主题 | `ThemeData(useMaterial3: true)`；`KgColors`（brand `#3B6FF5`、t1–t4、border/fill/bg）+ `KgSemantic extends ThemeExtension` | `lib/theme.dart` |
| 图标 | `lucide_icons: ^0.257.0`（pub.dev 最后发版 **2023-06-29**）；社区活跃分支 `lucide_icons_flutter` 3.1.18（2026-09-05） | `pubspec.yaml` L43、pub.dev API |
| 图表 | `stats_page.dart` 用 `CustomPaint/CustomPainter` 自绘，无 fl_chart / charts_flutter | `lib/pages/stats_page.dart`、`pubspec.yaml` |
| 本地验证 | 本机无 Flutter SDK，未执行 analyze/test；以上为静态读码 | — |

### 1.4 三端 token 漂移点（报告后续所有建议的起点）

| token | H5 `uni.scss` / `App.vue` | 小程序 `app.wxss` | Flutter `theme.dart` | design-v3 | `@zalize/brand` |
|---|---|---|---|---|---|
| 品牌主色 | `#2e5bff`（`$kg-primary-600` / `--brand` / `--wot-color-theme`） | `#2e5bff`（`--brand-500`） | **`#3B6FF5`** | **`#3B6FF5`** | `--zl-brand-600: #2e5bff`、`--zl-brand-500: #3f69ff` |
| 品牌浅底 | `#eef3ff` | `#eef3ff` | `#EDF3FE` | `#EDF3FE` | — |
| 文字 1 级 | `#17181c` | — | `#17181C` | `#17181C` | — |
| 字阶 | 48/40/34/30/26/22rpx（+56 数字） | 24 种字号（R383） | — | 24/20/17/15/13/12px | — |
| 圆角 | 12/20/28/40/999rpx；`--radius: 28rpx` | 6/10/14/18/24/999（miniapp-v2） | — | 999/10/14/20px | — |
| 动效 | `$kg-dur-fast 150ms / base 250ms`、`$kg-ease cubic-bezier(.2,.8,.2,1)` | 散落 | Material 默认 | — | — |

- **唯一需要人拍板的冲突**：品牌主色 `#2e5bff`（H5 / 小程序 / 品牌包）vs `#3B6FF5`（Flutter / design-v3）。品牌包注释写明"品牌 token 唯一来源是 wookat/zalize-brand 仓"，按现有规则应以 `#2e5bff` 为准、Flutter 与 design-v3 文档改过来 —— 但这是设计决策，本报告只指出，不代为决定。
- 圆角三套命名（s/m/l/xl vs 数值 vs 用途），字阶 H5 与 design-v3 数值对不上（H5 body 30rpx=15px 一致，但 h2 34rpx=17px、sub 26rpx=13px 一致；display 48rpx=24px 一致 —— 实际是**命名不同、数值大体一致**，R383 的 30 种字号来自页面写死值，不是 token 层的问题）。

---

## 2. 设计体系候选：token 对比

> 源码路径均在 `~/libscan/node_modules/` 下；Material 3 / Cupertino 读的是 Flutter 框架源码（GitHub `flutter/flutter` `packages/flutter/lib/src/material|cupertino`）。

| 维度 | TDesign（小程序 / uni / common） | Ant Design Mobile 5.42.3 | Arco Design Mobile 2.39.1 | Material 3（Flutter 源码） | Apple HIG（Cupertino 源码） | WeUI 1.5.6 / 微信设计指南 |
|---|---|---|---|---|---|---|
| 官方实现 | 小程序 `tdesign-miniprogram`、uni `@tdesign/uniapp`、Vue `tdesign-mobile-vue`、token 仓 `Tencent/tdesign-common` | React 唯一（`antd-mobile`）；npm 无 `@ant-design/mobile-vue` | React（`@arco-design/mobile-react`）；npm 查 `@arco-design/mobile-vue` 404 | Flutter 内建 | Flutter 内建 | 小程序 `weui-miniprogram` |
| 品牌色阶 | `--td-brand-color-1…10`：`#f2f3ff #d9e1ff #b5c7ff #8eabff #618dff #366ef4 #0052d9 …`（`common/style/theme/_light.wxss`） | 亮 `#1677ff` / 暗 `#3086ff`；success `#00b578/#34b368`；danger `#ff3141/#ff4a58` | `@primary-color #165DFF` / 暗 `#3C7EFF`；danger `#F53F3F`；warning `#FF7D00`；success `#00B42A` | `ColorScheme.fromSeed` 生成 tonal palette | `CupertinoColors.systemBlue` 亮 `#007AFF` / 暗 `#0A84FF`；systemGreen `#34C759/#30D158` | `--weui-BRAND-100 #07c160`、`--weui-BLUE-100 #10aeff`；文字用透明度 `rgba(0,0,0,.9/.55/.3/.1)` |
| 字阶 | 20/24/28/32/36/40/48/56/72/96/128rpx（`_font.wxss`，附行高） | 9–18px（`--adm-font-size-1…10`） | 按组件 less 变量，无全局字阶表 | `Typography` 2021：display 57/45/36、headline 32/28/24、title 22/16/14、body 16/14/12、label 14/12/11 | `CupertinoTextThemeData` 17/13 等 | 指南：22/17/15/14/12pt（375 基准） |
| 间距 | `--td-spacer` 16/24/32/48/64/96/160rpx（`_spacer.wxss`） | 组件内 `--adm-*` 无全局 spacer | 组件 less 变量 | 无 token，M3 规范 4dp 网格 | 无 token | 无 token |
| 圆角 | `--td-radius-small/default/large/extraLarge/round/circle` = 6/12/18/24rpx/999px/50%（`_radius.wxss`） | `--adm-radius-s/m/l` 4/8/12px | `@button-radius: 2PX` | `ShapeScheme` 4/8/12/16/28dp | `BorderRadius` 组件内写死 | 组件内多种 |
| 阴影 | `--td-shadow-1…4` 四级（`_light.wxss`） | 组件内 | 组件内 | `Elevation` 0–5 tonal | 无 | 组件内 |
| 动效 | `tdesign-common/style/web/_variables.less`：`@anim-duration-base 0.2s / moderate 0.24s / slow 0.28s`，`@anim-time-fn-easing cubic-bezier(0.38,0,0.24,1)`、`ease-in cubic-bezier(0.82,0,1,0.9)`、`ease-out cubic-bezier(0,0,0.15,1)`；**小程序包里未落成 `--td-anim-*` 变量**，组件 wxss 写死 .3s×20 / .2s×9 / .25s×4 | 组件写死 0.15/0.2/0.3/0.35s、`cubic-bezier(0.645,0.045,0.355,1)` | `@popup-enter-transition 450ms` / `exit 240ms` `cubic-bezier(0.34,0.69,0.1,1)` | `Durations.short1…extralong4` 50–1000ms；`Easing.standard = Cubic(0.2,0,0,1)` | `Curves.easeInOut` 等，默认 300–350ms | 组件写死 |
| 暗色 | `_dark.wxss` 单个 `@media (prefers-color-scheme:dark)` 块覆盖全部 `--td-*` | 每个 token 有亮 / 暗两值 | `@dark-*` 全套 less 变量 | `ColorScheme(brightness: dark)` | `CupertinoDynamicColor` | `[data-weui-theme=dark]` 属性切换 |
| 许可证 | MIT | MIT | ISC | BSD-3 | BSD-3 | MIT |

**判读**

1. 候选里只有 TDesign 同时给了小程序、uni-app 两个我们实际用的运行时，并且 token 命名结构（`brand-color-1…10 / spacer / radius / shadow / font`）三处一致，token 仓（`tdesign-common`）独立可读。AntD Mobile 和 Arco Mobile 官方只有 React，对我们只能"借设计值"，借不到实现。
2. 但 TDesign 的**视觉值**（品牌蓝 `#0052d9`、字阶 28rpx 正文）与我们的品牌（`#2e5bff`、正文 30rpx）不同，直接套用等于换品牌。所以：**借 TDesign 的 token 结构与命名层次，值用我们自己的**。
3. Material 3 / Apple HIG 作为 Flutter 端的"宿主约定"保留：`useMaterial3: true` 已在用；`Easing.standard` 与我们 `$kg-ease cubic-bezier(.2,.8,.2,1)` 形状相近（都是快出慢入），可以把我们的曲线在 Flutter 端直接映射到 `Cubic(0.2,0.8,0.2,1)`，不需要改成 M3 的值。
4. WeUI 是微信原生视觉（`#07c160` 绿），与我们的蓝色品牌冲突；微信设计指南里可取的是**字号基线**（17pt 正文 / 15 / 14 / 12）和 375 基准，与我们 15px 正文接近，不需要改。

---

## 3. uni-app 组件库候选

| 维度 | **wot-design-uni 1.14.0（现用）** | @wot-ui/ui 2.3.2（Wot v2） | uview-pro 0.6.18 | nutui-uniapp 1.11.2 | @tuniao/tnui-vue3-uniapp 1.0.23 | @tdesign/uniapp 0.10.3 |
|---|---|---|---|---|---|---|
| 组件目录数 [源码] | 102 | 101 | 99（`components/u-*`） | 118 | 57 | 107 |
| 主题色默认 | `#4d80f0`；success/warning/danger `#34d19d/#f0883a/#fa4350` | `--wot-blue-6: #1C64FD`（语义 `--wot-primary-6`） | `--u-type-primary #2979ff` | `#fa2c19`（京东红） | 自有 | `--td-brand-color-7 #0052d9` |
| 字阶 | 24/19/16/14/12/10px | title 18/20/24、body 14/15/16/17/18（`theme/base/typography.scss`） | 无全局字阶 | `--nut-font-size-0…4` 10/12/14/16/18px | 无全局字阶 | 同 TDesign 小程序 |
| 圆角 | 按钮 2/4/8px | `--wot-radius-small/main/large/extra-large/super-large/ultra-large` = 2/4/8/12/16/20px（`theme/base/radius.scss`） | 组件内 | 按钮 25px | 组件内 | 6/12/18/24rpx |
| 间距 token | 无 | `theme/base/insets.scss` 2…48px | 无 | 无 | 无 | `--td-spacer` |
| 动效 | 组件内 0.3s（tour） | 组件内 `0.3s` / `cubic-bezier(0.4,0,0.2,1)`；有 `--wot-loading-*-animation-duration` 等**组件级**变量，无全局 motion token | 0.2/0.3/0.35/0.4/0.5s | `$animation-duration 0.25s`、`cubic-bezier(0.55,0.085,0.68,0.53)` | 未抽取 | 同 TDesign |
| 主题机制 | `--wot-*` CSS 变量单层（App.vue 已在覆盖 8 个） | 三层 token：`--wot-n-*` 数值 → `--wot-blue-*` 基础色 → `--wot-primary-*` 语义，共 383 个变量 | `--u-*` 单层 | `--nut-*` 单层 | 自有 | `--td-*` |
| 暗色 [源码] | 69 个组件 scss 含 `.wot-theme-dark`，由 `wd-config-provider theme="dark"` 切换 | `theme/dark.scss` | 未在 `theme.scss` 观察到暗色变量 | 64 处 `.nut-theme-dark` | 未观察到 | 同 TDesign（`prefers-color-scheme`） |
| 无障碍（`aria-*`/`role=` 出现的组件文件数）[源码] | **0** | **0** | 0 | 2 | 未查 | 沿用 TDesign 小程序（50/104） |
| 许可证 / 最后发版 [官方] | MIT / 2026 活跃 | MIT / 2026 活跃 | MIT / 2026 | MIT / 2026 | Apache-2.0 / npm 元数据；GitHub `tuniaoui/tnui-vue3-uniapp` API 404（仅说明该路径不可达） | MIT / 2026-08-06；0.x 阶段，自 0.5.1（2025-11-07）起 25 个版本 |
| 产物体积 [仓库] | 现有 5 组件 ≈ 77KB（含 54KB 图标字体） | 未实测 | 未实测；`theme.scss` 注释自述"uni.scss 全量引入会让微信包过大" | 未实测 | 未实测 | 安装目录 4.8MB（源码口径，不等于产物） |

**迁移成本（真实改动面）**

- 现有 34 处 `<wd-*>` 标签、`App.vue` 8 个 `--wot-*` 覆盖、`pages.json` 1 条 easycom。换任何库 = 改这 34 处 + 重写覆盖 + 回归 5 个控件的暗色。
- Wot v1→v2 [官方迁移文档 https://wot-ui.cn/guide/migration-v2.html]：包名 `wot-design-uni`→`@wot-ui/ui`；`wd-message-box`→`wd-dialog`、`useMessage`→`useDialog`、`wd-status-tip`→`wd-empty`、`wd-col-picker`→`wd-cascader`；Form `rules`→`schema`；Button/Tag `plain/type` 变化；主题从单层变量升级为三层 token。我们 5 个组件里 `wd-button` 受 API 变化影响、`wd-datetime-picker` 需回归。
- `@tdesign/uniapp` 0.x：CHANGELOG 每月 1–3 版，README 明确"其他平台因审核未上架预览"；对一个只需 5 个基础控件的 H5 引入 0.x 库，风险/收益不成比例。

**结论：保留 wot-design-uni 1.14。** 补的是 token 层，不是换库：
1. 把 `App.vue` 里 8 个 `--wot-*` 覆盖改为引用我们生成的语义变量（`--wot-color-theme: var(--kg-brand-600)`）。
2. `wd-icon` 全站未用但 54KB 字体被打包 —— 可在 `vite.config` 里检查是否 tree-shake 掉 `wd-icon` 样式（[推断] 需实测，属优化项不属选型项）。
3. Wot v2 单独立 spike：等 v2 发到 2.x 稳定 ≥6 个月且我们有 Dialog/Form 需求时再评估，不与本轮 token 收敛绑定。

---

## 4. 小程序组件库候选

| 维度 | **tdesign-miniprogram（现用 ~1.9.7；npm 1.16.0）** | @vant/weapp 1.11.7 | weui-miniprogram 1.5.6 |
|---|---|---|---|
| 组件数 [源码] | 104 个 wxml | 75 | 28 个目录 |
| token 层 | `--td-*` 完整：brand 10 阶、gray 14 阶、font 10 阶、spacer 7 阶、radius 6 档、shadow 4 级、亮 / 暗两套（`common/style/theme/`） | `var(--van-*, fallback)`，默认主色 `#07c160`、danger `#ee0a24`、warning `#ff976a`、字号 10/12/14/16px、按钮高 22/30/44/50px、圆角 2/4/8/999px | `--weui-*`：BRAND `#07c160`、BLUE `#10aeff`、FG/BG 透明度阶 |
| 暗色 | `@media (prefers-color-scheme:dark)` 整包覆盖 | **未观察到**暗色变量 | `[data-weui-theme=dark]` 属性（需页面根节点挂属性） |
| 无障碍 | **50/104** wxml 含 `aria-*`/`role` | 1/75 | 13 个文件 |
| 动效 | 组件写死 `.3s`×20、`.2s`×9、`cubic-bezier(.645,.045,.355,1)`×4 | 0.2/0.3/0.8s | 组件内 |
| 安装体积 [源码，源码口径] | 5.6MB，common 样式 320KB | dist 2.2MB | dist 1.1MB |
| 许可证 / 维护 [官方] | MIT / 2026-09-04 仍在推 | MIT / 活跃 | MIT / 微信官方 |

### 4.3 2MB 分包与体积口径

- 上表体积是 **npm 安装目录**大小，不是分包体积。微信 `构建 npm` 只会把 `usingComponents` 引用到的组件复制进 `miniprogram_npm`，再加 `lazyCodeLoading: requiredComponents`（我们已开）按需注入。所以 5.6MB 不会进包，只有 `input`、`button` 及其 `common/` 依赖会进。
- 真实数字未实测（本机不能跑微信开发者工具）。**验收动作**：在开发者工具"代码依赖分析"看 `miniprogram_npm/tdesign-miniprogram` 实际大小，作为后续任何新增组件的基线。
- TDesign 的 `common/style/theme/index.wxss`（含亮暗两套 `--td-*`）约 320KB 源码口径，这是引入任何一个 t 组件都会带的固定成本 [推断：需构建后核实是否被 wxss 合并压缩]。

**结论：保留 tdesign-miniprogram。** 它是三家里唯一同时满足"完整 token 层 + 暗色 + 无障碍属性 + 活跃维护"的；Vant 无暗色、WeUI 组件太少且是微信绿。要做的是：把 `app.wxss` 的 `--brand-*` 映射到 `--td-brand-color-*`（覆盖 TDesign 默认蓝），而不是并存两套变量。升级 1.9→1.16 建议独立做（CHANGELOG 未逐条核对，[推断] 有 break 风险）。

---

## 5. 图标库候选

| 维度 | **Lucide（现用）** | TDesign Icons | Tabler Icons | Remix Icon |
|---|---|---|---|---|
| 数量 [源码] | `lucide-static` 1.41.0：**2,066** SVG | `tdesign-icons-svg` 0.4.7：2,357 | `@tabler/icons` 3.46.0：5,130 outline + 1,054 filled | `remixicon` 4.9.1：3,229（1,539 line） |
| 风格 | 24 网格、2px 描边、圆头 | 24 网格、描边 | 24 网格、2px 描边（与 Lucide 同源风格） | 24 网格、line + fill 成对 |
| 许可证 | ISC | MIT | MIT | Apache-2.0 |
| 字体体积 [源码] | `lucide.woff2` 284,928B / ttf 877,160B（全量） | — | — | — |
| Flutter 包 [官方] | `lucide_icons` 0.257.0（**2023-06-29 停更**）；`lucide_icons_flutter` 3.1.18（2026-09-05） | `tdesign_flutter` 内含 | `tabler_icons_next` 等社区 | 社区 |
| 维护 [官方] | GitHub 24.3k★，2026-09-04 有推送 | 腾讯维护 | 活跃 | 活跃 |

**现状问题不是"选哪个库"，而是版本三分**：H5 `paths.js` 内嵌的是 0.525.0 的 60 个 path（当前上游 1.41.0）；Flutter 锁在 `lucide_icons ^0.257.0`（停更 3 年）；小程序沿用 H5 同一批 path。同一个语义名（如 `check-circle` 在 0.4xx 后改名 `circle-check`）可能在三端画出不同版本的形状 [推断：未逐个比对 60 个 path 与 1.41.0 差异]。

**结论：保留 Lucide，不引第二套。** 动作：
1. 建一个 `icons.json`（语义名 → Lucide 名），三端从同一份生成：H5/小程序继续 `paths.js` 方案（按需 60 个，不引 285KB 全量字体），Flutter 切到 `lucide_icons_flutter`。
2. 把 `paths.js` 升到 1.41.0 同版本重新导出（脚本化，注明版本），解决三端形状不一致。
3. Tabler 与 Lucide 风格同源，若将来 Lucide 缺图，单个 Tabler SVG 可按同一 24/2px 规格补入 `paths.js`，不需要整库引入。

---

## 6. 图表候选

| 维度 | **轻量自绘（现用）** | @qiun/ucharts 2.5.0 | echarts-for-weixin 1.0.2 + ECharts 5.6.0 | fl_chart 1.2.0 | charts_flutter 0.12.0 |
|---|---|---|---|---|---|
| 运行时 | H5/小程序：CSS `conic-gradient` + canvas；Flutter：`CustomPainter` | uni-app / 小程序 canvas | 小程序 canvas 2d | Flutter | Flutter |
| 体积 [源码/官方] | 0 | `u-charts.min.js` 144,717B | `echarts.min.js` 1,034,102B；`echarts.simple.min.js` 469,733B | 纯 Dart，随 tree-shake | — |
| 2MB 分包影响 | 无 | 7% | **~50%**（一个分包一半） | 不适用 | 不适用 |
| 交互 | 无（当前也没需求） | tooltip / 点击 | 完整 | 触摸 tooltip / 缩放 | 有 |
| 许可证 / 维护 [官方] | — | Apache-2.0 / 最新版号 `2.5.0-20230101` | MIT / ECharts 活跃，for-weixin 1.0.2 | MIT / 2026-03-13，pub 近 30 天 1.76M 下载 | Apache-2.0 / **pub.dev discontinued，GitHub archived，最后发版 2021-11-03** |
| 深色 | 跟随 CSS 变量 | 需手动传色 | 需主题 JSON | 随 Theme | — |

我们真实的图表需求（读三端 stats 页）：环形进度、模块柱状分布、错题趋势小折线、雷达。全是**静态展示**，无 tooltip / 缩放 / 联动。

**结论**：
- H5 / 小程序：**继续自绘**。conic-gradient 环 + 纯 CSS 柱条已覆盖需求，且天然跟随 `--brand-*` 变量与暗色；引 uCharts 只为一个静态柱图不值 145KB。
- Flutter：**继续 CustomPainter**；触发条件明确写下 —— 当产品需要"折线 tooltip / 多序列联动 / 缩放"任一项时，选 **fl_chart**（活跃、MIT、纯 Dart）；**不选 charts_flutter**（已 discontinued）。
- **不引 ECharts**：1MB 核心与小程序 2MB 单包冲突，且我们没有它解决的问题。

---

## 7. 动效候选与共享 motion token

| 方案 | 适用端 | 现状 | 判读 |
|---|---|---|---|
| CSS transition / keyframes | H5、小程序 | 三端主力，时长散落 0.15–0.6s | 保留，收敛到 token |
| `uni.createAnimation` / `wx.createAnimation` | uni、小程序 | **0 处使用**；官方默认 `duration 400ms`、`timingFunction "linear"`、仅 7 个预设曲线、nvue 不支持（https://uniapp.dcloud.net.cn/api/ui/animation.html） | 只在需要 JS 驱动序列时用；默认 linear/400ms 与我们 token 不符，必须显式传 |
| Lottie | 三端 | `lottie-miniprogram` 1.0.12（**2022-05 停更**，209KB）；`lottie-web` 5.13.0 `lottie_light.min.js` 168KB；Flutter `lottie` 3.5.1 活跃 | 无品牌插画动画需求；小程序包 3 年未更新。**不引入**；若未来上"答对庆祝"类插画动效，H5 用 `lottie_light` 按页面懒加载、小程序优先用 APNG/序列帧 [推断] |
| TDesign motion tokens | 参考 | `@anim-duration-base/moderate/slow = 0.2/0.24/0.28s`，`easing cubic-bezier(0.38,0,0.24,1)`（tdesign-common） | 采用它的**三档结构**，值用我们的 |
| Material 3 motion | Flutter | `Durations.short4 200ms / medium2 300ms`，`Easing.standard Cubic(0.2,0,0,1)` | Flutter 端映射目标 |

**推荐 motion token（已存在的值，只是命名固化）**

```
motion.dur.fast   150ms   （现 $kg-dur-fast；按下反馈 / 开关）
motion.dur.base   250ms   （现 $kg-dur-base；卡片展开 / 弹层）
motion.dur.slow   400ms   （现页面用 0.4s；页面级转场 / 进度条填充）
motion.ease.standard  cubic-bezier(0.2, 0.8, 0.2, 1)   （现 $kg-ease）
motion.ease.linear    linear                            （进度 / 骨架屏）
```
- H5：`transition: transform var(--kg-dur-base) var(--kg-ease-standard)`；`prefers-reduced-motion` 已有全局处理，保留。
- 小程序：同名 `--kg-*` 写进 `app.wxss`，`wx.createAnimation({duration: 250, timingFunction: 'ease-out'})`（小程序 API 不接受自定义 bezier，退化到最近预设 `ease-out`）。
- Flutter：`KgMotion.durBase = Duration(milliseconds: 250)`、`KgMotion.easeStandard = Cubic(0.2, 0.8, 0.2, 1)`，由 Style Dictionary 生成（见 §8）。

---

## 8. 共享 token 源：Style Dictionary → SCSS / WXSS / Dart（本机已跑通）

- 工具：`style-dictionary` 5.5.2，Apache-2.0 [官方]。
- PoC（在 `~/libscan/sd-poc/`，**未提交**）：一份 W3C DTCG 格式 `tokens.json`（`$value/$type`），输出三份：

| 目标 | 内置格式 | 需要自定义的地方（PoC 已实现） |
|---|---|---|
| `uni.scss`（SCSS 变量） | `scss/variables` | `size/px-to-rpx`：`16px → 32rpx` |
| `app.wxss`（CSS 变量） | `css/variables` | 同上；输出块选择器改 `page, .page` |
| `theme.dart`（Dart class） | `flutter/class.dart` | 默认 transform 会输出 **非法 Dart**：`250ms`、`cubic-bezier(...)`、`radius = 160.00`（把 px 当 rpx 又乘 2）。需注册 `duration/flutter → Duration(milliseconds: 250)`、`cubicBezier/flutter → Cubic(0.2, 0.8, 0.2, 1)`、`size/px-to-double → 10.0` |

- 生成结果（PoC 输出节选）：
  ```dart
  static const motionDurBase = Duration(milliseconds: 250);
  static const motionEaseStandard = Cubic(0.2, 0.8, 0.2, 1);
  static const radiusM = 10.0;
  ```
  ```scss
  $kg-radius-m: 20rpx;  $kg-motion-dur-base: 250ms;
  ```
- 与 `@zalize/brand` 的关系：品牌包是**上游**（公司级 brand-50…900），`tokens.json` 里的 `color.brand.*` 引用品牌包的值（sync 脚本已存在，接进构建即可），产品语义 token（`--ok/--bad/--warn`、模块色、圆角、字阶、动效）在本仓库 `tokens.json` 定义。这样不违反"品牌 token 唯一来源是 zalize-brand 仓"的规则。
- **不建议**一开始就让生成文件替换整份 `uni.scss`/`app.wxss`：先生成 `_tokens.generated.scss` / `tokens.generated.wxss` / `kg_tokens.g.dart` 三个新文件并 import，旧变量逐个改成别名指向生成变量，页面写死值再分批替换（R383 的 30 字号 / 36 圆角就在这一步收敛）。

---

## 9. 迁移路线（分阶段，每阶段可单独验收、可回滚）

| 阶段 | 内容 | 验收（本地） | 回滚 |
|---|---|---|---|
| P0 拍板 | 设计侧确认品牌主色（`#2e5bff` vs `#3B6FF5`）、圆角 4 档命名、字阶 6 档 | 一份 `tokens.json` 评审通过 | 无代码变更 |
| P1 生成层 | 仓库根新增 `design-tokens/tokens.json` + `build.mjs`（Style Dictionary 5，3 个自定义 transform）；输出到 `frontend-uni/src/styles/tokens.generated.scss`、`miniapp-native/miniprogram/styles/tokens.generated.wxss`、`app-flutter/lib/kg_tokens.g.dart`；生成文件带"禁止手改"头 | `node design-tokens/build.mjs` 幂等（二次运行 git diff 为空）；H5 `npm run lint && npx vitest run && npm run build:h5`（Node 22）；小程序 `npx tsc --noEmit -p . && npx eslint miniprogram` | 删 3 个生成文件 |
| P2 接线 | `uni.scss` 旧 `$kg-*` 改为别名；`App.vue` 8 个 `--wot-*` 与 `app.wxss` 的 `--brand-*` 改为引用生成变量并映射到 `--td-brand-color-*`；Flutter `KgColors` 改为引用 `KgTokens` | 三端构建通过；H5 首页 / 练习 / 错题本 / 统计四页 375 & 1440 截图与 P1 前像素 diff 仅在被有意收敛的值上变化 | 别名指回旧值 |
| P3 页面收敛 | 按 R383 清单把页面写死的字号 / 圆角 / 色值替换为 token（分模块 PR，每 PR ≤1 个页面目录） | 每 PR 附前后截图；R383 统计脚本复跑，字号种数从 30 → ≤10、圆角 36 → ≤6 | 单 PR revert |
| P4 图标 | `icons.json` 语义映射 + `paths.js` 用脚本从 `lucide-static@1.41.0` 重新导出；Flutter 切 `lucide_icons_flutter` | 60 图标逐个截图对比；Flutter `flutter analyze`（需 SDK） | 保留旧 `paths.js` |
| P5 择机 | Wot v2 spike；tdesign-miniprogram 1.9→1.16 升级；fl_chart 仅在出现交互需求时 | 独立 PR，独立评估 | — |

## 10. 风险

| 风险 | 概率 / 影响 | 缓解 |
|---|---|---|
| 品牌色拍板拖延 → 生成层无法开工 | 中 / 高 | P1 先生成非颜色 token（字阶 / 间距 / 圆角 / 动效），颜色留占位 |
| `--td-*` 覆盖后 TDesign 组件暗色变量被我们的亮色值盖住 | 中 / 中 | 覆盖同时写在 `@media (prefers-color-scheme:dark)` 块里；开发者工具切暗色核对 login 页 |
| rpx 换算引入奇数 rpx（R383 亚像素问题）| 中 / 中 | `px-to-rpx` transform 输出后校验必须为偶数；px 源值只允许整数 |
| Style Dictionary 5 是 ESM-only，与 Node 20 的 `ERR_REQUIRE_ESM` 同类问题 | 低 / 低 | 构建脚本 `.mjs`，仓库已要求 Node 22 |
| `wd-icon` 字体 54KB 无用打包 | 已发生 / 低 | 优化项，P2 顺带查 tree-shake |
| Flutter 端本机无 SDK，生成的 Dart 只做了语法级人工检查 | 中 / 中 | P1 合并前需在有 Flutter SDK 的机器跑 `flutter analyze` |
| Lucide 升版后 60 个 path 形状微变 | 高 / 低 | P4 逐图截图对比，接受即视觉更新 |

## 11. 未验证 / 边界声明

- 未跑微信开发者工具，小程序真实分包体积、TDesign 暗色在真机的表现未实测。
- 未跑 Flutter analyze/test。
- 各库无障碍统计是 `aria-*`/`role=` 文本出现次数，只能说明"源码中有无该属性"，不等于可访问性评估。
- `tuniaoui/tnui-vue3-uniapp` GitHub API 404、`@arco-design/mobile-vue` / `tdesign-uni-app` npm 404 —— 只说明这些名字下没有找到，不断言项目不存在。
- `@wot-ui/ui` v2 的 383 个变量数是 grep `--wot-` 去重计数，含组件级变量。
- 体积数字口径已在各表注明（源码目录 / min.js / 构建产物三者不可横比）。

## 附：证据链接

- wot-design-uni v1 源码 `wot-design-uni/components/`；v2 迁移文档 https://wot-ui.cn/guide/migration-v2.html；v2 token `@wot-ui/ui/styles/theme/base/{color,radius,insets,typography}.scss`
- TDesign 小程序 token `tdesign-miniprogram/miniprogram_dist/common/style/theme/_{light,dark,font,spacer,radius}.wxss`；motion token https://github.com/Tencent/tdesign-common/blob/develop/style/web/_variables.less；uni 版 https://www.npmjs.com/package/@tdesign/uniapp、https://tdesign.tencent.com/uniapp/
- Vant Weapp `@vant/weapp/dist/common/style/var.wxss`；WeUI `weui-miniprogram/miniprogram_dist/weui-wxss/dist/style/weui.wxss`；微信设计指南 https://developers.weixin.qq.com/miniprogram/design/
- Ant Design Mobile `antd-mobile/es/global/{theme-default,theme-dark}.css`；Arco Mobile `@arco-design/mobile-react/tokens/app/arcodesign/default/index.less`
- Material 3：https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/material/motion.dart 、`text_theme.dart`；Cupertino `colors.dart`
- uView Pro `uview-pro/theme.scss`；NutUI `nutui-uniapp/styles/variables.scss`
- 图标：https://www.npmjs.com/package/lucide-static 、https://pub.dev/packages/lucide_icons 、https://pub.dev/packages/lucide_icons_flutter 、https://www.npmjs.com/package/tdesign-icons-svg 、https://www.npmjs.com/package/@tabler/icons 、https://www.npmjs.com/package/remixicon
- 图表：https://www.npmjs.com/package/@qiun/ucharts 、https://www.npmjs.com/package/echarts-for-weixin 、https://pub.dev/packages/fl_chart 、https://pub.dev/packages/charts_flutter
- 动效：https://uniapp.dcloud.net.cn/api/ui/animation.html 、https://www.npmjs.com/package/lottie-miniprogram 、https://www.npmjs.com/package/lottie-web 、https://pub.dev/packages/lottie
- 生成：https://www.npmjs.com/package/style-dictionary （5.5.2）
- 本仓库：`frontend-uni/src/uni.scss`、`frontend-uni/src/App.vue`、`frontend-uni/src/components/l-icon/`、`frontend-uni/scripts/sync-brand-tokens.mjs`、`miniapp-native/miniprogram/app.wxss`、`miniapp-native/project.config.json`、`app-flutter/lib/theme.dart`、`app-flutter/pubspec.yaml`
