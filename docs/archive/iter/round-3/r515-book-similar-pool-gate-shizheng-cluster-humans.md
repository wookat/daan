# R515：复习答错后「还不稳？练 3 道同类题巩固」→ 练习页 `practicePreset(submodule)` 375/1440 只读整页审 + 手录/时政（options 非法）加练卡旧形态一手 → 命中「时政错题露出同类题入口 → 练习页『该模块暂无题目』死路」→ `hasSimilarPool()` 门控三处；604 IP 匀速抓取簇仍在跑且**已灌进日报 humans**；W10 `test-w10-a1` 行核对更正

日期：2026-09-08（UTC 09-07 23:1x–23:4x）。分支 `devin/1788816465-r510-precache-practice-first`，PR #640 追加。
生产 `2d75ba53` → `22a38390`。

## 0. 结论

1. **(c) / 到期项 0 增量**：R514 容器整窗（23:02:39Z–23:33:44Z，1366 请求）+ R515 容器（23:33:44Z 起 238 请求）5xx/assets 404/mpUA/非探针 POST/Traceback 全 0、WAL `4,173,592` 同字节；monitor 1 行 = 探针（140.232.64.5 probe=1）；401/403 2 行 = 本轮发版预检 `GET /api/health` 直打源站主机名（无边缘头 → R388 设计 403，探针网段）。probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0；公告「详情」/`home_bundle`/`mistakes_total` 非探针触达 **无样本**。两容器窗内**非探针非 bot 557 行里 556 行是抓取簇**（§6），剩 1 行 `GET /tiku/t/YY-XJ-03/` 同 UA/`en-US`/无 Referer 形态。无新的外部真人证据。
2. **W10 行核对——更正 R514 的推断**：`user_profile` `test-w10-a1` `created_at` = **09-07 23:03:39Z**，边缘同秒有 `POST /api/profile 200 probe=1 140.232.64.5`（Δ 0.0 s）；本轮又新增 `test-w10-b1`（23:30:11Z，同样对上 probe=1 POST）。→ 这两行**都是经边缘、带探针头写入的**，不是「绕边缘直写」；R514 把 epoch `1788822219` 错换算成「09-06 23:03Z 早于本轮」（实为 09-07 23:03:39Z，R514 容器起后 60 s），边缘「0 条 POST」结论也随之失真（**推断**：当时只数了非探针 POST 或窗口截在写入前，未复核）。`user_profile` 无 `probe` 列仍是事实（看板/计数要人工剔），但「W10 绕边缘」这条推断撤回。`mistakes` 各 module +1～+5 行同样来自 `test-w10-*` uid 经边缘的探针写入（§6 pre2：`test-w10-a1/-cmp01/-h5vis-a/-mp` 在 `mistakes/answer_log/growth_events/review_log` 均有行，`answer_log` 全 probe=1）。
3. **604 IP 簇：仍在跑，且已进日报**：同形态（`GET /tiku/q/<id>` 200、`Accept-Language: en-US,en;q=0.9`、无 Referer、桌面 Chrome UA 14 种、每 IP ≤2 次）从 22:24:51Z 到取证末 23:38:44Z **连续 75 分钟无 >120 s 间断**，均值 14.8 行/分（峰 34），累计 **1110 行 / 1109 IP**。`crawler-stats.json`（cron 每小时，23:23:01Z 生成）已显示 **humans.page 09-07 = 757、humans.ips 09-07 = 761**，而前几天 page ≤7 / ips ≤9 —— **验证：日报 humans 已被灌水**（不是预测）。按 `crawler_stats.human_kind` 口径复算 09-07 UTC：page 1127 行里簇 1110、真人 IP 1121 个里「只出现在簇里」的 1109 个。归因仍只有请求头/节奏特征（无 IP 情报），剔除属口径设计变更，本轮登记不改（§7）。
4. **主路径（改前生产一手，`umst3` 真到期题 2784 定义判断，`/api/review` 桩 1 道，Q1 答错）**：「还不稳？练 3 道同类题巩固 ›」→ `uni.setStorage('practicePreset', {module:'panduan', submodule:'定义判断', count:3})` → 练习页 `GET /api/questions?limit=3&uid=…&module=panduan&submodule=定义判断` → 375/1440 首题 tags「判断推理 / 定义判断」、进度 `1/3`、结构化选项 4 项、3 题全定义判断、完成态无弹层/toast、`docSW==cw`、`pageerror []`；`practicePreset` 读后即清（`ls.practicePreset null`）。**正常，不改**。R514 登记的「加练 2 vs 练 3 道」口径差仍存在（既有，不动）。
5. **命中（改前生产一手，`umst3` 真到期题 2914 时政 `question_id null / options null`）**：时政错题答错后**同样露出**「还不稳？练 3 道同类题巩固 ›」；点击 → `practicePreset {module:'时政', submodule:null, count:3}` → 练习页 `GET /api/questions?limit=3&…&module=时政` → **「题目加载失败 / 该模块暂无题目，换个模块试试 / 重试 / 返回首页」**（375/1440 同）。同时答错即触发 `appendSimilar()` 发 `questions?limit=2&module=时政` 空回。根因：时政题走 `/api/shizheng/daily`，普通题库 `questions` 活跃 module 只有 `changshi/panduan/shuliang/yanyu/ziliao`（`module=时政` 0 行）；三处入口只判 `m.module` 非空。生产 `mistakes` 时政 27 行 / 8 uid **全部到期**、`question_id` 全 NULL、题干内嵌 A–D 行 → 真人一旦复习时政题答错就会走进这条死路。
6. **修**（`22a38390`，前端 2 文件 + 源锁 2 文件，后端/native 未动）：`review-similar.js` 新增 `hasSimilarPool(m)` = `m.module ∈ MODULE_KEYS`（`module-meta.js` 生成的行测五键，不另维护清单，fail-closed：时政/手录/`判断推理`/空/null/非对象皆 false）；`book.vue` 三处门控——CTA `v-if="!wasCorrect && similarableReview && !cur._extra"`（computed `similarableReview()`）、`appendSimilar()` 首行 `!hasSimilarPool(m)` 返回、错题操作单 `if (hasSimilarPool(m)) acts.push({ t: '练3道同类' … })`。「看不懂？AI 详解本题 ›」对时政题**保留**（走 `ask` 预填，不依赖题库池）。不把时政 CTA 改接 `/api/shizheng/daily`（无一手需求样本，另立项）。源锁：`tests/book-r515-similar-pool-gate.test.js`（五键 true / 8 种非池 false / 三处门控字面 + 旧写法 not.toContain）；R514 源锁 import 断言由整串改为正则（仍要求 `similarSubmodule` 从同文件导入）。门：vitest 全绿 / eslint / lint:tokens / lint-pages 0 error / build:h5；`git diff --check` 空。
7. **发版 + 复采**：宿主 mem_avail 279→318 MB / 5.0 G / load 0.95 / 兄弟构建 0，`--skip-build` 一次 rc=0；容器 `23:33:44Z rev=22a38390` healthy 0 重启；bundle 线上=本机；回归 7/7 200；6b `/` 0.93 / LCP 2795 / CLS 0.06、`/tiku/` 1.00 / 960。改后生产：
   - 时政（375/1440）：答错后 `sim` 只剩「看不懂？AI 详解本题 ›」、`SIM-BTN 0`、**同类题 GET 0 条**（`Q1-SIMILAR-GET []`，自动加练也不再发 `module=时政`）、进度 `1/2`（只重排、无加练）、`docSW==cw`、errs []。边缘核：R514 容器窗内 `questions?…module=时政` 4 条全是改前 harness（probe=1，23:21/23:25）；R515 容器 0 条。
   - 行测（1440 preset）：CTA 仍在、`practicePreset {panduan, 定义判断, 3}`、`limit=3&module=panduan&submodule=定义判断`、`1/3`、3 题定义判断、完成态正常——与改前 375 逐值同形态。
   - 手录/时政形态加练卡（`inv`，桩 `GET /api/questions` 回包 `options:null`，题干带 A–D 行，375/1440）：到期卡 Q1 正常铺文本；顺序 `[Q1, Q1 重排, 加练 1, 加练 2]`，**3/4 加练卡 = 旧形态**：`加练同类 3/4`、题干末尾 `A.… B.… C.… D.…` 一行连排（`white-space: normal`，`qHasOptLines false`）、选项 A–D 裸字母 375 `71.3×46`×4 / 1440 `175.5×46`、答后 `ok/bad/dim` 正常、加练卡无「练 3 道」CTA（`_extra`）；**没有臆造选项文本**，原 A–D 文本保留在题干里。这与 R514 §8 登记的一致，是 fail-closed 预期，不改。
