# R483：分享页首屏折叠只读核（登记）+ 时政题号撞号污染行测统计/错题渲染（写入侧修复 + 可逆回填）

> 生产 `948d351`（R482）→ 本轮 `df9d6be`。取证时间 2026-09-07 07:50–08:20Z。全部只读查询走生产 SQLite `?mode=ro` + Caddy 访问日志 + 公网 H5 域 API；量测流量带 `X-Kg-Probe: 1`，0 库写入。

## 0. R482 发版后 (c) 补量 + 到期项（07:52Z）

| 项 | 值 |
|---|---|
| 容器 | healthy · restarts 0 · started 07:46:08Z |
| 应用日志 Traceback / locked / disk full | 0 / 0 / 0 |
| 容器起后请求 | 47 2xx · 1 3xx · 5xx 0 · `/assets/*` 404 0 |
| `POST /api/monitor/report` | 4 条，全部本机出口 + 探针头（R482 复验的合成事件）；**非探针 0** → R482 上线后真人 monitor 行未再出现（观察窗 ~30 min，样本不足以下「过滤生效」结论） |
| 小程序 UA / Referer `servicewechat` | 0 |
| 非探针 `mistakes/analysis` / `explain/stream` | 0 / 0 |
| `umst3tuisd7lgzaka` 回访 | 0 |
| `mistakes.error_reason` 非空 / ≥09-11 | 7 / 0（R482 起用错表：`answer_log` 无该列） |
| push_subs / weekly_reports / exam_attempts probe=0 | 0 / 2 / 1 of 64 |
| WAL | 4,124,152 B（同字节） |
| 宿主 | `/` 90% · 5.2 G avail · load 7.8（16:11 CST，65% iowait，swap 2.3 G；一个 buildkit 容器内 `pip install` 在跑，非 kaogong） |

## 1. 分享页「看了没答」——首屏折叠一手（登记不改）

分享码 `fqpexz7g`（id 29，qid 283184，创建者 `umst3tuisd7lgzaka`，`open_count` 2）。候选真人 `141.11.46.193` VivoBrowser 08:55:46Z 打开 → `share_open` track + `GET /api/share/*` 200 → 3 min 26 s 后首页 state 全套读 → 未作答（`shared_answers` 0 行）→ 10:43Z 回访一次仍未作答。

生产 CDP（`/home/ubuntu/r483_fold.py`，接现有 Chrome，探针头，不点选项）量四个视口首屏内作答控件可见性：

| 视口 | from-bar | 题干 | A | B | C | D |
|---|---|---|---|---|---|---|
| 360×740 | 56–119 | 168–523 | 全 | 全 | 全 | 全 |
| 375×667 | 56–122 | 173–543（h 370） | 全 | 全 | **半** 655–698 | **折下** 705–749 |
| 360×640 | 56–119 | 168–523（h 355） | 全 | 全 | **半** 631–673 | **折下** 679–721 |
| 412×915 | — | — | 全 | 全 | 全 | 全 |

判定：该题题干 8 行（370 px），在 667/640 高视口下 C 半露、D 折下，A/B 始终可见、「先作答，再看答案」提示始终可见 → 用户看得到「这是要作答的」，只是长题干需滚一屏。R450 审的是字号/热区（均达标），首屏折叠是长题干的自然结果，不是控件缺陷；候选真人 n=1、放弃 vs 缺陷不可分 → **登记，不改布局**（缩题干字号/折叠题干都会伤可读性，且 R471a 教训不动 display 流）。

## 2. 命中：时政题号与 questions.id 撞号（修）

### 2.1 现象（生产只读一手）

- `shizheng_questions` 140 行，id 1–11180（独立自增）；`questions` 同区间 id 全部存在。
- `answer_log` `module='时政' AND question_id IS NOT NULL` **39 行**（probe=0 10 / NULL 19 / 1 10；6 个 uid）；`mistakes` 同条件 **3 行**（347/348/349，uid `umsagboriz4qyurnd`，08-04）。其余 22 条时政错题 `question_id` 已为 NULL（错题路径一直有 `_sz` 守卫）。
- 两表 `module` 取值只有 `changshi/panduan/shuliang/yanyu/ziliao/时政` 六种。

### 2.2 影响（用户可见）

