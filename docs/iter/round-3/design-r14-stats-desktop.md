# R14 设计方案：统计页桌面双栏仪表盘

## 背景与取证（2026-08-30 生产实测）
- 生产 https://kaogong.zalize.com/#/pages/stats/stats 在 1440×900 视口：wrap≈704、卡片 680px 单列纵向堆叠（热力图/雷达/模块分布/TOP10/掌握度地图/学习计划等 6+ 张卡），桌面大量留白、一屏只见 2–3 张卡。
- 截图证据：/home/ubuntu/screenshots/r14_stats_1440.png。
- 对标粉笔/夸克 Web 学情页：多列仪表盘布局，一屏并列多张统计卡。
- home/book/practice(R12)/exam-list(R13) 已桌面化，stats 是剩余主 Tab 中价值最高的单列页（profile 内容少，优先级低）。

## 目标与范围
- 仅改 `frontend-uni/src/pages/stats/stats.vue`，零后端、零接口、零逻辑（模板包裹 + CSS）。
- H5 ≥1024px：hero/登录条保持整宽，其余统计卡双栏 masonry；≤1023px 零变化。

## 方案
### 页面结构
- 在 `<predict-card />` 之后、`</view>`(wrap) 之前，用 `<view class="sgrid">` 包裹全部统计卡（热力图卡至学习计划 list-card）。
### CSS（仅 H5 media query）
```css
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; margin: 0 auto; }
  .sgrid { column-count: 2; column-gap: 24rpx; }
  .sgrid > .card { break-inside: avoid; margin-bottom: 24rpx; }
}
```
- 采用 CSS multi-column masonry：卡片高度差异大（热力图 vs 空态卡），两列 grid 会产生行对齐空洞；columns 自动平衡且 `break-inside: avoid` 防卡片截断。
- 移动端 `.sgrid` 为普通块容器，卡片自身 margin-bottom 保留，DOM 仅多一层无样式包裹。

## 交互规格
- 所有卡内交互（展开/收起、tab 切换、跳转、AI 教练生成）不变；展开导致卡片高度变化时 columns 自动重排（可接受）。

## 验收标准
- 1440：统计卡两列排布、无卡片截断、hero 三 KPI 整宽在顶部；展开「练习记录/模块分布」后布局不破版；点击卡内跳转正常。
- 375：单列零变化、无横向溢出。
- `npm run build:h5` exit 0；生产 bundle 一致；console 0 error。
