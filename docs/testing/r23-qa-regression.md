# 轮23 发现线：轮22 新功能生产回归 + 全站 QA + 数据巡检

日期：2026-08-09 ｜ 生产站：https://kaogong.zalize.com ｜ 结论：**无 P0/P1；P2 三项 + 需求差异一项**

## 问题清单

| 级别 | 问题 | 说明 |
|---|---|---|
| P2 | 我的页顶部「连续打卡」与徽章墙「当前连续」同屏不一致 | 顶部取本地 pstats、徽章墙取服务端按 uid 的 answer_log；换匿名 uid 后本地未同步，用户视角迷惑 |
| P2 | PK 战绩落地页双方昵称可能相同 | 昵称存本地，同浏览器双 uid 时必现；真实两台设备无此问题，仅观感一般 |
| P2 | share-q 答对显示「击败 0% 的作答者」 | 其余作答者全对时百分位为 0，答对却 0% 文案挫伤感，建议答对时换文案 |
| 需求差异 | 「无对手自动开局」分支不存在 | random_match 无等待局时只新建 waiting 局、无机器人对手；本轮用第二个测试 uid join 完成对局。请确认是否为预期 |
| 埋点口径 | 无效 rid 打开 pk-result 也记 pk_result_open | 事件计数会含无效访问，分析时留意 |

另：早前一次 curl /tiku/papers 见 404，复测三次均 301→/tiku/papers/ 且 200，未复现，判定偶发。

## A. 轮22 回归（全部通过）

- 徽章墙：6 枚（3/7/14/30/60/100），当前连续/历史最长正确；3天🏅已解锁、7天🔒
- 连刷 3 天（测试 uid 造数据）→ 练习页作答触发「🏅 解锁新徽章」弹窗 → 跳海报（弹窗由本地 pstats.days 驱动）
- 海报 poster?badge=3：标题「连续打卡 3 天徽章」+ 二维码 + kaogong.zalize.com
- /api/checkin/badges 无 uid → 422 优雅报错
- PK 完整链路：创建→双 uid 完局（474:560）→晒战绩复制（剪贴板含比分+pk-result?rid=V0K3J2）→匿名打开落地页（昵称/比分/胜者👑/不服来战）
- 埋点落库核对：pk_result_open(source=pk_share)、pk_result_copy、badge_unlock(ref=3) 均在 growth_events
- 边界：rid=ZZZZZZ / 未结束局 EP6F1H → 页面「战绩不存在或对局未结束」，API 404 非 500

## B. 轮21 抽查（全部通过）

share-q「击败 X%」（0%/40% 两例）；一键入队 CTA 加入成功；周战报复制（含邀请码 A9ODCD）。

## C. 全站快扫（全部通过）

刷题判分/解析、模考入口、统计页、错题本、AI 拍题访问码弹框、/tiku/ 200、/tiku/papers 301、q/1273654 与 q/1046924 详情+JSON-LD、深色模式（测后已还原「跟随系统」）。375px 全程覆盖。

## D. 数据巡检（SSH 只读快照，2026-08-09）

- growth_events（本轮测试前）：share_open 4、share_answer 2、share_copy 2、share_team_join 2、team_report_copy 2、team_invite_copy 1、team_join_open 1；全部为近 24h（多为轮22 QA 测试事件）。pk_result_*/badge_unlock 测试前为 0（功能刚上线，属预期）
- answer_log：总 1262 行，近 7 日 529；source 分布：NULL 1256、share 6
- 7 日活跃 distinct uid：24（大头为测试 uid：r88b-test1 325 行、u7/u8/u9、umsa00d6v2903o11n 60 等；真实自然流量占比低）
- docker logs 最近 24h：ERROR/Exception 0 条、5xx 0 条

## 测试 uid / 副作用清单（便于清理，均本轮新建）

| uid | 副作用 |
|---|---|
| qa23-badge-1 | answer_log 5 行（手工 INSERT id 2078/2079/2080 + UI 作答 2）、mistakes id 533、pk_matches V0K3J2 creator、badge_unlock 事件 |
| qa23-pk-opp-1 | V0K3J2 opponent、pk_result_copy 事件 |
| qa23-viewer-1 | answer_log 2 行（source=share）、shared_answers 2 行、pk_result_open×4、已加入 team 4（QA回归22队） |

growth_events qa23% 共 13 行；可按 `uid like 'qa23%'` 统一清理（answer_log 另有 source='qa23' 行）。
