# R410 — SOP-10 四维审计（对标粉笔错题本）：错题本次级屏 375/1440 一手可用性走查 → 6 P1 + 4 P2 修复

日期 2026-09-06 · 分支 `devin/*-r400-formula-dropped-snapshot`（PR #619，base=main）· 审计基线 rev `c79a9a8`

## 0. 审计口径与边界（如实）

- SOP-10 要求主标尺竞品**真实注册全流程截图**；粉笔错题本次级屏需账号登录，本轮**仍无一手截图**（同 R398）。因此本轮**不做任何「粉笔有 X」陈述、不据二手资料加功能**；审计改问两件可一手取证的事：
  1. 我们已有的对应功能在 375×812（手机主视口）与 1440×900 能不能用（rect / `elementFromPoint` / `scrollWidth` / 字号）；
  2. 生产真人有没有用（只读 SQL，probe 口径按 R374/R386，历史 `probe=NULL` 不归因为真人）。
- 审计由 testing agent 在生产站独立执行，只审不改；两 uid `test-r410-1440-k3p7` / `test-r410-375-w8n2` 各用真实 UI 答错 7 题造数据，结束后 43 行清理到 LEFTOVER 0（`paper_exports` 38 不变、questions 156792/109371、quarantine 七 reason 不变）。报告 `~/r410_test_report.md`，录屏 `~/screencasts/r410-audit/r410-audit-edited.mp4`。

## 1. 生产真人使用数据（只读，2026-09-05 19:20Z）

| 指标 | 值 |
|---|---|
| `mistakes` 行 / uid | 222 / 60（练习 203、模考 19） |
| `mastered=1` | **0** |
| `error_reason` 已标注 | **6 / 222** |
| `review_log` 行 / uid | 31 / 6 |
| 有错题但从未进复习的 uid | **54 / 60** |
| `next_review` 到期 / NULL / 未来 | 24 / 197 / 1 |
| `review_entry_click` 近 7 天 | 3 次 / 3 uid |
| `answer_log` probe 分布 | NULL 1,040 / 61 uid；probe=1 29 / 3 uid；probe=0 **0** |
| 收藏/笔记/巩固 | 合计 2 行 |

- 结论只到「功能几乎没人用」；**不能**归因为真人（打标后 probe=0 为 0 行），也不能据此下「粉笔如何」的结论。
- 一个可一手核实的结构原因：**错题本列表页此前没有错因标注入口**——`error_reason` 只能在练习页答错当下、或复习模式答错后标注（R398 「卡片展开有错因自评四选一」的表述不准确，本轮更正）；模考错题（19 行）走 exam 模式，从头到尾没有标注机会；54/60 uid 从未进复习。「按错因筛选」「月报按错因聚合」「高频错因是提分洼地」这些下游功能都依赖一个多数用户接触不到的入口。

## 2. 审计结果（8 项次级屏，均一手量测）

| # | 次级屏 | 375 | 1440 | 最高级 |
|---|---|---|---|---|
| 1 | 错题卡展开态 + 「···」sheet | FAIL | FAIL | P1 |
| 2 | 批量模式 | PASS（P2 观察） | PASS（P2） | P2 |
| 3 | 复习全流程（答错→错因→加练→完成层） | 功能 PASS / 热区 P1 | untested | P1 |
| 4 | 已掌握 tab / 纠错 sheet / 手动录入 sheet | PASS（P2） | PASS | P2 |
| 5 | 筛选 sheet + PDF 确认层 | 功能 PASS / chip P1 | PASS | P1 |
| 6 | 搜索 / 无结果 / 空错题本 | 功能 PASS / ✕ P1 | PASS | P1 |
| 7 | stats 375 | 无溢出裁切 / 字号 P2 | — | P2 |
| 8 | SEO 题目页「花生十三方法解析」 | PASS | PASS | — |
| — | R398 回归 `.mask.bottom==762` / AI 失败态+重试 | PASS | — | — |

