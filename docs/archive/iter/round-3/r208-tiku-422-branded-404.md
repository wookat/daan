# R208：/tiku 页族畸形参数 422 裸 JSON 收口为品牌 404

## 取证（verified / inference / unknown）

- verified（生产实测，2026-08-29）：公开 SEO 页族对畸形 int 参数直出 FastAPI 原始 JSON 422（暴露框架校验内部结构，`content-type: application/json`，无品牌壳/无出路/无 noindex）：
  - `/tiku/panduan/?page=abc` → 422 `{"detail":[{"type":"int_parsing",...}]}`
  - `/tiku/q/abc/`、`/tiku/papers/abc/`、`/tiku/y/abcd/panduan/` → 同上
- 对照（verified）：同页族其它无效输入早已品牌化——`?page=99999` → 404「页码超出范围」（noindex）、`/tiku/q/999999999/` → 404「题目不存在」、R119 已立「失效链接给壳+出路，而非裸 JSON 报文」的约定；畸形参数是该约定的最后一个漏网面。
- 本轮生产 origin 日志复审计（排除共享 NAT）：11892 行中非 NAT 40 条、无 >3s 请求、错误仅既知项（/tiku/ 直连 403、/.env 扫描 404、R205 历史 502），无新 verified 服务端缺陷。
- inference：外链拼错/爬虫变形 URL 命中此路径时，人类用户看到裸 JSON 无出路；unknown：真实流量中命中频率（当前窗口未见样本，按一致性收口处理）。

## 方案

main.py 注册全局 `RequestValidationError` 处理器，按路径分流：

```py
@app.exception_handler(RequestValidationError)
async def _validation_handler(request, exc):
    p = request.url.path
    if p.startswith("/tiku") or p.startswith("/s/") or p.startswith("/p/"):
        return seo._not_found("页面不存在")   # 品牌 404 + noindex
    return await request_validation_exception_handler(request, exc)  # /api 保持 JSON 422
```

- 语义选择：畸形参数视同「页面不存在」返回 404（与 page 超范围/资源不存在一致），不做 422 品牌页——对爬虫 404 更明确，且避免新增状态语义。
- `/api` 与管理台契约零变化（保留 FastAPI 默认 JSON 422）。

## 验证

- pytest 补例：/tiku 畸形 page/qid/pid/year → 404 HTML 品牌页 + noindex；/api 畸形参数仍 422 JSON。
- 本地 ruff/pytest 全绿；部署后生产复测上述 4 类 URL + 回归既有 404/正常页。
