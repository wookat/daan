# R247 设计记录：申论素材卡「复制素材链接」出向分享

## 取证（一手证据）

- verified（代码 + 生产）：R246 打通了「搜索 → mid 深链 → 具体素材置顶展开」的入向链路，且该深链对任意合法素材 id 均有效（生产实测 ?tab=m&mid=35 直达）。但 App 内浏览素材的用户没有任何出向出口——素材卡只有收藏星标，无法拿到直达本条素材的链接发给考友。
- verified（代码）：申论真题详情已有对称能力（R243：buildShenlunUrl + copyQLink「复制本题链接」+ setClipboardData + toast），素材侧缺失。
- verified（生产 origin 日志，8h 窗口 1974 行）：无新产品缺陷——admin stats/governance 慢样本（1.6–8.8s）全部落在 22:02Z R238 部署之前（逐条对时 deploy-history.log，且均无 X-Kg-Cache 头=旧 rev），当前生产实测 stats 0.0x s + X-Kg-Cache: stale/hit；8 条 502 全为部署重建窗口深页 miss/retry/swr 形态（R218/R226 设计行为）。

## 方案

1. `src/shenlun-url.js` 新增纯函数 `buildShenlunMatUrl(id, type)`：
   - id 合法（正整数）→ `/#/pkgA/shenlun/shenlun?tab=m&mid=<id>`（type 合法再附 `&mtype=<encodeURIComponent(type)>`）；
   - id 非法 → 回落基础素材 tab 路径 `?tab=m`。
2. `shenlun.vue` 素材卡出处行旁新增「复制链接」控件（对齐既有 `.d-copy` 样式与 copyQLink 交互）：`copyMatLink(m)` = origin + buildShenlunMatUrl → setClipboardData + toast。
3. 收到该链接的一端走 R246 既有 onLoad(mid) 链路：置顶 + 展开 +「搜索命中」角标改文案不动（角标语义即「定位命中」，保持不变，避免扩散改动）。

## 明确不做

- 不新增素材 SSR/落地页，不改 SEO/canonical/JSON-LD/sitemap；
- 不改素材列表排序/分页/收藏语义；
- 不做微信 JS-SDK 分享卡（需老板资源）。

## 验证计划

- vitest：buildShenlunMatUrl 合法/非法 id、带/不带 type 分支；
- 本地门禁：lint/vitest/build + ruff/pytest/pyright；
- 生产 1440/375：素材卡复制控件可见可点、剪贴板实读完整链接、toast、新开该链接直达同条素材置顶展开；无副作用（星标/展开/加载更多不变）。
