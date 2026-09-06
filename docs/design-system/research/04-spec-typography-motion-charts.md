# 04 · 排版 / 布局 / 动效 / 图表 / 图标 / 细节 —— 一手资料研究（供设计规范 v4 直接引用）

> 分支 `devin/w5-research-spec`。调研日期 2026-09-06。
> 读者：写 v4 规范与落 token 的人。每条规则给出 **规则 → 来源 → 我们的取值（H5 / 小程序 / Flutter）→ 适用范围与例外 → 现状与迁移**。
> 已有资料不重做，只引用：`docs/design-benchmark/report.md`（粉笔/华图/一起公考对标）、`docs/design-v3/DESIGN.md`（v3 IA 与 token）、`docs/design/miniapp-v2/tokens.md`（小程序 v2 token）、`docs/handoff-context.md` R383（字阶收敛与漂移统计）。

## 0. 方法与证据边界

**看了什么**

- 官方文档 / 源码：Apple HIG（Typography / Layout / Accessibility / Motion / Charts / Dark Mode）、Apple 系统字体清单、Material 3 token 源码（`material-web/tokens/versions/v0_192/*.scss`）、Android 开发者文档、微信小程序官方文档（WXSS / 动画 / Skyline worklet / 自定义 tabBar / getWindowInfo / setData 性能 / DarkMode / 设计指南）、W3C（WCAG 2.2、clreq 中文排版需求）、MDN、Lucide 官方设计指南、Flutter API、华为/小米/Google Fonts 字体官方页、AOSP `fonts.xml`。
- 本仓库代码：`frontend-uni/src/uni.scss`、`frontend-uni/src/App.vue`、`frontend-uni/src/components/l-icon/l-icon.vue`、`frontend-uni/src/pages/stats/stats.vue`、`miniapp-native/miniprogram/app.wxss`、`miniapp-native/miniprogram/app.json`、`app-flutter/lib/theme.dart`，以及 `rg` 全仓统计（下文标注「仓内统计」的数字都能用同样命令复现）。
- 对比度数值全部用 WCAG 相对亮度公式现算（脚本见附录 A），不是估的。

**没做什么**

- 没有在真机上截屏对比字体 fallback，凡涉及「某机型实际渲染成什么」的结论一律标 **[待真机]**。
- 没有拆包任何 App/小程序，没有抓题库，没有复制任何字体/插画文件。
- GitHub Actions 本组织禁用，本文只依赖本地验证。

**证据分级**：`[官方]` 官方文档/源码原文；`[仓内]` 本仓库代码或统计；`[推断]` 由前两者推出的判断；`[待真机]` 需要设备验证。

---

## 1. 中文移动端排版

### 1.1 单位：rpx / px 双口径与 375 整像素对齐

**规则**：字号、行高、描边、分割线 **用 px**；容器间距、卡片内边距、栅格 **可用 rpx**（H5/小程序）。凡用 rpx 表达的字号必须是 **偶数**。

**来源**

- 微信 WXSS：`rpx` 规定屏幕宽度 = 750rpx；iPhone6（375pt）上 1rpx = 0.5px；官方明确写 **「较小的字体可能出现毛刺，尽量用偶数」** —— https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html `[官方]`
- 微信设计指南：以 375 / 390 逻辑宽为设计基准 —— https://developers.weixin.qq.com/miniprogram/design/ `[官方]`
- Apple HIG Typography：iOS 正文默认 17pt，最小可读 11pt —— https://developer.apple.com/design/human-interface-guidelines/typography `[官方]`

**为什么必须偶数**：375 屏 1rpx = 0.5px，`26rpx=13px` 落整像素，`25rpx=12.5px` 落半像素 → 文字边缘发虚、行高累加后行框错位。390/393 屏（iPhone 14/15）1rpx≈0.52px，**无论奇偶都对不齐**，所以字号本就不该跟屏宽缩放 —— 这是「字号用 px」的根本理由，不是风格偏好。`[推断，基于官方 rpx 定义]`

**我们的取值**

| 端 | 字号 | 行高 | 间距/圆角 | 1px 线 |
|---|---|---|---|---|
| H5 (uni-app) | `px`（SCSS token 改成 px，见 1.2） | 无单位倍数 | rpx 或 px 均可，但同一组件内不混 | `1px`，不用 `2rpx` |
| 微信小程序 | `px`（tdesign 组件内部本就是 px） | 无单位倍数 | rpx | `1px` |
| Flutter | 逻辑 px（dp） | `height:` 倍数 | 4 的倍数 | `1` |

**现状与迁移** `[仓内]`

- `uni.scss` 现为 `$kg-font-caption: 22rpx` → 375 屏上是 **11px**，低于 `DESIGN.md` 写的 caption 12px，也贴着 Apple 11pt 下限；`$kg-font-body: 30rpx`=15px、`$kg-font-h2: 34rpx`=17px 是对的。
- H5 仍存在 `21/23/25/27/29rpx` 奇数字号（`rg 'font-size:\s*(21|23|25|27|29)rpx' frontend-uni/src`），小程序 WXSS 存在 `25rpx ×15、27rpx ×13、23rpx ×13`（`rg -o 'font-size:\s*[0-9]+rpx' miniapp-native/miniprogram --glob '*.wxss' | sort | uniq -c`）。这些都是 R383 之后的残余，v4 第一步就是把它们映射到 1.2 的字阶。

### 1.2 字阶（v4 提案）

**规则**：8 级字阶，px 为主口径，rpx 只作 375 换算参考。每级绑定一个语义名，页面不得直接写数字。

| 语义 token | px | rpx(375 参考) | 字重 | 行高 | 用途 | 对标 |
|---|---|---|---|---|---|---|
| `display` | 28 | 56 | 600 | 1.2 | 首页大数字/成绩 | M3 headline-small 24/32；Apple Large Title 34 |
| `h1` | 22 | 44 | 600 | 1.3 | 页面标题、结果页标题 | M3 title-large 22/28 |
| `h2` | 17 | 34 | 600 | 1.4 | 卡片标题、导航栏标题 | Apple Body/Headline 17；`theme.dart` AppBar 17/w600 已一致 |
| `body-lg` | 16 | 32 | 400 | 1.7 | **题干、选项、解析**（长文本阅读） | M3 body-large 16/24；`DESIGN.md` 题面行高 1.7 |
| `body` | 15 | 30 | 400 | 1.55 | 普通正文、列表主文案 | `DESIGN.md` body 15；`--wot-cell-title-fs: 15px` |
| `sub` | 13 | 26 | 400 | 1.5 | 次级说明、列表副文案 | M3 body-medium 14 / Apple Footnote 13 |
| `caption` | 12 | 24 | 400/500 | 1.4 | 标签、时间、徽标 | M3 body-small 12/16；Apple Caption1 12 |
| `num` | 24–40 | — | 600 + tabular | 1.1 | 统计数字（配 1.5） | Apple Charts 建议数字紧凑排版 |

