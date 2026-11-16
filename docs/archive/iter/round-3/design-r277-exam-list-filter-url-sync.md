# R277 设计：真题卷库 year/region 筛选 URL 同步 + 入向深链

## 取证（一手证据）

- 源码实查 `frontend-uni/src/pkgA/exam/list.vue`：`year`/`region` 为纯本地 data 状态，`setYear/setRegion` 只改状态并重拉列表，无 `onLoad`、无 URL 同步——切筛选后复制地址栏得旧链接，刷新/分享即丢筛选上下文。
- 全站同类状态先例已闭环：申论 qtype/year/region/paper（R252/R261/R262）、搜索 q/tab/qid（R157/R270）、错题本 tab/mod/src/sort（R276）。`replaceState` 检索确认剩余带筛选态页面中真题卷库为最高频（首页/我的页直达入口）。
- 生产日志（09-02 6h 窗口）无新增用户可见 5xx/慢样本缺陷（503 簇为 R275 已归因部署前窗口），本轮走功能深度缺口。

## 方案

1. 新增纯 helper `frontend-uni/src/exam-list-url.js`：
   - `EXAM_LIST_PATH = '/#/pkgA/exam/list'`
   - `buildExamListUrl({year, region})`：year 为合法正整数（1990–2099）带 `?year=`；region 非空字符串带 `&region=`（encodeURIComponent）；全缺省回落基础路径。
   - `parseExamListOpts(opts)`：year 数字校验收参；region 原样收参（真实合法性由 filters 返回后比对，同 R252 先例）。
2. `list.vue`：
   - `onLoad(opts)` 暂存入向 year/region；`load()` 首次返回真实 `filters` 后按白名单应用（year 在 `filters.years`、region 在 `filters.regions` 中才生效，非法忽略），再重拉一次列表。
   - `setYear/setRegion` 后 `syncUrl()`（H5 `window.history.replaceState`，compile 守卫 + window 判空）。
3. 既有行为不变：快照即显、attempts、startPaper/openReport 深链、错误态。

## 边界

- 零后端/SSR/SEO/sitemap/边缘缓存变化；纯前端。
- 不收 kind/mini 等非筛选参数。

## 验证

- vitest：build/parse 合法、非法、组合、缺省回落。
- 本地 lint/vitest/build:h5 全绿；部署后生产 1440/375：切筛选 URL 就位、深链恢复 chip 激活+列表过滤、非法参数忽略、溢出 0、console 0 error、性能预算。
