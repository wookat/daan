# 轮52：tag3 考点聚合页（SEO）+ H5 首载性能优化

分支 `devin/1786305124-r48`（PR#113）。已用 `deploy/deploy_h5.sh` 部署生产并回归通过。

## 1. tag3 考点聚合页

### 实现（backend/app/seo.py）

- 新路由 `/tiku/t/{code}/`（如 `/tiku/t/CS-LS-01/`），`/tiku/t/{code}` 301 到带斜杠版本；注册在 `/{module}/` 通配路由之前，无路由冲突。
- 页面内容（服务端渲染 HTML）：
  - 面包屑（题库 › 模块 › 考点）+ H1「{考点名}考点题库（N 题）」；
  - 「考点介绍」卡：taxonomy `desc` + `usage`（方法要点）；
  - 该考点在架题目列表（`disabled=0`），每页 50（沿用 `PAGE_SIZE`），复用 `_q_items`/`_pager` 分页；
  - 练习直链 CTA：`/#/pages/practice/practice?tag3=<code>&module=<module>&source=seo`（与轮50详情页一致，自动开练+归因）；
  - JSON-LD：`CollectionPage` + `BreadcrumbList`；canonical/title/description 均带考点名与模块名。
- 元数据来源 `taxonomy.topic_index()`（158 个三级考点），题数来自 `db.tag3_counts()`（5 分钟进程内缓存）；taxonomy 不存在或在架题数为 0 的 code 返回 404（当前 158-156=2 个考点无在架题，不生成空页）。
- 查询走索引：`WHERE tag3=? AND disabled=0 ORDER BY id DESC LIMIT ? OFFSET ?`，命中 `idx_q_tag3_disabled`；页面级 `@lru_cache(maxsize=1024)`（与题目详情页同口径，随部署重启失效）。
- 内链：`/tiku/` 首页各模块「按考点刷题」标签改为可点击的考点页链接；题目详情页考点名、相似题模块「查看考点全部题目 →」均链到聚合页。

### 性能（生产实测）

- 容器内 localhost 直测：冷渲染 ≤120ms（PD-TL-01 0.119s，其余 ≤3ms），lru_cache 命中后 ~2-3ms；
- 外网整页含 TLS：~0.6s；大考点第 3 页分页 200 / 0.64s。

### sitemap 新分片 + IndexNow

- 新增独立分片 `/sitemap-topics.xml`（156 条考点 URL），并加入 `/sitemap.xml` index（pages → topics → questions-1..12），既有分片零变更；线上 XML 解析有效。
- IndexNow：在服务器读 `deploy/.env` 的 INDEXNOW_KEY（未打印），向 api.indexnow.org 提交 sitemap-topics 全部 156 条 URL，返回 **202 Accepted**；`/indexnow-key.txt` 200 在线。
- 照实说明：提交≠收录，Bing 此前 site: 仍 0，收录需持续观测（站长平台验证仍待老板资源）。

## 2. H5 首载性能

### bundle 摸底结论

- 构建已按页面自动分包：首页/练习/统计等均为独立懒加载 chunk，`pkgA`（模考/申论/用户）已是分包；
- 主 bundle `index-*.js`（336KB 原始 / 121KB gzip）为 vue 运行时+uni 框架+公共 runtime，无 echarts/qrcode 等可拆的大业务依赖（grep 验证）；`App.vue` 全局导入（theme/offline/reminder）为启动语义必需；
- 结论：手工 manualChunks 拆框架属高风险低收益，本轮不动业务代码，选择**传输层优化**。

### 实施（零业务逻辑变更）

1. **brotli 预压缩**：`deploy_h5.sh` 新增 1b 步——构建后对 `assets/*.js|css` 生成 `.br`（-q 11，本轮 77 个）；
2. **后端静态服务升级**（backend/app/main.py `AssetStaticFiles`）：`Accept-Encoding: br` 时优先返回 `.br`（Content-Encoding: br + Vary），否则回退原文件走 Caddy gzip；
3. **长缓存**：带 hash 的 `/assets/*` 统一 `Cache-Control: public, max-age=31536000, immutable`（此前无缓存头，重访全部重下）。

### 375px 首载前后对比（Playwright，同直链 URL，各 3 次）

| 指标 | 优化前 | 优化后 |
|---|---|---|
| 主 bundle 传输 | 119KB (gzip) | **98KB (br)，-18%** |
| 首载 JS/CSS 总传输 | 154KB | **127KB (-18%)** |
| window load | 1.15-1.17s | 1.18-1.30s（持平） |
| 直链自动开练 | 2.2-3.2s | 2.2s（暖）/10-15s（API 冷启动首跑，轮51已知现象） |
| 重访 assets | 全部重新下载 | **immutable 缓存 0 请求** |

线上验证：`curl -H "Accept-Encoding: br" /assets/index-*.js` → `content-encoding: br`、`content-length: 99911`、immutable 缓存头。

## 3. 部署与回归

- `deploy_h5.sh` 全流程通过：.env 预检、bundle 一致（index-CvbB-hq6.js）、ADMIN_TOKEN 注入校验、7 项接口回归全 200；
- 生产抽查：`/tiku/t/CS-LS-01/`、`/tiku/t/ZL-JQ-01/` 200，未知 code 404，无斜杠 301，分页 200；题目详情页/相似题/CTA 不劣化（/tiku/q/1274565 200 且带考点链）。

## 4. 健康快扫（active-only）

```text
active 112962
hs mismatch(last-match) 0
options non-JSON 0
(cid: garbling 0
empty: panduan:334296, changshi:655861   ← 既有存疑台账 2 条，不变
```

（口径沿用轮51：hs 结论取最后一次「答案为X」匹配，331919 中间句误报已消除。）

## 5. 遗留/说明

- 156 个考点页已提交 IndexNow（202），收录情况待后续轮次复盘；站长平台验证/小程序提审仍待老板资源；
- LLM key/ACCESS_CODE 仍待补发，AI 功能保持降级；
- brotli 预压缩依赖本机 `brotli` CLI（deploy 脚本无则告警回退 gzip，不阻塞部署）。