- 与现行 v3 差异：`display` 24→28、`h1` 20→22、新增 `body-lg` 16 专供题面（`DESIGN.md` 只规定了 1.7 行高没给独立字号，导致题面沿用 15px）。其他保持不变，减少迁移面。
- **不设 11px 级**：Apple 11pt 是「最小可读」不是「可用级」；小程序 `22rpx`(11px) 的 36 处用法应升 12px。

**来源**：M3 type scale token 源 https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-typescale.scss `[官方]`；Apple HIG Typography 同上 `[官方]`；`docs/design-v3/DESIGN.md` `[仓内]`。

**落地形态（伪 diff，仅示意，本 PR 不改代码）**

```scss
// frontend-uni/src/uni.scss
-$kg-font-display: 48rpx;  -$kg-font-h1: 40rpx;  -$kg-font-caption: 22rpx;
+$kg-font-display: 28px;   +$kg-font-h1: 22px;   +$kg-font-body-lg: 16px;  +$kg-font-caption: 12px;
+$kg-lh-title: 1.3;  +$kg-lh-body: 1.55;  +$kg-lh-read: 1.7;
```
```css
/* miniapp-native/miniprogram/app.wxss */
+--fs-display: 28px; --fs-h1: 22px; --fs-h2: 17px; --fs-body-lg: 16px; --fs-body: 15px; --fs-sub: 13px; --fs-caption: 12px;
```
```dart
// app-flutter/lib/theme.dart —— 用 TextTheme 的 headlineSmall/titleLarge/titleMedium/bodyLarge/bodyMedium/bodySmall/labelSmall 逐级映射，不新增自定义样式类
```

### 1.3 行高

**规则**：正文 1.55、题面/解析 1.7、标题 1.3、大数字 1.1；行高写无单位倍数，不用 px 绝对值（字号变时不用同步改）。

**来源**：WCAG 1.4.12 Text Spacing 要求内容在 line-height ≥1.5 倍字号时不丢内容 —— https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html `[官方]`；W3C clreq 对中文行距的说明（中文无上下伸部，视觉上比拉丁字更「满」，需要更大行距）—— https://www.w3.org/TR/clreq/ `[官方]`；M3 body-large 16/24 = 1.5 `[官方]`。

**取值**：三端同上表。Flutter 用 `TextStyle(height: 1.55)`，注意 Flutter `height` 是首行也生效的严格行高，标题单行时会顶部多留白，用 `leadingDistribution: TextLeadingDistribution.even` 居中。

**例外**：单行截断的列表标题可用 1.4；数字 1.1 只允许单行。

### 1.4 字重：中文字体到底有哪些字重可用

**结论先说**：三端都只承诺 **400 / 500 / 600** 三档语义（regular / medium / semibold），**不使用 700**，不使用 300 以下。

**证据**

| 平台 / 字体 | 官方字重 | 来源 | 对 700 的实际影响 |
|---|---|---|---|
| iOS · PingFang SC | Ultralight / Thin / Light / Regular / Medium / Semibold（**无 Bold**；2026-09-06 抓取官方清单核对） | https://developer.apple.com/fonts/system-fonts/ `[官方]` | 写 700 会落到 Semibold 或合成加粗 `[待真机]` |
| Android 13–15 · zh-Hans 系统 fallback | `fonts.xml` 中 `<family lang="zh-Hans">` 仅一个 `weight="400"` 的 `NotoSansCJK-Regular.ttc` | https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/data/fonts/fonts.xml（对照 android13/14/15 tag）`[官方]` | 500/600/700 全是渲染器合成加粗，**500 与 400 基本无差** `[推断]`；AOSP main 分支已改为可变字重轴，未来版本会好转 |
| 华为 · HarmonyOS Sans | 官方设计资源站提供多档字重字体包（具体档位以官网为准，页面为 JS 渲染，本次未能静态抓取核对） | https://developer.huawei.com/consumer/cn/design/resource/ `[官方·待核档位]` | 鸿蒙/EMUI 上 500/600 是否可区分 `[待真机]` |
| 小米 · MiSans | 官方字体站提供多档字重（同上，档位待核） | https://hyperos.mi.com/font/ `[官方·待核档位]` | 澎湃 OS 上 500/600 是否可区分 `[待真机]` |
| Web 字体 · Noto Sans SC | Google Fonts 提供可变字重 100–900 | https://github.com/google/fonts/blob/main/ofl/notosanssc/METADATA.pb `[官方]` | 若自托管可精确控制，但 CJK 全字重体积巨大，本产品不引入 |
| 微信内 | WebView 用宿主系统字体；微信设计指南要求用系统字体 | https://developers.weixin.qq.com/miniprogram/design/ `[官方]` | 同上行的 iOS/Android 结论 |

**规则**

1. 标题 / 强调用 **600**（iOS 有真 Semibold，Android 合成加粗至少可见）；中等强调用 **500**，但设计上不能依赖 500 与 400 的差别传递信息（Android 上看不出来），必须辅以颜色或字号。
2. 禁止 700：iOS 没有对应字形，Android 合成加粗在小字号发糊；`theme.dart` 中 `FontWeight.w600` 已符合。
3. 数字可以例外用 Inter/系统西文字体的 600–700（西文字体有真 Bold），但要限制在 `num` 级。

**现状** `[仓内]`：`rg 'font-weight:\s*(700|bold)'` H5 命中 **110** 处（600 为 248 处），小程序 WXSS 命中 **46** 处；v4 统一替换为 600。

### 1.5 字体栈与 fallback

**规则**：中文正文 **不加载 Web 字体**，走系统字体；字体栈的顺序按「iOS → 鸿蒙 → Android/小米 → 桌面 → 通用」排列，西文（数字）允许前置一个西文字体。

**来源**：微信设计指南「使用系统字体」`[官方]`；Apple HIG Typography 推荐系统字体以获得 Dynamic Type 与本地化最佳效果 `[官方]`；AOSP `fonts.xml` 决定 Android 的 zh-Hans fallback `[官方]`。

**取值（H5 与小程序共用）**

```css
font-family:
  Inter,                       /* 数字/西文；仅当已自托管或系统有此字体，不加载网络字体 */
  -apple-system, BlinkMacSystemFont, 'PingFang SC',
  'HarmonyOS Sans SC', 'MiSans',
  'Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC',
  'Hiragino Sans GB', 'Microsoft YaHei',
  system-ui, sans-serif;
```

与现行 `App.vue` 栈的差异：加入 `MiSans` 与 `Noto Sans CJK SC`（Android 系统 CJK 字体的家族名，见 `fonts.xml`），`HarmonyOS Sans` 补 `SC` 后缀（华为官方发布名为 HarmonyOS Sans SC；旧名保留一份亦可）。**注意** `[待真机]`：微信 Android WebView 是否暴露 `MiSans`/`HarmonyOS Sans SC` 家族名给 CSS 匹配，需要真机 `document.fonts.check()` 验证，本文不下结论。

