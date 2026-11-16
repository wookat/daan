# R424 / R424b 取证与决策：面试点评首字 30–47 s 的四变体对比 / 讲解「题目存疑」24 行形态归类与兜底收窄 / error_reason 观察

日期：2026-09-06　rev：`4c45fd5`（R424）→ `1085031`（R424b）　PR #619 同分支　生产：kaogong.zalize.com　bundle 不变（只改后端）

每一节区分「实测」「推断」「未验证」。探针请求全部带 `X-Kg-Probe: 1`，uid `probe-r424-itv` / `test-r424-ui-*`，事后清理（§6）。

---

## 1. 面试点评正文首字 30–47 s：同题同答四变体直连上游（实测）

固定样本 `~/r424_sample.json`：qid 27（社区垃圾分类一个月宣传活动）、答案 302 字、分数 7/8/6/7/7、summary 同一句；脚本 `~/r424_review_cmp.py` 在**容器内直连上游**（模型名可打印、密钥不打印），提示词与生产 `_review_prompt` 完全一致，每变体各跑 2 次。完整点评正文 8 份 `~/r424_reviews/`。

| 变体 | 总时长 | 正文首字 | finish | reasoning 字/`reasoning_tokens` | 正文字/`completion_tokens` | 三节齐 | 引用原文/肯定/问题 |
|---|---:|---:|---|---|---|---|---|
| pro-thinking（R423 线上） | 79.6 / 84.1 s | **52.1 / 62.4 s** | stop/stop | 5329/3272 · 6418/3996 | 3346/5338 · 3115/5911 | ✓✓ | 4/4/4 · 4/4/4 |
| **pro-nothink** | 38.0 / 30.2 s | **6.6 / 1.8 s** | stop/stop | 0 · 0 | 2939/1787 · 2758/1666 | ✓✓ | 4/4/4 · 4/4/4 |
| flash-nothink | 22.3 / 18.4 s | 4.1 / 1.6 s | stop/stop | 0 · 0 | 3047/1850 · 2467/1473 | ✓✓ | 3/3/3 · 3/3/3 |
| flash-thinking | 31.6 / 17.7 s | 16.0 / 1.0 s | stop/stop | 2271/1386 · **0**（第二次上游未推理） | 3033/3160 · 2945/1783 | ✓✓ | 5/5/5 · 3/3/3 |

- 「引用原文/肯定/问题」= 逐段点评里 `「…」` 引用数 / ✅ 条数 / ⚠️ 条数（结构性指标，非人工评分）。8 份正文人工通读：pro 两种均逐段引用考生原句、指出「缺分周主题/示范评选」等与 summary 一致的短板；flash-nothink 引用更少、建议更泛；flash-thinking 两次波动大（一次 5/5/5、一次上游根本没推理）。
- **决策：面试点评改主通道（pro）关推理**——首字 52–62 s → 1.8–6.6 s，同一提示下结构与针对性同级；token 从 5.3–5.9k 降到 1.7–1.8k。**不切 flash**（引用少、且样本只 1 题 2 次，不足以证明各题型无损）。
- 推断：pro-nothink 首字 6.6 vs 1.8 s 的差异是上游排队抖动（无 reasoning）。未验证：其他题型（应急/组织/人际以外）与超长作答（>500 字）下 nothink 质量。

## 2. 实现（R424，rev `4c45fd5`）

- `llm.chat_stream(..., think: bool = True)`：流请求体复用 `_body()`，`think=False` 带 `{"thinking":{"type":"disabled"}}`（与 R422 非流路径同一开关）；`@overload` 保持 `with_thinking` 两种返回类型。
- `interview.py` 三处点评（首次流 / regen 流 / 非流）全部 `think=False`；流路径仍 `with_thinking=True`——上游若忽略 disabled 仍会发 `event: thinking {secs,chars}`（fail-open 的可观测，不是假进度）。`REVIEW_MAX_TOKENS=8000` 不变。
- 单测 `tests/test_r424_review_nothink_suspect_heuristic.py`：两条流 + 非流均断言 `think=False`；`chat_stream(think=False)` 请求体含 disabled。

生产探针（`~/r424_itv_sse.sh`，经边缘）：`answer/stream` **meta 2.59 s → 正文首字 3.90 s → done 20.78 s，thinking 0**，正文 1573 字落库 sid 24；regen 对已有点评回 400「点评已存在」属设计（R423 口径）。

## 3. explain_cache 24 行「题目存疑」形态归类（实测，只读 → 可逆删除 18 行）

`~/r424_suspect.py|.txt`（全字段）+ `~/r424_suspect2.txt`（正文）。24 行 = **17 行兜底死规则固定文案**（`module/question_type` NULL、正文逐字等于 `_SUSPECT_TEXT`）+ **7 行模型自判存疑**（有 module、正文说明缺什么）。

