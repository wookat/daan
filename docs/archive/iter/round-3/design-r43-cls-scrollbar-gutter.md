# R43 设计方案：首页桌面 CLS 0.87 收敛（滚动条槽位预留）

## 背景与证据（生产实测 2026-08-29）

- Lighthouse desktop 首页 performance 0.75，唯一红项 CLS 0.866（FCP 0.6s / LCP 0.9s / TBT 0ms 均绿）。
- PerformanceObserver 生产实测（layout-shift, buffered）定位主偏移：
  - t≈245ms，score 0.90：`uni-app` 容器 left 80→73（-7px）——首帧内容短、无纵向滚动条，数据渲染后页面变长、滚动条出现，视口宽度收窄 7px，居中壳整体左移，整页面积计入 CLS；
  - 其余两次偏移（skeleton 换真实内容）合计 <0.01，非主因。

## 方案

H5 全局（App.vue `#ifdef H5` 段）：

```css
html {
  scrollbar-gutter: stable;
}
```

- 桌面经典滚动条环境恒预留槽位，滚动条出现/消失不再改变布局宽度；
- 移动端/触屏为 overlay 滚动条，`scrollbar-gutter` 无效果，375 零变化；
- 成熟标准方案（Baseline 2022+，Chrome 94+/Firefox 97+/Safari 18.2+；不支持的浏览器静默忽略，行为同现状）。

## 验收

- `npm run build:h5` 通过；
- 生产 Lighthouse desktop 首页 CLS < 0.1、performance 分回升；
- 1440/375 双视口无回归（壳体居中、无横向溢出、console 0 error）。
