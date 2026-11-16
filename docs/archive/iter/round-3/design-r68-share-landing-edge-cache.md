# R68 设计：分享落地页 /s/* 边缘缓存 + 分享失效态 CTA

日期：2026-08-31 ｜ 依赖：R45/R56 CF Pages functions 边缘缓存通道（#221/#233）

## 一手取证（生产实测 2026-08-29）

1. `/s/fsb75lki`（分享落地页 = 获客入口）连续三次冷请求：
   - 第 1 次：**524（CF 超时）125.1s**
   - 第 2 次：200，**50.6s**
   - 第 3 次：200，0.27s（origin 进程内 lru 已热）
   浏览器实测同刻 goto 30s 超时。被分享的新用户点开链接直面 50–125s 白屏/524，是全站最不能慢的页面。
2. 通道审计：`/s/*` 不在 CF functions 边缘缓存清单（仅 `/tiku*` + 5 个 API），每次分享点击都穿透共享 origin（R64 已证宿主级挤占长尾）。
3. `seo.py share_landing`：纯只读（两条 SELECT），输出仅依赖 sid（OG + 0s 跳 SPA），无 Set-Cookie、无 uid/UA 分支——满足 R45/R56 缓存前提。真实作答数等动态内容在 SPA 内走 API，不在此 HTML 中。
4. 降级态走查：share-q 无 sid/失效 sid 直出「分享链接无效」裸文本、pk-result 直出「战绩链接无效」，均无任何脱困 CTA（对比 R66 已收敛的三页）。

## 方案

### A. `/s/*` 边缘缓存（P1，deploy/cf-pages/functions/[[path]].js）
- `isEdgeCacheable` 追加 `url.pathname.startsWith("/s/")`，复用页面级 TTL 300s。
- 仅缓存 200 + text/html（既有守卫），无效 sid 的 302 不入缓存。
- 影响面：分享内容按题固定，300s 陈旧无实质影响；删除分享最迟 5 分钟后生效。

### B. 分享失效态 CTA（P2，share-q.vue / pk-result.vue）
- share-q errMsg 态：补说明文案 +「去刷题」按钮 reLaunch `/pages/home/home`（新用户获客兜底，13 万题库仍可留住）。
- pk-result errMsg 态：补「发起我的 PK 对局」按钮（复用既有 goChallenge），保留 PK 漏斗。
- 复用两页既有 act-btn/empty 样式，375/1440 双视口验证。

## 验证计划
- curl 实测 `/s/<sid>` MISS→HIT、HIT 体与 origin 逐字节一致、X-Edge-Cache 头。
- 无效 sid 302 不被缓存、非 /s/ 路径零泄漏（/api/、SPA 首页头部无缓存头）。
- 生产 375/1440 走查：失效 sid 空态 CTA 可点可跳、有效分享作答流回归、console 0 error。
