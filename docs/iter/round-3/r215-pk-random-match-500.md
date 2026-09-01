# R215：PK 随机匹配「新建」分支 500 + 模考管理端 ImportError 门禁失效

## 取证（先调查后动手）

- 手段：对 backend/app 首次运行 pyright（basic），42 errors 全量人工甄别，绝大多数为
  Optional 收窄/三方库 stub 噪声，但两处经源码核对为真实运行时缺陷：
  1. `pk.py api_pk_random`：R188 给 `api_pk_create` 增加 `request: Request` 形参接入 rl()
     限速后，`random_match` 的「无等待挑战 → 新建」分支仍以 `api_pk_create(body)` 调用，
     缺 `request` 实参 → 运行时 `TypeError` → 500。命中条件：随机匹配时该模块没有任何
     「发起者已完成作答的等待中挑战」。
  2. `mock_event.py` 两个管理端点（POST/DELETE /api/admin/mock/events*）函数体内
     `from .main import check_admin`，而 `main.py` 自 R114 门禁集中化后已无该符号
     （现居 `deps.py`）→ 请求时 `ImportError` → 500，管理建赛/删赛接口自上线即坏
     （每周赛事实际由 `ensure_weekly_event()` 兜底自动生成，故未被日常暴露）。
- 生产实证：POST /api/pk/random_match（探测 uid）命中了存量等待挑战返回 200，未触达
  新建分支；探测产生的 opponent 占位已手工还原（opponent_uid/opponent_name 置回 NULL）。
  新建分支的 500 由本地 TestClient 复现确认，未在生产制造脏行。

## 方案（最小收口）

- `api_pk_random(body, request: Request)` 并透传 `api_pk_create(body, request)`：
  顺带使 R188 的 pk_create 限速桶对随机匹配新建路径同样生效（语义一致而非新增决策）。
- `mock_event.py` 顶部 `from .deps import check_admin`，删除两处函数内失效导入
  （deps 无反向依赖，无循环导入风险）。

## 验证

- 新增 tests/test_pk_random_match.py 2 例：无等待挑战时 random_match 200 且
  matched=False、返回 10 题；模考管理端错误令牌走 401/503 门禁而非 500。
- 本地 ruff / pytest 92 passed（+2）全绿；前端门禁与产物无关但随部署照常全绿复验。
- 生产部署后复验：random_match 新建分支 200（探测行随即删除）、管理端 401。

## 限制

- pyright 全量 42 errors 中其余 Optional/stub 噪声未在本轮清理；把 pyright 纳入
  本地门禁需先建立基线（挂候选，避免一轮内大改动）。
