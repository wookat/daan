# R422 取证与决策：无 qid 识题 8–15 s / practice vibrateShort rejection / 视觉通道配置 / SSE 被 Caddy gzip 整条缓冲

日期：2026-09-06　rev：`9e657da`（PR #619 同分支）　生产：kaogong.zalize.com

本轮四件事，前两件是代码（已入库），后两件是**生产配置**（不入库，只留备份与文档）。每一节都区分「实测」「推断」「未验证」。

---

## 1. 无 qid 识题 8–15 s 的构成（实测）

### 1.1 现状路径
`engine.extract_question(image_b64=None, text)` → `llm.chat_json(..., fast=True)` → `chat_fast` **rescue 优先**（`LLM_RESCUE_*`＝`kimi-k3`，推理模型），主文本通道只在 rescue 失败时才用。

### 1.2 容器内直连上游对照（4 道生产真题，模型名可打印、密钥不打印）

| qid / 真值模块 | 现状 rescue kimi-k3 | text pro nothink | text flash nothink |
|---|---|---|---|
| 235804 yanyu | 17.75 s | 3.29 s | 2.27 s |
| 238990 panduan | 8.59 s | 2.92 s | 2.27 s |
| 261994 changshi | 18.37 s（reasoning_tokens 513） | 3.00 s | 2.50 s |
| 297481 shuliang | 9.57 s（reasoning_tokens 171） | 2.42 s | 1.85 s |

- 模块识别：三列 4/4 与题库一致。
- rescue 对「关闭 thinking」参数响应不稳定；`deepseek-v4-pro-0817` 显式 `{"thinking":{"type":"disabled"}}` 后 2.4–3.3 s。
- 结论：**耗时主体是 rescue 推理模型的 reasoning**，不是提示长度或输出量（输出 JSON 都 <300 字）。

### 1.3 决策
- 无图识题改走**主文本通道 + 关闭 thinking**；主通道 5xx/配额仍回落 rescue（同带关闭参数）。
- 选 pro 而不是 flash：pro 已够快（3 s 级）、与解释模型同一模型族更保守；flash 留作后续可选。
- **含图路径不变**（`fast=False, think=True`），单测锁住。
- 不做题干指纹缓存：原文缓存 `cache_key(text, ua)` 已覆盖同题重讲；识题结果缓存收益仅剩首问 3 s，不值得新表。

### 1.4 生产探针（X-Kg-Probe，无 qid 五模块）
meta 3.0–4.5 s（原 8–15 s）；首正文 20–92 s、done 28–101 s（解释模型 reasoning，本轮不改、不掩盖）。

---

## 2. practice 页 `uni.vibrateShort` rejection（实测）
桌面 Chrome 不支持震动，uni H5 `vibrateShort` 无 `fail` 回调时以 Promise reject 抛 `vibrateShort:fail` → 每次判题 +1 条 `unhandledrejection`（R421 复验记录）。两处调用补 `fail: () => {}`；源锁测试保证 practice 页每个 `uni.vibrateShort(` 调用都带 `fail`。复验：每次判题后 `__pexc` 恒为 `[]`。

---

## 3. 视觉通道生产配置缺失（实测，运维项）

### 3.1 现象
testing agent 含图路径：HTTP 200 但 ~180 ms 即 `event: error {"message":"AI 服务未配置"}`。容器 env `LLM_BASE_URL=` / `LLM_API_KEY=` 为空（R17 起只配 `LLM_TEXT_*`/`LLM_RESCUE_*`），`_endpoint()` 对含图消息走视觉主通道 → `_require_configured` 抛错。

### 3.2 取证：现有文本网关是否带视觉模型
- `GET /v1/models`：200，82 个模型，含 `qwen3-vl-plus/flash/235b-a22b-instruct`、`glm-4.6v`、`doubao-seed-2.0-mini/pro`。
- 小 PNG 直调 chat/completions：Qwen3-VL 系 0.63–0.80 s、doubao 1.6–3.2 s 均正确回答；`doubao-seedance-1.0-pro` 等非视觉模型 500（排除）。
- 两张生产题截图（235804 言语 / 297481 数量，Playwright 经现有 Chrome CDP 截取）在容器内跑 `engine.extract_question`：

| 模型 | 235804 | 297481 |
|---|---|---|
| qwen3-vl-plus | 5.43 s ✓ | 2.91 s ✓ |
| qwen3-vl-flash | 3.32 s ✓ | 2.55 s ✓ |
| qwen3-vl-235b-a22b-instruct | 4.97 s ✓ | 4.29 s ✓ |
| glm-4.6v | 6.99 s ✓ | 5.40 s ✓ |
| doubao-seed-2.0-pro | 9.92 s ✓ | 9.78 s ✓ |

### 3.3 处置
生产 `deploy/.env` 备份 `/home/ubuntu/env.bak.r422` 后追加 `LLM_BASE_URL/LLM_API_KEY`（=文本网关同值）+ `LLM_MODEL=qwen3-vl-plus`；`docker compose up -d --no-build kaogong` → healthy、restarts 0、`/api/health rev 9e657da`。密钥未打印、未入库。