Flutter：不设 `fontFamily`，用 `fontFamilyFallback: ['PingFang SC','HarmonyOS Sans SC','MiSans','Noto Sans CJK SC']`，系统字体由平台文本引擎解析。

### 1.6 数字：tabular-nums

**规则**：所有会**上下对齐**或**动态变化**的数字（倒计时、正确率、题数、排行榜）必须 `font-variant-numeric: tabular-nums`；段落里的数字不用。

**来源**：MDN `font-variant-numeric` —— `tabular-nums` 激活 OpenType `tnum` 特性，让数字等宽 —— https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric `[官方]`；Apple HIG Charts 建议数值标签清晰可读、避免跳动 `[官方]`。

**取值**

- H5：`.num, .tabular { font-variant-numeric: tabular-nums; }`，绑定到 `num` / 倒计时 / 统计卡。
- 小程序：WebView 渲染下 WXSS 支持 `font-variant-numeric`；Skyline 的官方 WXSS 支持列表中 **没有** `font-variant-numeric`（也没有 `line-break` / `overflow-wrap`，`word-break` 仅 `normal / break-all`）—— https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/wxss.html `[官方]` → 若切 Skyline，倒计时改用固定宽度 `min-width` + `text-align: right`。
- Flutter：`TextStyle(fontFeatures: [FontFeature.tabularFigures()])`。

**例外**：PingFang SC 的数字本身近似等宽，`tnum` 效果小但无副作用；Android Noto Sans CJK 数字默认比例宽，`tnum` 效果明显。西文字体 Inter 支持 `tnum`。

### 1.7 换行与标点

**规则**

1. 中文正文 **不写** `word-break: break-all`。默认 `word-break: normal` 已经允许 CJK 逐字换行。
2. 长 URL / 长英数串 / 用户输入的无空格串，用 `overflow-wrap: anywhere`（**不是** `word-break: break-all`，也不是 `line-break: anywhere`）。
3. 题干含数学式或英文时用 `line-break: strict` 避免行首出现「，。」、行尾出现「（「」。
4. 标点挤压（`text-spacing-trim`）目前 **只做渐进增强**，不能依赖。

**来源**

- MDN `word-break`：`break-all` 会在任意字符间断行，包括英文单词内部；`keep-all` 让 CJK 不在字间断 —— https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/word-break `[官方]`
- MDN `overflow-wrap`：`anywhere` 与 `break-word` 的区别是前者会把断点计入 `min-content`，适合 flex/grid 子项 —— https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-wrap `[官方]`
- MDN `line-break`：`strict` 为 CJK 施加最严格禁则；`anywhere` 会忽略所有禁则、连标点都能断到行首 —— https://developer.mozilla.org/en-US/docs/Web/CSS/line-break `[官方]`
- W3C clreq：中文行首禁止出现句号、逗号等点号，行尾禁止出现开引号/开括号；标点挤压属于版面处理 —— https://www.w3.org/TR/clreq/ `[官方]`
- MDN `text-spacing-trim`：浏览器支持有限 —— https://developer.mozilla.org/en-US/docs/Web/CSS/text-spacing-trim `[官方]`

**为什么 `break-all` 有害**：题干里的「GDP」「CO₂」「2019—2023」会被从中间掰开；`line-break: anywhere` 更糟，会让「。」跑到行首。两者都在解决「容器被撑破」这个 **布局问题**，正确解法是让 flex 子项 `min-width: 0` + `overflow-wrap: anywhere`。

**现状** `[仓内]`：H5 有 9 处 `word-break: break-all`、2 处 `overflow-wrap: anywhere`（`rg 'word-break: break-all|overflow-wrap: anywhere' frontend-uni/src`），逐处评估：题面/解析改为 `line-break: strict` + `overflow-wrap: anywhere`，标签/昵称保留 `anywhere`。

**取值**

```css
.q-text, .q-analysis { line-break: strict; overflow-wrap: anywhere; text-spacing-trim: space-first; /* 渐进增强 */ }
.tag, .nick { overflow-wrap: anywhere; min-width: 0; }
```
Flutter：`Text` 默认按 ICU 断行规则处理 CJK 禁则，不需要额外配置；长串用 `softWrap: true` 即可。

---

## 2. 布局

### 2.1 4/8pt 网格

**规则**：间距只允许 `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`（px 或等值偶数 rpx）。页面左右内边距 16px；卡片内边距 16px；卡片间距 12px；列表项内边距 12×16。

**来源**：M3 spacing 建议以 4dp/8dp 为基本单位、常用 8/16/24 —— https://m3.material.io/foundations/layout/understanding-layout/spacing `[官方]`；Apple HIG Layout 建议一致的边距与对齐 —— https://developer.apple.com/design/human-interface-guidelines/layout `[官方]`；`DESIGN.md` 现行 `4/8/12/16/20/24/32` `[仓内]`。

**取值**：H5 `uni.scss` 现有 `8rpx…96rpx` 已是 4 的倍数，保留；`$kg-page-pad: 32rpx`(16px) 保留。小程序 `app.wxss` 同。Flutter 用 `const EdgeInsets.all(16)` 等，禁止出现 14/18/22 这类数。

### 2.2 安全区：刘海 / 底部 Home 条 / 自定义 tabBar

**规则**

1. 页面底部固定条（练习页答题栏、结果页 CTA）必须 `padding-bottom: max(12px, env(safe-area-inset-bottom))`。
2. 顶部只在**自绘导航栏**时处理 `env(safe-area-inset-top)`；用系统导航栏（`pages.json navigationStyle: default` / 小程序默认）时不用管。
3. 自定义 tabBar 自己负责底部安全区，并留出内容区 padding 避免被遮。

**来源**

- MDN `env()`：`safe-area-inset-*` 四个变量；H5 需 `<meta name="viewport" content="… viewport-fit=cover">` 才有非零值 —— https://developer.mozilla.org/en-US/docs/Web/CSS/env `[官方]`
- 微信 `wx.getWindowInfo()` 返回 `safeArea{top,bottom,left,right,width,height}` 与 `statusBarHeight` —— https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html `[官方]`
- 微信自定义 tabBar：`app.json tabBar.custom: true`，根目录 `custom-tab-bar/`，页面用 `this.getTabBar()` 同步选中态 —— https://developers.weixin.qq.com/miniprogram/dev/framework/ability/custom-tabbar.html `[官方]`
- Android 系统栏（edge-to-edge 下内容延伸到状态栏/导航栏之下，需处理 insets）—— https://developer.android.com/design/ui/mobile/guides/foundations/system-bars `[官方]`
- Flutter `SafeArea` 读取 `MediaQuery.padding` 自动避让 —— https://api.flutter.dev/flutter/widgets/SafeArea-class.html `[官方]`

