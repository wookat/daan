# 轮41：轮40复验 + SEO 观测首报 + 健康快扫

## 0. 本轮发现并修复的 P1：轮40 H5 dist 未真正上线

复验召回卡时发现线上 index.html 仍引用旧 bundle（home chunk 无 `comebackShown`），即轮40 的 H5 前端产物未随部署生效（后端/数据变更均已生效）。本轮重新 `rsync frontend-uni/dist` 并重建容器，确认线上 index → `index-WgOpEAD3.js` → `pages-home-home.D6TVY_V5.js`（含召回卡代码），回归 /api/stats、/tiku/、/admin 均 200。
教训：部署后应校验线上 bundle hash 与本机构建一致（已纳入建议清单）。

## 1. 轮40三项线上复验

### 1.1 召回卡（模拟旧 uid，Playwright 实测）
- 注入本地 `pstats`（最近一次练习=10天前、累计55题）后刷新首页：召回卡展示「欢迎回来！你已累计练 55 题 / 上次练习是 10 天前 · 继续保持，看看你的学习周报」，同时上报 `comeback_view(source=home)` 一次（POST /api/track 实际发出并入库）。
- 再次刷新：卡不再展示、不再上报（`comebackShown` 按日去重生效）。
- 测试 uid `r41test-cb` 的 growth_events 已清理（1条）。

### 1.2 引号修复题渲染抽查
- 从轮40实际更新的1,500条中随机抽10条（404922/397453/389197/387654/405203/426798/488589/396446/426361/396290），线上 /tiku/q/<id> 全部渲染规范化后题干，10/10 通过。

### 1.3 access log 持续落盘与轮转
- `/var/log/caddy/kaogong.zalize.com-access.log` 持续写入（开启约16小时累计108条），JSON 可解析；
- 站点块轮转配置在位：`roll_size 50MiB / roll_keep 14 / roll_keep_for 336h`，caddy active；磁盘 82% 已留意（日志上限约 700MiB）。

## 2. SEO 观测首报（log 样本期约16小时，照实报）

- 总请求 108，其中 /tiku/ 15 次；
- UA 分布：Mozilla 77 / curl 21 / Python-urllib 10——经比对时间与 URL，**全部为本轮及轮40自测流量**，尚无 Bingbot/Googlebot/Baiduspider 等真实爬虫记录；
- /tiku/ Top URL 均为自测题目详情页，无自然访问；
- Bing `site:kaogong.zalize.com` 复查：仍 0 收录（返回的是无关结果，IndexNow 提交后约6天）。
- 结论：观测管道已就绪，但样本期过短且无自然流量，建议下轮起按周出报。

## 3. 全站健康快扫（容器内只读）

- active 112,971；四模块 hs 空缺仅 2 条已知存疑题（655861/334296）；
- options 非 JSON 0、(cid: 乱码 0、hs 结论字母不一致 0；
- 题干 `“‘` 残留 476 = 460 条合法嵌套引号 + 16 条轮40撞 UNIQUE 跳过项，与轮40台账一致。

## 4. 下一批改进建议（不实施）

1. **部署校验步骤**：部署脚本末尾自动比对线上 index.html 引用的 bundle hash 与本机构建产物（本轮 P1 的根因防复发），P0；
2. **爬虫可见性**：Bing 收录 6 天仍为 0，IndexNow 之外补 Bing Webmaster Tools 验证站点+提交 sitemap（需老板账号或 DNS/文件验证授权），P1；
3. **16条撞重题去重裁定**：语义与既有题重复，逐条人工裁定保留/下架，P2；
4. **召回卡效果观测**：comeback_view 自然样本累积后与回访练习转化连起来看（依赖 access log+growth_events 周报化），P2；
5. **access log 周报自动化**：脚本化「请求量/爬虫 UA/Top URL」周度统计入 docs，P2。
