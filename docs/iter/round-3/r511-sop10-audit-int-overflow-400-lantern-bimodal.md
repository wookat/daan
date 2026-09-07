# R511（2026-09-08）SOP-10 四维审计：R500–R510 复盘 + W9 整数参数越界 500 处置（`OverflowError` → /api 400 / 公开页 404）+ 首页 Lighthouse 模拟值双峰定性

> 生产 `f5223d72` → `0c532532`。后端 1 文件 + 测试 6 例；前端 dist 未动（bundle `index-CAa9sGqt.js` 线上=本机=R510）。
> 全部生产取证为只读 GET + `X-Kg-Probe: 1`；本轮向生产 0 账号/作答/写入/LLM。

## 1. (c) 补量 + 到期项（`~/r510_post.sh` → `~/r511_pre.out`；发版后 `~/r511_post.out`）

| 项 | 结果 |
|---|---|
| R510 容器（`21:26:33Z` 起，155 请求） | 5xx 0 / assets 404 0 / monitor 0 / mpUA 0 / 非探针非 bot 0 / 非探针 POST 0 / 401·403 0 / Traceback 0；WAL `4,173,592` 同字节 |
| probe=0 | `answer_log` 53/2、growth 26/4（uid `umst3`/`umsacie`，最后作答 09-07 20:00Z）、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0 |
| 公告「详情」/ `mistakes_total` 非探针触达 | 无样本（R510 发版后非探针 `/api/*` 请求 0） |
| 到期项 | `www.zalize.com` 证书 10-04；`WX_MINIAPP_SECRET` 未配；R385 第二冷样本未达标——均未变 |
| profile | 11 行，已过/今天/未来 1/0/10（唯一已过仍 `umst3tui · 2026-09-07`）；W9 探针 `POST /api/profile` 2 行留在库中（probe=1） |

→ 无新的外部真人证据。

## 2. 四维复盘 R500–R510

| 维度 | 簇 | 现状（一手） | 判定 |
|---|---|---|---|
| 落地页/首页 UI | Lighthouse/CLS（R507/R508） | a11y 1.00×3、CLS 0.061×3（仅 Tabbar `::after`）、请求 83 个不变；perf/LCP 双峰见 §4 | 收口；双峰是模拟量法问题不是页面回归 |
| 核心学习功能 | 练习页冷启动（R509/R510） | 直链分包并行、首页链分包 0 走网；a11y 剩模块标签 4.00:1（设计决定） | 收口；直链 API 预发等真人样本 |
| 操作台 | 计划表单簇（R505/R506） | 生产 `user_profile` 11 行仍近全默认值（70×9 / 零基础×9 / 60 分钟×10 / 国考×11）；非探针 `POST /api/profile` 全史 1 条（09-06 `223.83.2.220` Android/V2405A）| 表单被真人用过 1 次，无新样本；不动 |
| 架构 | W9 越界 500（R510 登记） | **未处置**：`origin` 无 W9 分支，main `35be115c` 与本分支均无 `OverflowError` 处理；本地 `TestClient` 复现 5 条 500（含公开页 `/tiku/q/<20 位>/`）| **本轮修**（§3） |

## 3. W9 整数参数越界 500 → 400/404

### 3.1 一手

- 生产（R510 (c)，`~/r510_5xx.out`）：`kg-w9-audit-probe` 5×500：`/api/exam/papers?year=99999999999999999999`、`/api/questions?module=yanyu&year=…`、`/api/question/…`、`/api/mock/events/…`；应用日志 15 条 Traceback 全 `OverflowError: Python int too large to convert to SQLite INTEGER`。
- 本地复现（`tests/test_r511_repro.py` 临时用例，已删）：

| 路径 | 改前 |
|---|---|
| `/api/question/<20 位>` | `OverflowError` 500 |
| `/api/questions?module=yanyu&year=<20 位>` | 500 |
| `/api/exam/papers?year=<20 位>` | 500 |
| `/api/mock/events/<20 位>` | 500 |
| `/tiku/q/<20 位>/`（公开 SSR 页，可被爬虫/畸形外链打到） | 500 |
| `/tiku/<20 位>/yanyu/` | 404（已有路径校验） |
| `/api/questions?...&limit=<20 位>` | 200（`min()` 夹住） |

机制：FastAPI/pydantic 的 `int` 是任意精度，>2^63−1 的值原样放行到 `sqlite3` 绑参才抛 `OverflowError`（`ArithmeticError` 子类，不被既有 `ValueError/TypeError` 兜底覆盖）。

### 3.2 修（`backend/app/main.py`，`0c532532`）

```python
@app.exception_handler(OverflowError)     # 新增
@app.exception_handler(ValueError)
@app.exception_handler(TypeError)
async def _bad_param_handler(request, exc):
    path = request.url.path
    if path.startswith("/api/"):
        return JSONResponse({"detail": "参数格式错误"}, status_code=400)   # 与 deps.as_int 同文案（不变）
    if isinstance(exc, OverflowError) and path.startswith(("/tiku", "/s/", "/p/")):
        return seo._not_found("页面不存在")                                  # 公开页族与 RequestValidationError 同口径
    raise exc                                                                # 其余路径保留 500 供监控
```

