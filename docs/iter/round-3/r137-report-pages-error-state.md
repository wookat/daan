# R137：详情/报告页失败态收口（成绩报告/赛后报告/掌握度地图）

## 取证（2026-08-31，生产 API abort 探针 + 源码核查，verified）

R134–R136 收口了 13 个列表页「失败伪装空态」，详情/报告类页面尚未覆盖：

- `pkgA/exam/report.vue`：带合法 attempt_id 直入，API 失败仅 toast 后渲染「暂无成绩报告：请从模考交卷或模考记录进入」——误导用户以为报告不存在；且无重试。
- `pkgA/exam/contest-report.vue`：失败态标题固定「暂无大赛报告」、副文案直出原始 `request:fail`——把网络失败与「报告不存在/已过期」混为一谈，且无重试。
- `pkgA/stats/mastery-map.vue`：已有驻留错误文案「加载失败：…」（不误导），但无重试出口，onShow 才会重载。

## 方案（沿用 R134–R136 契约，最小范围，零后端）

关键区分：网络层失败（timeout/request:fail/网络错误）与 HTTP 业务错误（404「报告不存在」等）语义不同——前者应出错误态+重试，后者应保持「暂无…」空态引导。为此导出 `api.js` 既有 `isNetErr`（R90 快照兜底同款判定），三页按其分流：

- report：data 增 `loadErr`/`aid`；catch 仅 `isNetErr` 置 `loadErr`，业务错误保持「暂无成绩报告」引导；错误卡「加载失败 + 重试 ›」重跑 `load(aid)`。缺参路径不变。
- contest-report：`isNetErr` → `loadErr` 错误卡+重试；业务错误 → 既有 `err`「暂无大赛报告」语义不变；缺 event_id 路径不变。
- mastery-map：已有驻留「加载失败：…」文案，补「重试 ›」+ load() 开头清空 err。

## 验收（已完成）

- 本地 lint / vitest 38 passed / build:h5 全绿。
- 生产 1440/375 双视口 API abort：三页出「加载失败+重试 ›」、无「暂无…」误导、溢出 0；放行后点重试：mastery-map 原位恢复正常内容，report/contest-report（不存在的 id）正确落回「暂无…」空态引导而非错误态。
- 部署校验注：deploy 脚本 step 5/6 首跑因边缘静态壳传播延迟报 FAIL，2 分钟后线上 bundle 与 7 种 Accept-Encoding 变体全部校验通过（application/javascript），非投毒。
