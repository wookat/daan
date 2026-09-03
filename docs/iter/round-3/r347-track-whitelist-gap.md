# R347：/api/track 白名单缺口收口——review_similar_auto/review_similar_click/review_reason_tag/share_poster

## 取证（SOP-10 架构/可观测性维度 + R346 生产实景）

- R346 生产实测实景抓到：错题本复习流「加练同类」触发 `POST /api/track {event:"review_similar_auto"}` → 400（testing agent 抓包，两轮均复现为既有问题）。
- 全量对账（前端 `trackEvent('<event>'` 字面量集合 vs backend/app/team.py api_track 白名单）：
  - 前端在发、白名单缺失（静默 400 丢埋点）：
    - `review_similar_auto`（book.vue 复习流自动加练，R310 时代引入）
    - `review_similar_click`（book.vue 复习流「还不稳？练 3 道同类题」点击）
    - `review_reason_tag`（book.vue 复习流错因自评打标，R311/R314 链路）
    - `share_poster`（report.vue 模考成绩海报生成，R304）
  - 白名单有、前端已不发：`reminder_optin`（存量数据保留口径，不动）。
- 同构先例：R333 曾发现并收口 search/review/report_ask_click 三事件同类缺陷——白名单与前端发点脱节是重复出现的架构缝隙。

## 收口方案（backend 一处 + 契约测试防再犯）

1. team.py api_track 白名单补 4 事件：`review_similar_auto`、`review_similar_click`、`review_reason_tag`、`share_poster`。
2. 新增契约测试 test_track_whitelist_sync.py：静态扫描 frontend-uni/src 中 `trackEvent('...')` 字面量集合，断言全部落在 team.py 白名单内——前端新增发点未同步白名单时本地 pytest 直接红，根治「静默 400」再犯路径。
3. 不改 rate limit、ref 截断、slow_load 富化、ago_ms 等既有行为；不新增表/endpoint。

## 非目标

- 不补发历史丢失埋点（无法恢复）；不改前端发点；不动 reminder_optin 存量口径。

## 验证

- 本地：ruff/pytest（+2：4 事件 200 入库、契约同步扫描）/pyright/lint/vitest/build 全绿。
- 生产：部署后 curl 4 事件 200 + bogus 400；testing agent 真实 UI 触发复习流加练路径确认 review_similar_auto 200 入库；测试 uid 清理 + 保护 uid 快照一致。
