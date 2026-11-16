# R475 取证：AI 同 uid 飞行中重复——客户端根因（源码 + 时序）→ 服务端 `/api/mistakes/analysis` single-flight（不加成功缓存）+ 141.11.46.193 归因

日期 2026-09-07（UTC）。生产 `6e82179` → **`2bad8bc`**（本轮唯一产品代码改动：`backend/app/ai_api.py` +1 函数 / 1 处调用；单测 +1 文件 3 例）。数据源：生产 SQLite 宿主直读 `mode=ro`、Caddy origin JSON 日志、`git show` 小程序历史版本、生产探针（`X-Kg-Probe: 1`，写库 0）。

## 0. 结论（事实 / 推断 / 未验证分开）

| 问题 | 结论 | 性质 |
|---|---|---|
| `mistakes/analysis` ×4 为何并发 | **同页面实例重入，不是页面栈 / 超时 / 网络重发**：设备跑的是原生小程序（`miniapp-native`）开发版，当时源码 `pages/book/book.ts onAiAnalysis()` 守卫只有 `if (this.data.aiHtml) return`，`aiHtml` 要等回包才有值，加载中（弹层显示「约需 30-60 秒…」骨架屏）关掉弹层再点入口 = 再发一次 POST；4 次起点 0 / +12 / +23 / +24 s 与「等不及反复点」一致 | 源码 = 事实；「用户关弹层再点」= 推断（无端侧日志） |
| 客户端是否已修 | 兄弟会话 W8 分支 `8db03a2`（09-06 22:53Z，事发后 71 min）已加 `\|\| this.data.aiLoading` 守卫，提交说明写「生产实测 4 次并发」；**该分支未合 main、未发正式版**，且守卫只管同一页面实例 | 事实 |
| 服务端是否要合并 | **立项并已上线**：同 uid 飞行中共用一次 `llm.chat`（`asyncio.Future` + `shield`），结束即移除；覆盖任何客户端版本 / 多页面实例 / H5 多 tab | 事实（生产一手 §3） |
| 成功结果短 TTL | **不立项**：观测到的重复 100% 在飞行中（4 次跨 24 s、全部重叠），single-flight 已覆盖；分析依赖当下错题统计，TTL 会让「刚加错题 → 重新分析」拿到旧文；无一手需求 | 决策 |
| R398 失败不缓存 | 保持：失败也不缓存、所有等待者同拿 502、下一次请求重新打 LLM（单测锁） | 事实 |
| `explain/stream` ×2 | **本轮不改、登记**：全文件只此 1 对；2 次起点隔 6 s、出口 IP 切换（223.83.2.220 → 39.158.40.85），更像网络切换后端侧流中断 → 用户重点「开始讲解」；流式合并需缓冲回放（复杂度高于 analysis）；已有落库 `explain_cache` 让第 3 次起命中 | 推断（无端侧日志） |
| `141.11.46.193` | 09-06 08:55–10:43Z 94 请求、Android 16 vivo V2405A **VivoBrowser**（91）/ Chrome（3）UA（不是微信）、入口 `/s/fqpexz7g` 分享页 ×2 → 首页 → 面试页 `interview/categories` ×1 + `interview/question` ×1，uid `umsagboriz4qyurnd`，无 `X-Kg-Probe`、非探针网段、非自动化 UA → **候选真人（分享链路带来）**；R474 写的「面试页 API 14 次」本轮按 `uri` 前缀 `/api/interview` 复数只有 2 条，差额是 R474 计数口径（大概率把面试页壳 / 分包 / 其它 API 一并算入）——以本轮 2 条为准 | 事实 + 「真人」为口径推断 |
| `error_reason` ≥09-11 | 7 / **0**，无增量 | 事实 |

## 1. 客户端根因（源码 + 时序）

### 1.1 事发设备与版本
R474 已核：4 次请求 UA 全 `MicroMessenger … MiniProgramEnv/android`、Referer `servicewechat.com/wx01f2…/0/`（版本号 `0` = 开发/体验版，微信 Referer 约定，推断）。**H5 `frontend-uni/src/pages/book/book.vue` 不是调用方**（R474 §4 按 H5 源码核 `aiLoading` 守卫是核错了对象，勘误）。

