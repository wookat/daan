# R263 设计：申论专区 tab / 素材类型出向 URL 同步

## 取证

- R246/R251/R252 已支持入向深链 `?tab=m`、`?tab=r`、`?mtype=<类型>`、`?mid=<id>`；R261/R262 收口了真题 tab 四维筛选（paper/qtype/year/region）的出向 URL 同步。
- 生产实测（R262 复验窗口）：App 内点「素材/范文」「作答记录」切 tab、以及素材 tab 内切换类型 chip，地址栏均停留在旧 URL（真题筛选深链或基础路径）——复制地址栏得到与所见内容不符的链接，刷新/分享丢 tab 与类型上下文。
- 这是 R262 明确挂起的对称缺口（当轮不做 material mtype outgoing sync）。

## 方案

- `shenlun-url.js` 增纯函数 `buildShenlunTabUrl(tab, mtype)`：
  - `'r'` → `?tab=r`；`'m'` → `?tab=m`（mtype 非空且非「全部」时追加编码 `&mtype=`）；其余回落基础路径。
- `shenlun.vue`：
  - `filterUrl()` 变为 tab 感知：`tab !== 'q'` 时走 `buildShenlunTabUrl`，真题 tab 逻辑不变。
  - seg 三个 tab 点击改走 `tapQ/tapMat/tapRec`（原逻辑 + `syncFilterUrl()`）；`setMtype` 补 `syncFilterUrl()`。
  - onLoad 入向路径不动：`?tab=m&mid=N` 深链仍走 `switchMat()`（不 sync），保留地址栏 mid 供再分享；用户后续切类型才收敛为类型 URL。
  - 详情 `?id` 让位关系不变（`syncFilterUrl` 仍以 `!this.detail` 守卫）。

## 不做

- favOnly（本地收藏筛选）不入 URL：会话本地态，入向亦无解析。
- 不改 backend/SSR/SEO/sitemap。

## 验收

- 本地：lint / vitest（新增 buildShenlunTabUrl 覆盖）/ build:h5 全绿。
- 生产 1440/375：切素材 tab → `?tab=m`；切「政策理论」→ `?tab=m&mtype=…`；刷新保留 tab+类型；切作答记录 → `?tab=r`；切回真题 → 回落筛选 URL/基础路径；mid 深链入向行为不回退；溢出 0、console 0 error、性能预算全过。
