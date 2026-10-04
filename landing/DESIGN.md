# 错题邦落地页 · 设计锚（DESIGN.md）

唯一视觉基准：与小程序/H5 共用 `tools/design-tokens/tokens.json` 的色板、字族、圆角。
落地页不是营销站皮肤，是**小程序扁平 VIS 的放大版**——用户在页面看到的观感应等同于把 App 截图放大。

## 气质与方向
- **方向**：严格扁平（flat, utilitarian）。DNA 供体：IBM Carbon（无投影、靠底色分层、单一品牌蓝）+ Vercel（hairline 描边哲学）。主源为错题邦自身 tokens。
- **一句话**：白卡 + 1px 描边 + 实色按钮 + 零渐变零投影。

## 硬规则（Do / Don't）

| Do | Don't |
|---|---|
| 卡片：白底 + `1px solid var(--line)`（#e7e9f0） | 任何 box-shadow 投影 |
| 实色 `--brand` #2e5bff 按钮/色块 | linear-gradient（任何渐变） |
| hover 只改 border-color / 底色 | translateY 位移、阴影浮起 |
| 截图资产用白色描边框展示 | 黑色手机壳 mockup |
| 区块分隔用 hairline 或底色切换（#f6f7fb ↔ #fff） | 虚线、装饰纹理、玻璃拟态 |
| 圆角 r-lg 20 / r-md 14 / r-sm 10 | 新圆角值 |
| 分隔线统一 `--hairline` 实线 | 左侧竖线装饰（P-38 禁令） |
| 按钮/徽章一律 999px pill（教育型血统） | 直角矩形按钮 |
| 主 CTA 按压阴影 `0 3px 0 --brand-press`、:active 塌落 | 带模糊的 box-shadow |

## 组件口径
- **nav**：56px、纯色 `--bg`、hairline 底边（与页面同底，无毛玻璃）
- **功能卡/平台卡**：白卡 hairline、42px brand-soft 图标容器 + 22px SVG 线性图标（1.8 描边）、底部 brand-soft 标签
- **数据带/CTA**：实色 brand 块，唯一允许的大面积品牌色，无阴影
- **截图框**：白底 + hairline + 8px padding，圆角跟随 r-lg 比例
- **字阶**：h1 clamp(34–52)/800、h2 30/800、h3 16.5/700、body 13.5–15、caption 12–12.5
- **区块节奏**：76px 上下；网格 gap 20–28

## 状态覆盖
- hover：border-color → brand-soft-2（或按钮底色 → brand-press）
- .btn-brand:active：translateY(2px) + 阴影压扁至 0 1px 0（Duolingo 按压式）
- focus-visible：2px brand outline + 2px offset
- ::selection：brand-soft-2 底
- prefers-reduced-motion：关平滑滚动与过渡

## 视觉溯源（2026-10 VIS 研究）
逐字级拆解 8 站（完整 token 级报告见 vis-study 交付件）：IBM Carbon、Vercel、Notion、Mintlify、Wise、PostHog、Khan Academy、Duolingo、Brilliant。

**命中的八大共识**：单色 accent / 近黑不纯黑 / hairline 负责分隔（5-10% 黑）/ 展示字 -0.02em 压缩 / 三字重纪律 / 白↔浅灰底色分区 / 全页一处对比时刻 / 8px 栅格。

**采纳的招牌手法**：
- Duolingo 按压阴影按钮（实色偏移零模糊，糖果传奇血统）→ `.btn-brand`
- Duolingo 横滚 chips 分隔带 → `.chipstrip` 模块 taxonomy
- Mintlify/Khan 式 pill CTA → 全部 `.btn`
- Carbon 列分隔线 → `.band div+div` 白色 hairline
- Khan 掌握四色阶（灰→蓝→紫→绿）→ 记入产品侧 backlog（掌握状态机语义色）

**已拒绝**：IBM 0px 直角（太肃杀）、Brilliant 衬线（中文无栈）、Wise 900 billboard（营销腔）、hover scale 位移（游戏化）、Notion 暖灰（与冷蓝打架）、Vercel shadow-as-border（零收益花哨）。
