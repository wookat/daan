# R438 取证：复习到期「今天」口径——后端按复习时刻滚动 24 h vs UI 日历文案

日期 2026-09-06（UTC 15:3x–15:5x）。改动：`backend/app/db.py`（新 `cn_day_start()` + `_advance_review` 1 行）+ 单测 3（新）/ 1（改）；
前端不动、bundle `index-junWyPAm.js` 不变。部署 `fbcda82`。生产现存 29 行 `next_review` 对齐（可逆，`/data/r438-next-review-realign.json`）。

## 1. 起点与一手事实

### 1a 后端（只读源码）
- `REVIEW_INTERVALS_DAYS = [1, 3, 7, 15, 30]`；`_advance_review()`：`nxt = time.time() + days * 86400` —— **到期点 = 复习时刻 + N×24 h**。
- 到期谓词全部是精确时间戳：`due_review_count` / `due_reviews` / `_due_by_tag3` / 复习计划的 `next_review <= time.time()`。
- 「今天」的其他口径全部是中国日历：`cn_day()`（UTC+8 `YYYY-MM-DD`）用于连续天数、每日一练、今日统计；容器 `TZ=Asia/Shanghai`（`date` → CST）。

### 1b 前端（只读源码，`pages/book/book.vue`）
- `isDue(m)`：`!m.next_review || m.next_review <= Date.now()/1000`（精确时间戳，与后端一致）。
- 未到期标签：`days = Math.ceil((next_review - now)/86400)` → `days===1 ? '明天复习' : days+' 天后复习'`；到期文案「今日到期 / 今日待复习 N 题」。
- 复习完成 toast：「下次复习：N 天后」（`next_review_days`）。

### 1c 语义不一致（源码即可证明，不依赖流量）
UI 全部用**日历词**（今日/明天/N 天后），存储与谓词用**滚动 24 h**。以 1 天档为例：
- 09-06 08:00 复习答对 → `next_review` = 09-07 08:00；09-06 23:30 复习答对 → 09-07 23:30。
- 09-07 00:00–07:59 打开错题本：前者「明天复习」（其实几小时后就到期），08:00 后变「今日到期」——**同一天内早上清零、下午突然冒出待复习**。
- 后者在 09-07 全天显示「明天复习」，直到 23:30 才变「今日到期」——用户按「明天复习」在 09-07 白天打开会看不到它。
- 前端用浏览器本地时区、后端用 UTC+8：`Date.now()` 与 `time.time()` 都是绝对秒，**时区在这条链路上不参与计算**，日界差异不是时区问题，是「日历词 vs 滚动秒」的口径问题。

### 1d 生产只读抽样（`/data/data.db`，`mode=ro`，2026-09-06 23:39 CST）
- 活跃错题 273，`next_review` 非空 29（+ 本轮探针 1），已掌握 2。
- `next_review` 的 CST 小时分布：03 ×N（u26/u27 走查）、16:58（R425 vivo）、21:55、其它散点 → 全是**复习当时的钟点**，没有一条落在 00:00。
- 「按 CST 日历今天到期、但时间戳未到」此刻 **0 行**（23:39 已是当天末尾，抽样时刻不利于命中，不能据此说没有）。
- `review_log` 34 行、相邻间隔 9 个：<1 h 8 个（走查连点）、20–28 h 0 个 → **无隔夜复习的真人/候选样本**，无法用生产行为证明「有人遇到过」。
- R425 vivo 小程序（`umst3tuisd7lgzaka`，唯一 probe=0 设备）：`mistake 1952` `next_review = 2026-09-07 16:58:03 CST`、streak 0（答错重置 1 天档）。按改前口径，该设备 09-07 白天打开错题本会看到「明天复习」、16:58 后才「今日到期」。

**结论**：是源码可证的产品语义缺陷（P2：错题本状态在一天内不稳定、「明天复习」标签失真），**没有已发生的真人受害样本**（流量口径不足以出现隔夜复习）。修的依据是 1a–1c，不是流量。

## 2. 修法（最小、后端 1 行、前端不改）

