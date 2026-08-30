# R16 设计方案：我的页桌面双栏（≥1024px）

## 背景与取证（2026-08-29 生产实测）

- `/pages/profile/profile` 1440 视口：`.wrap` 712px、全部卡片 680px 单列堆叠，
  scrollH 1557px，桌面右侧大量留白（截图 r16_profile_1440.png）。
- R15 壳体已拓宽至 1280px（≥1366px），页面级 1044px 声明现可真实生效（实测 1068px）。
- 竞品桌面「我的/设置」页普遍双栏分组布局，纵向扫描成本低。

## 决策

复用 R14 statsmasonry 模式：账号卡 + 学习资产行保持整宽在顶，四个分组
（打卡徽章 / 学习 / 偏好设置 / 其他）各包 `.psec`（sec-t 标题与卡片同组防拆分），
外层 `.pgrid` 在 H5 ≥1024px 用 `column-count: 2` 双栏 masonry。
退出登录与页脚保持整宽在底。

- `.psec` 移动端为普通 block view，零影响。
- 零后端、零逻辑、零新接口；仅 profile.vue 模板包裹 + 桌面 CSS。

## 页面结构

```
.wrap.profile
├── .card.acct（整宽）
├── .stats-row（整宽）
├── .pgrid（≥1024px column-count:2）
│   ├── .psec（sec-t 打卡徽章 + .card.badges）
│   ├── .psec（sec-t 学习 + cellcard×7 项）
│   ├── .psec（sec-t 偏好设置 + cellcard×6 项）
│   └── .psec（sec-t 其他 + cellcard×3 项）
├── .logout（整宽）
└── .zl-footer（整宽）
```

## 验收标准

- 1440：`.wrap` ≈1068px；四分组双栏 masonry、sec-t 与卡片不拆分、无截断/溢出；
  全部 cell 点击导航/切换正常（每日目标/字号/外观等循环项、学习计划/日历/收藏等跳转）。
- 375：零变化（单列、无横向滚动）。
- console 0 error。
