# R579 · 每日一练中途退出后「继续」落在已答题（首页说第 4 题、进去是第 3 题的反馈态）—— 同轮 `merge_anon` 前后 `answer_log` 一手定性（R577-1）

分支 `devin/1789034915-r578-session-switch-reset` 续（链含 #742–#757）；**H5 + 小程序落点，0 后端**。

## 结论（先讲）

1. **R577-1 一手定性：`merge_anon` 不增不减 `answer_log` 行，且本轮 `/api/growth total.n` 与 `answer_log` 行数逐点相等（3=3、15=15），历史「恒 +1」未复现**。前后各一次只读快照（同一 SSH 只读 SQL，非 growth 接口）：匿名 `test-r579-m1` 3 行 → 合并后 0 行，目标 `u34` 0 行 → 3 行，qid 集合 `245604,283856,1273760` 逐字相同；`practice_progress 1 / growth_events 3 / mistakes 3` 同步迁移；`merged_anon` 记 1 行。源码 `merge_uid_rows` 对带唯一键的表 `UPDATE OR IGNORE` + `DELETE` 会**丢弃**冲突的匿名行——本实验目标账号事先 0 行，**未触发**键冲突分支（如实登记 UNTESTED）。R576 那次「+1」既不可回溯也未在本轮复现，**不据此改代码**，R577-1 降级为「已核一次未复现」继续观察。
2. **一手坐实一条用户可感知既有缺陷（本轮实修）**：每日一练答到第 3 题（答错，停在反馈态）从顶栏退出 → 首页 hero「继续今日一练 · 第 4/10 题」、续练卡「已做 3/10」；点「继续」却落在**第 3 题的错答反馈态**（顶栏 3/10、toast「第 3/10 题」），要再按一次「下一题」。首页按「已答数 + 1」算，练习页按快照 `idx` 原样落地，两处口径不同。
3. R578 修后再验：每日一练完成页 → 「练同考点」首题顶栏「判断推理 · 强化练习」、无上一场领跑横幅；强化完成页 → 「再来一组」首题顶栏「判断推理 · 类比推理」、1/10、无横幅——两条路径 375 PASS（源码推断升级为生产实拍）。
4. 自然样本：ec8206e5 后 `practice_progress`（daily/redo）/ `stale_fallback` / `question_favs` / `reinforce_log` 窗内仍 **0 新增**——只说「窗内无合格自然样本」。

## 研究（一手，生产只读 + 真实用户路径；`~/r579/q579.sh` / `q579m.sh` / `journey.py`）

### 宿主 / health

- `load 15–21`，`mem_avail 150–220MB`（total 1935），`disk 89%`，health `200 0.3–2.1s`；后端 rev 全程 `ec8206e5`。未 kill、未叠 build。
- 探针第一版查 `daily_set_results` 报 `no such table`——生产表名是 `daily_set_entries`（先读 `sqlite_master` 再写 SQL，R577 教训再犯一次）。

### 登录/合并链路（375，`journey.py`，连既有 Chrome CDP，`X-Kg-Probe: 1`，匿名 uid `test-r579-m1` → 注册手机 `19900000579` → `u34`）

| 时点 | anon `answer_log` | target `answer_log` | 其它（anon → target） |
|---|---|---|---|
| A 答 3 题后 | `3 / qids 245604,283856,1273760 / source daily×3` | `0` | pp 1 / ge 3 / mist 3 → 0/0/0 |
| B 注册提交前 | 同上 | `0` | 同上 |
| **B 合并后** | **`0`** | **`3 / 同 3 个 qid / daily×3`** | **pp 0/1 · ge 0/3 · mist 0/3**；`users` 1 行、`merged_anon(test-r579-m1)` 1 行、`auth_tokens` 1 |
| B 「我的」展示 | — | `3` | 页面「累计做题 3 / 错题本 3」= DB |
| C 续做完 10 题 | — | `10`（daily×10） | `daily_set_entries` 1 |
| C 强化 5 题 + 再来一组首题 | — | `15`（daily 10 + session-report 5） | 「我的」**累计做题 15 / 错题本 10** = DB |

- `POST /api/answer_log` 15 次全 200（3 次 anon、12 次 u34），无 429/重试重复；139 个 API 请求 0 非 2xx；console/pageerror 0。
- 说明：脚本里 `MINE FINAL 累计做题 = 10` 是**解析错误**（取到了「错题本 10」那格），`c6-mine-final.txt` 原文是「15 / 累计做题 / 10 / 错题本」——以原文为准。

