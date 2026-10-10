# 测试计划 v14（分段输入切换 + 深色模式 + 错题本空态，H5 400px 视口）

Evidence: ask.vue L8-23（.seg 分段：📷 拍图识题 / ⌨️ 粘贴文字，mode='img' 默认只显示选图按钮，mode='text' 显示 textarea）、L132-137（doExplain 按 mode 取输入：img 模式 txt=''、text 模式 img=''）、L98/L285（redo/explainSim 自动切 text 模式并清空图片）、L23（答案输入框 placeholder"如：A" 无序号③？——注意：L21-23 前仍有"③ 你选的答案"文字需看构建后实际 UI）。App.vue L31-47（@media prefers-color-scheme: dark 覆盖 --card #23262f/--soft-bg #1c1f27/--ink #e7e9f0 等 + page 深色渐变 + uni-tabbar 背景 #1c1f27）。book.vue L40-44（空列表 → 📖 图标 + "错题本还是空的" + 说明 + 「去刷题」按钮 goPractice switchTab）。H5 构建 21:19 新鲜，后端进程 20179（21:00）无改动，DB 仅 id=6。

## T1 分段切换 + 文字模式流式讲解
- 断言 A：默认「📷 拍图识题」选中（白底高亮），仅显示选图按钮，无 textarea（截图）。
- 断言 B：先在拍图模式选择一张图片（用已有 /home/ubuntu/q_stream_test.png），图片预览出现；再切「⌨️ 粘贴文字」→ textarea 显示、选图按钮消失；粘贴基期题提交 → 流式讲解正常返回，且讲解内容针对**粘贴的文字题**而非之前选的图片题（图片题与文字题数据不同以区分）。
- 断言 C：答案输入框无"③"序号（对照截图）。

## T2 错题本空态
备份 data.db 至 /tmp/data_v14_backup.db → UI 删除 id=6（确认框 OK）。
- 断言 D：列表清空后显示空态卡：📖 图标 + "错题本还是空的" + 说明文字 + 「去刷题」按钮（截图）。
- 断言 E：点「去刷题」→ switchTab 跳到刷题页（模块卡片可见）。
测后用 python sqlite3 从备份原样恢复 id=6 行（保留 review 状态），API 确认 [6]。

## T3 深色模式（prefers-color-scheme: dark 模拟）
DevTools 独立窗口 + Ctrl+Shift+P "Emulate CSS prefers-color-scheme: dark"（用户指定 CDP/emulation 方式）。
- 断言 F：四个页面（拍题讲解/刷题/错题本/薄弱分析）逐页截图：卡片深色（#23262f 系）、文字浅色可读、tabbar 深色 (#1c1f27)、页面渐变深色，无大面积白底残留（重点检查输入框/textarea/分段控件/模块卡）。

## T4 快速回归（Regression，浅色下）
- 断言 G：刷题页模块卡正常（5 卡+混合）；薄弱分析正常（资料分析 ×1 条形图）。

清理：恢复 id=6（T2 内完成）。更新 test-report.md（v14 置顶）。
