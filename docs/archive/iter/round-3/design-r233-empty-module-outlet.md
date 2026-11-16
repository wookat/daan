# R233：空模块 404 页补 App 专区直达出路（/tiku/shenlun/ → 申论专区）

## 取证（verified / inference / unknown）

- verified：R232 上线后生产 `/tiku/shenlun/` 稳定为品牌 404 + noindex（light/dark axe 0 违例，本轮复扫）；本窗口 origin 日志无新 verified 缺陷——78 条 >1s 慢样本全部集中在 20:41 部署 prime 触发的边缘 SWR 并发回源（rsync/重启 IO 争用窗口，客户端拿 stale 即回，不外泄）；4 条 502 中 3 条为自有 curl 探针、1 条爬虫深页 miss→retry→200 按 R205 设计恢复。
- verified：llms.txt / sitemap / /tiku/ 内链均不含 shenlun，一致性完好。
- verified：App 内存在完整「申论专区」（`frontend-uni/src/pkgA/shenlun/shenlun.vue`，路由 `/#/pkgA/shenlun/shenlun`）：真题题库（地区/年份/题型筛选）+ 素材范文 + 在线作答记录。
- 缺口：`/tiku/shenlun/` 的 404 只给通用出路（题库首页/真题卷/每日一练），而产品实际有申论能力——搜索/直达申论的用户被引向与申论无关的行测入口，是把真实能力藏起来的死胡同。

## 方案

- `_not_found(msg, cta_html="")` 增加可选 CTA 槽位（默认空，所有既有调用零变化）。
- 新增 `_EMPTY_MODULE_OUTLET` 映射（当前仅 shenlun），`tiku_module` 空模块分支透传对应 CTA：
  `申论请前往「申论专区」：历年真题 + 素材范文 + 在线作答 →`（`.cta` 样式，链接 App hash 路由）。
- 404 状态码 / noindex / 无 canonical / 通用出路均不变；其余 404 调用点不受影响。

## 明确不做

- 不为申论建设题库内容；不改 App 路由或申论专区本身；不把该页恢复为 200。

## 验证

- pytest：空模块 404 含专区链接与文案 + 通用 404 不含该链接（+1 例，112 passed）；pyright 0；ruff 干净。
- 前端门禁（无前端改动，回归确认）：lint(src+tests+edge) OK、vitest 133 passed、build OK。
- 部署后生产复验：`/tiku/shenlun/` 404 + noindex + CTA 渲染可点、`/tiku/whatever/` 无 CTA、1440/375 双视口、axe。
