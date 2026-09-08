# R551：H5 错题本列表卡直显「错因」标签（与小程序对齐，未掌握可点直达错因自评）+ `mistakes/review_log` 入库侧探针打标

日期 2026-09-08 · 前序 R550（`docs/iter/round-3/r550-manual-entry-celebrate.md`）· 分支 `devin/*-r551-card-reason-probe`（从合入 #702 后 main `9a969e53` 开）· 代码 #703（已合入 main `ac98c0b8`）· 本文档 = 研究 + 实修 + 生产复验回填

## 1. 研究（一手证据，先调查再立项）

### 1.1 R550 留下的四候选核实

生产只读 `file:/data/data.db?mode=ro`（`~/r545/q551*.py`，容器内执行，2026-09-08）+ Caddy 访问日志（`~/r545/log551.sh`）+ 生产游客首页 Playwright 截图（`~/r545/shot551.py`，375/1440 全页）+ 源码：

| 候选 | 一手数据 | 结论 |
|---|---|---|
| H5 列表卡面错因 vs 小程序 | 小程序 `book.wxml`：`<text wx:if="{{item.error_reason}}" class="m-meta-warn">{{item.error_reason}}</text>` 卡面直显；H5 `book.vue` mhead 只有 组名/细分/模考·手录/卷码/错 N 次/连对/已掌握·下次复习/时间，错因仅在「更多操作」层 chip-row 与顶部筛选。生产 `mistakes` 非测试 287 行仅 **7 行**有 `error_reason`（4/71 uid；概念不清 3 / 方法不会 2 / 纯蒙的 1 / 粗心大意 1，280 NULL） | 错因是错题本核心整理字段（竞品粉笔「错因归类」卡面可见），H5 标了看不见→填写动力低；两端已不一致，**小改立项（主项）** |
| 手录题「编辑」入口 | `db.update_mistake` 白名单 `allowed = {"error_reason", "mastered"}`，`PATCH /api/mistakes/{mid}` 不接受题干/答案/解析；手录题生产 `source='manual'` **0 行**（R550 上线后无自然样本），`manual_entry_open/save` 事件仅测试 uid | 无样本无需求信号，且编辑要新开安全字段契约（uid 归属/校验/manual-only）——**不立项**，等首个自然手录样本 |
| G3 游客首页错题本价值前置 | 生产游客首页（`landingHide` 未设 + 无练习天数）hero 已是「拍题 AI 讲解 · 错题按遗忘曲线复习 · 迷你模考 / 10万+ 行测题免费刷，免注册即练 / 免注册立即开练」，其下依次 学习计划/模块卡/时政/随机/模考/申论/错题复习/AI 讲解/周报/打卡；375 全页 2125px、1440 1559px 视觉无断裂。`boot` 事件为**每日一次**版本心跳（`main.js` `kg_boot_day`），不是游客转化事件；boot 232 uid 中随后作答仅 8、任意其它事件 30，但 answer 56 uid 无 boot——两者不可当漏斗 | 缺可用转化口径、UI 维度需 UX 出稿，**不立项**（保留） |
| 首个自然 `source='manual'` 样本回看 | 0 行（见上） | 无样本 |

### 1.2 研究过程中发现的观测缺口（→ 副项）

- `growth_events.probe` / `answer_log.probe` 自 R374/R386 起按 `auth.probe_request`（`X-Kg-Probe` 头 / `KG_PROBE_CIDRS=140.232.64.0/24` / 自动化 UA）打 0/1；近 7 天 `boot` 事件 probe=1 占绝对多数（09-06 34/35、09-08 56/56），`answer_log` 历史 1001 行 NULL / 53 行 0 / 79 行 1。
- 但 `mistakes`（19 列）与 `review_log`（8 列）**没有 `probe` 列**，每轮研究只能 `uid NOT LIKE 'test-%'` 粗排，黑盒复验/探针产生的错题与真人不可分——上面「287 行仅 7 行有错因」本身就受此污染。
- Caddy 日志 2320 条 `/api/track` POST 中混有 140.232.64.3/.4/.5 探针网段、显式 `X-Kg-Probe: 1`、HeadlessChrome/curl 与真实移动/桌面 UA。
- **决定**：作为主项的配套内部口径补齐（不改客户端协议、不新增判定规则），使后续每轮研究的错题/复习数据与 `answer_log` 同口径可过滤。历史行保留 NULL 不回填（无法可靠反推）。