不逐端点加 `le=2**63-1`（`year`/`id` 散在 qbank/exam/mock/seo/shenlun 十余处，且新端点会再漏）；`ValueError/TypeError` 在非 /api 路径仍原样抛，不扩大 404 掩盖面。

源锁 `tests/test_int_params_400.py` +6：4 条 /api 越界 → 400 JSON；`/tiku/q/<20 位>/` → 404 html；非 SEO 非 /api 路径 `OverflowError` 仍抛。

门：pytest **522** / ruff / `npx -y pyright app` 0；前端/native 未动、`git diff --check` 空。

### 3.3 发版 + 复验（`~/r511_deploy.log`）

- 预检：宿主 mem_avail 404 MB / 5.0 G / load 0.57、兄弟构建 0。`DEPLOY_FORCE=1 ./deploy/deploy_h5.sh --skip-build` rc=0——**为何 FORCE**：线上 `f5223d72` 是 R510 在旧 R507 分支上的原提交，`#639` 合入后 cherry-pick 为 `34f67d3a`（`git diff f5223d72 34f67d3a` 空树差），谱系闸「HEAD 不含线上 rev」是假阳性，如实记录。
- 容器 `21:42:01Z rev=0c532532` healthy 0 重启；7/7 200；`/tiku/` 1.00；6b `/` 0.85 / LCP 3668（见 §4）。
- 生产同 5 条探针（GET + 探针头）：4 条 /api → `400 {"detail":"参数格式错误"}`；`/tiku/q/<20 位>/` → 301（既有去尾斜杠规范化）→ **404 `页面不存在_错题邦`**；`/tiku/q/1/` 200、`/api/question/1` 200 不受影响；容器日志 Traceback **0**。

## 4. 首页 Lighthouse 模拟值双峰定性（不改码，登记）

本机对生产 ×3（`~/r511/lhr_root_{1,2,3}.json`，frontend dist 与 R510 完全相同）：

| 次 | perf | simFCP | simLCP | simTTI | obsFCP | obsLCP | obsLoad | 文档 TTFB | 请求 | FCP 前请求 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.99 | 1063 | 1427 | 4255 | 96 | 96 | 211 | 44 | 83 | 48 |
| 2 | 0.85 | 2610 | 3686 | 4245 | 180 | 180 | 261 | 92 | 83 | 48 |
| 3 | 0.85 | 2592 | 3660 | 4154 | 140 | 140 | 207 | 49 | 83 | 48 |

- 观测值（obs*）三次同量级、请求拓扑与 FCP 前 48 个资源逐条相同、simTTI 相同；只有 simFCP/simLCP 在 1.0–1.4 / 2.6–3.7 s 双峰——与 R508（1874/2726/3695）、R510 直链 FCP（1.0–1.6 / 2.7）同形态。
- 唯一逐次差异：`index-CAa9sGqt.js` 结束时刻相对 obsFCP 的先后（第 1 次 129 > 96 ms 在 FCP 之后；第 2 次 165 < 180 ms 在 FCP 之前）。**推断**（未读 Lantern 源码证实）：Lantern 以观测 FCP 时刻裁剪「FCP 依赖图」，主 bundle 恰在 FCP 前完成即被计入模拟关键路径，4G 节流下多出 ~1.5 s；真机上 FCP 元素是内联 splash，不依赖 JS。
- 影响：6b `perf ≥0.9 / LCP ≤3000` 预算单次采样命中双峰高侧即 FAIL（本轮、R508、R506 均如此），**不是页面回归**；判回归先看 obsFCP/请求拓扑/FCP 前资源是否变化。是否让 6b 取 ≥3 次中位数属发版脚本策略（R443 已校准一次），待定，不在本轮动。

## 5. 登记 / 不做

- W9 越界已处置；其它 W9 探针项（`POST /api/profile` 2 行 probe=1 留库）不清。
- 后端 `/api/profile` 仍接受已过 `exam_date`（R505 登记，等非 H5 写入证据）。
- 直链 API 挂载前预发、真机弱网 3 s、清单尾部 ~70 资源逐个拉（R510 登记）——无新样本不动。
- 模块标签 4.00:1（设计决定）；小程序 `mistakes_total`/`_sz`/`mergeAnon`（W7）。
- 如实：全部读数为本机 CDP/Lighthouse/curl 非真机 RUM；无 testing agent 录屏（未另行授权）。

## 6. 文件

- 改动：`backend/app/main.py`；`backend/tests/test_int_params_400.py`。
- 取证：`~/r511_pre.out`、`~/r511_post.out`、`~/r511_deploy.log`、`~/r511/lhr_root_{1,2,3}.json`、`~/r510_5xx.out`。
