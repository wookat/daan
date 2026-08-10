# 轮80：消化 r79 P2 + 三端模考链路核对 + r71-r80 十轮小结

分支 devin/1786323156-r79（PR#118）。

## 1. r79 四项 P2 消化

| # | r79 P2 | 处置 |
|---|--------|------|
| 1 | 下期大赛（第2期）固定 paper 110，active 仅 35 题/55 分钟 | **已换卷**：备份 `/data/bak_r80_event2_paper.db` 后守卫更新（断言无已提交成绩，仅 1 条报名 0 提交）→ 换为 paper 98「2016年山东行测真题」active 95 题/90 分钟；线上 `/api/mock/events` 复验 95题/90分钟 |
| 2 | 恢复弹窗「重新开始」旧 attempt 服务端残留 | **已修**：`db.start_exam_attempt` 开考时自动清理该 uid 超过 24h 未交卷的旧 attempt；线上实测种子 25h 前旧 attempt → 新开考后仅剩新行 |
| 3 | 大赛往期无分页 | 维持现状（当前仅 1 期往期，>10 期再立项分页），已记台账 |
| 4 | 真题卷缺题根因台账 | 已产出覆盖率台账（本目录 `paper_coverage.txt`）：144 张卷中 44 张 active 覆盖率 <60%、4 张 n<5 已隐藏，最差 25 张清单在列（如 132/127/99 卷覆盖率 ≤4%），补齐立项时按此排序 |

## 2. 小程序 / Flutter 模考链路核对（r79 后端改动兼容性）

- `/api/exam/start` 白名单影响面：小程序 exam/mini 页仅渲染 `question/options/opt`，Flutter exam_page 仅用 `question/options/module` + 本地 `_picked/_secs/_marked`——**全部在白名单内，零适配**。
- 报告页两端用的 `answer/explanation/hs_explanation` 均来自交卷后的 `/api/exam/report`（未改动），不受开考白名单影响。
- `question_ids`（PDF 导出）走 `/api/exam/papers/{pid}` 详情，r79 已过滤 active——两端同样受益。
- 大赛 `n_questions`/Flutter `question_count` 兜底逻辑与 active 口径兼容。
- 校验：小程序 tsc+eslint 0 错误；flutter analyze 0 issue。

## 3. r71-r80 十轮小结

- **留存/SRS**（r71-r73）：留存闭环走查无断点；SRS mastered 改完整梯子 1/3/7/15/30 出队（修复 7/15/30 档不可达）；连签双源统一为服务端 answer_log + Asia/Shanghai 日界，换设备/离线不再矛盾。
- **复习增强三端 parity**（r74-r76）：错因自评 chips 写回 error_reason、答错自动加推同类题、月度错题复盘卡——H5 先行验证后复刻小程序/Flutter；上线约 1 天即有真实用户标注错因。
- **SEO/分享**（r77-r78）：试卷详情页增强（模块分布/年份互链/JSON-LD/sitemap lastmod，IndexNow 452 URL）；`/s/{sid}` 分享落地页动态 OG（微信/QQ 爬虫 UA 实测过，无答案泄露）。Yandex 年份页持续到访（日约 60 次），**Bing 收录仍未破零（站长验证仍 P0 外部依赖）**。
- **模考/大赛**（r79-r80）：修三处 P1（开考答案泄露、2,667 处下架题引用致题数虚标/判分错位、大赛同源）；H5 全链路 375px 实测无体验断点；计分/预测分/统计页三口径核对自洽；本轮消化全部 P2。
- **数据现状**：近7天 39 作答/14 uid，growth 与基线持平（share_open 5 等），seo 归因 0——内容与功能线已收口，增长瓶颈在收录/获客。
- **下十轮建议**：① 站长平台验证（Bing/百度）仍是收录破零 P0；② 高价值真题卷缺题补齐立项（按 §1.4 台账排序）；③ 小程序 AppID/订阅模板到位后打通提醒推送闭环；④ 大赛第2期开赛后做首个真实赛事复盘；⑤ 错因/加推埋点样本积累后做复习增强效果复盘。

## 4. 部署 / 回归 / 健康

- `./deploy/deploy_h5.sh`：构建+brotli 77 文件+bundle hash 一致+接口回归 7 项全 200。
- 健康快扫全绿：active 112,962 / full 156,792，<50=0，非JSON=0，乱码=0，hs 一致性 0，空缺仅 2 条台账题（panduan:334296、changshi:655861 不动）；近7天 39/14 uid，growth 基线不变。
- QA 数据零残留（qa_r80_stale 种子已清）。
