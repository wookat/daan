# R258 设计：SEO 包路由注册顺序契约测试（测试补强，不部署）

## 取证

- 本窗口 origin 6h 复审计无新产品缺陷：404/5xx 全部落旧 rev 部署窗口或自有探针（curl / 本机 Playwright UA），R257 健康检查上线后（02:12 起）零 5xx。
- 真实缺口为架构性：R256 拆包后 `app/seo/__init__.py` 依赖子模块导入顺序产生的路由注册副作用（shenlun→pages→catchall），仅靠注释约束。若被按字母序重排/合并导入（IDE 自动整理、后续重构均可能触发），`/tiku/{module}` 兜底会先于具体页族注册，申论套卷页/年份页/题型页被 catch-all 吞掉——该回归当前无任何测试防线（R256 的 pre/post 比对是一次性验证，不入门禁）。

## 方案

新增 `backend/tests/test_seo_route_order.py` 两例：

1. `test_catchall_routes_registered_last`：按 `endpoint.__module__` 归属划分 `router.routes`，断言 catchall 模块的全部路由注册序号大于所有具体路由——顺序被重排时直接失败，不依赖具体 URL。
2. `test_shenlun_specific_paths_not_swallowed_by_catchall`：种子语料后走 TestClient 实测 `/tiku/shenlun/`、套卷页、年份页、题型页 200，未知模块 404——防线落到真实请求行为。

零产品代码变化，不部署。

## 验收

- ruff / pytest（127→129）/ pyright 全绿。
