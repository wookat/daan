# 测试计划 v12（薄弱分析条形图重设计 + 存题去重，H5 400px 视口）

Evidence: stats.vue L6-14（新结构：.blabel 在 .bar 外部上方，label 左 + ×N 右）、L61-63（.blabel flex space-between；.bar 20rpx 细胶囊 var(--brand-soft)；.fill 渐变 #6366f1→#4f46e5 圆角 999rpx）——旧版为条内白字，若未生效将看到数字/文字叠在粗条内。db.py L44-53（save_mistake：question_text 命中已有记录直接返回 dup id，不插入）。服务 :8000 真实 secret 运行（environ 无 secret: 字面值），H5 构建 20:25 新鲜，DB 仅 id=6。

## T1 新条形图样式（核心，UI 截图）
造数：POST /api/mistakes 造 3 条不同模块错题（ziliao×已有 id6 基期计算、panduan 判断推理、shuliang 数量关系），使模块分布有 3 行不同宽度条。
- 断言 A：400px 薄弱分析页截图：每行为「模块中文名（左）+ ×N（右）」在进度条**上方外部**，进度条为细胶囊渐变条，条内**无文字**；三个模块中文名（资料分析/判断推理/数量关系）与数量正确、宽度按占比不同。
- 断言 B：高频错题型 TOP10 卡片仍正常显示题型 ×N。

## T2 存题去重（API）
- 断言 C：对同一 question_text 连续 POST /api/mistakes 两次 → 两次返回相同 id；GET /api/mistakes 中该题干只有一条。
- 断言 D：不同 question_text 返回新 id（T1 造数已隐含验证，明确记录）。

## T3 错题本回归（Regression）
- 断言 E：错题本页列表正常渲染 4 条（3 造数 + id6），tag/时间/重做/删除按钮无破版（截图）。

清理：DELETE 全部造数条目，DB 恢复仅剩 id=6；薄弱分析回到仅资料分析。更新 test-report.md（v12 置顶）。说明：按 lead 要求本轮以截图为主，不录长录屏（浏览器操作简单，仍会短录屏标注以便回看）。
