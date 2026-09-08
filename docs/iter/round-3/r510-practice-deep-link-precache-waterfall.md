# R510：练习页直链冷启动客户端链一手拆解 → R387 head 预加载已覆盖 practice 分包（直链不串行）；命中的是「首页 → 练习」运行期预取链（清单字母序 + load 后 8 s）→ 清单前置主循环页分包 + 3 s

日期：2026-09-08（UTC 2026-09-07 21:0x–21:5x）。分支 `devin/1788816465-r510-precache-practice-first`（base=main，#639 已合入后新开）。生产 `e01e87be` → `f5223d72`（与分支 `34f67d3a` 同树，`git diff` 空）。

## 0. 起点

R509 登记：直链 `/#/pages/practice/practice?module=yanyu` Lighthouse LCP 4.4–4.6 s 而服务端 `questions` ≤151 ms，疑「主 bundle → practice 分包 → 挂载后才发 API」串行。本轮先量 waterfall 再定修法，不拍脑袋加 API 预取。

## 1. (c) 补量 + 到期项（发版前 `~/r510_pre.sh` → `~/r510_pre.out`，`~/r510_5xx.sh` → `.out`）

R509 容器（20:50:43Z 起，2074 请求）：healthy 0 重启；assets 404 0 / mpUA 0 / 非探针非 bot 0 / 非探针 POST 0 / monitor 0。**5xx 5 + Traceback 15**：全部是 21:18:34–51Z `140.232.64.4` UA `kg-w9-audit-probe`（兄弟 W9 审计会话，探针网段）对 `/api/exam/papers?year=99999999999999999999` / `/api/questions?…&year=…` / `/api/exam/papers/<20 位>` / `/api/question/<20 位>` / `/api/mock/events/<20 位>` 的边界探测 → `OverflowError: Python int too large to convert to SQLite INTEGER` → 500。**登记（不在 R510 改）**：路径/查询整数参数越过 SQLite INTEGER 范围时未校验直接下库，应为 400/404；归 W9 审计会话处置，本文只记一手。WAL 4,124,152 → 4,173,592 B（+49 KB）= 同一 W9 探针 `POST /api/profile`×2（`X-Kg-Probe: 1`、`python-requests`，`test-w9-a-*` / `test-w9-b-*` 两行 profile，`~/r510_prof.out`），**非真人**。

DB（`mode=ro`）：probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0。公告「详情」/`mistakes_total` 非探针触达：R509 发版后非探针产品请求 0 → 无样本。无新的外部真人证据。

## 2. 直链 waterfall（改前生产 `e01e87be`，`~/r510/waterfall.py 375 N direct` → `wf_375_direct.out` / `wf_direct2.out`，CDP 探针头、匿名新 uid、`Fetch` 域拦非 GET `/api/**`）

7 次（375）逐值：`index-*.js` 232–247 → 1637–1676 ms；**`pages-practice-practice.*.js` 211–247 ms 起请求、1165–1211 ms 完成**——与主 bundle**并行**、先于其完成；API 前资源 48 个；`GET profile` / `GET questions` 1788–1847 ms 发出（= 主 bundle 完成 + ~140 ms 挂载）；`questions` 回包 2054–2138；topbar/题干 2117–2188 ms；`pageerror []`。

结论：**R387 head 预加载已覆盖 practice 分包，直链不是「主 bundle → 分包」串行**；直链剩余可动项只有「API 在挂载前发」（要在 uni 挂载前拿 anonUid/module 并保证与页面 `useQuestions` 去重），R509 4.4 s 是 Lighthouse 4× CPU + 1.6 Mbps 节流下 48 个 API 前资源的体积效应。当前无外部真人直链样本（R509/R510 均非探针请求 0），**不改**，登记。

## 3. 首页 → 练习：命中运行期预取链

生产非探针 uid 首页停留后点进练习最短间隔 ≈8 s（R509 §2.2 口径）。`waterfall.py 375 N home <delay>`（首页停留 delay 秒后点模块 → sheet → 「全部随机」）改前生产：

| delay | `pages-practice` 分包请求→完成 | 点击→topbar | 点击后走网的 practice 依赖 |
|---|---|---|---|
| 8 s | 10926 → 11476 ms（**net**） | 1371 ms | 30 |
| 12 s | 14857 → 15418 ms（net） | 1376 ms | 30 |

源码一手：`src/precache.js` `load` 后 **8 s** + `requestIdleCallback` 才拉 `/precache.json`，然后**逐个** `fetch`；`scripts/gen-precache-manifest.mjs` 清单 = `assets/*.{js,css}` **字母序**（`pages-practice-*` 在第 90+ 位）。R387 的 head 预加载只注入进 HTML 的入口路由依赖，对「首页已加载后再进练习」无效。所以真人从首页 8–12 s 内点进练习时，practice 分包 + 22 个不与首页共享的依赖全部走网。

方法教训：首版 harness 用 Playwright `page.route("**/api/**")` 拦非 GET → Playwright 启用 routing 时**禁用 HTTP 缓存**，B 版反而更多请求；改 CDP `Fetch.enable`（`*/api/*`、Request 阶段，GET `continueRequest` / 非 GET `failRequest`）后缓存行为恢复。已入 SKILL。

## 4. 修（最小，2 文件 + 1 测试）

