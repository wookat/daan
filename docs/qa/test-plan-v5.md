# 增量测试计划 v5（历史卡片自动折叠 + 错题本重做）

Evidence: frontend/index.html L39 (.card.folded hides all but first child), L136-138 (new explain folds old cards, adds "🕓 历史讲解（点此展开/折叠）" toggle header), L201 (重做 button next to 删除), L210-216 (redo: fills qtext, clears uanswer, clicks ask tab, scrollTo top, alert "题目已填入，先自己做一遍、填上答案再点讲解").

## T1 主链路回归 + 历史折叠
1. 硬刷新 → 粘贴资料分析题+错误答案 → 讲解 → 存入错题本（按钮变"✓ 已存入错题本"）→ 举一反三 → 选一个答案（标色+解析展开）。【回归断言 R】
2. 点「用花生十三方法详解这道题」触发第二次讲解。
   断言 A：旧卡片自动折叠为一行"🕓 历史讲解（点此展开/折叠）"，其余内容不可见（截图证明只剩一行）；新卡片完整展示在顶部。
3. 点该行展开。断言 B：旧卡片完整内容重新可见（原题数据）。再点一次可再折叠。

## T2 错题本重做
1. 切到 错题本 tab。断言 C：每条错题有蓝色"重做"按钮，位于"删除"旁。
2. 点"重做"。断言 D：弹 alert"题目已填入，先自己做一遍、填上答案再点讲解"；确认后位于 拍题讲解 tab，题目框=该错题题干，答案框为空。
3. 清理：删除测试错题（确认框 OK）。
