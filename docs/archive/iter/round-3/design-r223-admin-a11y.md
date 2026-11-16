# R223：管理台无障碍收口（axe 全路由违例清零）

## 取证（verified，2026-08-29 生产 axe 4.10.2 实扫 12 个管理台路由）

- 12/12 路由全部存在 serious 级 color-contrast 违例（单路由 10–136 处），根因收敛为 admin.css 颜色 token 本身不达 WCAG AA 4.5:1：
  - `--t3:#7D818F`（白底 3.88）、`--t4:#B0B4C0`（白底 2.07）：侧栏分组/面包屑/副标题/表头等全站次级文字；
  - `--success:#16A34A`（3.13/3.30）、`--warning:#D97706`（3.07）、`--info:#0284C7`（3.84）、`--error:#DC2626`（4.41 on error-bg）：tag/状态文字；
  - `--mod-yanyu:#E11D48`（4.02）、`--mod-ziliao:#0D9488`（3.57）、`--mod-changshi:#D97706`：模块 tag。
- questions 路由 critical×24：行选择 checkbox（`.q-ck`×20 + `#q-all`）与筛选 select（`#q-module/#q-score/#q-sort`）无可访问名称；comments `#cm-st` 同。
- 全路由 moderate：无 main landmark、4 个 `<nav>` 无区分名称、`.main` 内容不在 landmark 内；governance/comments/users/questions 操作列空 `<th>`。
- 对照：SPA 侧同类问题已由 R46/R49/R120/R129/R163 收口清零，管理台从未做过 a11y 专项。

## 方案（对齐 SPA 既有做法，纯前端静态资源，零 API/布局变化）

1. token 级对比度收口（实测全部 ≥4.5 于其实际使用底色，含 --bg/--fill/表头 #FAFBFD/各 tag-bg）：
   t3→#5D6270、t4→#6E7280、success→#047857、warning→#B45309、info→#0369A1、error→#B91C1C、mod-yanyu→#BE123C、mod-ziliao→#0F766E、mod-changshi→#B45309；dashboard.js 一处内联 #d97706 改 var(--warning)。白字场景（badge/toast on --error）新值对比度 6.47 同步达标。
2. 可访问名称：筛选输入/下拉/checkbox 补 aria-label（q-kw/q-module/q-score/q-sort/q-all/q-ck 逐行「选择题目 {id}」/cm-st/rv-mod/u-kw/ann-title/ann-body/gsearch）。
3. landmark：`.main` 改 `<main>`；4 个 `<nav>` 补 aria-label（概览/内容/用户/系统）；操作列空 `<th>` 补 `.sr-only` 文本（admin.css 新增 sr-only 类）。

## 明确不做

- 不做管理台深色模式（独立候选，改动面大）；不改任何布局/交互；不动 SPA 侧。

## 验收

- 本地全绿（ruff/pytest/pyright/lint/vitest/build 照常）；
- 生产部署后 axe 复扫 12 路由 serious/critical 违例清零（moderate landmark 同步清零）；
- 1440/375 视口管理台走查无回归、溢出 0。