8. **如实**：全部读数为本机 CDP（`X-Kg-Probe: 1`）采样；`GET /api/review` 桩 1 道真数据（时政/行测各取 `umst3` 一条真到期项）、`inv` 模式 `GET /api/questions` 桩为合成 `options:null`；`POST review/*`·`track`·`mistakes` 本地 200 桩、其余非 GET abort（`answer_log`/`mistakes`/`practice/progress`/`practice_result` 见 `aborted` 列表）；点了选项/下一题/CTA/练习页作答。事后核 `umst3` 自 R514 发版起 `mistakes/answer_log/growth_events/review_log` 新增 **0**、`mistake 1953/2784/2914` `review_count 0 / next_review NULL / mastered 0` 未变。**浏览器本地合成路径，不是真人复习/练习证据。**

## 1. 边界与方法

- 本机 Chrome（CDP `localhost:29229`）对生产 `https://kaogong.zalize.com/#/pages/book/book`，uid `umst3tuisd7lgzaka`（只读）。
- `~/r515/preset_path.py <375|1440> <preset|sz|inv> [item_index]`：
  - `preset`：桩 1 道行测到期题（第 N 条）→ 答错 → 量 CTA/`practicePreset` 写入 → 点 CTA → 练习页量 `hash/empty/skel/modTag/pos/tags/opts/btns/ls` + 练习 GET 列表 → 3 题作答（选 A）→ 完成态。
  - `sz`：同上但取时政项（`module='时政'`）。
  - `inv`：行测到期题 + `GET /api/questions` 桩为 `options:null`/题干带 A–D 行 → 走到 3/4 加练卡量 `qHasOptLines/opts/白空格样式`、答后态。
