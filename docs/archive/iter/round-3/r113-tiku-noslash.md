# R113：/tiku 页族无尾斜杠 301 收口

## 取证（verified facts，2026-08-29 生产实测）

- `GET /tiku` → **404**（`/tiku/` 200）：题库入口的无尾斜杠形态直接 404——外链/手输域名+tiku 全部落空。
- `GET /tiku/changshi` → **404**（`/tiku/changshi/` 200）：五个模块列表页同理。
- 子题型 `GET /tiku/{module}/{submodule}`（无尾斜杠）同样 404。
- 对照：`/tiku/daily`、`/tiku/discuss`、`/tiku/papers`、`/tiku/y/...`、`/tiku/t/...`、`/tiku/q/{id}/` 都有显式 noslash 301（R70/R97 等历轮补齐），唯独**页族入口 `/tiku` 与模块/子题型页漏掉**。
- 根因：`APIRouter(prefix="/tiku")` 下 `@router.get("/")` 只匹配 `/tiku/`；FastAPI 的 redirect_slashes 只处理「有斜杠路由的无斜杠访问」在同 router 内的情形，prefix 根路径不生效。

## 方案

`seo.py` 补三个 301（与既有 `tiku_daily_noslash` 模式一致）：

- `root_router` `/tiku` → `/tiku/`；
- `router` `/{module}` → `/tiku/{module}/`（`_module_name` 校验，未知模块仍 404，注册在全部固定 noslash 路由之后不产生遮蔽）；
- `router` `/{module}/{submodule}` → `_sub_path(...)`（同校验）。

## 边界

- `/tiku/y/2024/changshi` 等已有 noslash 处理，不动。
- 未知模块（如 `/tiku/whatever`）保持 404，不做泛 301（防无限重定向蜘蛛陷阱）。

## 验证

- 本地 TestClient：/tiku→301 /tiku/、/tiku/changshi→301、子题型 301、未知模块 404、既有带斜杠页 200 回归。
- 生产：三形态 301 且 Location 正确、旧 404 消失、/tiku/ 页族回归 200。
