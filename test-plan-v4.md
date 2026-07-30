# 增量测试计划 v4（选项对错标色 + 讲解历史堆叠）

Evidence: frontend/index.html L120/L133-137 (insertAdjacentHTML afterbegin → history stack; old .simbox loses id), L162-163 (correct answer parsed from "答案：X"), L173-181 (pickSim: correct option bg #2eaf62 green/white text; wrong pick bg #d64545 red).

## T1 选错标色（UI 录屏）
硬刷新 → 粘贴基期量题+错误答案 → 讲解 → 举一反三 → 故意点一个错误选项（先自算正确答案，点非正确项）。
断言 A：所选错误项变红底白字；正确项变绿底白字；其余变淡禁用；解析展开。

## T2 历史堆叠 + 详解闭环
点「用花生十三方法详解这道题」→ 新讲解完成后向下滚动。
断言 B：新讲解卡片在顶部（针对练习题数据）；旧讲解卡片（原题数据）仍在下方完整可见，其练习题/标色选项也保留。

## T3 选对只绿
在新（顶部）讲解卡片再点「举一反三」→ 这次点正确选项。
断言 C：只有所选正确项变绿，无红色按钮。

## T4 回归：存入错题本 / 薄弱分析
顶部卡片点「存入错题本」→ 变"✓ 已存入错题本"；错题本 tab 有该条；薄弱分析显示"资料分析 × N"中文名。清理：删除测试数据。
