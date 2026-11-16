# R491：问答页会话/历史 sheet 只读整页审（空态/切换/删除/失败态，375/1440）——命中「删除正在查看的会话后被新对话/切换会话重新归档复活」→ 最小修 `clearCurrent()`（生产 `a8ceca8` → `93ac35c`）

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/ask/ask.vue`（`newSession()` 拆出 `clearCurrent()` 复用 + `delSession()` 1 行判定）、源锁 `frontend-uni/tests/ask-r491-del-current-session.test.js`（2 用例）。后端 0 改动。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量**（§1）：R490 容器（10:37:53Z 起）34 请求全本机/探针；非探针 POST / `mistakes/analysis` / `explain/stream` 0；`umst3tuisd7lgzaka` 0 回访；`book_ask_click` 真人 0 行（仅 R490 探针 1 行）、`practice_ask_click` 仍只 R487 探针 2 行 → `growth_events.ref ↔ explain_cache.qid` 对账**无真人样本、本轮做不了**；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；probe=0 33/1、growth 20/4；WAL 4,124,152 B 同字节。
2. **历史 sheet 一手量测（生产 bundle `index-DR7w8z1H.js`，CDP 375×812 / 1440×900，`X-Kg-Probe: 1`，全部 `/api/**` 本地 mock/abort → 0 库写入、0 LLM 流量）**：空态文案/几何正常；列表行 54.8 px、`删除` 44×30.7 px（375）/ 44×32 px（1440）、关闭 40×40；长标题 `scrollWidth 431 > clientWidth 251` + `ellipsis/nowrap` 生效；切换会话写 `askCurSid`；DELETE 503 失败态墓碑保留、刷新后远端仍返回该会话被过滤 + DELETE 重试——R330 语义成立（§2）。
3. **命中（verified，改前生产 bundle 375/1440 两次复现）**：在历史 sheet 里删除**正在查看**的会话 A（`curSid === A.id`）→ 行即时消失、DELETE 200、墓碑清掉，但结果区仍显示 A、`askCurSid` 仍 = A；随后点「新对话」→ `archiveCurrent()` 用同一 sid 重新归档 → **本机列表 A 复活 + `POST /api/ask/sessions sid=A`**（服务端也复活）；切到会话 B 同样触发 `archiveCurrent()` 复活。R329（查看不销毁、同 sid 回写）与 R330（显式删除 + 墓碑；「同 sid 再归档视为撤销删除」）两条设计各自成立，但二者交叉的「删的是当前会话」这条路径没人接——与 R330「删除即终态」目标矛盾（§3）。
4. **修法（最小，纯前端）**：`newSession()` 的清空段抽成 `clearCurrent()`（`results=[]`、`error=''`、清 `askCurSession`/`askCurSid`、`curSid=0`、`_curCleared=true`、取消 `_curPushT`、`POST /api/ask/cur items:[]`）；`delSession(i)` 在 `dropRemoteSession` 后 `if (s.id === (this.curSid || Number(uni.getStorageSync('askCurSid')) || 0)) this.clearCurrent();`。不改 `archiveCurrent()` 去墓碑语义（跨设备「另一台删了、这台还在看」仍按 R330 登记为服务端侧局限）。
5. **改后一手（本地 dist 起 `http.server` 同脚本 + 发版后生产 375/1440 同脚本）**：删 A → 结果区清空、`askCurSid` null、多出 `POST /api/ask/cur items:[]`、「新对话」按钮随 results 消失；切到 B → `askSessions` 仍只 `[1002]`、**0 条 `POST /api/ask/sessions`**；失败态/墓碑/刷新过滤/重试与改前一致（§4）。
6. **顺带核过不命中 / 登记**：`删除` 宽 30.7 px（375）且无二次确认——`x±19` 命中失败但 R479 口径按 `min-height 44` 已过；错题本删除有 `showModal` 确认、问答历史没有，属设计取舍（R330 明写「即时移除」），生产非探针 `POST/DELETE /api/ask/sessions` 全历史 **0 条**（§1.2）无样本 → 登记不改。1440 下 sheet 仍是贴底整宽 1057 px 的移动式底部抽屉（R479 已审过、非本轮新增）。

## 1. (c) 补量 / 到期项

### 1.1 `~/r490_post.sh` → 改前 10:53Z（`~/r491_post0.out`，见对话记录）/ 改后 11:06Z `~/r491_post.out`

```
改前：healthy restarts=0 started=2026-09-07T10:37:53Z（R490）  disk 2.5G  load 2.52  WAL 4,124,152 B
      caddy since start 34  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  trackPOST 4 [403,403,200,400]
改后：healthy restarts=0 started=2026-09-07T11:03:51.871576433Z（R491）  disk 3.4G  load 0.99  WAL 同字节
      caddy since start 49  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  trackPOST 0
两次同：practice_ask_click|book_ask_click 真人 0（探针 3 行）  probe=0 answer_log 33/1  growth probe=0 20/4
        explain_cache qid 0/82  时政且 qid 非空 0/0  error_reason ≥09-11 0  app log Traceback/locked/full 0
```

`rev=` 一行为空是脚本用 `docker exec … printenv` 取值、镜像不注该变量（历轮同），rev 以 `/api/health` `{"ok":true,"rev":"93ac35c"}` 为准。

### 1.2 会话/历史接口全历史（Caddy `kaogong-origin.zalize.com-access*` 全部文件，`~/r491_caddy2.sh` → `~/r491_caddy2.out`）

`/api/ask/sessions` + `/api/ask/cur` 共 630 次请求，剔除探针头 / 探针网段 / Headless UA / `test-r*`、`uprobe*`、`umr4*` uid / curl 后 **非探针 20 次**：`GET sessions` 9、`GET cur` 9、`POST cur` 2（`umsacie7` 09-05 17:07:22Z H5、`umst3` 09-06 21:41:02Z W7 小程序）；**`POST/DELETE /api/ask/sessions` 非探针 0 条**。uid 分布 `umsagboriz` 12（TabBar 来回切、0 提交）/ `umsacie7` 4 / `umst3` 2。DB：`ask_sessions` 全表 1 行（`umtpnlge…` 探针）；`ask_cur` 5 行。→ 历史 sheet 的归档/删除在真实流量上**从未被走到**，本轮命中是「可达未触发」的缺陷（与 R484 同性质），不是事故。

注意首版按 `remote_ip` 判探针网段无效——源站日志的 `remote_ip` 是 Cloudflare 边缘 IP（104.23.* / 172.68.*），真实来源要取 `Cf-Connecting-Ip` 头。

## 2. 历史 sheet 一手量测（改前生产 bundle，`~/r491_hist.py` → `~/r491_hist_375.out` / `~/r491_hist_1440.out`，截图 `~/r491_hist_{empty,list,loadedA,delA,afternew}_{375,1440}.png`）

方法：CDP 新 context（`X-Kg-Probe: 1`），先进 `/` 拿 uid，`localStorage` 以 uni 包裹格式写入两条本地占位会话（A 长标题 n=1、B n=2，items `explain_key: r491-local-only`），`ctx.route('**/api/**')`：`GET /api/ask/*` 回 `{items:[]}`/`{}`、`POST/DELETE /api/ask/*` 记录后回 200（失败态改回 503）、其它非 GET 全部 abort（唯一被 abort 的是 `POST /api/track boot`）。

| 项 | 375×812 | 1440×900 | 判 |
|---|---|---|---|
| 空态 | `还没有历史会话` + 说明句；sheet 138.8×360，`mask` 底 762 = 让出 TabBar 50 px | 123.4×1057，`mask` 底 = 900 | 通过 |
| 列表行 `.rec-row` | 54.8 / 53.8 px 高，y±19/x±19 命中 | 同 | 通过 |
| `删除 .rec-del` | **44×30.7**，fs 11.52 px，y±19 ✓ / x±19 ✗ | 44×32，fs 12 px | 登记（§0.6） |
| 关闭 `.sheet-x` | 40×40（R479） | 同 | 通过 |
| 长标题 | `sw 431 > cw 251`，`text-overflow: ellipsis` + `nowrap` | 全显 | 通过 |
| 序号/meta | `1`/`2`，`1 次问答 · 9/6 13:06` | 同 | 通过 |
| 切换（点 A） | sheet 关、结果区出 A 题干 + 讲解、`askCurSid={type:number,data:1001}`、顶栏 `历史`+`新对话` | 同 | 通过 |
| 删除 A（正在看） | 行消失、`DELETE /api/ask/sessions/1001` 200、墓碑 `{}`；**结果区仍显示 A、`askCurSid` 仍 1001** | 同 | **命中** |
| 新对话 | `POST /api/ask/sessions sid=1001`（A 复活）+ `POST /api/ask/cur []`；本机 `askSessions=[1001,1002]`；再开 sheet 两行 | 同 | **命中** |
| 删除 B + DELETE 503 | 行即时消失、墓碑 `{1002: ts}` 保留 | 同 | 通过 |
| 刷新、远端 GET 返回 B | sheet 无 B（`filterTombstoned`）、`DELETE /1002` 重试一次、墓碑保留 | 同 | 通过（R330） |

复活后 A 的标题从原「R491 占位会话 A：这是一个很长…」变成 `R491 占位会话 A 题干`（`archiveCurrent()` 按 `userText` 重算 30 字）——同一 sid 内容被改写，用户视角是「删掉的东西换个名字回来了」。

## 3. 根因（源码，改前 `a8ceca8`）

```js
loadSession(i)   → archiveCurrent(); curSid = s.id; setStorageSync('askCurSid', s.id); results = adoptItems(s.items)   // R329
delSession(i)    → sessions.splice; addTombstone(s.id); dropRemoteSession(s.id)                                         // R330，不碰 results/curSid
newSession()     → archiveCurrent(); results=[]; curSid=0; …                                                              // 归档在前
archiveCurrent() → sid = curSid || askCurSid || Date.now(); removeTombstone(sid); upsertLocalSession; POST /api/ask/sessions
```

删 A 时 `results`/`curSid` 原样保留 → 任何后续 `archiveCurrent()`（新对话 / 切换 / 页面 onHide 若有）都用 A 的 sid 回写并**主动摘掉 A 的墓碑**（R330 把「同 sid 再归档」定义为撤销删除，前提是用户显式重建了它——这里用户只按了新对话）。W7 小程序无历史 sheet（R485：无问答页），不在影响面内。

## 4. 修与验证

- 源码：`ask.vue` `clearCurrent()`（原 `newSession()` 清空段原文搬出，无新逻辑）+ `delSession()` 末行判定；`curSid` 为 0 时兜底读 `askCurSid`（刷新后 `curSid` 由 data 初始化为 0、sid 只在 storage 里，与 `archiveCurrent()` 取 sid 的口径一致）。
- 源锁：`tests/ask-r491-del-current-session.test.js`——`delSession` 必含该判定行；`clearCurrent` 必含五项清理 + 推空 `ask/cur`；`newSession` 必复用 `clearCurrent`。
- 本地门：vitest 728/728（+2）、eslint rc=0、`build:h5` 绿；后端未改仍跑 pytest 510 / ruff / pyright 0。
- 改后本地：`dist/build/h5` 起 `python3 -m http.server 8491`，`R491_BASE=http://localhost:8491` 同脚本（§2 方法）→ `~/r491_hist_375_local.out`：删 A → `stillShowingA:false`、`askCurSid:null`、calls `DELETE /1001` + `POST /api/ask/cur []`；「新对话」按钮不存在（results 空）→ 改走切换 B 路径：`askSessions=[1002]`、`after_new_calls=[]`（0 条 `POST sessions`）；B 失败态/刷新过滤/重试同改前。
- 发版（`~/r491_deploy.log`）：发前 `pgrep compose up --build` 兄弟 `pip install` 进行中（盘 2.6 G / load 3.2），等其退出（约 2 min）后 `--skip-build` 一次 rc=0；`compose-started` 11:02:32Z → 容器 `StartedAt 2026-09-07T11:03:51.871576433Z` `KG_COMPOSE_EXIT rc=0`；`/api/health rev=93ac35c`；bundle `index-DqW6coJg.js`、`pages-ask-ask.9GiTFO19.js` 线上 md5 = 本机 `f427cb6d…`；7/7 200；perf `/` 0.97·a11y 1.00·LCP 1674 / `/tiku/` 1.00·1.00·955。
- 改后生产（`~/r491_hist_375_post.out` / `~/r491_hist_1440_post.out`）：两视口与本地一致——删当前会话即清空、`POST /api/ask/cur []`、切换 B 后 0 条 `POST sessions`、`askSessions=[1002]`；失败态墓碑 `{1002}` 保留 + 刷新重试。全程 `all_nonget_calls=8` 全被 mock/abort，Caddy 容器起后 49 请求全本机、`ask_sessions` 仍 1 行。

## 5. 登记 / 不做

- `删除` 30.7 px 宽 + 无确认（§0.6）：待非探针 `DELETE /api/ask/sessions` 首条出现后再看是否要 `min-width` 或 `showModal`。
- 跨设备：另一台删了 sid X、这台仍在看 X 并追问 → 归档回写 X 复活——R330 已登记的服务端侧局限，本轮不动。
- `archiveCurrent()` 的 `removeTombstone(sid)`：修后当前会话不可能带墓碑（删即清），保留不动。

## 6. 如实

- 生产 bundle 与 dist 两套量测都是 Chrome CDP 仿真视口非真机；`.rec-row`/`.rec-brief` 在结果区「最近讲解」也有同名 class，脚本中 `rows`/`briefs` 计数含结果区元素（`after_del_A.rows=2` 里 1 行是结果区），判定看 `.sheet` 内 `.rec-del` 数与 `askSessions` 内容。
- 命中路径在生产真实流量上 0 次发生（§1.2），修的是可达未触发的路径；未提交 `explain/stream`（不造 LLM 流量）；无 testing agent 录屏（未另行授权）。
- 仍无可确认外部真人完成「练习→作答→错题→复习→掌握」闭环的证据；`umsacie7`/`umst3` 身份不确定。
