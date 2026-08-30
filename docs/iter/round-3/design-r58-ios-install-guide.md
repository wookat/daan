# R58：iOS Safari「添加到主屏幕」安装引导（补 R57 不可见路径）

## 背景与取证（2026-08-29）

- R57 上线的「安装到桌面」入口依赖 `beforeinstallprompt`，仅 Chromium 系触发；
  iOS Safari 无此事件（Apple 官方无该 API），iOS 用户在「我的」页看不到任何安装入口——
  而 iOS 是 H5 移动端主要平台之一，PWA 主屏安装在 iOS Safari 需手动
  「分享 → 添加到主屏幕」，无引导则该能力对 iOS 用户不可发现（与 R57 取证同一差距的另一半）。
- 微信内置浏览器（MicroMessenger UA）无「添加到主屏幕」能力，不应展示引导。

## 方案（H5-only，零后端）

1. `pwa.js` 增 `isIosSafariInstallable()`：UA 含 iPhone/iPad（含 iPadOS 桌面 UA：
   Macintosh + maxTouchPoints>1）、非 standalone（`navigator.standalone` 或 display-mode）、
   非 MicroMessenger/CriOS/FxiOS（非 Safari 内核壳按 Safari 处理有误导，仅纯 Safari 展示）。
2. 「我的」页偏好设置组：iOS Safari 分支复用同一 cell 文案「安装到主屏幕」，
   点击弹居中引导浮层（两步图文：① 点底部「分享」按钮 ② 选「添加到主屏幕」），
   无 prompt 可调，纯说明。
3. Chromium 分支（R57）优先；两分支互斥。

## 边界

- iOS 真机形态未实测（无真机，UA 模拟仅验证渲染分支与浮层交互）；
- 微信内浏览器不展示（设计使然）。

## 验收

1. CDP 模拟 iOS Safari UA：cell 出现、点击弹引导浮层、关闭正常，console 0 error；
2. 模拟微信 UA / 桌面 Chrome：iOS 引导不出现（Chrome 走 R57 原生 prompt 分支）；
3. 375 无溢出；lint/build 全绿。

## 验收结果（部署后回填）