**取值**

| 端 | 底部固定条 | 顶部 | tabBar |
|---|---|---|---|
| H5 | `padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px))`；`index.html` 已按 `coverSupport` 动态加 `viewport-fit=cover`（仓内 L38）| 系统导航栏，不处理 | uni 原生 tabBar 自带避让 |
| 小程序 | WXSS 同上（`env()` 在小程序 WebView 可用）| 自定义导航时用 `statusBarHeight` | 若切自定义 tabBar，`custom-tab-bar` 内加 `padding-bottom: env(safe-area-inset-bottom)` |
| Flutter | `SafeArea(top:false, child: …)` 包底栏 | `Scaffold` + `AppBar` 自动 | `NavigationBar` 自动 |

**现状** `[仓内]`：H5 28 处、小程序 10 处 `safe-area` 用法（`rg safe-area`），分散在页面里 → v4 提为 mixin `@include kg-safe-bottom(12px)` / WXSS class `.safe-b`。

### 2.3 触控目标

**规则**：可点击元素 **命中区** ≥ 44×44 px（H5/小程序，等价 iOS 44pt）、Flutter ≥ 48 dp；视觉尺寸可以更小（如 24px 图标），但用 padding 补足命中区；相邻目标间距 ≥ 8px。

**来源**：Apple HIG Accessibility / Layout：44×44pt 最小 —— https://developer.apple.com/design/human-interface-guidelines/accessibility `[官方]`；Android 48×48dp —— https://developer.android.com/develop/ui/compose/accessibility/api-defaults `[官方]`；Flutter `kMinInteractiveDimension = 48.0` —— https://api.flutter.dev/flutter/material/kMinInteractiveDimension-constant.html `[官方]`；WCAG 2.2 2.5.8 Target Size (Minimum, AA) 24×24 CSS px，2.5.5 (AAA) 44×44 —— https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html `[官方]`；微信设计指南建议 7–9mm 可点击区 `[官方]`。

**取值**：`--kg-hit: 44px`（H5/小程序）；Flutter 用 `IconButton`（默认 48）不要用裸 `GestureDetector`。

### 2.4 响应式断点：H5 桌面 ≥768 / ≥1024

**规则**：三档 —— `<768` 单列移动布局；`768–1023` 居中单列（max-width 640）+ 左侧窄导航；`≥1024` 双栏：主列 640–720px + 右侧 320px 辅栏（统计/计划/续练卡），`≥1366` 主列可到 760。**题面阅读列宽永不超过 760px**（约 45 个中文字/行）。

**来源**：Android 窗口尺寸类 compact <600dp / medium 600–839 / expanded ≥840 —— https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes `[官方]`；Apple HIG Layout（iPad 多列与可读宽度）`[官方]`；`DESIGN.md`「桌面 ≥768 壳」`[仓内]`。

**现状** `[仓内]`：H5 已有 `700 / 768 / 1024 / 1280 / 1366` 五个断点（`rg -o '@media[^{]+' frontend-uni/src --glob '*.vue'`：768px ×27、1024px ×24、700/1280/1366 各 1），`App.vue` 里已实现居中壳 + `scrollbar-gutter: stable`。v4 只做两件事：把 700 并入 768；把 1280 与 1366 合并为一档（差别只有主列宽度）。

**双栏怎么排**（≥1024）

```
| 侧导航 72 | 主列 ≤720（题面 / 列表） | 辅栏 320（今日计划 · 连续天数 · 错题待复习 · 续练卡） |
```
练习页在 ≥1024 时把「解析」放右栏、题干与选项留左栏，避免答完后整页滚动。管理台已有 `.pagehead{flex-wrap:wrap}` / `.kpis minmax(140px)` 的做法可复用。

### 2.5 列表与卡片密度

**规则**：三档密度 token —— `compact`（列表行高 44，用于设置/筛选）、`default`（56，用于错题/卷库列表）、`comfortable`（72，带副标题+右侧数值）。卡片：内边距 16，标题与正文间距 8，卡片间距 12；一屏（375×812）首页不超过 4 张卡。

**来源**：M3 list item 单行 56dp / 双行 72dp（M3 Lists 组件规范）—— https://m3.material.io/components/lists/specs `[官方]`；Apple HIG Lists and tables `[官方]`；对标结论「粉笔首页 3 卡 + 底部入口」见 `docs/design-benchmark/report.md` `[仓内]`。

**取值**：`wd-cell` 已是 H5 列表主组件（仓内 40 处），把三档密度映射到 `--wot-cell-padding` 等 CSS 变量，不另写列表组件；小程序对应 `t-cell`。

---

## 3. 动效

### 3.1 时长与曲线 token

**规则**：只允许 4 个时长 + 3 条曲线；页面里不得出现裸数字 `ms`。

| token | 值 | 对应 M3 | 用途 |
|---|---|---|---|
| `dur-instant` | 100ms | short2 | 按压反馈、开关、颜色变化 |
| `dur-fast` | 150ms | short3 | 图标切换、小元素显隐、Toast 出现 |
| `dur-base` | 250ms | medium1 | 卡片展开、抽屉/底部面板、页面内元素位移 |
| `dur-slow` | 400ms | medium4 | 页面级转场、结果页揭示、图表首次绘制 |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | easing-standard | 默认 |
| `ease-decel` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | emphasized-decelerate | 元素进入 |
| `ease-accel` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | emphasized-accelerate | 元素离开 |

**来源**：M3 motion token 源码（`duration-short1…extra-long4 = 50…1000ms`；`easing-standard cubic-bezier(0.2,0,0,1)`；`emphasized-decelerate cubic-bezier(0.05,0.7,0.1,1)`；`emphasized-accelerate cubic-bezier(0.3,0,0.8,0.15)`）—— https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss `[官方]`；说明页 https://m3.material.io/styles/motion/easing-and-duration/tokens-specs `[官方]`。

**现状** `[仓内]`：`uni.scss` 已有 `$kg-dur-fast:150ms / $kg-dur-base:250ms / $kg-ease: cubic-bezier(.2,.8,.2,1)`；页面里散落 `300 / 400 / 600ms`。曲线建议改用 M3 标准曲线（现值 `(.2,.8,.2,1)` 是对称曲线，进入/离开一致，缺少「进快出慢」的层次）。

### 3.2 何时用 / 何时不用

**规则**

1. 动效只服务三件事：**指示状态变化**（选中/正确/错误）、**保持空间连续**（面板从哪来回哪去）、**掩盖等待**（骨架屏）。装饰性动效一律不做。
2. 高频操作（每题都触发的：选项按压、下一题切换）**≤150ms**，否则 10 题下来累计 >2.5s 等待。
3. 动效不能是信息的唯一载体：答对答错必须同时有颜色+图标+文字。
4. 循环动画（脉冲、呼吸）只允许出现在「加载中」，且同屏只有一个。
5. 尊重系统「减弱动态效果」。

