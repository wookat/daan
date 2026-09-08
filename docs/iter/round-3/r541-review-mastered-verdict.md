# R541：实现轮——复习作答判定消费服务端 `mastered`（连对达阈值的错题不再显示「下次复习：30 天后」，改为「已掌握，移出复习计划」+ 完成小结「达成掌握 N 道」；H5 + 小程序同口径）；生产 `cc3d6de0 → 74a5d62a`

日期：2026-09-08（UTC 12:1x–12:5x）。分支 `devin/1788870073-r541-review-mastered-verdict` 从合入 #677 后的 main 另开。统筹者指令：R539 实现轮方向正确，继续按四维对标粉笔错题本/夸克的 P0/P1 用户可感知功能转实现并生产复验，避免连续取证-only 轮。

## 0. 立项依据（本轮一手，主循环「复习 → 掌握」段）

对标口径：粉笔错题本 / 夸克「已掌握」态在复习作答后**即时**告知用户「这题已掌握、不再复习」，并把它从待复习里拿走；本站服务端早有同等语义（SRS 连对超过 5 档即 `mastered=1` 并从到期队列剔除），但两端客户端**没消费**这个回包字段。

| 事实 | 一手 |
|---|---|
| 服务端 `POST /api/review/{mid}` 回 `{"streak", "next_review_days", "mastered"}`；`REVIEW_INTERVALS_DAYS=[1,3,7,15,30]`；`mastered = 1 if streak > 5`；`mastered=1` 行从 `due_reviews()` / `due_review_count()` 排除 | `backend/app/db.py _advance_review`（生产容器内 `inspect.getsource` 同行：`~/r541/post3.out` D2）|
| H5 `book.vue` 复习判定行只消费 `streak` / `nextDays`，掌握与否一律拼「（下次复习：N 天后）」；小程序 `book.wxml` 同形态（`rStreak` / `nextDays`），`ReviewRecordResp` 类型里**没有** `mastered` 字段 | 改前源码（见 §2 diff）|
| 本地 `:8525` 真 API 连答 6 次：第 6 次回 `{"streak":6,"next_review_days":30,"mastered":true}`，随后 `GET /api/review?uid=` `total 0` —— 改前 UI 却显示「答对了！连对 6 次（下次复习：30 天后）」 | `~/r541/local_flow.out` |
| 用户可感知后果：第 6 次答对被告知「30 天后再复习」，但该题当场已被移出复习计划，之后永远不会再出现在到期队列；「已掌握」只能事后去错题本 tab 里发现。复习完成小结也不告知本轮有几题达成掌握 | 推断自上两行事实（改前无用户反馈样本，见 §5「如实」）|

结论：P1（反馈与真实状态相反，位于主循环终点），最小修法 = **客户端消费已有回包字段**，服务端 SRS 规则 0 改动。

## 1. 设计论证

- **只消费不改规则**：`mastered` 已由服务端按 SRS 一处判定并落库，客户端只做展示；不在前端复算「streak ≥ 6」（避免两处阈值漂移）。严格 `res.mastered === true` 才进掌握态，`undefined`/字符串/1 一律 fail-closed 走普通文案（老后端无键 → 行为同改前）。
- **判定文案**：掌握态 = 「答对了！连对 N 次 · 已掌握，移出复习计划」，**不再拼**「（下次复习：N 天后）」（那个 30 天是 SRS 公式的副产物，不是真的会再排）；`extra`（加练同类题）优先级最高——加练题不走 SRS 回包，不会出掌握文案；`requeued`（本轮答错后重出再答对）streak 已被服务端归 1，不会同时为 `mastered`，顺序上仍把 `mastered` 放在 `requeued` 之前以服务端为准。答错 / 普通答对 / extra / requeued 四种既有文案逐字不变。
- **单一纯函数**：H5 `review-summary.js` 新增 `reviewVerdict({extra, requeued, wasCorrect, streak, nextDays, mastered})`，模板原 6 行三元表达式收成 `{{ verdictText }}` computed；小程序新增 `utils/review-verdict.ts` 同签名（沿用两端既有措辞差：H5「讲解」+「✓」，小程序「解析」无勾号——不在本轮统一，避免无关 diff）。
- **完成小结**：`reviewSummary()` 加 `mastered` 计数（`!x._extra && x._mastered === true`），H5 完成弹层多一行「达成掌握 N 道 · 已移到「已掌握」，不再安排复习」，N=0 不渲染；小程序 `onNextReview()` 结束时同法算 `celebrateMastered` 进弹层。
- **断点续做**：H5 快照里 `rItems` 整项序列化（`_streak`/`_mastered` 随之落盘），恢复时 `streak = rItems[rIdx]._streak`（改前恢复只回 `nextDays`，`streak` 留 0 会显示「连对 0 次」）；小程序 `RItem` 加 `streak?`/`masteredNow?`，`review-snap.ts` 不改 schema（item 额外字段随 JSON 存取）。
- **命名**：小程序 `Mistake.mastered` 是列表/DB 的 `number` 状态字段，回包布尔态另取 `masteredNow`（把 `mastered?: boolean` 加在 `RItem extends Mistake` 上会 TS2430）。