1. **全站统计污染**：`refresh_question_stats()` 按 `question_id` 聚合、不看 module → 19 道行测题的 `attempt_count / correct_ratio / most_wrong` 全部（18 题）或部分（109）来自时政作答（如 qid 48 ziliao `1 / 0% / C`、86 yanyu `1 / 0% / C` 完全来自时政；109 panduan `2 / 50%` 一半来自时政）。这些数字在练习页「N 人做过 · 正确率」锚点和 SEO 题目页外显。
2. **错题本 / 复习流渲染错题**：`list_mistakes()` / `due_reviews()` `LEFT JOIN questions q ON q.id=m.question_id` → 真人 uid 的 3 条时政错题被套上资料分析/言语/判断题的 `options`、`hs_explanation`、`attempt_count`；`/api/mistakes?uid=umsagboriz4qyurnd` 生产回包一手核过 `question_text` 是时政题干、`options` 是行测题选项。
3. **SRS 跨题推进**：`save_answer_log_detail()` 答对时 `_find_open_mistake(qid)` 按题号找未掌握错题——答对时政第 48 题会推进同 uid 行测第 48 题的复习计划（反向亦然）；`save_mistake()` 按 `question_id` 去重会把时政错题并进同号行测错题（`times+1`）。生产 `review_log` 对 347–349 为 0 行，此路径尚未在真人数据上触发，但逻辑成立。

### 2.3 根因

- 客户端：H5 `practice.vue` 错题写入四处 `question_id: q._sz ? null : q.id || null`，但 answer_log 条目 `qid: q.id || null` 漏守卫；W7 小程序 `daily.ts logAttempts()` 同形态（`saveWrong()` 有守卫）。
- 服务端：`save_answer_log_detail` 原样落 qid（只在 module 非行测时不拿 questions 覆盖 module）；`save_mistake` 原样落/去重。

### 2.4 修法（`df9d6be`）

- `db.foreign_module_qid(module, qid)`：module 非空且不在 `VALID_MODULES` → qid 视为别表题号置 NULL；接入 `save_answer_log_detail`（先置空再查 questions / 推进 SRS）与 `save_mistake`（去重与落库都用置空后的 qid）。module 为空时仍信题号（questions 回查路径不变）。
- H5 `practice.vue` answer_log 条目 `qid: q._sz ? null : q.id || null`，与错题路径对齐；源锁 `tests/practice-r483-shizheng-qid.test.js`。
- W7 `daily.ts logAttempts()` 登记给 W7 分支（#619 不动 W7 文件）；服务端兜底已覆盖其上报。
- `scripts/r483_shizheng_qid_null.py`：dry-run 列行 / `--apply` 置空并把 `{表:{id:旧 qid}}` 落 json / `--restore` 还原。置空后 `refresh_question_stats` 既有 stale 分支会把只剩时政作答的 18 题统计清成 NULL（不手改 questions）。
- 单测 `backend/tests/test_r483_shizheng_qid.py` 4 例：规则、answer_log 置空 + 不跨题推进 SRS、save_mistake 置空 + 不与同号行测错题去重 + 读取侧无行测选项、回填脚本 scan/apply/restore。

门：pytest 508/508（+4）、ruff 0、pyright 0；vitest 721/721（+2）、eslint 0、build:h5 绿。

## 3. 部署与生产复验（生产 `948d351` → `df9d6be`）

### 3.1 发版

- 让行：07:5x–08:22Z 宿主 `/opt/SoftCopyrightAgent` 兄弟 `pip install` / BuildKit 在跑（load 6–8.6、iowait 65%、swap 2.3 GB、非 root 可用 4.5–5.2 GB），未 prune / 未 kill；08:22Z 起 pip 进程 0、load 3.9→2.9 才起 `DEPLOY_WAIT_SECS=1500 ./deploy/deploy_h5.sh --skip-build`（dist 已在本地构建，后端改动由 4/6 `compose up -d --build` 重建）。
- 一次 rc=0：谱系闸 OK；4/6 轮询 24 次（~5.5 min，容器 `StartedAt` 08:29:42Z、`KG_COMPOSE_EXIT rc=0` 08:29:43Z）；5/6 线上 bundle `index-kGPUzEDT.js` → `index-3pg3VDhV.js` 与本机一致、各 Accept-Encoding 变体 OK；6/6 7/7 200；perf `/` 0.99·1.00·1.00·1.00 LCP 936 / `/tiku/` 1.00·1.00·1.00·1.00 LCP 963、CLS 0.06/0.00。`/api/health` rev `df9d6be`。

### 3.2 写入侧一手（探针，`X-Kg-Probe: 1`，写入 probe=1 行 2 条）

