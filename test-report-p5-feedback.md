# 测试报告 — 题目纠错闭环 v1 (PR #2, branch devin/p5-feedback)

环境：本地 uvicorn :8000（`ADMIN_TOKEN=testtok`），H5 build（frontend-uni/dist/build/h5）已重建，SQLite `data.db`。全流程 UI 测试 + curl/DB 佐证。

## 结果总览
| # | 用例 | 结果 |
|---|------|------|
| T1 | 答题页「题目有问题？纠错」→ 7 类型弹层 → 提交 → toast | ✅ |
| T2 | 同 uid 同题重复提交去重（`updated:true`，单行更新） | ✅ |
| T3 | 错题本 footer「纠错」+ ··· 「题目纠错」入口 → 提交 → 已纠错 | ✅ |
| T4 | 管理端 纠错处理 tab：badge 计数 / 状态筛选 / 详情编辑题目(PATCH) / 标记已修复+备注 / 驳回+原因 / 重新打开 | ✅ |
| T5 | 回归：legacy `POST /api/report` 仍 200；答题判分/错题本展开流程正常 | ✅ |

## T1 答题页提交纠错
刷题 → 今日一练（常识判断）→ 答错第 2 题（题 #2682）→ 解析下方灰色链接「题目有问题？纠错」→ 弹层含 7 个类型 chip + 选填 textarea，未选类型时提交按钮禁用。选「答案错误」+ 说明后提交。

| 🟢 纠错弹层（7 类型 chip + textarea） | 🟢 提交后 toast + 链接变「已提交纠错」 |
|---|---|
| ![sheet](https://app.devin.ai/attachments/bf9118f9-e69c-420a-8ece-0e32cccdc650/ss_5ea25691.png) | ![toast](https://app.devin.ai/attachments/d119e082-1c9b-4115-a3f2-bb31beac9280/ss_61e49612.png) |

DB：`question_reports` 新增 `{id:3, question_id:2682, uid:'umsdnz7xm1amt09jh', reason:'答案错误', detail:'测试：答案疑似有误', status:'open'}`。

## T2 去重（API）
同 uid + 同题再次 POST `/api/question_report`（type=解析错误）→ 响应 `{"id":3,"updated":true}`；DB 仍仅 1 行，reason/detail 已更新、status 重置为 open。后续从错题本再次提交（分类错误）同样命中同一行 → 全程该 (uid, 题) 只有 1 条记录。

## T3 错题本入口
展开错题 → footer 灰色下划线「纠错」链接；··· 动作面板含「题目纠错」。提交「分类错误」后 toast 出现、链接变「已纠错」。

| 🟢 ··· 面板含「题目纠错」 | 🟢 提交后 toast + 「已纠错」 |
|---|---|
| ![actionsheet](https://app.devin.ai/attachments/9ae83bd8-442a-4324-9f73-9d856158725c/ss_930c7428.png) | ![booktoast](https://app.devin.ai/attachments/89d93b90-71cb-43df-b18e-53908a6ae078/ss_232af481.png) |

## T4 管理端闭环
登录 /admin（testtok）→ tab 显示「纠错处理（2）」（基线 1 条 + 新增 1 条）。待处理卡片含 #id、时间、类型 badge（分类错误）、用户 uid 前缀、题 #2682（常识判断，答案 D）、题干预览、用户说明。

| 🟢 待处理列表（badge=2） | 🟢 详情展开：答案/模块/题型/解析 可编辑 |
|---|---|
| ![list](https://app.devin.ai/attachments/f0e0c3c7-eccf-4508-a629-17626c927ad1/ss_86220e67.png) | ![editor](https://app.devin.ai/attachments/00567fe4-8e4c-452b-986e-c4d69340bcef/ss_3243e378.png) |

- 编辑题目：答案 D→C，「保存题目修改」→ alert「题目已更新，可继续标记已修复」；DB 确认 answer='C'（PATCH /api/admin/questions/2682 生效）。随后改回 D 并保存，DB 复原 `('D','changshi','历史人文')` ✅（数据已还原）。
- 标记已修复（备注「已核查：答案与分类无误」）→ 卡片离开待处理，badge 2→1。
- 已修复列表：显示处理备注 + 处理于时间 +「重新打开」按钮。
- 重新打开 → 回到待处理（badge 1→2）；驳回（原因「测试驳回：非题目问题」）→ 已驳回列表显示原因 + 处理时间；再重新打开并最终标记已修复（收尾干净，badge 回到基线 1）。

| 🟢 保存题目修改 alert | 🟢 已修复列表（备注+时间+重新打开） |
|---|---|
| ![alert](https://app.devin.ai/attachments/99520fa7-8835-48b2-b030-c7ee25e22cac/ss_b0c1a964.png) | ![fixed](https://app.devin.ai/attachments/87674c93-eb39-4d41-ae57-210afe79bc28/ss_b0080119.png) |

| 🟢 已驳回列表（驳回原因） | 🟢 收尾：待处理仅剩基线 1 条 |
|---|---|
| ![rejected](https://app.devin.ai/attachments/b0b83113-cf1b-47bf-8dac-718d265486d6/ss_df506079.png) | ![final](https://app.devin.ai/attachments/c5341b9c-90a2-488e-b7a4-0210003345ce/ss_0147b604.png) |

## T5 回归
- `curl -X POST /api/report {"question_id":3045,"reason":"答案有误",...}` → 200 `{"id":2}`（legacy 端点正常，自身按题去重）。
- 答题判分横幅/自动进下一题、错题本展开/AI 详解按钮均正常（T1/T3 过程中覆盖）。

## 备注 / 小问题
1. **非阻塞 UX 观察**：管理端「重新打开」按钮也会弹出「驳回原因（可选）」prompt（handleReport 对所有状态复用同一 prompt），文案在 reopen 场景略不贴切。功能无碍。
2. 测试中 Chrome 曾崩溃一次（与被测代码无关，环境问题），重启浏览器后继续，无数据丢失。
3. 数据已还原：题 #2682 answer/module/submodule 恢复原值；测试纠错记录 #3 最终为 fixed 状态（用户已确认此收尾方式可接受）。
