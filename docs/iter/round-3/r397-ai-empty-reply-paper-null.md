# R397：AI 错题分析「空 200」根因修复 + 模考/真题错题 `paper:null` 范围取证与只补缺归卷

日期：2026-09-05 · 分支 `devin/*-r397-ai-empty-paper-null`（base=main）· 类型：后端 fail-closed 修复（1 处）+ 归卷范围取证 + 归卷脚本改为只补缺（本轮不在生产写卷）

## 1. 起点

R396 复验遗留三条 P1：① AI 错题分析约 30 s 后返回 200 但正文为空；② 错题本里模考/部分真题错题 `paper:null`（无卷徽标、不能「练本卷」）；③ 375 tabbar 盖住巩固 sheet。本轮按「先取证再动手」把 ①② 做实，③ 留 R398 与 SOP-10 次级屏审计一起看。

## 2. AI 分析空 200（P1 → 已修）

### 2.1 一手取证（生产容器内只读探针 `~/r397_llm_probe.py`，key 不打印）
用与 `/api/mistakes/analysis` 完全相同的 prompt/`max_tokens=900`/`temperature=0.4` 分别直打两条通道：

| 通道 | 模型 | HTTP | 耗时 | `finish_reason` | `content` 长度 | `reasoning` 长度 | usage |
|---|---|---|---|---|---|---|---|
| rescue（`chat_fast` 首选） | kimi-k3 | 200 | 57.2 s | **length** | **0** | 1,381 | completion 900 = reasoning 901 |
| text（主通道） | deepseek-v4-pro-0817 | 200 | 33.0 s | stop | 351 | 2,592 | completion 1,873（reasoning 1,634） |

`chat_fast()` 直接返回 rescue 的 `""`，端点视为成功 → 用户看到「分析完成」但内容空。根因：推理模型把 900 个输出 token 全耗在 reasoning 上，`finish_reason=length` 时 `content` 为空，旧代码只判 HTTP 状态不判正文。不是超时、不是网关 5xx。

### 2.2 改动（`backend/app/llm.py`）
- 新增 `EmptyReply(RuntimeError)` 与 `_content(data)`：`choices[0].message.content` 空/全空白即抛 `EmptyReply("AI 未返回内容，请稍后再试")`。
- `chat()` / `chat_fast()` 统一经 `_content()` 取正文；`chat_fast()` 把 `EmptyReply` 与 HTTP/结构异常同列，rescue 空正文 → 回落主通道；主通道也空 → 抛出，`/api/mistakes/analysis` 既有 `except Exception → 502 friendly_ai_err` 接住。
- 不加重试、不改 `max_tokens`、不做任何「拼一段分析」的伪内容：空就是失败，返回 502 友好文案。
- 回归 `tests/test_llm_empty_reply.py`（4 用例）：rescue 空→回落主通道；rescue 有正文→直接用；主通道空→`EmptyReply`；端点层空正文→502 而非 `{"analysis": ""}` 200。

### 2.3 验收边界
- 探针只跑了一次，rescue 通道的空正文是否稳定复现未做多次采样；但修复不依赖复现率——契约改为「正文空即失败」，任何一次空 200 都不再对用户暴露。
- 回落到主通道后端到端耗时 ≈ rescue 57 s + text 33 s，可能超过前端 AI 请求超时——若生产复验命中，属独立的耗时问题（候选 R398：`chat_fast` 对 rescue 单独设更短 read timeout 或 rescue 换非推理模型），本轮不猜。

## 3. 错题 `paper:null`（P1 → 取证完成，本轮不放宽阈值）

### 3.1 生产实查（`~/r397_paper_null.sh` / `~/r397_src_gap.sh`，容器内只读）
- `psource → 卷` 映射 90 条；活跃错题 243 条：`has_paper 75 / not_real 121（模考/非真题，按契约 null）/ source_not_in_psource_map 37 / no_qid 10`。
- 全库真题 source 376 个：已成卷 90、**未成卷 286**（活跃题 5,508 道；其中活跃 ≥20 题的 95 个 source 共 4,452 题）。
- 结论：`paper:null` 不是 R396 那张 17 题安徽卷「不足 `_PSOURCE_MIN_N=20`」的个案，主体是**大量真题 source 根本没有卷记录**。降 `_PSOURCE_MIN_N`、或在读取层用 source 猜卷都改不了这个事实，且违反 fail-closed（R368 契约：非真题/无卷/无 qid 一律 null）。