```python
def cn_day_start(ts=None) -> float:   # 中国日历日 00:00 的 Unix 秒
    t = time.time() if ts is None else ts
    return float(int(t + 8*3600) // 86400 * 86400 - 8*3600)

nxt = cn_day_start() + days * 86400   # 原 time.time() + days * 86400
```
- 1 天档 = 「明天 00:00」（不论早晚复习），3 天档 = 「3 天后 00:00」，与 `cn_day()` 的连续天数/每日一练同一「今天」。
- 前端不动：`isDue` 谓词不变；`Math.ceil((nr-now)/86400)` 对 00:00 到期点在当天任一时刻都算出同一个整数天（08:00 → 16 h → 1；23:30 → 0.5 h → 1），标签自然正确。
- 不改 `due_*` 查询谓词（仍 `<= time.time()`）；不改错题重新写入时的 `next_review=time.time()`（立刻到期是有意的）。
- 为什么不选「前端按日历判 due」：那会让 `due_review_count`（首页角标/推送）与错题本两套口径，且需改小程序包；服务端一处对齐是最小改动。
- 为什么不选「后端查询按日历」：`next_review <= cn_day_end()` 会让 23:30 复习的题在 00:00 前就算到期（同天再到期），语义更差。

### 单测（本地 pytest 497 = 494 + 3；ruff 0；pyright 0）
- `test_r438_srs_day_aligned.py`：`cn_day_start` 在 23:30/08:00 CST 都回同一日 00:00；同日早/晚复习 → 同一到期点（次日 00:00 CST，`nr - 23:30 = 30 min`），到期前 1 s `due_reviews` 空、00:00 起两条都到期；5 档全部落 00:00 且 = `cn_day_start(now)+days*86400`，答错重置为明日 00:00。
- `test_answer_advance_review.py` 原断言 `next_review > now + 0.5 天` 改为 `now < next_review <= now + 1 天` 且 `% 86400 == 16*3600`（00:00 CST）。

## 3. 生产复验（`fbcda82`，容器内 `python3 -`）
- 部署 rc=0；`old-container-log` 快照 680 行；compose rc=0；`/api/health` `{"ok":true,"rev":"fbcda82"}`；healthy 0 重启；`TZ=Asia/Shanghai`。
- **实跑一次 SRS**（uid `r438-verify-srs`，`X-Kg-Probe: 1`）：23:45:11 CST 写错题 → `/api/answer_log` 答对 → `reviewed [{streak 1}]`，
  `next_review = 2026-09-07 00:00:00 CST`（`is_midnight true / is_tomorrow true / delta 0.25 h`），`answer_log.probe=1`；随后 3 表清理 LEFTOVER 0。
- **现存行对齐**（把未掌握且 `next_review` 非空的行 floor 到所在日 00:00，让已存在的错题也进入新口径、不留一批「下午突然到期」的旧行）：
  dry 30 候选 / 29 待改（1 是刚写的探针行）→ 原值 dump `/data/r438-next-review-realign.json`（29 行，`--restore` 按 `id+new→old` 回写）→ apply 29 → re-dry 0、`left_non_midnight 0`。
  涉及 10 个 uid（走查 u26/u27/u32/test-w4-mp + 6 个 `ums…` 含 vivo 设备 `1952: 09-07 16:58 → 09-07 00:00`）。对齐只把到期**提前到同日 0 点**，不会让任何题晚到期。
- 5 min 应用日志 Traceback/5xx/locked 0。
- 无 UI 改动、bundle 不变，不派 testing agent；标签逻辑用源码 + 数值断言（1c/2）覆盖。

## 4. 顺带：第一次跨容器应用日志复查（R437 归档）
`kaogong-reports/app-log/` 3 份快照（`3c451c9` 15:11–15:31 ×2、`83c7522` 15:32–15:42）共 3168 行：Traceback 0 / 5xx 0 / locked 0 / 非 access 行 warn|error|exception 0。
覆盖窗口只有 31 min（今天下午的重建都在 R437 之前），要到明天才有跨部署的完整样本。

## 5. 如实说明 / 未验证
- 「用户遇到过日界抖动」**没有生产样本**（review_log 无隔夜间隔），本轮修的是源码可证的语义缺陷，不是事故。
- 前端 `Math.ceil` 标签只用数值推演验证（1c/2），未在真机跨日观察；小程序 `miniapp-native` 同用 `next_review` 时间戳、语义同 H5，未单独核其标签代码。
- 复习完成 toast「下次复习：1 天后」在 23:58 复习时实际 2 min 后到期——文案与「明天」一致，接受。
- 对齐操作把 29 行到期提前 ≤23 h 59 min（多数早已过期无感）；如需回滚：`python3 - restore` 用 dump 回写。
- `cn_day_start` 固定 UTC+8（与 `cn_day()` 同），不读容器 TZ；产品面向中国用户，接受。