### 1.3 设计论证（主项）

- 位置：mhead 在「手录/模考」之后、卷码 badge 与「错 N 次」之前（小程序顺序 typeName → 手录 → 错因 → 错 N 次 → 连对，一致）。
- 可点：`error_reason && !mastered && !batchMode` 时 `role=button` 热区（复用卷码 badge `.pbadge-hit` 的 40px 触达/负 margin 样式），`@click.stop="itemSheet(m)"` 打开既有「更多操作」层——该层「错因自评」chip-row 本就 `v-if="!moreSheet.m.mastered"`，所以可点条件与之对齐，已掌握/批量下退化为只读 `kg-tag`，不会点进一个没有编辑器的层。
- 视觉：`kg-tag tone="warn" icon="pen-line"`（`l-icon` 已有 `pen-line`，`tag` 图标不存在），不新增 token；小程序 `m-meta-warn` 同为 `--warn` 色。
- 不改筛选/错因 PATCH/复盘任何逻辑；小程序 0 改动。

## 2. 实修（后端 +27/-9、H5 +4/-1，测试 +129）

### 2.1 后端（#703）

```py
# db.py
_ensure_mistake_uid: + ALTER TABLE mistakes ADD COLUMN probe INTEGER   （init 时即迁移）
_ensure_review_log:  + ("probe", "ALTER TABLE review_log ADD COLUMN probe INTEGER")（首次 review 写入懒迁移）
save_mistake(rec, probe=False)                     # 新行写 1/0；同 uid 同题干去重 UPDATE 不改原 probe
_advance_review(..., probe=False) / record_review(..., probe=False)
save_answer_log(..., probe) → _advance_review(via="answer", probe=probe)
_hydrate_mistake: d.pop("probe", None)             # 客户端 payload 不外泄
# study_api: /api/mistakes、/api/review/{mid} 传 auth.probe_request(request)
# exam_api._persist_graded: 错题入库沿用已算好的 probe
```

- 测试 `tests/test_r551_mistake_probe.py` 4 例：CIDR/显式头两路径打标 + 列表无 `probe` 键；去重保留原标；`/api/review` 与 `/api/answer_log` 连带推进（via=answer）的 `review_log` 同标；模考错题打标。

### 2.2 H5

```vue
<view v-if="m.error_reason && !m.mastered && !batchMode" class="rzbadge-hit" role="button"
      :aria-label="'错因：' + m.error_reason + '，点击修改'" @click.stop="itemSheet(m)">
  <kg-tag tone="warn" icon="pen-line">{{ m.error_reason }}</kg-tag>
</view>
<kg-tag v-else-if="m.error_reason" tone="warn">{{ m.error_reason }}</kg-tag>
```

- 测试 `tests/r551-card-reason-badge.test.js` 4 例：接线顺序（手录 → 错因 → 卷码 → 错 N 次）/ 可点条件与更多操作层一致 / 小程序口径不变 / 后端源锁。

### 2.3 本地门

pytest 726（+4）/ ruff / pyright 0；vitest **全量** 1077（158 文件，+4）/ eslint+tokens+edge 0 / build:h5 `index-UtFtKsU-.js`；小程序 tsc 0 / eslint 0 / vitest 29；`git diff --check` 空。GitHub Actions 按公司规则保持禁用。

## 3. 生产发版

`deploy_h5.sh --skip-build` `3c3a582d → f8fd391d`（宿主空闲 load 0.24，compose ~90s 收敛；bundle `index-UtFtKsU-.js`，7 变体 JS，回归 200；LH `/` 0.97 / a11y 1.00 / LCP 1835 / CLS 0.06，`/tiku/` 全 1.00 / LCP 904）。发版后生产只读核：`mistakes` 已有 `probe` 列（20 列），`review_log` 仍 8 列（懒迁移待首次写入），`mistakes` 321 行 / 75 uid、`review_log` 37 行、`source='manual'` 0 行。#703 合入 main `ac98c0b8`（与 `f8fd391d` 内容一致）。

