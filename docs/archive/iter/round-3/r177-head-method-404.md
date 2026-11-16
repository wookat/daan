# R177：后端 HEAD 请求全站 404 收口

## 一手取证（2026-09-01）

生产实测（curl，边缘域 kaogong.zalize.com）：

- `HEAD /tiku/` → 404 application/json；`GET /tiku/` → 200 text/html
- `HEAD /tiku/q/376730`、`/tiku/papers/5`、`/tiku/daily/`、`/sitemap.xml` → 全部 404
- `GET` 同 URL 全部 200
- 竞品对照：`HEAD https://www.fenbi.com/spa/tiku/guide/catalog/xingce` → 200
- 本站静态层（Pages 直出）`HEAD /` → 200；只有回源到 FastAPI 的动态路由 404
- `HEAD /robots.txt` 在边缘偶发 200：系边缘缓存副本命中掩盖（cache.match 不分方法），
  无副本/绕过缓存路径必 404 —— 掩盖不等于修复

本地复现（TestClient）：`HEAD /tiku/`、`/tiku`、`/robots.txt` 均 404，GET 均 200。

## 根因（verified）

FastAPI 的 `@router.get()` 只注册 `GET` 方法，不像原生 Starlette `Route` 会自动
为 GET 路由附加 HEAD。全仓路由均用 `@xxx.get()` 声明（仅 `/admin` 手工
`methods=["GET","HEAD"]`），因此除 /admin 外所有后端路由对 HEAD 一律 405/404。

## 影响

- 搜索引擎爬虫、链接检查器、社交平台卡片抓取、uptime 监控普遍以 HEAD 预检；
  对 /tiku SEO 页族（10 万+ 收录目标页）、sitemap 分片、短链 /s /p 返回 404
  会被判定为死链，直接伤害收录与外链信任。
- 边缘缓存副本可部分掩盖（HIT 时返 200），但 MISS/过期同步回源路径仍 404，
  行为不确定性本身就是缺陷。

## 方案

ASGI 语义收口（一处中间件，零路由改动）：

```python
@app.middleware("http")
async def head_as_get(request, call_next):
    if request.method != "HEAD":
        return await call_next(request)
    request.scope["method"] = "GET"
    response = await call_next(request)
    # 排空下游流式 body，仅返回状态行与响应头（HTTP 语义：HEAD 无 body）
    ...
```

- HEAD 改写为 GET 交给既有路由，响应仅保留 status + headers（含 content-length/
  content-type），body 置空 —— 与 RFC 9110 HEAD 语义一致。
- 写路径（POST/PATCH/…）不受影响；guard_account_uid 等中间件语义不变
  （HEAD 本就是只读，改写为 GET 后走与 GET 完全相同的鉴权路径）。
- 不逐条改 40+ 路由声明为 `methods=["GET","HEAD"]`：一处中间件覆盖全部现有
  与未来路由，无遗漏面。

## 边界

- 不改变任何 GET/POST 现有行为与契约。
- 不改边缘函数（其对 HEAD 已正确透传，问题只在 origin）。
- content-length 保留 GET 真实值（RFC 允许且推荐，供爬虫判断资源大小）。

## 验证

- pytest 新增：HEAD /tiku/、/robots.txt、/sitemap.xml → 200 空 body 且
  content-type/content-length 与 GET 一致；HEAD /api/stats → 200；POST 行为不变。
- 生产部署后 curl 复验上述 URL 集 + 1440/375 双视口回归（GET 页面不受影响）。