### 1.2 事发时源码（`8db03a2~1`，W8 分支 `26a3c6b` 09-06 22:52Z 及之前）
```ts
async onAiAnalysis() {
  this.setData({ aiOpen: true });
  if (this.data.aiHtml) return;          // 只看结果，不看 aiLoading
  this.setData({ aiLoading: true });
  const d = await mistakeAnalysis();     // POST /api/mistakes/analysis {uid}, timeout 420 s
  ...
}
```
- 入口：错题本工具格 `onTool(k==='ai')` → `onAiAnalysis()`；弹层 `<kg-sheet visible="{{aiOpen}}" bind:close="onAiClose">`，加载中显示骨架屏 +「正在分析…约需 30-60 秒」，「重新分析」按钮 `wx:if="{{!aiLoading}}"` 加载中隐藏。
- 复现路径（同一页面实例）：点入口 → 弹层打开、请求 1 飞行 → 点遮罩/✕ 关弹层（`aiOpen=false`，请求继续）→ 再点入口 → `aiHtml` 仍空 → **请求 2**。每关一次再点一次 = 多一次 LLM。
- `utils/request.ts`：`wx.request` 单次、无重试、无去重注册表；`mistakeAnalysis()` timeout 420 s，4 次 19.7–39.8 s 全 200，**无超时重发**。页面栈：错题本是 TabBar 页（单实例），`onShow` 不触发分析。→ 页面栈 / 超时两条候选按源码排除。

### 1.3 时序对照（Caddy，起点 = ts − duration）
| 起点 | 时长 | 状态 | gzip size | 相对首发 |
|---|---|---|---|---|
| 21:41:25.0 | 39.79 s | 200 | 879 | 0 |
| 21:41:36.3 | 22.93 s | 200 | 851 | +11 s |
| 21:41:47.9 | 19.69 s | 200 | 845 | +23 s |
| 21:41:48.6 | 31.27 s | 200 | 874 | +24 s |

四条 size 各异 = 四篇不同分析文（改前每条独立打满 LLM），最后落到用户屏上的只有最后一次回包（`setData aiHtml` 覆盖）。

### 1.4 客户端修复状态
`8db03a2`（W8 分支）：`if (this.data.aiHtml || this.data.aiLoading) return;`。origin/main 的 `miniapp-native` 还没有 `mistakeAnalysis` 调用点（更早版本）。该守卫只保护同一页面实例，服务端仍需兜底。

## 2. 设计论证（先答再动手）

1. **合并键**：任务写「per-(uid, 请求体)」。当前请求体只有 `{uid}`（后端 `body: dict` 只读 `uid`，其余字段被忽略），prompt 由服务端按 uid 当下错题统计生成 → 键 = `uid[:64]` 即等价于 (uid, body)。**若日后请求体加字段（如 module / 时间窗），键必须并入这些字段**（写入 handoff 待办）。
2. **只合并飞行中，不缓存成功**：理由见 §0；且与 R398「失败不缓存」同构——两边都不留结果，语义最简单。
3. **取消隔离**：`asyncio.shield` 让某个等待者断线（uvicorn 取消 handler）不会取消共享的 LLM 协程，其余等待者照常拿结果；shield 后的 Future 完成回调 `pop(uid)` 保证成功/失败都清位。
4. **进程范围**：生产 `Dockerfile.runtime` `uvicorn app.main:app` 单进程无 `--workers` → 进程内字典 = 全局；若改多 worker，需换共享介质（登记，不预做）。
5. **`explain/stream` 不同构**：SSE 需要把首个请求的增量缓冲后向后来者回放（含 meta 事件顺序），且第 2 次通常发生在第 1 次流被客户端放弃之后（非并行消费）；全文件只 1 对，等复现再定。

## 3. 生产一手（`2bad8bc` 上线后，探针 uid `umsacie728f4ghcv8`，`X-Kg-Probe: 1`）

A 段：4 个 `curl` 并发（起点 05:36:08.5 / 08.7 / 09.1 / 09.3）：
```
req1 dur=17.25 http=200 sha=5515b9b39352 len=359
req2 dur=16.96 http=200 sha=5515b9b39352 len=359
req3 dur=16.69 http=200 sha=5515b9b39352 len=359
req4 dur=16.35 http=200 sha=5515b9b39352 len=359
```
Caddy 侧 4 条结束时刻 05:36:25.460/.460/.460/.474、gzip size 全 913；容器日志 4 条 200、0 Traceback。→ **一次 LLM、四份同文**（改前 §1.3 四篇各异对照）。

B 段：A 结束后 0.4 s 再发 1 次：`req5 dur=42.03 http=200 sha=293513dddcf0 len=338`（容器 `[slow-req] 41.8s`）→ 结果不同、耗时完整 = **成功不缓存、飞行槽已清**。

