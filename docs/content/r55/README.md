# 轮55：例行发现线（r54 复验 + 竞品 SEO 维度调研 + 数据例行）

分支 `devin/1786308692-r55`。本轮含 1 个 P1 修复（tag3 抽题索引计划）。

## 1. r54 三项线上复验

### 冷启动多次采样 → 发现并修复 P1 根因

复验时对多个未触碰 tag3 采样，发现仍有 13.4s（CS-ZZ-01）/4.8s（YY-XJ-01）级冷查——超出 r54「索引保活后 1-4s」预期。追查 `db.random_questions`：**tag3 筛选时 SQL 强制 `INDEXED BY idx_q_pick`，而该索引不含 tag3**，导致按 module 前缀大范围索引扫描+逐行回表核对 tag3（约 2-4 万行），冷态 I/O 放大为秒级。

修复（`backend/app/db.py`）：tag3 筛选时改走 `idx_q_tag3_disabled` 等值索引（EXPLAIN 实证 `SEARCH ... (tag3=? AND disabled=?)`），扫描范围缩到该考点行数（数百~数千）。已部署上线，**容器刚重建（最冷态）连续采样 8 个未触碰 tag3：全部 <1.5s（0.46-1.5s）**，对比修复前冷态 8-13s。r54 的 5 分钟索引保活与前端 3s 慢加载提示继续在位兜底。

### 跳页/返回链

- `/tiku/t/YY-LJ-01/?page=12`：首页/上一页/下一页/末页齐全；
- `/tiku/q/1274565`：「← 返回「中国古代史」考点题目列表」在位；
- 未知题 `/tiku/q/1200001` → 404 正常。

## 2. 竞品 SEO 内容策略调研（粉笔/华图 vs 我们 /tiku/）

| 维度 | 粉笔 fenbi.com/tiku | 华图 huatu.com | 我们 /tiku/ |
|---|---|---|---|
| 题库页可爬性 | SPA（Angular），HTML 无题目内容，靠品牌词+App | tiku.huatu.com 对爬虫 403；主站不做题库 SEO | SSR 全静态 HTML，题目/考点/试卷全可爬 |
| 内容主体 | meta keywords 堆砌+功能描述 | **海量时效资讯文章**（/2026/0520/xxx.html，日更，sitemap 按日 lastmod），单页内链 ~148 个 | 题目详情+考点聚合+方法讲解，内链闭环 |
| sitemap | 未见 | sitemap index 多分片、**每日 lastmod 更新** | index+pages/topics/questions 分片，lastmod 有值才输出 |
| 结构化数据 | 无 | 无（抽查文章页无 JSON-LD） | QAPage/CollectionPage/Breadcrumb JSON-LD |
| 面包屑/分类 | 无（SPA） | 「当前位置」面包屑+地区/项目二级分类 | 面包屑+模块/子模块/考点三级 |
| 长尾词策略 | 品牌词 | **「年份+地区+考试+话题」组合长尾**（如“2027天津华图模块化教学”） | 「考点名+真题/解题方法」长尾 |

可落地差距清单（按杠杆排序）：
1. **时效性内容缺失（华图核心打法）**：我们全部是"永久型"题库页，无"2026年国考/省考"类时效页。可落地：按年份×模块生成「YYYY年真题」聚合页（数据已有 exam_year/exam_region），标题带年份长尾词，sitemap lastmod 随题目更新。
2. **sitemap lastmod 更新频率信号弱**：华图每日 lastmod 吸引爬虫回访；我们大多数页无 lastmod。可落地：topics/pages 分片按该考点最新题 updated_at 输出 lastmod。
3. **内链密度**：华图单页 148 内链 vs 我们详情页 ~12。可适度增加（如详情页加同模块热门考点块），但避免堆砌。
4. 结构化数据我们已领先（竞品均无 JSON-LD），保持。
5. 前提仍是**收录 0**——以上在站长平台验证/收录破零前杠杆有限，优先级仍低于站长验证（需老板资源）。

## 3. 健康快扫 + 数据例行

```text
active 112962  mismatch(last-match,[A-D]+) 0  options non-JSON 0  (cid: 0
empty: panduan:334296, changshi:655861（既有台账 2 条，不变）
```

- 近7天 37 作答/12 uid；近14天 752/17（波峰已出窗）。
- 归因：source=seo 仍 0，share 5；growth_events 同前（share/team 个位数、comeback_view 1）；reminder_prefs 0。
- access 归档（当前窗口 ~3h，前期文件因日志被同机重载截短仅存 1 天）：534 请求，/tiku/ 48，**搜索引擎爬虫 0**，流量以本轮 QA 自测为主。
- Bing site: 仍无本站结果（上轮已查，无变化迹象）。

## 4. 下一批建议

1. 站长平台验证（P0，需老板资源，持续催办）——收录破零前 SEO 内容扩张杠杆有限。
2. 年份×模块「真题卷」时效聚合页（差距清单 #1，无外部依赖，数据就绪）。
3. sitemap lastmod 覆盖 topics 分片（差距清单 #2，小改动）。
4. 冷启动收尾观测：下轮抽样确认 tag3 索引修复长期效果。
