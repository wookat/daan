# R256 设计：seo.py 单文件拆包（架构治理，行为零变化）

## 取证（verified）

- `backend/app/seo.py` 已膨胀至 1802 行，单文件聚合五类职责：公共 helpers/HTML 壳、行测 SSR 页族、申论 SSR 页族、站点文件（sitemap 家族/robots/llms.txt/IndexNow）、分享落地页（/s、/p）。R236–R255 每轮申论页族改动都要在 1800 行文件内定位穿插的 render/route/sitemap 三处，维护成本持续上升。
- 外部引用面小（grep 实证）：`app/main.py` 仅用 `seo.router`、`seo.root_router`、`seo._not_found`；tests 仅用 `seo._url`、`seo._sitemap_*`、`seo._indexnow_page_urls`、`seo._indexnow_submit_pages`（monkeypatch `_indexnow_post`）。
- 关键约束：Starlette 按注册顺序匹配路由，`/{module}`、`/{module}/{submodule}` 兜底路由必须最后注册（现文件中位于 1306 行之后，晚于 /shenlun/p/{paper} 等具体路径）。

## 方案（纯移动收口）

`app/seo.py` → `app/seo/` 包，六个模块按职责切分，`__init__.py` 按原注册顺序导入以保持路由匹配语义：

1. `common.py`：配置（SITE_BASE/INDEXNOW_KEY）、两个 APIRouter、路径构造与 HTML 壳 helpers（原 1–299 行）。
2. `pages.py`：/tiku 首页、search、daily、discuss、papers、q、year、topic（原 301–1060 行）。
3. `shenlun.py`：申论 hub/年份/题型/套卷 render 与路由（原 1062–1304 行）。
4. `catchall.py`：`/{module}`、`/{module}/{submodule}` 兜底路由（原 1306–1428 行，必须最后 import）。
5. `landings.py`：/s/{sid}、/p/{rid} 分享落地页（原 1553–1652 行）。
6. `sitefiles.py`：sitemap 家族、indexnow-key、llms.txt、robots.txt、IndexNow 提交线程（原 1431–1550 + 1655–1802 行）。

`__init__.py` re-export 外部引用名（router/root_router/_not_found/_url/_sitemap_*/_indexnow_*），main.py 零改动；tests 中 monkeypatch 目标改为实际定义模块 `seo.sitefiles._indexnow_post`（import 路径适配，非行为改动）。

## 验收

- 代码纯移动（函数体零改动），127 例 pytest 全绿 + ruff + pyright。
- 生产部署后接口回归全 200，sitemap.xml/llms.txt/robots.txt 与拆分前逐字节一致（diff 实证）。

## 非目标

- 不改任何路由、渲染、缓存或 IndexNow 语义；不做 db.py 拆分（另立项）。
