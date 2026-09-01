# R170 错题本快照即显（客户端 stale-while-revalidate）

## 取证

- 错题本是产品招牌一级页（对标粉笔错题本），onShow 即 `load()` 并发
  `/api/mistakes` + `/api/review` 两个 uid 专属请求，`loading` 为真时整个内容区只有
  「加载中…」spinner。
- uid 端点绕过边缘缓存（R56/R168 只覆盖公开内容），7d 生产 RUM 实测
  `mistakes:33321`（33s）长尾仍在；R63 超时 + R90 快照兜底只在双超时**失败后**启用。
- 页面已有 `cacheMistakes/getCachedMistakes` 本地错题缓存（离线兜底，R121 族），
  但仅在 `load()` 失败分支使用——长尾等待期间缓存明明在本地却不上屏。

## 方案（对称 R169 统计页）

1. `load()` 起始处即显缓存：`getCachedMistakes()` 有数据时立即铺屏
   （`loading=false`），真实响应到达后按既有 `_loadSeq` 守卫覆盖；
   失败分支行为不变（已有缓存回退/错误卡）。
2. 到期复习数 `due` 无本地缓存，保持骨架语义：即显期间复习横幅以真实响应为准
   （避免用陈旧 due 引导用户进入复习流程后提交失败）。`autoReview` 自动进复习
   仍只在真实响应后触发。
3. 竞态取证：即显让用户可在真实响应到达前操作（如标记「已掌握」）。
   实查代码确认 `master()`/`batchMaster()`/`batchDel()`/`del()` 等 mutation
   均已在完成后调用 `this.load()`——其起始处 `_loadSeq` 自增天然丢弃
   早于 mutation 的在途 load 响应，无需新增机制。

## 验收

- 本地 ESLint/vitest/build 全绿。
- 生产 1440/375：二访拦截 uid API（模拟长尾）时错题本列表立即呈现缓存数据、
  不再停留 spinner；放行后被真实数据覆盖；即显期间标记掌握后晚归响应不回跳；
  console 0 error、溢出 0。
