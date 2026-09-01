# R201：模块 hub 页补考点/年份内链（收口 sitemap 弱内链考点页）

## 一手取证（2026-08-29，生产 kaogong.zalize.com，rev d7fe5d6）

- `sitemap-topics.xml` 收录 **156** 个考点专题页；`sitemap-years.xml` 收录 **102** 个年份页。
- `/tiku/` 首页每模块考点链接截断 `[:12]`，实测全页唯一考点内链只有 **60** 个（`grep href="/tiku/t/…"` 去重）；年份链接 102 个齐全。
- 模块 hub 页（如 `/tiku/changshi/`，30907 题）只有面包屑、题型 tags 与 20 条题目链接，**零考点/零年份内链**。
- 即 ~96 个 sitemap 收录的考点页没有任何稳定 hub 入链，只靠题目详情页的考点标签与同组兄弟考点互链可达（组内全员未上首页时是弱连通孤岛），爬虫权重传导与用户下钻路径都断在模块层。

## 方案（只动 `tiku_module` 渲染，路由/canonical/sitemap 零变化）

模块页在「按题型刷题」卡后新增两卡，复用首页 `tiku_index` 的既有取数与链接约定，但**按模块过滤且不截断**：

```python
# tiku_module() 内
t3counts = db.tag3_counts(); ycounts = db.year_module_counts()
topic_links = [f'<a href="{_topic_path(t["code"])}">{t["name"]}（{n}）</a>'
               for g in <本模块 groups> for t in g["topics"] if (n := t3counts.get(t["code"]))]
year_links  = [f'<a href="{_year_path(y, module)}">{y}年（{n}）</a>' for 按年倒序过滤本模块]
body += <card 按考点刷题>{topic_links 全量}</card> + <card 按年份刷真题>{year_links}</card>
```

不做：首页 `[:12]` 截断策略不动（首页控长）；考点/年份页自身渲染不动；不新增路由。

## 验证

- pytest：模块页包含本模块考点专题链接与年份链接。
- 生产部署后：5 个模块页考点内链总数 ≥ sitemap 考点数（156），1440/375 双视口溢出 0、console 0 error、Lighthouse 预算全过。
