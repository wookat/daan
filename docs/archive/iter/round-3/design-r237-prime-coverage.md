# R237：部署预热清单补齐入口级公开页（模块 hub / 申论 hub / llms.txt）

## 取证（verified）

- 近 3h origin 日志：容器重建窗口内仍有入口级/浅层公开页 502[miss]→502[retry]（/tiku/yanyu/?page=193、/tiku/panduan/?page=439 等，均为旧 rev 部署窗口、R235 Caddy 改动生效前样本；R236 部署窗口零 502）。
- deploy_h5.sh 3b 预热清单只覆盖 /tiku/、daily、discuss、robots、sitemap 与 API 组：五大模块 hub（/tiku/yanyu/ 等）、R236 新增 /tiku/shenlun/、R231 /llms.txt 均无预热副本——重建窗口内这些入口页若无自然流量副本，只能依赖 R205 重试 + R235 lb_try，缺 stale-if-error 第一道退路。

## 方案（最小）

deploy_h5.sh 3b 清单追加：五大模块 hub + `/tiku/shenlun/` + `/llms.txt`（均为边缘可缓存 GET，与既有清单同语义）。深层分页页不预热（数量无界，非入口级）。

## 验证

bash -n；下一次部署实跑 prime 行全 200。
