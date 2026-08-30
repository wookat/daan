# R13 设计方案：真题卷库桌面网格布局

## 背景与取证（2026-08-30 生产实测）
- 生产 https://kaogong.zalize.com/#/pkgA/exam/list 在 1440×900 视口：wrapW=704、cardW=680、bodyScrollHeight≈19822px——单列手机流，一卷一巨卡（标题+meta+两个通栏大按钮），桌面需滚动近 20 屏才能浏览完卷库。
- 截图证据：/home/ubuntu/screenshots/r13_exam_list_1440.png。
- 对标粉笔/夸克桌面试卷库：多列网格 + 紧凑卡，一屏可浏览 6–10 卷。
- 同轮取证：stats/profile 亦为 680 单列（候选后续轮）；home/book 已完成桌面化。

## 目标与范围
- 仅改 `frontend-uni/src/pkgA/exam/list.vue`，零后端、零接口、零逻辑改动（纯模板包裹 + CSS）。
- H5 ≥1024px：试卷卡两列网格、页宽拓至 1044px；≤1023px 零变化。

## 方案
### 页面结构
- 试卷 v-for 外包一层 `<view class="plist">`（块级容器，移动端无样式影响——卡片自身 margin-bottom 保留）。
### CSS（仅 H5 media query）
```css
@media (min-width: 1024px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .plist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24rpx; align-items: stretch; }
  .plist .paper { margin-bottom: 0; display: flex; flex-direction: column; }
  .plist .paper .paper-top { flex: 1; }
}
```
- 卡内按钮保持通栏双按钮（网格后每卡宽 ~500px，按钮观感正常）。

## 交互规格
- 点击行为不变（卡头/开始模考/导出 PDF/历史成绩）。
- 筛选 chips、迷你模考卡、历史成绩卡保持整宽单列。

## 验收标准
- 1440：试卷区两列网格、卡片等高对齐、bodyScrollHeight 显著下降（预期 <11000）；点击开始模考/导出确认弹层正常。
- 375：DOM 与布局零变化（单列、无横向溢出）。
- `npm run build:h5` exit 0；生产 bundle 一致；console 0 error。
