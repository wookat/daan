# 测试计划 v10（流式讲解输出，H5 400px 视口）

Evidence: backend/app/main.py L60-97（POST /api/explain/stream，check_access 后 SSE：event meta→data {"d":delta}→event done，异常走 event error）；frontend-uni/src/api.js L61-103（streamExplain：fetch 流+X-Access-Code，withAuthRetry 包裹→401 弹访问码框重试）；ask.vue L118-166（H5：onMeta 到达即 unshift 结果卡+清除 loading 计秒，onDelta 逐字更新 live.html；imagePath 无 File 时回退 uploadExplain）；md.js L25（`---`→<hr>，v9 的 P2 已修）。服务 :8000 已用真实 secret 运行（environ 无 secret: 字面值），H5 构建 19:48 新鲜。测试图片已备：/home/ubuntu/q_stream_test.png（9.6亿件÷1.2=8.0，答案 B）。

## T1 文字题流式讲解（核心）
400px 视口粘贴基期题（5400 亿元、同比增长 20%，答案 4500=B），点讲解。
- 断言 A：识题完成（meta 到达）后结果卡**立即出现**且计秒 loading 消失，此时讲解内容不完整（截图 1）。
- 断言 B：数秒后再截图 2，讲解文本明显比截图 1 长（逐字增长的像素证据）；若一次性完整出现则 fail。
- 断言 C：最终内容完整：含"题型识别"、方法（ABRX/截位直除类）、"答案"（4500/B）、易错点；`---` 渲染为水平线而非字面文本（v9 P2 修复验证）。

## T2 完成后按钮回归
- 断言 D：流式完成后点「存入错题本」→ 按钮变"✓ 已存入错题本"禁用；错题本 tab 出现该题（Regression）。测试后删除该条。
- 断言 E：点「举一反三」→ "出题中…（N秒）"→ 练习题+ABCD 正常出现（Regression，不必走完选答案）。

## T3 图片上传讲解
点「选择图片/拍照」上传 /home/ubuntu/q_stream_test.png。
- 断言 F：讲解成功返回，识别出题干（9.6 亿件、20%），答案 8.0/B；流式或回退均可，功能正常即 pass。

## T4 访问码 401 拦截流式请求
devtools console 将 localStorage.accessCode 置为 wrong123（说明性操作），提交文字题。
- 断言 G：弹出"请输入访问码"可编辑 modal（流式请求同样被 401 拦截触发重输）；输入 kg2026 确认后自动重试并正常流式返回讲解。

清理：删除 T2 存入的错题，恢复 DB 仅剩 id=6。更新 test-report.md（v10 置顶）。
