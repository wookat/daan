# 增量测试计划 v2（P0 修复 + 举一反三 + PWA）

Evidence: frontend/index.html L119-121 (staged loading timer), L133-134 (存入/举一反三 buttons), L147 (✓ 已存入错题本 disabled), L149-162 (similar(): POST /api/similar, split on <!--answer-->, 看答案与解析 toggle), L176 (confirm on delete), L181 (stats uses m.module Chinese name); backend main.py L48-54 (/api/similar).

## T1 UI 完整流程（录屏）
1. 粘贴资料分析题（xclip 粘贴）+ 错误答案 → 点讲解。断言：加载提示分阶段变化（"AI 识题中…（N秒）"→"已识题，正在匹配…"），带计秒。
2. 结果卡片同时有「存入错题本」「举一反三」两个按钮。
3. 点「举一反三」→ 按钮变"出题中…"→ 返回后 simbox 显示新题目+提示，答案默认隐藏，出现「看答案与解析」按钮。断言：答案文本在点击前不可见（截图证明）。
4. 点「看答案与解析」→ 答案/解析展开，按钮消失。
5. 点「存入错题本」→ 按钮变"✓ 已存入错题本"且 disabled（再点无第二条记录：错题本仅 1 条）。
6. 错题本 tab → 点删除 → 出现 confirm "确定删除这道错题？"；先取消（条目仍在），再删除确认（条目消失）。
7. 先在删除前看薄弱分析 tab：模块分布显示中文"资料分析 × 1"（不是 ziliao）。

## T2 /api/similar 质量（API）
POST question_text=资料分析基期量题。断言：content 含 <!--answer-->；题目为新编数据（数字不同于原题 1250/8.4%）；方法一致（基期量/截位直除类）；自算验证答案正确；无 \[ / \frac。

## T3 PWA
GET /static/manifest.json 200 且 JSON 有 name/icons；/static/icon.svg 200。（已在 setup 验证 200，补 JSON 字段检查。）
