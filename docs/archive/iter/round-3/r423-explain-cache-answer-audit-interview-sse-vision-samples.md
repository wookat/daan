# R423 / R423b 取证与决策：讲解首行答案 vs 题库对账 / 面试 SSE 边缘规则与空正文 / 视觉补样 / error_reason 观察点

日期：2026-09-06　rev：`cb61b1f`（R423）→ `795377a`（R423b）　PR #619 同分支　生产：kaogong.zalize.com

每一节区分「实测」「推断」「未验证」。探针请求全部带 `X-Kg-Probe: 1`，uid `probe-r423-itv` / `test-r423-img` / `test-r423-ui-*`，事后清理（见 §6）。

---

## 1. explain_cache 99 行讲解首行【答案】vs 题库 `answer`（实测，只读扫描 → 可逆删除 6 行）

脚本 `scripts/r423_explain_cache_answer_audit.py`（默认 dry-run；`--apply` 只删 CONFLICT 行并写 `/data/r423-explain-cache-conflicts.json`；`--restore` 按记录回插，幂等）。匹配口径：缓存 `qid` 优先，否则题干前 40 字逐字命中活跃题；disabled 题单列。

| 分类 | 行数 | 含义 |
|---|---|---|
| OK | 28 | 首行【答案】与题库 answer 一致 |
| CONFLICT | **6** | 首行答案 ≠ 题库 answer（下表） |
| MATCH_DISABLED | 0 | 只命中 disabled 题 |
| SUSPECT | 24 | 讲解首行「题目存疑」（识题不完整/题面缺项，讲解本就不下答案） |
| NO_FIRST | 8 | 首行无可解析答案标记（早期讲解格式） |
| UNMATCHED | 33 | 题干与题库不匹配（用户拍照/手输的非库题） |

6 行 CONFLICT 逐行只读核题面/选项/来源/题库解析/hs 解析后判定：

| key | qid | 缓存首行 | 题库 answer | 判定 |
|---|---|---|---|---|
| 49d8b2b7 / 0f6af01f | 1273222 | D | B | 题库 answer 与 hs 解析一致，缓存讲解错 |
| a929d9e3 | 183439 | A | C | 同上 |
| 2bf5e5a9 | 245781 | A | B | 同上 |
| d52bd381 / 465e30f4 | 235804 | B | A | 同上（R422 视觉样本题，qwen3-vl 识题正确、旧讲解错） |

- 决策：**只删这 6 行缓存**（下次提问按题库答案直通重新生成；R421 起题库直通已把 answer 入提示），**不改题库任何字段**。
- 生产执行：dry-run → `--apply` deleted 6 → 记录文件 keys `['at','cols','deleted']` 6 行 → 复扫 CONFLICT 0、explain_cache 93、questions 156792/109371 不变。
- 还原演练（DB 副本）：restore 6 → 复扫回到原 STAT（CONFLICT 6）→ 再 restore 0（幂等）；生产仍 93。
- 未验证：24 行 SUSPECT 与 33 行 UNMATCHED 的讲解正确性无题库真值可比，不下结论。

## 2. `/api/interview/*/stream` 经边缘实测（实测）

### 2.1 gzip 规则
R422 Caddy `@nosse not path */stream` 覆盖两条面试流：`answer/stream` 与 `sessions/{sid}/review/stream` 经 kaogong.zalize.com 响应头均 `content-type: text/event-stream; charset=utf-8`、**无 `content-encoding`**、`cf-cache-status: DYNAMIC`；事件时间戳分散（meta 3 s → thinking 逐秒 → 正文 → done），不是攒到结束一次性到。复验（§5）`encodedBodySize == decodedBodySize`（44938==44938）。

### 2.2 打分延迟 vs 点评延迟拆分
- 打分 `_grade()` 原走 rescue `kimi-k3`：生产 3 会话 8.57 / 29.15 / 26.58 s（reasoning_tokens 0/1024/534）→ 改主通道 `chat_json(fast=True, think=False)` 2.53 / 2.52 / 2.51 s。meta（分数）到达 3.08 s（探针）/ 2.88–4.45 s（复验）。
- 点评正文首字 29–47 s、done 52–80 s：上游推理模型 reasoning 阶段，本轮**只让用户看见进度**（`event: thinking {secs,chars}`、占位「考官正在思考…（已 N 秒）」），未缩短、不掩盖。

