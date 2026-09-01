# R213：deploy/cf-pages 边缘源码纳入 lint 门禁（纯工具链，不部署）

## 取证（verified）
- R211 已把 tests/ 纳入官方 lint，但 deploy/cf-pages/functions（[[path]].js + edge-policy.js，全站唯一边缘入口，R205/R206 多轮改动）仍游离在门禁外；R211 时记录原因为「eslint flat config base path 在 frontend-uni，无法触达仓库根外目录」，挂候选。
- 实测复现：`npx eslint ../deploy/cf-pages/functions` 报 "File ignored because outside of base path"；`-c ../eslint.config.mjs` 亦无效（base path 按 cwd/发现位置解析）。
- 从仓库根运行（根目录放 flat config）可正常纳管，并立即发现 1 个真实缺口：`WritableStream` 未声明 no-undef（[[path]].js:194，R178 IMS 304 路径排干 tee 分支的真实用法，非缺陷，属 globals 声明缺失）。

## 方案（最小改动）
- 新增仓库根 `eslint.config.mjs`：仅转发 `frontend-uni/eslint.config.mjs`（插件依赖仍装在 frontend-uni，import 从该文件位置解析），把 base path 提到仓库根。
- frontend-uni 配置补两处：①ignores 追加 `frontend-uni/` 前缀镜像组（同一配置在两个 base path 下均正确豁免）；②globals 补 ReadableStream/WritableStream。
- package.json：`lint` = `eslint src tests && npm run lint:edge`；`lint:edge` = `cd .. && eslint deploy/cf-pages/functions`（npm run 已把 node_modules/.bin 注入 PATH，cd 后仍可解析）。
- 零边缘源码/规则语义改动；backend 不受影响（未传入其路径）。

## 验证
- `npm run lint`（src+tests+edge）0 error；vitest 122、build:h5 全绿；ruff/pytest 90 全绿（本轮未动后端，回归确认）。
- 无生产产物变更，不部署、无需双视口复验。

## 局限
- 边缘函数 lint 依赖 frontend-uni 的 node_modules；根配置仅为 base path 转发，规则单一来源维护在 frontend-uni。