| 形态 | 行数 | 样本（key 前 8） | 处置 |
|---|---:|---|---|
| A 字母数字乱码 + 4 选项（走查压测输入） | 8 | `7f3q9z`×2 `q2w8ez7`×2 `z9k3xw`×2 `p5m7rd` `k4t8vn` | 兜底应拦 ✓ |
| B 纯噪声/空/「测试」/无选项「1+1等于几」 | 4 | `cebf1086` `a82de60e` `468e5050` `2045bae4` | 兜底应拦 ✓ |
| C **合法短题干被误拦**：数列 / 类比 | 4（3 题） | `14fafe71` 3,6,12,24,( ) · `51b41055` 3,7,13,21,31,? · `d5bf7590`/`4bbdeeed` 儿童：女童：未成年 | **误拦，规则问题** |
| D 极短算式带选项「1+1等于几？A.1 B.2 C.3 D.4」 | 1 | `5a74811f` | 保守仍拦（见 §4） |
| E 缺图（题干「见图」） | 2（1 题） | `bfe167b1` `7cbc6210` 2018 山东 66 题 | 模型自判 ✓ 保留 |
| F 缺数据（资料题只给现期、问基期） | 2（1 题） | `fca31108` `834e42b4` | 模型自判 ✓ 保留 |
| G 题干与选项矛盾（盈亏 11092 ≠ 任一选项） | 2（1 题） | `a721d322` `746d0a45` | 模型自判 ✓ 保留 |
| H 题干残缺无选项（「屈原投江所在河流是：」） | 1 | `e677c7aa` | 模型自判 ✓ 保留 |

- 成对 key（同题两行）= R421 前 `key`/`raw_key` 双写；`ua=B` 的行是用户带了自己的选项。
- **旧规则 `stem 汉字 < 8 → 存疑` 过宽**：数列、类比题干天然 <8 汉字，3 题 4 行被误拦并**永久缓存**（此后任何人问同题都秒回存疑）。同时旧代码对存疑输出照常 `save_explain_cache`。

## 4. 兜底收窄（R424 → R424b）与「不掩盖」原则

- 主判仍是模型（EXPLAIN_SYSTEM 红线 5：缺图/缺数据/矛盾由模型说明缺什么，§3 E–H 证明它在工作）；`_suspect_reason` 只做 fail-closed 兜底。
- R424 首版：`hanzi ≥ 8` 放行；否则「≥3 个选项 且（汉字 ≥4 或 **数字字符 ≥4**）」放行。**部署后生产探针即证伪一半**：`7f3q9z k2m A. 1 B. 2 C. 3 D. 4` 数字字符 7+3+9+2+1+2+3+4 ≥4 被放行，模型**硬编「【答案】B｜图形推理-数量规律」**并写入缓存（R424 不该发生的事，一手抓到）。
- **R424b**（`1085031`）：数字改按**独立数字项** `_NUMBER = (?<![A-Za-z0-9])\d+(?:\.\d+)?(?![A-Za-z0-9])` 计数（`7f3q9z` 里的数字不算），放行条件「≥3 选项 且（汉字 ≥4 或 独立数字项 ≥3）」。本地分类：4 条合法数列/类比 → 放行；`7f3q9z k2m …`/`x1 y2 z3 …`/`q2w8ez7 …` → 拦；`1+1等于几？A.1 B.2 C.3 D.4`、`12+35=？…` **仍拦**（汉字 <4 且独立数字项 <3）——这是保守取舍：宁可让极短算式补题干，也不放乱码给模型编答案。
- 存疑固定文案**不再写缓存**（流/非流两处 `and not suspect`）；模型自判存疑仍缓存（那是有内容的结论）。
- 生产复测（`~/r424_explain_probe2.log`，经边缘）：数列 meta 3.59 s `shuliang/等比数列` thinking 39 → 「【答案】B」552 字；类比 meta 2.76 s `panduan/类比推理` → 「【答案】D」967 字；乱码 **2.76 s 单事件「题目存疑」**、不落缓存；缺图「如图所示…A. B. C. D.」→ 模型自判「题目存疑｜题干图形缺失」（形态 E 复现）。

### 生产缓存处置（可逆）
`~/r424_cache_apply.py`（容器内 `PYTHONPATH=/app/backend`）：dry → apply → dry。删 **18 行** = 17 行固定文案（含 3 题 4 行误拦）+ 1 行 R424 首版探针写入的错误讲解（`bf01a675` 硬编 B）；记录 `/data/r424-explain-cache-suspect.json`（全字段 18 行）。explain_cache 94 → **76**，固定文案 0、模型自判 7 保留。还原演练（DB 副本 `sqlite3 backup`）：76 → 94、存疑回到 24 → 与处置前一致；生产仍 76。未做 `.sql.gz` 整表转储（容器无 sqlite3 CLI，JSON 记录即 restore 输入）。

