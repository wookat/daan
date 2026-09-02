# R265 设计论证：uvicorn keep-alive 竞态即时 502 收口

## 取证（生产一手证据）

- origin 日志近 8h 共 8 条 5xx，其中 7 条为**即时 502**（duration 0.006–0.08s），
  全部发生在容器 healthy、非部署窗口时段（容器 78d37bf 03:21:43 起稳定运行，
  502 出现在 03:28/03:29/03:43/05:04）。
- Caddy error 日志逐条对照：全部为
  `read tcp 127.0.0.1:*->127.0.0.1:8300: read: connection reset by peer` 或 `EOF`，
  `err_trace=reverseproxy.statusError`——**不是 dial 失败**（R235 lb_try 与 R257
  health check 只覆盖 dial/上游不健康路径，对已建立连接上的 reset 均不生效）。
- 命中方包含真实爬虫（ClaudeBot：/tiku/yanyu/?page=190、?page=193、/robots.txt）；
  边缘 retry（X-Kg-Fetch: retry）复用另一条陈旧池化连接后仍 502。

## 根因（本地复现 verified）

- 生产 CMD `uvicorn app.main:app`，未带 `--timeout-keep-alive`，默认 **5s**：
  空闲 keep-alive 连接 5s 后被 uvicorn 关闭。
- Caddy reverse_proxy 连接池默认 idle 保持 **2 分钟**，两个 kaogong 站点块均未配
  transport keepalive——Caddy 在 5s–2min 窗口内复用已被 uvicorn 关闭/正在关闭的
  连接，请求发出即遇 reset/EOF，Caddy 视为不可重试错误直接回 502。
- 本地复现：原生 socket 复用连接，默认参数空闲 2s 二次请求 OK、空闲 6s EOF；
  `--timeout-keep-alive 130` 后空闲 6s/20s 均 OK。

## 方案

Dockerfile.runtime CMD 追加 `--timeout-keep-alive 130`：uvicorn 空闲关闭时限
(130s) > Caddy 连接池 idle 上限（默认 120s），陈旧连接恒由 Caddy 先弃、
uvicorn 不再先关，竞态窗口消除。不改 Caddy（避免再动 VPS 配置面）、不改应用代码。

## 明确不做

- 不加 Caddy transport keepalive 覆盖（单点收口在镜像内，随 compose 部署可审计）。
- 不把本次 /api/track 13.2s 后 EOF 的 1 条样本归入本根因（时长特征不符，
  更符合共享宿主争用窗口，挂观察项如实上报）。

## 验证清单

- 本地 socket 复现对照（默认 vs 130s）——已完成。
- 部署后生产容器内确认 CMD 参数生效；对 origin 8300 端口做空闲 6s/20s 二次请求探测全 OK。
- 部署脚本全量门禁（rev 校验/接口回归/性能预算）。
- 观察后续 origin 日志该形态 502 是否归零（数据窗口项）。
