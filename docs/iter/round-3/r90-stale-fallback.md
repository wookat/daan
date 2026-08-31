# R90：读接口最后一跳兜底——GET 双超时后回退本机最近成功快照

## 取证（2026-08-31，生产 growth_events 实测）

- 近 3 天 slow_load 49 条，其中带请求级归因的真实用户样本（R61 阶段化字段）：
  `daily_plan:45484`、`mistakes:33321`、`mistakes:24488`、`categories:21017`、
  `events:14818`、`questions:13564`、`questions:9475`、`questions:9016`、`history:8732`。
- 这些均为 uid 专属或随机端点，无法进 R56 边缘缓存（带 uid/响应不确定），每次都穿透 2GB 共享宿主。
- R63 已有 GET 12s 超时 + 重试一次（12s+20s），但两跳全超时后调用方拿到的是 reject：
  页面呈现错误态/空态，用户在慢窗口期内**完全无数据可看**。
- 宿主级资源竞争（recruit-* 挤占）为根因，迁独立主机待老板决策；应用侧只能继续收窄受害面。

## 方案：api.js request() GET 路径加「最近成功快照」兜底

竞品（粉笔/夸克 App）离线/弱网时展示最近一次数据而非报错。本轮在 `request()` 的
GET 默认路径上补最后一跳：

```
GET 成功 → 快照写 uni storage（apiSnap:<path>，含 query/uid，天然按 uid 隔离）
GET 12s 超时 → 重试(20s) → 仍失败（超时/网络错误）→ 若有 <24h 快照 → resolve 快照 + 上报 stale_fallback
HTTP 4xx/5xx（业务错误/登录过期）→ 照旧 reject，不回退（语义必须透出）
```

边界与守卫：

- 仅默认 GET 路径（`method==='GET' && opts.timeout==null`），POST/显式 timeout 不参与。
- 单快照 JSON 长度 >64KB 不缓存（防 storage 膨胀）；快照索引 LRU 上限 40 条，超限淘汰最旧。
- 快照 24h 过期：过期即视为无快照，照旧 reject。
- `/api/auth/`、`/api/admin` 前缀不缓存不回退（登录/管理语义不允许陈旧）。
- 回退命中时上报 `stale_fallback` 埋点（ref=path 截断），后端 track 白名单同步补充——
  生产可直接度量「兜底救了多少次」。

## 验收标准

- 本地/生产拦截双超时 → 页面渲染出快照数据而非错误态，console 无 error；
- 埋点 stale_fallback 落库 ref 正确；
- HTTP 错误（401/422）不回退、登录过期流程不变；
- 无快照时行为与现状完全一致（reject）；
- lint/build 全绿，1440/375 生产走查。
