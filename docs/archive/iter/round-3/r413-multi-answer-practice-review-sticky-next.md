# R413：answer 多字母题全库取证 → 练习页多选可作答；复习页「下一题」吸底；校源队列资源缺口登记

## 1. 「answer 多字母 vs 题面单选」是否成批（生产只读，容器内 `/data/data.db`）

```sql
select is_real, disabled, count(*) from questions
 where length(trim(answer))>=2 and answer glob '[A-D]*' group by 1,2;
-- (1,0,8) (1,1,5)   -- 种子题 0 行
```

- 全库多字母 `answer` **共 13 行、全部真题**：活跃 8 / disabled 5；`question_type` 13 行全 NULL（该字段不能区分单/多选）。
- 逐行读题干：活跃 8 行全是**北京市考（2015 ×6、2021 ×2）合法多选题**（264342 题干明写「(多选题)」；273027/273028/273030/273031/273032/273036/275876 为「以下属于…的有」「构成要件包括」「两大山脉是」等多选题型）。**不是数据错位、不成批**；298014「(不定项选择)」answer `AC` 也是多选题面，与 hs 单选结论 C 的冲突维持 R412 登记（disabled，待原卷）。
- 触达：8 题 `answer_log` 1 行（probe NULL，不可归因）、`mistakes` 0 行。

**真问题在前端**：`practice.vue` 是单选实现——`pick(k)` 立即判分、`correct = k === answer`、选项标记 `k === cur.answer`。对多字母 answer：用户点任何一项都判错、**没有任何选项标 ✓**（`'A' === 'ACD'` 恒假）、只在「正确答案 ACD」文字处能看到答案。即这 8 道活跃题在练习页**永远答不对**。错题本复习模式（`book.vue`）早已有 `curMulti` 多选确认流程，练习页没有对齐。

### 修法（`practice.vue`）

- `isMulti = answer.trim().length > 1`；多选题 `pick(k)` 只切换 `multiSel`（`.opt.sel` 高亮），选项下方出现「多选题：选完所有正确项后确认」+「确认答案（n）」按钮（44px），`confirmMulti()` 按选项 key 顺序拼字母 → `commitPick(k)`（原 `pick` 判分主体原样抽出，单选走 `commitPick` 不变）。
- 判分 `correct = k === answer.trim()`；选项 ✓/✗ 与 `optClass` 改为按字母包含 `hasKey(ans, k)`：多选正确项全部 ✓、选错项 ✗、漏选项也标 ✓（用户能看出漏了哪个）。考试模式同样走确认后再 200 ms 跳题。
- 切题 `watch idx → multiSel = []`。`_picked === q.answer` 等 10 处结算比较不改：13 行 answer 字母均按 A–D 升序，与拼接顺序一致。
- 顺带：错题本收藏卡 / 收藏页 / 搜索详情三处只读展示 `k === answer ? 标绿` → `answer.indexOf(k) !== -1`，多选正确项全部标绿。

## 2. 复习页「下一题」375 初始 y774（R410 遗留 P2）

R410 量到作答后「下一题」`rect.y = 774`（视口 812、TabBar 762 以上可见区），讲解长时须滚到底才能继续。改法：`:deep(.next-btn)`（「下一题」与多选「确认答案」共用）`position: sticky; bottom: calc(50px + safe-area + 16rpx)`，非 H5 去掉 50px。效果：按钮自然位置在视口外时吸在 TabBar 上方，滚到自然位置后随内容停住；内容短时不产生任何变化。加投影区分于内容。

## 3. 校源队列资源缺口登记（合并 R409/R411/R412）

| 队列 | 行数 | 状态 | 缺口 |
|---|---:|---|---|
| hs 显式结论 vs `answer` 冲突（R402 3 + R412 3）：264787 B/D、264790 C/A、265118 C/A、297984 D/C、298014 AC/C、376412 C/D | 6 | 全部 disabled，用户与 SEO 不可见 | 需原始真题 PDF/答案页 |
| 选项串入分节标题（R409）：246002/246022/246077/246111/246145/246273/246365/246421/246578/246657/1046586/1046838/1046954 | 13 | 全部 disabled | 需原始真题 PDF/切题产物 |

生产容器与宿主 `/data` 只有 db 与备份、无原卷文件（R411 已核）；本轮不改库、不上架、不猜。老板侧若能提供上述卷次原卷（2015/2021 北京、2024–2025 国考、宁夏/浙江/广东各 1 卷），即可逐行校源后决定上架/改答案。

## 4. `error_reason` 7 天观察（只看 probe=0）

R410 错因入口上线 2026-09-04；观察点 ≥ 09-11。本轮不到期，不看数、不下结论。

## 5. 本地验证 / 未做

- vitest 573（+5：`tests/practice-r413-multi-answer.test.js` 源文件锁）/ eslint / build:h5 绿。
- 未做：多选题的 `_picked === answer` 结算路径在 answer 非升序时会误判（当前 13 行不存在此情形，导入侧未加约束）；错题快照 `user_answer` 对多选写入拼接字母串（如 `AB`），复习模式 `extractLetter` 兼容多字母（已有 `curMulti`）但未在本轮以真人路径逐一验证——交 testing agent 生产复验。
