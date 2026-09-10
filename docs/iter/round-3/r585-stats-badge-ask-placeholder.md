# R585：统计页冷加载同步错题本角标 + AI 问答底部输入条 placeholder 收短（H5 only，0 后端）+ R584-1 旧测试残留清账

> 口径：只写一手证据；「验证过 / 未验证 / 推断」逐项分开。生产后端全程 `ec8206e5`；Pages `index-DEX103Q0 → index-tCexIcFM`。

## 0. 研究（只读）

### 0.1 宿主只读探测（`~/r585/q585a.sh`，剔 `X-Kg-Probe` + harness UA/IP）

```
LOAD ['10.57', '12.50', '14.99']   MEM_MB {'MemTotal': 1935, 'MemAvailable': 173}   DISK_USED_PCT 88.6
HEALTH {"ok":true,"rev":"ec8206e5"} 0.369s   WINDOW_H 167.6h  POST_N 6569
/api/practice_result     NAT {200: 4}   HAR {500:2, 200:223, 400:2, 503:7, 502:1}
/api/answer_log          NAT {200: 53}  HAR {200:3292, 503:96, 0:13, 502:1, 500:1, 429:31}
/api/daily_set/submit    NAT {}         HAR {400:1, 200:50, 503:1}
/api/practice/progress   NAT {200: 29}  HAR {200:2657, 503:41, 502:2}
/api/merge_anon / favs   NAT {}
```

自然 `POST /api/practice_result` 非 2xx / status 0 仍为 **0**（非 2xx 全部 harness）→ **R580-1 继续登记不实施**。未 kill、未叠 build、未改配置。

### 0.2 R584-1 旧测试残留清账（`~/r585/clean585.py` 经 SSH stdin 宿主执行，`ro → clean → ro`）

- `ro 'test-%'` 全景 41 个 uid；剔除保留集 `test-r562-modal-a/b`（共享 fixture 42 行）、`test-r567-shots-375`、`test-r584-shots`（别轮已清 / 本轮走查）→ 精确目标 **37 uid**（`~/r585/uids585.json`，`IN (...)` 精确匹配，不按前缀删）。
- 归属核查（只读）：9 条 `pk_matches`、1 个测试建的 `teams`（id 26，`creator_uid`）+ 1 条 `team_members`、8 条 `shared_questions` + 1 条 `shared_answers`（列名 `share_id`）、1 条 `interview_sessions`、1 条 `reminder_prefs`、5 条 `practice_progress`、6 条 `exam_progress`，均为测试 uid 自有，无非测试用户交叉引用。
- before：552 行 / 16 表（mistakes 46 · practice_results 6 · answer_log 273 · exam_attempts 32 · review_log 2 · interview_sessions 1 · pk_matches 9 · teams 1 · team_members 1 · shared_questions 8 · shared_answers 1 · growth_events 159 · reminder_prefs 1 · daily_set_entries 1 · exam_progress 6 · practice_progress 5）。
- clean 那次 stdout 为空（JSON 回执缺失，原因未查明）→ **独立再跑 `ro`**：37 目标 uid 命中 `{}`、共享 `test-r562-modal-%` **42 行保持**、保护表 digest 前后一致。以独立只读结果为准，不以 clean 回执为准。
- 脚本教训：共享计数不能复用带 37 个绑定的 `where()`（`Incorrect number of bindings`），改为每 uid 列一个 `LIKE ?`。

### 0.3 375 走查（`~/r585/walk585.py`，uid `test-r585-shots` 10 答 8 错；首页 / AI 问答 / 统计 / 我的）

命中两条用户可感知、一手可证的小缺陷：

1. **统计页冷加载不刷错题本 tab 角标**：首页 / 错题本 / AI 问答页都在拿到到期数后调 `setBookBadge()`（`tabbar-badge.js`），统计页 `loadReco()` 拿到 `/api/review` 真实回包只写 `dueN`，不同步角标 → 直接冷进统计页（深链 / 刷新）时底栏错题本无角标，切到别的 tab 才出现。
2. **AI 问答底部输入条 placeholder 被截断**：输入框可用宽 360/375/390 = **99 / 114 / 129px**（`.ib-inp .uni-input-input` 去 padding），字体 13px；原文案 canvas 实测「先拍题或粘贴题目开始」**130px**、「对讲解有疑问？追问 AI…」**147px**，三档全部超宽（375 实拍尾字被裁）。

## 1. 设计论证

- 角标：复用 `setBookBadge(due)`，只在 **真实回包**（`!noteSnapshot(d)` → `dueSynced = true`）之后调用；旧快照兜底（R572 口径 `dueSynced = false`）与请求失败一律不碰角标；`total = 0` 允许清角标（`badgeText(0) === ''` → `removeTabBarBadge`）。不改 `loadReco` 既有结构（R572 / R583 源锁测试要求 `if (!this.noteSnapshot(d)) {...} else {...}` 逐字保留），badge 调用放在该结构之后。
- placeholder：只改两条字符串，不动输入行为 / `disabled` / `confirm-type`；空态「拍题或粘贴题目」（91px）、追问态「有疑问？追问 AI」（95px）均 ≤ 最窄 99px。

