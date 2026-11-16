# R368 错题本归卷：卷源徽标 + 按卷筛选 + 「练本卷」回流

## 一手生产证据（2026-09-04，kaogong.zalize.com rev f58236d，/data/data.db 只读实查）

- `mistakes` 222 条：`question_id` 非空 212；其中关联真题（`questions.is_real=1` 且 `source` 非空）110 条，分布在 55 个 source（如「2018年青海省考行测真题」12 条、「2024年河北省考行测真题」10 条）。
- `mistakes.source` 仅两种取值：NULL 203 / `'exam'` 19——错题本「来源」筛选只有「模考 / 练习」；按卷练习答错入错题本（`saveWrong` 不传 source）后与普通练习错题**不可区分**，也看不到来自哪张卷。
- `/api/mistakes` 已 `LEFT JOIN questions q`（取 tag3/options/统计列），**未**输出 `q.source/is_real`；卷库 `_list_exam_papers_base` 已按卷派生 `psource`（≥20 题占多数 source，TTL 缓存）。
- 竞品：粉笔错题本每题带「来源：XXXX 年 XX 省考真题」并可按来源筛选、直达该卷；我方 R366/R367 已把「按卷 → 错题」打通，反向「错题 → 卷」缺失。

## 目标体验

1. 错题卡头部新增卷源徽标（文案=卷 psource，如「2018年青海省考行测真题」），仅当该题为真题且能匹配到卷库中的一张卷时显示（fail-closed）。
2. 点徽标 → 按该卷筛选错题（当前筛选条显示「卷名 ✕」+「练本卷」）；「练本卷」深链 `/pkgA/exam/list?pid=<pid>`（R365 卷库深链，卷卡置顶高亮），在那里可「按卷练习 / 只练错题（R367）」。
3. 筛选面板新增「试卷」分组（仅当存在可归卷错题）：列出各卷 ×N，按错题数降序，最多 8 张。
4. URL 同步：`pid=<正整数>` 进 book 深链（`buildBookUrl/parseBookOpts`），刷新可恢复。

## 口径与边界

- 归卷 = `questions.is_real=1 AND source 非空` 且 `source == 某卷 psource`（复用 `_list_exam_papers_base(conn, None, None, None)` 全量卷缓存，同 source 多卷取最新 id 卷）。非真题、无 source、无匹配卷 → `paper=null`，前端不显示徽标，不进「试卷」筛选。
- 读路径派生，零新表/新列/新端点/新埋点；`save_mistake` 写路径不改。
- 模考「模考」徽标、模块/题型/错因筛选、重练、导出、复习流程零变化。

## 验证

- 后端 `tests/test_mistakes_paper.py`：真题+有卷 → `paper={pid,title,psource}`；真题无卷 / 非真题 / 无 question_id → `paper=None`；禁用题不影响（卷 psource 仍派生）。
- 前端 `tests/book-paper.test.js`：`paperGroups(items)` 分组/排序/上限/fail-closed；`buildBookUrl/parseBookOpts` 的 `pid` 正整数校验。
- 本地 ruff/pytest/pyright/eslint/vitest/build:h5 全绿 → PR（base=main）→ 部署 → 生产 1440/375：徽标显示、点击筛选、练本卷落到卷卡置顶、URL 刷新恢复、模考徽标与其它筛选零回归、375 无横向溢出、console 0 error。
