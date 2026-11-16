# 轮22 第一部分：轮21 新功能生产回归报告

日期：2026-08-09 ｜ 生产站：https://kaogong.zalize.com ｜ 结论：**API 层 + UI 层全部通过，未发现 P0/P1/P2 问题**

## A. API 层回归（curl 直连生产 + 服务器 DB 核对）

| 检查项 | 结果 |
|---|---|
| `POST /api/share/create` 返回 `module/submodule`（sid=ys8efj8y，题 1273654 数量关系·最值问题） | ✅ |
| `GET /api/share/{sid}` 返回 `team_invite`（QA回归22队 / A9ODCD / n_members） | ✅ |
| `POST /api/share/{sid}/answer` 答对返回 `q_stats.beat_pct`（1 人时 0%，2 人 1 对 1 错时 50%） | ✅ |
| 答错返回 `q_stats.acc` 全网正确率（50%） | ✅ |
| `/api/track` 白名单：share_copy / share_team_join / team_invite_copy / team_report_copy 均 `{"ok":true}`，非法事件 400「无效事件」 | ✅ |
| 服务器容器 `/data/data.db` growth_events 落库核对：4 个事件各 1 条（uid=qa22track，source/ref 正确） | ✅ |

## B. UI 层回归（375px 移动宽度 + 录屏）

详见 `docs/testing/r21-ui-report.md`（5 项检查全过：击败 X% 显示、一键入队、答错正确率+再战、周排行/卷王/周战报文案、分享文案模块钩子、微信内双页 title）。

## 测试账号 / uid 清单（均为本次测试新建，未动任何既有生产数据）

| uid | 用途 |
|---|---|
| qa22a23735（QA甲） | 分享者，创建 sid=ys8efj8y 与小队「QA回归22队」（A9ODCD，team id 4） |
| qa22b15829（QA乙） | API 答对（beat_pct 验证） |
| qa22c*（QA丙） | API 答错（acc 验证） |
| qa22track | 埋点落库验证 |
| umsld2d9uz0kvbt0u（考友5IZI） | UI 答对 + 一键入队 |
| umsld4j8s455ofc9m（考友0ZJT） | UI 答错 + 分享文案验证（sid=vxyle64e） |

副作用：题 1273654 answer_log +4（source=share）；growth_events 新增少量测试事件；QA回归22队现 2 人。

## P2 及以下记录

无新增。
