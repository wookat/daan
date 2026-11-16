# R187：限速身份修复推广——面试 LLM 端点 IP 桶 + 注册/登录/埋点真实 IP

## 背景与取证（一手）

R186 修复了 `deps.rl()` 的限速身份（X-Kg-Ip 优先 + IP 桶恒生效），但只覆盖 11 个 `rl()` 调用点。
全库 grep `rate_limit(` 复核发现三类同源缺陷仍在：

1. **面试 LLM 端点绕过 rl()**（`interview.py`）：`/api/interview/answer`、`/answer/stream`、
   `/sessions/{sid}/review/stream` 直接 `rate_limit(f"itv_answer:{uid[:64]}", ...)` —— uid 为
   客户端自报，轮换 uid 无限绕过；且无 IP 桶。每次作答消耗 2 次 LLM 调用（打分 chat_json +
   点评 chat/chat_stream），是全站单请求 token 成本最高的端点之一。
   生产实测（2026-09-01）：匿名 `POST /api/interview/answer` 带任意 uid 通过限速与 uid 校验
   （404「题目不存在」，已到达题目查找），确认对扫描器开放。
2. **注册/登录/微信登录共享固定代理 IP 桶**（`auth.py`）：`request.client.host` 在生产是
   容器代理对端固定 IP（R186 已实证，真实 IP 在 X-Kg-Ip 头）——
   - `reg:{ip}` 10 次/小时 = **全站所有用户共享每小时 10 个注册名额**（增长硬伤 + 单扫描器可打光）；
   - `wxlogin:{ip}` 20/300s 同理全站共享；
   - `login:{ip}:{phone}` 因 ip 恒定退化为纯 per-phone 桶（攻击者与真实用户混桶）。
3. **匿名埋点全站共享桶**（`team.py /track`）：`track:{uid or 'anon'}` —— 所有无 uid 客户端
   共享 60 次/300s，普通流量高峰即丢真实遥测（boot/slow_load 幸存者偏差回归）。

## 方案

- `client_ip()` 从 deps 移至 `auth.py`（deps 已 import auth，反向 import 会成环），deps 保留
  同名转发保持既有 import 面不变。
- interview 三端点改走 `deps.rl(request, ...)`（bucket/limit/window 不变：itv_answer 20/600、
  itv_regen 10/600），uid 桶语义保持 + IP 桶恒生效（带 uid 放宽 3 倍容忍 NAT）。
- auth 三处 `request.client.host` → `client_ip(request)`：桶结构与阈值不变，只是身份从固定
  代理 IP 换成真实客户端 IP。
- `/track` 匿名分支 → `track:{client_ip}`：带 uid 客户端桶不变。

不改动：team/pk/share 等 uid 桶（纯 DB 写、无 LLM 成本，uid 轮换只造垃圾行，另行观察）；
各端点阈值；ACCESS_CODE 策略。

## 验证

- 本地：pytest 新增 interview 限速身份用例 + 既有 67 例全绿；ruff 全绿。
- 生产：匿名 interview 缺答案 400 探测（不烧 token）超阈值转 429；/api/register 缺验证码
  400 探测确认按真实 IP 计数；正常浏览回归。

## 限制

同 R186：内存限速重启清零；分布式多 IP 仍可消耗；边缘 WAF 需权限（已申报）。
