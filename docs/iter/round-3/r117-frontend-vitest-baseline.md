# R117：前端单元测试基线（vitest）+ 深链归一化纯函数化

## 取证（verified facts，2026-08-31）

- frontend-uni 无任何测试框架、无 test script、零测试文件（package.json 实查）——与后端 R112 前状态对称：纯逻辑模块（md.js 58 行、main.js 深链归一化、offline/reminder/theme）契约全靠生产才发现回归。
- 两处最易被无声打破的公开契约：
  1. `src/md.js`：AI 答案渲染唯一入口（v-html），负责 HTML 转义（`&`/`<`）——转义被破坏即 XSS 面；标题/列表/表格/代码块/「第N步」徽标解析被破坏即答案排版全乱。
  2. `src/main.js` 根路径深链归一化（R102 修复）：`/?daily=1[&date=][&src=]` → 练习页 hash 路由，是推送/分享落地的唯一入口；R103 归因参数 src 透传依赖它。当前为 main.js 内联块，不可测试。
- vitest 4.1.11 发布于 2026-08-18（≥7 天），Node v22 兼容，Vite 项目零额外配置。

## 方案

1. devDependency 加 vitest（^4.1.11），script `"test": "vitest run"`。
2. 深链归一化抽为纯函数 `src/deeplink.js`：`normalizeDailyDeepLink(search, hash) -> string|null`（返回目标 hash 深链或 null），main.js 只保留取值/location.replace 副作用——行为逐比特等价。
3. 新增 `tests/md.test.js`（转义、标题、ul/ol、表格、代码块、第N步徽标、粗体/行内码）与 `tests/deeplink.test.js`（daily/date/src 透传、URL 编码、已有 hash 不改写、无 daily 返回 null）。

## 验证

- 本地 `npm run test` 全绿 + `npm run lint` 全绿 + `npm run build:h5` 成功。
- 生产部署后双视口复验 `/?daily=1&src=push` 直入每日一练（归一化重构零回归）。