### 续练落点（同一 run，`a3-quit-sheet` / `a4-after-quit` / `c0-home-logged` / `c1-resumed`）

- 第 3 题答 B（正确 A），停在反馈态从顶栏退出 → 保留进度 → 首页「继续今日一练 · 第 **4**/10 题」+ 续练卡「每日一练 · 今日全站同题 · 已做 3/10 题」。
- 点「继续」→ 练习页 `3/10`、题卡第 3 题 `国画∶油画` + 「正确答案 A · 你选 B」反馈态、toast「第 3/10 题」。用户要再点「下一题」才到第 4 题。
- 源码对账：`home.vue heroPrimaryText` = `done + 1`；`practice.vue adoptLocalPending` = `Math.min(s.idx, len-1)`；远端 `adoptPracticeResume` 同样原样取 `d.idx`；小程序 `practice.ts adoptPending` / `utils/practice-progress.ts adoptPracticeResume` 同型。

## 论证：为什么改、改哪里

- 用户可感知：首页明确承诺「第 4 题」，进去却是第 3 题的反馈（已知对错），多一次无意义点击，且与 toast「第 3/10 题」互相矛盾。停在「已答题反馈态」退出是每日一练最常见的退出时刻（答错想看解析→被打断）。
- 备选 ① 首页改显 `idx+1`（第 3 题）：首页与练习一致了，但「继续」仍落在已答题，用户体验不变；② 练习页落地跳到「其后第一道未答题」+ 首页显同一题号：一处纯函数 `resumeIndex(items, idx)` 两端共用，落地即可作答。选 ②。
- `resumeIndex` 规则：`idx` 未答 → 原地（不打乱用户主动回看的位置）；`idx` 已答 → 其后第一道未答；其后全已答（答题卡跳做）→ 从头第一道未答；全部已答 → 原位。远端快照 `_picked` 在 `picks` 映射里，谓词可注入。
- 首页 `parsePendingPractice / parseRemotePractice` 透出 `next`（1 基），hero 改用 `next`；`done` 保留给续练卡「已做 n/N」。小程序：落点同口径（`adoptPending` / `adoptPracticeResume`），首页续练卡本就只显「已做 n/N」不显题号，不加字段。
- 不改：pendingSession 写入格式、恢复 toast（本就按落地 `idx` 报）、错题重练/按卷/强化的 `idx` 语义（同一函数一体受益）。

## 实修

- `frontend-uni/src/practice-progress.js`：新增 `resumeIndex(items, idx, picked?)`；`parsePendingPractice` / `parseRemotePractice` 加 `next`；`adoptPracticeResume` 落点 `resumeIndex`。
- `frontend-uni/src/pages/practice/practice.vue`：`adoptLocalPending` 落点 `resumeIndex(s.items, s.idx)`。
- `frontend-uni/src/pages/home/home.vue`：hero「第 k/N 题」取 `r.next`。
- `miniapp-native/miniprogram/utils/practice-progress.ts` + `pages/practice/practice.ts`：同名 `resumeIndex`，远端/本机落点同口径。
- 单测：新 `tests/r579-resume-next-unanswered.test.js`（纯函数六规则 / 透出 next / 远端落点 / 源锁 / 小程序同结果），`practice-progress.test.js`、`r548-*`、`r557-*` 的精确对象断言补 `next`。

## 本地门

H5 `vitest 197 文件 1541` / `npm run lint` 0 error / `build:h5` OK（`index-BYl-YCS-.js`）；小程序 `tsc` 0 / `lint` 0 error / `vitest 82`；`git diff --check` 空；0 后端。

## 发版 / 生产复验 / 清理

（发版与复验回填见下节；R579 研究 uid `test-r579-m1` 与账号 `u34`（`19900000579`）及其 15 行 `answer_log` 等按精确 uid 清理，独立只读 41 表 0 残留——回填。）

## 登记

- **R577-1** → 「一次核实未复现」：本轮 `total.n == COUNT(answer_log)` 三个时点逐点相等；键冲突分支（目标账号已有同题行）UNTESTED。
- **R579-1（P3）** `growth_stats total.n = COUNT(*) answer_log`（含 `session-report` 强化）而「错题本」计 `mistakes`——两口径本就不同，不是缺陷，登记以免再误读。
- UNTESTED：远端快照跨设备真实恢复落点（仅单测 + 源码）、小程序真机（R536-1 累计）、`merge_anon` 键冲突分支、自然样本。