**来源**：Apple HIG Motion（动效要有目的、简短、可跳过；不要让动效成为理解内容的必要条件；尊重 Reduce Motion）—— https://developer.apple.com/design/human-interface-guidelines/motion `[官方]`；WCAG 2.3.3 Animation from Interactions —— https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html `[官方]`；MDN `prefers-reduced-motion` —— https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion `[官方]`；微信设计指南「同一页面不出现多于一个加载动画」`[官方]`。

**现状** `[仓内]`：`App.vue` 已有 `@media (prefers-reduced-motion: reduce)` 全局把 animation/transition 压到 0.01ms —— 保留；小程序 WXSS 无对应处理（微信 WebView 是否支持该 media query `[待真机]`），Flutter 用 `MediaQuery.disableAnimationsOf(context)`。

### 3.3 微信小程序性能约束

**规则**

1. 首选 **WXSS `transition`/`animation`**（渲染层执行，不经逻辑层）。
2. 需要 JS 驱动的关键帧用 **`this.animate(selector, keyframes, duration, cb)`**（基础库 2.9.0+），不用 `wx.createAnimation` + `setData` 逐帧。
3. 滚动驱动用 `this.animate` 的 **ScrollTimeline** 形式。
4. **禁止**在 `onPageScroll` / 拖拽回调里 `setData` 驱动动画。
5. 若切 Skyline：用 worklet（`shared / runOnUI / timing / Easing`）在 UI 线程跑；同时注意 Skyline WXSS 支持列表里没有 `font-variant-numeric` / `line-break` / `overflow-wrap`，`position: fixed` 仅 8.0.43+ 且限制多，`box-shadow` 不支持多层叠加，`filter` 不支持 `drop-shadow`（均见该页备注列）。

**来源**

- 动画 API：https://developers.weixin.qq.com/miniprogram/dev/framework/view/animation.html `[官方]`
- setData 性能提示（数据量小、频率低、不 setData 与渲染无关的数据、避免在滚动中 setData）：https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_setData.html `[官方]`
- Skyline worklet：https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html `[官方]`
- Skyline WXSS 差异：https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/wxss.html `[官方]`

**现状** `[仓内]`：`app.json` `"renderer": "webview"`；WXSS 仅 2 处 keyframes（`cb-pop 0.35s / cb-bounce 0.8s`），无 `this.animate` 用法（`rg 'this.animate|createAnimation' miniapp-native --glob '*.ts'` = 0）。v4 把 `cb-pop 0.35s` 归到 `dur-base`（250ms）或 `dur-slow`（400ms），删掉 0.35 这个非 token 值。

---

## 4. 图表（学习统计）

### 4.0 总原则

**规则**：图表必须能被「看不见图」的人读懂 —— 每张图旁边有一句文字结论（如「本周正确率 72%，比上周 +5%」），图本身 `aria-hidden`/`role="img" aria-label`；颜色不是唯一编码（配形状/文字/位置）；空态与加载态是图表组件的一部分，不是页面另写。

**来源**：Apple HIG Charts（用文字描述图表要点；标注要清晰；为 VoiceOver 提供描述）—— https://developer.apple.com/design/human-interface-guidelines/charts `[官方]`；WCAG 1.4.1 Use of Color —— https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html `[官方]`；WCAG 1.4.11 Non-text Contrast 3:1 —— https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html `[官方]`。

**技术选型** `[仓内]`：`stats.vue` 现有 CSS/DOM 热力图、5 模块 CSS 雷达、`conic-gradient` 环形进度，无 ECharts/uCharts 依赖。**v4 不引入图表库**（如无必要勿增实体）：5 种图里 4 种 CSS 能做好；趋势折线用内联 `<svg>` polyline 即可（H5/小程序 `<image>` data URI 或 canvas 2D）。真要上库时只允许一个，且要给出 CSS 方案做不到的具体理由。

### 4.1 五种图的表达规则

| 图 | 适合的数据 | 不适合 | 关键规则 | 无障碍/深色 |
|---|---|---|---|---|
| **趋势折线** | 7/30 天正确率、每日题量（时间序列，≥5 点） | 少于 5 个点、类别数据 | Y 轴从 0 起或明确标注；只画 1–2 条线；最新点强调并标数值；X 轴标签 ≤7 个 | 线 ≥2px；数据点用实心圆 + 数值；深色下线色用 `brand-text`（#8fa8ff，对卡片 7.2:1） |
| **雷达（5 模块能力）** | 恰好 3–6 个维度、同量纲（都是 0–100%） | 维度 >6、量纲不同、需要精确比较 | 顶点必须标文字+数值；网格 3 层足够；填充 α≤0.25 | 雷达天生难读，必须配 5 行文字列表（模块·正确率）作为等价表达；色弱不依赖面积色 |
| **热力日历** | 连续打卡/每日题量（≥4 周） | 单周数据（改用 7 个条） | 4–5 档，`0` 用 `--fill` 而非纯白；档位用 **同色明度阶** 不用多色相；hover/点按显示日期+数值 | 4 档明度间对比 ≥ 1.3:1 逐级递进；深色下用同色相降饱和阶；旁边放「N 天 · 最长连续 M 天」文字 |
| **环形进度** | 单一 0–100% 目标（今日 20 题完成度、掌握率） | 多段占比（改用横向堆叠条） | 中心放大数字 + 单位；环宽 8–12px；100% 时换成对勾态 | 环 vs 轨道对比 ≥3:1；数字用 `tabular-nums` |
| **分布柱状** | 各题型错题数、用时分布（类别 ≤8） | 时间序列（改折线） | 横向柱（中文类目名长）；柱顶/柱尾标数值；同色单一色相，仅最大值强调 | 柱与背景 ≥3:1；不要红绿并列作类目色 |

**取值（色板）**：图表语义色只用 3 组 —— `brand`（主序列）、`ok/bad`（正确/错误二分）、`ink-3`（对照/基线）。深色模式 **不直接复用浅色 hex**：`#2e5bff` 在 `#1d1f28` 卡片上只有 3.17:1（附录 A），线条勉强达 3:1、文字不达标；改 `#8fa8ff`（7.2:1）。M3 与 Apple 都要求深色模式单独校色而非反色（Apple HIG Dark Mode —— https://developer.apple.com/design/human-interface-guidelines/dark-mode `[官方]`）。

**空态/加载态**：数据不足时 **不画空图表**，显示「再做 5 题就能看到趋势」+ CTA（`stats.vue` 现有空态 CTA 做法保留并提为组件）；加载中用与图表等高的骨架块，不放旋转 loading。

---

## 5. 图标

**规则**

