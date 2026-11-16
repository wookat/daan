# R139（2026-09-01）：api.js 网络层决策纯函数化 + vitest 回归覆盖

## 取证

- `frontend-uni/src/api.js`（950 行）是全站唯一网络入口，承载六类关键决策却零单测（对称 R118 edge-policy / R133 modal-policy 收口前的状态）：
  1. 错误分类 `isTimeoutErr/isNetErr`——R134–R137 全站失败态收口的分流依据，正则一旦改坏，13+ 页错误态语义整体回退；
  2. 401/403 登录态失效判定（rawRequest 内联）——R39 全站 403 卡死修复的核心，误判会把访问码/管理令牌 401 踢成登出；
  3. 非 2xx detail 提取——422 detail 为对象数组时须回落 `HTTP <status>`，防 `[object Object]`（R66）；
  4. GET 快照兜底（R90）：`snapCacheable` 排除 auth/admin、索引 LRU 上限 40、TTL 24h、64KB 上限——决策全部内联在存取函数里；
  5. SSE 解析：`feedSse` + streamInterview/streamInterviewRegen 各自内联一份 `feed`，同一 split/match 逻辑三处复制，事件跨 chunk 截断处理是流式讲解/面试点评的正确性根基；
  6. 历轮回归全靠生产实测（abort 探针/双视口走查），无自动化防线。

## 方案（行为等价重构，零生产行为变化）

新增 `src/api-policy.js` 纯函数模块（无 uni/window 依赖，可直接 vitest）：

- `isTimeoutMsg(msg)` / `isNetMsg(msg)`：错误消息分类（api.js 的 isTimeoutErr/isNetErr 改为委托）。
- `classifyHttpError({ status, detail, path })` → `{ detail, authExpired, message }`：detail 非 string 归空、401（非 /api/auth/ 且文案含未登录/登录已过期）与 403（无权访问该账号数据）判失效、message 统一。
- `snapCacheable(path)`、`snapFresh(snap, now, ttl)`、`snapPushIndex(idx, path, max)` → `{ idx, evict }`：快照准入/新鲜度/LRU 索引淘汰。
- `parseSseEvents(buf)` → `{ rest, events: [{type, data}] }`：SSE 按 `\n\n` 切分+event/data 提取+尾部截断缓冲；feedSse 与两处 interview feed 全部改为消费该函数（消除三份复制）。

api.js 改动仅为委托调用与消除复制；`#ifndef H5` 的 makeUtf8Decoder 因条件编译留在 api.js。

## 验证

- 新增 `tests/api-policy.test.js` ≥16 例：超时/网络错误/request:fail/业务 404 分类、401 auth 路径豁免、403 判失效、detail 对象数组回落 HTTP 状态码、snap 准入与 TTL、LRU 淘汰顺序、SSE 跨 chunk 截断/多事件/无 data 行忽略/error 事件。
- 本地 eslint / vitest（38→50+）/ build:h5 全绿。
- 生产 1440/375：首页/刷题页/面试页正常加载与流式点评回归、console 0 error、溢出 0。
