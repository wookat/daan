# R547：错题本带筛选深链/刷新后切 tab 回来不再重建页面丢筛选（R546-1 P3 既有）

日期 2026-09-08 · 前序 R546（`docs/iter/round-3/r546-book-url-review-secs-streak.md`）· 分支 `devin/*-r547-book-tab-keepalive`（从合入 #686 后 main `f1b37191` 开）· 代码 #688 · 生产 `0a930550 → 29c02a66`

## 1. 一手证据与机制

### 1.1 来源

R546 生产黑盒复验（rev `0a930550`）单列的既有 P3：错题本带筛选 → 底部 tab「统计」→ 切回「错题本」，筛选与 URL query 一起清零（375 2→5 卡、1440 2→4 卡）。当时手册里写的候选方案是「`onHide` 存 / `onLoad` 无 query 时回填 sessionStorage」。

### 1.2 机制（本地 `node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js` 源码核，非推测）

- `switchTab` → `removeNonTabBarPages()` 后 `navigate({type:'switchTab', url}, getTabBarPageId(url))`；
- `getTabBarPageId(url)` 遍历 `currentPagesMap`，第一个 `isSamePage(url, $page)` 命中者置 `__isActive=true` 并返回其 `id` 作为新路由 `history.state.__id__`；命中不到则 `createPageState` `++id` → KeepAlive `routeKey = path + '$' + __id__` 变 → **新实例**；
- `isSamePage(url, $page) = url === $page.fullPath || (url === '/' && $page.meta.isEntry)`——**全等**；
- `$page.fullPath` 在 `initPublicPage(route)` 里取 `route.fullPath`（**含 query**）；tabBar 点击传入的 `url` 是 `pages.json` 里的纯路径 `/pages/book/book`。

推论（复验全部证实）：
- 首页点 tab 进错题本再 UI 筛选 → fullPath 无 query → 切走再切回**复用**同一实例 → 筛选本就保留；
- **带 `?mod=/kp=` 深链或刷新进入** → fullPath 带 query → 永远匹配不到 → 每次切回都是新实例 `onLoad({})` 全默认。R546 复验正是深链进入路径，所以必现。

所以不是「switchTab 一律重建 tabBar 页」，sessionStorage 回填方案是在错的层面兜底（还要处理「显式深链 vs 存量」优先级与过期）。根因只是 uni-h5 的匹配口径拿到了带 query 的 fullPath。

## 2. 实修（仅 H5，+79/-1）

```js
// frontend-uni/src/book-url.js
export function normalizeTabPageFullPath(page) {
  if (!page || typeof page.path !== 'string' || !page.path) return false;
  if (typeof page.fullPath !== 'string' || page.fullPath === page.path) return false;
  page.fullPath = page.path;   // '/pages/book/book?mod=…' → '/pages/book/book'
  return true;
}

// frontend-uni/src/pages/book/book.vue onLoad(opts) 首行
// #ifdef H5
normalizeTabPageFullPath(this.$page);
// #endif
const p = parseBookOpts(opts);   // query 解析不受影响
```

入页即把 `$page.fullPath` 归一为纯路径 → 切 tab 回来命中同一 KeepAlive 实例 → 筛选留在实例里 → `onShow` 走 R546 的 `syncBookUrl()` 把 query 写回地址栏。不新增存储、不新增公共约定。

测试 `tests/r547-book-tab-keepalive.test.js`：归一函数边界、归一前后按 uni-h5 同口径 `isSamePage` 命中/不命中、book.vue 接线（H5 条件编译内、早于 `parseBookOpts`）、**锁定 uni-h5 三处内部口径源码**（`fullPath = route.fullPath` / `isSamePage` / `switchTab → getTabBarPageId`），升级 uni-h5 时口径一变即红。

## 3. 本地门

vitest 152 文件 1025 通过（+5）；eslint + design-tokens check + edge 0 error；`build:h5` 通过（产物 `pages-book-book.*.js` 含 `t.fullPath!==t.path&&(t.fullPath=t.path)`）；`git diff --check` 空。后端/小程序未改。

## 4. 生产发版与黑盒复验

