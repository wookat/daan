# 后端架构地图（团队共识版）

> 原则：代码即架构、如无必要勿增实体、乘法式拆解（域模块可独立复用/可 MCP 化）、API 优先。
> 本文只描述边界与不变量，实现以代码为准（backend/app/）。

## 分层

```
main.py            应用装配层：中间件（慢请求留痕、账号 uid 门禁）、路由挂载、
                   静态资源（SPA 壳/sw.js/qimg/admin static）、后台预热线程。不含业务路由。
deps.py            跨域共享门禁与工具：check_access（访问码）、check_admin（管理令牌，
                   常数时间比较+失败限速）、check_import_token（导入令牌）、rl（按 uid/IP 限速）、
                   friendly_ai_err、cache_key。
db.py              SQLite 数据访问层（唯一持库入口；连接线程内复用+常驻页缓存）。
llm.py / engine.py LLM 通道选择与降级（缺配置立即失败）；题目解析/讲解生成。
```

## 域模块（各自一个 APIRouter，main 统一 include）

| 模块 | 边界 | 关键不变量 |
|---|---|---|
| qbank_api | 题库：抽题、考点树、时政每日、导入导出、题图 | 导入必须 check_import_token；抽题走 id 池缓存 |
| study_api | 学习记录：画像/计划、答题日志、错题本、SRS 复习、提醒、统计、纠错反馈 | 错题/复习按 uid 隔离；今日已练=answer_log+review_log |
| exam_api | 模考/真题卷：PDF 导出、答题卡/卷码判分、整卷模考 | 手动判分/扫描/模考共用 _judge_paper；开考只下发题面白名单字段；报告仅本人可读 |
| shenlun_api | 申论：题库/素材/收藏、AI 批改 | 大作文按档位、小题按采分点；批改落库 |
| ai_api | AI 能力：拍照/文字解析、追问、教练、错题分析 | 统一 check_access + rl + friendly_ai_err 快速降级 |
| admin_api | 管理后台 API 与 /admin 页 | 全部 check_admin；静态资源版本号随 mtime 失效 |
| auth / social / interview / pk / mock_event / report / team / insights / seo | 既有独立域（账号、讨论/分享/徽章、面试、PK、模考大赛、周报、小队、搜索、SEO 页） | 各自 init_*_db 建表，互不直接持库跨域写 |

## 跨端约定

- 三端（H5 uni-app / 原生小程序 / Flutter）只经由同一套 /api/*，无端专属分叉接口。
- 账号态 uid（u<id>）读写必须携带本人 Bearer token（main.guard_account_uid 中间件统一拦截）。
- 高成本接口（AI/OCR/导出/纠错）必须走 deps.rl 限速。
