# R102：/?daily=1 推送深链失效修复（2026-08-31）

## 取证

- 生产实测（375 全新 context）：`https://kaogong.zalize.com/?daily=1` 落在首页 `#/`，未进入每日一练；`/#/pages/practice/practice?daily=1` 正常直入题组（`/api/daily_set` 请求 + 出题中）。
- 根因：uni h5 router 只识别 hash 路由，前端从未处理根路径 query；R98 推送 payload 的 url 恰为 `/?daily=1`，明日 08:00 首推的点击落地全部失效（点开通知只到首页，推送转化直接归零）。
- R72 分享文案与 R78 SSR CTA 均已用 hash 形式，不受影响。

## 方案

双保险，零新接口：

1. 后端 `push_api.py` 推送 payload url 改为 `/#/pages/practice/practice?daily=1`（payload 发送时生成，旧 bundle 客户端也立即受益）。
2. 前端 `main.js` 启动前归一化：`location.search` 含 `daily=1` 且无实质 hash 时 `location.replace` 改写为练习页 hash 深链（透传 `date`），保护任何存量/外部 `/?daily=1` 短链。

## 验收

- 生产 375：`/?daily=1` 直入每日一练题组（发出 `/api/daily_set`），`/?daily=1&date=<昨日>` 直入往期题组；
- 首页正常路径无回归（无多余跳转）、console 0 error；
- bundle hash 线上=本地。
