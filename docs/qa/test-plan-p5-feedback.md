# Test Plan — 题目纠错闭环 v1 (PR #2)

Env: uvicorn :8000 with ADMIN_TOKEN=testtok, H5 build served at http://localhost:8000, admin at /admin. DB pre-existing open reports: 2 (badge baseline may vary; record actual before test). Browser window sized mobile (400x720) for H5, maximized for admin.

## T1 — H5 答题页提交纠错 (primary flow)
1. Open http://localhost:8000, go to 刷题 tab, start a practice set (pick a module → submodule sheet → start), answer question 1.
2. Assert: below explanation there is grey link「题目有问题？纠错」. Click it.
   - PASS: bottom sheet titled「题目纠错」with 7 chips 答案错误/解析错误/题干或选项错字/图片缺失/分类错误/重复题/其他, textarea placeholder「补充说明（选填，500 字以内）」, submit button「提交纠错」disabled while no chip selected.
3. Select「答案错误」chip (highlights blue), paste note「测试：答案疑似有误」via xclip, click 提交纠错.
   - PASS: toast「感谢反馈，我们会尽快核查」, sheet closes, link now reads「已提交纠错，感谢反馈」.
4. Record the question id (via DB/API) for later admin steps.

## T2 — Dedupe (API-verified)
1. Note DB row count for that question_id+uid; re-open report path is UI-blocked after submit (link shows 已提交), so verify dedupe via curl: POST /api/question_report same question_id + same uid (read anonUid from browser localStorage) with type=解析错误.
   - PASS: response `{"id": <same id>, "updated": true}`; DB still exactly 1 row for that (question_id, uid), reason updated to 解析错误, status back to open.

## T3 — 错题本纠错入口
1. Go to 错题本 tab, expand a mistake item that has question_id.
   - PASS: footer shows grey underlined「纠错」link; clicking ··· action sheet includes「题目纠错」.
2. Click 纠错 → same sheet opens; pick 分类错误, submit.
   - PASS: toast「感谢反馈，我们会尽快核查」, link becomes「已纠错」.

## T4 — Admin 纠错处理闭环
1. Open http://localhost:8000/admin (maximized), token testtok.
   - PASS: tab shows「纠错处理（N）」where N = baseline_open + new reports from T1–T3.
2. Click 纠错处理 tab; 状态筛选 select shows 待处理/已修复/已驳回, default 待处理.
   - PASS: cards show #id, time, type badge (e.g. 答案错误→解析错误 after dedupe update: the T1 report shows 解析错误), 用户 uid prefix, 题 #qid, 题干预览, 用户说明 text.
3. On the T1 report card, expand「查看完整题目 / 直接编辑」.
   - PASS: full 题干+选项, inputs 答案/模块 select/题型/解析 textarea prefilled with current values.
4. Change 答案 to a different letter (record original), click 保存题目修改 → alert「题目已更新，可继续标记已修复」. Verify via GET question API/DB that answer changed. Then edit back to ORIGINAL answer and save again (restore).
5. Click「标记已修复」→ prompt for 备注, enter「已核查，答案无误」→ card leaves 待处理 list, badge count decrements by 1.
6. Switch 筛选 to 已修复.
   - PASS: card shows 处理备注 + 处理于 timestamp +「重新打开」button.
7. Click 重新打开 → card returns to 待处理 (badge +1). Then 驳回 the T3 report with note; verify appears under 已驳回. (Leave the T1 report re-fixed at end so DB is tidy.)

## T5 — Regression
1. Legacy API: `curl -X POST /api/report -d '{"question_id":X,"reason":"答案有误","detail":"legacy"}'` → 200 with `{"id":N}`.
2. Practice answering flow (done implicitly in T1: option select → 判分横幅 → 下一题 works) and 错题本 expand/AI详解 buttons still render (T3).

Cleanup: restore edited answer (T4.4), reports may remain as fixed/rejected. Reset any localStorage changes not needed.
