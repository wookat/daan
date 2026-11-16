# 轮43：例行发现线（部署链路复验 + 三端构建健康 + 数据/周报 + 建议清单）

日期：2026-08-09（UTC）。分支 devin/1786294310-r38-weak（PR#110）。本轮零代码与生产数据变更（避开 AI 功能，未接入任何新渠道）。

## 1. deploy_h5.sh 部署链路复验

完整跑一次空部署（无代码变更），6 步全部通过：

- 本机构建成功，bundle `index-WgOpEAD3.js`；
- 生产 .env 预检通过（存在且非空）；
- rsync、容器重建成功，容器 ADMIN_TOKEN 非空校验通过；
- 线上 bundle 与本机构建一致（`index-WgOpEAD3.js`），home chunk 存在于本机产物；
- 接口回归 7 项（/api/stats、yanyu/changshi 抽题、/tiku/、/robots.txt、/indexnow-key.txt、/admin）全 200。

内容复核：轮42 下架的 9 条撞重题（388632/388953/395661/395915/396459/405472/413222/413392/419785）线上 /tiku/q/ 全部 404；188956 hs 修复版（「C正确…排除A」）线上渲染正常；四模块 /api/questions 抽题正常。

## 2. 三端构建健康

- H5：`npm run build:h5` 成功（即上面部署构建）。
- 小程序 miniapp-native：`tsc --noEmit` + `eslint --quiet` 通过。
- Flutter：`flutter analyze` No issues found。

## 3. 数据例行 + access log 首份周报

数据（生产库只读，近7天）：

- 自然作答 0 次 / 0 uid；growth_events 0 条；复习作答 0 次。上一波活跃（8/1-8/2 重度用户 715 次）已超出 7 天窗口，此后无自然新增流量——获客/分发仍是当前最大瓶颈（依赖老板侧资源的项见 §4）。

access log 周报（scripts/access_log_report.py，`--days 7`）：

- 时间范围仅 2026-08-09 17:06~17:45 UTC：**发现 P2** —— 服务器 Caddy 在 08-09 17:06 UTC 被重载（journalctl 显示 `Reloaded caddy.service`，同机另一站点 jobs.zalize.com 的日志配置有变动），kaogong access log 文件同时被重建，此前约 1.5 天日志（轮41 观测的 108 条）丢失。量小影响可忽略；该重载非本项目会话操作，后续周报若再遇断档以此解释。
- 窗口内：总请求 147、/tiku/ 31、搜索引擎爬虫 0、其他 bot 70（curl 56+python 14，全为本轮部署回归/复核自测）、疑似真人 77（自测浏览器）。仍无任何真实爬虫/自然流量，与轮41/42 一致。

## 4. 下一批建议清单（不实施）

1. **（P0，依赖老板）LLM_API_KEY / ACCESS_CODE 补发**：AI 功能持续降级中，补发后写入生产 deploy/.env 并重建容器即恢复。
2. **（P1，依赖老板）Bing Webmaster Tools / 百度站长验证**：IndexNow 提交已 7+ 天仍 0 收录，需站长平台确认抓取状态；需老板账号或 DNS 授权。
3. **（P1，无依赖）分享链路增强**：分享落地页目前是唯一被验证有转化的自然获客渠道（轮30：打开4→作答2），可做分享卡片文案/成绩单海报 A/B。
4. **（P2，无依赖）小程序迷你模考报告页**：补齐三端唯一缺口（轮38 遗留），上架微信小程序是潜在分发渠道的前置。
5. **（P2，无依赖）access log 周报定时化**：将 scripts/access_log_report.py 挂 cron 周报输出到文件，断档可及时发现。
