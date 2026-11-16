# R461：R460 两次发版后 (c) 补量 + vivo 设备 09-06 05:37 CST 会话逐页复盘 + error_reason 第 7 条 + 到期项（只取证登记，不改码不部署；生产仍 `fe57df3`）

时间：2026-09-06 22:10–22:50Z。生产 `/api/health` `{"ok":true,"rev":"fe57df3"}`，容器 `deploy-kaogong-1` running healthy、`RestartCount 0`、`StartedAt 2026-09-06T22:11:59Z`（R460b compose 重建）。

## 1. 结论先行

1. **R460 勘误（如实认错）**：R460 文档 / handoff 把 vivo `V2405A` 设备 09-06 21:37–21:45Z 的会话写成「一次 **H5** 会话」——**错误**。272 行 origin 日志 UA 全为 `… MicroMessenger/8.0.77 … MiniProgramEnv/android`、Referer 全为 `https://servicewechat.com/wx01f2f29cfe51baba/0/page-frame.html`（AppID = `miniapp-native/project.config.json`），与 R425 结论一致：客户端是**微信原生小程序**，不是 H5。R460 修的 4 处都在 `frontend-uni`（H5 产物），该设备**看不到 R460 的任何改动**；R460「本簇首个 probe=0 使用样本」只覆盖了本簇**后端接口**，未覆盖 H5 UI。R460 文档与 handoff 已加勘误指针（本文 §2）。
2. **会话跑的是 main 里没有的小程序代码**：`main`/PR #619 分支的 `miniapp-native` 不含 `/api/report/weekly`、`/api/mastery/map`、`/api/predict`、`/api/shenlun/stats`、`/api/exam/attempts`、`/api/mistakes/analysis`、`/api/explain/stream`、`/api/pk/mine`、`/api/access_info`（`git grep` 9/10 路径 0 命中，仅 `/api/reminders` 在），而会话逐条打了这些接口；`origin/devin/w6-mp-parity`（PR #634）/ `origin/devin/w6-exam` 分支 10/10 全命中 → 设备运行的是 **W6「小程序功能对齐 H5」分支的构建**（09-06 10:33–11:53Z 提交，54 commits 未合 main）。哪一个 commit 的构建、是体验版还是开发版，日志里无版本号，**不可知**。
3. **本簇接口层无 4xx/5xx、无慢请求**：成长/周报/知识点三页的 6 个 GET（`/api/stats`、`/api/growth`、`/api/mastery/map`、`/api/checkin/summary`、`/api/shenlun/stats`、`/api/predict`）会话内共 60 次全部 200、**3–85 ms**；`/api/report/weekly` + `/read` + `/next_event` 2 组全 200、3–10 ms。唯一非 2xx 是 21:38:07 `POST /api/auth/wxlogin` **503**（`WX_MINIAPP_SECRET` 未配，R425 起已登记）。
4. **空态（按响应字节推断）**：`/api/predict` 34 B = `{"status":"cold","n":…,"need":100}`（作答 <100 题的设计冷态）；`/api/shenlun/stats` 51 B = 无申论记录；`/api/growth` 330→423 B、`/api/mastery/map` 3941→4013 B、周报 506 B（`summary.n=24`）均非空。**这是响应体大小推断，不是渲染层证据**（小程序真机 UI 无法从服务端复现）。
5. **命中一处（在 W6/W7 分支，不在 main）**：`/api/mistakes/analysis` 4 次 POST 在 21:41:59–21:42:19Z **并发完成**（按 Caddy 完成时刻减 duration 反推起点 21:41:25 / :36 / :47 / :48，间隔 11 s / 11 s / 1 s），每次 19.7–39.8 s、200、845–879 B。W6 `miniapp-native/pages/book/book.ts` `onAiAnalysis()` 只判 `if (this.data.aiHtml) return;`，**不判 `aiLoading`** → 用户等待中关掉面板再点入口，就再发一次 20–40 s 的 LLM 请求（4 次 = 4 份 LLM 花费，最后一次覆盖前面结果）；H5 `book.vue` `aiAnalysis()` 有 `if (this.aiLoading || …) return;` 守卫。W7 `origin/devin/w7-mp-flat-v3`（PR #636，含 W6 全部提交）`book.ts` 同样缺守卫。**不动他人活跃分支，评论到 #636/#634 由 W6/W7 负责人一行修。**
6. **顺带核 W6/W7 分支对 R460 命中的移植状态**（只读）：R460 ①「本周比上周」——W6 `stats.ts:293` 原样复制了 H5 旧缺陷，**W7 `stats.ts:249` 已改为 `cur.label + '比' + prev.label` 并自带 `cnWeekKey`**（与 R460 独立实现同口径）；R460 ②热力图合计 `today−83` 与 12 列格子起点 `周一−77` 不一致——W7 `utils/cn-date.ts:61` **仍是 `−83`**（W6 原版 `stats.ts:64` 反而是按格子累加的、无此缺陷；W7 重写时引入）。同样只评论不动手。
7. **(c) 补量**：R460 两次发版后 21:00Z 起 845 请求：`/assets/*` 404 **0**、`/api/monitor/report` **0**、非 2xx **1**（即上面 wxlogin 503）→ 继续挂。
8. **到期项**：`answer_log` probe=0 **33/1**、`growth_events` probe=0 **20/4**、`mistakes.error_reason` 非空 **7**（第 7 条见 §4）、`push_subs` 0、`weekly_reports` 2、`quick_check ok`、WAL 4.1 MB（高水位，R455 口径）、宿主盘 **92% / 3.9–4.2 G**。全部无新增量、无新 uid；仍无可确认外部真人。

## 2. R460 勘误指针

