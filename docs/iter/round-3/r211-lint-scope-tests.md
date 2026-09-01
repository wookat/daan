# R211：前端 lint 覆盖面缺口收口——tests/ 纳入官方 lint 门禁

## 取证（verified）

- `frontend-uni/package.json` 中 `"lint": "eslint src"`，只覆盖 `src/`；`tests/` 目录已积累 12 个 vitest 测试文件（R117 起逐轮补强：深链归一化、边缘策略、api 网络层、弹层焦点、SW 壳、边缘 onRequest 集成、启动屏 watchdog 沙箱）完全游离在官方 lint 门禁之外。
- 实测 `npx eslint tests` 报 27 errors（全部 `no-undef`：`Request`×20 / `Response`×7，集中在 edge-handler.test.js 与 sw-shell.test.js）——Fetch API 全局未在 `eslint.config.mjs` 的 globals 白名单中声明。R209 已如实记录该债务（「未来汇报不得称全仓 eslint 绿」），本轮收口。
- `deploy/cf-pages/`（边缘函数源码 `[[path]].js`/`edge-policy.js`）位于 eslint flat config base path 之外，`npx eslint ../deploy/cf-pages` 被 eslint 9 按「outside of the base path」整体忽略——纳入需要把配置上移仓库根，影响面大，本轮不做（其决策逻辑已被 tests/ 内的纯函数与集成测试覆盖，测试文件本身现已纳管）。

## 为什么值得做（流程性缺口）

- tests/ 是回归防线本体，防线代码自身无静态检查：未定义变量/未使用导入等错误只会在运行时或永不暴露（如断言里拼错全局名会静默通过 try/catch 类结构）。
- R209 教训：报告口径已经被迫区分「npm run lint 绿」与「全仓 eslint 不绿」，属于可消除的口径分裂。

## 方案（最小改动）

1. `eslint.config.mjs` globals 补 Fetch/SW 标准全局：`Request`、`Response`、`Headers`、`caches`、`self`（前两者收口现存 27 errors；后三者为 SW/边缘测试沙箱常用全局，同族一并声明避免下轮再触）。
2. `package.json` lint 脚本 `eslint src` → `eslint src tests`。

零生产行为变化（纯工具链），不部署。

## 验证

- `npm run lint`（现覆盖 src+tests）0 error；
- vitest 122 passed 全绿；
- `npm run build:h5` 正常产出（配置不影响构建，跑一遍确认）。

## 明确不做

- 边缘函数源码目录纳 lint（需配置上移仓库根，收益低于扰动，挂候选）；
- 不改任何测试/源码本身（27 errors 全部由 globals 声明解决，无真实代码缺陷）。
