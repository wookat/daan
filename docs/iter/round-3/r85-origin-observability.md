# R85：origin 侧可观测性收口——kaogong-origin 访问日志 + 代理层 UA/IP 透传

## 取证（2026-08-31）

1. **origin 访问日志缺失**：生产 Caddy 中 `kaogong.zalize.com` 站点块有 access log，但自 CF Pages 迁移后全量真实流量走 `kaogong-origin.zalize.com` 块——该块**没有配置 access log**。实测 `/var/log/caddy/kaogong.zalize.com-access.log` 最后一条 ts=1787677523（≈08-25），此后 origin 侧零 UA/IP 证据。R75/R82 slow_load「无 UA 之谜」调查期间恰好没有任何 origin 访问日志可交叉验证。
2. **R82 观察项现状**：近 7 天 48 条 slow_load 仍全为旧格式（最新一条早于 R82 部署），;ua:/;hs: 无新真实样本。
3. **代理层证据链断点**：CF Pages functions `[[path]].js` 用 `new Request(ORIGIN+..., request)` 回源，原始头理论上被复制，但 Workers 出网时 `CF-Connecting-IP` 会被边缘重写为 Worker 出口、UA 是否保留无一手证据。一旦 UA 在这一跳丢失，origin 与应用层都无法归因。
4. 同轮清理：R83/R84 验证残留测试数据 answer_log 80 行（12 个机器速答 uid，10 题/9–15s，题序与当日每日一练逐一一致，时间窗与验证脚本运行窗吻合）+ growth_events 1 行已删除；保护 uid 零 mutation。

## 方案（小步、零新依赖）

1. **CF 函数显式透传**（deploy/cf-pages/functions/[[path]].js）：回源请求增设
   - `X-Kg-Ip`: 请求头 `CF-Connecting-IP`（真实客户端 IP，Workers 出网不会重写自定义头）；
   - `X-Kg-Ua`: 原始 `User-Agent`（防这一跳丢失）。
2. **入库侧 UA 回退**（backend/app/team.py api_track）：slow_load 的 ;ua: 取值改为 `User-Agent 头 → 空则回退 X-Kg-Ua 头`，回退命中时以 `;uav:f` 标注来源（f=function 透传），可直接分辨「UA 在 CF→origin 一跳丢失」vs「客户端本就无 UA」。
3. **origin 访问日志**（宿主 /etc/caddy/Caddyfile，非仓库文件）：`kaogong-origin.zalize.com` 块补 access log（JSON、50MiB 滚动、保留 14 份/336h，与主站块一致），运维步骤记录于 deploy/README.md。

## 非目标
- 不记录/展示 IP 到任何用户可见面；X-Kg-Ip 仅落 Caddy 访问日志用于故障归因。
- 不动边缘缓存逻辑、不加新表、不加前端改动。

## 验收
- 生产 curl 无 UA 探针 → slow_load ref 含 `;ua:-`（客户端无 UA，X-Kg-Ua 也为空）；
- 生产 Chrome 真实 fetch 探针 → ;ua: 有值；若命中回退则带 ;uav:f；
- kaogong-origin access log 落盘且含 X-Kg-Ip/X-Kg-Ua 头；
- 其他事件 ref 零变化；测试事件清理；保护 uid 零 mutation。
