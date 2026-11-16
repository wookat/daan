# R382：`/api/papers` 覆盖索引 + 日报「真人口径」候选流量（2026-09-04）

## 1. 取证（生产一手证据，均为只读）

### 1.1 R381 遗留三条候选逐项核对

| 候选 | 证据 | 结论 |
| --- | --- | --- |
| ① `/tiku/*` SSR 预渲染到 R2/KV + Worker 直出 | 近 3 天源站 5xx `503×1679 / 500×15 / 502×13`，p50 耗时 25.07 s（Caddy 25 s 上游超时）；5xx IP 前两位 `140.232.64.4/.5` 共 1,599 条（探针网段），其余为 GPTBot/ClaudeBot/扫描器；**排除探针 + 通用 bot UA 后候选真人 `/api/` 请求 52 条，5xx 0**。宿主 sar：iowait 均值 44%、尖峰 69–76%，`recruit-postgres` 累计读 5.22 TB / 写 259 GB。CF Pages Functions 已有 `API_EDGE_CACHE_TTL=60` + SWR + SIE + 源站重试（`X-Kg-Fetch` 近 3 天 pass 21,647 / swr 6,835 / miss 823 / retry 628） | 503 长尾在**探针与 bot 流量**上，真人样本无 5xx；边缘缓存/重试链路已存在。SSR 挪边缘属于架构大改且当前无真人受损证据，**不做** |
| ② Googlebot 是否进入 `/tiku/q/*` | 归档 UA 分类：googlebot 36 次、`/tiku/q/` 0；bingbot 206 / q 24；yandexbot 2,513 / q 2,028；gptbot 118,969 / q 112,896；claudebot 786；semrushbot 408 | Google 仍只抓 sitemap（首页入链后 <1 天，按计划 3–7 天再看）；AI 爬虫是 `/tiku/q/*` 流量主体，**不能计入搜索分发**。 |
| ③ `slow-req` 里 `/api/exam/papers` 10.5 s、`tag3=CS-LS-01` 4.0 s | 生产库副本（无 `sqlite_stat1`）冷缓存实测 `list_papers()` SQL：走 `idx_q_real_year (is_real=? AND disabled=?)` 回表 24,558 行，`disk=78.6 MB / 0.117 s`（本机 NVMe；生产宿主 iowait 44–76% 下同样读量即数秒到 25 s） | **真命中**：`/api/papers` 是公开 API allowlist 项且每个访客首屏卷库都打，冷页 79 MB 随机读在共宿 IO 饱和时直接变长尾 |

### 1.2 `/api/papers` 索引实测（生产库副本 `data-2026-09-04.db`）

```
无索引:  SEARCH questions USING INDEX idx_q_real_year (is_real=? AND disabled=?) | TEMP B-TREE GROUP BY | TEMP B-TREE ORDER BY
         rows=141  t=0.117s  disk_read=78.6MB
加索引:  SEARCH questions USING COVERING INDEX idx_q_paper_src (is_real=? AND disabled=? AND source>?) | TEMP B-TREE ORDER BY
         rows=141  t=0.002s  disk_read=0.0MB
结果集逐行比对：一致
```

### 1.3 Cloudflare 边缘口径未取得

三枚 token 都能读 `zalize.com` zone，但 GraphQL Analytics / Bot Management / Firewall / Rulesets 均 403（缺 `zone.analytics.read`）。因此 `X-Kg-Fetch` 只能证明「请求进了哪种回源模式」，**不能**等同边缘 HIT/MISS。需要 `Zone Analytics Read` 最小权限 token 才能闭合这条证据链。

### 1.4 数据真实性口径（本轮统计前提）

- `140.232.64.0/24` 为 Devin 共享 NAT 探针网段（R374 入库侧同口径）；`test-*` / `probe*` uid 为冒烟会话；GPTBot/ClaudeBot/SemrushBot/curl/fasthttp/WordPress 扫描等一律不是真人。
- `source='seo_q'` ≠ 真人 SEO 转化；`sitemap` 提交 / crawler 访问 ≠ 收录 / 排名。
- 「候选真人」= 上述都剔除后的剩余，仍可能含未识别的自动化流量，**只作上界**。

