# R276 设计：错题本 tab/筛选/排序状态 URL 同步 + 入向深链

## 取证

- R261–R263/R268/R270 已把申论专区与搜索页的全部筛选/详情/视图状态收进 URL（「任何界面状态皆可刷新恢复」原则），但错题本（pages/book/book.vue）源码实查：无 onLoad、无 replaceState、全站零处 `pages/book/book?` 深链——tab（待掌握/已掌握/收藏）、模块筛选 filterMod、来源筛选 srcFilter、排序 sortBy 均为纯内存态，刷新即回落默认视图。
- 错题本是高频复访页：用户筛到「数量关系 × 模考错题 × 错次多」后刷新/次日回访需重新点四次；粉笔错题本按模块/来源的视图在原生 App 内持久。
- 错题本为 uid 私有数据页，URL 同步的价值是「刷新/收藏夹恢复」而非社交分享；不涉及 SEO/SSR/边缘缓存（App hash 深链）。

## 方案（纯前端，零后端/SSR/SEO 变化）

1. 新增 `src/book-url.js` 纯函数 `buildBookUrl({ tab, mod, src, sort })`：
   - tab 只收 `done`/`fav`（默认 todo 不带参）；
   - mod 白名单 6 模块 key（ziliao/shuliang/yanyu/panduan/changshi/shenlun）；
   - src 只收 `exam`/`practice`；sort 只收 `due`/`times`/`type`/`reason`（默认 time 不带参）；
   - 全默认回落 `/#/pages/book/book`；非法值忽略。
2. book.vue：
   - `syncBookUrl()`（H5 守卫 + replaceState），挂进既有 tab/filterMod/sortBy watcher 并补 srcFilter watcher；
   - `onLoad(opts)` 按同白名单收 `tab`/`mod`/`src`/`sort`（fav tab 依赖 onShow 的空收藏回落守卫，不重复实现）。
3. 不收 kw/kpFilter/kp3Filter：考点筛选项依赖已加载数据动态生成，深链恢复语义不稳定，且现有「筛选 sheet」一键清除已覆盖。

## 验证

- vitest：book-url 纯函数全分支 + lint/build。
- 生产 1440/375：筛选/切 tab/改排序 → URL 就位；带参刷新恢复视图；非法参数与无参一致；溢出 0、console 0 error、性能预算。

## 边界

- 零后端改动；不动 SSR/sitemap/边缘缓存；既有键盘/批量/复习模式行为不变。
