# R189：零限速匿名可写端点收口——answer_log/backup/report/mistakes/practice_result

## 背景与取证（源码一手证据）

R186–R188 修复了「有限速但身份可绕过」的桶。本轮全量核对 `@router.post` × `rate_limit|rl` 调用点，
发现一批**完全没有任何限速**的匿名可写端点。其中按 SQLite 无限插行/字节放大风险分级：

### verified 高风险（每请求无条件 INSERT，零限速）

| 端点 | 放大系数 | 证据 |
|---|---|---|
| POST /api/answer_log | 每请求最多插 200 行（`items[:200]`，且每行触发一次 questions 查询） | study_api.py `api_answer_log`，db.save_answer_log 逐条 INSERT |
| POST /api/backup | 每请求最多 500KB blob（`json.dumps(data)[:500000]`），不带 code 时每次新插一行 | stats.vue 手动备份用；db.save_backup INSERT ON CONFLICT |
| POST /api/report | 每请求插 1 行 reports（其孪生 /api/question_report 已有 30/3600，本端点漏网） | study_api.py `api_report` |
| POST /api/mistakes | 每请求插 1 行 mistakes | study_api.py `api_save_mistake` |
| POST /api/practice_result | 每请求插 1 行 | study_api.py `api_practice_result` |

生产 ACCESS_CODE 为空（产品决策），以上端点匿名可直打；R185 已实证扫描器在打 /api 面。
R182 ErrorStormGuard 只统计 4xx/5xx 错误响应，以上端点正常 200 写入完全不触发。

### 复核后明确不属于本轮（bounded 或已有防护）

- /api/user_state、/api/profile、/api/reminders、/api/shenlun/mat_favs：按 (uid[,key]) upsert，同 uid 重放不增行；
- /api/pk/join、/api/pk/submit：UPDATE 既有对局行，不插行；/api/pk/random_match 落入已限速的 pk_create；
- /api/daily_set/submit：按 (day,uid) upsert；
- mock_event register/enter：ON CONFLICT(event_id,uid) upsert；
- /api/monitor/report：转发中心收集器不落本地 DB；
- social 评论/收藏/笔记：require_user 服务端换算 uid + 已有 cmt 桶。

（以上 uid 轮换仍可按 uid 增行，但每 uid 至多 1 行、且无 LLM/blob 成本，量级远低于本轮五个端点，挂观察。）

## 方案

五个端点接入 R186 已验证的 `rl()`（IP 桶恒生效、带 uid 放宽 3 倍、uid 桶叠加）。
**新增阈值决策依据**：以真实 golden path 用量上界放宽数倍取值，正常用户不可能触达：

| 端点 | 桶 | 阈值 | 依据 |
|---|---|---|---|
| answer_log | alog | 120/3600 | 前端每次练习完成/离线重放各 1 次批量上报，重度用户 <20 次/h |
| backup | backup | 10/3600 | stats 页手动点击操作 |
| report | report | 20/3600 | 反馈表单手动提交（对齐 question_report 30/3600 口径） |
| mistakes | mistake | 240/3600 | 每答错 1 题 1 次 + 离线重放逐条，重度刷题上界 <120 题/h |
| practice_result | presult | 60/3600 | 每次练习结束 1 次 |

API 契约、错误语义、返回体零变化；仅新增 429（含 Retry-After，语义同 R186）。

## 验证计划

- 本地：pytest 复用 test_rate_limit.py 模式（无效 body 探测不插行），uid 轮换被 IP 桶封顶；ruff。
- 生产：/api/report 无效 reason 400 探测（不插行）连打至 429；health/读接口同期 200。

## 限制（如实）

同 R186–R188：内存限速重启清零；分布式多 IP 仍可在阈值内消耗；彻底防御需 CF WAF（无权限，已申报）。