- `deploy_h5.sh --skip-build` `0a930550 → 29c02a66`（回归全 200；Lighthouse `/` perf 0.92 / a11y 1.00 / bp 0.96 / seo 1.00、`/tiku/` 全 1.00；bundle `index-DF5eMwkr.js` gzip 124KB ≤ 160KB）。#688 已合入 main `91f8e964`。
- 黑盒复验（testing agent，rev `29c02a66` / bundle `index-DF5eMwkr.js` 三证一致，uid `test-r547-verify-*`，375×812 / 1440×900；报告 `~/r547-verify/R547-29c02a66-production-verification.md` + 录像 `~/screencasts/r547-29c02a66-production/r547-29c02a66-production-edited.mp4`）：

| 断言 | 375 | 1440 | 证据 |
|---|---|---|---|
| 地址栏直接 `mod=` 深链 → 统计 → 错题本 | PASS | PASS | query 相同、4→4（R546 时 →5/→4 默认）、组件实例 uid 不变 |
| UI 组+细分 → F5 → 统计 → 错题本 | PASS | PASS | `mod/kp/qt` 相同、2→2、实例不变 |
| 首页无 query tab 入口 → UI 筛选 → 统计 → 错题本（对照） | PASS | PASS | 5→4→4，URL 与实例保留 |
| A 状态地址栏手输显式 B 深链 → 立即显示 B | PASS | PASS | A4→B2 |
| B 深链 F5 → 统计 → 错题本 | PASS | PASS | B2→B2 |
| R546 回归：`mod` / `kp+qt` → 重练 → 页内返回 → F5；复习进退；讨论页返回 | PASS | PASS | 筛选与卡片数全保留 |
| 浏览器 back/forward 无空白/死循环/runtime 错 | PASS | PASS | — |
| 首页/问答/统计/我的/错题本互切；待掌握/已掌握/收藏 | PASS | PASS | — |
| 网络/错误 | PASS | PASS | 1978 响应 = 1920×200 + 58×304；HTTP 失败 / console / runtime / rejection 均 0；canceled 24 = 17 图 + 7 XHR 单列 |
| 清理 | PASS | PASS | 41 张 uid 表精确删 24 行；本 uid 与 `test-r547-%` 前缀 0；`explain_cache` 82 行、全表 SHA-256 前后一致 |

`~/r547-verify/keepalive-evidence.json` 6 组 before/after 的 `sameUrl/sameCount/sameComponent` 全 true。

## 5. 如实边界与独立发现

- **既有 P4（非本轮回归，双视口复现）**：运行中**地址栏手输**深链 B（popstate，`history.state` 无 uni `__id__`）→ uni-h5 新建实例 B，而旧 tab 实例 A 仍留在 `currentPagesMap`（`__isActive` 未清）→ 之后切 tab `getTabBarPageId` 按 Map 插入序取第一个命中 = A，回到 A 的筛选（375 实例 282→1048→282，1440 293→1165→293）。修前 A 的 fullPath 本就是纯路径、同样先命中 A，修前修后一致。刷新（F5）进入 B 不受影响（对照 PASS）。触发条件是「SPA 运行中手输地址」，不是常规深链，不立项；若要修需在新实例 `onLoad` 卸载同路由旧 tab 实例，uni 无公开 API。
- **R546-2 取证结论（本轮不修，R548 实修）**：重练进 practice → 浏览器后退 → 前进变默认练习的**具体条件是「未作答」**：`redoSet` 在 practice 初始化时一次性消费，`pendingSession` 只在 `saveSession()`（作答后）才写，未答时两者皆无 → `tryResume()` 无东西 → `start(lastModule||null, …, 'direct')`（375 变「言语理解 1/10」、1440 变「数量关系 1/10」，跟 `lastModule` 走，不固定言语）。**答 1 题后**前进会弹「继续上次练习？(1/2)」，点继续恢复原 2 题集合（`pendingSession.items=2, source=""`）。修法候选：redo 启动即 `saveSession()`（或 `session=true` 后统一落一次 pending），让前进/刷新走已有 resume；`source` 为空串是否需标 `redo` 待看 `_source` 语义。
- 小程序无此问题域（原生 tabBar 无 SPA 路由）；小程序 R536-1 累计改动仍未上真机 UNTESTED。
- 复验截图：移动端原始 PNG 含合成面空白，报告图为严格 375×812 裁切，原图与裁切参数 `~/r547-verify/viewport-crops.json` 保留。
