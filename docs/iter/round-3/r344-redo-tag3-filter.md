# R344：错题重练遵循三级考点筛选（kp3Filter → /api/mistakes/redo?t3=）

## 取证（verified）

- 错题本掌握度分组 `pickGroup(mod, sub, t3)` 可选到三级考点，`shownItems` 按 `m.tag3_name === kp3Filter` 过滤列表（book.vue L648）。
- 但 `redoAll()` 只透传 kpFilter（qtype/module）、rzFilter、srcFilter——kp3Filter 态下重练实际按二级题型（qtype=sub）拉题，集合大于所见列表：与 R342（rz）/R343（src）同构的「所见≠所练」缺口，且粒度回退是静默的。
- 数据就位：`list_mistakes` 已 LEFT JOIN questions 取回 `q.tag3`（code），API 层补 `tag3_name`；即前端筛选态下每个 item 均带 tag3 code，可直接透传。

## 方案

### 后端

- `/api/mistakes/redo` 新增可选 `t3`（三级考点 code）：
  - 白名单 fail-closed：`t3 not in taxonomy.topic_index()` → 400「无效的考点」；
  - 不传行为零变化。
- `db.mistakes_redo_questions` 补 `tag3: str | None = None`：
  - `AND question_id IN (SELECT id FROM questions WHERE tag3=?)`（mistakes 表无 tag3 列，经 question_id 关联；无 question_id 的手录错题天然排除——与列表口径一致：列表中这类行 tag3_name 为 NULL，kp3Filter 态本就不显示）；
  - 匹配/去重/排序/limit 零变化；可与 reason/source 叠加。

### 前端（book.vue）

- `redoAll()`：`kp3Filter` 时从 `shownItems` 取首个 `tag3_name === kp3Filter` 项的 `tag3` code 追加 `&t3=`（取不到 code 时不加参数，行为回退现状——fail-open 保守）；
- 重练卡文案优先级改为 kp3Filter > kpFilter > rzFilter > srcFilter（更具体优先），标题「错题重练 · <三级考点>」+ 描述「只重练当前筛选考点的待掌握错题（最多 10 题）」。
- redoSet 协议 / practice 消费 / URL 同步（kp3 本无 URL 参数，不新增）不改。

## 测试

- backend `test_redo_tag3.py`：t3 精确过滤；无效 t3 400；缺省行为不变；t3+rz 叠加；无 question_id 手录错题不入集合。
- 本地门禁：ruff / pytest / pyright / lint / vitest / build。

## 生产验证（testing agent）

- 一次性 uid，真实 UI 造两个不同 tag3 的错题；掌握度分组选到三级考点 → 列表过滤 → 点重练，抓包断言 `&t3=` 与 redo 响应集合仅该考点；无筛选回归；无效 t3 curl 400；375/1440；console 0 error；0 次 /api/explain；测试数据全库清理 + 保护 uid 快照。

## 非目标

- 不新增 endpoint/表/埋点事件；不给 kp3 加 URL 同步（现状 pickGroup 内部态）；不改掌握度分组交互。
