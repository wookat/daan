# 增量测试计划 v3（举一反三闭环）

Evidence: frontend/index.html L150-151 (出题中…（N秒） timer), L161-164 (A/B/C/D buttons + hidden #simans + 详解 button), L168-172 (pickSim: all disabled, picked opacity 1 others .4, reveal answer), L173-177 (explainSim: strips ## 练习题 header & ## 提示 section, fills qtext+uanswer, scrollTo top, auto explain()).

## T1 举一反三闭环（UI 录屏，单一流程）
1. 硬刷新 http://localhost:8000（静态前端，Ctrl+Shift+R）。粘贴资料分析基期题+错误答案 → 讲解出结果。
2. 点「举一反三」。断言 A：按钮文案为"出题中…（N秒）"且 N 递增（截图捕捉 ≥2 秒时刻）。
3. 出题后。断言 B：显示练习题 + "先选你的答案再看解析：" + A/B/C/D 四个按钮；解析区域不可见（截图无"答案与解析"文本）。
4. 点选项 B。断言 C：B 高亮（不透明），A/C/D 变淡（opacity .4），四个按钮均禁用（再点 A 无反应）；解析同时展开，含"答案："与解析文本，且下方有「用花生十三方法详解这道题」按钮。
5. 点「用花生十三方法详解这道题」。断言 D：页面滚回顶部；题目框内容=练习题文本（无"## 练习题"、无"提示"段）；答案框=B；自动进入加载态（"AI 识题中…"出现，无需再点讲解按钮）。
6. 等讲解返回。断言 E：讲解针对练习题的数据（数字与练习题一致），并含对所选 B 的对错判定。
