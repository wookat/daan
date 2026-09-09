# W17-C1 生成型文案去模板感：真实输出对照台账 + 改写定稿

- 日期：2026-09-09（UTC）。生产 `GET /api/health` → `{"ok":true,"rev":"798c154f"}`（任务背景写的 aa94f602 已被后续部署覆盖，以实测为准）。
- 造数纪律：只用 `test-w17-copy-a/b/c/d` 四个匿名 uid，全部走公开 API（`/api/profile`、`/api/practice_result`、`/api/mistakes`、`/api/review/*`、`/api/exam/start|submit`、`/api/pk/*`、`/api/share/*`、`/api/daily_set/submit`），未触碰保护 uid、未进容器改库、未调 AI 接口。脚本 `prod_fixture.py / prod_fixture2.py`（不入库），原始响应 60 份 JSON 留在会话机 `w17c/raw/`。结束后按 §6 清理并零残留复核。
- **生产限制（一手结论）**：本会话出口 IP 命中 `KG_PROBE_CIDRS` → 所有写入带 `probe=1`，被 `db.REAL_TRAFFIC` 排除在公开统计池外。因此生产只能拿到 **自身可查询** 的分支（成绩报告 / 排名 total=1 或既有 8 人 / 周报 ok·pending·empty / 复习清零 / 计划 / 分享 total=0 / 每日同题 participants=1），而 **rank≥10、模考大赛赛后报告、周报模考行、分享 q_stats≥10、每日同题 ≥10 人、练习百分位** 这些「大样本」分支生产无真人流量可造，只能本地 `uvicorn`（`DB_PATH=w17c/local.db`，14 个浏览器 UA 的本地 uid 参赛）补样，台账「来源」列区分 `prod / local`，不把本地样本说成生产事实。
- 样本量：**76 条**（生产 52 条 / 本地 24 条），其中 58 条需改、18 条判定「保持/不改」。满足「≥40 条真实输出」门槛后才动模板。
- 术语按 w14c §5.1 定稿：专项练习（模块/子模块级）/ 同考点强化（tag3 级，按钮动词写「练同考点」）/ 重练 / 到期错题 / 薄弱考点·弱项 / 超过 P% 的考友（样本 <10：参与人数还少）/ 成绩报告。

## 1. 生产造数与接口实测清单

| uid | 造了什么 | 拿到的接口分支 |
|---|---|---|
| test-w17-copy-a | profile（省考/目标 70/日目标 20）；12 天 answer_log 共 160 题；47 道错题 + 到期复习（先复 8 道未清零，再全部复完清零）；paper 11 两次模考（低分 10.6 / 二战 72.7）+ 迷你模考；PK 发起（0 分负）；分享 1 题 | `/api/exam/report` ×3、`/api/exam/rank`（total=1 / 8）、`/api/report/weekly`（上周 ok n=84 acc 0.607；本周 pending；08-03 周 empty）、`/api/review` total 47→39→0、`/api/reinforce/suggest`、`/api/home_bundle` plan_today 5 任务、`/api/practice_result` samples=2 percentile=null、`/api/daily_set/submit` participants=1 |
| test-w17-copy-b | 从未练习；paper 11 与 C 同分并列；PK 应战胜；分享题作答（错） | weekly empty；`/api/exam/rank` 并列；`/api/share/{sid}` q_stats.total=0 |
| test-w17-copy-c | paper 11 与 B 同分并列 + 全对 100 分；分享题作答（对） | 全对成绩报告 weak_tags=[] |
| test-w17-copy-d | 仅 profile，无任何作答 | home_bundle plan_today（practice_mix / mock 两任务）；weekly empty |

模考报告的 `用时 0 分 0 秒` 是脚本秒交卷的真实返回（`attempt.submitted_at - started_at ≈ 0.3 s`），不是 bug；改后句同样忠实输出。

## 2. 对照台账（现文 = 当前模板逐字复现；改后 = 新纯函数 `frontend-uni/src/exam-copy.js` 输出，小程序同文）

