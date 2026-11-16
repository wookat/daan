# R220 设计：管理台移动端可用性收口（≤767px 断点）

## 取证（verified）

- R219 生产复验中实测：`/admin` 在 375×667 视口横向溢出 408px（scrollWidth 768 vs 视口 375），根因是 `admin.css` 的 `body{min-width:768px}`——viewport meta 存在但整页按 768 渲染，手机上所有内容缩小且需横向滚动。
- 受控移除 R219 运维卡后溢出不变（408px），证实为存量布局问题，与任何单个卡片无关。
- 管理台既有响应式只到平板一档：`@media(max-width:1023px)` 把侧栏折叠为 64px 图标栏，没有 <768 的手机档。
- 公司验收标准明确「响应式适配移动端、桌面端」为硬指标；管理员在手机上查看看板/告警（R219 刚上线的运维状态卡）是真实场景。

## 方案

只动 `backend/app/admin/admin.css`，纯 CSS 追加 `@media(max-width:767px)` 手机档，不改任何页面 JS/DOM/接口：

1. `body{min-width:0}` 解除 768 硬底，页面按真实视口流式布局。
2. 侧栏保持 64px 图标栏（≤1023 档已折叠，继续复用），不做抽屉化（改 JS 超出本轮范围）。
3. `.topbar` 收窄：search 隐藏（各页自身有 filterbar 搜索）、padding 收敛。
4. `.content` padding 12px；`.kpis` 最小列宽 180→140，KPI 数字 26→22px。
5. `.drawer` 宽度 560px→100vw（手机上全屏抽屉）。
6. `.tbl-wrap{overflow-x:auto}` + `.tbl{min-width:640px}`：数据表不可无损压缩，容器内横滚，页面本身不溢出。
7. `.pagehead` 允许换行，`.filterbar` 既有 flex-wrap 直接生效。

## 明确不做

- 不做侧栏抽屉/汉堡菜单（需 JS，收益低——图标栏 64px 在 375 下已可用）。
- 不动任何 pages/*.js 的 DOM 结构与接口。
- 不做管理台深色模式（独立候选）。

## 实施中新发现（verified）与增量收口

- 缓存击穿缺口：`index.html` 里 JS 均带 `?v=`（后端按 admin 目录 mtime 重写），唯独 `admin.css` 链接裸引用，边缘/浏览器缓存导致新 CSS 上线后仍命中旧副本（实测 cf-cache-status: HIT、旧内容）。收口：CSS 链接补 `?v=r38` 进入同一重写机制。
- 首版验收发现三页仍溢出：questions/comments/users/settings（表格不在 `.tbl-wrap` 内而在 `.card` 内）、taxonomy（`#t-chips` 的 `.row` 不换行）、dedup/governance（页面内联 `grid-template-columns:repeat(4,1fr)` 覆盖媒体查询）。增量收口（仍纯 CSS）：手机档 `.card{overflow-x:auto}`、`.row/.filterbar{flex-wrap:wrap}`、`.kpis` 列规则加 `!important`。

## 验收（生产实测结果）

- 本地全绿：ruff / pytest 98 / pyright 0 / lint(src+tests+edge) / vitest 128 / build。
- 生产（rev 5462eb5 + admin 静态增量同步）：375×667 与 320×568 下管理台全部 12 个路由 `scrollWidth-clientWidth = 0`（登录页+看板+全部列表页；数据表在卡片容器内横滚）；1440 桌面 `body min-width:768px` 生效、侧栏 232px、布局零变化。
