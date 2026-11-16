# R44 设计方案：深色模式原生导航栏返回箭头不可见修复

## 背景与证据（生产实测 2026-08-29）

- 深色模式（themeMode=dark）1440 生产走查：掌握度地图、真题卷库等使用 uni 原生 H5 导航栏（uni-page-head）的页面，左上角返回箭头为 SVG（`<path>` 填充取自 navigationBarTextStyle=black），深底 #15161c 上近乎不可见（截图 r44_dark_mastery.png / r44_dark_exam.png）。
- App.vue 已有 `.theme-dark uni-page-head` 背景与标题色适配（L119-125），唯独漏了按钮 SVG 的 fill。
- 自绘返回箭头的页面（book/practice/calendar 等）用 token 色，不受影响。

## 方案

App.vue H5 深色段追加：

```css
.theme-dark uni-page-head .uni-page-head-btn path {
  fill: #f2f3f7;
}
```

CSS `fill` 属性覆盖 SVG presentation attribute，与既有标题色 #f2f3f7 一致；浅色模式与 375 不受影响（选择器仅 .theme-dark 命中）。

## 验收

- `npm run build:h5` 通过；
- 生产深色 1440/375：原生导航栏页面返回箭头清晰可见、可点击返回；
- 浅色模式零变化。
