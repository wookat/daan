# R70 设计：每日一练可发现性 —— 首页全站同题外显 + /tiku/daily/ SSR 页

## 取证（2026-08-31，生产一手）

- R69 上线后「全站同题」只有做完 10 题到完成页才能感知，首页 hero 仍是通用「继续目标 ›」，全站同题/参与人数零外显 —— 竞品（粉笔每日一练）在入口处即展示「今日 XX 人已参与」的社交证明。
- `/api/daily_set` 已边缘缓存（60s TTL），生产实测压缩后约 8KB —— 首页取一次可同时用作社交证明与题组预取。
- /tiku SEO 页族无每日更新页面；每日一练题组按日确定，是天然的每日新鲜内容（SEO 信号 + 获客入口）。
- R67 版本戳 telemetry：growth_events 最新 25 条 slow_load 中仍无 `;v:` 记录，8-30 15:43 后无新增纯 nav 90s 挂起（样本不足，继续观察，不立项）。

## 方案

### A. 首页全站同题外显 + 题组预取（home.vue / practice.vue）

- home onShow 非阻塞请求 `/api/daily_set`（边缘缓存命中 <100ms），结果：
  - hero 区新增一行小字：`今日全站同题 · 已有 N 人完成`（N=0 时「来做今天第 1 人」）；
  - 整包写入 `uni.setStorageSync('dailySet', d)` 作为当日预取缓存。
- practice.startDaily：先读 storage 缓存，`cached.date === 中国时区今日` 即直接用缓存题组（题组按日确定性，date 匹配即有效），否则走既有网络路径；失败回退随机抽题不变。
- 收益：入口社交证明 + 点「每日一练」秒开（无「出题中」等待）。

### B. /tiku/daily/ SSR 每日一练页（seo.py）

- `GET /tiku/daily/`（/tiku/daily 301）：当日 10 题列表卡（模块名 + 题干摘要链接 /tiku/q/{id}）+ 参与人数 + CTA 去主站做题；复用 `_page`/`_collection_ld` 壳。
- `db.cn_day()` 提取为共享 helper（qbank_api._cn_day 改为调用）。
- /tiku/ 首页加「今日每日一练 →」入口；sitemap-pages 收录 /tiku/daily/。
- 缓存：CF 对 /tiku* 已有 300s 边缘缓存，跨日最多 5min 旧题组，可接受。

## 不做

- 每日榜单独立页、连续参与勋章（下轮候选）；
- stats 实时推送（60s 边缘缓存精度足够社交证明用途）。

## 验收

- 首页 hero 出现全站同题行（0 人/多人两分支文案），console 0 error，375/1440 无溢出；
- 首页进入每日一练不再出现「出题中」loading（缓存命中路径），题目与 /api/daily_set items 一致；缓存过期日自动走网络；
- /tiku/daily/ 渲染当日 10 题且与 API 一致、链接可点、非当日不串题；/tiku/ 入口与 sitemap 收录；
- 回归：普通刷题、随机回退路径不受影响。
