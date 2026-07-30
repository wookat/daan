# 测试计划 v15（题库扩充 699 题 + 刷题详解入口，H5 400px 视口）

Evidence: practice.vue L51（答题后 .deep 行「🔍 用花生十三方法详解这道题 ›」）、L140-145（deepExplain：redoQuestion=题干+`A.xx B.xx…` → switchTab /pages/ask/ask）；ask.vue L96-106（onShow 读 redoQuestion → mode='text'、qtext 回填、uanswer 清空、toast"题目已填入，先自己做一遍再点讲解"）。后端已由我重启（旧进程 20179 21:00 早于 jsonl 21:57 修改；新 PID 24322，env 绑定 secret，environ 无 `secret:` 字面值、LLM_BASE_URL=https），`/api/questions` counts：changshi162/ziliao148/shuliang135/panduan132/yanyu122 合计 699。H5 构建 21:38 新鲜。DB 仅 id=6。

## T1 模块卡片显示新题数
- 断言 A：刷题页 5 张模块卡题数 = 资料分析148/数量关系135/言语理解122/判断推理132/常识判断162（截图，与 API counts 一致；旧值 3/3/2/2/2 若出现则为旧进程/旧构建）。

## T2 答 1 题 → 详解入口闭环
任选模块（资料分析）答第 1 题（任意选项，无需对错）。
- 断言 B：答题后解析下方出现「🔍 用花生十三方法详解这道题 ›」行。
- 断言 C：点击 → 自动切到拍题讲解 tab，页面处于「⌨️ 粘贴文字」模式，textarea 已填入该题题干+ABCD 选项文本（与刷题页题目一致），答案框为空，出现 toast"题目已填入…"（toast 短暂，尽量捕获，否则 inconclusive）。
- 断言 D：点「用花生十三方法讲解」→ 流式讲解正常返回，内容针对该题（数字对应），答案与题库 answer 一致（预取 API 对照）。

## T3 按模块取题正常（API 抽查）
- 断言 E：`/api/questions?module=yanyu&limit=10` 返回 10 条且全部 module=yanyu。

清理：若 T2 产生存入错题则删除；确认 /api/mistakes 仅 [6]。更新 test-report.md（v15 置顶）。
