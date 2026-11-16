# R376：SOP-10 四维审计（2026-09-04 窗口）+ 种子题库导入去重键换为 seed_index

## SOP-10 四维审计（取证摘要，均为本窗口一手证据）

| 维度 | 一手证据 | 结论 |
|---|---|---|
| 操作台 | `ADMIN_EDITABLE` 含 `question`（db.py:1779），`PATCH /api/admin/questions/{qid}` 可改题干；生产 9217 条种子题干全部在库、其中 572 条已 `disabled=1`；同日 W2 事故：题干被改写后重启重插 1928 条 | **命中**：运营在操作台改一条种子题干，下次重启就多出一条「原文」在线题（治理成果被静默回退）。属操作台×架构交叉缺口 |
| 核心功能 | 恢复后生产库 1440/375 全项复验（#589 评论）：逻辑填空选项分词、hs 去元句、q41 无陈旧聚合、弱项完成态、分享缺 id 回退、竞赛 0 报名文案全过 | 无新 P0；错题本 vs 粉笔错题本的下一档差距（错因标注/按知识点聚合外显）留待有干净真人数据后定（R374 打标起算仅 1 天） |
| 落地页/首页 UI | R375 部署 `deploy_h5.sh` 性能预算：`/` 0.97、`/tiku/` 1.00、gzip 119KB≤160KB；375 首页/练习/竞赛/分享/管理台 `clientWidth==scrollWidth`；console 0 error | 无新 P0 |
| 系统架构 | 容器 healthy / restarts 0 / OOM false / VmSwap 0；启动 seed 全程 ~3.5s（10:57:50 StartedAt → 10:57:53 startup complete）。但 `_seed_questions()` 每次启动按 `questions.question` 原文 `INSERT OR IGNORE` 9217 行——去重键=可变业务字段 | **命中**（同上一格）：种子导入不幂等于「内容被治理过」的库；生产已实际发生 1928 条重插 |

## 取证事实（verified）

- `db._seed_questions()`（改前）：逐行 `INSERT OR IGNORE INTO questions (...question...)`，唯一约束只在 `questions.question`；再按题干原文 `UPDATE ... submodule`。任何让题干原文≠文件原文的操作（操作台改题、清洗脚本、hs 导入改写、字符归一）都会在下一次重启把文件里的原文当新题插回。
- 生产 `docker exec` 核对：jsonl 去重题干 9217，全部在库（present 9217 / disabled 572 / missing 0）——即当前处于「刚好全部命中」的脆弱平衡；今日事故中 7700 题干被改写 → 重启 → 1928 条重插（其余因 UNIQUE 碰撞被 IGNORE）。
- 删除同样不安全：批次治理 `DELETE FROM questions WHERE import_batch=? AND disabled=2` 若命中种子行，重启即复活。
- 时政库 `_seed_shizheng()` 同模式，但无操作台改题入口、无治理删除路径，本轮只共用路径解析函数不改语义。

## 方案（后端，零契约零前端零用户可见变化）

1. 新表 `seed_index(stem_hash PRIMARY KEY, question_id)`：题干原文 sha1 → 首次导入 id；`seed_runs(path PRIMARY KEY, fingerprint, ran_at)`：文件内容 sha1。
2. `_seed_questions(path=None) -> int`：
   - 文件指纹与上次一致 → 整体跳过（重启零扫描）；
   - 否则逐行：hash 在 `seed_index` → 跳过（**无论该行之后被改写/下线/删除**）；不在 → `INSERT OR IGNORE`，成功则 `_enrich_new_question`，被 IGNORE 则按原文回查 id（升级回填路径）；写 `seed_index`；`submodule` 补齐改按 id。
3. 升级路径：生产首次运行 `seed_index` 为空 → 9217 行全部 IGNORE + 回查 id → 回填映射，预期插入 0、questions 总数不变（部署后核对）。
4. 明确不做：不改 `questions.question` 的 UNIQUE（其它导入路径仍依赖）；不回填 `import_batch`；不动 `_seed_shizheng` 语义。

## 测试

- `backend/tests/test_seed_index.py`（+3）：种子题被操作台改写后文件未变→0 插入、文件追加→只插新题且改写题不重插；删除/下线的种子题不复活；升级回填（库中已有原文行、index 为空）→0 插入且映射到既有 id、submodule 补齐按 id 生效。
- 本地：pytest 324 / ruff / pyright 0；前端零改动。

## 部署核对清单

- `/api/health` rev 更新；`SELECT COUNT(*) FROM seed_index` = 9217；`seed_runs` 1 行；questions 总数 156792 不变；restart 一次后再核 questions 总数不变、启动日志无 traceback。
