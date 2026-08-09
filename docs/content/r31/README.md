# 轮31 增长线：IndexNow 接入 + sitemap 自检 + SEO 详情页 hs 展示

分支：devin/1786279951-r31-growth（代码+本报告）。部署：本机改动 rsync 至生产 `~/kaogong-assistant` → `docker compose up -d --build` 重建 `deploy-kaogong-1` → 回归通过。

## 1. IndexNow 接入

- 生成 key：`ce5e9a5e2bd56db951fdefb687baee5f`（写入生产 `deploy/.env` 的 `INDEXNOW_KEY`，compose 已透传）。
- 后端新增路由 `GET /indexnow-key.txt`（backend/app/seo.py），线上验证 200，返回 key 本体。
- 新增提交工具 `scripts/indexnow_submit.py`：从线上 sitemap 分片抓取全量 URL，POST `https://api.indexnow.org/indexnow`（host+key+keyLocation+urlList），支持 `--pages-only/--limit/--batch/--sleep` 限速分批，非 200/202 即中止。

### 提交结果

- 导航页先行：194 条（sitemap-pages.xml 全量）→ HTTP 202，1 批。
- 全量提交：113,165 条（194 导航 + 112,971 题目详情），批大小 5000、批间 sleep 6s，共 23 批。
- 返回码统计：HTTP 202 × 194（导航先行批）+ HTTP 200 × 113,165（全量 23 批全部成功），0 失败。

## 2. sitemap 自检（线上实测）

- `robots.txt` 200，包含 `Sitemap: https://kaogong.zalize.com/sitemap.xml`，Allow /tiku/、Disallow /api/ /admin。
- `sitemap.xml` 200：索引含 sitemap-pages.xml + sitemap-questions-1..12.xml，共 13 个分片，全部 200 可访问。
- 题目 URL 计数：分片 1-11 各 10,000、分片 12 为 2,971，合计 112,971，与生产 active 题量一致（分片由 DB 实时生成，题量变化自动跟随，无需手工重生成）。
- 导航页 194 条（/tiku/ 首页、模块页、子模块分页、试卷页）。
- lastmod：当前 urlset 未输出 `<lastmod>`（questions 表无可靠的逐题更新时间字段，避免编造时间戳故不添加；协议中 lastmod 为可选项，不影响收录）。

## 3. SEO 详情页 hs 讲解展示

- backend/app/seo.py：解析块改为分节展示——同时有 hs 与原解析时输出「花生十三讲解」+「原解析」两段；只有其一则单段展示；无解析显示「暂无解析」。只读展示，零数据变更。
- 线上抽查 `/tiku/q/1`：两个小节均正常渲染。

## 4. 回归

- `/api/stats` 200；`/indexnow-key.txt`、`/robots.txt`、`/sitemap.xml`、13 个分片、`/tiku/q/{id}` 抽样均 200。

## P2 / 备注

- lastmod 如后续需要，可在导入/修订流程中给 questions 增加 updated_at 字段后再输出。
- IndexNow key 属公开验证材料（协议要求可公开访问），不涉敏感凭据。
