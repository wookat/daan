# R509：练习页首题冷启动 375/1440 一手量（几何全过）→ 命中 a11y「禁用主按钮对辅助技术不可见」→ `kg-button` 显式 `aria-disabled`

日期：2026-09-08（UTC 2026-09-07 20:3x–20:5x）。分支 `devin/1788811123-r507-home-lcp-announce-contrast`（PR #639，与 R507/R508 同 PR）。生产 `77bd47b5` → `e01e87be`。

## 0. 起点

R508 后首页 CLS 只剩 Tabbar `::after` 0.061（预算内），Lighthouse 四项回 R505b 水平。按四维回真人有量路径：`pages/practice` 首题冷启动（题干/选项/解析）加载态与回包后位移，375/1440 CDP 一手量，命中才改。

## 1. (c) 补量 + 到期项（发版前，`~/r509_pre.sh` → `~/r509_pre.out`）

R508 容器（20:27:52Z 起）：healthy 0 重启；5xx 0 / assets 404 0 / mpUA 0 / 非探针非 bot **0** / 非探针 POST 0 / 401·403 0 / Traceback 0；monitor 1 = R508 发版 6b Lighthouse（探针网段）。WAL 4,124,152 B 同字节。DB（`mode=ro`）：probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click`/nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0；profile 已过/今天/未来 1/0/8。

公告「详情」非探针点击 / `mistakes_total` 非探针触达：R508 发版后**非探针请求 0** → 两项都无样本（「详情」是纯前端展开、不发请求；`mistakes_total` 走 `home_bundle`，全历史非探针 `home_bundle` 35 次全在 R503 发版前）。无新的外部真人证据。

## 2. 量（改前生产 `77bd47b5`）

方法：CDP 接现有 Chrome，探针头 `X-Kg-Probe: 1`、注入匿名新 `anonUid`、非 GET `/api/**` 全 abort（0 账号 0 库写入 0 LLM）。

### 2.1 直接冷启动 `/#/pages/practice/practice?module=yanyu`（`~/r509_practice_cold.py` → `~/r509_practice_{375,1440}.out`）

harness hold 住 `GET /api/questions` 量骨架 T0（0.8 s）与 T0b（3.8 s，触发「稍慢」提示），放行后量首题 T1。**「题库首次加载稍慢…（3秒）」是 hold 造出来的**，生产服务端 `questions` 17–151 ms（`~/r509_qdur.out`），不是时延读数。

| 视口 | T0 `.pskel` | 内 `kg-skel--lines` / 提示 / 返回按钮 | T0b 提示文案 | T1 topbar | T1 题干 `.kg-q__stem` | 选项组 | 底栏 |
|---|---|---|---|---|---|---|---|
| 375 | [16,60] 343×195 | 343×116 / 「出题中…」52×19 / 64×36 | 「题库首次加载稍慢，请稍候…（3秒）」216×19（同高、同 top 188） | [16,60] 343×44 | [33,165] 309×178.5 | 4 项 [33,344] 309×259.6 | [0,731] 375×69 |
| 1440 | [297,60] 1040×195 | 1040×116 / 同 / 同 | 同 | [297,60] 696×44 | [314,165] 662×51 | 同结构 | 底栏 |

`docSW==cw`（375 / 1425）、`pageerror []`、请求仅 `GET profile` / `GET questions` / `POST track`（abort）。骨架 195 与首题卡不是等高（首题卡随题干长度变），但骨架→首题是**整块替换**、上方 topbar 位置不变（60）；Lighthouse 三次 CLS 均 0、`layout-shift` items 空（§2.3），所以不做等高。

### 2.2 正常路径：首页 → 模块 → sheet → 「全部随机」（`~/r509_home_to_practice.py` → `~/r509_home2practice_{375,1440}.out`；`~/r509_sheet_375.py`）

首页挂载 0.28–0.34 s 即 `GET questions?limit=10&uid=…`（预取题包）；点模块 → sheet 可见 0.138 / 0.152 s，7 个子模块 chip（全部随机 18294 / 逻辑填空 6260 / 中心理解 5727 / 语句表达 3624 / 细节理解 2540 / 标题填入 122 / 篇章阅读 12）；点「全部随机」→ topbar 0.158 / 0.128 s，**`skel_seen []`**（预取命中、根本不出骨架）；首题几何与 §2.1 T1 逐值相同。375×667 短屏 sheet：`kg-sheet__body` 383.8 高 `overflow:auto`，第 7 chip 在 body 外靶可滚。`docSW==cw`、errs []。

结论：真人从首页进练习页看不到骨架；骨架只在直链/深链（SEO `/tiku/q/*` CTA、分享、书签）冷启动才出现。解析卡 `kg-analysis-card` 只在作答揭晓/回看后渲染，本轮不向生产提交答案，**解析态未量**（登记）。

### 2.3 生产 Lighthouse ×3（`~/r509/lh_practice.sh` → `lh_practice.out`，`lhr_practice_{2,3}.json`；lighthouse 13.4.1 mobile）

| 次 | bench | perf | a11y | FCP | LCP | CLS | TBT | a11y 失败 |
|---|---|---|---|---|---|---|---|---|
| 1 | 3700 | 0.95 | **0.96** | 1900 | 2650 | 0.000 | 14 | `color-contrast` |
| 2 | 3646 | 0.80 | 0.96 | 2690 | 4423 | 0.000 | 27 | 同 |
| 3 | 3648 | 0.84 | 0.96 | 1870 | 4422 | 0.000 | 25 | 同 |

`color-contrast` 三次同 3 项：① 顶栏模块标签 `uni-view.top-mod > .kg-tag > .kg-tag__t > span`「言语理解」；② 题目元信息 `.kg-q__meta > .kg-tag …`「言语理解」；③ **底栏禁用主按钮「请选择答案」**。

DOM 取证（`~/r509/dom_a11y.py` → `dom_a11y_yanyu.out`）：按钮是 `<uni-button class="wd-button is-primary is-large is-round is-disabled kg-btn …">`，`opacity .4`，白字叠 `#2e5bff` → 有效对比 ≈ **1.29:1**；**`role` null、`aria-disabled` null、无 `disabled` 属性**。模块标签 `#e11d48` on `#fce8ec` = **4.00:1**（axe 小字阈值 4.5）。

## 3. 命中与设计论证

- 几何/位移：375/1440 直链冷启动与正常路径全过（CLS 0×3、topbar 不动、`docSW==cw`、errs 0），不改骨架/题干/选项布局。
- a11y 命中一处**语义**缺陷：H5 的 `<uni-button>` 不是原生 `<button>`，WOT `wd-button` 的 `:disabled` 只落 `is-disabled` 类、不透传 `disabled`/`aria-disabled` → 辅助技术把「请选择答案」当**可用**按钮读出，axe 也不按「禁用控件」跳过对比度。修法只在 `kg-button` 一处（全站 disabled/loading 态同受益），不动颜色、不动练习页。
- 模块标签 4.00:1：是设计 token（`--mod-yanyu` / `-soft`）层面的取舍（7 个模块色各自的 soft 底 + 主色），改色影响全站模块识别，**登记不改**，待单独设计论证。

## 4. 修（`e01e87be`，前端 1 文件 + 源锁）

`frontend-uni/src/components/kg-button/kg-button.vue`：`<wd-button … :disabled="disabled" :aria-disabled="disabled || loading ? 'true' : null" …>`，可用态不落属性；`:disabled` 透传与 `onClick` 守卫不变。源锁 `tests/practice-r509-button-aria-disabled.test.js`（3 例：绑定表达式 / 守卫仍在 / 练习页底栏仍走 `kg-action-bar → kg-button :disabled`）。

门：vitest **824**（116 文件）/ eslint（含 `lint:edge`）/ `lint:tokens`（design-tokens check ok、lint-pages 0 error 19 存量 warning）/ `build:h5` rc=0；`git diff --check` 空；后端 / native 本轮未动（基线 `8cb61529` 上 pytest 516 / ruff / pyright 0、native typecheck/lint 0，本轮沿用）。

本地 dist（`~/r507/proxy.py :8831` 转发生产 GET）DOM：`aria-disabled=true`（`~/r509/dom_a11y_local.out`）；本地 Lighthouse `color-contrast` 只剩两处模块标签（`~/r509/lhr_local_fixed_1.json`）。

## 5. 发版 + 复采

`~/r509_deploy.log`：预检 mem_avail 355 MB / 5.5 G / load 0.46 / 兄弟构建 0，`--skip-build` 一次 rc=0；容器 `20:50:43Z rev=e01e87be` healthy 0 重启；bundle `index-Dl80Bqeb.js` 123 KB 线上=本机；7/7 200。6b：`/` perf 0.98 / a11y 1.00 / LCP 1679 / CLS 0.06；`/tiku/` 1.00 / 1.00 / 951 / 0。

改后生产：
- DOM 375/1440：「请选择答案」`aria-disabled="true"`（`~/r509/dom_a11y.py`）。
- Lighthouse ×3（`~/r509/post/lh_practice_post.out`，`lhr_practice_{1,2,3}.json`）：perf 0.84×3、a11y 0.96×3、FCP 1598/1021/1661、LCP 4497/4613/4434、CLS 0×3、`color-contrast` **只剩两处模块标签**（禁用按钮项消失）。a11y 分值不变是 axe 按审计项计分（`color-contrast` 有 1 项失败与 3 项失败同分），本轮改的是「禁用态对辅助技术可见 + 去掉一个无意义失败项」，**不宣称练习页 a11y 达 1.00**。

发版后 (c)（`~/r509_post.sh` → `.out`）：新容器 48 请求，5xx/assets 404/mpUA/monitor/非探针 POST 0；「非探针非 bot」4 条全是本机 `curl` 直打源站 `/api/health`·`/healthz` 403（R388 源站直连拒绝，非产品流量）；WAL 同字节；DB 到期项全部不变。

## 6. 登记（不改）

- 模块标签 `#e11d48`/`#fce8ec` 4.00:1（阈值 4.5）三次稳定报 → 7 个模块 soft/主色 token 取舍，需单独设计论证再动。
- 直链冷启动 LCP 2650–4613 ms（6 次中 5 次 >4.4 s）而服务端 `questions` ≤151 ms → 是「主 bundle → practice 分包/组件 chunk → 挂载后才发 API → 首绘」客户端串行链；lighthouse 13.4.1 无 `largest-contentful-paint-element`，LCP 元素未核。此路径是 SEO `/tiku/q/*` CTA / 分享深链的真人入口 → **R510 起点**（R387 head 预加载是否覆盖 practice 分包、题包能否随首屏并行预取）。
- 解析卡（`kg-analysis-card`）首屏几何未量（需作答；本轮 0 提交）；下轮可用 route mock `POST /api/answer` 或 `?bei=1` 回看模式量。
- 骨架 195 vs 首题卡不等高（题干长度相关），CLS 0 且 topbar 不动，不做等高。
- 均为本机 CDP / Lighthouse 采样，非真机 RUM；`lhr_practice_1.json`（改前）被本地复采覆盖，改前第 1 次只留 `lh_practice.out` 汇总行。

## 7. 文件

`~/r509_pre.sh`/`.out`、`~/r509_practice_cold.py` → `~/r509_practice_{375,1440}.out`/`.png`、`~/r509_home_to_practice.py` → `~/r509_home2practice_{375,1440}.out`/`.png`、`~/r509_sheet_375.py` → `.out`/`.png`、`~/r509/lh_practice.sh` → `lh_practice.out`/`lhr_practice_{2,3}.json`、`~/r509/dom_a11y.py` → `dom_a11y_yanyu.out`、`~/r509/dom_a11y2.py` → `dom_a11y_local.out`、`~/r509/lhr_local_fixed_1.json`、`~/r509/build.log`、`~/r509_deploy.log`、`~/r509/post/lh_practice_post.out` + `lhr_practice_{1,2,3}.json`、`~/r509_qdur.out`、`~/r509_post.sh`/`.out`。