## 2. 实修（commit `9454e24e`，PR #763）

- `frontend-uni/src/pages/stats/stats.vue`：`import { setBookBadge } from '../../tabbar-badge.js'`；`loadReco()` review 分支 `if (this.dueSynced) setBookBadge(this.dueN);`
- `frontend-uni/src/pages/ask/ask.vue`：`:placeholder="results.length ? '有疑问？追问 AI' : '拍题或粘贴题目'"`
- `frontend-uni/tests/r585-stats-badge-ask-placeholder.test.js`：源锁 + 抽出 `loadReco` 体动态执行——真实回包 `setBookBadge(8)` 恰 1 次 / `total 0` → `setBookBadge(0)` / 旧快照 0 次 / 请求失败 0 次 / 新文案 ≤ 99px 估算、旧文案 > 114px。
- 第一版把 `setBookBadge` 写进 `if` 块内 → R572 源锁测试 FAIL → 改为块后调用（如实）。

## 3. 本地门

```
npm run lint            0 error
npx vitest run          Test Files 202 passed (202) · Tests 1571 passed (1571) · 23.62s
npm run build:h5        index-tCexIcFM.js
git diff --check        空
```

## 4. 发版（Pages only，`~/r585/pages_deploy.sh`，wrangler 4.129.1）

线上 `index-tCexIcFM.js` 与本地同名；health 前后 `{"ok":true,"rev":"ec8206e5"}`；`PAGES_DEPLOY_OK`。后端未动。

## 5. 生产复验（`~/r585/verify585.py`，CDP 生产真实请求，uid `test-r585-v1` 10 答 8 错；截图 `~/r585/verify/{375,1440}-*.png`）

| # | 场景 | 375 | 1440 |
|---|---|---|---|
| A | `about:blank` → 冷进 `#/pages/stats/stats`：错题本 tab 角标 | 1.2s 角标「8」与「8 题今日待复习」同 tick 落地 → **PASS** | 2.0s 「8」→ **PASS** |
| B | 首页角标 8 → 切统计，`/api/review` 回包被改成 `total:0` | 角标 **清空（null）** → **PASS** | 同 → **PASS** |
| C | 首页角标 8 + 本机 `apiSnap:/api/review?uid=…` 快照改成 `total:3` → 阻断 `/api/review` → 切统计走旧快照 | 角标仍 **8**、到期行「到期数需网络恢复后同步」→ 旧快照未刷角标 **PASS** | 同 → **PASS** |
| D | AI 问答空态 placeholder | `.uni-input-placeholder` 「拍题或粘贴题目」scrollWidth 114 = clientWidth 114、`truncated:false`、canvas 91px ≤ 114；追问文案 95px ≤ 114（≤ 360 档 99）；旧文案 130 / 147 → **PASS** | avail 786，全部 fit → **PASS** |

- API：375 52 条 / 1440 52 条全 2xx；唯一 `requestfailed` + console error 各 1 条为 **C 场景我主动 `route.abort('failed')` 的 `/api/review`**（harness 注入，非自然失败）；pageerror 0。
- 复验口径纠正（如实）：第一版脚本 `.uni-tabbar__item:nth-child(3)` 点到的是**错题本**不是统计（B/C 第一遍结果无效，改 `:has-text("统计")` 重跑）；`uni` 不是 window 全局，C 改为直接改 localStorage 快照 + 阻断请求。
- B 场景 fulfill 的 `total:0` 回包会被 `snapSave` 写进本机快照（C 里看到的快照 `total:0` 即来自 B），是 apiSnap 设计使然，非缺陷。

## 6. 清理

- 复验 / 走查 / 量测 uid `test-r585-v1` `test-r585-shots` `test-r585-ph`：`ro` 63 行（mistakes 16 · practice_results 2 · answer_log 20 · growth_events 23 · daily_set_entries 2）→ `clean` 逐表相等 63 → `ro` `{}`；共享 42 → 42；保护表 digest 一致。
- R584-1 37 uid 552 行见 §0.2，after `{}`。

## 7. 验证过 / 未验证

- 验证过：A–D 两尺寸；本地门四项；Pages 产物同名；清账 after `{}`。
- **未验证**：追问态 placeholder 在真实结果列表下的渲染（需真实 AI 调用，本轮只在同字体下 canvas 量测 95px）；360px 真机（可用宽 99px 为 R585 研究阶段浏览器量测）；登录态统计页（同函数）；小程序端（统计页角标 / 问答 placeholder 未改）；小程序真机（R536-1 累计）；真 SW/offline、其它浏览器、跨设备。
- 推断：清账 clean 回执为空的原因（可能 `timeout 170` 与 552 行删除 + digest 计算叠加，未复现）——以独立 `ro` 为准。

## 8. 登记

- **R585-1**（P3）`clean585.py` clean 模式回执偶发为空 → 下一轮把 digest 计算移到 `ro` 侧或拉长 timeout，clean 只打印删除计数。
- R584-2 / R584-3 / R580-1 继续等样本不主动改。
