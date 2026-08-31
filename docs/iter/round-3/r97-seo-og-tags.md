# R97：/tiku SEO 页族补 Open Graph 标签 + /tiku/q/{id}/ 尾斜杠 301

日期：2026-08-31 · 状态：已实现

## 取证（生产一手数据）

1. 分发通道现状（origin 日志 tail 3000，2026-08-31）：
   - YandexBot 958、Googlebot 1、bingbot/Baiduspider/Sogou/360 = 0；
   - 真实获客只剩 IndexNow→Yandex 一条通道，社交/IM 分享是唯一可自建的第二通道。
2. 页面取证：
   - 首页（SPA 壳）有完整 og: 标签；
   - `/tiku/q/*`、`/tiku/daily/`、各列表页（`_page()` 模板全族）**均无任何 og: 标签**——分享到微信/QQ/Telegram/Twitter 等无卡片摘要，仅裸链接；
   - `/s/*` 分享落地页已有动态 OG（R68），本轮不动。
3. `/tiku/q/{id}/`（带尾斜杠）被 `/{module}/{submodule}/` 路由吞掉返回 `404 {"detail":"模块不存在"}`；canonical/sitemap 均为无斜杠形式，但外部转贴/手输尾斜杠会直接 404 丢流量。

## 方案

1. `_page()` 模板统一注入 6 个 og 标签（type/site_name/title/description/url/image），
   og:url 复用 canonical，og:image 用现有 `/static/logo.png`——一处改动覆盖 /tiku 全页族（题目页、模块/题型列表、真题卷、每日一练、讨论聚合等）。
2. 新增路由 `GET /q/{qid}/` → 301 至 `/tiku/q/{qid}`（注册顺序在 `/{module}/{submodule}/` 之前，FastAPI 按序匹配）。

不改任何业务语义；边缘缓存无需变更（HTML 响应体变化随 TTL 自然更新）。

## 验收

- 本地：ruff seo.py 通过；uvicorn 实跑 `/tiku/q/<id>/` 301→无斜杠、题目页/列表页 og 6 标签齐全。
- 生产：部署后复验同上 + 回归 /tiku/、/api/health、sitemap。

## 边界

- 微信内置浏览器的分享卡片需公众号 JS-SDK 签名（owner 资源，已在资源申请清单）；og 标签覆盖 QQ/TG/Twitter/百度贴吧等通用爬虫场景。
- Baidu/Bing/Sogou/360 收录需站长平台账号验证（owner 资源，见 handoff 资源申请）。
