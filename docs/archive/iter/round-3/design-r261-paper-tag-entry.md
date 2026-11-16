# R261 设计：申论列表卡套卷标签可点筛选 + paper 筛选 URL 同步

## 取证（verified）

- R260 打通 `?paper=` 深链后，App 内进入套卷筛选的入口只有站外（套卷 SSR 页 CTA / 分享链接）：列表卡的套卷标签 `q-paper` 是纯展示文本，用户在列表看到「2026广东省考·省市卷」想只刷这一套时无任何 App 内入口（49 套卷也刻意不做长选择器，见 R260 设计）。
- paper 筛选状态不同步 URL：deeplink 进入后刷新可保持，但 App 内清除/切换后 URL 不变；R157/R243 已确立「筛选/详情状态可分享可刷新」的 URL 同步先例（detail watch 已有 replaceState）。

## 方案

- `shenlun-url.js` 增纯函数 `buildShenlunPaperUrl(paper)`：非空字符串（≤100 字符）→ `SHENLUN_PATH + '?paper=' + encodeURIComponent(paper)`，否则回落 `SHENLUN_PATH`。
- 列表卡 `q-paper` 标签：`q.paper` 非空时可点（role=button + aria-label「只看本套卷」，@click.stop 不触发开题），点击设置 `paper` 并重载列表；已在同一套卷筛选中再点为无操作。
- `applyPaper(p)` 统一入口：设置/清除 paper 时 H5 侧 `history.replaceState` 同步 URL（复用 detail watch 同款守卫）；`clearPaper`/`clearFlt` 同步回基础路径。
- 详情弹层内标签不做点击（弹层语义为单题浏览，出口已有复制链接）。

## 不做

- 49 套卷长选择器（R260 已论证不做）；qtype/year/region 的 URL 同步（入口已有 SSR 页族深链，本轮只收 paper 维度，避免多参数组合爆炸，挂候选）。

## 验收

- vitest 新增 buildShenlunPaperUrl 用例（正常/空/超长/特殊字符）。
- 前端 lint/vitest/build 全绿；后端零改动。
- 生产 1440/375：点击列表卡套卷标签 → chip 外显 + 列表仅本套 + URL 带 ?paper=；清除后 URL 回落基础路径；溢出 0、console 0 error。
