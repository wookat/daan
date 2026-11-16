# R74 设计：每日一练榜单昵称化

## 取证（2026-08-31）

- R73 榜单展示名为脱敏 uid（`umtgla***`），竞品（粉笔每日一练/模考榜）均展示用户昵称；本站其余全部榜单形态已统一走昵称：PK/小队/模考大赛前端提交都带 `pkNickname()`（登录昵称 → 手机尾号化名 → 匿名稳定随机化名，api.js 742–756），mock_event 服务端 `_alias` 用留存昵称、缺失回退 uid 派生化名。
- daily_set_submit 是全站唯一不带 nickname 的成绩提交通道；daily_set_entries 无 nickname 列。
- 生产 growth/answer 数据本轮无新增归因信号（slow_load 自 R71 部署后 15h 零新增——首个正向观察点，样本尚小继续观察；share_open 7d 仅 15 次且 8 次无 sid、多为测试），故本轮按竞品差距选题。

## 方案

1. db `_ensure_daily_set`：PRAGMA 检查缺列则 `ALTER TABLE daily_set_entries ADD COLUMN nickname TEXT`（复用 mock_event 迁移形态）。
2. `daily_set_submit(day, uid, right, total, secs, nickname=None)`：首次 INSERT 落 nickname（幂等语义不变，重复提交不改成绩也不改昵称）。
3. `daily_set_board`：SELECT 补 nickname，展示名 = 清洗后昵称，缺失回退 `uid[:6]+'***'`（存量行为）。
4. POST /api/daily_set/submit：透传 body.nickname（strip[:20]，'null'/'undefined' 视为空）。
5. practice.vue submit data 补 `nickname: pkNickname()`（import 既有）。SSR/完成页榜单展示零改动（沿用 name 字段）。

## 非目标

- 不做头像；不回填存量行昵称（当天数据自然滚动）。

## 验收

- 新提交榜单显示昵称（匿名=考友XXXX 稳定化名，登录=账号昵称）；无昵称存量行仍显示脱敏 uid。
- submit 幂等不回归；board/SSR 渲染正常；1440/375 无溢出、console 0 error；测试数据清理。
