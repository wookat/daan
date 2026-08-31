# R118：边缘函数决策逻辑纯函数化 + vitest 回归覆盖

## 取证（verified facts）

- `deploy/cf-pages/functions/[[path]].js`（131 行）承载全站边缘关键决策：
  爬虫 UA 拦截（R88）、缓存准入 `isEdgeCacheable`（R45/R56/R68/R87/R111 累积规则）、
  stale-if-error 新鲜度判定（R95）、缓存写入内容类型守卫（R87 曾在此处出过守卫缺陷）。
- 全仓库对该文件零测试：R112/R116 后端 pytest 19 例、R117 前端 vitest 13 例均不覆盖边缘层；
  历轮改动（R86/R88/R95/R97/R111 均动过此文件）全靠生产实测回归，规则被无声打破无任何本地信号。
- 决策逻辑全部内联在 `onRequest` 里，依赖 `caches.default`/`fetch`/`env`，本地不可直接单测。

排除项（同轮取证不立项）：
- sitemap-pages.xml 冷 15.1s：origin 容器内实测热态 0.09–0.12s，冷 3.07s 系宿主 load 9–13 挤占，
  且已有边缘缓存+stale-if-error 覆盖，无独立缺陷。
- 离线态：主包页有「连接服务器超时，点击屏幕重试」明确降级；未访问分包离线深链静默回首页，
  影响面极小且静态资源不拦截是 R71 反挂起既定设计。
- axe 审计 serious 项 `scrollable-region-focusable`（body）：1440 实测键盘 Arrow/PageDown 可滚动
  （scrollY 0→907→1124），实际为误报；其余均为 uni-page-head 框架级 moderate 项。

## 方案

1. 新增 `deploy/cf-pages/functions/edge-policy.js`：从 `[[path]].js` 平移决策纯函数（行为逐字节等价）：
   - `isBlockedBot(pathname, ua)`：robots.txt 放行 + BLOCKED_BOT_UA 匹配；
   - `isEdgeCacheable(method, pathname, hasAuth, hasUid)`：页族/共享 API 准入；
   - `edgeTtl(pathname)`：API 60s / 页面 300s；
   - `cacheFreshness(cachedAt, nowSec, ttl)`：'hit' | 'stale'；
   - `isCacheableContentType(pathname, isApi, contentType)`：sitemap/robots XML|plain、API json、页面 html。
2. `[[path]].js` 改为 import 上述函数，删除内联实现；`onRequest` 只剩 IO 编排。
   （Pages Functions 原生支持 functions 目录内 ESM 相对导入。）
3. `frontend-uni/tests/edge-policy.test.js`：复用 R117 vitest 基线（相对路径 import），
   锁定：六爬虫 UA 命中/大小写、robots.txt 放行、Googlebot 不拦；tiku//s//p//sitemap/robots 准入、
   API 允许清单、Authorization/uid 绕过、POST 不缓存；TTL 分派；新鲜/过期边界；
   sitemap xml、API json、页面 html 的 ct 守卫及反例。

## 验证

- 本地：`npm run test`（frontend-uni，新增用例全过）+ `npm run lint`；后端 ruff/pytest 不受影响。
- 生产：deploy 后实测——爬虫 UA 403、/tiku/ MISS→HIT、/api/question_counts?uid= 绕过缓存、
  robots.txt 可被拦截 UA 读取、X-Edge-Cache 语义不变。