`POST /api/answer_log` 同一 uid 两条 `qid=48`：`module='时政'` → 落库 `question_id=NULL, submodule=NULL`；`module='ziliao'` → `question_id=48, submodule='增长率'`（questions 回查照常）。回包 `{"saved":2,"reviewed":[]}`，容器 Traceback 0。

### 3.3 历史回填（已执行，可逆）

1. 备份：容器内 `sqlite3.backup` → `/data/data.db.r483-before`（449,310,720 B，`quick_check ok`）；宿主盘 4.6 GB 可用。
2. dry-run：answer_log 39 行（uid×probe：u17 NULL×10 / u20 NULL×2 / umsagboriz4qyurnd NULL×4 / umsfy50iypy44yyk1 NULL×3 / **umst3tuisd7lgzaka probe=0×10（09-06）** / umtpnhrwbzwprmwhv probe=1×10）+ mistakes 3 行，与 §2.1 一致。34 个撞号 qid 里 26 个在 `questions` 存在。
3. 写前快照：26 题里 **19 题** `attempt_count/correct_ratio/most_wrong` 非空，且按 REAL_TRAFFIC 口径这 26 题的行测作答只有 qid 109 一条 → 其余 18 题的外显统计 100% 来自时政作答（如 48 `1/0%/C`、86 `1/0%/C`、45 `2/50%/D`），109 `2/50%/C` 一半来自时政。
4. `--apply --record /data/r483_shizheng_qid_null.record.json`：`answer_log 39/39`、`mistakes 3/3`；re-dry-run 两表 0 行；`quick_check ok`；record 589 B（`{表:{id:旧 qid}}`，`--restore` 可原样写回）。
5. 手动触发 `POST /api/admin/refresh_stats`（容器内 127.0.0.1，token 取容器 env 不落盘）：`updated: 911`，13.6 s。写后：26 题里只剩 **109 `1/100%/NULL`**（= 那 1 条真实行测作答），其余 18 题统计已被既有 stale 分支清成 NULL；`attempt_count>=1` 全站 911 = answer_log REAL_TRAFFIC distinct qid 911、且全部存在于 `questions`（口径自洽）。`mistakes` 时政 25 行 qid 全 NULL，347–349 题干仍为时政题干。
6. 容器 healthy 0 重启；app-log Traceback / locked / full 0；WAL 4,124,152 B 不变。

### 3.4 (c) 补量（新容器 08:29:42Z 起，Caddy `kaogong-origin` 34 请求）

全部本机（curl 19 / 部署 Lighthouse 12 / X11 Chrome 2）+ 探针 1，2xx 34/34；`/assets/*` 404 0、5xx 0、`/api/monitor/report` 0、小程序 UA/Referer 0、非探针 `mistakes/analysis` / `explain/stream` 0、`umst3tuisd7lgzaka` 0 回访。到期项：answer_log probe 0/1 = 33/142（+2 为本轮探针）、growth probe=0 20、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、shared_answers 4、ask_cur 5 —— 无增量。

## 4. 如实说明

- 分享页折叠为 Chrome 移动仿真（360/375/412 三宽 × 三高），非真机；候选真人的设备视口未知（V2405A 常见 1080×2400 → CSS 约 360×800，按表应四项全见）。
- 时政 39 行的写入端归属：10 行 probe=1 为探针；probe=NULL 19 行为 R374 加列前历史；probe=0 10 行（`umst3tuisd7lgzaka` 09-06）为 H5/小程序均可能，未按 UA 逐行归端。
- W7 小程序端修复未在本 PR；服务端兜底后其上报也会被置空。
- 回填只处理 `module='时政'` 且 qid 非空的行；`questions` 统计列未手改，由 `refresh_question_stats` stale 分支清空（§3.3 已核 18→0）。`data.db.r483-before` 与 record json 留在卷内，还原路径：`--restore` 或整库回滚；老板确认后再清理备份。
- `attempt_count>=1` 全站 911 与 R474 记的 781 不同口径（R474 未记 SQL 原文），本轮未复核差值来源，只核了 911 与 answer_log REAL_TRAFFIC distinct qid 全等。
- 写入侧复验为探针 uid（probe=1 行 2 条），非真人；umst3 那 10 行时政 probe=0 作答是本缺陷唯一非探针受影响样本（它对相关题统计的污染已随回填消失）。
- 无 testing agent 录屏（未另行授权）。
