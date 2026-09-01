# R190：限速体系全景复审计 + 真实用户误伤与 429 韧性验证（docs-only）

R186–R189 四轮连续修复后，本轮做收口复审计：全景清点、误伤风险分析、前端 429 韧性取证。无新 verified 缺陷，不做代码改动。

## 1. 全景清点（源码 grep 一手证据，rev 533cfa0）

写入/高成本端点限速覆盖现状：

| 类别 | 端点/桶 | 阈值 | 身份口径 |
|---|---|---|---|
| LLM | ai_explain 20/300、ai_similar 30/300、ai_followup 30/300、ai_coach 20/300、ai_mistake_analysis 10/300、ai_shenlun_grade 10/600、itv_answer 20/600、itv_regen 10/600 | R186/R187 | rl()：IP 恒生效 + uid 叠加 |
| 导出/OCR | export_pdf 20/300、scan_sheet 20/300 | 既有 | rl() |
| UGC DB 写 | team_create 5/h、team_join 10/300、share_create 30/h、share_answer 60/h、pk_create 10/300 | R188 | rl() |
| 匿名 DB 写 | alog 120/h、backup 10/h、report 20/h、qreport 30/h、presult 60/h、mistake 240/h | R189 | rl() |
| 账号 | reg 10/h、login 10/300（IP+phone）、wxlogin 20/300 | R187 | client_ip() |
| 遥测 | track 60/300 | R187 | uid 或真实 IP |
| 社交 | cmt 3/60、cmt_report 10/600 | 既有 | require_user 服务端 uid（不可轮换） |
| 兜底 | ErrorStormGuard 30 错误/60s per IP（health 豁免） | R182 | X-Kg-Ip |

复核确认**无遗漏**的写端点均为 bounded：user_state/profile/reminders/mat_favs/daily_set submit/mock_event（(uid[,key]) upsert）、pk join/submit（UPDATE 既有行）、/api/rate（rate_explain/rate_question_hs 为既有行计数 UPDATE）、monitor/report（转发不落本地 DB）、favs/notes/comments（require_user）。管理/导入端点走 admin token/import token。

## 2. 真实用户误伤分析（golden path 推演）

重度用户 1 小时上界推演（120 题/h 刷题，约一半答错）：

- alog：每次练习完成/离线重放各 1 次批量上报，≈10–20 req/h ≪ 120（uid 桶）；
- mistake：每答错 1 题 1 次 ≈60 req/h ≪ 240；
- presult：每次练习结束 1 次 ≈10 req/h ≪ 60；
- backup/report：手动操作，个位数。

NAT 共享出口（自习室/校园网）：IP 桶为 3×（带 uid），alog 360/h/出口 IP，可容 ≈20–30 名同时重度刷题用户；当前 DAU 量级（7d answer_log 23 uid）远未触达。若未来单出口聚集用户增长，放宽的是「IP 桶倍率」单点（deps.rl），已在 handoff 挂观察项。

## 3. 前端 429 韧性取证（源码证据）

- practice.vue logAttempts：answer_log 请求 catch 后 `enqueueAnswers()` 入本地队列（key 去重），恢复后 flushOfflineQueue 重放——429 不丢真实作答；
- offline.js flushOfflineQueue：整体 try/catch，失败保留队列下次再试；answers/mistakes 队列按真实作答量增长（key 去重），无爬虫放大面；
- R182 起 429/「请求过于频繁」已归入可重试口径，不触发 R181 terminal 清进度。

## 4. 结论

限速体系四轮收口完成：全部匿名可打的 LLM/写/账号端点均有真实 IP 维度限速，uid 轮换不再绕过任何桶；阈值与 golden path 用量有 3–10 倍余量；429 在前端全链路可重试不丢数据。剩余已知限制（如实）：内存限速重启清零、多 IP 分布式消耗需 CF WAF（token 无 ruleset 权限，已申报）、NAT 大出口聚集用户为远期观察项。