1. 只用一套线性图标（Lucide），24 网格、**2px 描边**、圆角端点；16px 及以下场景改 **1.5px**（视觉补偿）。
2. 三个尺寸档 **16 / 20 / 24**，加 1 个装饰档 32（空态/大按钮）。禁止 13/14/15/17/18/22 这些中间值。
3. 与文字对齐：图标 `vertical-align: -0.125em`（或 flex `align-items:center`），图标高 = 文字行高的 1.0–1.25 倍：`sub`13→16、`body`15→20、`h2`17→20/24。
4. 颜色继承文字色（`currentColor`），不写死 hex。

**来源**：Lucide 设计原则（原文："Icons must be designed on a 24 × 24-pixel canvas" / "at least 1 pixel of padding" / "Strokes must be 2 pixels wide" / round line joins & caps）—— https://lucide.dev/contribute/icons/design-principles `[官方]`；Apple HIG SF Symbols 图标与文字按 x-height/基线对齐、随文字字重缩放的思路 —— https://developer.apple.com/design/human-interface-guidelines/sf-symbols `[官方]`；M3 icons 24dp 标准 —— https://m3.material.io/styles/icons/designing-icons `[官方]`。

**现状与迁移** `[仓内]`

- `l-icon.vue`：默认 `size 20 / strokeWidth 2`，符合；但 **颜色默认写死 `#40434e`** 且通过 `<image src="data:image/svg+xml">` 渲染，SVG 内 `stroke` 是固定色 → **无法 `currentColor`，深色模式下每处都要手传 color**。这是 `<image>` 方案的固有限制，不是写法问题。
- 仓内 `<l-icon size=…>` 用了 **14 种尺寸**（20×38、18×29、16×19、13×13、22×9、15×7、14×7 …），`stroke-width=1.5` 仅 1 处。
- 迁移：① 增加 `tone` 属性（`ink/ink-2/ink-3/brand/ok/bad/inverse`），组件内查 CSS 变量的当前值（H5 可 `getComputedStyle`；小程序端传 token 名→在 WXSS 变量表里映射），不再传 hex；② 尺寸收敛到 16/20/24/32，`13/14/15`→16，`17/18`→20，`22`→24；③ 16 档默认 `strokeWidth 1.5`。
- Flutter：`lucide_icons` 包（若已引入）或 `Icon(size: 16/20/24)`；保持同一套图标名，不混用 Material Icons 做功能图标（Material 图标可作系统级图标如返回箭头）。

---

## 6. 细节与状态

### 6.1 分割线

**规则**：分割线只用 1 个 token `--line`；宽度 `1px`（不是 `2rpx`，否则 2× 屏是 1px、3× 屏是 0.67px 会消失或变粗不一致）；卡片内部列表项之间用 inset 分割线（左缩进 16 与内容对齐），卡片之间 **不画线**（用 12px 间距分隔）。

**来源**：Apple HIG Lists（inset separators 与内容对齐）`[官方]`；M3 Divider（full-width / inset / middle）—— https://m3.material.io/components/divider/guidelines `[官方]`。

**取值**：H5 `--line: #e7e9f0`（对白卡 1.21:1，作为纯装饰线可接受；WCAG 1.4.11 对**非功能性**分割线不做要求）；深色 `#2b2e3a`。小程序 `--border: #eceef4 / #2a2d3a`。**建议合并命名为 `--line`**，两端一致。

### 6.2 阴影 / 层级

**规则**：3 级 + 0 级，不允许品牌色投影作为常态。

| 层级 | 用途 | H5/小程序 | Flutter |
|---|---|---|---|
| `elev-0` | 平铺卡片（默认）—— 用 1px `--line` 边或背景色差分层，**不用阴影** | `box-shadow: none; border:1px solid var(--line)` | `elevation: 0` + `side: BorderSide` |
| `elev-1` | 悬浮卡（首页 hero、续练卡） | `0 2px 8px rgba(23,24,28,.06)` | `elevation: 1` |
| `elev-2` | 弹出层（底部面板、下拉、Popover） | `0 8px 24px rgba(23,24,28,.12)` | `elevation: 3` |
| `elev-3` | 模态对话框 / Toast | `0 12px 32px rgba(23,24,28,.18)` | `elevation: 6` |

深色模式：阴影几乎不可见，改用 **表面提亮**（`--card` 比 `--bg` 亮一档：`#1d1f28` vs `#15161c` 已如此），M3 对深色的做法同理（surface tint）。

**来源**：M3 elevation token（level0–5 = 0/1/3/6/8/12dp）—— https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-elevation.scss `[官方]`；Apple HIG Materials/Dark Mode `[官方]`。

**现状** `[仓内]`：H5 `box-shadow` **12 种取值**，其中 5 种是品牌蓝投影（`rgba(46,91,255,.25/.3/.45)`）。v4 保留 1 个品牌投影只给主按钮按压/hero，其余归入 4 级。

### 6.3 圆角层级（外 > 内）

**规则**：`radius-xs 6`（标签/徽标）、`radius-sm 10`（按钮/输入框）、`radius-md 14`（卡片）、`radius-lg 20`（底部面板/hero）、`radius-full 999`（胶囊/头像）。**嵌套时内元素圆角 = 外圆角 − 内边距**（外 14、内边距 8 → 内 6），保证同心。

**来源**：M3 shape token（extra-small 4 / small 8 / medium 12 / large 16 / extra-large 28 / full）—— https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-shape.scss `[官方]`；Apple HIG 关于连续圆角与同心的说明（Layout）`[官方]`；`DESIGN.md` 现行 10/14/20/999 `[仓内]`。

**现状** `[仓内]`：R383 统计 H5 36 种圆角；`uni.scss` 有 `12/20/28/40/999rpx`（=6/10/14/20/999px），与本表一致，问题在页面没用 token。**`--radius: 28rpx`** 在 `App.vue` 里是全局默认，即卡片 14px，保留。

### 6.4 交互状态：按压 / 禁用 / 加载

**规则**

| 状态 | 视觉 | 时长 | 备注 |
|---|---|---|---|
| 按压 pressed | 背景叠 `rgba(ink, .06)`（浅）/ `rgba(255,255,255,.06)`（深）**或** `scale(.98)`，二选一，不叠加 | `dur-instant` 100ms | H5 用 `:active`，小程序用 `hover-class`（`hover-start-time 20 / hover-stay-time 70`），Flutter 用 `InkWell` 默认 |
| 禁用 disabled | 文字/图标 `opacity .4`，**不改 hex**（保证深色也对）；`cursor: not-allowed`（桌面） | — | 禁用按钮**不需要**满足 4.5:1（WCAG 1.4.3 例外「非活动组件」），但要保留可读 |
| 加载 loading | 按钮内 spinner 替换文字，宽度锁定（`min-width` 记录点击前宽度）防抖动；页面级用骨架屏，不用全屏遮罩 | spinner 周期 800ms 线性 | 同屏 ≤1 个 loading（微信设计指南） |
| 选中 selected（选项） | 边框 2px `brand` + 背景 `brand-soft`，答对 `ok-soft`/答错 `bad-soft` + 图标 | `dur-fast` | 颜色+图标+文字三重编码 |