无 P0、无接口错误、`/api` 无非预期 non-2xx、容器 5xx/Traceback/slow-req 0。

### P1（6）
1. 375 列表滚到底，末卡「···」（x306–350 / y681–725）被悬浮「＋」（x307–359 / y694–746）盖住，`elementFromPoint` → `fab-main`；「已掌握」tab 1 卡时同样复现。根因：列表全部加载后没有 `.loadmore`（它自带 140rpx 底距），末卡直接贴 tabbar。
2. 375 「···」用 `uni.showActionSheet`，6 项菜单末行「删除」y724–770、「取消」y760–806 越过 tabbar 762（uni 原生 actionsheet 不受 R398 `.mask` 让位规则约束）。
3. 1440 同 sheet 居中弹层容器裁切「删除」半行、「取消」不可见。
4. 375 复习错因自评 chip 70×26 / 字 11.5px。
5. 375 筛选 sheet chip 高 24 / 字 11px（各段一致）。
6. 375 搜索清除 ✕ 热区 24×16。

### P2（观察，部分本轮顺带修）
- 复习「下一题」初始 y774 需滚动（内容长度所致，不改）；写笔记/讨论/分享 17px 文字链（q-social-bar 组件，不改）；「去刷题」36px（修）；纠错 chip 37px（修）；批量清空 tab 后无退出控件（R396 已知，修）；已掌握 tab 空态复用「没有匹配的错题」（修）；stats 多处 9–11.5px（图表标注字号，不改，留观察）；batchbar 盖末卡 footer（批量态下 footer 本就不用，不改）。

## 3. 修法（仅 `book.vue` + `practice.vue` 4 行样式，bundle 变）

- **FAB 让位**：列表见底（无 `.loadmore`）且非批量、有卡时渲染 `.fabspace`（`calc(104rpx + 64rpx)`）占位。
- **「···」sheet 改页内 `.mask` sheet**（`moreSheet = { m, acts }`），走 R398 让位规则，行高 48px，「删除」红色、「取消」独立行，Esc 关闭（桌面快捷键与 kbdHelp 同一入口）。**顺带把错因自评四选一放进这个 sheet**（未掌握时显示，PATCH `/api/mistakes/{id} error_reason`，再点同 chip 取消标注）——这是列表页第一次有错因入口，依据是 §1 的一手结构原因，不是竞品复刻。
- **热区**：`.rz`（book + practice 两处同规则）/ `.kpchip` / `.rp-chip` `min-height: 40px`，字号 26rpx（13px）；`.searchclear` 40×40（负外边距抵消，搜索条高度不变）；`.e-btn2` `min-height: 44px`。
- **文案/控件**：已掌握 tab 且无搜索/筛选时专属空态「还没有已掌握的错题」；`.batchbar` 常驻「退出」，列表为空时隐藏「全选本页」。
- 源文件锁 `frontend-uni/tests/book-r410-audit.test.js`（5 例）。

## 4. 本地验证

vitest 564（+5）/ eslint / `build:h5` 全绿；后端未改。

## 5. 部署与复验

见 handoff R410 条目（部署后由 testing agent 对 6 项 P1 逐项复量 + 新增 sheet 在 375/1440 的 rect，以及 R398 回归）。

## 6. 未做 / 遗留（如实）

- 粉笔一手截图仍缺（需账号）；本轮零竞品陈述。
- 1440 复习全流程在 R410b 复验中补做 PASS；「来源」筛选段因测试数据无模考错题未出现。待掌握 tab 批量清空后的空态仍复用「没有匹配的错题」（P2，未改）。
- 错因入口补上后 6/222 会不会变，要看后续真人数据（当前 probe=0 为 0 行，无法证明有真人）。
- stats 字号、社交栏文字链 17px、复习「下一题」初始位置未改。
- R398 文档中「卡片展开有错因自评四选一」表述不准确，以本文为准。
