# R485：`explain/stream question_id` 全产品发送方盘点 + R484「喂错题」勘误 + 服务端 module 兜底设计论证（登记不修）

日期：2026-09-07（UTC 09:03–09:20 观测）。生产仍 `7acf57b`（R484），本轮 **0 产品代码**，仅文档。

## 0. 结论

1. **R484 勘误**：R484 §2 / handoff / PR 评论 / SOP-04 写「时政题号带进 `explain/stream question_id` → 服务端 `_linked()` 按 `questions` 取题喂 LLM、讲解提示被喂另一道题」——**不成立**。R421 `engine.extract_from_qbank(row, text)` 是 fail-closed：要求题库行题干前 40 字逐字出现在提交文本里；时政题文 + 撞号行测 `questions.118` → `None` → 走原识题 LLM 路径、meta `qid=None`。服务端提示不受撞号影响。**受影响的只有端侧**：`ask.vue` rec `qid: askQid(m.qid) || qid` 在服务端未确认时回落端侧 `pendingQid` → 「查看原题」深链 / 「存入错题本」`question_id` 落行测题号（`save_mistake` 的 `foreign_module_qid` 只在 module 非空且非行测时置空，ask 页 module 来自 LLM 识题 → 不拦）。R484 的修法（源头不写 `redoQid`）与源锁不变，只是影响面写大了。
2. **全产品 `explain/stream question_id` 发送方 = H5 `ask.vue` 一处**：W7 小程序 `api/social.ts streamExplain()` 只发 `text` / `user_answer`，**不带 `question_id`**；main 小程序 `miniapp-native` 无问答页、0 处 `explain`。R484 SOP-04 的担忧「小程序若把时政 id 传进去服务端仍按 `questions` 取题」两层都不成立（不发 + 服务端 fail-closed）。
3. **服务端 `explain/stream` 是否补 module/source 兜底——论证后不立项**（§3）。
4. **(c) 补量 / 到期项**：R484 容器起后 kaogong 源站 103 请求全本机探针 + ClaudeBot 2 条 robots/sitemap；非探针 analysis/explain/POST 全 0；`时政且 qid 非空` 全表 0 / R484 后 0；到期项无增量。

## 1. 一手证据

### 1.1 服务端 `_linked()` fail-closed（源码 + 本地实跑）

`backend/app/engine.py:67-89`：`head = stem[:40]; if head not in _squash(text): return None`；`module not in kb.MODULES → None`。

本地 `python3`（生产 `questions.118` 题干「某部门要从甲、乙、丙、丁四人中选派两人出差…」为 row，时政 118「关于嫦娥七号任务突破的关键技术…」为 text）：

```
sz text + qid118 -> None
own text + qid118 -> 118
```

`ai_api.py:117-120` `_linked()` 为 None 时 `extracted = await engine.extract_question(...)`，meta `"qid": extracted.get("qid")` = None。

另核：缓存命中分支（`ai_api.py:127-139` `meta0`）**不带 `qid`**——所以端侧 `askQid(m.qid) || qid` 的回落对行测题是必要的（否则缓存命中的行测题「查看原题」丢 qid）。`explain_cache` 表有 `qid` 列（`save_explain_cache` 落 `meta.qid`），但 `meta0` 未回传。

### 1.2 小程序两端（只读 `origin/main` / `origin/devin/w7-mp-flat-v3`）

| 端 | `explain/stream` | `question_id` 随流提交 | 时政路径 |
|---|---|---|---|
| main `miniapp-native` | 0 处（README 只提功能） | — | 0 处 `_sz`/`shizheng` |
| W7 `api/social.ts:75-104 streamExplain()` | `streamPost({path:'/api/explain/stream', data:{text, user_answer?}})` | **无** | `pkgGrow/daily/daily.ts` 有 `_sz`；`logAttempts()` answer_log `qid: q.id \|\| null` 未守卫（R483 已登记）、mistakes `q._sz ? null : q.id` 已守卫；`pages/ask` 0 处 `qid`/`question_id` |

### 1.3 H5 `redoQid` 写入方全量（`grep -rn redoQid src`）

