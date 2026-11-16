# 后端架构地图（团队共识版）

> 原则：代码即架构、如无必要勿增实体、乘法式拆解（域模块可独立复用/可 MCP 化）、API 优先。
> 本文只描述边界与不变量，实现以代码为准（backend/app/）。

## 包结构（分层即目录）

```
app/
  main.py              应用装配层：中间件（慢请求留痕、账号 uid 门禁）、路由挂载、
                       静态资源（SPA 壳/sw.js/qimg/admin static）、后台预热线程。不含业务路由。
  api/                 HTTP 层：FastAPI Router、请求级依赖、鉴权。不写 SQL、不含业务规则。
    deps.py            跨域共享门禁与工具：check_access（访问码）、check_admin（管理令牌，
                       常数时间比较+失败限速）、check_import_token（导入令牌）、rl（按 uid/IP 限速）、
                       friendly_ai_err、cache_key。
    auth.py / zalize_sso.py  账号态与 SSO。
  db/                  数据访问层：唯一持库入口。包 __init__ 即原 db.py（连接管理、
                       行工厂、通用查询），并 star-import 全部子模块——`from app import db`
                       与 `db.<fn>` 旧调用面不变。
    admin/analytics/daily/exam/mastery/practice/qbank/reports/review/seed/
    shenlun/social/stats/taxonomy/user + migrate（启动时 alembic upgrade head）
  services/            领域服务层：业务逻辑，不直接处理 HTTP。
    llm.py / engine.py LLM 通道选择与降级（缺配置立即失败）；题目解析/讲解生成。
    其余按域分文件（见下表）。
  seo/ tagging/        既有子包：SEO 落地页 SSR、题目标签分类。
  admin/ data/ fonts/  静态资源与只读数据文件（非 Python 包）。
```

依赖方向：`api/` → `services/` → `db/`（只允许自上而下；`db/` 不得反向导入 api/services，
`services/` 之间可互相 import 但不得 import `api/`）。

## 域模块（api/ 各自一个 APIRouter，main 统一 include）

| 模块 | 边界 | 关键不变量 |
|---|---|---|
| api.qbank | 题库：抽题、考点树、时政每日、导入导出、题图 | 导入必须 check_import_token；抽题走 id 池缓存 |
| api.study | 学习记录：画像/计划、答题日志、错题本、SRS 复习、提醒、统计、纠错反馈 | 错题/复习按 uid 隔离；今日已练=answer_log+review_log |
| api.exam | 模考/真题卷：PDF 导出、答题卡/卷码判分、整卷模考 | 手动判分/扫描/模考共用 _judge_paper；开考只下发题面白名单字段；报告仅本人可读 |
| api.shenlun | 申论：题库/素材/收藏、AI 批改 | 大作文按档位、小题按采分点；批改落库 |
| api.ai | AI 能力：拍照/文字解析、追问、教练、错题分析 | 统一 check_access + rl + friendly_ai_err 快速降级 |
| api.admin | 管理后台 API 与 /admin 页 | 全部 check_admin；静态资源版本号随 mtime 失效 |
| api.push | Web Push 订阅与每日推送 | VAPID 未配置时降级、线程不启动 |
| services.* | 既有独立域（social 讨论/分享/徽章、interview 面试、pk、mock_event 模考大赛、report 周报、team 小队/裂变埋点、insights、quality/kb/similarity 等内容质量域） | 各自 init_*_db 建表，互不直接持库跨域写 |
| seo | SEO 落地页 SSR 路由族 | catchall 兜底必须最后注册 |

## 前端源码结构（frontend-uni/src/）

业务域目录即模块边界，禁止跨层乱 import：

```
src/api/      后端调用封装（request/鉴权/流式）
src/exam/     行测练习域（含 exam-fav 收藏内核）
src/book/     错题本域        src/ask/    AI 问答域
src/review/   复习/SRS 域     src/fav/    云收藏同步
src/shenlun/  申论域          src/home/   首页/打卡/目标
src/practice/ 练习会话域（session-ops/daily-ops 等）
src/services/ 平台服务（offline/pwa/theme/monitor 等）
src/utils/    纯函数工具      src/a11y/   可访问性
src/pages/ src/pkgA/ 页面组件 src/components/ 通用组件
```

卡片布局约定：卡间距只有两种合法形态——裸堆叠（`.kg-card + .kg-card`
全局兄弟边距自动生效）或挂 `.kg-cards` 容器（gap 独管 + 内部卡边距清零，
`!important` 压 scoped 样式）；≥768px 双列加 `.kg-cards--grid`。

## 跨端约定

- 三端（H5 uni-app / 原生小程序 / Flutter）只经由同一套 /api/*，无端专属分叉接口。
- 账号态 uid（u<id>）读写必须携带本人 Bearer token（main.guard_account_uid 中间件统一拦截）。
- 高成本接口（AI/OCR/导出/纠错）必须走 api.deps.rl 限速。
- 前端新增埋点事件名必须同步 `services/team.py` `/api/track` 白名单（test_track_whitelist_sync 锁定）。
