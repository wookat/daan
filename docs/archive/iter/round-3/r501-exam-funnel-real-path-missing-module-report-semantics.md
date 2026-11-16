# R501：R500 发版后 (c) 补量 + 真人模考漏斗全历史一手 + 缺项卷在作答/报告/续考链路的口径核（只读，不改码）

日期：2026-09-08（UTC 09-07 16:xx → 09-08 01:xx）。生产 `ccdbf58`（R500）未变。

## 1. (c) / 到期项（`~/r501_post.sh` → `~/r501_post.out`，VPS 上只读）

- 容器 `healthy restarts=0 started=16:01:18Z`；新容器窗口 45 请求：5xx 0 / assets 404 0 / monitor 0 / Traceback 0 / mpUA 0 / 非探针非 bot 0 / 非探针 POST 0 / 401·403 0。
- 宿主 `/` avail 5.4 G，load 0.55；WAL 仍 4,124,152 B。
- DB：probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click` 真人 0、nudge 真人 0、`push_subs` 0、时政 qid 非空 0；R500 harness uid 落库 0 行。
- 卷库 `mods` 非探针首次触达：发版后 `/api/exam/papers` 非探针 **0**（探针 6）。

## 2. 真人模考漏斗（Caddy 全历史，非探针 = 无探针头 + 非探针网段 + 非 bot UA；`~/r501_funnel.sh` → `~/r501_funnel.out`）

| 步骤 | 非探针 | 探针 |
|---|---|---|
| `GET /api/exam/papers` | **11**（全部 `umst3tuisd7lgzaka`，09-06 00:11 / 08:34 / 21:37–21:42 四段） | 1,460 |
| `POST /api/exam/start` | **1**（umst3，09-06 21:41:58Z，paper 5「2025 年四川省考/选调《行测》」70 min） | 362 |
| `POST /api/exam/progress` | 3（21:42:02 / 05 / 06） | — |
| `POST /api/exam/submit` | **0** | 36,448 |
| `GET /api/exam/report/*` | **0** | 全部 |

唯一真人 attempt `#315`（`exam_attempts.probe=0` 仅此一行）：`picks={376655:B, 376656:B, 376657:C}`，`idx=3`，**开考 8 s 内答 3 题即离开**（21:42:06 回卷库列表 → 21:42:07 统计页 → 周报 → 个人页），与 R494 判定的同设备「点过不是做过」巡览节奏一致；同时段穿插 3 次 `POST /api/mistakes/analysis`（R475 已登记的客户端重发形态）。之后该 uid 09-07 02:27Z / 11:59Z 两段回访均未再进卷库。

`/api/exam/resume` 全历史 2,091 次：`{}` 2,052 / 有载荷 39（全探针）；umst3 的 29 次全为 `{}`——`latest_exam_progress()` 以 `started_at + duration_min*60 > now` 过滤，#315 于 22:51:58Z 超时后服务端即不再返回，前端 `adoptServerExamProgress()` 亦以 `end_at_ms <= now` 双保险；`list_exam_attempts()` 只列 `submitted_at IS NOT NULL` → 卷库「最近成绩」不会出现悬空的进行中行。**超时未交卷的 3 个 pick 静默丢弃、无任何痕迹**（登记，见 §4）。

## 3. 缺项卷（R500 外显的 69 卷）在作答/报告链路的口径（源码核，`exam_api.py` / `report.vue` / `exam-weak.js` / `insights.py`）

- `api_exam_submit`：`per_module` 服务端按 `judged["items"]` 逐题 `module` 归集 → **缺的模块根本不出现在 `per_module` 里**，不会出「资料 0/0」行。
- `report.vue modules()`：`MOD_ORDER.filter((k) => pm[k])` → 只渲染有数据的模块；`weakModule()` 只在 `PRACTICE_MODS ∩ 有行 且 n ≥ 3 且 pct 合法` 里比全站均值/最低正确率 → **缺项模块不可能被判薄弱**（fail-closed）。
- `paceRows`/`buildPaceRows` 按 `per_module` 题量占比折算参考用时 → 缺项卷的 70 min 全部分给已有模块，口径自洽。
- `insights.py exam_by_mod`：按 `pm.items()` 聚合、`answered` 为 0 跳过 → 缺项不入统计。
- 结论：**报告页对缺项卷无误判，但也无任何「本卷不含资料分析」说明**——「模块得分」卡 4 行看起来和整卷一样。登记不改：卷卡已在开考前外显 `缺资料`（R500），真人模考交卷 0，等有交卷样本再决定是否在报告页补一句。

## 4. 登记（不改码）

1. 报告页/成绩列表不提示卷子缺模块（§3）。
2. 超时未交卷的进度静默丢弃、无「上次模考超时」记录（§2）——唯一真人样本只答 3 题、8 s，无损失可言；不为 1 个巡览样本加功能。
3. 真人模考漏斗 11 → 1 → 0：卷库真人触达只有一台设备四段巡览，**没有证据支撑任何模考侧改动**（含「国考分区」「成套补卷」）；下一处功能面选题应回到真人有量的路径（练习 → 错题 → 复习：probe=0 `answer_log` 53 行、mistakes、review）。

## 5. 如实

- 全部只读：未向生产发任何模考/作答/账号/LLM 请求；未跑 CDP；报告页缺项口径为源码核、**未造运行时用例**（真人交卷 0，路径不可达）。
- Caddy 只见 API（H5 静态在 Pages），「分包加载」一栏本轮未取。
- R500 部署后 `mods` 无真人触达，UI 效果仍只有 R500 CDP 一手。
