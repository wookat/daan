# R492：错题本 AI 分析结果态只读整页审（空态/加载/失败可重试/结果卡，375/1440）——命中「成功结果按页面生命周期缓存、无任何重新生成入口」→ 最小修「按当前错题重新生成」（生产 `93ac35c` → `08a409d`）

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pages/book/book.vue`（结果态 `rich-text` 包进容器 + 1 个 `sheet-done ai-regen` 按钮；`aiAnalysis()` catch 分支「已有结果 → toast、无结果 → `aiErr`」；1 行样式）、源锁 `frontend-uni/tests/book-r492-ai-regen.test.js`（2 用例）。后端 0 改动，`/api/mistakes/analysis` 协议/限流/缓存语义不变。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量**（§1）：R491 容器（11:03:51Z 起）49 请求全本机/探针；非探针 POST / `mistakes/analysis` / `explain/stream` 0；`umst3` 0 回访；`book_ask_click`/`practice_ask_click` 真人 0 行（探针 3 行）→ `growth_events.ref ↔ explain_cache.qid` 对账**无真人样本、本轮做不了**；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；probe=0 33/1、growth 20/4；WAL 4,124,152 B 同字节。发版后（11:31:25Z 起）79 请求同口径全 0。
2. **AI 分析 sheet 一手量测（改前生产 bundle `index-DqW6coJg.js`，CDP 375×812 / 1440×900，`X-Kg-Probe: 1`，`/api/mistakes` 本地假数据、`/api/mistakes/analysis` 全部由路由 mock 应答、其它非 GET abort → 0 库写入、0 LLM 流量）**：入口条件 `todoItems.length >= 3` 两侧成立（0 待掌握隐藏、4 待掌握可见 337×77.9 / 「生成」56.6×44）；loading / 成功 / 502 失败 + 重试 / 空正文转失败 / 后端确定性「还没有待掌握的错题」文案 / 长文本 70vh 内滚动 / 关闭 40×40 / 375 让出 TabBar（sheet bottom 762 = tabbar top）/ 无横向溢出 / 成功后重开不重复请求 / 失败后重开重新请求 / 挂起中关闭重开不叠第二个请求——**全部通过**（§2）。R397/R398/R399 三轮修法在生产 bundle 上语义成立。
3. **命中（verified 两视口，源码 + CDP）**：`aiAnalysis(false)` 在 `this.aiHtml` 非空时直接 `return`，成功结果按**页面实例生命周期**缓存；错题本是 tab 页（`switchTab` 常驻不销毁），用户练完新题、错题本 `load()` 已刷成新列表，再点「AI 错题分析」看到的仍是旧结果，**sheet 内没有任何重新生成入口**（只有关闭），唯一刷新途径是整页 reload。改前 CDP：成功后关闭→重开 `/api/mistakes/analysis` 0 次新请求且 DOM 里无 `.ai-regen`/任何按钮（§2 `reopen_calls`）。与本产品闭环「练习 → 错题 → 复习 → 掌握」直接冲突：分析的输入（`mistake_analysis_stats` 只看 `mastered=0` + 近 7 天作答）在一次会话内就会变，输出却冻结。
4. **修法（最小，纯前端，§3）**：结果态 `<view v-else><rich-text :nodes="aiHtml"/><view class="sheet-done ai-regen" @click="aiAnalysis(true)">按当前错题重新生成</view></view>`——复用已有的 `retry === true` 绕缓存分支，不新增状态；`ai-regen` 用 `--brand-soft` 二级色与失败态主色「重试」区分。catch 分支：`if (this.aiHtml) uni.showToast('重新生成失败：…')` 保留旧结果可读，`else this.aiErr = …` 首次失败仍走 R398 失败态。**不做**「列表变化自动失效」（会让每次重开都打 LLM）、**不改**后端（`rl(…, 10, 300)` 每 uid 5 分钟 10 次仍是上限）。
5. **改后一手（本地 dist `http.server` 同脚本 → 发版 → 生产 375/1440 同脚本，三点数值一致，§4）**：结果态出现 `按当前错题重新生成` 333.1×41.1（375）/ 1029×42（1440），`x±19/y±19` 命中通过；点它 → loading 态（旧结果暂隐）→ mock 502 → **toast「重新生成失败：AI 服务连接失败…」+ 旧结果原样回显**（`h2` 三节仍在、无 `.ai-err`）；再点 → mock 长文本 → 新结果替换（`h2` 17 节、`scrollHeight 5281/3156`），全程 `/api/mistakes/analysis` 恰 2 次。其它 18 项与改前逐项相同。
6. **顺带核过不命中 / 登记**：① 入口阈值 `>= 3` 与后端 `mistake_types` 非空（≥1）不一致——生产 `mistakes` 待掌握 1–2 条的 uid 48 个、≥3 条的 24 个（含探针，`mistakes` 表无 `probe` 列不能分），即 2/3 有错题的账号看不到入口；阈值来源为产品取舍（少于 3 题的「分布」无统计意义），登记不改。② 1440 下 `.mask` 只盖 `left ≥ 288`（`.bookwrap` 内），左侧导航仍可点、切走再切回 sheet 仍开——与 R479/R491 已审的桌面抽屉同形态，非本轮新增。③ 375 视口 sheet 实宽 360（滚动条 15 px），R491 同。

## 1. (c) 补量 / 到期项

### 1.1 `~/r492_post.sh`（远端 payload，`ssh … bash -s <`）→ 改前 11:15Z `~/r492_post.out` / 改后 11:36Z `~/r492_post2.out`

```
改前：healthy restarts=0 started=2026-09-07T11:03:51.871576433Z（R491）  disk 3.7G  load 0.96  WAL 4,124,152 B
      caddy since start 49  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  Traceback 0
