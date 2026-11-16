# R343：错题重练遵循来源筛选——redo 接口补 src 维度

## 取证（现状）
- 错题本自 R176 起有来源筛选 srcFilter（'exam' 模考 / 'practice' 练习），R276 起 URL 同步 `?src=`；列表 `shownItems` 按 `m.source === 'exam'` / `!== 'exam'` 过滤（book.vue L649-650）。
- mistakes 表有 `source TEXT` 列（db.py L78 迁移），模考错题写 'exam'，练习错题为 NULL/其他。
- R342 已把 rzFilter 贯通到重练；但 `redoAll()` 仍不透传 srcFilter：`GET /api/mistakes/redo` 与 `mistakes_redo_questions` 无 source 维度——用户筛「模考错题」后点重练，实拉全量待掌握错题，所见≠所练（与 R342 修复前错因维度同构缺口）。
- 重练卡文案在仅 srcFilter 态也不反映筛选（当前三元只覆盖 kpFilter/rzFilter）。

## 方案（最小收口，与 R342 同构）
- 后端 `/api/mistakes/redo` 新增可选 `src: str | None`，白名单 {'exam','practice'}，非法 400 fail-closed，不传行为零变化。
- `db.mistakes_redo_questions(..., source=None)`：
  - `source=='exam'` → `AND source='exam'`；
  - `source=='practice'` → `AND (source IS NULL OR source!='exam')`（与前端列表口径一致）；
  - 匹配/去重/排序/limit 零变化。
- 前端 `redoAll()`：srcFilter 有值时追加 `&src=<srcFilter>`；重练卡标题/描述链上来源态（优先级保持 kpFilter > rzFilter > srcFilter；组合态取最高优先级文案，参数全部透传）。
- redoSet 协议 / practice 消费 / 排序不改；不新增 endpoint/表/埋点。

## Non-goals
- 不做多维文案组合展示（仅按优先级取一维文案，参数仍全透传）。
- 不改 source 写入路径。

## 验收
- 本地：pytest 覆盖 exam/practice 精确过滤（practice 含 NULL+非 exam）、非法 src 400、缺省不变；ruff/pyright/lint/vitest/build 全绿。
- 生产：隔离 uid 造模考+练习两种来源错题，UI 选来源点重练抓包核对 src 透传与集合；R342 rz 与 src 叠加透传；非法 400；375/1440、console 0、0 次 /api/explain；验后清理+保护 uid 快照。
