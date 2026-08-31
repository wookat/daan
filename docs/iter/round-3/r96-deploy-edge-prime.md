# R96：部署前边缘缓存预热——收窄 R95 stale-if-error 的「无副本」缺口

日期：2026-08-31 · 状态：已实现

## 取证

1. R95 已上线 stale-if-error：可缓存 GET 在 origin 5xx/不可达时回退 ≤24h 陈旧副本；生产演练（docker stop）实证 200+STALE。
2. R95 明确边界：**只保护「曾被缓存过」的 URL**。部署容器重建窗口（实测每窗 1–2 分钟）内首次到达的可缓存 URL 仍会 502——而部署恰恰是 502 聚簇的主因（24h 日志 502×85 全部聚簇在部署窗口）。
3. 边缘可缓存面（functions/[[path]].js isEdgeCacheable）：/tiku*、/s/*、/sitemap*、/robots.txt、API 允许清单 7 端点。其中入口级 URL 有限且已知；/tiku/q/*（15 万题页）无法穷举，只能靠自然流量沉淀副本。
4. SPA 壳（/ 与 /assets/*）由 Pages 静态层直出，不经 origin，部署窗口本就不受影响。

## 方案（只改 deploy/deploy_h5.sh）

新增 step 3b「边缘缓存预热」：rsync 之后、容器重建**之前**，对入口级可缓存 URL 逐个经主域发 GET，把副本刷新至最新（R95 副本长存 24h，重建窗口内这些 URL 必有可用 STALE 副本）：

- 页面：/tiku/、/tiku/daily/、/tiku/discuss/
- SEO：/robots.txt、/sitemap.xml
- API 允许清单：/api/announcement、/api/question_counts、/api/daily_set、/api/submodules?module=×5（无参 422，边缘缓存键是全 URL，需逐模块预热）、/api/real_filters、/api/papers、/api/comments/plaza

预热失败只 WARN 不 FAIL（origin 本就可能带病，预热非部署门槛）。

## 验收

- bash -n 语法检查通过；
- 生产完整部署实跑（--skip-build）全程 exit 0：首跑发现 /api/submodules 无参 422（已改逐模块预热）、/tiku/ 一次 000（冷 origin 超 30s，WARN 不阻塞设计生效），其余全 200；修正后预热清单单独实跑全 200。

## 边界

- /tiku/q/* 长尾题页不预热（15 万级），仍依赖自然流量沉淀副本+R95 兜底；
- 预热只覆盖「本脚本部署」路径，autoheal 自动重启窗口靠日常流量沉淀的副本（≤24h）兜底。
