# R377：搜索分发接入（Google Search Console 建资源+提站点地图）+ 管理台「搜索引擎抓取」面板

## 取证事实（2026-09-04 12:00–12:30Z，均为一手证据）

- **Google 从未见过本站**。Search Console 新建 `sc-domain:kaogong.zalize.com`（DNS 提供商自动验证）后：
  - 「网址检查」`https://kaogong.zalize.com/` 与 `/tiku/`：**「网页未编入索引：Google 无法识别此网址」**，站点地图/引荐来源均「未检测到」，上次抓取「不适用」；
  - 「站点地图」页在提交前为「第 0-0 行」——Google 侧从未发现过 `robots.txt` 里声明的 sitemap；
  - 「测试实际网址」`/`：**网址可编入 Google 索引**（Googlebot 可抓、可渲染、无 noindex）——即 SEO 层本身没问题，缺的是分发入口。
- 源站日志（`kaogong-origin` 9-02 12:24Z → 9-04 12:27Z，剔除探针网段）：Googlebot **3 次**，全部在 12:24Z 提交 sitemap 之后（`/robots.txt` 200、`/sitemap.xml` 200，0.06s）；Baiduspider **0 次**；Bingbot 49、YandexBot 119、ClaudeBot 186（AI 爬虫）、SemrushBot 16、GPTBot 2。
- Bing 公开搜索 `site:kaogong.zalize.com` 约 1.6 万（引擎 UI 估值，非权威）；Baidu 站长平台需百度账号，本轮无凭证。
- 爬虫 5xx 归因：9-02～9-04 06:05Z 的爬虫 503（ClaudeBot 24 / bingbot 5 / Yandex 3 / Semrush 1，耗时 25s）全部落在 R372 前的 unhealthy→137 重启窗口（container-events.log 01:20/01:37/01:47/01:59/02:30/05:38/05:44/05:58Z）。R372（06:53Z）之后爬虫 0 个 5xx；R376 部署（11:44Z）后 restarts 0。**不需要运行时改动**。
- 现状盲点：`scripts/access_log_report.py` 周报已有爬虫分类，但只落 VPS 上一个 txt（`access-weekly-*.txt`），管理台看不到；「Google 一次都没来过」这件事上线数十轮无人发现。

## 结论与方案

分发是四维里「获客/分发前置」（CHARTER 开发原则）的硬缺口；SEO 页族 10.9 万 URL 已就位却没有任何引擎入口。R377 分两部分：

### A. 运维动作（本轮已执行，不入代码）

1. Search Console 建 `sc-domain:kaogong.zalize.com`（自动验证，方式=域名提供商）。
2. 提交 `https://kaogong.zalize.com/sitemap.xml`：状态「成功」，类型「站点地图索引」（子图 14 个待处理）。
3. 对 `/tiku/` 「请求编入索引」一次（收到「已请求编入索引」回执）；`/` 只做了「测试实际网址」（可编入索引），是否成功提交索引请求未留回执，按未知处理。
4. 资源缺口上报：GSC 资源挂在测试账号下，需老板提供 Google 账号邮箱以添加为「所有者」；百度站长平台/主动推送需百度账号+token（未申请前不写桩）。

### B. 代码：管理台「搜索引擎抓取」面板（操作台×分发）

数据流沿用现有审计日志模式（VPS 落盘 → 容器只读 `/reports` → `ops_status` 解析 → 看板）：

1. `scripts/crawler_stats.py <archive_dir> <out_json> [--days 14]`：读小时级归档 `access-YYYYMMDD.jsonl`（已有 cron），按 UTC 日 × 引擎聚合：请求数、5xx 数、`/tiku/` 页数、sitemap/robots 抓取数、最近一次抓取时间；引擎表复用 `access_log_report.BOT_ENGINES`。输出单个 JSON（`generated_at`、`days`、`engines`）。
2. `deploy/cron_access_report.sh` 不动；新增 cron 行（VPS 手工安装，写进 deploy/README）：`23 * * * * python3 .../crawler_stats.py /home/ubuntu/kaogong-reports/access-archive /home/ubuntu/kaogong-reports/crawler-stats.json`。
3. `ops_status.parse_ops_status` 新增 `crawlers` 字段：读 `crawler-stats.json`，缺失容忍（`None`），按引擎给出 `hits_7d / err5xx_7d / tiku_7d / last_seen / never`。
4. `dashboard.js` 运维状态卡下新增「搜索引擎抓取（近 7 天）」：Google / Bing / Baidu 固定置顶（Baidu 从未来过用红色「从未」外显），其余按量排序；5xx>0 标黄。
5. 明确不做：不改 robots/sitemap/SSR（实测可索引）；不写百度推送桩（无 token 即空转，等资源到位再做）；不引入新表/端点（复用 `/api/admin/ops_status`）。

## 测试

- `backend/tests/test_crawler_stats.py`：归档样本（Google/Bing/Yandex/真人/探针）→ 聚合正确、探针 UA 不算引擎、5xx/sitemap/tiku 计数、never 判定；
- `backend/tests/test_ops_status.py` 增：有/无 `crawler-stats.json` 两态；
- 本地 pytest / ruff / pyright；前端管理台为纯静态 JS（无 build），生产 1440/375 走查。

## 部署核对清单

- VPS：手工跑一次 `crawler_stats.py` 生成 JSON，安装 cron；`curl /api/admin/ops_status` 见 `crawlers`；
- 管理台看板 1440/375：面板渲染、Google 行「最近抓取」= 源站日志时间、Baidu「从未」；
- 次日复核：Googlebot 是否抓取 `sitemap-*.xml` 与 `/tiku/` 页（源站日志 + GSC「站点地图」已发现网页数），作为 R378 取证起点。