- `scripts/gen-precache-manifest.mjs`：复用 `route-preload.mjs` 的 `parseRouteDeps`/`ENTRY_ROUTES`，`PRECACHE_FIRST_ROUTES = ['pages/practice/practice','pages/book/book', ...ENTRY_ROUTES]`；`orderPrecache()` 把这些路由的依赖按顺序前置、其余按原字母序补齐（不丢不重，依赖表里不在产物中的路径不写入）。构建输出：`144 个资源写入 precache.json（入口路由依赖前置 73 个）`。
- `src/precache.js`：`PRECACHE_DELAY_MS = 3000`（原 8000）。守卫不变：省流/2g/离线跳过、同版本签名只跑一轮、`requestIdleCallback`。3 s 依据：首屏数据 + 题包预取在慢网 load 后 ~0.5 s 内完成，3 s 在其后、又早于最短点击间隔 8 s。
- 源锁 `tests/precache-r510-manifest-order.test.js` 4 例（前置顺序/不丢不重/不写入不存在路径/延迟常量 + 源码无 `8000`）。

不做：API 预取（§2）、布局/模块 token、新增 `lint-pages` script。

## 5. 本地同机 A/B（`~/r510/ab.sh` → `ab2.out` / `ab_1440.out`；A = `e01e87be` dist，B = HEAD dist；本机 `serve.py` 对 `/assets/` 回 `immutable` 缓存头、`/api/**` 转发生产 GET）

| 组 | delay | 分包请求→完成 | 点击→topbar | 点击后走网 practice 依赖 |
|---|---|---|---|---|
| A 375 | 8 | 13209 → 13961 net | 1606 / 1645 | 26 / 27 |
| **B 375** | 8 | **7445 → 7964**（load+3 s 时已入缓存） | **884 / 895** | **6 / 6**（全是清单尾部非练习资源） |
| A 375 | 12 | 17254 → 17962 net | 1542 / 1519 | 20 / 19 |
| **B 375** | 12 | 7338 → 7858 | **895 / 923** | 6 / 6 |
| A 1440 | 8 | 13266 → 13999 | 1606 | 26 |
| **B 1440** | 8 | 7489 → 8008 | **920** | 6 |

`assets_before_api` 46 / `questions` 时序 / 首屏 FCP 均 A=B → 3 s 预取未挤占首屏数据（`questions` 预取在 load 前已回包）。

## 6. 门 / 发版 / 复采

- 门：vitest 117 文件 828 例 / eslint / `lint:tokens`（design-tokens ok + lint-pages 0 error）/ H5 build / `git diff --check` 全绿；后端/native 未动。
- 发版 `--skip-build` rc=0（预检 mem_avail 312 MB / 5.0 G / load 0.99 / 兄弟构建 0）；容器 `21:26:33Z rev=f5223d72` healthy 0 重启；7/7 200；6b `/` perf 0.98 / a11y 1.00 / LCP 1889，`/tiku/` 1.00 / 932。线上 `precache.json` 144 项、首项 `pages-practice-practice.BCFFQUVJ.js`；线上 `index-CAa9sGqt.js` 含 `},3e3)`。
- 复采（改后生产，`~/r510/prod_after_home.out` / `prod_after_2.out`）：

| 视口 / delay | 分包请求→完成 | 点击→topbar | 点击后走网 practice 依赖 |
|---|---|---|---|
| 375 / 8 | 5273 → 5542（load 2135 + 3 s） | **934** | 0（6 = 清单尾部 contest/design/discuss css） |
| 375 / 12 | 5380 → 5654 | **921** | 0（5 = pkgA-exam/interview 分包） |
| 1440 / 8 | 5331 → 5600 | **962** | 0（6 同上） |
| 375 直链 | 245 → 1196（与 index.js 并行） | topbar 2116 | —（同改前 2117–2188，符合 §2 预期） |

直链 Lighthouse ×3（`~/r510/lh/lh_practice_r510.out`，mobile simulate）：LCP 4439/4382/4405、CLS 0×3、a11y 0.96（仅模块标签 `color-contrast`）、网络请求 66 个与 R509 改前/改后**完全相同**（trace 在 `observedLoad` 235–266 ms 后即止，`load+3 s` 的预取不在 trace 内）→ 直链 Lighthouse 读数不受本轮影响，符合 §2。FCP 2699/2671/2682 vs R509 改后 1598/1021/1661：R509 **改前**第 2 次也是 2690、`observedFCP` 128–160 ms 各次相同 → Lantern 模拟值双峰（1.0–1.6 / 2.7）是既有抖动，非本轮回归（如实登记，未定因）。

改前生产同 delay 点击→topbar 1371/1376 ms（§3，harness 尚为 `page.route` 版，缓存被禁 → 数值偏保守但方向一致）；本地 A（同 `e01e87be` 产物、缓存正常）1.5–1.6 s。`errs []`、`docSW==cw`、非 GET 全 abort、0 写入。发版后 (c)（`~/r510_post.sh` → `.out`）：新容器 86 请求 5xx/404/monitor/mpUA/非探针非 bot/非探针 POST/401·403/Traceback 全 0、WAL 同字节、harness uid 落库 0。

## 7. 登记

1. **直链 API 挂载前预发**：可动但无真人样本，待 SEO `/tiku/q/*` CTA / 分享深链出现非探针进入再立项；要点：与 `useQuestions` 去重、anonUid 一致、`source=seo_q` 归因不变。
2. **整数参数越界 500**（§1，W9 探针一手）：`year=`/路径 id 超 SQLite INTEGER 时 `OverflowError` 500，应 400/404；归 W9 审计。
3. 3 s 延迟只在本机/CDP 验证：真机弱网下 load 本身推后，`load+3 s` 相对位置不变，但未在真机量。
4. 清单尾部的 exam/interview/contest 资源仍在首页停留 ~10 s 后逐个拉取（约 70 个），流量 ~1 MB gzip；省流/2g 已跳过，不改。
5. 全部读数为本机 CDP/Lighthouse 采样，非真机 RUM；R509/R510 两轮非探针产品请求 0。