## 4. 生产黑盒复验（testing agent，rev f8fd391d，双视口 375×812 / 1440×900，uid `test-r551-*`）

报告 `~/r551-verify/R551-f8fd391d-production-verification.md`，录像 `~/screencasts/r551-f8fd391d-production/r551-f8fd391d-production-edited.mp4`，截图 `~/r551-verify/{cards-clean,more-concept,mastered-click,batch}-{375,1440}.png`，审计 `patch-evidence/network-audit/comparisons/final-db/schema-readonly/clean/readonly-after-clean.json`；PR #703 评论已附两视口卡面截图。

| 项 | 结果 |
|---|---|
| A 卡面错因（两视口） | PASS：真实「手录错题」表单各录有/无错因两题；有错因卡在「手录」后显示 warn 色 + pen-line 图标「概念不清」、`role=button`；无错因卡无新元素；mhead 无溢出/遮挡 |
| B 点标签改选/取消（两视口） | PASS：点标签开更多操作层，「概念不清」chip 选中；改「粗心大意」→ `PATCH /api/mistakes/{id}` 200，关层后卡面即时更新；再点同 chip 取消 → 卡面标签消失、DB `error_reason=''`。**说明**：改选后层不自动关（既有行为），口径为「关层后」 |
| C 已掌握 / 批量（两视口） | PASS：标记已掌握后只读 tag，点击只展开卡片不弹层；恢复复习后可点；批量模式只读，点击为选卡 |
| D 探针打标 DB | PASS：浏览器（`X-Kg-Probe:1`）5 条 mistakes / 4 条 review_log 均 `probe=1`，`review_log` 懒迁移已加 `probe` 列；GET 列表 items 无 `probe` 键；无探针头 curl（UA 路径）创建行 `probe=1`；同题干重复保存同 id `times=2` probe 不变 |
| E 回归（两视口） | PASS：1 字题干客户端校验 + 服务端中文 400；自然复习清零小结一次「回错题本」；题型组 chips；真实题库错题 redo→返回保留 `kp` URL |
| F 请求审计 | PASS：浏览器 511 响应 = 509×200 + 2×**预期** 400；304 0；取消 3 = 2 图片 + 1 测试器过早返回的 redo XHR（已双宽重测）；console/runtime/rejection 0；付费 ask/mistake_analysis/OCR 0 |
| G 清理 | PASS：41 表精确删 28 行；本 uid 与 `test-r551-%` 独立只读核 0 残留；questions/taxonomy/explain_cache/paper_exports 四类哈希不变（`paper_exports` 38→38、`explain_cache` 82→82，未导出 PDF） |

**UNTESTED（如实）**：`probe=0` 分支——普通 UA + 伪造 `X-Kg-Ip` 经公网边缘被覆写仍得 1，生产无可信非探针出口；异分类去重（先 0 后 1）、模考错题打标、`via=answer` 连带打标、首次懒迁移过程仅单测覆盖；小程序/真机（R536-1 累计）。

## 5. 结论与下一步

- H5 卡面错因与小程序对齐上线，错因从「标了看不见」变为卡面一等信息且可点直达自评；`mistakes/review_log` 与 `answer_log` 同口径打标，后续研究可按 `probe` 过滤黑盒流量。
- 手录题编辑 / G3 首页叙事 保留候选：前者等首个自然 `source='manual'` 样本，后者缺可用转化口径（`boot` 是每日版本心跳不是转化事件）。
- R552 候选：① 有了 `probe` 后重跑错因覆盖率/复习活跃度真人口径，看错因填写是否因卡面可见而抬升（需 ≥3 天样本）；② 错因筛选 chip 与卡面标签联动（点卡面标签是否应同时高亮顶部筛选，UX 论证）；③ 复习页错题卡是否同样缺错因直显（H5 `review.vue` 核）；④ 小程序卡面错因是否也应可点（当前纯文本）。
