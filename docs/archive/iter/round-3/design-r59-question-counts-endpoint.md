# R59 设计方案：首屏模块题数改走轻量可缓存端点 /api/question_counts

日期：2026-08-29 ｜ 分支：基于 R57/R58 PR #234 分支

## 取证（生产实测）

- 首页/刷题页首屏 `loadCounts()` 调 `GET /api/questions?limit=1`，仅为拿响应里的
  `counts`（各模块题数），却附带触发 `random_questions()` 随机抽题
  （156k 行主表 RANDOM() 采样，重量级、响应随机）。
- 生产首屏 waterfall 实测（CDP，Slow4G+4x CPU）：`/api/questions?limit=1`
  505→1850ms，是首屏最慢请求；同批 `/api/announcement` 走 R56 边缘缓存 3ms 完成。
- 该端点响应含随机题目，R56 明确排除在边缘缓存清单外——首屏因此必穿透
  2GB 共享 origin，受 R55 记录的闲置 6–14s 通用长尾影响。
- `question_counts()` 本体 SQL（GROUP BY module）生产容器内实测 0.08–0.11s，
  且 uid 无关、确定性输出，完全符合 R56 允许清单准入条件。

## 方案

1. 后端 `qbank_api.py` 新增 `GET /api/question_counts`：直接返回
   `{"counts": db.question_counts()}`，零新 SQL、零参数。
2. CF Pages functions `API_CACHE_ALLOWLIST` 增加 `/api/question_counts`
   （60s TTL，与 R56 同通道同守卫）。
3. 前端 home.vue / practice.vue `loadCounts()` 改请求新端点；响应结构
   `{counts}` 不变，重试逻辑复用。
4. `/api/questions` 响应保持原样（仍带 counts），不破坏旧客户端/离线包。

## 验收标准

1. 新端点 MISS→HIT（X-Edge-Cache），HIT 体与 origin 逐字节一致；
2. 首页/刷题页模块题数正常渲染，首屏不再请求 `/api/questions?limit=1`；
3. 1440/375 console 0 error、无水平溢出；build:h5 全绿。

## 验收结果（2026-08-29 生产实测，bundle index-B3kngKtl.js）

- `/api/question_counts` MISS→HIT（Cache-Control: public, max-age=60 +
  X-Edge-Cache），HIT 体与 origin 逐字节一致（cmp 通过），实测 0.08–0.10s；
- 首页 1440/375 模块题数正常渲染，首屏改请求新端点，
  `/api/questions?limit=1` 不再出现（`limit=10` 预取为既有设计，保留）；
- 两视口 console 0 error、无水平溢出；build:h5 全绿、部署 hash 校验一致。
