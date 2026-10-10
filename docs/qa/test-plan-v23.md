# 测试计划 v23（P1c：音效开关 + pop 动效 + 成就勋章 + 雷达空态，线上 400px）

Evidence：hash 一致 `assets/index-B5gWKF-M.js`。基线 `/api/mistakes` = **[26, 23, 5, 3, 2]**（全部禁删，只删本轮新增；mastered 均 0 → 勋章"斩题"计数应为 0）。
代码依据：practice.vue L210/L355-358 🔊 toggleSfx（toast「音效已开启/关闭」，localStorage sfxOff=''/'1'）、L360-386 playSfx WebAudio（答对 660+880 双音、答错 220 低音，仅 H5）、L557-562 `.opt.right` pop 0.35s 缩放动画；stats.vue L89-98+L153-168 成就勋章 8 枚（初战告捷 done≥10 / 小有所成 100 / 刷题大师 500 / 三日不辍 streak≥3 / 七日连环 7 / 十连对 bestStreak≥10 / 斩题十道 mastered≥10 / 百题斩 100，未达成灰显+进度文字、达成显示「已达成」）、L33-37 雷达空态（hasRadar=false 时「还没有能力数据」+「去刷题」按钮）。
当前浏览器 pstats：totalDone=35、今天打卡 → 应点亮「初战告捷」，其余 7 枚灰显带进度。

## T1 音效开关（400px，刷题页顶栏）
- 开一组题，顶栏应有 🔊 图标（默认开）。
- 断言 A：点 🔊 → toast「音效已关闭」且图标变 🔇；再点 → toast「音效已开启」变回 🔊。
- 断言 B：console 检查 `localStorage.getItem('sfxOff')`：关闭时为 '1'（uni 包装格式含 "1"），开启时空。
- 断言 C：答一题（音效开）后 console 验证 AudioContext 已创建（如 `performance` 不可查则以答题后无报错 + toast 逻辑为准；预期可通过临时 hook 检查 —— 用 console 读取页面无异常即可，标注方法）。

## T2 pop 动效 + 结构化解析回归
- 断言 D：答对时正确选项绿色高亮（pop 0.35s 瞬时动画以录屏为证，截图为绿框结果态）；答错 shake 不变。
- 断言 E（Regression）：结构化解析卡（正确答案大字母/解析/考点/来源 + 胶囊详解按钮）仍正常。

## T3 成就勋章卡（薄弱分析页）
- 断言 F：出现「成就勋章」卡共 8 枚；「初战告捷 🌱」点亮显示「已达成」；其余灰显且带进度文字（如「小有所成 35/100 题」「斩题十道 0/10 道」「三日不辍 2/3 天」按实际值）。
- 断言 G：像素证明点亮与灰显视觉差异（截图）。

## T4 雷达空态引导卡
- 先 console 备份 localStorage 的 pstats 原值 → 清除 pstats → 刷新。
- 断言 H：五模块能力雷达卡显示「还没有能力数据」+「刷几题就能生成你的五模块能力画像」+「去刷题」按钮（无雷达图）。
- 断言 I：点「去刷题」跳到刷题 Tab。
- 验完 console 写回原 pstats 并刷新确认恢复（勋章/趋势回到原状）。

## T5 桌面侧栏抽查（Regression）
- 断言 J：窗口调 1200px 刷新，左侧侧栏仍在；调回 400px 底部 tabbar。

清理：只 DELETE 本轮新增错题 id（若答错自动入库），确认 `/api/mistakes` 恢复 [26,23,5,3,2]。更新 test-report.md（v23 置顶）。录屏+结构化注释。
