# R378：搜索落地页「做这道题」深链——SEO 题目页 CTA 带 qid，练习页以该题领跑 + 同考点续题

## 取证事实（2026-09-04 13:30–13:50Z，一手证据）

- **Google 已开始读站点地图**。Search Console「站点地图」页：`https://kaogong.zalize.com/sitemap.xml` 状态「成功」、上次读取 2026-09-04、**已发现网页 109,903**（R377 提交时为 0）。源站日志 12:24–12:41Z Googlebot（`66.249.73.x`，非探针网段）共 32 次抓取，**全部是 sitemap 子图**（200，≤0.1s），尚未抓任何 `/tiku/q/*` 页。这是「已发现」不是「已收录」，更不是「有搜索流量」。
- **SEO 页从未带来过一次真人作答**。生产 `answer_log` 按 `source` 分组：`source='seo'` 仅 2 行且 `probe=1`（我们自己的探针）；真人行里 `direct` 62 / `share` 8 / `session-report` 10 / `reinforce` 5 / `search` 1 / `redo` 1，`seo` 为 0。此前 Google 从未发现本站，这个 0 是「没流量」而非「转化差」——但 Google 抓页在即，落地→转化这一跳必须在流量到来前修好，否则第一批搜索访客就是浪费。
- **现状 CTA 丢掉访客上下文**。`/tiku/q/4640`（资料分析·两期平均数比较）页面唯一 CTA 是「在线练习此考点（免费）→」→ `/#/pages/practice/practice?tag3=ZL-PJ-04&module=ziliao&source=seo`：练习页 `start()` 按 tag3 **随机**取 10 题——访客刚读完的那道题不保证在其中（该考点 ≥ 数十题），点进去看到的是另一道题。无 tag3 的题（约 1/3 题目无考点标签）CTA 退化为「继续刷题 →」直接回首页，访客读的题彻底丢失。
- 竞品标尺：粉笔题目分享落地页「进入 App 做这道题」打开的就是**同一道题**，作答后再顺着同考点/同卷续题。这是「落地页/首页 UI」维度的一个具体差距。
- SSR 侧渲染 `_render_question` 有 `lru_cache(4096)`；`/api/question/{qid}`（`social.py`，`questions_by_ids`）已存在返回单题完整结构（与 `random_questions` 同字段），无需新端点。

## 结论与方案

搜索访客的意图是「这道题」，不是「这个考点」。CTA 改为「在线做这道题 + 同考点练习（免费）→」，深链带 `qid`，练习页把该题放第一题、其后接同考点随机题（原逻辑），来源标记 `source=seo_q` 以便与老 `seo` 口径区分并可在 `answer_log` 直接量化「搜索落地→作答」转化。

### 后端 `backend/app/seo/pages.py`

- 题目页 CTA：
  - 有 tag3：`practice?qid={qid}&tag3=…&module=…&source=seo_q`，文案「在线做这道题 + 同考点练习（免费）→」；
  - 无 tag3：`practice?qid={qid}[&module=…]&source=seo_q`，文案「在线做这道题（免费）→」（原「继续刷题 →」回首页丢题的分支去掉）。
- 其余（结构化数据、面包屑、同材料题组、相似题）不动。`_render_question` 缓存内容随代码变化自然失效（进程重启）。

### 前端 `frontend-uni/src/pages/practice/practice.vue` + `src/leadq.js`

- `onLoad`：`query.qid` 为正整数时记入 `_urlLaunch.qid`，无论有无 tag3/module 都走 `start()`（无 tag3 无 module 时 `start(null, …)` 走全库随机，领跑题仍是访客那道）。
- `start()`：题包取到后若有 `_leadQid`，并行请求 `/api/question/{qid}`；成功且 `disabled` 为假 → `mergeLead(lead, items)` 把它放到第一题并去重；失败（404/网络）→ 静默按原题包开练，不阻塞。
- `leadq.js`（纯函数，vitest）：`leadQidOf(query)` 解析正整数 qid；`mergeLead(lead, items)` 领跑去重。
- `source=seo_q` 随现有 `_source` 进 `answer_log.source`，零新字段。

### 度量

上线后 `answer_log WHERE source='seo_q' AND probe IS NOT 1`：行数 = 搜索落地转化作答数、`count(distinct uid)` = 转化人数、首行 `question_id == 落地 qid` 比例 = 领跑生效率。Google 尚未抓 `/tiku/q/*`，短期内该口径预期仍为 0，属正常，不据此评价本轮。

### 验证

- 后端 pytest：题目页 CTA 含 `qid=` 与 `source=seo_q`（有/无 tag3 两支）。
- 前端 vitest：`leadQidOf`（合法/非法/缺失）、`mergeLead`（置顶、去重、disabled/空 lead 透传）。
- 生产 1440/375：从 `/tiku/q/N` 点 CTA → 练习页第一题 id == N、作答一题 → `answer_log` 落 `source='seo_q'`（探针网段 probe=1，复验后清理）；无 tag3 题目页同流程；直接打开 `practice?qid=不存在` 不报错正常开练。
