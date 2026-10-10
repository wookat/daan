# 测试计划 v11（举一反三答错存入错题本，H5 400px 视口）

Evidence: ask.vue L56-61（按钮 `v-if="r.sim.correct && r.sim.picked !== r.sim.correct"`，仅答错显示；点击 saveSim 后变"✓ 已存入错题本"disabled）；L255-270（saveSim：POST /api/mistakes，question_text=去掉"## 练习题/## 提示"的题干，user_answer=所选、correct_answer=解析中提取的字母、explanation=完整题目+解析，module/question_type 继承原题）；新存错题 next_review 为 NULL → 立即出现在 /api/review 待复习中（book.vue 复习模式可作答）。服务 :8000 真实 secret 运行中，H5 构建 20:09 新鲜，DB 仅 id=6。

## T1 答错 → 存入错题本按钮出现并可存
拍题讲解页粘贴基期题讲解（流式）→ 点「举一反三」→ 出练习题后从解析提取正确字母（记为 X），故意点一个 ≠X 的选项。
- 断言 A：解析展开后按钮行出现「用花生十三方法详解这道题」+「存入错题本」两个按钮（答错才有第二个）。
- 断言 B：点「存入错题本」→ 按钮变"✓ 已存入错题本"且 disabled；再点无重复入库（API 查 /api/mistakes 数量仍 +1）。
- 断言 C：切错题本 tab：新条目出现，题干为练习题文本（无"## 练习题/## 提示"标题），module tag 继承原题（资料分析-xx），展开可见完整解析；`user_answer/correct_answer` 通过 API 校验为所选错项/正确字母。

## T2 答对 → 不出现存入按钮
再出一道举一反三题（同卡片可再点举一反三或用详解新卡），这次点正确选项 X。
- 断言 D：解析展开后按钮行只有「用花生十三方法详解这道题」，**无**「存入错题本」（截图证明）。

## T3 新错题进入复习模式可作答
错题本页顶部应出现"📚 有 1 道错题待复习"（新存条目 next_review=NULL 即到期；id=6 不到期）。
- 断言 E：点卡片进入复习：显示练习题题干+A-D 选项；点正确字母 X → X 绿、其余淡、"答对了！（下次复习：N 天后）"+解析展开；「完成复习」回列表，待复习卡片消失，该条显示"已复习1次"。

清理：DELETE 测试存入的错题，DB 恢复仅 id=6。更新 test-report.md（v11 置顶）。