- `docs/iter/round-3/r460-sop10-audit-growth-weekly-mastery-cluster.md` §1「增量归因」一段「一次 H5 会话」→ 加 **[R461 勘误]**：实为微信原生小程序（W6 分支构建），R460 的 4 处 H5 改动该设备看不到。
- `docs/handoff-context.md` R460 节同句同改。
- R460 的其余结论（probe=0 打标正确、非外部真人、后端不动、H5 4 处命中及修法）**不受影响**。

## 3. 逐页复盘（origin 日志 272 行，按小程序页面归组）

| 时刻 (Z) | 页面（按接口束推断） | 接口 | 状态 / 时延 |
|---|---|---|---|
| 21:37:47 | 首页冷启动 | exam/resume, announcement, review/cur, practice/resume, question_counts, daily_set, home_bundle | 7×200，21–77 ms |
| 21:37:52 | 错题本 | favs, favs/folders, mistakes, review | 4×200 |
| 21:37:54 | 模考 | exam/attempts?limit=3, exam/resume, exam/papers?kind=zhenti | 3×200 |
| 21:37:55 | **统计页（成长/知识点入口）** | exam/attempts?limit=20, shenlun/stats(51 B), checkin/summary, stats, growth(330 B), mastery/map(3941 B), profile, predict(34 B) | 8×200，3–75 ms |
| 21:37:58 / 21:38:08 | 我的页 ×2 | checkin/badges, pk/mine, reminders, growth, mistakes | 10×200 |
| 21:38:07 | 登录 | `POST /api/auth/wxlogin` | **503**（已登记） |
| 21:38:12–21:39:22 | 练习 ziliao/changshi/shuliang 三组 | questions, notes, favs/status, comments/count, practice/progress, answer_log×11, mistakes×11 | 全 200，≤35 ms |
| 21:39:49 | 错题详情 | `PATCH /api/mistakes/2923` | 200（error_reason 第 7 条写入点，§4） |
| 21:40:02 / 21:40:09 起 | AI 讲解 ×2 | `POST /api/explain/stream` | 200，**41.5 s / 41.7 s**（12.8 / 14.8 KB，LLM 推理时长，R421 口径；两次是否同题不可知——POST 体不在日志） |
| 21:40:10–21:42:44 | 统计页 ×7 次进出 | 同上 6 GET 束 | 42×200，3–85 ms |
| 21:41:25–21:41:48 起 | **AI 错题分析 ×4 并发** | `POST /api/mistakes/analysis` | 200，19.7 / 22.9 / 31.3 / 39.8 s（§1.5） |
| 21:42:17 / 21:42:23 | **周报** ×2 | report/weekly(506 B) → next_event → read | 6×200，3–10 ms |
| 21:42:44–21:43:08 | growth 单独 ×6 | `/api/growth` | 6×200，6–85 ms（我的页反复 onShow） |

`.sheet-x`/旧壳：小程序不加载 H5 壳，本会话与 (c) 口径无交集。

## 4. error_reason 第 7 条

```
uid=umst3tui… question_id=296322 error_reason='纯蒙的' created_at=1788730784.9 (09-06 21:39:44Z)
```
对应 21:39:43 练习 shuliang 组 `question_id=296322` 作答 → 21:39:44 `POST /api/mistakes` → 21:39:49 `PATCH /api/mistakes/2923`（写原因）。内容为用户自填 3 字，非模板/非空串；该 uid 28 条错题 / 2 已掌握 / `review_log` 1 行（`review_log` 无 `question_id` 列，经 `mistake_id` 关联）。

## 5. 处置

| # | 项 | 处置 |
|---|---|---|
| 1 | R460「H5 会话」 | **勘误**，两处文档加指针；结论其余不变 |
| 2 | W6/W7 小程序 `onAiAnalysis` 无 in-flight 守卫（4 并发 LLM） | **不动他人分支**；评论 PR #636（含 #634）给出一行修法 `if (this.data.aiHtml \|\| this.data.aiLoading) return;` + 本文链接；main/#619 无此代码 |
| 3 | W7 `cn-date.ts` 热力图合计 `−83` | 同上评论登记（R460 ② 同类） |
| 4 | `explain/stream` 41 s、`mistakes/analysis` 20–40 s | LLM 推理时长，R421/R424/R399 已登记通道取舍；**不改** |
| 5 | (c) / 到期项 | 继续挂，无新样本 |
| 6 | 宿主盘 92% / `www.zalize.com` 证书 10-04 / `WX_MINIAPP_SECRET` | 待老板定，无进展 |

## 6. 未验证 / 限制（如实）

- 「设备运行 W6 分支构建」是按接口集合与 `git grep` 的**一致性推断**，日志无小程序版本号；哪个 commit、体验版/开发版不可知。
- 空态判断按响应字节推断，未见真机渲染。
- 4 次 analysis 并发归因于「关面板再点」是按源码守卫缺失 + 起点间隔推断，无客户端埋点证明用户手势；也不能排除小程序框架层重试（W6 `request` 无重试逻辑，已读）。
- `explain/stream` 两次是否重复请求同题不可知。
- 会话页面归组按接口束推断（与 W6 页面源码对照），非客户端路由日志。

## 7. 一手命令

- `/home/ubuntu/r461_probe.sh`（容器/health/(c)/vivo 会话/DB 只读）→ `r461_probe.out`；`/home/ubuntu/r461_ua.sh`（会话 UA/Referer/IP 归组）。
- 分支比对：`git grep -l <path> origin/devin/w6-mp-parity -- miniapp-native` 等 10 路径 × 4 分支；`git show origin/devin/w7-mp-flat-v3:miniapp-native/miniprogram/pages/book/book.ts`。
