# R161：搜索详情加载反馈 + 同题连点防重

## 取证（事实）

- 生产实测（1440，CDP 将详情响应延迟 3s）：点击题目卡后 3s 内卡片零变化、无任何加载反馈
  （无 aria-busy/loading 节点），慢网络下用户以为点击未生效；
- `toggleDetail()` 同题在途期间再点：detail 尚为 null 不走收起分支 → 重复发同 id 详情请求
  （R160 的 detailWant 只防「晚归写入」，不防同题在途重复请求）；
- 粉笔/夸克题目卡展开均有加载态反馈。

## 方案（零后端、零依赖）

- 模板：`detailWant === it.id` 且详情未就绪时，卡内显示「解析加载中…」行；
- `toggleDetail()` 收起分支后补 `if (this.detailWant === it.id) return;`（同题在途防重）；
- 错误分支在 toast 前重置 `detailWant = null`，保证失败后可重试点击。

## 验收

- 本地 ESLint / vitest / build 全绿；
- 生产 1440/375：延迟详情响应下点卡出现「解析加载中…」、连点同卡仅 1 个详情请求、
  响应到达后正常展开且加载行消失；失败后可重试；溢出 0、console 无非预期 error。
