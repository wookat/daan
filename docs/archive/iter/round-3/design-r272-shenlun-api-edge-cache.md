# R272 设计：申论公开 API 页族纳入边缘缓存（60s TTL + SWR + stale-if-error）

## 取证（生产一手证据 + 源码）

- origin 10h 访问日志（09-01 18:50 → 09-02 04:53）路径频次实测：/api/shenlun/questions 99、
  /api/shenlun/filters 73、/api/shenlun/materials 62 次，全部同步穿透 origin；同窗口
  09-02 04:35–04:37 共享宿主争用（load 5+、swap 2.5G、health 503 25s）内这些端点
  与 /api/search 同样无副本可退。
- 源码实查 shenlun_api.py：三端点均为 uid 无关公开 GET——questions 输出仅由
  qtype/year/region/limit/offset/paper 决定、filters 无参数、materials 仅由
  topic/type/limit/offset/id 决定；/api/shenlun/questions/{qid} 为路径参数详情端点
  （404 语义与 /api/search/question 同构）。
- R250–R264 上线的申论 SSR 页族（hub/年份/题型/套卷/素材）全部深链到 App 申论专区，
  落地即打这组 API——公开页族边缘有副本而 App 数据层没有，争用窗口内入向流量落地即失败。

## 方案

- edge-policy.js：API_CACHE_ALLOWLIST 加 /api/shenlun/questions、/api/shenlun/filters、
  /api/shenlun/materials（精确）；API_CACHE_PREFIXES 加 /api/shenlun/questions/（qid 详情）。
  全部复用既有 60s TTL + SWR + stale-if-error + 404/410 副本清除链路，零新逻辑；
  带 Authorization/uid 仍绕过（fav 等个性化路径天然带 uid）。
- 缓存 key 为完整 request.url（含 query）：R271 曾以「key 空间大」缓评 questions，
  本轮评估结论是低命中变体的 MISS 行为与现状逐字节一致（仅 200 才建副本，无负缓存），
  而真实流量集中在 SSR CTA 深链的少数变体（默认首页/单维筛选），SWR 对这些变体有效。
- vitest 补边缘决策用例。

## 不做

- 不缓存 /api/exam/papers（uid 变体混流，命中率与语义另轮评估）。
- 不改后端契约/TTL 常数/SSR/SEO。
- 语义：申论题库导入为天级频率，60s 滞后无用户可感差异。
