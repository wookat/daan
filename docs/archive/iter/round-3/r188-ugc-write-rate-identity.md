# R188：UGC/社交 DB 写端点限速身份收口——uid 轮换绕过的最后一批桶

## 背景与取证

R186/R187 修复了 LLM 端点与注册/登录/埋点的限速身份。全库 `rate_limit(` 复核后，
剩余 uid-only 桶均为**匿名可写 DB 的社交端点**（uid 为客户端自报 `_clean_uid(body)`，
轮换即绕过；生产 ACCESS_CODE 为空，扫描器可直打）：

| 端点 | 桶 | 现阈值 | 轮换绕过后果 |
|---|---|---|---|
| POST /api/team/create | team_create:{uid} | 5/3600 | 无限插 teams+team_members 行、耗尽邀请码空间 |
| POST /api/team/join | team_join:{uid} | 10/300 | 无限插 team_members 行（撞邀请码） |
| POST /api/share/create | share_create:{uid} | 30/3600 | 无限插 shared_questions 行 |
| POST /api/share/{sid}/answer | share_answer:{uid} | 60/3600 | 无限插 share_answers 行 |
| POST /api/pk/create | pk_create:{uid} | 10/300 | 无限插 pk_matches 行 |

与 R186 面试端点同一根因，风险从「烧 LLM token」变为「SQLite 垃圾行膨胀/存储耗尽」。
不动的：social.py `cmt:{uid}`/`cmt_report:{uid}`（uid 来自 require_user 服务端换算，
不可自报轮换；注册开销已被 R187 reg 桶按真实 IP 封顶）；auth 桶（R187 已修）；
pk/join、pk/submit、pk/random 现状无限速，属新增限速决策而非身份修复，挂观察不在本轮扩权。

## 方案

5 个端点改走 `deps.rl(request, bucket, limit, window, uid)`：bucket/limit/window 全部不变，
uid 桶语义保持，新增 IP 桶恒生效（带 uid 放宽 3 倍容忍 NAT，与 R186 口径一致）。
handler 补 `request: Request` 参数（FastAPI 注入，不改请求契约）。

## 验证

- 本地：pytest 新增 team_create uid 轮换被 IP 桶封顶用例；全量测试 + ruff 全绿。
- 生产：share/answer 缺 sid 探测（404，不写行）同 uid 超阈值转 429；正常语义回归。

## 限制

同 R186/R187：内存限速、分布式多 IP、CF WAF 权限（已申报）。
