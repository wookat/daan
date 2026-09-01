# R186：高成本 AI 接口限速身份修复（X-Kg-Ip + IP 桶恒生效）

## 取证（一手证据）

1. R185 周报剔除探针后，非探针窗口出现 502×70，其中 ~110 条 curl UA 请求（AWS 54.69.238.189/54.201.200.193、Hetzner 65.21.113.243）打 `/api/questions`、`/api/explain`、`/api/shenlun/grade`、`/api/coach`、`/api/followup` 等端点——外部脚本已在扫描 LLM 端点。
2. 生产实测（2026-09-01）：匿名 `POST /api/explain -F text=测试` 返回 200（10.8s，真实走 LLM），`POST /api/coach` 返回 200（21.4s）。生产 ACCESS_CODE 为空（产品免费开放，`check_access` 直通），即 LLM 端点对全网匿名开放，每次调用消耗真实 LLM token。
3. 源码复核 `deps.rl()`：身份取 `uid or request.client.host`。生产架构为 CF Pages functions → Caddy → 容器，uvicorn 看到的 `client.host` 是固定的代理对端 IP，真实客户端 IP 自 R85 起在 `X-Kg-Ip` 头（origin 域拒绝直连，该头可信），`rl` 从未读取。

## 缺陷（verified）

- 匿名端点（explain/similar 等）：全网所有匿名用户共享同一个限速桶（如 ai_explain 20 次/300s 全站总额）——一个扫描器即可把额度打光，令真实用户全体 429；
- 带 uid 端点（coach/followup 等）：uid 为客户端自报，轮换 uid 可无限绕过限速，无限消耗 LLM token。

## 方案

`deps.py`：
- 新增 `client_ip(request)`：`X-Kg-Ip` 优先，回退 `request.client.host`；
- `rl()` 改为 IP 桶恒生效（匿名时 limit，带 uid 时 3×limit 容忍 NAT 共享出口），uid 桶在提供 uid 时叠加（原口径不变）。

不改各端点的 limit/window 数值；不引入 ACCESS_CODE 强制（免费开放是产品决策）；11 处 `rl(request,...)` 调用点零改动。

## 验证

- 本地：pytest 新增 `test_rate_limit.py` 4 例（X-Kg-Ip 识别、匿名按 IP 隔离、uid 轮换被 IP 桶封顶、uid 桶保持）+ 全量回归 + ruff；
- 生产：不同 X-Kg-Ip 归属独立桶（经边缘真实请求验证限速触发 429 且不影响他人）；用缺参 400 请求探测限速计数，不烧 LLM token。

## 局限

- 内存限速单进程有效，重启清零（与现状一致）；
- 攻击者分布式多 IP 仍可消耗 token，彻底防御需边缘 WAF/挑战（CF 免费版 1 条规则且 token 无 ruleset 权限，已在资源申报中）。
