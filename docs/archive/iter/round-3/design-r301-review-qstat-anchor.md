# R301 设计方案：复盘场景外显「难度 · 全站正确率 · 易错项」锚点（成绩报告解析浮层 + 错题本）

## SOP-10 取证（一手证据）

四维复审计（对标粉笔错题本/逐题解析）后锁定「核心功能深度」维度缺口：

- 刷题页判分后已有「全站数据」行：`难度★ · 全站正确率 r%（N 人次） · 易错项 X`（practice.vue `qStatLine` computed，数据来自 questions 表既有聚合列 `attempt_count/correct_ratio/most_wrong`，仅 `attempt_count>=5` 才外显）。
- 成绩报告解析浮层（report.vue，R290 连看 / R291 收藏 / R292 社交后已是复盘工作台）**零全站锚点**：`/api/exam/report` items 只回 no/question/options/picked/answer/explanation/hs_explanation/image/is_real 等，不含 `attempt_count/correct_ratio/most_wrong`（exam_api.py L445–462 实查）。
- 错题本（book.vue）展开卡解析区同样**零全站锚点**；`db.list_mistakes` 已 LEFT JOIN questions（取 tag3/options），但未取三列聚合字段（db.py L2969 实查）。
- 竞品：粉笔逐题解析（做题页、错题本、模考报告）处处外显全站正确率/易错项，是用户复盘时判断「是我弱还是题本身难」的核心锚点。

用户可感知痛点：模考复盘/错题重看时无法区分「大家都错的难题」和「基础题失分」，无法优先补基础题缺口。

## 方案（最小收口，复用既有聚合，不伪造）

### 后端
1. `/api/exam/report` items 增补三字段：`attempt_count`、`correct_ratio`、`most_wrong`（向后兼容纯增量）。
2. `db.list_mistakes` JOIN 增取 `q.attempt_count, q.correct_ratio, q.most_wrong`。

### 前端
1. 新共享纯函数 `src/q-stat.js`：`qStatLine(q)`——从 practice.vue 抽出同一口径：
   - `attempt_count>=5` 且 `correct_ratio!=null` 才产出，否则空串（无数据不渲染不伪造）；
   - 难度星级按 correct_ratio 分档（>85→★ … <=40→★★★★★）；
   - `most_wrong` 存在且 ≠ 正确答案才追加「易错项」。
2. practice.vue `qStatLine` computed 改调共享函数（行为零变化）。
3. report.vue 解析浮层「正确答案」行下补「全站数据」行（detail 切题时联动，无数据不渲染）。
4. book.vue 展开卡解析前补同一行（mistake 记录的 `answer` 即正确答案字段，直接复用口径）。

不做：不新增聚合任务/接口；不改 questions 聚合口径；不动 SSR。

## 验收
- 桌面 1440×900 与移动 375×812：报告浮层与错题本外显行正确、连看切题联动、无数据题不渲染；溢出 0、console 0 error。
- 生产真实接口种子模考 + 错题验证后测试 uid 全库清理 leftover 0。

## 测试
- vitest：q-stat.js 阈值（<5 人次不出、null ratio 不出）、星级分档边界、易错项=答案抑制、缺字段容错。
- pytest：report items 三字段透出；list_mistakes 三字段透出。

## 反伪造边界
只透出 questions 表真实聚合；样本 <5 不渲染；不声称任何增长/转化效果。
