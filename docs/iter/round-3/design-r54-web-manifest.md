# R54 设计：Web App Manifest——H5 可安装（添加到主屏）

## 取证（2026-08-29 生产实测）

- 生产 `index.html` 无 `<link rel="manifest">`，全站无 manifest 文件；Service Worker 已存在且注册（/sw.js 200，离线壳 v3）。
- 即：PWA 三要素（HTTPS ✓ / SW ✓ / manifest ✗）只差 manifest，Android Chrome「添加到主屏」当前只能生成书签快捷方式（无独立窗口、无品牌启动屏），Chrome 桌面端无安装入口。
- 竞品对照：粉笔/夸克均为原生 App，主屏图标+全屏体验是基本盘；本产品作为 H5 站，manifest 是零成本补齐「像 App 一样打开」的标准做法（现代主流方案，Capacitor 壳已在仓内另行覆盖原生端）。
- 既有资产：`static/logo.png` 512×512（og:image 同源），`static/brand/kaogong.svg` 图标，主题色 meta theme-color 浅 #eef3ff / 深 #15161c（theme.js 动态切换）。

## 方案

1. 新增 `frontend-uni/src/static/manifest.webmanifest`：
   - name 错题邦 - 考公行测真题在线刷 / short_name 错题邦
   - start_url `/?utm_source=pwa`、display `standalone`、lang zh-CN
   - theme_color #eef3ff、background_color #f6f7fb（浅色启动屏；深色由运行时 meta 覆盖）
   - icons：logo.png 512 (any) + 同文件 maskable 声明（logo 留白充足）
2. `index.html` head 增 `<link rel="manifest" href="/static/manifest.webmanifest" />`。

不引入 vite-plugin-pwa（SW 已手写存在，避免双 SW 冲突），零依赖零构建管线改动。

## 验收

- 生产 `/static/manifest.webmanifest` 200 且 JSON 合法、图标可达。
- Chrome DevTools installability 无错误（headless CDP 检查）。
- 1440/375 页面零变化、console 0 error。
