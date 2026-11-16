# R428：分享作答页多选题——后端 `picked[:2]` 截断必判错 → 归一判分 + 先勾选再确认

rev `5e8f7f1`（后端 `backend/app/team.py` 3 行 + 前端 `frontend-uni/src/pkgA/share/share-q.vue` + 单测 3/vitest 3；bundle 变）。

## 起点（R427 汇报「下一步」）
登记的 P2：分享作答页 `share-q.vue` 只能单选且后端 `picked[:2]`，多选题被分享后作答者必判错。口径：同 R417（`answer_log.picked` 截断修法），**先查有无真人分享流量再定优先级**。

## 取证（一手，源码 + 生产只读）
### 源码
| 位置 | 现状 | 影响 |
|---|---|---|
| `api_share_answer` | `picked = str(...).strip().upper()[:2]`；`correct = picked == answer.strip().upper()` | 3–4 字母答案（ABD/ABCD）被截成 2 字母 → **必判错**；2 字母乱序（`DB` vs `BD`）也判错；落库/`answer_log` 也是截断值 |
| `_sanitized_question` | 不回任何「多选」信号 | 作答页无法区分单/多选 |
| `share-q.vue pick(k)` | 点任一选项立即 `shareAnswer(sid, k)` | H5 只能提交 1 个字母，多选题连正确作答的可能性都没有 |
| 练习页 `practice.vue` / 模考 `exam.vue` | `isMulti` + 勾选 + 「确认答案」；模考用 `togglePickLetter`（升序拼接，与 `normalize_answer` 同序） | R413/R414 已定的交互与判分口径 |
| PK `_grade` | 抽题时 `len(answer)==1 && !_MULTI_RE` 排除多选 | PK 不受影响（已有排除） |
| 全库 `[:2]` | 仅剩 `team.py:482` 这一处（R417 已修 `save_answer_log`） | 本轮收口 |

### 生产（容器 `/data/data.db` 只读，2026-09-06）
- 活跃多选题（`disabled=0 AND LENGTH(TRIM(answer))>1`）：**8 / 109,371**，全在 `changshi`，全为北京市考真题（2015 ×6：273027 ABCD / 273028 ACD / 273030 BCD / 273031 ACD / 273032 BCD / 273036 BD；2021 ×2：264342 ABC / 275876 ACD），题干均含「多选」语义或「包括/有：」，答案合法。
- `shared_questions` 现存 15 行（id 3–29 有空洞，历次复验清理），**引用多选题 0 行**；`shared_answers` 现存 4 行（picked C✓/A/A/B，uid `umsld…` ×2、`umteojq4…`、`test-w1-mp2`）；`answer_log source='share'` 8 行（probe NULL 7 / 1 1），picked 全为 1 字母；`mistakes`/`pk_matches` 引用多选题 0。
- **唯一一次历史命中**：`answer_log` `umsm4wiud2zgvl9pt` 2026-08-09 18:26Z 经分享作答 **273028（ACD）picked `A` → correct 0**，probe=NULL（R374 打标前）、该 uid 无任何 growth_events/mistakes、对应 `shared_questions` 行已不存在（id 4–9 空洞）——单选 UI 下这次作答**无论选什么都必错**；08-09 是内部走查密集日、uid 无其他痕迹，**不归因外部真人**，但证明该路径在生产被走过。
- 事件：`share_answer` NULL 4 / probe=1 1；`share_open` NULL 29 / 0 2 / 1 15；`share_copy` NULL 8 / 0 1。`probe=0` 三条为 09-06 `share_copy`（`umst3tuisd7lgzaka`，R425 vivo 小程序）+ 同 sid `fqpexz7g` 的 2 次 `share_open`（`umsagboriz4qyurnd`，10 s 后与 1.8 h 后各 1 次、未作答）；无 probe=0 作答。
- 计数口径说明：`shared_answers` 4 vs `share_answer` 事件 5 vs `answer_log` 8——`shared_answers` 随分享行/走查 uid 一起被历次清理、`answer_log`/事件残留粒度不同（如 `umsld4j8…` 3 次作答只 1 条事件、273028 那次无事件），不是漏写。

### 结论
- **没有可确认的真人受害样本**（无 probe=0 分享作答；08-09 那次 273028 命中 probe=NULL、不可归因）。
- 但缺陷是「结构必错」：8 道合法多选题任一被分享，作答者不论怎么选都判错、并以错误 picked 落 `answer_log`；练习页/模考页对同一题已能正确多选（R413/R414），分享页是口径孤岛。
- 修复成本极低（后端 3 行复用既有 `normalize_answer`，前端复用 `togglePickLetter` + 练习页同款确认条），与 R417 同为「截断口径收口」→ **修，不加功能**；不做「禁止分享多选题」（会让分享者在练习页刷到多选题时不可分享，且 PK 的排除是抽题侧、与分享不同）。

## 修法
- `api_share_answer`：`picked = db.normalize_answer(body["picked"])[:8]`（大写/去重/升序/非字母剔除，空 → 400 不变）；`correct = picked == db.normalize_answer(answer)`。单选路径行为不变（`" a "` → `A`）。
- `_sanitized_question` 加 `multi: len(normalize_answer(answer)) > 1`（布尔，不泄漏答案）。
- `share-q.vue`：`isMulti` 读 `question.multi`；多选点选走 `togglePickLetter` 只切换、显示「多选题：选完所有正确项后确认」+「确认答案（N）」（44px 高、无选择置灰），确认后 `submit(multiSel)`；单选仍点选即提交。揭晓后 `right/wrong` 按字母包含标记（`ABD` 三项绿、错选红），「你选了 ABD」/「选 ABD」文案自然支持多字母。
- 小程序 `miniapp-native` 分享页未改（仍单选提交；服务端归一后单字母对多选题判错——与改前一致、无回归），下次微信开发者工具发布时同步（P3）。

## 本地
pytest 486（+3）/ ruff / pyright 0；vitest 606（+3）/ eslint / build:h5 绿。

## 生产执行 / 复验
见 handoff R428 节与 PR #619 评论。
