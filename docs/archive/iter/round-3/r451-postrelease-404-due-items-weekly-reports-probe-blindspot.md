# R451 · 发版后 (c) 补量 + 到期项只读复查 + `weekly_reports` 首行归因 + 1440 `.remind-btn` 一手值

> 只取证登记，不改产品代码、不部署。生产 `460120f` 未动。

## 1. R449/R450 发版后自然旧壳 404 (c) / `.sheet-x` 补量

窗口：R449 容器 StartedAt 19:02:48Z 起（含 R450 19:41:43Z）→ 20:16Z，54 min，caddy 源站 642 请求（200 ×624 / 3xx ×17 / 4xx ×1）。

| 项 | 结果 |
|---|---|
| `/assets/*` 404 | **0** |
| `/api/monitor/report` 上报 | **0** |
| `.sheet-x` | 0 |
| 非 2xx 18 条 | `/sw.js` 304 ×12（走查浏览器）、`/robots.txt` 304 ×4（Googlebot / 桌面 UA / curl）、R450 探错 `/s/ZZZZ` `/p/ZZZZ` 302 ×2、bingbot 历史分片 `sitemap-questions-12.xml` 404 ×1（R437 已归因） |

→ (c) 仍无样本，继续挂。

## 2. 到期项（容器内只读 `file:/data/data.db?mode=ro`，20:16Z）

| 项 | 值 | 变化 |
|---|---|---|
| `answer_log` probe=0 | 22 行 / 1 uid，max ts 09-06 08:57 | 不变 |
| `error_reason` 非空 | 6 行，与 probe=0 关联 0 | 不变 |
| `push_subs` | 0 | 不变 |
| **`weekly_reports`** | **1**（此前恒 0） | **新行，见 §3** |
| `growth_events` probe=0 | 18 行 / 4 uid | 不变（同 R446） |
| WAL | 3.05 MB（R450 1.79 MB） | 64 MiB 截断阈值未触发 |
| 容器 | healthy、restarts 0、当前容器 2802 行日志 Traceback/locked/5xx 0 | — |
| 宿主 | 91% / 4.5 G free，mem free 84 MB / avail 312 MB | 同前 |

## 3. `weekly_reports` 首行归因（直接事实 / 推断分开）

**直接事实**
- 行：`uid=umtppgte7u8emh2vs`，`week_start=1788105600`（08-31 周），`created_at=1788725692`（**09-06 20:14:52Z**），`read_at` 已置。
- caddy 同秒：`GET /api/report/weekly?uid=umtppgte7u8emh2vs` → `/read` → `/next_event`，UA `Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)…`，`Cf-Connecting-Ip=140.232.64.3`，**无 `X-Kg-Probe` 头**。
- 该 IP 与本量测机出口 `140.232.64.4` 同 /24；容器 `KG_PROBE_CIDRS=140.232.64.0/24`。
- 该 uid 在库：`answer_log` 26 行（09-06 11:11–20:06）**全 probe=1**、`growth_events` 8 行全 probe=1、`exam_attempts` 6 行全 probe=1 → 三路判定中**只靠网段**一路命中并正确打标（头未带、UA 无自动化关键字）。
- 该 uid 19:22–20:15Z 连续 53 min 浏览 322 个 `/api` GET（首页 bundle / 错题 / 卷库 / 成长 / 收藏 / 笔记 / PK 大厅 / 周报…），非本轮 testing agent 的两枚 uid（`r450_test_report.md` 无此 uid）。
- `weekly_reports` **没有 `probe` 列**（同类无 probe 列且带 uid 的表共 30 张，见附）。

**推断**
- 该访客是同网段另一 Devin 会话的 Playwright（UA 为 Playwright iPhone 设备描述符原文；行为为全站巡览），非外部真人。
- R386「三路任一」设计在此样本上兜住了「不带头的兄弟自动化」；若它用别的出口网段则会漏成 probe=0——这是既知设计边界，不是本轮新缺口。

**登记（不改码）**
- 「`weekly_reports 0`」这一到期项此前被当作「无真人周报」的旁证，但该表无 probe 列，**本身不能区分探针/真人**；今后读该项必须 join `answer_log` 看该 uid 的 probe 分布（本轮 join 结果：全 probe=1）。SKILL 到期项清单相应改写。
- 是否给 `weekly_reports` 等 30 张无 probe 列的表补列：产品读路径不按 probe 过滤这些表（周报是按 uid 的个人产物、不聚合跨用户），补列无产品价值、只服务运维口径 → **不立项**，用 join 口径替代。

## 4. 1440 `.remind-btn` / `.rank-copy` 一手数值（R450 遗留）

R450 testing agent 在 1440 未量到 `.remind-btn`（对方当天已作答、`v-if="!m.is_me && !m.today_n"` 不渲染）。本轮不造写数据，改用**合成元素 + 页面真实 scoped 属性**量真实 CSS：在生产 `/#/pkgA/team/team` 页 `uni-page-body` 下追加带 `data-v-806c425f` 的 `uni-view.remind-btn` / `.rank-copy`（探针头、只读 GET）：

| 视口 | `.remind-btn` h / fs / min-height / padding-x | `.rank-copy` h / fs / min-height / padding-x |
|---|---|---|
| 1440×900 | **40** / 12 / 40px / 12 | **40** / 12 / 40px / 11 |
| 375×812 DPR2 | **40** / 12 / 40px / 12 | **40** / 12 / 40px / 11 |

结论：`min-height:40px` 为 px 单位与视口无关，1440 下选择器命中（`data-v` 匹配、min-height 生效）、高度 40 → R450 遗留项闭合。限制：合成元素不是产品条件渲染出来的（无真实 `.mem-row` 父级 flex 约束），但高度由 `min-height` 决定、父级 `align-items` 不会压低它。

## 5. 附：无 `probe` 列且带 `uid` 的表（30 张，只读枚举）

mistakes 274 · question_reports 6 · shenlun_answers 6 · answer_log_qa_bak 430 · shenlun_mat_favs 1 · user_state 5 · user_profile 8 · review_log 34 · question_comments 17 · comment_likes 5 · fav_folders 1 · question_favs 8 · question_notes 5 · interview_sessions 13 · mock_event_entries 1 · weekly_reports 1 · reinforce_log 2 · team_members 1 · shared_answers 4 · reminder_prefs 3 · comment_reports 0 · comment_inbox_reads 1 · push_subs 0 · shenlun_qfavs 0 · shenlun_drafts 0 · exam_progress 10 · practice_progress 4 · ask_sessions 1 · ask_cur 4 · review_cur 1

其中跨用户聚合并对用户可见的只有 `question_comments`/`comment_likes`（评论区）——R375/R427 已核评论区不做「击败 X%」类统计；其余均为按 uid 的个人产物。

## 6. 未验证 / 限制

- 「同网段另一 Devin 会话」是推断（无会话 ID 关联证据）；未查该 uid 09-06 11:11 首见时的来源。
- (c) 54 min 窗口内无真人页面访问（候选真人 0），无样本 ≠ 无问题。
- 1440 `.remind-btn` 为合成元素量测，非真实条件渲染。