## 2. 方案（最小改动，零功能变化）

### 2.1 后端：`idx_q_paper_src` 部分覆盖索引

```sql
CREATE INDEX IF NOT EXISTS idx_q_paper_src
  ON questions(is_real, disabled, source, exam_year, exam_region) WHERE is_real=1
```

- 只覆盖 `is_real=1`（24,558 行，全库 156,792），列顺序与 `list_papers()` 的 `WHERE is_real=1 AND disabled=0 AND source…` + 聚合列一致 → COVERING，不回表。
- 与 R381 一样：生产无 `sqlite_stat1`，规划器靠列前缀匹配选索引，本地 EXPLAIN 已确认命中；生产上线后再以 `EXPLAIN QUERY PLAN` + 冷启动首请求耗时复核。
- 不改 `/api/exam/papers`（`list_exam_papers()`/`exam_paper_filters()` 组合耗时尚未拆解，留 R383 取证），不改 `tag3` 查询。

### 2.2 日报：`scripts/crawler_stats.py` 增 `humans` 段

```
humans: {
  api:    {day: n}   # 候选真人 /api/* 请求（剔 /api/health、/api/admin）
  api5xx: {day: n}   # 其中 status>=500
  page:   {day: n}   # / 、/tiku*、/s/*、/p/* HTML 页
  ips:    {day: n}   # 当日去重 IP 数（只出数量，不落原始 IP）
}
```

剔除规则：探针网段（`--exclude-ip-file`）→ 引擎 UA（已有 `BOT_ENGINES` 分支）→ 通用 bot UA（`BOT_GENERIC`，空 UA 视为 bot）→ uri 含 `uid=test-` / `uid=probe`。静态资源、`/wp-*` 之类扫描路径不计（`human_kind` 返回 None）。

### 2.3 管理台：`ops_status.crawlers.humans` + 看板「真人」行

`parse_crawler_stats` 汇总 7 天：`api_7d / api_today / api5xx_7d / page_7d / ips_7d(日去重累计) / ips_today`；旧版 JSON 无 `humans` 段时为 `null`，看板提示等待下一次 cron。看板行标注「剔除探针网段 / 引擎与通用 bot UA / test- uid」，避免被当成已确认真人。

## 3. 验证

- 本地：pytest 363（新增 3 例：真人口径剔除规则、humans 解析、`idx_q_paper_src` COVERING 计划）/ ruff / pyright 0；前端零改动（`dashboard.js` 为后端管理台静态资源，`node --check` 通过），复用 R381 bundle `index-Bctw4Xpu.js`。
- 新脚本在生产归档上试跑（输出到 `/tmp`，不覆盖 cron 产物）：14 天窗口 3.0 s；候选真人 API 09-01 5 / 09-02 48 / 09-03 2 / 09-04 1，5xx 全 0，日去重 IP 2–5。09-02 的 48 条来自一台 Android(vivo V2405A) 小程序设备。归档缺 08-21–08-30（历史 gap，非本轮）。
- 生产复验清单（部署后）：`EXPLAIN` 命中 `idx_q_paper_src`；容器重启后首个 `/api/papers` 耗时；管理台「搜索引擎抓取」面板出现「真人」行；testing agent 1440/375 卷库/练习冒烟。

## 4. 不做 / 留档

- 不做 SSR R2/KV 预渲染、不新增 API 缓存层、不重写 `/api/papers`、不调 F10 自动跳题、不改相关题目 UI。
- 宿主级 IO 争用（共宿 postgres）第 6 次上报，仍是长尾 503 根因侧解法。
- Cloudflare 边缘 HIT/MISS 需 `Zone Analytics Read` 权限 token。