## 2. 实修（1 commit `74a5d62a`，5 文件改 + 3 新增）
- `frontend-uni/src/review-summary.js`：`reviewVerdict()` 新增；`reviewSummary()` 加 `mastered`。
- `frontend-uni/src/pages/book/book.vue`：模板 `{{ verdictText }}`；computed `verdictText`；答题回包写 `cur._streak` / `cur._mastered = res.mastered === true`；快照恢复回填 `streak`；完成弹层加掌握行。
- `miniapp-native/miniprogram/api/types.ts`：`ReviewRecordResp.mastered: boolean`。
- `miniapp-native/miniprogram/utils/review-verdict.ts`（新）：typed `reviewVerdict()`。
- `miniapp-native/miniprogram/pages/book/book.ts`：`RItem.streak/masteredNow`；`rVerdict`/`celebrateMastered` data；`verdictFor()`；回包写 item + `setData`；`onNextReview()` 统计。
- `miniapp-native/miniprogram/pages/book/book.wxml`：判定行 `{{rVerdict}}`；完成弹层掌握行。
- 测试：`backend/tests/test_r541_review_record_mastered_contract.py`（第 1–5 次 `mastered:false` + 各档天数 / 第 6 次精确 `{"streak":6,"next_review_days":30,"mastered":true}` / 强制到期后不在 `due_reviews`）；`frontend-uni/tests/book-r541-review-mastered-verdict.test.js`（verdict 五态 + fail-closed + 非法数值 / `reviewSummary().mastered` / 快照保留 `_streak`/`_mastered` / H5 与小程序源锁：模板、回包写入、`ReviewRecordResp.mastered`、`celebrateMastered`）。

## 3. 门（本地全绿，Actions 按公司规则禁用）
- backend：pytest **599**（+1）/ ruff / pyright 0（`~/r541/gate_be.out`）。
- frontend：vitest **144 文件 978**（+12）/ eslint 0 error / tokens / `build:h5` bundle `index-B_AVZd0x.js → index-ZYsItKK5.js`（`~/r541/gate_fe.out`、`build_h5.out`）。
- miniapp：`tsc --noEmit` 0 / `ESLINT_USE_FLAT_CONFIG=false eslint --ext .ts` 0 error（`~/r541/gate_mp.out`）。
- `git diff --check` 空。
- 本地 `:8525`（rev `cc3d6de0` 老后端 + 新 helper）隔离 uid 连答 6 次：第 1–5 次「答对了！连对 k 次（下次复习：1/3/7/15/30 天后）」，第 6 次「答对了！连对 6 次 · 已掌握，移出复习计划 ✓」，`due after master: 0`，隔离错题已删（`~/r541/local_flow.out`）。

