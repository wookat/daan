# R252：申论年份/地区筛选深链闭环——年份页 CTA ?year + hub 地区 chips ?region + App onLoad 白名单

## 取证（生产实查，2026-09-02）
- R251 后申论题型页 CTA 已带 `?qtype=` 直达 App 对应筛选，App `onLoad` 白名单收 qtype；对称能力在年份/地区维度缺失：
  - `_render_shenlun_year` 底部 CTA 为通用 `/#/pkgA/shenlun/shenlun`（无 `?year=`）：用户从「2023 年申论真题页」进 App 后落在未筛选全量列表，需自行再选年份；
  - `/tiku/shenlun/` hub「覆盖地区」chips 为纯文本 `<span>`（与 R250 前年份 chips 同形态）：15 个地区（国考 103/江苏 16/北京 16/…）零出口；
  - App `shenlun.vue` 已有 `setYear`/`setRegion` 筛选与 `&year=`/`&region=` API 支持，但 `onLoad` 不收 `?year`/`?region`。
- origin 复审计无新代码缺陷：05:05–05:47 慢样本簇（含 /api/health 5.6s、静态 12s）为共享宿主争用窗口（06:00 后同查询恢复 0.3–1.0s），tag3 探针请求来自自有 ops curl；5xx 全为部署窗口设计形态。
- 申论地区 SSR 页族不做：尾部地区仅 3–5 题（thin page 风险），且行测也无 /r/ 地区页族先例；地区维度以 App 深链出口收口。

## 方案
1. SSR（seo.py）：
   - `_render_shenlun_year` CTA 改 `/#/pkgA/shenlun/shenlun?year={year}`，文案带年份；
   - hub「覆盖地区」chips 改 `<a href="/#/pkgA/shenlun/shenlun?region={quote(r)}">`（不新增可收录 URL，canonical/JSON-LD/sitemap/分页零变化）。
2. App（shenlun.vue）：`onLoad` 收 `opts.year`/`opts.region`，在 `loadFilters()` 返回后按真实 filters 白名单校验（`years.includes(Number(year))`、`regions.includes(region)`），命中才设筛选并重拉列表；非法值忽略。既有 id/qtype/mid/tab 语义不变。

## 非目标
- 不做申论地区 SSR 页族、不做年份×地区/题型交叉页、不改行测 CTA。

## 验证
- 本地：ruff/pytest/pyright/前端 lint/vitest/build 全绿；hub 回归测试补地区链接断言。
- 生产：年份页 CTA 带 ?year、hub 地区 chips 为链接；App ?year=2023 / ?region=江苏 深链 chip 激活+列表过滤、非法值忽略；1440/375 × light/dark 溢出 0、console 0 error、axe serious+ 0；性能预算全过。
