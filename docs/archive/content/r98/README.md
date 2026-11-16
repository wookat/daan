# 轮98：例行发现线——r95-r97 变更线上回归 + 数据/爬虫观测

日期：2026-08-10。分支 devin/1786341111-r96（PR#123）。零代码/零生产内容变更轮；QA 数据已全清。

## 1. r95-r97 变更线上回归（全过，P0/P1 无）

- 骨架屏双色态（r95）：375px 首页浅色/深色（prefers-color-scheme 仿真）各实测——初始 9 处
  `.skel` 占位渲染，数据到位后全部正常退出（浅色 ~1s、深色 ~1s），模块列表/计划卡/公告完整
  呈现，深色 body 背景正确（rgb(21,22,28)），双态截图留存，JS 错误 0。
- 部署预热无副作用（r97 部署曾跑预热）：近 24h `exam_attempts` 新增 **0**（预热刻意不打
  /api/exam/start 的设计持续有效），预热端点均为只读 GET。
- CSP 下全站功能（r97）：首页/练习/错题本/统计/模考/tiku SEO 页/s 分享跳转 7 页 + 练习页
  tag3 直链真实作答一题（选项点击→判定→解析揭晓正常），CSP violation **0**、JS 错误 0
  （仅 favicon.ico 静态 404，r96 已记 P3 非本轮引入）。
- admin 限流不误伤（r97）：普通匿名 API 连发 30 次全 200（错误 token 限流是独立
  `admin_token_fail` bucket，不挂普通用户）；无 token 访问 /api/admin/stats 401；
  正确 token 容器内验证 200（r97 已验，本轮通道未变）。
- 错题本安全修复持续生效（r96）：伪造 uid 读他人成绩报告 404、伪造 uid PATCH 他人错题 404，
  归属校验持续拦截。

## 2. 数据例行 + 爬虫观测

- 周活：近 7 天 answer_log 39 次 / 14 uid（QA 清理后口径），与基线持平；growth 7 天
  team_join_open 5 / share_open 4 / share_answer 3 / task_card_click 2 等，r95 首现的
  疑似真实分享/组队链路事件仍在（无新增爆发）。
- 爬虫 7 天：YandexBot 84（/tiku 80 为主）+ bingbot 1 + Baiduspider 1；robots.txt 4、
  indexnow-key 1、/s/ 1。**Baiduspider 当日仅 1 次续访（未上量）；Bing site: 实测收录仍未
  破零**（返回全为无关结果，站长平台验证仍是 P0 卡点）。Googlebot 本周未现身（r86 的 2 次
  未复现）。
- /s/ 无真实用户落地。

## 3. health_scan 快扫（全绿）

active 113,304 / full 156,792 / lt50 0 / badjson 0 / 乱码 0 / 推广残留 0 / hs_mismatch 0 /
台账外空 hs 0（intentional 两条 changshi:655861、panduan:334296 未动）/ 卷内重复 0 /
低覆盖仅卷 112（65/112）。

## 4. QA 数据清理

本轮走查复用浏览器持久化 anonUid（umsmszssbd151j0am，r96 QA uid），产生 answer_log 1 /
mistakes 1 / growth 1 已事务清理，三表残留 0，真实统计口径未污染。

## 5. 结论与建议

r95-r97 三轮变更线上全部持续生效、无回归。获客瓶颈依旧（Bing 收录未破零、周活无增长），
站长平台验证（Bing/Baidu）仍是最高优先级外部卡点；下轮候选：Caddyfile 版本化入 deploy/（r97 P2）、
/data 历史备份滚动清理（r97 P3）、限流 Redis 化（多副本前置，P2）。