## 4. 发版与生产复采（`~/r541/pre.out` / `deploy.log` / `post*.out`）
- 预检 12:38:44Z：load 1.44 / `/` 4.0G(92%) / MemAvailable 380 MB / 兄弟构建 0 / 容器 healthy 0 重启；DB `1324/360/37/38/82`、WAL `4,173,592`。
- `deploy_h5.sh --skip-build` 12:39:01Z：谱系闸 OK（线上 `cc3d6de0` 是 HEAD 祖先）→ rsync → 预热 23 项全 200 → compose Recreate 12:39:14Z 起、新容器 **12:42:11Z** 起、`KG_COMPOSE_EXIT rc=0` 12:42:30Z（3.3 min）→ 线上 rev `74a5d62a`、bundle `index-ZYsItKK5.js` 与本机一致、6/6 回归 200；6b `/` perf 0.93 / a11y **1.00** / bp 0.96 / seo 1.00 / LCP 2806 / CLS 0.06，`/tiku/` 全 1.00 / LCP 881；`DEPLOY_RC=0`。
- 复采 12:45–12:47Z：容器 healthy 0 重启 `oom=false`；`/api/health` `{"ok":true,"rev":"74a5d62a"}`（边缘域 200 / 0.09 s；`kaogong-origin` 直连无边缘头 403 为 R388 既定守卫）。
  - **A 只读契约**：`GET /api/review?uid=` 三个真 uid `total 30/8/3`、`items` 20/8/3、其中 `mastered` 行 **0**（服务端确已把掌握行剔出到期队列）、不存在 uid `0/0`。
  - **A2 掌握契约（部署后容器代码 + 隔离库 `/tmp/r541.db`，`TestClient` 带探针头）**：第 1–5 次 `mastered False` 天数 `1/3/7/15/30`，第 6 次 `{'streak': 6, 'next_review_days': 30, 'mastered': True}`，强制到期后 `GET /api/review` `total 0`；临时库 + wal/shm 已删（`tmp removed: True`）。0 LLM、0 生产写入。
  - **B 生产库只读**：`1324/360/37/38/82` 与预检同、WAL 同字节；`mistakes.mastered=1` 2 行、**`max(review_streak)=2`**、`streak≥5 且未掌握` 0 → 生产至今**没有任何一题经复习连对到阈值**，新文案暂无自然触达样本。
  - **C Caddy 12:39Z 起**：477 请求，**5xx 43**——全部落在 12:41:58–12:42:38Z（39.5 s，旧容器停 → 新容器 healthy 的 Recreate 窗，R457 已知形态）：42 × 503 `/tiku/q/*` = 09:34Z 起持续抓取簇（39 IP、Win/Mac 同 UA 对）、1 × 502 `/api/*` `curl/7.81.0` = 部署脚本自身 rev 轮询（`deploy.log` 的 `rev=?` 那次）；非探针非 GET 1 条 `POST /api/track` 与 `/api/review/cur` 2 条均为本机 6b Lighthouse（`140.232.64.4` 探针网段、moto g 仿真 UA）。窗后 5xx 0。新容器 app-log 5xx/Traceback 0。
  - **E H5 静态**：线上 `/` 引用 `index-ZYsItKK5.js` + `pages-book-book.CADBJ7-G.js`；在线拉取该 chunk 200 / 82,246 B，含「移出复习计划」×1、「达成掌握」×1。
- (c)：簇 09:34Z 段至 12:42Z 仍在跑（Recreate 窗 40 s 内 42 次 `/tiku/q/*`，折 ~63/min）；09-09 日界未到。

## 5. 如实 / 未知 / 登记
- **事实**：服务端契约（本地 + 部署后容器隔离库两处一手）、H5 helper 输出、线上 chunk 含新文案、生产 0 写入。
- **未验证**：H5 页面端到端（复习卡真实点击 → 判定行渲染 → 完成弹层）在生产未录屏（未授权 testing agent）；小程序改动只有 tsc/eslint/源锁一手，**未上真机**（R536-1 上传通道仍缺）；快照恢复只有纯函数 + 源锁测试，未在浏览器实际中断/恢复。
- **推断**：「用户会被 30 天文案误导」为对比服务端状态推出，改前 0 用户反馈（生产 `max(review_streak)=2`，无人到过阈值）。
- **Recreate 窗 5xx**：本轮 43 条全是抓取簇 + 脚本自轮询，0 真人；但只要簇持续抓 `/tiku/q/*`，每次发版 40 s 窗必然产出数十条 503（R539 窗内簇恰好未命中 → 0）。R457 结论不变（compose Recreate 无零停机），不新立项。
- **R541-1（P2，等真人样本）**：粉笔在「已掌握」态还提供「恢复复习」一键回流——本站错题本「已掌握」tab 已有「恢复复习」（R538 核过），完成弹层里未放直达入口；等首个自然 `mastered` 样本后再看是否需要。