### 3.4 未验证
只验 2 题 2 模块；低清/多图/材料题/手写未验；解释正文仍 50–70 s（reasoning）。

---

## 4. SSE 被 Caddy gzip 整条缓冲（实测，运维项，影响面最大）

### 4.1 现象
含图 235804 经边缘：meta / thinking / 正文 / done **同一时刻**到达（71 s、57 s、55 s 三次复现）；297481 同路径正常逐秒。直连容器 `127.0.0.1:8300` 两题都正常 → 不是后端。

### 4.2 逐层定位
| 层 | 235804（meta 长） | 297481（meta 短） |
|---|---|---|
| 容器直连 | 流式 | 流式 |
| Caddy 直连 `curl -N`（无 Accept-Encoding） | 流式 | 流式 |
| Caddy 直连 `curl -N --compressed` | **整条攒到末尾** | 流式 |
| 经 Cloudflare 边缘 | **整条攒到末尾**（响应头多 `vary: Accept-Encoding`） | 流式 |
| 边缘 + 客户端 `Accept-Encoding: identity` | 仍攒 | — |
| 边缘 + 257 KB 填充图（同 297481 题面） | 流式 | — |

- 图片大小无关；客户端编码头无关（Worker 回源自带 Accept-Encoding）。
- 差异只在**首个 flush 的字节数**：Caddy `encode gzip` 默认 `minimum_length 512`，首个 flush ≥512 B 才决定压缩，一旦压缩就不再逐事件 flush，整条 `text/event-stream` 到结束才落地。meta 事件含 `question_text`，题干 ≥~110 字即超线。

### 4.3 影响面（生产只读扫库，按 meta 实际字段拼装计字节）
| 模块 | 活跃题 | meta ≥512 B | 占比 |
|---|---|---|---|
| shuliang | 32,556 | 1,933 | 5.9% |
| changshi | 30,907 | 984 | 3.2% |
| panduan | 22,916 | 4,370 | 19.1% |
| yanyu | 18,294 | 14,284 | **78.1%** |
| ziliao | 4,698 | 4,497 | **95.7%** |
| 合计 | 109,371 | **26,068** | **23.8%** |

explain_cache 99 条历史讲解中 30 条属此类——即 R421 上线的 thinking 心跳、R422 的 meta 提速，对这些题在真实浏览器里**从未到达用户**（首字前 60–110 s 零信号）。R421/R422 首轮复验全用短题干数量题，所以没暴露；已把长题干样本写进测试 SKILL。

### 4.4 处置
`/etc/caddy/Caddyfile` 备份 `Caddyfile.bak-r422`，`kaogong.zalize.com` 与 `kaogong-origin.zalize.com` 两块 `encode gzip` → 
```
@nosse not path */stream
encode @nosse gzip
```
`caddy validate` → `systemctl reload caddy`；其他项目块未动。复验：Caddy 直连 `--compressed` 与经边缘均恢复逐秒 thinking、响应头无 `vary`/`content-encoding`；浏览器 6 条 stream `encodedBodySize == decodedBodySize`。口径写入 `deploy/README.md`。

### 4.5 为什么不在后端修
- `X-Accel-Buffering: no` 已有，Caddy 不识别；`Cache-Control: no-transform` Caddy encode 也不检查。
- 后端回 `Content-Encoding: identity` 可让 Caddy 跳过，但该值在响应里不规范，Cloudflare 侧行为未知，不冒险。
- 反代层「SSE 不压缩」是通用口径，放 Caddyfile 最直接；仓库内以 README + SKILL 复验口径防回归。

### 4.6 未验证
`/api/interview/answer/stream`、`/api/interview/sessions/{sid}/review/stream` 同受 `*/stream` 规则保护（Caddy `*` 匹配含 `/`，已由 `/api/explain/stream` 命中证明），但未实测。

---

## 5. 复验汇总（testing agent 两轮，`test-r422-ui` / `test-r422b-ui`，375×812 + 1440）
- 无 qid meta 2.5–3.7 s；深链 188–256 ms；缓存 159 ms、0 thinking。
- practice 判题 `__pexc []`；多选 273031 `ACD` 判对。
- 含图 375 拖入：meta 3.18 s、`shuliang/周期与日期`、thinking 44 逐秒、正文 51 s「【答案】A」。
- 长题 235804（180 字）：无 qid 375/1440 thinking 61/47 逐秒（done 前 5 s 0 个）、深链 37/45 逐秒。
- `/api` non-2xx 0；console/pageerror/unhandledrejection 0；容器 healthy 0 重启；日志 5xx/Traceback/locked 0；清理 LEFTOVER 0，explain_cache 回基线 99。
- 本地：pytest 459 / ruff / pyright 0；vitest 599 / eslint / build:h5 绿。

## 6. 遗留
- 解释正文首字 40–70 s 为上游推理模型行为，本轮只让进度可见。
- `known_answer` 与讲解首行答案一致性未批量抽样。
- `error_reason` 观察点 ≥09-11（只看 `probe=0`）。
- 视觉模型只验 2 题；interview SSE 未实测。
