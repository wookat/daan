# 轮50：SEO 内链增强（同考点相关题互链 + 详情页直链 H5 开练）

## 0. 摘要

- `/tiku/q/{qid}` 详情页的「同考点相似题」互链模块（同 tag3 ≤8 条、服务端渲染）经查**已于 R16 存在**且在线生效，本轮复核其查询走 `idx_q_tag3_disabled` 索引（EXPLAIN QUERY PLAN 实证），无需缓存改造（页面级 `lru_cache(4096)` 已在位）。
- 本轮新增：详情页 CTA 从泛化「继续刷题」升级为「**在线练习此考点（免费）→**」，直链 `/#/pages/practice/practice?tag3=...&module=...&source=seo`；H5 练习页新增 `onLoad` URL 直链解析，落地即自动按该 tag3 拉题开练（作答归因 source=seo）。
- sitemap 零变化；详情页 P95 未劣化（部署前 13.8ms → 部署后 8.7ms，同方法同样本）；deploy_h5.sh 部署+回归全 200；健康快扫全绿。

## 1. 同考点相关题互链（复核 + 索引/性能）

- 现状：`_render_question` 已含 `SELECT id,question FROM questions WHERE tag3=? AND id!=? AND disabled=0 ORDER BY id DESC LIMIT 8`，不足 8 条时按 module+submodule 补齐；HTML 服务端渲染 `<section>同考点相似题</section>`。
- 索引实证（生产库）：`EXPLAIN QUERY PLAN` → `SEARCH questions USING INDEX idx_q_tag3_disabled (tag3=? AND disabled=?)`，复合索引精确命中，无全表扫描。
- 缓存：`@lru_cache(maxsize=4096)` 页面级缓存已在位，容器重启自动失效，无需额外缓存。
- 正确性抽查（qid=412606，tag3=CS-LS-01）：页面 8 条互链与 DB 直查结果完全一致，均同 tag3、排除自身、仅在架题。

## 2. 「在线练习此考点」直链开练（本轮新增）

- 后端 `backend/app/seo.py`：详情页有 tag3 时 CTA 输出
  `{SITE_BASE}/#/pages/practice/practice?tag3=<urlencoded>&module=<module>&source=seo`；无 tag3 保持原「继续刷题」链接。
- 前端 `frontend-uni/src/pages/practice/practice.vue`：新增 `onLoad(query)` 解析 tag3/module/source（decodeURIComponent 容错），`onShow` 中优先于 practiceLaunch 处理，直接 `start(module, null, null, false, undefined, tag3, source)`——复用既有 `/api/questions?tag3=` 拉题与空结果降级逻辑，作答记录带 `source=seo` 归因。
- 生产实测（Playwright 390px）：访问直链 6 秒内自动进入「常识判断 · 1/10」练习态，JS 报错 0；`/api/questions?tag3=CS-LS-01` 返回 5/5 条 tag3 全部一致。

## 3. sitemap 与性能

- sitemap 零改动：`https://kaogong.zalize.com/sitemap.xml` 200（1156B），互链为页内导航不入 sitemap。
- 详情页性能（同方法对比：生产宿主机 curl→127.0.0.1:8300，同一随机 40 题样本，串行冷缓存）：
  - 部署前：p50=7.9ms / p95=13.8ms / max=77.5ms
  - 部署后：p50=5.2ms / **p95=8.7ms** / max=37.6ms
  - 结论：P95 未劣化（本轮详情页 SQL 未变，仅 CTA 字符串拼接变化，符合预期）。

## 4. 部署与回归

- `deploy/deploy_h5.sh`：构建（bundle index-CvbB-hq6.js）→ .env 预检 → rsync（排除 .env）→ 容器重建 → 线上 bundle 与本机一致 → 7 项接口回归全 200。
- 线上详情页复核：CTA `practice?tag3=CS-LS-01` 正常输出、互链 8 条渲染正常。

## 5. 健康快扫

- active 112,962；options 非 JSON 0；(cid: 乱码 0；空缺仅剩 2 条存疑台账题（changshi:655861、panduan:334296）。
- hs 字母一致性：扫描器报 1 条（shuliang 331919），人工复核为**正则误报**——hs 中间句「答案为D的题数=…0道」被首匹配命中，结尾「确认答案为A」与 answer=A（选项A=0道）一致，题目本身无误，无需治理。

## 6. 遗留与轮51建议

- 站长平台验证 + 小程序提审仍是获客最高杠杆（需老板资源）；LLM key/ACCESS_CODE 待补发。
- source=seo 归因样本待自然流量出现后复盘（当前爬虫流量为 0）。
- 可选：健康扫描正则改为取 hs 中最后一次「答案为X」匹配，消除中间句误报。