改后：healthy restarts=0 started=2026-09-07T11:31:25.998167336Z（R492）  disk 3.4G  load 0.32  WAL 同字节
      caddy since start 79  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0  trackPOST 0  Traceback 0
两次同：growth *_ask_click by probe [book 1/1, practice 1/2, search 1/1] 全探针  probe=0 answer_log 33/1  growth probe=0 20/4
        explain_cache qid 0/82（qid rows []）  时政且 qid 非空 answer_log 0 / mistakes 0  error_reason ≥09-11 0  umst3 since start 0
        non-probe mistakes/analysis 全历史 4（09-06 21:41–21:42Z 39.158.40.85 小程序 UA，R477/R490 已归 W7）  non-probe explain/stream 全历史 3
        uids 待掌握 ≥3：24  待掌握 1–2：48（mistakes 无 probe 列，含探针）
```

取证自纠：首版补量 SQL 写了 `mistakes where probe=0 or probe is null` → `no such column: probe`（`mistakes` 表无该列，探针归因在 `answer_log`/`growth_events`），改为不分探针的分组计数并把 `pragma table_info(mistakes)` 打出来备查。另：`r492_post.sh` 是远端 payload，直接本机 `bash` 会对本机 docker 报 `no such object`、`df` 读到本机 70G——已发生一次，数据未采用。

### 1.2 非探针触达

`/api/mistakes/analysis` 全历史非探针 4 次全部为 W7 小程序 `umst3…`（R477 single-flight 取证同一批），**H5 `book.vue` 这条路径非探针 0 次**；R492 命中的「结果冻结」在真实流量上尚未被走到（可达未触发，R484/R491 同性质）。

## 2. AI 分析 sheet 一手量测（改前生产 bundle，`~/r492_ai.py` → `~/r492_ai_375.out` / `~/r492_ai_1440.out`）

方法：CDP 新 context（`X-Kg-Probe: 1`），先进 `/` 拿 uid；`ctx.route('**/api/**')`：`GET /api/mistakes?…` 回 4 条本地占位错题（`id 9000xx`、`question_id 0`、`mastered 0`）或 `[]`；`GET /api/review?…` 回空；`POST /api/mistakes/analysis` 按模式应答 `ok`（短 Markdown，1.5 s）/ `fail`（502 `{detail}`）/ `empty`（`{"analysis":"   "}`）/ `nopending`（后端确定性文案）/ `long`（14 段）/ `hang`（不应答）；其它非 GET abort（唯一被 abort 的是 `POST /api/track boot`）。**生产后端未收到任何 analysis 请求**（Caddy 改前窗口 `non-probe non-bot 0`、探针 POST 仅 track）。

| 项 | 375×812 | 1440×900 | 判 |
|---|---|---|---|
| 0 待掌握：`.redoentry` 数量 | 0（空态可见） | 0 | 通过 |
| 4 待掌握：AI 入口 | 337×77.9，`y±19/x±19` 命中 | 320×82（右栏 `bk-side` l 956.5） | 通过 |
| 「生成」按钮 | 56.6×44 | 59×44 | 通过（≥40） |
| loading：sheet h / bottom / tabbar top | 144.8 / 762 / 762 | 151 / 900 / — | 通过（让出 TabBar） |
| 成功：sheet h / `h2` / 文本横向溢出 | 369.7 / 3 节 / `docSW 360 = vw−15` | 346.5（w 1057）/ 3 节 / 无 | 通过 |
| 关闭 `.sheet-x` | 40×40 | 40×40 | 通过 |
| 点遮罩关闭 / 重开 | 关闭 ✓ / 重开 0 次新请求、旧结果 | 同 | 通过（R398 缓存语义）；**但无重新生成入口 → §3** |
| 失败 502：`ai-err-t` + `重试` | 「分析失败：AI 服务连接失败…」/ 333.1×41.1 | 1029×42 | 通过 |
| 失败后关闭重开 | 重新请求（`fail_reopen_calls` 2） | 同 | 通过（R398 不缓存失败） |
| 重试 → 成功 | loading → 3 节结果 | 同 | 通过 |
| 空正文 `"   "` | 转「AI 未返回内容，请稍后再试」+ 重试 | 同 | 通过（R397 语义） |
| 后端「还没有待掌握的错题」 | 文案原样 rich-text | 同 | 通过 |
| 长文本：sheet h / `scrollHeight` / `clientHeight` / `scrollTop` max | 568.4（=70vh）/ 5224 / 568 / 4656 | 630 / 3098 / 630 / 2468 | 通过（`overflow-y:auto`） |
| 挂起中关闭再开 | loading 保持、`hang_calls` 1 | 同 | 通过（`aiLoading` 单飞） |

截图（生产改后覆盖同名，改前数值以 `.out` 为准）：`~/r492_ai_{entry,loading,ok,fail,nopending,long}_{375,1440}.png`。

取证自纠：首版点 `.mask` 用默认中心点被 `.uni-page-head` 拦截超时，改 `position={x:20,y:120}`（`elementFromPoint` 先核该点确为 `.mask`）。

## 3. 命中与修法

源码（改前）：

```js
async aiAnalysis(retry) {
  this.aiOpen = true;
  if (this.aiLoading || (this.aiHtml && retry !== true)) return;   // 成功结果 → 直接返回
  …
}
```

```vue
<view v-if="aiLoading" class="ai-loading">…</view>
<view v-else-if="aiErr" class="ai-err">…<view class="sheet-done" @click="aiAnalysis(true)">重试</view></view>
<rich-text v-else :nodes="aiHtml" />          <!-- 结果态：只有正文，无按钮 -->
```

`retry === true` 分支只有失败态「重试」在用；成功态没有任何调用点能带 `true` 进来。`book.vue` 为 tabBar 页（`pages.json`），`onShow → load()` 每次切回都刷新 `items`（错题被掌握/新增），`aiHtml` 不随之失效。R398 引入「成功缓存」是为了避免重开就打一次 30–60 s 的 LLM，方向正确，但缺了显式刷新口。

修（`08a409d`）：

```vue
<view v-else>
  <rich-text :nodes="aiHtml" />
  <view class="sheet-done ai-regen" role="button" @click="aiAnalysis(true)">按当前错题重新生成</view>
