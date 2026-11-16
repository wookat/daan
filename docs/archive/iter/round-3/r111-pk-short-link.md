# R111：PK 战绩短链落地页 /p/{rid} + 分享链接抗截断收口

## 取证（一手证据）

- 近 24h growth_events：share_open 13 条中多数 ref=None，pk_result_open 6 条全部 ref=None（保护 uid 实际使用产生，非探针）；ref=None 意味着落地页拿不到 sid/rid，用户只能看到错误态。
- 生产 CDP 复现：`/s/{sid}`（含 ?v=）→ SPA 后 sid/variant 无损（track ref=fsb75lki），短链路径本身健康。
- 代码事实：PK 战绩/挑战分享文案用裸 hash 链接 `https://kaogong.zalize.com/#/pkgA/share/pk-result?rid=…`（pk.vue shareResult 两个分支）。聊天应用链接识别普遍在 `#` 或 fragment 内 `?` 处截断，rid 丢失 → 与 ref=None 观测吻合。
- `/s/` 已有 SSR OG 落地页；PK 战绩无对应短链路由（seo.py 仅 /s/{sid}）。

## 方案（小批次）

1. 后端 seo.py 新增 `GET /p/{rid}`：镜像 share_landing——查 pk_matches（finished），OG 标题「{creator} {比分} {opponent}｜答题PK战绩，不服来战！」，og-card 图，meta refresh + location.replace 跳 `/#/pkgA/share/pk-result?rid=`，无效 rid 302 首页，noindex。
2. pk.vue shareResult 两分支链接改 `https://kaogong.zalize.com/p/{code}`。
3. 地址栏规范化：share-q.vue / pk-result.vue onLoad（H5、id 有效时）`history.replaceState` 回写 `/s/{sid}` / `/p/{rid}`，并挂一次性 hashchange 监听在站内导航时把 path 还原为 `/`（避免后续路由叠加在 /s|/p 路径上、刷新误落分享页）。地址栏转发/浏览器原生分享由此也变成抗截断短链。
4. 边缘缓存：CF functions isEdgeCacheable 补 `/p/` 前缀（与 /s/ 同策略）。

不做：PK 挑战邀请链接（`#/pkgA/pk/pk?code=`）短链化——本轮无对应错误态证据，且邀请页需活跃对局语义，留证据出现再立项。

## 验证

- 本地：ruff/pytest、npm lint/build:h5；curl /p/{rid} OG 断言；无效 rid 302。
- 生产：/p/{rid} OG + 跳转 + track ref 带 rid；share-q/pk-result 地址栏回写与 hashchange 还原；1440/375、console、overflow；测试数据清理；保护 uid 零 mutation。
