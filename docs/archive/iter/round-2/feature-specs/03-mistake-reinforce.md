# Spec 03 · 错题同考点强化

对应轮 1 P0-3。竞品参照：华图智能错题本（错因分类 → 同类习题推送 → 重练任务化）、粉笔错题按考点分类重练。核心思想：错题本从「仓库」变「流水线」——错的不只是这道题，是这个考点。

## 1. 产品定义

在两个时机自动把「错题考点」转化为「同考点新题强化」：

1. **复习流结束页**（主场景）：今日复习（SRS 队列）完成后，结算页追加「同考点强化」卡：按本次复习中答错/自评未掌握的错题聚合 tag3，取最弱 1 个考点（spec-02 `mastery` 最低者）抽 5 道**未做过**的同考点新题，一键开练。
2. **今日计划任务化**：`plan.py` 的 review 任务完成后，若存在强化候选，任务清单动态追加一条「强化：XX考点 5 题」任务（当日有效），形成「复习 → 强化」链。

## 2. 选题规则

```
候选考点 = 今日复习中 correct=0 或自评「方法不会/概念模糊」的错题的 tag3
         （无 tag3 时回退 submodule）
目标考点 = 候选中 mastery 最低者（spec-02 口径）；并列取到期错题多者
选题     = questions 中同 tag3、未被该 uid 作答过（answer_log 无记录）、
           未 disabled、按 |全站正确率-0.6| 升序取 5 题（优先中等难度）
不足 5 题时：同 submodule 补足；仍不足则不出卡
频控     = 每日每考点最多 1 组强化（user_state 记 last_reinforce）
```

## 3. 页面结构（H5）

### 3.1 复习结算页追加卡（改 `pages/practice/practice.vue` 结算区，mode=review）

```
┌ 同考点强化 ─────────────────────────┐
│ 「增长率计算」还差一口气（巩固 58%）  │
│ 本次复习错 2 题都在这个考点           │
│ [强化 5 题 ≈3 分钟]   [换个考点 ▾]   │
└─────────────────────────────────────┘
```

- 「换个考点」下拉列出其余候选（≤3 个）。
- 点击进入练习页 `mode=reinforce&tag3=..&count=5`；结算页显示「考点掌握度：58% → 63%」前后对比（调 spec-02 单考点接口）。

### 3.2 今日计划追加任务（改 `plan.py` 输出）

```
{ key: "reinforce", type: "practice", title: "错题强化：增长率计算 5 题",
  sub: "复习中该考点错 2 题 · 掌握度 58%", target: 5, done_n, done,
  module, submodule, tag3 }
```

- 仅当当日 review 任务 done 且存在候选时出现；done 判定用当日 answer_log 中该 tag3 计数（与现有任务同口径）。

## 4. API / 实现草案

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/reinforce/suggest?uid=` | 返回今日强化候选：`{items:[{tag3, tag3_name, module, submodule, mastery, wrong_today, avail_n}], picked}`；无候选返回空 |
| 取题 | 复用现有练习取题接口 | `mode=reinforce` 走「同 tag3 + 未做过 + 难度排序」过滤（`db.py` 取题函数加 `exclude_answered` 分支；`similarity.py` 的相似题引擎作为同材料题组场景的补充来源，资料分析考点优先取同材料成组题） |
| 记录 | answer_log 现有链路 | reinforce 作答正常入 answer_log（module/submodule/tag3 随题）；错题照常入本 |

`plan.py`：`today_plan()` 在 review 任务 done 后调 `suggest` 逻辑（同进程直接函数调用，不走 HTTP）追加任务；无候选不加。

## 5. 验收标准

1. 复习流（mode=review）结算页：本次复习有错题且候选考点可抽到 ≥5 道新题时，强化卡必现；全对或无候选时不出现。
2. 强化组 5 题全部：同 tag3（或回退 submodule）、该 uid 从未作答、未 disabled；资料分析考点时同材料题成组出现。
3. 强化完成结算页显示该考点掌握度前后值，且后值按 spec-02 公式重算正确。
4. 同一考点当日重复完成复习不再出第二组强化（频控生效）；不同考点可再出。
5. 今日计划在 review 完成后出现 reinforce 任务，深链参数齐全，done 判定随作答实时更新；review 未完成时不出现。
6. 无 tag3 的老错题回退 submodule 口径可用，不报错。
7. 小程序构建通过；`docs/parity-matrix.md` §2/§3 增补。
