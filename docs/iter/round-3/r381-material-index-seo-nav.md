# R381：资料分析 `material_hash` 无索引（SEO 材料题组 + 练习拉题全表扫）+ 首页壳给搜索引擎一条可爬的题库入口

## 取证事实（2026-09-04，一手证据）

### 候选 F10「答对自动跳题默认值」——不改

- `practice.vue` 已有「答对自动下一题」开关（`autoNext`，本地持久化，默认开；深链 `pick=` 首题不自动跳）。生产 `growth_events`/`answer_log` 中**非探针**（`probe IS NOT 1`）真人作答 14 天内以 `direct/share/空 source` 为主、样本量不足以区分「开/关」对完成率的影响；探针行（我们自己的复验）不能当用户行为。→ 没有证据支撑全局改默认值，本轮**不动**，等真人样本。

### 候选「落地页相关题目信息密度」——已具备，不重复造

- `seo/pages.py::_render_question()` 已有：题干/图片/选项 `pick=` 深链/CTA/折叠答案解析/同材料题组（≤8）/同考点相似题（≤8，不足按模块补齐）/同考点全部题入口/QAPage + BreadcrumbList JSON-LD/canonical/meta description。Bing 7 次、Yandex 87 次抓到的题目页都是这套结构；没有任何真人 `seo_q` 转化数据能证明「相关题目」区域是流失点。→ 本轮不改页面结构。

### 真正命中的问题：`material_hash` 查询没有索引（verified）

生产库只读 `EXPLAIN QUERY PLAN`（`sqlite_stat1` 不存在，规划器全靠启发式）：

| 查询 | 现状计划 | 实测 |
| --- | --- | --- |
| `_render_question` 同材料题组 `WHERE material_hash=? AND disabled=0 ORDER BY id LIMIT 8` | `SEARCH USING INDEX idx_q_sitemap (disabled=?)`——按 id 顺序扫**全部 156,792 行**直到凑够 8 条；hash 不命中时扫到底 | 冷 2.2–3.4 s / 题（`/tiku/q/795373` 首请求 2.229 s，第二次 0.007 s） |
| `grouped_ziliao_questions` 选材料 `... module='ziliao' AND material_hash IS NOT NULL ... GROUP BY material_hash` | `idx_q_disabled_module` 读 4,698 行 ziliao 全部回表 + TEMP B-TREE | 2.235 s（容器内直连库，非 API） |
| 同函数每材料取同组题 `module='ziliao' AND material_hash=? AND disabled=0` ×24 | `idx_q_disabled_module` 每次回表 4,698 行 | 24 次 0.169 s（热）|
| `/api/questions?module=ziliao&grouped=1` | — | 首请求 0.517 s，热 0.071 s |

受影响面：4,373 题带 `material_hash` 的资料分析题目页（Yandex 已在抓）+ **每一次资料分析练习拉题**（真人可见路径）。与之对照：模块分页 `/tiku/shuliang/?page=519` 0.119 s、tag3 相似题走 `idx_q_tag3_disabled`，都不是问题。

### 一并排除：25 s 长尾 503 不是应用查询（verified，归因宿主）

- 09-04 05:34:19Z 同一秒 `/robots.txt`（纯静态字符串）和两个 `/tiku/yanyu/` 分页同时 25 s 503——整个进程停摆，不是某条慢 SQL。
- 宿主 `sar` 同刻（13:30–14:00 本地）：**iowait 64–76%、load 10–14、pswpin/out ≈ 2,800 页/s、blocked 14–17**；kaogong 容器 `VmSwap=0`（R372 已钉住），换页全是共宿容器。容器事件日志无重启/OOM。→ 宿主级 IO 饱和，第 5 次上报，应用侧只能减少自身 IO（本轮索引正是减 IO）。
- 边缘 `x-edge-cache` 对 `/tiku/q/*`、`/tiku/`、`/sitemap.xml`、深分页均 `HIT`；长尾只落在 `miss/retry/swr` 穿透到源站的请求。

### 首页壳没有一条可爬的题库链接（verified）

- `curl https://kaogong.zalize.com/` 原始 HTML：`<a href>` 数量 **0**，`/tiku` 出现 0 次；`/tiku/*` 10.9 万页只靠 sitemap 被发现（Googlebot 抓 sitemap 32 次、`/tiku/q/*` 0 次；GSC「已发现 109,903 页」但一直未抓）。`home.vue` 的「浏览题库」是 `@click → window.location.href`，不是链接。
- 推断（inference，非事实）：只在 sitemap 里、站内零入链的 URL 会被引擎视为孤立页、爬取优先级低；给首页一条真实入链是零成本的可爬路径，**不等于**收录/排名会随之发生。

## 方案（最小改动）

1. `db.init_db()` 增加部分索引  
   `CREATE INDEX IF NOT EXISTS idx_q_material ON questions(material_hash, disabled, module) WHERE material_hash IS NOT NULL`  
   - 本地无统计信息下四条查询 `EXPLAIN` 全部命中：同材料题组 `material_hash=? AND disabled=?`；`grouped_ziliao_questions` 选材料走 **COVERING INDEX**（不回表）、取同组题 `material_hash=? AND disabled=? AND module=?`；`reinforce/similar` 的 `tag3+material_hash` 组合也命中。  
   - 部分索引只含 4,373 行（不含 15 万 NULL），体积 ≈ 200 KB；启动时一次性建索引读一遍表（同 `idx_q_pick` 先例），healthcheck `start_period 180s` 有余量。  
   - 零 SQL 改动、零语义改动；回滚 = `DROP INDEX`。
2. `frontend-uni/index.html` `#app` 之后加 `<nav id="kg-seo-nav">`：`/tiku/`、五模块、`/tiku/shenlun/`、`/tiku/papers/`、`/tiku/daily/` 九条真实链接；样式 `#app:not(:empty) ~ #kg-seo-nav { display:none }`——uni-app 挂载后隐藏，挂载前被现有全屏 splash 盖住，用户任何时刻都看不到；无 JS 抓取者看到的是和用户一致的真实站内导航。

## 验证

- 后端 pytest：`init_db` 后 `idx_q_material` 存在且为部分索引；两条真实查询 `EXPLAIN QUERY PLAN` 命中 `idx_q_material`；`grouped_ziliao_questions` 结果不变。
- 前端 vitest：`index.html` 含 9 条 `/tiku/*` 链接且带隐藏规则。
- 生产：部署后 `EXPLAIN` 三条查询计划、`/tiku/q/<冷材料题>` TTFB、`/api/questions?module=ziliao&grouped=1` 冷/热耗时；`curl /` 出现 `<a href="/tiku/">`；1440/375 首页/练习/资料分析拉题/SEO 题目页 console 0 error，容器 0 重启。
