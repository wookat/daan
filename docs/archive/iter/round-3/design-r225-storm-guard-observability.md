# R225 设计：storm guard 可观测性——错误窗口计数外显到 origin 日志

## 取证（生产，2026-09-01）

verified（origin Caddy 日志 + 生产实测）：

- 09-01 08:11–10:00 UTC，kaogong-origin 日志记录 ~20.3k 条 /api/exam/* 404
  （POST /api/exam/submit ~10.1k + GET /api/exam/report/72|73|75 ~10.1k，
  uid=umtidsrzdehya011a，X-Kg-Ip=140.232.64.5（Devin 共享 NAT），headless
  Chrome/137 UA，经 kaogong.zalize.com 边缘正常透传，Server: uvicorn 证实由
  kaogong 后端真实响应）。整个窗口 **零 429**——ErrorStormGuard（threshold=30/60s）
  按代码语义应在第 31 个错误起持续 429，实际完全未触发。
- 同日 10:23 起日志出现零星 429；当晚在生产容器（host 127.0.0.1:8300）用与
  风暴完全相同的三种请求形态（GET report/不存在 id、GET report/72?uid=…、
  POST submit）逐一实测：**均第 31 个起 429**，守卫现行行为正常。
- 风暴窗口与当前之间 storm_guard.py 与 main.py 守卫中间件零代码差异
  （git diff 5f45dc9..HEAD 为空）。
- 排查中还纠正一个观测陷阱：宿主 127.0.0.1:8000 是另一产品 k12team 的
  uvicorn，kaogong 容器映射在 127.0.0.1:8300；对 8000 的任何探测结果与本
  产品无关。
- SPA 现行代码不会产生该风暴：exam.vue 交卷失败走 submitFailPlan，404 属
  确定性错误直接 terminal（R181），report 页无轮询。风暴客户端为自动化
  浏览器（inference，共享 NAT 无法归因到具体会话）。

unknown（如实标记，不做猜测性修复）：

- 守卫在风暴窗口内为何未触发。候选（均无证据）：进程重启丢内存态（但重启
  间隔 ~10–25 分钟，远大于 9 秒触发时间）、应用实际看到的 ip 为空、窗口未
  累计。容器日志随 autoheal 重建即销毁，风暴期进程内部状态零留存，无法定案。

## 差距

守卫是纯内存状态，决策过程零外显：下一次风暴发生时依然只能看到「有/没有
429」，无法回答「应用看到的 ip 是什么、窗口计数到了多少、blocked 是否被
询问」。容器 stdout 随重建销毁，唯一跨重建持久的观测面是 Caddy origin
访问日志（roll_keep 14 天），而它**完整记录响应头**。

## 方案（最小收口）

把守卫对每个 /api 错误响应的内部视角写进响应头 `X-Kg-Guard`，由 Caddy
日志自然持久化：

- `ErrorStormGuard.record()` 返回记录后该 ip 的窗口计数（未记录返回 0）；
- 中间件对 status≥400 的 /api 响应设置 `X-Kg-Guard: <窗口计数>`；
  被守卫拦截的 429 设置 `X-Kg-Guard: blocked`；2xx/3xx 不加头（避免日志噪声）；
- 客户端可见该头无安全影响（不含内部结构，仅一个计数）。

下一次风暴时，origin 日志将逐请求给出守卫计数轨迹，可直接区分
「ip 为空 / 计数不涨 / 计数到阈值但未拦截」三类根因。

## 明确不做

- 不改 threshold/window/封禁语义（无证据支持调整）；
- 不做猜测性「修复」（根因未知）；
- 不持久化守卫状态跨重启（重启间隔远大于触发时间，非本次未触发的可证成因）；
- 不动 /api 契约与前端。

## 验收

- pytest：record 返回值语义 + 中间件三分支（错误带计数头、429 带 blocked、
  2xx 无头）；
- 本地门禁全绿（ruff/pytest/pyright/lint/vitest/build）；
- 部署后生产实测：错误响应带 X-Kg-Guard 且 Caddy 日志可见该头，第 31 个
  错误起 429 + X-Kg-Guard: blocked；正常 200 无该头。
