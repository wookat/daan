# R224 设计：管理台深色模式（prefers-color-scheme）

## 取证（verified）

- 客户端 SPA（R124 前即有三档深色）与 /tiku SSR 页族（R124）均已支持深色模式；管理台是全站唯一无深色适配的界面：`admin.css` 无任何 `prefers-color-scheme` / 主题类，深色系统偏好用户打开管理台为纯白底（生产实查 12 路由均如此）。
- R220（手机档）+ R223（对比度 token 达标、页面 JS 硬编码色清零）后，管理台颜色已高度 token 化：`pages/*.js`、`core.js` 零硬编码 hex；`admin.css` 硬编码 hex 仅剩表面色一类（`#fff` 面板底 ×17、`#FAFBFD` 表头/工作台头尾、`#FAFBFE` 行 hover、3 个模块 tag 浅底、toast 反色底），全部可收敛为 token——深色模式此时是「补 token + 一段 :root 重映射」的低风险收尾。
- 本轮生产 origin 24h 复审计无新增 verified 产品缺陷（exam 404/502 风暴为已归因的 09-01 共享 NAT 窗口事件；`/api/submodules` 2–8s 慢样本全部来自共享 NAT 且查询本身实测 0.1s 索引覆盖，判定为宿主瞬时争用，inference，挂观察不改动）。

## 方案

纯 `admin.css`（+1 行 `index.html`）静态改动，零 API/路由/JS 行为变化：

1. 表面色 token 化：新增 `--th-bg`（表头/工作台头尾底）、`--row-hover`（行 hover 底）、`--mod-*-bg`（模块 tag 浅底）、`--toast-t`（toast 反色文字）；`#fff` 面板底（side/topbar/drawer/login-card/ipt/kbd/pager/ck）统一改 `var(--surface)`。
2. `@media(prefers-color-scheme:dark)` 内重映射 :root token，色板对齐客户端 v3 深色 token（`App.vue .theme-dark`：bg `#15161C`、card `#1D1F28`、fill `#23252F`、line `#2B2E3A`、ink 族、状态色 `#4ADE80/#F87171/#FBBF24/#7DD3FC`、品牌文字 `#8FA8FF`），模块色取亮变体 + 深色软底。
3. 白字压深色文字的组合定向覆盖：`.pager a.on` / `.ck.on::after` / `.side nav a .badge`（深色下 brand/error 变亮，白字对比度不足→改深底色文字）；`.toast` 反色底改 token。
4. `:root{color-scheme:light dark}` 声明，原生控件（select/checkbox/滚动条）随主题。
5. 渐变按钮 `--grad-brand`（白字压 `#2E5BFF`）深浅色不变，对比度本就达标。

明确不做：管理台手动主题切换三档设置（系统偏好足够，挂候选）；不动客户端/SSR 深色实现。

## 验收

- 本地门禁全绿（ruff/pytest/pyright/lint/vitest/build + bash -n）。
- 部署后生产 12 管理台路由 × light/dark 认证 axe 全零违规；1440/375 × light/dark 页面级溢出 0；console 0 error。