### 3.2 现有归卷脚本直接重跑不安全（生产库副本 `~/proddb/r385_mig.db` 干跑，生产容器上一次干跑因宿主 load 12.7 / MemAvailable 277 MiB 被我中止）
- 旧 `paper_title()` 用正则/年份+地区拼标题：2025 国考「地市级 / 副省级 / 行政执法」三个 source 都会生成 `2025年国考行测真题卷`，2024、2023 同样撞名；而 `upsert_exam_paper()` 是 `ON CONFLICT(title) DO UPDATE ... question_ids=excluded.question_ids`——**后一个 source 会覆盖前一个的题单**，既有卷也会被改写。
- `2015年吉林省考行测真题` 活跃 233 题、`历年行测真题` 1,544 题：远超行测单卷 135 题上限，是多卷混在一个 source 里，成一张卷就是假卷。
- 部分候选 source 题目缺 base `explanation`（2024 浙江 41 / 山东 35 / 深圳 25），答案/选项缺失 0。
- `exam_papers` 现状：zhenti 120 / mock 69 / retired 1（id=6「2024年国考行测真题卷」2,003 题，历史大杂烩，非有效映射）。

### 3.3 改动
`backend/scripts/build_zhenti_papers.py` 改为**只补缺、不改既有卷**：
- 标题 = `source` 原文（规范空白、≤80 字）——source 本身就是可读卷名，且天然区分同年同地多卷；
- `collect()` 返回 `(papers, skipped)`：已成卷（`db._paper_by_psource` 命中）的 source 跳过；题量 > `--max-questions`（默认 `MAX_QUESTIONS=140`，行测单卷上限 135 的保守守卫）跳过并提示「疑似多卷混装，需人工拆卷」；标题已被别的卷占用跳过；dry-run 逐条打印跳过原因。
- `db._paper_by_psource()` 只看 `kind='zhenti'`（mock 卷随机组题无主 source；此前 `(None,None,None)` 把 mock/retired 也算进去）。
- 新增 `tests/test_build_zhenti_papers.py`（5 用例）：标题保留 source 区分、已成卷跳过、超量/撞名跳过、upsert 后重跑幂等且题单不变、mock 卷不参与归卷。

副本干跑（`--dry-run`，默认 `--min-questions 60`）：已成卷跳过 76、超量跳过 2（`历年行测真题` 1,544、`2015年吉林` 233）、**待建 19 套**（2025/2024/2023 国考地市级各 1、2020 广东、2019 湖北选调、2015 河南、2014 山东/重庆联考/新疆/安徽、2013 安徽/浙江 A、2012 四川下半年/浙江、2011 浙江、2010/2009/2008 河北、2008 内蒙古），全部 61–96 题。

### 3.4 本轮不做、留待决定
- **不在生产写卷**：19 套里资料分析几乎为 0（全库活跃真题资料分析仅 274 题，既有 120 张真题卷也有 66 张无资料分析），且 2024 浙江/山东等缺解析的 source 不在 19 套内但同属这一批未成卷 source——先把「补卷后用户看到的是不完整卷」这一点摆出来，再决定是补 19 套还是先补题源。
- `_PSOURCE_MIN_N=20` 不动；`list_mistakes/due_reviews` 归卷读取层不动。
- 「模考错题 `paper:null`」是契约行为（`not_real` 121 条）：模考卷是随机组题，没有「本卷」可练；若产品要在错题卡显示「来自模考 #N」需另设 `attempt→paper` 关系，属 SOP-10 次级屏审计范围。

## 4. 本地门禁
pytest 403（+9）/ ruff / pyright 0；前端未改（vitest/eslint/build 不重跑）。

## 5. 未验证 / 如实说明
- rescue 空正文的复现率、回落后端到端耗时是否超前端超时——待生产复验（`X-Kg-Probe` 打标）。
- 归卷脚本只在生产库副本（09-04 19:18Z 快照）干跑，生产库当前值待部署后容器内 `--dry-run` 再核一次（脚本只读）。
- `MAX_QUESTIONS=140` 是保守守卫，不是「所有行测卷都 ≤135 题」的断言。
