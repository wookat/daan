# R136：主包 stats/book 加载失败误呈现为空态收口（三期·终）

## 取证（2026-08-31，生产探针 + 源码核查）

R135 探针已显示两主包页在 API 全挂时渲染「暂无数据」「错题本还是空的」。本轮逐 catch 源码核查确认边界：

**pages/stats/stats.vue（verified）**
- `load()`（/api/stats + /api/mistakes）catch 只 toast；失败后「错题模块分布」「高频错题型 TOP10」两卡渲染「暂无数据」、掌握数落 0——这些数据**无任何本地降级**，失败≠无错题，误导用户以为错题统计丢失。
- 热力图/成长/推荐/申论卡（loadHeatmap/loadGrowth/loadReco/loadSlStats）catch 静默但有本地 pstats 降级或属增强信息，属既定设计，不立项。

**pages/book/book.vue（verified）**
- `load()` catch 有 R90 缓存兜底：有缓存→offlineView 横幅（既定设计，不立项）；**无缓存**（新设备/首访）→仅 toast 后渲染「错题本还是空的」空态，误导用户以为错题被清空。

## 方案（沿用 R134/R135 契约，最小范围）

- stats：data 增 `loadErr`，`load()` 开头清空、catch 置 `e.message`（toast 保留）；「错题模块分布」「高频错题型」两卡的「暂无数据」分支前插错误卡「加载失败：{{msg}} + 重试 ›」，重试重跑 `load()`。
- book：data 增 `loadErr`，`load()` 开头清空；catch 仅在**无缓存回退**分支置 `e.message`（缓存回退分支维持 offlineView 语义不变）；「错题本还是空的」空态前插 `v-else-if="tab !== 'fav' && loadErr"` 错误卡，重试重跑 `load()`。
- 零后端/零边缘改动；成功路径、pstats/缓存降级、真实空数据空态全部不变。

## 验收

- 本地 lint/vitest/build:h5 全绿。
- 生产部署后 API abort 探针：两页失败态出「加载失败+重试」不再渲染误导空态；放行后点重试原位恢复。
- 1440/375 双视口、无横向溢出；console 仅探针 abort 预期噪声。
