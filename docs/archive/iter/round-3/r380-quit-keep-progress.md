# R380：练习中途「退出」可保留进度——首页「有一组未做完的练习」续练卡真正接得上

## 取证事实（2026-09-04，一手证据）

- R379 生产 UX 取证 F18：搜索访客做到 4/11 后退出，回到首页**没有任何「继续刚才的练习」上下文**，本次落地带来的注意力就此断掉。代码实查根因不是首页缺卡：`home.vue` 早有「有一组未做完的练习 · 已做 N/M 题 · 去继续 ›」续练卡（本地 `pendingSession` → 远端 `/api/practice/resume` 双路），而是 `practice.vue quit()` 无条件 `removeStorageSync('pendingSession')` + `clearServerProgress()`——**任何中途退出都等于放弃**，卡永远没有机会出现。续练卡目前只覆盖「直接关页/杀进程」这条路径。
- 竞品标尺：粉笔练习中途退出弹「是否退出练习」并保留进度，回到首页/列表可继续；不会静默清空。
- 搜索分发进展（源站 access log 当前文件，剔除探针网段）：Googlebot 仍只抓 sitemap（15 次）+ robots（1 次），`/tiku/q/*` 0 次；**Bingbot 已抓 `/tiku/q/*` 7 次、Yandex 45 次**——非 Google 引擎已进入题目页，落地→作答漏斗（R378/R379）不再是纯预防性工作。`answer_log source='seo_q'` 真人仍 0（Google 未收录，属正常）。

## 结论与方案

中途退出时若「已答 ≥1 且仍有未答」，弹一次小结让用户选：**保留进度**（默认确认）/ **结束本组**。保留 → 不清 `pendingSession`、立即 flush 服务端进度（跳过 1.5s 去抖），首页续练卡随即可见；结束 → 原行为。一题未答或已全部答完不弹（无进度可保留），模考/背题/时政场次不弹（各有自己的退出语义）。

- `src/quit-summary.js`（纯函数，vitest）：`quitSummary(items, eligible)` → `{done,right,wrong,left,title}` 或 `null`；标题「已做 N 题 · 答对 R · W 道进错题本」（全对时无尾句）。
- `practice.vue`：`quit()` → 有摘要时 `uni.showModal`（confirm「保留进度」/ cancel「结束本组」，content「保留后可从首页「有一组未做完的练习」继续」）→ `leave(keep)`；无摘要直接 `leave(false)`。`leave(keep)`：`keep` 时 `clearTimeout(_ppTimer); pushPracticeProgress()`，否则原清理；其余（记录作答、重置状态、R379 的深链退出走 switchTab）不变。埋点 `practice_quit_keep` / `practice_quit_end`（source 归因随 `_source`），供后续量化「退出后保留率」。
- 首页 `loadPracticeResume()` 零改动：`pendingSession` 已由每次 `pick()` 的 `saveSession()` 写入，`ppClearedAt` 30s 抑制只在「结束本组」路径触发。

## 验证

- vitest：`quitSummary` 六例（有对有错/全对/未答/全答/不适用场景/空）。
- 生产 1440/375：SEO 深链做 2 题（1 错）→ 退出 → 弹「已做 2 题 · 答对 1 · 1 道进错题本」→ 保留进度 → 首页出现「有一组未做完的练习 · 已做 2/N 题」→ 去继续 → 回到第 3 题、计数保留、`source` 仍 `seo_q`；同流程选「结束本组」→ 首页无卡；一题未答直接退出无弹窗；`growth_events` 落 `practice_quit_keep/end`（探针 probe=1，复验后清理）。