| # | 来源 | 位置 | 现文 | 问题 | 改后 |
|---|---|---|---|---|---|
| S01 | prod | report.vue:26 / report.wxml:59 hero（A 低分 10.6 分） | 答对 7/66（已答 58）· 用时 0 分 0 秒 | 「·」中点串 + 括号嵌套，三段信息一行 | 答对 7/66，8 题未答，用时 0 分 0 秒 |
| S02 | prod | report.vue:26 / report.wxml:59 hero（A 二战 72.7 分） | 答对 48/66（已答 66）· 用时 0 分 0 秒 | 「·」中点串 + 括号嵌套，三段信息一行 | 答对 48/66，用时 0 分 0 秒 |
| S03 | prod | report.vue:26 / report.wxml:59 hero（C 全对 100 分） | 答对 66/66（已答 66）· 用时 0 分 0 秒 | 「·」中点串 + 括号嵌套，三段信息一行 | 答对 66/66，用时 0 分 0 秒 |
| S04 | prod | report.vue:26 / report.wxml:59 hero（A 迷你模考） | 答对 5/30（已答 30）· 用时 0 分 0 秒 | 「·」中点串 + 括号嵌套，三段信息一行 | 答对 5/30，用时 0 分 0 秒 |
| S05 | prod | report.vue:107 / report.wxml:137 无薄弱考点结论（C 全对，weak_tags=[]） | 本卷错题较少，暂未形成薄弱考点结论，继续保持！ | 三句套话叠加，「继续保持！」空洞 | 全对，没有薄弱考点 |
| S06 | local | report.vue:107 结论句（本地 27/30，weak_tags 3 条时不显示；此处为 weak_tags 为空但有错题的分支） | 本卷错题较少，暂未形成薄弱考点结论，继续保持！ | 同上；全对与「错得少」共用一句 | 本卷错题少，看不出薄弱考点 |
| S07 | prod | report.vue:142 / report.wxml:164 错题重练副标（A 低分，答错 51） | 按刷题模式把本卷答错的题重做一遍（本轮先练前 10 题） | 「按刷题模式…重做一遍」冗长，括号补一句 | 答错 51 题，这轮先重练前 10 题 |
| S08 | prod | report.vue:142 错题重练副标（A 二战，答错 18，redoCount 按 buildExamRedoSet ≤10） | 按刷题模式把本卷答错的题重做一遍（本轮先练前 10 题） | 同上 | 答错 18 题，这轮先重练前 10 题 |
| S09 | prod | report.vue:142 错题重练副标（错题 ≤ 重练数，如迷你模考答错 5） | 按刷题模式把本卷答错的题重做一遍 | 「重做一遍」→ 定稿术语「重练」 | 答错 5 题，按刷题模式重练一遍 |
| S10 | prod | report.vue:76 + :68 aria / report.wxml:61 薄弱模块 CTA（A 低分 weakModule 命中「言语理解 本卷正确率 8%，全卷最低」） | 去专项强化 | 「专项强化」非定稿术语（模块级 = 专项练习） | 去专项练习 |
| S11 | prod | report.vue:245 + :243 aria / report.wxml 详情「练同类题」CTA（错题 tag3=成语辨析） | 强化 5 道新题 | 按钮不是动词短语；「强化」与「同考点强化」混用 | 练同考点 |
| S12 | prod | rank-card.vue:10/13 / report.wxml 排名卡（A 低分 total=1） | 参与人数仍较少（1 人），暂不计算击败比例 | 「仍较少」「暂不计算击败比例」啰嗦 | 参与人数还少（1 人），暂不算比例 |
| S13 | prod | report.vue:386 / report.ts:232 hero beatText（A 低分 total=1） | (空) | 空串：<10 不显示是对的，保持 | (空) |
| S14 | prod | rank-card.vue:10/13 / report.wxml 排名卡（A 迷你模考 total=8） | 参与人数仍较少（8 人），暂不计算击败比例 | 「仍较少」「暂不计算击败比例」啰嗦 | 参与人数还少（8 人），暂不算比例 |
| S15 | prod | report.vue:386 / report.ts:232 hero beatText（A 迷你模考 total=8） | (空) | 空串：<10 不显示是对的，保持 | (空) |
| S16 | local | rank-card.vue:10/13 / report.wxml 排名卡（本地 14 人 rank 2） | 79% 已击败（样本 14 人） | 「已击败考生」；小样本括号与卡头「样本 N 人」标签重复 | 超过 79% 的考友 |
| S17 | local | report.vue:386 / report.ts:232 hero beatText（本地 14 人 rank 2） | 击败 79% 考生 | 「击败 P% 考生」 | 超过 79% 的考友 |
| S18 | local | rank-card.vue:10/13 / report.wxml 排名卡（本地 14 人 rank 14 pct 0） | 0% 已击败（样本 14 人） | 「已击败考生」；小样本括号与卡头「样本 N 人」标签重复 | 还没超过其他考友（共 14 人） |
| S19 | local | report.vue:386 / report.ts:232 hero beatText（本地 14 人 rank 14 pct 0） | 击败 0% 考生 | 「击败 P% 考生」 | 还没超过其他考友（共 14 人） |
| S20 | local | contest-report.vue:52 hero-beat / contest-report.wxml:16（本地 90 分 2/14） | 击败 79% 考生 | 「击败 P% 考生」 | 超过 79% 的考友 |
| S21 | local | contest-report.vue:53 hero-line / contest-report.wxml:17（本地 90 分 2/14） | 第 2 名 / 14 人 · 全场平均 63.6 分 | 「·」中点串 | 第 2 名 / 14 人，全场平均 63.6 分 |
| S22 | local | contest-report.vue:52 hero-beat / contest-report.wxml:16（本地 20 分 14/14 pct 0） | 击败 0% 考生 | 「击败 0% 考生」 | 还没超过其他考友（共 14 人） |
| S23 | local | contest-report.vue:53 hero-line / contest-report.wxml:17（本地 20 分 14/14 pct 0） | 第 14 名 / 14 人 · 全场平均 63.6 分 | 「·」中点串 | 第 14 名 / 14 人，全场平均 63.6 分 |
| S24 | local | contest-report.vue:52 hero-beat / contest-report.wxml:16（本地 100 分 1/14） | 击败 93% 考生 | 「击败 P% 考生」 | 超过 93% 的考友 |
| S25 | local | contest-report.vue:53 hero-line / contest-report.wxml:17（本地 100 分 1/14） | 第 1 名 / 14 人 · 全场平均 63.6 分 | 「·」中点串 | 第 1 名 / 14 人，全场平均 63.6 分 |
| S26 | local | contest-report.vue:61 / contest-report.ts:60 统计格 label「击败」 | 击败 79% | label 用「击败」 | 超过考友 79% |
| S27 | local | contest-report.vue:52 note 无薄弱考点（本地 100 分 weak_tags=[]） | 本卷错题较少，暂未形成薄弱考点结论，继续保持！ | 与 report.vue:107 同句 | 全对，没有薄弱考点 |
| S28 | local | weekly-report.vue:98 / weekly-report.ts:160 模考行（本地 上周模考大赛 pct 79，rank 无） | 全站模考大赛 测试期：击败 79% | 「击败 P%」 | 全站模考大赛 测试期：超过 79% 的考友 |
| S29 | local | weekly-report.vue:98 模考行（rank 有值分支） | 全站模考大赛 测试期：第 2 名 · 击败 79% | 「·」+「击败」 | 全站模考大赛 测试期：第 2 名，超过 79% 的考友 |
| S30 | prod | weekly-report.vue:13 / weekly-report.ts:160 空态 desc（B 从未练习 status=empty） | 2026-08-31 ~ 2026-09-06⏎本周刷起来，下周一就能看到你的专属周报 | 「刷起来」「专属周报」营销句 | 2026-08-31 ~ 2026-09-06⏎这周做过题，下周一这里就有周报 |
| S31 | prod | weekly-report.vue:13 / weekly-report.ts:160 空态 desc（A 指定 week=2026-08-03 无记录 status=empty） | 2026-08-03 ~ 2026-08-09⏎本周刷起来，下周一就能看到你的专属周报 | 「刷起来」「专属周报」营销句 | 2026-08-03 ~ 2026-08-09⏎这周做过题，下周一这里就有周报 |
| S32 | prod | weekly-report.vue:22 / weekly-report.ts:168 未结束周 desc（A 本周 status=pending） | 2026-09-07 ~ 2026-09-13⏎周报会在下周一自动生成，先看看上一周的吧 | 「该周尚未结束」公文腔；「自动生成」是系统视角 | 2026-09-07 ~ 2026-09-13⏎周一再来看，先看上一周的 |
| S33 | prod | weekly-report.vue:21 未结束周 title | 该周尚未结束 | 公文腔 | 这周还没过完 |
| S34 | prod | api.js:987 qShareText variant b（B 分享错题 sid=bttwmr74） | 【言语理解】敢不敢挑战这道题？不少人都做错了，答完立刻看你击败了多少人：https://kaogong.zalize.com/s/bttwmr74?v=b | 「不少人都做错了」无数据支撑（该题 q_stats.total=0）；「击败了多少人」 | 【言语理解】这道题我做错了，你试试：https://kaogong.zalize.com/s/bttwmr74?v=b |
| S35 | prod | api.js:989 qShareText variant a（分享自己做对的题） | 【言语理解】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/s/bttwmr74?v=a | 「选了啥」口语随意；未说明自己结果 | 【言语理解】这道题我做对了，你试试：https://kaogong.zalize.com/s/bttwmr74?v=a |
| S36 | prod | api.js:989 qShareText（q-social-bar 无作答结果调用） | 【言语理解】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/s/bttwmr74?v=a | 同上 | 【言语理解】我刚做了这道题，你试试，答完能看到大家选了什么：https://kaogong.zalize.com/s/bttwmr74?v=a |
| S37 | prod | share-q.vue:143 beatText（C 答对后 q_stats.total=0（probe 不计）） | (空) | 空串：total=0 不显示，保持 | (空) |
| S38 | local | share-q.vue:143 beatText（本地 15 人作答 acc 93 答对） | 🏆 你击败了全站 7% 的作答者（共 15 人做过这题） | 「你击败了全站 P% 的作答者」 | 全站 15 人做过这题，你超过了其中 7% |
| S39 | local | share-q.vue:143 beatText（本地 15 人作答 答错） | 全站共 15 人做过这题，正确率 93%，再战同类题赢回来 | 「再战同类题赢回来」口号 | 全站 15 人做过这题，正确率 93% |
| S40 | local | share-q.vue:143 beatText（total<10 分支，构造 total=3） | 🎯 全站第 3 个作答本题的人，把题发给更多考友一起比比 | 🎯 emoji + 「比比」口号；阈值 5 与 rank-card 的 10 不一致 | 全站 3 人做过这题，参与人数还少，先不比 |
| S41 | prod | practice.vue:706 每日同题结果行（A 提交 participants=1（probe 不计）） | 今日全站同题 · 你是今天第 1 位完成者 | 「第 1 位完成者」生硬 | 今日全站同题，你是今天第 1 个完成的 |
| S42 | prod | practice.vue:2295 每日同题分享尾句（A 提交 participants=1（probe 不计）） | (空) | 空：保持 | (空) |
| S43 | local | practice.vue:706 每日同题结果行（本地 13 人 beat 75） | 今日全站同题 · 13 人完成 · 击败 75% | 「·」串三段 + 「击败」 | 今日全站同题，13 人完成，超过 75% 的考友 |
| S44 | local | practice.vue:2295 每日同题分享尾句（本地 13 人 beat 75） | ，击败全站 75% | 「击败全站 P%」 | ，超过 75% 的考友 |
| S45 | local | practice.vue:706 每日同题结果行（本地 重复提交 already） | 今日全站同题成绩已记录（首次 7 对） · 13 人完成 | 「·」串三段 + 「击败」 | 今日全站同题成绩已记录（首次 7 对），13 人完成 |
| S46 | local | practice.vue:2295 每日同题分享尾句（本地 重复提交 already） | ，击败全站 75% | 「击败全站 P%」 | ，超过 75% 的考友 |
| S47 | prod | practice.vue:189 本组百分位（A 生产 samples=2 percentile=null） | (空) | 生产真人 practice_results 样本不足 → 该句不出现，保持 | (空) |
| S48 | local | practice.vue:189 本组百分位（本地 samples=13 percentile=77） | 本组正确率击败了 77% 的刷题记录 | 「击败了」 | 本组正确率超过 77% 的刷题记录 |
| S49 | local | practice.vue:2311 本组分享尾句 | ，击败了 77% 的刷题记录 | 「击败了」 | ，超过 77% 的刷题记录 |
| S50 | prod | practice.vue:249 弱项行按钮（A plan.weak 排列组合与概率 14%） | 强化 5 道新题 | 与 report/book 三处叫法不一 | 练同考点 |
| S51 | prod | review-summary.js:73 reviewDoneCopy 未清零（A 到期 47，本组 8） | 本组 8 道复习完成 · 还有 39 道到期待复习 | 「·」+「到期待复习」四字叠 | 本组 8 道复习完成，还有 39 道到期 |
| S52 | prod | review-summary.js:76 reviewDoneCopy cta（剩 39，REVIEW_BATCH=20） | 继续复习下一组（20 道）› | 保持（事实句） | 继续复习下一组（20 道）› |
| S53 | prod | review-summary.js:79 reviewDoneCopy 清零（A 复习 82 道后 /api/review total=0） | 82 道到期错题全部复习完成，遗忘曲线稳住了 | 「遗忘曲线稳住了」拟人套话 | 82 道到期错题全部复习完成 |
| S54 | prod | review-summary.js reviewVerdict 复习答错（A 复习答错，next 1 天） | 又错了，看讲解（稍后本轮会再出现）（下次复习：1 天后） | 双重括号 | 又错了，看讲解，稍后本轮会再出现（下次复习：1 天后） |
| S55 | prod | book.vue:106 头部提示（A 复习清零后 due=0，待掌握 47） | 今日没有到期错题 · 待掌握 47 · 已掌握 0 | 「·」串三段 | 今天没有到期错题，待掌握 47，已掌握 0 |
| S56 | prod | book.vue:71 复习小结强化建议 meta（A picked=古典概率） | 数量关系 · 排列组合与概率 · 掌握度 42%（入门） | 「·」串三段 | 数量关系 · 排列组合与概率，掌握度 42%（入门） |
| S57 | prod | book.vue:78 复习小结未清零时次按钮 | 强化 5 道新题 | 叫法不一 | 练同考点 |
| S58 | prod | book.vue:83 复习清零后主按钮 | 强化 5 道新题（未做过）› | 叫法不一；「未做过」括号补丁 | 练同考点：5 道没做过的题 › |
| S59 | prod | book.vue:1949 错题长按菜单 | 同考点强化 5 道新题 | 动名词混搭 | 练同考点 5 道新题 |
| S60 | prod | book.vue:172 重练入口副标（A 待掌握 128 道） | 把待掌握错题按刷题模式重做一遍（最多 10 题） | 「重做一遍」→「重练」 | 重练待掌握的错题，一次最多 10 题 |
| S61 | prod | reminders.wxml:33-34（A goal=20 done=160） | 今日目标已达成，保持手感再练一组？ / 今日目标 20 题已完成 160 题 | 「保持手感再练一组？」「守住连续打卡～」口号 | 今日目标已完成 / 今日目标 20 题，已做 160 题 |
| S62 | prod | reminders.wxml:33-34（D 新用户 goal=20 done=0） | 今晚还差 20 题就能守住连续打卡 / 今日目标 20 题已完成 0 题，练完守住连续打卡～ | 同上 | 今天还差 20 题到目标 / 今日目标 20 题，已做 0 题 |
| S63 | prod | plan.py plan_today[review]（A） | 错题复习 6 道 / 到期的都复习完了，今天新错的 82 道想练随时练 | 判定：事实句，术语与定稿一致，不改 | 错题复习 6 道 / 到期的都复习完了，今天新错的 82 道想练随时练 |
| S64 | prod | plan.py plan_today[reinforce]（A） | 同考点强化：平面几何 5 题 / 复习完还是薄弱，掌握度 46% | 判定：事实句，术语与定稿一致，不改 | 同考点强化：平面几何 5 题 / 复习完还是薄弱，掌握度 46% |
| S65 | prod | plan.py plan_today[practice_0]（A） | 专项练习：排列组合与概率 18 题 / 正确率偏低，最近正确率 14% | 判定：事实句，术语与定稿一致，不改 | 专项练习：排列组合与概率 18 题 / 正确率偏低，最近正确率 14% |
| S66 | prod | plan.py plan_today[practice_1]（A） | 专项练习：几何问题 12 题 / 正确率偏低，最近正确率 0% | 判定：事实句，术语与定稿一致，不改 | 专项练习：几何问题 12 题 / 正确率偏低，最近正确率 0% |
| S67 | prod | plan.py plan_today[mock]（A） | 本周模考 1 次 / 这周已经做过了 | 判定：事实句，术语与定稿一致，不改 | 本周模考 1 次 / 这周已经做过了 |
| S68 | prod | plan.py plan_today[review]（A 复习清零后） | 错题复习 6 道 / 到期的都复习完了 | 判定：事实句，术语与定稿一致，不改 | 错题复习 6 道 / 到期的都复习完了 |
| S69 | prod | plan.py plan_today[reinforce]（A 复习清零后） | 同考点强化：古典概率 5 题 / 复习完还是薄弱，掌握度 42% | 判定：事实句，术语与定稿一致，不改 | 同考点强化：古典概率 5 题 / 复习完还是薄弱，掌握度 42% |
| S70 | prod | plan.py plan_today[practice_0]（A 复习清零后） | 专项练习：排列组合与概率 18 题 / 正确率偏低，最近正确率 14% | 判定：事实句，术语与定稿一致，不改 | 专项练习：排列组合与概率 18 题 / 正确率偏低，最近正确率 14% |
| S71 | prod | plan.py plan_today[practice_1]（A 复习清零后） | 专项练习：几何问题 12 题 / 正确率偏低，最近正确率 0% | 判定：事实句，术语与定稿一致，不改 | 专项练习：几何问题 12 题 / 正确率偏低，最近正确率 0% |
| S72 | prod | plan.py plan_today[mock]（A 复习清零后） | 本周模考 1 次 / 这周已经做过了 | 判定：事实句，术语与定稿一致，不改 | 本周模考 1 次 / 这周已经做过了 |
| S73 | prod | plan.py plan_today[practice_mix]（D 新用户） | 综合刷题 15 题 / 先做起来，攒够错题才看得出弱项 | 判定：事实句，术语与定稿一致，不改 | 综合刷题 15 题 / 先做起来，攒够错题才看得出弱项 |
| S74 | prod | plan.py plan_today[mock]（D 新用户） | 本周模考 1 次 / 真题卷或迷你模考都算 | 判定：事实句，术语与定稿一致，不改 | 本周模考 1 次 / 真题卷或迷你模考都算 |
| S75 | prod | plan.weak reason（A，home.vue 焦点句素材，W17-H1 负责） | 正确率偏低 · 最近正确率 14% | 判定：db.py reason 四档为事实词，不改 plan.py | (不改) |
| S76 | prod | plan.weak reason（A，home.vue 焦点句素材，W17-H1 负责） | 正确率偏低 · 最近正确率 0% | 判定：db.py reason 四档为事实词，不改 plan.py | (不改) |