- 非 GET `/api/**` 全部 abort 或本地 fulfill（`review/*`、`track`、`mistakes` 返回假 200），无 LLM 请求。
- 生产侧只读：`~/r515_pre.sh`（(c)+DB 到期项）/ `~/r515_pre2.sh`（簇 + W10 uid 各表 + `crawler-stats.json`）/ `~/r515_pre3.sh`（W10 边缘请求头）/ `~/r515_pre4.sh`（mistakes module 分布 + 时政形态 + 题库活跃 module + 簇最新）/ `~/r515_post.sh`（发版后全项 + humans 复算 + W10 对账）。

## 2. 改前生产读数（dist `2d75ba53`）

| 项 | 375 行测 preset（2784 定义判断） | 375 时政 sz（2914） | 1440 时政 sz |
|---|---|---|---|
| Q1 答错后 `sim` | 「还不稳？练 3 道同类题巩固 ›」309×36 @750 + 「看不懂？AI 详解本题 ›」@786 | **同样两条** 309×36 @601/@637 | 726×36 @449/@485 |
| 自动加练 GET | `questions?limit=2&…&module=panduan&submodule=定义判断` | `questions?limit=2&…&module=时政` | 同 |
| 提示 tips | 「已为你在本轮末尾加练 2 道同类题」 | `[]`（空回无加练） | `[]` |
| 进度 | 1/4 | 1/2 | 1/2 |
| `practicePreset` | `{panduan, 定义判断, 3}` | `{时政, null, 3}` | 同 |
| 练习页 GET | `limit=3&…&module=panduan&submodule=定义判断` | `limit=3&…&module=时政` | 同 |
| 练习页 | tags「判断推理 / 定义判断」、`1/3`、选项 4 项 309×97.4（长文本）、完成态 `sheets []` | **「题目加载失败 / 该模块暂无题目，换个模块试试」** + 重试 76×44 / 返回首页 64×36 | 同 |
| `docSW/cw` / errs | 375/375 / [] | 375/375 / [] | 1425/1425 / [] |

## 3. 前置数据核（`~/r515_pre4.out`）

- `mistakes` 全表 by module：changshi 76 / panduan 66 / yanyu 65 / ziliao 51 / shuliang 46 / **时政 27**；非题库 module 只有时政；时政 27 行 **全部到期**、`question_id IS NULL`、8 个 uid（`umst3` 9 行）、`question_text` 含换行 A–D 行（`2026年全国高考报名人数…\nA.1335万人 B.45万人 …`）。
- `questions` 活跃 module：changshi 30907 / panduan 22916 / shuliang 32556 / yanyu 18294 / ziliao 4698 —— **无 `时政`**，`GET /api/questions?module=时政` 必空。
- `mistakes` 无 `probe` 列 → 归因只能靠边缘日志同窗对账。

## 4. 修

- `frontend-uni/src/review-similar.js`：`import { MODULE_KEYS } from './module-meta.js'`；`export function hasSimilarPool(m)`。
- `frontend-uni/src/pages/book/book.vue`：import 增 `hasSimilarPool`；computed `similarableReview()`；CTA `v-if`；`appendSimilar()` 守卫；操作单 `if (hasSimilarPool(m)) acts.push(...)`。
- `frontend-uni/tests/book-r515-similar-pool-gate.test.js` 新增；`book-r514-review-similar-submodule.test.js` import 断言改正则。
- 不改：AI 详解入口、`reinforceFromMistake()`（错题本列表「强化」走 `question_type` 回退，另有空态处理）、后端、小程序。