## 5. 复验（testing agent，rev `1085031`，`test-r424-ui-1/2`，375×812 + 1440×900）(a)–(f) 全 PASS

- 面试 3 条流（375 s25 / 375 regen s26 / 1440 s27）`event: thinking` **全 0**；正文首字距 meta **1.6 / 1.5 / 1.3 s**（R423 为 29–47 s）；点评 2386 / 2641 / 2998 字无推理泄漏（`bad=[]`）；等待文案仅「考官正在撰写点评…」~1.5 s 一闪，「考官正在思考…（已 N 秒）」不再出现；正文流中 F5 → 重进「上次点评生成被中断」→「重新生成点评」→ 首字 1.5 s → 落库 2641；`interview_sessions.review` 与 UI 一致；`ce null` enc==dec。
- ask 375 手输：数列 `shuliang/等比数列` thinking 34 逐秒 → 「【答案】B」；类比 `panduan/类比推理` thinking 69 → 「【答案】D」；乱码 `7f3q9z…` **2.7 s 单事件秒回存疑**、module null、thinking 0、UI 无 chips 直接存疑卡；explain_cache 76 → 78（恰为数列+类比）、`7f3q9z%` **0 行**。
- `/api` non-2xx 仅预期 404 ×1（跨 uid session）；console/pageerror/rejection 全 `[]`；容器 healthy 0 重启；60 min 日志 Traceback/locked/`finish=length`/空正文 0；5xx 2 = `POST /api/auth/wxlogin 503`（§7，真实设备触发，非本轮）。
- 清理：interview_sessions 25/26/27 + explain_cache 窗口内 2 行 + `ask_cur` 1 → 34 表 LEFTOVER 0；explain_cache 回 **76**。
- 报告 `~/r424_regress_report.md`；录屏见 PR 评论。

## 6. 清理与不变量
- 探针：interview_sessions `probe-r424-itv`（sid 24）删；R424b 探针写入的 3 行 explain_cache（数列/类比/缺图）删 → 76。
- questions 156792 / 活跃 109371、explanation_quarantine 874 不变；mistakes 251 / answer_log 1100 的增量全部来自 §7 设备与 `test-w4-mp`/探针 uid，本轮未写。
- 部署：`--skip-build` 两次（`4c45fd5`、`1085031`），rev 谱系闸 OK，Lighthouse 仅 LCP 2737 > 2500 预算一次 FAIL 提示（宿主 load 10–11、free 76 MB，bundle 未变；R424 首次部署同页通过），其余全过。磁盘 94%/2.9 G。

## 7. `error_reason` 观察与首个 probe=0 活跃设备（实测，只读）
- 观察点 ≥09-11 未到期（服务器 09-06）。`mistakes.error_reason` 非空仍 6 行、全在 probe=NULL uid；**probe=0 uid 0 行**。
- 本轮一手看到 **第一个有量的 `probe=0` uid** `umst3tuisd7lgzaka`：09-06 00:10Z 与 08:36–08:59Z 两次到访，caddy 241 条 `/api`（IP 39.158.40.85 中国移动，UA vivo V2405A Android 16 WebView），22 次作答（6 对，08:55–08:57 两分钟 20 题，模块 ziliao 为主）、16 条错题、1 次复习提交、2 次错题 PATCH、1 次 share/create、3 次 reminders、**3 次 `POST /api/auth/wxlogin` → 503**（`WX_MINIAPP_SECRET` 未配的设计返回）；09-02 同 uid 2 行 probe=NULL。
- 判定：三路探针判定均未命中 → 记 `probe=0`，但 **R386 已登记同一台 vivo V2405A 为 `MiniProgramEnv` 走查设备**（08-10 起 9 个会话），且行为（2 分钟点 20 题、连点微信登录）与内部验收一致——**不归因为可确认外部真人**，按「候选真人」登记；`error_reason` 该 uid 18 条错题全 NULL（未用错因入口）。wxlogin 503 是这台设备本轮可见的唯一失败，资源缺口 `WX_MINIAPP_SECRET` 不变。

## 8. 遗留 / 下一步
- 极短算式「1+1等于几？A…」仍被兜底拦（保守取舍），若真实用户出现此类需求再放。
- flash 是否可替代 pro 做点评：样本 1 题 ×2，不下结论；点评总时长 30–38 s 仍由正文 2.7–3k 字决定（可见流式，不掩盖）。
- 已缓存的模型自判存疑 7 行（缺图/缺数据/矛盾/残缺）保留：是有内容的结论。
- `error_reason` 到 09-11 只看 probe=0。
