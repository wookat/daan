# R227 设计：管理台折叠侧栏导航可访问名称与 tooltip

## 取证（verified，2026-09-01 生产实测）

- admin.css 在 `@media(max-width:1023px)` 将侧栏折叠为 64px 图标栏，`.side nav a .txt{display:none}`。
- Playwright 在 768px 视口实测生产 /admin：全部 12 个侧栏导航链接的可访问名称只剩 emoji（📊/📚/📦/…），`aria-label`、`title` 均为 null。
- 影响：
  - 读屏用户在平板/手机宽度听到的是「bar chart / books / package」等 emoji 描述，而非「数据看板 / 题库管理 / 批次导入审核」；
  - 明眼用户在图标栏悬停无任何 tooltip，13 个 emoji 图标含义不可发现（R220 手机档后管理台已可在手机使用，暴露面扩大）。
- axe link-name 规则不报（emoji 也算名称），R223 axe 扫描在 1440px 全宽（.txt 可见）下天然覆盖不到该形态——属规则盲区，非既有扫描遗漏。

## 方案

纯静态 index.html：为 13 个侧栏 `<a>`（12 导航 + logo 不需要）补 `title="<同 .txt 文案>"`；可访问名称计算优先级 aria-label > 内容，为避免双维护，不加 aria-label，改为让 .txt 参与名称计算——把折叠态 `.txt{display:none}` 改为 sr-only 式视觉隐藏（clip 方案，保留在可访问性树中）。

- admin.css：`@media(max-width:1023px)` 中 `.side nav a .txt` 由 `display:none` 改为绝对定位 clip 隐藏（复用既有 `.sr-only` 模式）；`.side .logo .name,.side .grp,.side .foot` 维持 display:none（非交互元素）。
- index.html：12 个导航 `<a>` 补 `title`（悬停 tooltip，桌面折叠态可发现性）。
- badge 定位不受影响（badge 是 a 的直接子元素，与 .txt 无布局耦合需实测确认折叠态无溢出/错位）。

## 不做

- 不做手机档抽屉式侧栏（独立候选，交互改动大）；
- 不改桌面全宽形态与任何 JS/API。

## 验收

- 本地门禁全绿。
- 生产 768/375 实测：12 链接 accName 为完整中文名、title 存在；折叠态图标栏布局无回归（溢出 0）；1440 全宽零变化。
