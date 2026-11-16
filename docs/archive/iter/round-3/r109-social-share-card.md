# R109：社交分享卡片 og:image 收口——分享落地页补图 + 全站品牌分享卡

## 取证（生产一手证据，2026-08-29）

- verified fact：`/s/{sid}` 分享落地页（`backend/app/seo.py::share_landing`）输出完整 og:title/og:description/og:url，但 **og:image 计数为 0**（`curl -s https://kaogong.zalize.com/s/fsb75lki | grep -c "og:image"` → 0）。QQ/微博/Telegram/Discord 等 og 抓取端的分享卡无缩略图。
- verified fact：root `index.html` 与 `/tiku` SSR 页族的 og:image 均指向 `/static/logo.png`（512×512 方形 App 图标）。og 推荐 1200×630 横版大图；方形小图在 summary_large_image / 链接预览下裁切或降级为小图标。
- verified fact：分享回路在真实生产有流量——近 3 日 growth_events：share_open 15、pk_result_open 7、share_copy 2、share_answer 1；分享落地页本身链路健康（375 视口实测 3.3s 直入挑战页、含作答与注册 CTA）。
- verified fact：本轮同批复核了首页新访客激活链路（landing「免注册立即开练」→ 每日一练），稳态 3 次实测约 1s 出题（一次 33s 为宿主抖动瞬态），不立项。
- hypothesis：分享卡带品牌大图后点开率提升（微信站内卡片不走 og，不在本轮声明范围内）。
- unknown：各平台重新抓取缓存的时效（Telegram/微博有各自缓存）。

分级：P2（增长向小改进，服务既有真实分享流量）。

## 方案

1. 新增品牌分享卡 `frontend-uni/src/static/og-card.png`（1200×630，品牌渐变 #2e5bff→#4c7dff、站名+价值主张+特性 chips），由 `scripts/gen_og_card.py`（PIL + 仓库内 NotoSansSC-Bold）生成，可复现。
2. `seo.py::share_landing` 补 `og:image`（指向 og-card）+ `twitter:card` 升级 `summary_large_image` + `twitter:image`。
3. `seo.py::_page`（/tiku 页族）与 `frontend-uni/index.html`（root）og:image 从 logo.png 换为 og-card.png，twitter:card 同步升级。

架构决策：静态单图（非按题动态渲染图）——当前分享量级（15 次/3 日）不值得引入按题出图的渲染/缓存链路；og:description 已携带题干摘要承担内容差异化。零数据库/零边缘缓存改动。

## 验证计划

- 本地：ruff、pytest（backend）、`npm run build:h5`。
- 生产：curl 三处（/s/*、/tiku/、/）og:image 均指向 og-card.png 且可 200 访问、尺寸 1200×630；SPA 回归（375+1440 首页/分享页 console 0 error）。
