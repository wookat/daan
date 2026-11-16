# R89：IndexNow 主动提交——打通半成品获客通道

## 取证（2026-09-01）

- R85 origin 日志窗口内 Googlebot/Bingbot/Baiduspider 到达 = **0 条**（同窗口商业爬虫 636 条，R88 已拦）；搜索引擎从未抓取 15 万+ /tiku/q/* SEO 页。
- 仓库现状：`seo.py` 只提供 `/indexnow-key.txt` 密钥文件（生产 200），**全库无任何向 api.indexnow.org 提交 URL 的代码**——IndexNow 通道只建了验证端，从未推送过一条 URL。
- Bing `site:kaogong.zalize.com` 仅个位数结果；被动等待抓取在零外链新站上不可行。

## 方案

`seo.py` 新增守护线程 `_indexnow_submitter`（与 main.py 既有 _warmup/_stats_refresher 同模式）：

- 无 `INDEXNOW_KEY` 时线程直接退出（本地/开发零影响）。
- 新表 `seo_meta(key TEXT PRIMARY KEY, value TEXT)` 存水位 `indexnow_last_qid`。
- 每 6h 一轮：首轮先提交核心页（/、/tiku/、/tiku/daily/、聚合页），之后每轮取 `id > 水位` 的活跃题 id，按 IndexNow 上限每 POST ≤10000 条、每轮 ≤2 个 POST（≤2 万 URL/轮，~2 天推完 15 万，避免瞬时轰炸），POST `https://api.indexnow.org/indexnow`（json: host/key/keyLocation/urlList）；2xx 才推进水位。
- 全量推完后每轮只提交自上轮以来新增/启用的题（水位自然覆盖）。

## 非目标
- 不做 Google Search Console 提交（需老板账号验证域名，作为资源申请单独上报）；Google 已废弃 sitemap ping 端点。
- 不改 sitemap 结构、不加依赖（用 urllib）。

## 验收
- 本地：无 key 时零请求；mock key 实跑一轮，POST body 结构正确、2xx 推进水位、非 2xx 不推进。
- 生产：部署后日志确认提交批次发出且 api.indexnow.org 返回 200/202；seo_meta 水位推进；服务负载无异常。