## 3. 判定与取舍

1. **相对排名一句话**统一为 `rankLine(total, pct)`：`total<10 → 参与人数还少（N 人）`；`pct=0 → 还没超过其他考友（共 N 人）`（本地 S18/S19/S22 实测到 `击败 0% 考生`，必须单独处理）；否则 `超过 P% 的考友`。report.vue / rank-card / contest-report / weekly-report / poster / share-q / practice 七处只保留这一种写法；rank-card 大样本时不再重复「（样本 N 人）」（卡头已有 `样本 N 人` 标签）。
2. **周报模考行**：`/api/report/weekly.mock` 没有 `total`，无法在前端套 <10 规则，本轮只改措辞（S28/S29）；补 `total` 需改 `report.py`（不在本项 files），记入 not_done。
3. **share-q 阈值**从 5 提到 10，与 rank-card 一致（S40）。分享文案 `qShareText(mod, sid, correct)` 第三参可选：book.vue 传 `false`（错题分享）、share-q 传 `myResult.correct`、q-social-bar（不在本项范围）仍两参 → 中性句 S36；A/B `?v=` 参数保留在 URL 里不动。
4. **plan.py**：S63–S74 12 条 plan_today 样本里，`review/reinforce/mock/practice_mix` 均为事实句、术语与定稿一致，不改；唯一模板感是 `practice` 任务 `正确率偏低，最近正确率 14%`（S65/S66/S70/S71，「正确率」一屏两现），把 reason=正确率偏低 这一档改为 `最近正确率只有 14%`，其余三档（近期退步 / 久未练习 / 巩固提升）保留 `reason，最近正确率 X%`；用 `backend/tests/test_w17_copy_snapshot.py` 锁四档输出。`plan.weak.reason`（S75/S76）是 home.vue 焦点句素材，归 W17-H1，不动。
5. **保持不改**：S13/S15/S37/S42/S47/S52 六处空串或事实句；`weekly-report` 「本周未模考 · 下一场：…」两段中点未超三段，不动。
6. **reminders**：小程序 `reminders.wxml:33-34` 在本项 files 内已改（S61/S62）；H5 `pkgA/settings/reminders.vue:62-63` 与 `reminder.js:54` 同句不在本项 files，记入 not_done 待同步。

