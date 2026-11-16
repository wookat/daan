# 轮21 生产 UI 回归报告（https://kaogong.zalize.com）

日期：2026-08-09 ｜ 环境：生产站，Chrome 375px 移动宽度，全程录屏 ｜ 数据：分享 sid=ys8efj8y（题 1273654，答案 C），小队「QA回归22队」邀请码 A9ODCD

## 结论：5 项检查全部通过，未发现 P0/P1/P2 问题

| # | 检查项 | 结果 |
|---|---|---|
| 1a | share-q 新 uid 答对 → 「🏆 你击败了 33% 的作答者（共 3 人做过这题）」 | ✅ |
| 1b | 「和 QA甲 组队刷题」一键加入 → toast 加入成功，卡片变「🎉 已加入「QA回归22队」」+「看队友 ›」直达小队面板 | ✅ |
| 1c | 另一新 uid 答错 → 「共 4 人做过这题，正确率 50%，再战同类题赢回来」（无击败字样，组队卡片仍在） | ✅ |
| 2a | 小队面板 `#/pkgA/team/team?id=4`「🏆 本周队内排行」：按周题数降序，榜首「卷王」标 + 本人「我」标 + 「本周 N 题」 | ✅ |
| 2b | 「复制周战报」剪贴板：`📊刷题小队「QA回归22队」本周战报：全队共刷 1 题，打卡 1 人天，卷王是「考友5IZI」（1 题）。…邀请码 A9ODCD，点链接加入：…/#/pages/team/join?code=A9ODCD`（题数/人天与面板一致） | ✅ |
| 3 | 刷题页题卡「分享给队友」剪贴板：`【最值问题】我刚做了一道题，你能做对吗？答完就能看到大家选了啥：…share-q?sid=vxyle64e`（含二级模块+挑战语） | ✅ |
| 4a | MicroMessenger UA（CDP setUserAgentOverride）下 share-q document.title = 「QA甲 考了你一道最值问题题，你能做对吗？- 考公助手」 | ✅ |
| 4b | 同 UA 下 `#/pages/team/join?code=A9ODCD` document.title = 「队友邀请你加入刷题小队，一起打卡冲上岸 - 考公助手」 | ✅ |

## 截图证据
- 答对击败率条：https://app.devin.ai/attachments/da2dc580-8132-4241-bdd6-0c85a700295f/ss_306f3bc8.png
- 一键加入成功（已加入卡片）：https://app.devin.ai/attachments/f840321b-87ef-4157-9ed9-c9a1b2351d7b/ss_ccc2240c.png
- 小队面板周排行+卷王+周战报 toast：https://app.devin.ai/attachments/737dfb3a-a2be-418b-87db-9b770de99cb8/ss_f3b37252.png
- 答错全网正确率+再战引导：https://app.devin.ai/attachments/245b0238-f6fe-48b4-b66a-e421f2b8688a/ss_51bb413c.png
- team join 页微信 title（页头可见）：https://app.devin.ai/attachments/053d5537-7a92-462e-a0d3-e5587076d16a/ss_2e5edce5.png

## 测试产生的 uid / 数据（均为测试数据，未删除任何既有生产数据）
- uid A `umsld2d9uz0kvbt0u`（昵称 考友5IZI）：share-q 答对（选 C）、加入 QA回归22队（队现 2 人：QA甲 + 考友5IZI）
- uid B `umsld4j8s455ofc9m`（昵称 考友0ZJT）：share-q 答错（选 A）、练习模式答对 2 题（最值问题，无错题本写入）、创建分享 sid=vxyle64e（题：2009 河北最不利构造题）
- 附带副作用：题 1273654 answer_log 新增 2 条（1 对 1 错，source=share）；uid B 练习 answer_log 2 条（source=practice，全对）；growth_events 新增 share_answer / share_team_join / team_report_copy / share_copy 等事件

## 备注
- 练习页答对默认 1.2s 自动跳题，测试第 3 项时先经「···练习工具」关闭「答对自动跳下一题」再答题，属正常 UI 操作。
- 微信 title 验证通过 CDP（ws://localhost:29229，suppress_origin）设 UA 后真实加载页面读取 document.title，UA 确认含 MicroMessenger。

录屏：/home/ubuntu/screencasts/rec-f15d6a53-34f3-46c8-930f-bd64907a5ed7/rec-f15d6a53-34f3-46c8-930f-bd64907a5ed7-edited.mp4