</view>
```

```js
} catch (e) {
  if (this.aiHtml) uni.showToast({ title: '重新生成失败：' + (e.message || '请稍后重试'), icon: 'none' });
  else this.aiErr = e.message || '请稍后重试';
}
```

```css
.ai-regen { background: var(--brand-soft); color: var(--brand-text); }
```

为何 catch 要分叉：不分叉时重生成失败会置 `aiErr`，模板 `v-else-if="aiErr"` 优先级高于结果态，旧结果虽在内存里但用户再也看不到（关闭重开也因 `aiHtml` 非空直接 return 到 `aiErr` 视图）——本地 dist 预检前按源码推出、改后 CDP 验证 toast 路径旧结果回显。源锁 `tests/book-r492-ai-regen.test.js`：结果态容器内必有 `sheet-done ai-regen` → `aiAnalysis(true)`；catch 必为 `if (this.aiHtml) uni.showToast(...'重新生成失败：'` / `else this.aiErr = e.message`。R398 既有源锁（`v-else-if="aiErr"…重试`、`this.aiErr = e.message`、不 `md('分析失败`）不变。

门：vitest 730/730（+2）、eslint rc=0、`build:h5` 绿；pytest 510 / ruff / pyright 0（后端未改，照跑）。

## 4. 发版 + 改后一手

- 发版前宿主：无兄弟 `compose up --build`（`softcopyright:prod` 3 min 前刚建完）、盘 3.9 G、load 1.08 → `./deploy/deploy_h5.sh --skip-build` 一次 rc=0（`~/r492_deploy.log`）：rev 一致、bundle `index-DetvGgWg.js` gzip 126 KB、7/7 200、perf `/` 0.99·1.00·1.00·1.00 LCP 927 / `/tiku/` 1.00·1.00·1.00·1.00 LCP 937。容器 `StartedAt 2026-09-07T11:31:25.998Z` healthy 0 重启。
- 分包校验：`pages-book-book.Bz_ypnQd.js` 线上 md5 `1c115d87…` = 本机，且含 `按当前错题重新生成` 字面。
- 三点对照（同一 `~/r492_ai.py`，新增 7b 段；本地 `R492_BASE=http://localhost:8765` → `~/r492_ai_local_375.out`；生产 → `~/r492_ai_prod_{375,1440}.out`，截图 `~/r492_ai_regen_{375,1440}.png`）：

| 项 | 本地 dist 375 | 生产 375 | 生产 1440 |
|---|---|---|---|
| `.ai-regen` 几何 / 命中 | 333.1×41.1 / ✓ | 333.1×41.1 / ✓ | 1029×42 / ✓ |
| 点 regen → loading（sheet h / bottom） | 144.8 / 762 | 144.8 / 762 | 151 / 900 |
| regen mock 502 → toast / 旧结果 | 「重新生成失败：AI 服务连接失败…」/ `h2` 3 节、`.ai-err` 无 | 同 | 同 |
| 再点 regen → 长文本 | `h2` 17 节、`sh 5281 / ch 568` | 同 | `h2` 17 节、`sh 3156 / ch 630` |
| analysis 请求次数 | 2（fail, long） | 2 | 2 |
| 其余 18 项（§2） | 与改前一致 | 与改前一致 | 与改前一致 |

## 5. 如实说明

- CDP 仿真非真机；`/api/mistakes/analysis` 全程 mock，本轮**未向生产 LLM 发过一次请求**，「30–60 s 真实耗时下的 loading 体验」未测（R397–R399 有历史样本）。
- 修的是真实流量 0 次触发的路径（H5 非探针 analysis 0 次）；命中依据是源码分支 + 改前 CDP「重开 0 请求且无按钮」两条一手，「用户会在一次会话内练题后回看分析」为产品闭环推断。
- 入口阈值 `>=3` 的 48 vs 24 计数含探针 uid，只作量级参考。
- `r492_post.sh` 误在本机执行一次（数据弃用）；截图改前版被生产改后同名覆盖，改前以 `.out` 为准（R491 同教训，已写 SKILL）。
- 无 testing agent 录屏（未另行授权）。