### 2.3 R423 上线后抓到的空正文（实测 → R423b）
- 现象：一次 `answer/stream` 发了 thinking 事件（约 4930 推理字）后直接 done，正文 0 字，点评落库为空；直连上游 4 次采样 reasoning 2498–4095 字 / 正文 1947–2227 字，finish 均 stop，但 reasoning 峰值样本已贴近 4000 token 预算。
- R423b 上线后直连上游（`max_tokens=8000`）：run0 reasoning_tokens **2966** + 正文 → completion_tokens **4007**（> 旧预算 4000，即旧预算下正文必空）、finish=stop、正文 1731 字；run1 943 / 2120 / 正文 1979 字。
- 推断：旧 4000 预算被 reasoning 吃光时正文为空，且 `chat_stream` 原先不记 finish_reason → 无痕。修：`REVIEW_MAX_TOKENS = 8000`（两条点评流共用）；`chat_stream` 记 finish/正文字数/推理字数，`finish=length` 或正文空时 `[llm] stream … warning`（不透出推理文本）。单测 3 条。
- 上线后边缘探针：meta 3.08 s / thinking 25 个 / 正文首字 29.74 s / done 52.42 s / 正文 2188 字、落库 2188；regen 对已有 ≥300 字点评的 s20 正确 400「点评已存在」（设计如此）。60 min 容器日志 `[llm] stream` 告警 0。

## 3. 视觉模型补样（实测，探针，各 1 例）

| 样本 | 输入 | meta | 识别 | 正文 | 备注 |
|---|---|---|---|---|---|
| 材料题 | SEO 页 `/tiku/q/157897` 截图 672×1954 PNG（资料分析·现期比重，材料+题+四选项） | 10.18 s | `ziliao / 资料分析-比重计算`，题干全文正确 | thinking 52 个，首字 71.06 s，done 77.78 s，1096 字，首行「【答案】D」（13.824/34.56=40%，题库 D） | qid null（含图不走直通，设计如此） |
| 低清 | 235804 截图缩到 **360×1017 JPEG q35，36 KB** | 8.0 s | `yanyu / 词语填空`，识出题干与缓存键**逐字命中**（cached=true） | 秒回缓存，首行「【答案】A」= 题库 A | OCR 对低清仍精确到可命中缓存键 |
| 多图 | 两个 `image` 字段（157897 + 297481） | 3.97 s | 只处理**最后一张**（297481 shuliang，cached） | — | API 契约单图（`image: UploadFile | None`），多字段静默只取一张；前端 `chooseImage count:1` 三处，UI 产生不了多图。登记 P3，不加功能 |

三条流响应头均无 `content-encoding`。未验证：真实手机拍照（反光/倾斜）样本仍未做；qwen3-vl-plus 累计 5 例，选型口径不变。

## 4. `error_reason` 观察点（实测，只读）

- 服务器时间 2026-09-06 UTC，观察点 ≥09-11 **未到期**；`mistakes` 无 `probe` 列，`created_at ≥ 09-11` 行 **0**。
- 全时段 `mistakes` 236 行，`error_reason` 非空 **6**（概念不清 3 / 方法不会 2 / 粗心大意 1），按 uid 关联 `answer_log.probe`：这 6 行全部落在 **probe=NULL（历史兼容口径，非可确认真人）**；probe=0 uid 3 行 / probe=1 uid 4 行 / `test-*` 10 行均无 error_reason。结论：**尚无 probe=0 的错因样本**，到期再看。

## 5. 复验（testing agent，rev 795377a，375×812 + 1440×900，uid test-r423-ui-1/2）

(a) meta 2.88 s / 4.45 s 切报告页；(b) 占位「考官正在撰写点评…」→「考官正在思考…（已 N 秒）」逐秒 →「接近完成…（已 43 秒）」，thinking 41/40 个间隔 999–1362 ms；(c) 正文 46.5/47.3 s 起流式，done 79.5/71.8 s，点评 3785/2801 字，无推理草稿泄漏；(d) 练习记录重进 s21 分数/点评一致，F5 仍在，DB review 3785/2801/3451；(e) 3 条流 `text/event-stream`、无 `content-encoding`、enc==dec；(f) `/api` non-2xx 仅跨 uid 访问 session 的预期 404 ×2，console/pageerror/rejection 0，容器 healthy 0 重启、45 min 5xx/Traceback/locked 0；(g) s23 在 thinking 阶段 F5 中断 → 重进「上次点评生成被中断，评分已保留」+「重新生成点评」→ regen 流 thinking 25 个、正文 3451 字、按钮消失、F5 落库仍在。
诚实说明：375 主段 F5 前的 `__hdr/__cerr` 快照未及时导出，以 SSE 记录 200 + 重进后 `[]` + 容器日志佐证。

## 6. 清理与本地门禁
- 生产删 `interview_sessions` 18/19/20（probe-r423-itv）、21/22/23（test-r423-ui-*）→ 34 张含 uid 表 LEFTOVER 0；材料题探针写入的 1 行 explain_cache 删除 → 93（=§1 基线）；questions 156792/109371 不变。
- 本地：pytest 468 / ruff / pyright 0；vitest 603 / eslint 绿；build:h5 由 R423 部署链路完成。
- 宿主：磁盘 91%（4.4 G）、free ~110 MB、负载 18–22（recruit postgres 为主，非本项目）；本轮一次全表 `LIKE '%|%'` 只读扫描在高负载下 >10 min 未返回被我中止，改用 `/api/questions?grouped=1` 取材料题——**高负载时段不要在生产库跑无索引全表 LIKE**。