## 4. 快照测试

- `frontend-uni/tests/w17-copy.test.js`（49 例）：台账 43 条「需改」样本按 id 逐条断言 输入 → 改后（S01–S09/S12/S14/S16–S25/S27–S32/S34–S36/S38–S41/S43–S46/S48/S49/S51/S53/S54），并断言输出 ≠ 现文且不含禁词；6 条「保持」空串分支；小程序 `review-verdict.ts` 与 H5 `review-summary.js` 同句；范围内 16 个 H5/小程序源文件禁词 0 命中 + 新字符串源锁 + 模板直调纯函数必须挂 `methods`。
- `backend/tests/test_w17_copy_snapshot.py`（3 例）：`plan._practice_sub` 四档 reason 副标 + `_review_sub` 不变快照。
- 本地 dist 截图（uvicorn :8765 挂 `dist/build/h5`，本地 14 人模考池）375/1440 各 7 张：report-mid/report-low/contest-report/weekly(ok 含模考行)/weekly-empty/weekly-pending/book。**截图抓到一处真实缺陷**：`weekly-report.vue` 模板直调 `weeklyEmptyDesc/weeklyPendingDesc/weeklyMockLine` 但未挂到 `methods`，dist 下 `TypeError: t.weeklyEmptyDesc is not a function` → 空态/未结束态整页空白、模考行不渲染；已补 `methods` 并在 w17-copy.test.js 加源锁。教训：Vue 模板里直接调用 import 的函数，vitest 纯函数测试测不出，必须 build 后跑一遍页面。

