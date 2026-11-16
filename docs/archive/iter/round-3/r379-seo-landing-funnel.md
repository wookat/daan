# R379：搜索落地→作答漏斗修补——深链「退出」不再整页重载 + 题目页首屏可作答

## 取证事实（2026-09-04 14:10–14:40Z，生产 rev 0b6ef09 / bundle index-BHP3w8L6.js，一手证据）

testing agent 以搜索访客身份（375×812 + 1440）从 `/tiku/q/*` 走完「读题 → 点 CTA → 做题 → 退出」全链路，产出 20 条 UX 发现（`r379_ux_findings.md`，含截图/录屏）。其中影响转化与可用性的：

- **F11 · P0 · 「退出」不退出**：SEO 深链直达练习页做到 4/11（✓2 ✗2）点「退出」→ Performance API 记到一次 `type=reload` 导航，URL 不变，页面回到同一组第 1 题、计数清零、服务端进度被 `clearServerProgress()` 清掉。根因：H5 端 `uni.navigateBack` 只是 `history.go(-1)` 且**永不进 fail 回调**，深链直达时页面栈只有 1 页，`go(-1)` 要么回站外要么在同 URL 上整页重载——`quit()` 里 `navigateBack({ fail: switchTab 首页 })` 的兜底永远不触发。
- **F1/F2 · P1 · 答案先于作答暴露、CTA 在 1.3–1.6 屏之下**：题目页 `<details open>` 默认摊开「正确答案+解析」，访客看到答案再点 CTA 的意义大减；唯一 CTA 排在答案与解析之后，375 视口要滚 1.3 屏（长解析 1.6 屏）才看到。
- **F3 · P1 · 首屏无价值主张**：首屏只有面包屑+题干+选项，没有一句话说明「这里能免费做、错题自动进本」。
- **F4 · P1 · 选项长得像可点但是死的**：`<div class="opt">` 有边框圆角，访客本能去点，无反应。
- **F9 · P1 · 练习页不告诉访客第 1 题就是刚读那题**：R378 承诺「做这道题」，落地后没有任何文案兑现感，访客不确定是不是同一道题。
- **F13 · P1 · 答错后解析卡被判分横幅盖住**：375 视口答错后「正确答案 + 解析」卡顶部在横幅之下，要手动上滑才知道有解析。
- F18（首页缺「继续刚才的练习」卡）、F10（答对 1.2s 自动跳题看不到解析）等留待后续轮次。

其余基线复核（未变差）：375 无横向溢出、无死链、无应用级 JS 错误、练习页秒开、无登录墙、答错入错题本、`answer_log.source=seo_q` 落库。

## 结论与方案

一次搜索访客只给我们一次机会。本轮只修「第一次落地就流失」的 6 条：F11（P0）+ F1/F2/F3/F4/F9/F13（P1、改动小）。不动排序算法、不加表/端点。

### 后端 `backend/app/seo/pages.py` + `seo/common.py`

- 选项 `<div class="opt">` → `<a class="opt" href="{practice_href}&pick=A" rel="nofollow">`：点哪个选项就带着选择进练习页作答（F4 顺势变成转化入口）。
- CTA `cta cta-w`（整行、居中）前移到选项之后、答案之前；答案区 `<details class="ans">` 默认**折叠**，summary「先想一想，再看答案与解析 ▸」；折叠区末尾再放一次 CTA（读完解析的人也有出口）。答案/解析仍在 DOM 与 JSON-LD `acceptedAnswer` 中，收录不受影响。
- 选项上方一行价值主张（`.meta`）「点选项直接作答 · 免费无需注册 · 做错自动进错题本」（F3）。
- 面包屑末项「题目 #4640」→「题目」（内部 id 对访客无意义）；页尾「返回考点题目列表」→「更多「××」考点题目 ›」。
- CSS：`.opt` 作为 `<a>` 用 `display:block; min-height:44px; color:var(--text)`，hover/active 描边高亮；`.cta-w{display:block;text-align:center}`（声明在 `.cta` 之后以覆盖 inline-block）。

### 前端 `frontend-uni/src/pages/practice/practice.vue` + `src/leadq.js`

- **F11**：`quit()` 末尾 `getCurrentPages().length > 1 ? navigateBack : switchTab('/pages/home/home')`——页面栈仅 1 页（深链直达）直接切首页 tab，不再 `history.go(-1)`。其余 quit 语义（记录作答、清 pendingSession、清服务端进度）不变。
- **F9**：`start()` 领跑题确实置顶（`items[0].id === leadQid`）时设 `leadHint`，进度条下方显示可关闭的 `role=status` 提示「刚才那题在这里作答，之后 N 题同考点练习」（无 tag3 时「同模块练习」，不夸大）；`idx>0` 或 quit 后自动消失。
- **pick 深链**：`leadPickOf(query)` 只接单个大写字母 A–H；领跑题就位且该选项存在时 `$nextTick` 后调用既有 `pick()`（完整走判分/answer_log/错题入本/统计），随后**取消自动跳题定时器**，让访客停在第 1 题看判定与解析（F10 在这一入口顺带解掉）。非法 `pick` 一律当没选。
- **F13**：`pick()` 答错分支 `$nextTick(() => revealAfter())`：`createSelectorQuery` 量 `.after` 位置，若其顶部+220px 在「视口高−150px（横幅）」之下则 `pageScrollTo` 把它顶出来；`.bsub`「已自动存入错题本」22→24rpx、ink-1。

### 度量

- F11：生产走同路径「退出」后 Performance API 不应再出现 `type=reload`，URL 应为 `/#/pages/home/home`，进度计数不应回到 1/N。
- 漏斗：`answer_log WHERE source='seo_q' AND probe IS NOT 1` 仍是转化口径；上线后新增「首行 question_id == 落地 qid 且带 pick」的比例 = 选项直达作答占比（Google 尚未抓题目页，短期 0 为正常）。

### 验证

- 后端 pytest：新增 `test_question_page_first_fold_funnel`（选项为带 `pick=` 的深链、`<details open` 不存在、价值主张→选项→CTA→答案顺序、CTA 两处、无「题目 #id」/「返回」）；原 CTA 两支断言改匹配 `cta cta-w`。
- 前端 vitest：`leadPickOf`（合法 A/D、undefined/空/小写/多字符/数字/数组）、`leadHintText`（有/无 tag3、总数 1/0 不带尾句）。
- 生产 1440/375：`/tiku/q/N` 首屏见价值主张+可点选项+CTA、答案默认折叠；点选项 C → 练习页第 1 题 id==N、已判定 C、提示条可见、不自动跳题、答错时解析卡可见；点 CTA（不带 pick）→ 第 1 题未作答、提示条可见；做几题后「退出」→ 首页、无 reload、进度不回 1/N；`answer_log` 落 `seo_q`（探针 probe=1，复验后清理）。
