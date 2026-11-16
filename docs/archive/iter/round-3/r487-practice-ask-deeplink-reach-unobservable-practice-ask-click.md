# R487：非探针「练习页 → 问答页带 qid 深链」为何 0——入口可见、可达，但触达不可观测（6 个问答入口唯一无埋点 + `switchTab` 不改 Referer）→ 最小修：`practice_ask_click` 埋点

日期：2026-09-07（UTC 09:30–10:00）。生产 `7acf57b`（R484）→ `896007c`（本轮，见 §4.1）。

> **R490 勘误**：本文「6 个问答入口里 5 个有埋点、只有练习页没有」漏数了 `book.vue` 错题本**列表**展开卡的「AI 详解」（`redo(m)`，与复习模式 `askFromReview()` 是两个入口）：实际是 7 个写 `redoQid` 的入口、**2 个**无埋点（练习页 + 错题本列表）。生产唯一一次非探针带 qid 深链（`umsacie7` 09-05）走的正是后者，R490 已补 `book_ask_click`。见 `r490-sop10-book-list-ask-deeplink-only-natural-qid-entry-untracked.md` §3。

## 0. 结论

1. **入口可见性（源码）**：`practice.vue` 答题后的解析区里「用花生十三方法详解这道题 ›」**无条件渲染**（不依赖 `cur._sz` / `cur.hs_explanation` / `cur.explanation`，只要解析区出现就有），点击 `deepExplain()` → `setStorageSync('redoQuestion'/'redoQid'/'redoAnswer')` → `uni.switchTab('/pages/ask/ask')`。可见、可达，R484 已给时政加 `_sz` 守卫。
2. **触达为何在生产不可观测（一手 + 源码）**：
   - `switchTab` 是 SPA 内路由切换，问答页后续 `GET /api/ask/cur` / `/api/ask/sessions` 的 `Referer` 仍是首次进站 URL（`/`、`/s/<code>`）——Caddy 里 **0 条** ask API 的 referer 是练习页（本轮非探针 ask GET 的 referer 全是分享页/首页）。
   - 全产品 6 个问答入口里 5 个有 `*_ask_click` 埋点（search / review / report / fav / history），**只有练习页这个（用户最多的）没有** → `growth_events` probe=0 20 行 8 种事件里 0 条能证明练习页深链被点过。
   - 所以「`explain_cache.qid` 0/82」既不能归因为「没人点」也不能归因为「点了 qid 没带到」——**路径未被证明坏，也未被证明用过**。
3. **本轮唯一一对非探针 `explain/stream`（`umst3tuisd7lgzaka`，09-06 21:40Z）来自小程序**：Referer `https://servicewechat.com/wx01f2f29cfe51baba/0/page-frame.html`、UA `MicroMessenger/8.0.77 ... MiniProgramEnv/android`，appid 与 W7 `project.config.json` 一致；W7 `streamExplain()` 协议不带 `question_id`（R485）→ 这两行 `explain_cache.qid=NULL` 是**协议决定的**，不是 H5 深链丢 qid。题文=行测 `questions.296322`（shuliang / 排列组合与概率），该 uid 21:39:44Z 刚做过这题（answer_log 296322 错、mistakes 2923 `error_reason='纯蒙的'`）→ 小程序侧「练习 → 深链讲解」链路是通的，只是 qid 不上网络。
4. **最小修**（`896007c`）：`deepExplain()` 在 `switchTab` 前 `trackEvent('practice_ask_click', q.module || '', q._sz ? 'sz' : String(qid || ''))`；`/api/track` 白名单 +1；源锁 + 后端单测。`ref` 记 qid（时政记 `'sz'`，不放数字避免撞号）→ 下轮起可拿 `growth_events(practice_ask_click).ref` 与 `explain_cache.qid` 对账，「点了几次 / 带 qid 几次 / 落库带 qid 几次」三段可分。不改 explain 协议、不改缓存语义（R485/R486 登记项不动）。
5. (c) 补量 / 到期项：无增量（§2）。

## 1. 一手

### 1.1 入口 / 埋点盘点（源码 `7acf57b`）

| 问答入口 | 文件 | 埋点 | 到达方式 |
|---|---|---|---|
| 练习页「用花生十三方法详解这道题 ›」 | `pages/practice/practice.vue deepExplain()` | **无** | storage + `switchTab` |
| 搜索页 | `pkgA/.../search` | `search_ask_click` | storage + switchTab |
| 复习/错题 | book | `review_ask_click` | 同 |
| 纠错 | report | `report_ask_click` | 同 |
| 收藏 | fav | `fav_ask_click` | 同 |
| 历史 | history | `history_ask_click` | 同 |
| 问答页看原题 | ask | `ask_view_question` | — |

CTA 模板（`practice.vue`）：

