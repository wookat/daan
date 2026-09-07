# R400：真题解析「公式丢失骨架」211 行人工核定 → 可逆隔离 210 + PDF 页脚剥离 30 处 + 错题快照写入侧回落 hs

日期 2026-09-05（UTC）。分支 `devin/*-r399-ai-truncated-main-first`（续 R399，base=main）。生产 rev 上线前 `c67e942`。

## 1. 起点与取证方式

R396 遗留两项：① 29–31 个 `explanation_fit` 启发式小块人工核对后再定是否二次隔离；② 练习路径快照写 `q.explanation||''`。全部证据来自生产库只读 SQL（`file:/data/data.db?mode=ro`）、容器日志、以及本地对生产片段的复算；不使用二手描述。

### 1.1 R399b 之后的 AI / 活动归因
- 容器 `docker logs --since 2026-09-05T11:00Z`（覆盖 R399b 12:01Z 部署至 12:32Z）1,889 行：`[llm]` 0 行、`mistakes/analysis` / `ai/coach` 0 次、5xx / Traceback / slow-req 0；`RestartCount 0`、`oom=false`、healthy。**结论：R399b 后没有任何自然 AI 请求，无样本可归因**（不是「主通道慢」被证伪，而是没有数据）。
- `answer_log` 近 48 h `probe=0` 行 **0 条**；`mistakes` 最近 8 行全是 `test-w3-mp`（09-04 09:47–10:17Z）。近 48 h 没有可归因为外部真人的作答。`growth_events` 实际 schema `(id, uid, event, source, ref, created_at, probe)` 532 行，事件分布 boot 255 / heatmap_view 82 / slow_load 58 / share_open 34 / pk_result_open 26 / team_join_open 16 / review_entry_click 11 …；`mock_events` 4 行、`mock_event_entries` 1 行。此前误查 `track_events` 是表名记错，不是缺陷。

### 1.2 31 个 `explanation_fit` 块（151 行，活跃 134）的人工核对
逐块抽读后分成四类（R396 已把「连续块、解析属别题」的 307 行隔离）：
1. **解析属别题**：剩余块里未再发现整块错位；个别低 fit 是解析短、题干长（fit 分母效应），解析本身对题。→ 不再按 fit 二次隔离。
2. **公式丢失骨架**：正文里公式/表达式被整段抠掉，只剩「根据公式：。」「可列方程：，解得」「所求项为。」这类骨架，答案结论仍在但推导不可读。这是 R400 的主目标（见 §2）。
3. **PDF 页脚串入**：「第 N 页共 M 页」「-N- 20XX 年…《行测》真题（X 卷）」串进解析甚至选项文本（如 `332501 D: "6 - 10 - 2018年北京市公务员录用考试《行测》真题"`）。
4. **OCR 错字 / 多打标点**（`。。`「，，」在文字题里、「等太的虚像」）、图形题解析依赖原图、`答案为 AB` 多选格式——**正文可读、不动**。

### 1.3 「公式丢失」判定的设计论证（先论证后写码）
- 信号来源：从 §1.2 的样本里归纳三类互斥骨架特征，全部要求标点在语义上「后面本应有表达式」：
  - `colon`：全角冒号后直接接句读 `：[。，、；]`（「公式为：。」「列方程：，」）。半角 `:。` 不算（`288081 找到定义关键词:。` 是判断题正常 OCR 形态）。
  - `enum`：并列顿号间为空 `、、|、，|，、|、。`，且模块 ≠ 言语（言语「碰撞、、融合」是原文引用形态，排除）。
  - `quant`：仅数量/资料两模块：`，，|：。|：，|；。` 或「所求项/所求/括号内/未知项/下一项(应)(为|是)」后直接句读。常识/判断的「，，」多为 OCR 多打，故限模块。
- 全库复算（`is_real=1`，解析非空 24,558 行）命中 **211 行**：shuliang colon 98 / quant 70 / enum 12，ziliao colon 13 / quant 9 / enum 1，panduan colon 5 / enum 1，changshi colon 2；来源分散在 `2019/2018/2017 年联考`、`2019/2020 江苏`、`历年行测真题`、北京/浙江/河南/四川/天津/重庆等 15+ 个 source（不是单批次）。
- **逐行人工阅读 211 行命中上下文**（`~/r400_garbled_ctx.txt`，每行 3 处命中前后 18 字）：210 行确认为公式/表达式丢失（含 `320668/334221/331787` 这类「代入选项的数值被抠掉、结论保留」的半可读行，也算解析降级）；**1 行误报** `334672`（判断题、已下线，「乳、肉、、毛」是 OCR 重复顿号，正文完整）→ `--keep`。
- 与现状对比：这 210 行里活跃 193 行，**全部有 `hs_explanation`**；隔离后用户看到的是花生十三讲解而不是骨架文；R396 读取层 + 本轮写入层回落保证错题本/复习不出现空解析。
- 不做的替代方案：用 hs 改写 base（hs 是兜底不是可信替换，R396 已定）；用 LLM 补公式（造内容）；按 fit/标点阈值自动扫描后直接写库（本轮是「规则找候选 → 人工逐行标签 → 才写库」，规则不是主判）。

