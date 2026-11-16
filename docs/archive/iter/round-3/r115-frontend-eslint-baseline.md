# R115：前端 ESLint 基线固化 + 存量真实问题清零

## 取证（verified facts）

- frontend-uni 无任何 lint 配置与 lint script——历轮「npm run lint --if-present」全部空跑通过，前端从未被 lint 过（R114 已为后端固化 ruff 基线，前端是对称缺口）。
- 首次以 eslint9 + eslint-plugin-vue（flat/essential）实跑 src：37 errors，其中：
  - 25 条 vue/multi-word-component-names：uni-app 页面组件按 pages.json 路径注册，不作为标签使用，规则不适用；
  - 5 条 Parsing error（api.js/native.js/offline.js/poster.vue/weekly-report.vue）：uni-app 条件编译在同一源文件保留多平台分支导致重复声明，构建时合法；
  - 7 条真实问题：
    - exam.vue `_endAt`/`_tsx`、list.vue `_starting`、interview.vue `_timer` 在 data() 用 `_` 前缀（Vue 保留命名空间，非响应式意图却占 data）；
    - book.vue 模板 `(f, fi)` 未用索引；
    - book.vue 排序回退串为字面 U+FFFF 非字符（noncharacter-in-input-stream ×2）。

## 方案

1. 新增 `frontend-uni/eslint.config.mjs`（flat config，uni/wx/plus 全局白名单），package.json 增 `lint: eslint src`；devDeps 加 eslint/@eslint/js/eslint-plugin-vue/vue-eslint-parser。
2. 规则裁量：`vue/multi-word-component-names` off（理由见上）；条件编译重复声明属解析错误、无法 noqa，api.js/native.js/poster.vue/weekly-report.vue 整文件豁免并注明原因；offline.js 的 PACK_SIZE 双声明可无损重构为单 export，不豁免。
3. 真实问题全部修复（语义等价）：`_` 前缀字段移出 data() 到 created() 实例字段（原本就非响应式用途）；删除未用索引；U+FFFF 改 `'\uffff'` 转义。
4. 验收口径升级：自本轮起 `npm run lint`（eslint src）全绿与 build:h5 同为前端硬门槛。

## 验证

- `npx eslint src` 全绿；`npm run build:h5` 成功。
- 生产部署后回归：模考做卷计时/滑动切题（_endAt/_tsx 路径）、面试计时、错题本收藏 tab 与按错因排序。