```html
<view v-if="curAskSeen" class="deep seen" ... @click="openSeenAsk">回看 AI 详解 ›</view>
<view class="deep" @click="deepExplain">用花生十三方法详解这道题 ›</view>
```

无 `v-if` → 解析区出现即渲染。

### 1.2 Caddy（只读 `kaogong-origin.zalize.com-access.log`，`~/r487_host.sh` / `~/r487_db3.sh`）

```
非探针（排除 KG_PROBE 网段 / 本机 / bot UA）ask API 请求：
  umsagboriz4qyurnd  GET /api/share/fqpexz7g → GET /api/ask/cur, /api/ask/sessions ×N   referer=/s/fqpexz7g|/   未 POST explain
  umst3tuisd7lgzaka  GET /api/ask/cur, /api/ask/sessions 21:39:58Z → POST /api/explain/stream 21:40:44Z / 21:40:50Z 200
referer 含 /pages/practice 或 practice 的 ask 请求：0
POST /api/explain/stream 非探针：2（同上一对）
  ref= https://servicewechat.com/wx01f2f29cfe51baba/0/page-frame.html
  UA  ... MicroMessenger/8.0.77 ... WeChat/arm64 Weixin ... MiniProgramEnv/android
```

小程序出口时序（`~/r487_db4.sh`，相对首个请求秒）：answer/mistake 写入 → ask/cur+sessions @98.7 s → explain/stream @144.3 / 150.6 s（200，41.5 s / 41.7 s）→ POST ask/cur @162 s。

### 1.3 生产库（只读，`file:...data.db?mode=ro`）

```
growth_events probe=0 按事件：heatmap_view 6 / boot 3 / comeback_view 2 / reminder_optin 2 / review_entry_click 2 / share_copy 2 / share_open 2 / review_similar_auto 1
  → *_ask_click 任一种：0
explain_cache 09-06 21:40Z 两行：module=shuliang, question_type=数量关系-概率问题, qid=NULL, user_answer=A, len≈1007
  题文 = questions.296322（shuliang / 排列组合与概率）；不在 shizheng_questions
umst3 answer_log 09-06 21:39:05–21:39:21 时政 ×10（qid NULL）→ 21:39:44 296322 shuliang 错 A
umst3 mistakes 2914–2922 时政 qid NULL；2923 qid 296322 error_reason='纯蒙的'
umst3 growth_events：heatmap_view 21:37:55、share_copy(share_q,5tva43xd) 21:41:43 —— 无任何 ask 入口事件
```

### 1.4 W7 端契约（只读 `origin/devin/w7-mp-flat-v3`）

`pages/practice/practice.ts onDeepExplain()` → `utils/ask-prefill.ts openExplain({text, qid: q.id||null, answer})` → storage → `navigateTo('/pkgSocial/ask/ask')`；`api/social.ts streamExplain()` `data: { text, ...(userAnswer ? { user_answer } : {}) }` **不发 `question_id`**。qid 只留在本地 rec。（W7 `onDeepExplain` 也无 `_sz` 守卫，R483/R484 已登记待 W7 合 main 时补。）

## 2. (c) 补量 / 到期项（09:35Z，`~/r487_db3.sh` / `~/r487_db4.sh`）

```
container: healthy, restarts=0（09:03:23Z 起）
Caddy 新容器窗口 total 105 / 5xx 0 / assets404 0 / monitor 0 / mpUA 0 / 非探针非 bot 0
probe=0 answer_log 33/1 uid；growth 20/4；error_reason 7 / ≥09-11 0；push_subs 0；weekly 2；exam_attempts probe=0 1/64
时政且 qid 非空 answer_log/mistakes 0/0；explain_cache qid nonnull 0/82；umst3 last 09-06 21:39:44Z（0 回访）
WAL 4,124,152 B 同字节（sudo stat）；盘 / 92% 3.9 G（部署前 5.4 G）
app log Traceback 0
```

## 3. 判定

| 问题 | 证据 | 判定 |
|---|---|---|
| 练习页 CTA 是否渲染 / 可达 | 源码无 v-if，`deepExplain` → switchTab | 是（R484 CDP 375 一手也点过） |
| 有非探针用户练习后到过问答页？ | `umst3` 小程序端 21:39 作答 → 21:40 explain | 是，但是**小程序**，H5 练习页 → 问答页 0 证据 |
| Caddy Referer 能证明练习页来源？ | switchTab 不改 Referer，0 条 | 不能（结构性） |
| growth_events 能证明？ | 6 入口唯一无埋点 | 不能 → **可观测性缺口，修** |
| `explain_cache.qid` 0/82 = 路径坏？ | 唯一两行是 W7 协议不发 qid；H5 0 次到达 | **不能判坏**，也不能判好 |
| 是否改 explain 协议 / 缓存写 qid | R485/R486 论证不变，0 例 | 不动，登记项合并 |

## 4. 修法 / 门 / 发版