**来源**：M3 States（state layer 不透明度 pressed 0.10 / hover 0.08 / focus 0.10 / disabled 内容 0.38）—— https://m3.material.io/foundations/interaction/states/state-layers `[官方]`；WCAG 1.4.3 对 inactive UI 组件的例外 `[官方]`；微信 `hover-class` —— https://developers.weixin.qq.com/miniprogram/dev/component/view.html `[官方]`。

**现状** `[仓内]`：`App.vue` 已为 wot 设置 `--wot-cell-tap-bg: rgba(255,255,255,.06)`（深色），浅色沿用 wot 默认；建议同样通过 wot CSS 变量落 pressed 态，不自写 `:active`。

### 6.5 骨架屏

**规则**：骨架只出现在**首屏首次加载**与**切 tab 后的空白区**；形状要和真实内容的行数/卡片数一致（不做泛用灰块）；动画用低对比呼吸（`opacity .6→1`，1.2s，`ease-in-out`），不用彩色渐变扫光；超过 3s 仍未加载 → 替换为「加载失败 / 重试」，骨架不能无限呼吸。减弱动效时静止。

**来源**：微信设计指南「局部加载优先于模态加载」`[官方]`；Apple HIG Loading（尽快显示内容、用占位保持布局稳定）—— https://developer.apple.com/design/human-interface-guidelines/loading `[官方]`；WCAG 2.3.3 `[官方]`。

**现状** `[仓内]`：`home.vue` 有 `.skel-plan / .skel-ann / .skel-sz / .skel-row×6`，`practice.vue`、`predict-card.vue` 各有一套 → 抽成一个 `kg-skeleton` 组件（props: `lines / height / radius`），三处复用。

### 6.6 空态

**规则**：空态 = 一句话说清「为什么空」+ 一个主动作；插画可选、**单色线性 + 品牌色点缀**风格（与 Lucide 同一笔触，2px 线，不用 3D/渐变插画），尺寸 ≤120px，深色模式下降低到 `opacity .85`；不同空态复用同一套 3–4 张插画（无数据 / 无网络 / 无结果 / 全部完成），不为每页画一张。**不复制任何第三方插画**，自绘或用开源许可（如 undraw 需按其许可）。

**来源**：Apple HIG（清晰的空状态说明与行动）`[官方]`；对标报告中粉笔/华图空态做法见 `docs/design-benchmark/report.md` `[仓内]`。

**现状** `[仓内]`：`book.vue` 有 4 种 `.card.empty` 分支、`stats.vue` 有带 CTA 的空态，文案风格不一，抽成 `kg-empty`（props: `kind / title / desc / action`）。

### 6.7 Toast 与页内提示怎么选

**决策规则**

| 场景 | 用什么 | 理由 |
|---|---|---|
| 轻量成功确认、无需再操作（已收藏、已复制、已同步） | Toast，1.5s，无图标或单图标 | 微信设计指南 Toast 1.5s；微信 `wx.showToast` 默认 1500ms |
| 表单校验、字段错误 | 字段下方 inline 文字（红色 + 图标） | Toast 会消失，用户回头看不到错在哪 |
| 影响后续操作的错误（网络失败、提交失败） | 页内横幅 / 卡片内错误态 + 重试按钮 | 需要可重试、可停留 |
| 需要用户决策（退出保留进度、删除） | Modal（`uni.showModal` / `wx.showModal`） | 已有 R380 退出弹窗为范例 |
| 后台状态（离线队列已同步、有未完成练习） | 页内卡片/横幅（首页续练卡） | 常驻直到处理 |

**硬规则**：Toast **不能**承载错误细节、不能连发（同一时刻只显示一条，新 Toast 替换旧的）、不放在底部 tabBar 上方以外的位置（避免遮住主按钮）。

**来源**：微信设计指南（Toast 1.5s、局部加载）`[官方]`；`wx.showToast` `duration` 默认 1500 —— https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html `[官方]`；Apple HIG（iOS 无系统 Toast，倾向于就地反馈）`[官方]`；M3 Snackbar（单条、4–10s、可带一个动作）—— https://m3.material.io/components/snackbar/guidelines `[官方]`。

**现状** `[仓内]`：H5 218 处 `uni.showToast` 调用、小程序 62 处 —— 明显过度使用。v4 先做统计分类（成功/错误/信息），把错误类迁到 inline/横幅。

### 6.8 无障碍对比度（含深色模式实测）

**规则**：正文 ≥4.5:1；大字（≥24px 或 ≥18.66px 加粗）≥3:1；图标、边框、图表元素、状态指示 ≥3:1；**深色模式单独测一遍**，不假设反色后仍达标。

**来源**：WCAG 1.4.3 —— https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html；1.4.11 —— https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html `[官方]`。

**现有 token 实测**（附录 A 脚本，`[仓内]` 数值）

| 端 | token | 对白卡 / 深卡 | 判定 | 处置 |
|---|---|---|---|---|
| H5 浅 | `--ink-3 #6b7280` | 4.83 | 通过（仅在 `#fff` 卡上；在 `#f6f7fb` 页面底是 4.52，贴线） | 保留，但不要再降 |
| H5 浅 | `--ink-4 #b0b4c0` | 2.07 | **不通过** | 只用于 placeholder/禁用（仓内 10 处 `color: var(--ink-4)` 逐条核） |
| H5 浅 | `--ok #16a34a` 作文字 | 3.30 | **不通过**（仓内 14 处） | 文字改 `--ok-strong #15803d`(5.02)；`--ok` 只做图标/背景 |
| H5 浅 | `--warn #d97706` 作文字 | 3.19 | **不通过**（仓内 9 处） | 文字改 `--warn-strong #b45309`(5.02) |
| H5 浅 | `--info #0284c7` 作文字 | 4.10 | **不通过** | 文字改 `--info-strong #075985` |
| H5 浅 | 白字在 `--ok` 按钮 | 3.30 | 仅 ≥18.66px 加粗可用 | 绿色实心按钮改用 `--ok-strong` 底 |
| H5 浅 | 白字在 `--brand #2e5bff` | 5.18 | 通过 | — |
| H5 深 | `--brand #2e5bff` 直接用作线/文字 | 3.17 | 线勉强、文字不通过 | 文字用 `--brand-text #8fa8ff`(7.20)，图表线同 |
| H5 深 | `--ink-3 #8a8ea0` | 5.05 | 通过 | — |
| H5 深 | `--ink-4 #5c6070` | 2.63 | **不通过** | 同浅色处置 |
| 小程序浅 | `--t3 #858ba3` | 3.38 | **不通过**，且是次级文字主力（65 处 `color: var(--t3)`） | 提到 `#6b7280`(4.83) 或与 H5 `--ink-3` 对齐 |
| 小程序浅 | `--success #10b981` / `--warning #f59e0b` / `--info #0ea5e9` 作文字 | 2.54 / 2.15 / 2.77 | **不通过**（23 处） | 文字用 `-deep` 变体（`--success-deep #059669` 3.77 仍不够，需再深至 ≈`#047857`） |
| 小程序浅 | 白字在 `--accent-500 #ff8a3d` | 2.35 | **不通过** | 橙色实心按钮改深色字或换底 |