单测 `backend/tests/test_mistake_analysis_singleflight.py`（3 例）：4 并发 → `llm.chat` 1 次且全同文、结束后再调重新打 LLM；失败 → 全体 502 且下一次重试；不同 uid 不合并。门：pytest 504 passed / ruff / pyright `npx pyright app` 0。

## 4. 141.11.46.193 归因（Caddy 全文件）
- 94 请求，UA `Android 16; V2405A … VivoBrowser/30.2.25.1`（91）+ 同机 Chrome/131（3），系统浏览器打开 H5（非微信、非小程序）；时段 09-06 08:55–10:43Z（分享页→面试页为其中一段）。同型号 V2405A 与 21:41Z 小程序设备一致，是否同一台本轮未核（IP 不同）。
- 序列：`/s/fqpexz7g` ×2（分享页）→ `/api/share/fqpexz7g?uid=umsagboriz4qyurnd` ×2 → 首页壳 / `home_bundle` → **`/api/interview/categories` → `/api/interview/question`**（面试页只到出题、无点评 POST）→ 结束。Referer 链 分享页 → 首页。
- 判定：无探针头、非 `KG_PROBE_CIDRS`、非自动化 UA → 按 R386/R393 口径为「候选真人」，且是**分享链路带来的**（分享码 fqpexz7g 的创建者是否为同一人本轮未核）。只到面试出题未点评：不改功能、不造假。

## 5. 到期项（05:20–05:40Z）
probe=0 `answer_log` 33 / uid 1；growth 20 / 4；`error_reason` 7 / ≥09-11 **0**；`push_subs` 0；`weekly_reports` 2；`exam_attempts` probe=0 1 / 64；`explain_cache` 82；WAL 4,124,152 B 同字节；容器 healthy、RestartCount 0；宿主 `/dev/vda2` 89%→88%（5.4→6.1 G 可用）、mem_avail 285 MB、**load 0.82**（历轮最低）。
(c) 新容器 05:32:03Z 起 35 请求全本机出口（部署回归 / Lighthouse / 探针），`/assets/*` 404 0、5xx 0、monitor 0、小程序 UA 0。

## 6. 部署
`deploy_h5.sh` 一次走完：4-pre `other_builds=0 prunes=0` 不让行；compose build 05:30:45→05:32:03Z = **78 s**（R468 分布 p50 82 s 内；同机 load 0.8 无别家构建 → 再次印证离群 = 宿主负载相关）；rev 一致 `2bad8bc`；bundle `index-ln5farCT.js` 未变（后端-only）；7/7 回归 200；perf `/` 0.93 / LCP 2757 / `/tiku/` 1.00。`deploy-history.log` 已记。

## 7. 如实说明
- 「关弹层再点入口」是源码 + 时序推断，无端侧日志 / 真机复现（本机无微信开发者工具）；H5 侧无法复现该形态（H5 `book.vue` 一直有 `aiLoading` 守卫）。
- `explain/stream` 那对重复的「网络切换致流中断」是 IP 切换 + 6 s 间隔的推断；Caddy 对客户端中途断开仍记 200 + 完整时长，无法从日志区分。
- single-flight 为进程内；跨 worker / 跨主机未验证（当前单进程无需）。
- 141.11.46.193「真人」为口径判定，不等于确认外部真人作答者（该 IP 无作答）。
- R474 勘误：§4「前端唯一调用点 `book.vue aiAnalysis()` 有 `aiLoading` 守卫」核的是 H5，事发客户端是原生小程序开发版，本文 §1 更正。

## 8. 改动
- `backend/app/ai_api.py`：`_ANALYSIS_INFLIGHT` + `_shared_mistake_analysis(uid, prompt)`；`api_mistake_analysis` 改调它，其余不动。
- `backend/tests/test_mistake_analysis_singleflight.py`：新增 3 例。

> R476 勘误：本文与 R474 所称「开发版」按微信官方文档（网络 › 使用限制）Referer 版本号 `0` = 开发版、体验版、审核版三者，应读作「非正式版」；结论不变。详见 `r476-postdeploy-natural-singleflight-interview-funnel-stats-fanout.md` §5。

> R477 坐实：§1 表「`explain/stream` ×2 更像网络切换后用户重点」由推断升为判定——第 2 条流前 1.4 s 有新出口 IP 的 `GET /api/access_info`（= `submitText → ensureAccess()` 的手动提交前置，代码无自动重试），`ask_cur` 里只留第 2 次的 rec（第 1 次走 `catch` 未入 `results`），旧 IP 此后 0 新请求。服务端两条都跑满 41.5 s 的机制（边缘未收到断开）仍为推断。详见 `r477-explain-stream-pair-network-switch-manual-retry-ask-retention.md` §3。