## 5. 门 / 发版（`~/r515_deploy.log`）

- vitest 全绿（新增 1 文件）/ eslint / lint:tokens / lint-pages `0 error, 19 warn（存量）` / build:h5；`git diff --check` 空。
- 预检 `23:32:02Z mem_avail=279M avail=5.0G load=0.95 builds=0`；`compose-started` → `poll started=23:33:44Z rev=22a38390 compose_rc=0`；「线上 bundle 与本机构建一致」；回归全部 200；6b `/` 0.93 / LCP 2795 / CLS 0.06、`/tiku/` 1.00 / LCP 960 / CLS 0；`DEPLOY_RC=0`。

## 6. 改后生产复采（dist `22a38390`，`~/r515/post/`）

| 项 | 375 sz | 1440 sz | 1440 preset | 375 inv 加练卡 3/4 | 1440 inv 加练卡 3/4 |
|---|---|---|---|---|---|
| `sim` | 只「看不懂？AI 详解本题 ›」309×36 @601 | 726×36 @449 | 两条都在（@600/@636） | 只 AI 入口（`_extra`） | 同 |
| `SIM-BTN` | **0** | **0** | 1 | — | — |
| 同类题 GET | **[]** | **[]** | `limit=2/3&module=panduan&submodule=定义判断` | 桩 `options:null` | 同 |
| 练习页 | — | — | 「判断推理 / 定义判断 / 真题」`1/3`、opts 686×73.6×4、3 题完成态正常 | — | — |
| 加练卡形态 | — | — | — | `qHasOptLines false`、A–D 裸字母 71.3×46×4、题干末含 `A.… D.…`、答后 ok/dim | 175.5×46×4、bad/ok/dim |
| `docSW/cw` / errs | 375/375 / [] | 1425/1425 / [] | 1425/1425 / [] | 375/375 / [] | 1425/1425 / [] |

(c) 全项见 §0.1；`umst3` 四表新增 0；`mistake 1953/2784/2914` 未变。

## 7. 簇 / humans（`~/r515_post.out`）

- 09-07 UTC 日：簇 1110 行 / 1109 IP，22:24:51Z → 23:38:44Z（取证末仍在），75 分钟无 >120 s 间断，14.8 行/分（峰 34），UA 14 种，全 200，每 IP ≤2。
- `crawler-stats.json`（23:23:01Z）：`humans.page {09-06: 7, 09-07: 757}`、`humans.ips {…, 09-06: 9, 09-07: 761}` → **已灌水**；管理台「候选真人」面板此刻显示的 09-07 数字基本是这一簇。
- 剔除口径候选（登记，不改）：`/tiku/q/*` + `Accept-Language: en-US,en;q=0.9` + 无 Referer + 单 IP ≤2 次 + 无任何后续 assets/API；R388/R393 同类改口径都先论证再改，需你点头。

## 8. 登记 / 未做

- 时政错题「同类题」若要有：走 `/api/shizheng/daily` 按日期/标签取，属新功能（无真人样本，不立项）。
- 手录/时政形态加练卡旧形态（题干连排 + 裸字母）是 fail-closed 预期；要美化需先有 options 结构，不臆造。
- `celebrateN`/「加练 2 vs 练 3 道」口径差（既有）。
- 小程序 `book.ts appendSimilar()` 仍 `!cur.module` 判池 + `question_type split('-')` 反推 → W7 同形态待核（本轮只读源码，未改）。
- 日报 humans 剔除簇口径（§7）；`user_profile`/`mistakes` 无 `probe` 列。
- 发版预检 `GET /api/health` 直打源站得 403（R388 设计），预检脚本按 `kg=healthy` 判、未受影响，但会在 401/403 计数里留 2 行——以后 (c) 统计时先剔探针网段。

## 9. 产物

- 脚本：`~/r515/preset_path.py`、`~/r515_pre{,2,3,4}.sh`、`~/r515_post.sh`。
- 改前：`~/r515/preset_375.out`、`~/r515/sz_{375,1440}.out` + 同名 png。
- 改后：`~/r515/post/{sz_375,sz_1440,preset_1440,inv_375,inv_1440}.out` + png（`inv_*_q3_extra_invalid.png` 为加练卡旧形态）。
- 生产：`~/r515_pre{,2,3,4}.out`、`~/r515_post.out`、`~/r515_deploy.log`。
