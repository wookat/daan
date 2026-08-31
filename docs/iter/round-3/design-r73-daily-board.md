# R73 设计：每日一练今日排行榜

## 取证（2026-08-31）

- 竞品粉笔每日一练完成后有当日排行榜（名次+成绩+用时），是「全站同题」社交比较的完整形态；我们 R69 只有聚合数（participants/beat_pct），无榜单——比较对象是抽象百分比而非具体的人，弱于竞品。
- 既有可复用形态：PK 周胜场榜（uid 前 6 位+*** 脱敏、top20+my_rank）、模考大赛榜单。daily_set_entries 已有 day/uid/right/total/secs/created_at，无需新表。

## 方案

1. db.daily_set_board(day)：`SELECT uid,right,total,secs FROM daily_set_entries WHERE day=? ORDER BY right DESC, COALESCE(secs,9e9) ASC, created_at ASC LIMIT 20`，uid 脱敏 `uid[:6]+'***'`。
2. GET /api/daily_set/board：uid 无关 → 加入 CF functions API_CACHE_ALLOWLIST（60s TTL，与 daily_set 同策略）。
3. daily_set_submit 返回值补 `my_rank`（= 比我分高的人数 + 1，用时不参与并列名次，保持实现简单；文档如实注明）。
4. practice.vue daily 完成态：dsbeat 行下新增「今日排行榜」卡（top10：名次/脱敏名/答对/用时；我的名次高亮行用 my_rank）。
5. /tiku/daily/ SSR：participants>0 时页尾加 top10 静态榜（SEO 新鲜内容）。

## 非目标

- 不做昵称系统接入（daily 提交无 nickname 通道，本轮沿用脱敏 uid；接入登录昵称列为候选）。
- 不做历史日期榜单页。

## 验收

- board 接口 MISS→HIT 且与 origin 一致；submit 返回 my_rank 与榜单序一致。
- 完成页榜单 1440/375 无溢出、console 0 error；无成绩时不渲染。
- SSR 页榜单渲染正确、无参与者时不出块。
- 测试数据清理。