`practice.vue`（R484 已 `_sz` 守卫）、`book.vue` ×2（错题 `question_id`，时政行已全 NULL → `askQid(null)=0`）、`pkgA/exam/report.vue`、`pkgA/social/favorites.vue`、`pkgA/stats/practice-history.vue`、`pkgA/search/search.vue`——后四者数据源均为 `questions`。当前无时政 id 能到 `redoQid`。

### 1.4 (c) 补量（R484 容器 `2026-09-07T09:03:23Z` 起，09:18Z 读；`kaogong-origin.zalize.com-access.log`）

- 容器 healthy / restarts 0；app-log Traceback / locked / disk full 0；盘 4.1 G（92%）、load 0.37。
- 源站 103 请求：本机出口 `140.232.64.4/.2` 101（probe 头 67 + `sw.js`/curl/node），ClaudeBot `216.73.217.126` 2（robots.txt / sitemap.xml）；`/assets/*` 404 0、5xx 0、monitor 0、小程序 UA 0、`umst3` 0；POST 全带 `X-Kg-Probe`（answer_log 4 / mistakes 3 / track 1 / progress 1 = R484 §4 探针）；**非探针 POST 0、非探针 analysis / explain 0**。
- DB：`answer_log`/`mistakes` `module='时政' AND question_id IS NOT NULL` 全表 0 / R484 后 0；R484 后新行 = 探针 4 + 3（时政行 qid 全 NULL）；probe=0 33/1、growth 20/4、error_reason 7 / ≥09-11 0、push_subs 0、weekly 2、exam_attempts probe=0 1/64、`ask_cur` 5、WAL 4,124,152 B 同字节。
- **取证自纠**：首版脚本 glob `/var/log/caddy/*.log*` 把同宿主兄弟站点（storyboard/drama/vidgen/major/job 等）日志一并算进来，出现「`58.17.104.21` 1001 请求」假象；改回单文件后 kaogong 无此 IP。写进 SKILL。

## 2. 端侧剩余缺口（登记）

`ask.vue:623` `qid: askQid(m.qid) || qid`：服务端 meta `qid=None` 表示「未能按题干确认 qid」（qid 传错 / 题面被改 / module 不在 kb），端侧仍回落自带 `pendingQid`。要把它改成「只信服务端确认的 qid」，需先让缓存命中分支 `meta0` 回传 `hit.qid`（否则行测缓存命中丢 qid）——两侧各 1 行。**生产 0 例**（`ask_cur` 时政 0、非探针 explain 全文件 1 对且 qid 为行测），且源头已守卫 → 登记，不在本轮动。

## 3. 设计论证：服务端 `explain/stream` 要不要补 module/source 兜底

| 方案 | 代价 | 收益（按一手） | 判定 |
|---|---|---|---|
| A 协议加 `source`/`module` 字段，服务端 `foreign_module_qid` 同法置空 | 协议 + H5 + W7（不发 qid 也要改）三处；老客户端不发字段 → 只能默认放行 = 无兜底 | 发送方只有 H5 一处且源头已守卫；服务端 `_linked()` 已按题干 fail-closed，撞号 qid 喂不进提示 | **不立项** |
| B 服务端不信任 `question_id`，只当「候选」并要求题干命中（现状） | 0 | 已覆盖「喂错题」 | 现状即 B |
| C `meta0` 回传 `hit.qid` + 端侧去掉回落 | 2 行 | 关掉 §2 端侧缺口；0 生产例 | 登记，待有例再修 |

结论：服务端**已有**比 module 标记更强的兜底（题干逐字命中），补 module 字段是弱化版重复；不做。

## 4. 未验证 / 不宣称

- 小程序按源码只读核，未真机；W7 分支为 `origin/devin/w7-mp-flat-v3` 当前 HEAD。
- `_linked()` 实跑为本地 Python 直调 `extract_from_qbank`，未在生产提交 `explain/stream`（避免 LLM 流量）。
- 「不喂错题」只覆盖 `question_id` 路径；LLM 识题本身对时政题文可能给出行测 module（R422 路径），那是识题质量问题、不是撞号问题。
- 仍无可确认外部真人作答者；`probe=0` ≠ 真人。