**结论**：两端的 **语义色「亮色档」都只能做图标/背景，文字必须用 `-strong/-deep` 档**；小程序 `--t3` 是最大的一处系统性问题。Flutter 用 `ColorScheme.fromSeed` 生成的 `onSurfaceVariant` 等已满足 M3 对比度，但 `KgSemantic` 自定义色需要同样过一遍脚本。

---

## 7. 实施矩阵（v4 落地顺序）

| 项 | H5 `uni.scss`/`App.vue` | 小程序 `app.wxss` | Flutter `theme.dart` | 优先级 |
|---|---|---|---|---|
| 字号改 px + 8 级字阶 + 删 11px | 改 `$kg-font-*`，页面替换奇数 rpx | 新增 `--fs-*`，替换 22/23/25/27rpx | `TextTheme` 映射 | P0 |
| 字重 700→600 | 全仓替换 | 全仓替换 | 已是 w600 | P0 |
| 语义色文字改 `-strong` 档；`--t3` 提亮度 | 14+9 处 | 65+23 处 | 核 `KgSemantic` | P0（无障碍） |
| `tabular-nums` 绑到 num/倒计时 | class `.tabular` | 同 | `fontFeatures` | P1 |
| `break-all` → `strict + anywhere` | 9 处 | 核 WXSS | 无需 | P1 |
| 安全区 mixin | `@mixin kg-safe-bottom` | `.safe-b` | `SafeArea` | P1 |
| 断点 700→768，1280/1366 合并 | `App.vue` | — | — | P2 |
| 动效 token 4 时长 3 曲线 | 替换 300/400/600ms | 替换 0.35s/0.8s | `Durations`/`Curves` 常量 | P1 |
| 阴影收 4 级 | 12→4 种 | 核 | `elevation` | P2 |
| `l-icon` 尺寸收敛 + tone 属性 | 组件 + 14 种尺寸→4 | 同组件 | — | P1 |
| `kg-skeleton` / `kg-empty` 组件 | 抽 3 处 / 5 处 | 同 | 已有 widgets 核对 | P2 |
| Toast 分类迁移 | 218 处分类 | 62 处 | — | P2 |
| 图表：文字结论 + aria + 深色色板 | `stats.vue` | 对应页 | — | P1 |

**验收方式**（本地，不走 CI）：字阶/圆角/色值/阴影种类数用 R383 同款 `rg | sort | uniq -c` 脚本回归；对比度用附录 A 脚本跑全部 token 对；H5 `npm run lint && npx vitest run && npm run build:h5`（Node 22）；小程序 `npx tsc --noEmit -p . && npx eslint miniprogram`。

---

## 8. 待真机验证清单

1. iOS 微信 / Safari：`font-weight: 500` 是否真的落 PingFang SC Medium；700 是落 Semibold 还是合成加粗。
2. Android 微信（小米 / 华为 / 其他）：`document.fonts.check('12px MiSans')` / `'HarmonyOS Sans SC'` 是否为 true；`font-weight 500` 与 400 是否可辨。
3. 微信 Android WebView 是否响应 `prefers-reduced-motion`（H5 在 Chrome 已确认响应）。
4. 小程序 `env(safe-area-inset-bottom)` 在 iPhone 全面屏与 Android 手势导航下的实际值（可用 `wx.getWindowInfo().safeArea` 交叉验证）。
5. 390/393 宽机型上 `26rpx` 字号的渲染模糊程度（用于说服团队改 px 的截图证据）。

---

## 附录 A · 对比度计算脚本

```python
def lum(h):
    h = h.lstrip('#'); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def cr(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

# 例：cr('#6b7280', '#ffffff') -> 4.83 ; cr('#858ba3', '#ffffff') -> 3.38
```
公式来源：WCAG 2.2 「relative luminance」与「contrast ratio」定义 —— https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

## 附录 B · 来源索引

Apple HIG：Typography / Layout / Accessibility / Motion / Charts / Dark Mode / Loading / SF Symbols —— `https://developer.apple.com/design/human-interface-guidelines/{typography|layout|accessibility|motion|charts|dark-mode|loading|sf-symbols}`；系统字体清单 https://developer.apple.com/fonts/system-fonts/
Material 3：type scale https://m3.material.io/styles/typography/type-scale-tokens；spacing https://m3.material.io/foundations/layout/understanding-layout/spacing；motion https://m3.material.io/styles/motion/easing-and-duration/tokens-specs；states https://m3.material.io/foundations/interaction/states/state-layers；token 源码 `https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-{typescale|motion|shape|elevation}.scss`
Android：窗口尺寸类 https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes；系统栏 https://developer.android.com/design/ui/mobile/guides/foundations/system-bars；48dp https://developer.android.com/develop/ui/compose/accessibility/api-defaults；`fonts.xml` https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/data/fonts/fonts.xml
微信：WXSS https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html；动画 https://developers.weixin.qq.com/miniprogram/dev/framework/view/animation.html；Skyline worklet https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html；Skyline WXSS https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/wxss.html；自定义 tabBar https://developers.weixin.qq.com/miniprogram/dev/framework/ability/custom-tabbar.html；getWindowInfo https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getWindowInfo.html；setData https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_setData.html；showToast https://developers.weixin.qq.com/miniprogram/dev/api/ui/interaction/wx.showToast.html；DarkMode https://developers.weixin.qq.com/miniprogram/dev/framework/ability/darkmode.html；设计指南 https://developers.weixin.qq.com/miniprogram/design/
W3C / MDN：WCAG 2.2 https://www.w3.org/TR/WCAG22/；clreq https://www.w3.org/TR/clreq/；MDN `font-variant-numeric` / `line-break` / `word-break` / `overflow-wrap` / `env()` / `prefers-reduced-motion` / `text-spacing-trim`（链接见各节）
字体：华为 https://developer.huawei.com/consumer/cn/design/resource/；小米 https://hyperos.mi.com/font/；Noto Sans SC https://github.com/google/fonts/blob/main/ofl/notosanssc/METADATA.pb
其他：Lucide https://lucide.dev/contribute/icons/design-principles；Flutter `SafeArea` https://api.flutter.dev/flutter/widgets/SafeArea-class.html；`kMinInteractiveDimension` https://api.flutter.dev/flutter/material/kMinInteractiveDimension-constant.html
