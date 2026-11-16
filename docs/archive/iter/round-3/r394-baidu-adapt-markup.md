# R394：搜索引擎 14 天抓取/5xx 归因 + 百度自适应标注（applicable-device / 移动 sitemap type）

日期：2026-09-05 · 分支 `devin/1788582081-r394-baidu-adapt-markup`（base=main）· 类型：SEO 标注补齐，零业务功能改动

## 1. 一手取证（09-05 04:20–05:00Z，生产 VPS 源站归档 14 天 + 官方文献）

### 1.1 R393 起点：中心 `internal=0` 增量 / 候选真人
- 距 R393 部署（03:46Z）不足一个 crawler cron 周期，`ops_status.crawlers.humans` 仍为 R393 产物（`api_7d 44 / offhost 12 / direct 52`）；中心 `/api/errors` 无新行。09-06 后再核，本轮不重复取。

### 1.2 搜索引擎 14 天抓取画像（按 `X-Kg-Ua` 引擎 UA，剔探针网段自测）
| 引擎 | 请求 | 说明 |
|---|---|---|
| Yandex | 1,282 | 主力，绝大多数在 `/tiku/q/*` |
| Bingbot | 126 | 已进题目页 |
| Googlebot | 26 | sitemap/robots 为主，题目页仍是个位数 |
| Applebot / Google-InspectionTool | 3 / 3 | |
| Baiduspider | 1（14 天）/ 2（全量归档） | 08-10 `/s/y83nb87n` 200；09-04 `/tiku/q/297391` 200 **来自探针网段 `140.232.64.4`**（我们自己带百度 UA 的自测），即**经边缘的真实 Baiduspider 抓取 27 天为 1 条** |

路径族：`/tiku/q/*` 1,042 / `/tiku/*` 其他 208 / sitemap 88 / robots 63 / 其他 40。

### 1.3 搜索引擎 5xx（14 天，共 39 条：Yandex 32 / Bing 7）
- 502 `/tiku/q/*` 29、502 sitemap 2、503 `/tiku/*` 2、503 `/tiku/q/*` 2、503 robots 1、503 sitemap 3。
- **29 条集中在 08-31 10:23–10:24Z 两分钟**（R372 之前的进程换出/重启窗口，R372 已处置）；其余 10 条零散分布在部署窗口附近；`docker events` 有多次 `removing unhealthy`，宿主 `MemAvailable` 258–457 MiB、swap 2.1–2.75 GiB。
- 结论：5xx 属部署/宿主资源窗口，R372 后无运行时集中 5xx；不做零停机改造（同 R390 结论），宿主 IO/内存争用继续作资源缺口上报（第 14 次）。

### 1.4 百度官方文献（ziyuan.baidu.com）
- 《移动适配》工具页：**自适应站点不需要使用移动适配工具**。
- 搜索学堂《自适应对百度友好关键》（courseinfo?id=481&page=4）：自适应页应在 head **紧随 viewport** 加 `<meta name="applicable-device" content="pc,mobile">`，让百度识别为自适应页（未识别可能按 PC 页处理/转码）。
- 《移动 sitemap 协议 mobile type 升级公告》（wiki/544）：自适应页在 sitemap 每条 `<url>` 加 `<mobile:mobile type="pc,mobile"/>`（旧值 `autoadapt`），命名空间 `http://www.baidu.com/schemas/sitemap-mobile/1/`。
- **矛盾点（如实记录）**：百度公开的 XSD `sitemap-mobile.xsd` 枚举仍是 `{pc, mobile, htmladapt}`，不含 `pc,mobile`，用 lxml 按该 XSD 校验会报 enumeration 错——XSD 未随 wiki/544 公告更新（连旧值 `autoadapt` 也没有）。以公告为准，采用 `pc,mobile`。
- 现状：本站 `/`（H5 壳）与 `/tiku/*`（SSR）均无 `applicable-device`，sitemap 无 mobile 扩展 → 百度即便来抓，也没有任何自适应信号。

## 2. 方案（3 处标注 + 测试，不改任何业务 HTML/路由）
1. `backend/app/seo/common.py`：`BAIDU_ADAPT_META` 常量，`_page()` head 在 viewport 之后紧跟输出（所有 `/tiku/*` SSR 页含 404 页）。
2. `frontend-uni/index.html`：动态 viewport `document.write` 脚本之后加同一 meta（首页壳；`/` 是 Google 已收录的 2 页之一）。
3. `backend/app/seo/sitefiles.py`：`_urlset()` 的 `<urlset>` 增 `xmlns:mobile`，每条 `<url>` 在 `loc/lastmod` 之后追加 `<mobile:mobile type="pc,mobile"/>`；`sitemapindex` 不动。
4. 测试：`backend/tests/test_seo_baidu_adapt.py`（SSR 4 类页恰 1 条且紧随 viewport；3 类 urlset 用 ElementTree 解析命名空间、每条 URL 都有 type=pc,mobile 且在 loc/lastmod 之后；sitemapindex 无扩展）；`frontend-uni/tests/seo-title.test.js` 增首页壳 meta 用例。
5. 不做：百度主动推送/快速收录（无站长账号 token，R386 已列资源缺口）；单独移动域名或移动适配工具（自适应站不适用）；改 `robots.txt`；其他引擎侧任何改动。

## 3. 验证
- 本地：pytest 383（+3）/ ruff 0 / pyright 0 / vitest 556（+1）/ eslint 0 / build:h5 通过（dist `index.html` 含 1 条 `applicable-device`）。
- 本地 XSD 校验：sitemaps.org `sitemap.xsd` 核心元素通过；百度 `sitemap-mobile.xsd` 因枚举过时报 `pc,mobile` 不在集合（见 1.4，按公告为准）。
- 其他引擎兼容：sitemaps.org XSD 允许 `##other` 命名空间扩展元素置于核心元素之后（image/video/xhtml 扩展同机制）；**Google/Bing 对该扩展的实际容忍以部署后 sitemap 抓取仍 200 + GSC/Bing 站点地图状态无报错为验收**，部署前不下结论。
- 生产复验项：`/api/health`；`curl /tiku/q/<id>`、`/tiku/`、`/` head 含 meta；`/sitemap-questions-1.xml` 含 `xmlns:mobile` 且条数==`<mobile:mobile` 数；1440/375 UI 回归；容器 0 重启；5xx/slow-req；LEFTOVER 0。