- `frontend-uni/src/pages/practice/practice.vue`：`deepExplain()` `switchTab` 前 +1 行 `trackEvent('practice_ask_click', q.module || '', q._sz ? 'sz' : String(qid || ''))`（`trackEvent` 已 import）。
- `backend/app/team.py`：`/api/track` 白名单 + `practice_ask_click`（`test_track_whitelist_sync` 前后端同步锁自动覆盖）。
- 源锁 `frontend-uni/tests/practice-r483-shizheng-qid.test.js` +1；后端 `backend/tests/test_track.py` +1（source/ref 落库形态）。
- 门：pytest **509**（+1）/ ruff 0 / pyright 0；vitest **724/724**（+1）/ eslint rc=0 / build:h5 绿（97 资源）。
- 发版：见 §4.1。

### 4.1 发版 + 改后一手

让行（R482 教训）：`/opt/SoftCopyrightAgent` `compose up -d --build` 09:45–09:50Z（盘 5.4 G → 4.0 G → 4.5 G，load 3–4.8），结束后再发；未 prune / 未 kill。

`DEPLOY_WAIT_SECS=1500 ./deploy/deploy_h5.sh --skip-build` 一次 rc=0（`~/r487_deploy.log`）：
- 4/6 `other_builds=0 prunes=0 disk_avail=4.5G`，新容器 `StartedAt 09:51:52Z`，线上后端 rev `896007c` = 本机；
- 5/6 线上 bundle `index-Dm-hobV2.js` 一次传播重试后一致，7 种 `Accept-Encoding` 变体全 JS；
- 6/6 7/7 200；
- 6b：`/tiku/` perf 1.00 / a11y 1.00 / LCP 1026；**`/` 第一次 Lighthouse 「运行失败」**（脚本内 `npx lighthouse` 非 0 退出，输出被 `>/dev/null`，原因未留痕），手动复跑三次 perf **0.57 / 0.88 / 0.93**、LCP 2751 / 2812 / 2738（≤3000 预算内，R443 口径的 Lantern 主峰）、CLS 0.06、a11y 1.00。本轮 `/` 只有 bundle hash 变化（首页 HTML/路由预加载结构不变、改动在 practice 分包），0.57 那次量测机 2 核 load ≈2（刚跑完 vitest/build + 部署脚本），历轮 `/` 分布 0.87–0.99 → 判为量测机噪音（推断，见 §5）。

改后一手（`~/r487_post.sh` → `~/r487_post.out`，09:58Z）：
```
线上 practice 分包 pages-practice-practice.Ll3wF6Ra.js 与本机 dist 逐字节一致；含
  practice_ask_click",e.module||"",e._sz?"sz":String(s||"")),n({url:"/pages/ask/ask"})
POST /api/track（X-Kg-Probe: 1）：
  {event:practice_ask_click, source:shuliang, ref:296322} → 200
  {event:practice_ask_click, source:时政, ref:sz}       → 200
  {event:not_whitelisted_xyz}                           → 400（白名单仍生效）
growth_events where event='practice_ask_click':
  (uprobe_r487_pac, shuliang, 296322, probe=1, 09:58:27Z)
  (uprobe_r487_pac, 时政, sz, probe=1, 09:58:27Z)
container healthy restarts=0；Traceback 0；新容器窗口 Caddy 63 请求 5xx 0 / assets404 0 / monitor 0 / mpUA 0 / 非探针非 bot 0
WAL 4,124,152 B 同字节；盘 3.3 G
probe=0 33/1、growth probe=0 20/4（探针行不计）、explain_cache qid 0/82、时政 qid 非空 0/0、error_reason ≥09-11 0
```

## 5. 如实说明

- 「入口可见」按源码 + R484 CDP 一手，本轮未再截图；未让 testing agent 录屏（未另行授权）。
- 未在生产提交 `explain/stream`（不造 LLM 流量）；埋点改后一手只验证 `/api/track practice_ask_click` 200 落库（探针 uid，probe=1），不验证问答页后续。
- `umst3` 归为「非探针」按当前三路归因口径，不升格「外部真人」。
- W7 端 `openExplain` 无 `_sz` 守卫 / 不发 `question_id` 只读源码核，未真机。
- 埋点只解决「有没有点、带没带 qid」，不解决「为什么没人点」；n 到手前不做产品判断。改后一手只有探针写入（probe=1 两行），埋点在真人流量上是否到达 = 0 样本，待观察。
- `/` Lighthouse 首跑「运行失败」的原因未留痕（脚本吞了 stderr），量测噪音判定为推断：三次复跑 LCP/CLS/a11y 都在预算内、首页结构未改；若下轮 `/` 再 <0.9 需单独取证（把 `perf-budget.sh` 的 lighthouse stderr 落文件）。
- 仍无可确认外部真人作答者、`WX_MINIAPP_SECRET` 未配、R385 第二冷样本未达标。
