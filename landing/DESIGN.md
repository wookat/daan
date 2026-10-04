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

## 组件口径
- **nav**：56px、纯色 `--bg`、hairline 底边（与页面同底，无毛玻璃）
- **功能卡/平台卡**：白卡 hairline、42px brand-soft 图标容器 + 22px SVG 线性图标（1.8 描边）、底部 brand-soft 标签
- **数据带/CTA**：实色 brand 块，唯一允许的大面积品牌色，无阴影
- **截图框**：白底 + hairline + 8px padding，圆角跟随 r-lg 比例
- **字阶**：h1 clamp(34–52)/800、h2 30/800、h3 16.5/700、body 13.5–15、caption 12–12.5
- **区块节奏**：76px 上下；网格 gap 20–28

## 状态覆盖
- hover：border-color → brand-soft-2（或按钮底色 → brand-press）
- focus-visible：2px brand outline + 2px offset
- ::selection：brand-soft-2 底
- prefers-reduced-motion：关平滑滚动与过渡
