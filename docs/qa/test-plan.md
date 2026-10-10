# 考公错题助手 MVP 测试计划

Server: uvicorn on :8000 (already running with LLM_BASE_URL/LLM_API_KEY/LLM_MODEL=gpt-5.5). Frontend at http://localhost:8000. Evidence from code: main.py L17-67 (endpoints), index.html L48-72 (tabs: 拍题讲解/错题本/薄弱分析, textarea #qtext, button #go, 存入错题本 button).

## T1 文字题讲解 (API, shell curl)
Send 4 questions via POST /api/explain (form field `text`), one with wrong `user_answer`:
1. 资料分析（增长率计算题）— expect `module` = 资料分析 module key, explanation mentions a method that greps in knowledge/references (e.g. 截位直除/415份数)
2. 判断推理·定义判断 — module = 判断推理, method name greppable
3. 数量关系 — module = 数量关系
4. 言语理解 — module = 言语理解
Pass criteria per response: correct module_name; ≥1 cited method name exists via grep in knowledge/references; explanation contains 答案 and 易错点; for the one with wrong user_answer, contains 错因/错误原因 analysis; output contains no `\[` and no `\frac`.

## T2 图片题讲解 (API)
Generate PNG with PIL containing a Chinese 数量关系 question; POST as `image`. Pass: question_text roughly matches the image text; module correct; explanation valid.

## T3 错题本 UI 流程 (browser, RECORD)
1. Open http://localhost:8000 maximized → paste a question in #qtext, fill wrong 答案, click 用花生十三方法讲解 → explanation card renders (no raw markdown symbols like `**`, no LaTeX).
2. Click 存入错题本 → alert 已存入错题本.
3. Switch to 错题本 tab → item listed; click to expand → explanation shown; click 删除 → item removed.
4. 薄弱分析 tab → shows counts per module (should include the just-saved-then-deleted flow: save a second item first so stats non-empty, verify count ≥1 for that module).
5. Mobile viewport: narrow window (~390px) → tabbar fixed at bottom, layout not broken.

## T4 红线测试 (API or UI)
Send 高数微积分题 (∫x²eˣdx). Pass: response states 超纲/方法不在库中, does NOT attribute a fake 花生十三 method. Fail if it invents a method name not in knowledge/references.

## T5 用户体验评审
As a 碎片时间刷题考生, note UX issues (loading feedback, error states, input ergonomics, mobile) → ranked improvement list in report.
