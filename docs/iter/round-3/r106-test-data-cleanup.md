# R106：生产测试 uid 数据全库清理 + 可复用清理脚本

## 生产取证（2026-08-31）

- 全库 uid 审计发现 85 个迭代验证遗留测试 uid，跨 12 张表共 646 行：
  - 命名模式类：`r18-a`、`r7-rf-*`、`r83dailytest*`、`qa-r31-7f3k`、`uR42tmpvevi7rfe`、`testprobe1` 等（历轮走查/QA 脚本约定命名，部分轮次完成后未清理）；
  - 机器速答爆发类：`umseywrx76y726pvi`、`umsojv42noxi4eie0`（≥10 条作答、全部 secs≤2、跨度 ≤60s，无登录 profile）；
  - 其中 5 个测试账号还残留 user_profile 行（登录流程测试），2 个混入 48h 活跃作答统计（uR42tmp 30 条/90s），直接污染「真实用户作答来源」取证结论。
- 老板转达指令中明确列出候选：「测试 uid 数据清理」。

## 方案

新增 `scripts/clean_test_data.py`（入库可复用，每轮验证后执行）：

1. 判定标准（并集，保守）：
   - 命名模式：`^(r\d+|uR\d+)`、`qa-` 段、含 tmp/test/probe/chk（不区分大小写）；
   - 机器速答爆发：answer_log n≥10 且全部 secs≤2 且跨度 ≤60s（豁免已登录 uid）。
2. 保护：PROTECTED（umteojq4sltdhorhm）永不删除；标准 2 额外豁免 user_profile 已登录 uid。
3. 覆盖全部 26 张含 uid 表；默认 dry-run，`--apply` 才删除。

## 验收

1. dry-run 打印 85 targets/646 行，人工核对无真实用户误伤（umsa*/u6/u8/u14/u15/u17/u20/u26/u27 等人速作答 uid 全部保留）；
2. `--apply` 后各表残留 0 行；
3. 保护 uid 前后行数不变；
4. ruff 通过。
