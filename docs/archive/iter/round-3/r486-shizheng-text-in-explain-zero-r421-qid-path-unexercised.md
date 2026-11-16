# R486：时政题文进 AI 讲解 = 生产 0 例；R421 qid 直通路径自 R423 记 qid 起 0 次新生成（登记不修）

日期：2026-09-07（UTC 09:20–09:30）。生产仍 `7acf57b`（R484），本轮 **0 产品代码**。

## 0. 结论

1. **R485 剥出来的剩余口子「LLM 识题对时政题文给行测 module」——生产 0 例**：`explain_cache` 82 行、`ask_cur`/`ask_sessions` 6 条 rec、`mistakes` 全表，题文与 138 条时政题干（前 30 字）逐条交叉 **0 命中**。识题 LLM 的 module 只能落 `kb.MODULES` 五模块之一（不在则 `guess_module` 关键词兜底 → 再兜 `panduan`），时政题文进来必被贴成某个行测模块（大概率常识）——是产品口径问题（时政在行测里本就归常识）不是缺陷，无样本不动。
2. **顺带命中一条观测事实**：`explain_cache.qid` 82 行**全 NULL**。R423（09-06 07:12Z）起 `save_explain_cache` 记 `meta.qid`，之后 0 次带 qid 的新生成落库 = R421「题库题 `question_id` 直通跳识题 LLM」上线后 **0 次在真人/探针的新生成上执行过**（缓存命中路径不写 qid）。全文件唯一带 qid 的非探针请求（`umsacie7` qid 234494，09-05 17:06Z）在 R421（09-06 03:53Z）**之前**，当时走的是识题 LLM。但 82 行缓存里 **50 行（61%）题文包含活跃题库题干**——直通路径对历史讲解流量的适用面很宽，只是端侧从未带 qid 到达（非探针从练习页深链进问答页 = 0）。→ 登记为「R421 效果未在真实流量验证」，不是缺陷。
3. (c) 补量 / 到期项无增量（同 R485 窗口，09:18Z 后源站无新请求）。

## 1. 一手

### 1.1 时政题文交叉（生产库只读，`~/r486_db.sh`）

```
shizheng heads 138（题干前 30 字，≥12 字）
explain_cache rows 82 → 含时政题干 0；module 分布 ziliao 6 / shuliang 41 / panduan 5 / yanyu 21 / changshi 9
ask_cur+ask_sessions items 6 → 含时政题干 0
mistakes 全表 → 「题文=时政 ∧ module≠时政」 0
```

### 1.2 R421 路径落库口径（`~/r486_db3.sh`）

```
explain_cache qid nonnull 0 / 82
q234494 两行缓存（key/raw_key）created 09-05 17:07Z qid=None question_type='言语理解与表达-细节判断'
ask_cur umsacie7 qid 234494 ts 09-05 17:06Z
R421 42f31aa 2026-09-06 03:53Z；R423 cb61b1f（explain_cache 记 qid）2026-09-06 07:12Z
82 行题文含活跃题库题干（12 字滑窗，索引 89,517 个 head）：50
```

源码：`ai_api.py:159-168` 缓存命中分支不 `save_explain_cache` → 命中不会补 qid；`db.py:2054` 只在 `isinstance(qid, int)` 时写。

### 1.3 识题 module 兜底链（`engine.py:57-59` / `kb.py:119-124`）

`data["module"] not in kb.MODULES → guess_module(question_text) or "panduan"`。时政题文没有五模块关键词时会落 `panduan`，有「下列关于…说法正确的是」等常识关键词时落 `changshi`。无样本不评价好坏。

## 2. 判定

| 项 | 证据 | 判定 |
|---|---|---|
| 时政题文进讲解贴错模块 | 0 例 | 登记；有例再看 module_name 外显是否误导 |
| `explain_cache.qid` 全 NULL | R423 起 0 次带 qid 新生成 | 登记：R421 收益（跳 8–15 s 识题）未在真实流量验证；观察指标 = `explain_cache qid nonnull` 首次 >0 |
| 缓存命中不写/不回传 qid | 源码 | 与 R485 登记项合并：`meta0` 回传 `hit.qid` + 命中时补写 qid，待有例 |

## 3. 取证自纠

`~/r486_db2.sh` 用 SQL `replace(...) LIKE` 对 157k 题 × 82 行扫，>15 min 未返回，kill 后宿主残留 `sudo python3 -` 子进程需手动 `kill`（load 4.4）。改为 Python 一次加载活跃题干前 12 字建字典（4.5 s）再滑窗匹配。写进 SKILL。

## 4. 未验证

- 「时政题文会被贴成常识」为源码推断，未向 LLM 发请求。
- `explain_cache` 是 `INSERT OR REPLACE`，R423 之前的行若被之后同 key 覆盖会带 qid——0 非空说明也没覆盖发生。
- 仍无可确认外部真人作答者。
