# R164：深色模式内容态对比度治理——品牌蓝文字 --brand-text token 全站收口

## 取证（事实）

- R163 生产复扫首次覆盖深色模式内容态（1440，prefers-color-scheme: dark），6 视图全部存在 serious color-contrast 违例（exam list 单页 360 节点）；此前 R120/R130/R132 深色模式从未入扫；
- 根因系统性：深色 token 表（App.vue .theme-dark）未覆盖「品牌蓝作正文/按钮文字」场景——`--brand`(#2e5bff) 在深卡底 #1d1f28 仅 3.17:1、在 --brand-soft #1e2a4a 仅 2.73:1（浅色模式白底 4.55:1 合规），全站 204 处 `color: var(--brand)` + 9 处硬编码 #2e5bff 文字全部中招；
- 另有零散硬编码：讨论 .pin #2c5ad6（2.38）、首页公告 #0369a1/#075985（2.14–2.73，深 info-soft 底）、真题徽标/今日更新 #b45309 未走 --warn-strong token（2.93）、搜索关键词高亮 hl() 内联 #2e5bff；
- tabbar 文字色来自 pages.json 静态配置（选中 #2e5bff / 未选 #6b7280），深色底 #1d1f28 上 3.17/3.39，CSS 无法覆盖（uni-h5 内联 style）。

## 方案（零后端、零依赖）

- App.vue 新增 `--brand-text` token：浅色 #2e5bff（现状不变）、深色 #8fa8ff（#1d1f28 上 ≈7.2:1、#1e2a4a 上合规）；
- 全站 `color: var(--brand);` → `color: var(--brand-text);`（机械替换，浅色零视觉变化）；硬编码 #2e5bff 文字色同步 token 化（含 search.vue hl() 内联样式改 var(--brand-text)，CSS 变量可穿透 rich-text span）；
- 零散硬编码收口：.pin → --brand-text；.ann-t/.ann-b → 新增 --info-strong（浅 #075985 / 深 #7dd3fc）；.q-real、.tag.warn → 既有 --warn-strong；
- tabbar 文字色：uni-h5 构建产物无 uni.setTabBarStyle（生产实测 `uni.setTabBarStyle is not a function`），改 App.vue CSS 按 pages.json 配置色值定向覆盖内联样式：`.theme-dark .uni-tabbar__label` → #9ba0b0，`[style*='rgb(46, 91, 255)']`（选中）→ #8fa8ff；
- 例外回退：首页 hero 白底主按钮 .ld-btn.main（背景硬编码 #fff 双主题不变）保持 `var(--brand)`——机械替换为 --brand-text 后深色 #8fa8ff 落白底仅 2.27:1，实测回归发现后回退。

## 验收

- 本地 ESLint / vitest / build 全绿；
- 生产深色 1440/375 六内容态视图 axe 复扫 color-contrast 清零；浅色模式同视图回归 0 violations（替换零视觉变化）；溢出 0、console 无非预期 error。