## 2. 改动
1. `backend/app/quality.py`：`formula_dropped(row) -> 'colon'|'enum'|'quant'|None`、`strip_page_footers(text)`（`FOOTER_PAGE_RE` / `FOOTER_SRC_RE`，无命中原样返回；正文里的「第 3 页」「84—93，共 10 页」「-3，-2，2019年比2018年增长」不受影响）。
2. `scripts/r396_explanation_quarantine.py`：
   - `--garbled [--keep --extra] [--apply]`：全库 `formula_dropped` 候选 → 复用 `explanation_quarantine` 表，reason `r400:formula-dropped-explanation`；已在表内的行（R396）解析已为 NULL 不会再命中，无主键冲突。
   - `--strip-footers [--apply]` / `--restore-footers`：`text_footer_fix(question_id, field, before, after)` 记录前后文本；还原只在当前值仍等于 `after` 时写回（人工改过的不覆盖）。
   - `--restore [--reason R]`：按 reason 分别还原（R396 与 R400 互不影响）。
3. `backend/app/db.py` `save_mistake()`：新错题若 `question_id` 有值且客户端传的 explanation 为空/空白 → 落库前取 `questions.hs_explanation` 兜底（与 `list_mistakes/due_reviews` 读取侧同口径）；重复错题保持原快照；无 qid 的手动录入不查库。
4. `frontend-uni/src/pages/practice/practice.vue` 四处保存错题 payload `q.explanation || q.hs_explanation || ''`（练习 / 交卷 / 离线队列）。
5. 单测：`test_r400_formula_dropped.py` 5 例（判定按模块、页脚剥离与不误伤、`--garbled` 选择/apply/按 reason 还原、页脚 apply/幂等/不覆盖人工改写、两条 CLI dry-run 零写入）；`test_mistake_explanation_fallback.py` +1（写入侧 hs 兜底、非空保留、无 hs 原值、无 qid 原样）。

## 3. 生产执行实录（只读核对 → 备份 → 写入 → 复核）
- `python sqlite3.backup` → `/data/data.db.r400-before`（449,310,720 B，与 `.r396-before` 同尺寸）。
- 脚本以 stdin 方式在容器 `/tmp/r400app`（挂 R400 版 `quality.py`）运行，不依赖部署代码：
  - `--garbled --keep 334672 --apply`：`targets 210 (active 193, active without hs 0); skipped 1` → `quarantined 210, mistakes snapshots rewritten 1`（`mistakes.id 974`，uid `umtg4sot1ybxjb79o`，qid `296168`，快照与骨架 base 全等 → 改为 89 字 hs）。
  - `--strip-footers --apply`：第一次 25/25（explanation 22 / options 3）；发现 `332139 -8- 2018 年 421 联考《行测》真题（福建卷）` 因「421 联考」含空格未命中，正则放宽（允许空格、`真题` 后可接「卷」或直接「（X 卷）」）后再跑 5/5，合计 **30 处**；再 dry-run `footer fixes: 0`（幂等）。
- 复核：`explanation_quarantine` = r396 307（活跃 55）+ r400 210（活跃 193）；`quarantined but explanation still set` 0；活跃隔离行无 hs 0；`questions 156792 / active 109371` 不变；`mistakes` 引用隔离 id 1（即上面改写的那条）；`text_footer_fix` 22+3+5 行；剩余 `页共…页` / `- 20XX年…真题` 命中 2 行是正文（`330998` 「230 页、231 页、232 页共有 4 个 2」、`237109`），不动。
- 历史 15 条空快照（全部有 hs）不回填，读取侧回落已覆盖显示。

## 4. 本地验证
见 handoff：pytest / ruff / pyright、vitest / eslint / build:h5。

## 5. 未验证 / 需注意
- 判定规则只用于「找候选」，本轮 211 行是人工逐行读过的；日后新导入若要复用 `--garbled`，仍须 dry-run 逐行看再 `--apply`。
- 公式丢失的**源头**（导入 PDF/HTML 时公式图片或 MathML 被丢弃）未定位：`import_batch` 全 NULL、原始导入件不可得，与 R396 同一困境；已隔离行若要恢复官方解析需重新取源。
- 写入侧兜底只影响新错题；前端改动需 bundle 发布后生效，此前旧 bundle 客户端仍传空、由后端兜底。
- 210 行中 17 行已下线且部分无 hs：若重新上架需先校源。