## 5. 全仓禁词 grep（改后，`frontend-uni/src` / `miniapp-native/miniprogram` / `backend/app`，旧 `frontend/` 已弃用不计）

- 验收四词 `专项突破 / 去专项强化 / 击败 .{0,6}考生 / 专属周报`：**0 命中**。`遗忘曲线稳住 / 不少人都做错了`：0 命中。
- 本项 files 之外仍有「击败」（如实记录，未改）：`miniapp-native/miniprogram/pages/share/share.ts:12`（你击败了全站 P%）、`pkgGrow/daily/daily.ts:73/410`（每日同题 击败 P% / 击败全站）、`pages/practice/practice.wxml:155`（本组正确率击败了 P%）、`backend/app/push_api.py:91`（推送「能击败多少人」）、`backend/app/seo/pages.py:210`（SEO「击败全站百分比」）；`backend/app/db.py/team.py` 的命中是代码注释。另 H5 `pkgA/share/pk-result.vue:15` 四段中点串（生产实测「测试乙 获胜 · 言语理解 · 同组 10 题 · 挑战码 KBZRUN」）不在本项 files。

## 6. 生产回归与清理

- 生产 H5 未部署本分支（本项不部署），因此生产截图是 **改前基线**（同一批 uid，rev 798c154f 时造数、截图时 `/api/health` 已变为 `e720e8cc`，为其它并行工作项部署，与本项无关）：`report-a-low`（答对 7/66（已答 58）· 用时…/参与人数仍较少（1 人），暂不计算击败比例/去专项强化）、`report-c-full`（本卷错题较少…继续保持！）、`weekly-a`、`book-a`（把待掌握错题按刷题模式重做一遍）、`pk-result`（KBZRUN）各 1 张 375；改后效果以本地 dist 截图为证，部署后需再复看一次。
- 清理：容器内脚本（会话机 `w17c/clean_uid.py`，不入库）遍历所有含 `uid/from_uid/to_uid/creator_uid/opponent_uid` 列的表按 `LIKE 'test-w17-copy-%'` 删除，另按 6 个 attempt id 清 `attempt_id` 子表、按 `pk_matches.code` 清 PK 子表。`ro` 计数 882（mistakes 188 / answer_log 516 / review_log 158 / exam_attempts 6 等 13 张表）→ `clean` → 再 `ro` TOTAL 0；独立第二脚本按「列名含 uid」全表扫 LEFTOVER 0、`pk_matches.code=KBZRUN` 0、attempt 381–386 0。未触碰保护 uid 与任何真实用户数据，未改服务器/配置。
