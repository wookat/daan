# R57：PWA「安装到桌面」产品内入口

## 背景与取证（2026-08-29）

- R54 已补齐 manifest，Chrome CDP getInstallabilityErrors 为空=可安装；但全库 grep
  `beforeinstallprompt/appinstalled/安装到` 零命中——产品内没有任何安装入口，
  用户只能靠浏览器菜单自行发现，安装能力事实上不可达（竞品粉笔/夸克均以原生 App 常驻桌面，
  H5 形态下 PWA 安装是我们唯一的「桌面常驻」通道）。

## 方案（H5-only，零后端）

1. 新模块 `frontend-uni/src/pwa.js`：模块加载即挂 `beforeinstallprompt` 监听
   （必须早于页面 mount，否则事件已错过），`preventDefault()` 暂存事件；
   `appinstalled` 后清空。导出：
   - `canInstall()`：有暂存事件且非 standalone display-mode；
   - `promptInstall()`：调 `prompt()`，返回用户选择；
   - `onInstallable(cb)`：事件晚到时通知页面刷新入口可见性。
2. `main.js` 顶部 import `./pwa`（确保监听尽早注册）。
3. 「我的」页偏好设置组新增 H5-only cell「安装到桌面」，仅 `canInstall()` 时渲染；
   点击调 `promptInstall()`，accepted→toast「已安装，可从桌面直接打开」，dismissed 静默。

## 边界（如实记录）

- `beforeinstallprompt` 仅 Chromium 系（Chrome/Edge/Android WebView 部分）触发；
  iOS Safari 无此事件，入口不出现（不做 iOS 引导浮层，避免打扰，留候选）；
- 已安装（standalone 运行）或浏览器判定不可安装时入口不出现，页面零变化；
- 真机 Android 安装形态仍未实测（同 R54 遗留）。

## 验收

1. CDP（Chromium）访问「我的」页：入口出现；触发 prompt 调用路径不抛错；
2. 不支持环境（无事件）：入口不渲染，profile 页与 375/1440 布局零回归；
3. lint/build 全绿；console 0 error。

## 验收结果（2026-08-29 生产实测）

- 部署后线上 bundle index-CvtH2RHp.js；CDP（Chromium 1440/375）「我的」页
  「安装到桌面」cell 均出现（beforeinstallprompt 已捕获），375 无水平溢出，console 0 error；
- 点击 cell → promptInstall() 无报错，Esc 关闭原生浮层后 cell 消失（deferred 已消费）；
  重新加载页面事件重触发、cell 恢复出现——晚到事件通道（onInstallable）实证生效；
- 原生安装浮层为浏览器 chrome 层 UI，页面截图无法捕获，accepted 路径（toast）
  依赖真机点击「安装」，标 untested（同 R54 Android 真机遗留）；
- lint 无新增告警（eslint 无 flat config 为存量状态）、build:h5 全绿。
