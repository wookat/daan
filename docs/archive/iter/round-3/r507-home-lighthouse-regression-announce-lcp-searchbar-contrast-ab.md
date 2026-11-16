# R507（2026-09-08）：R506 发版带上生产的 `/` Lighthouse 回归——R442 法同机交替 A/B/C/D 定因：LCP 主因是 W5 公告横幅「标题+正文拼接、等回包才绘」（不是组件小 chunk 数），a11y 是 `.searchbar-t --ink-4`；两处最小修 + 公告占位等高（CLS）→ 发版复采 perf 0.96–0.98 / a11y 1.00×3 / LCP 1085–2319 / CLS 0.086

> 原则：没有调查就没有发言权。本文只记一手读数；「事实 / 推断 / 未核」分开写。
> Lighthouse 是本机采样（moto g 模拟 + 4G 节流），不是真机 RUM；对生产只发 GET（探针头 `X-Kg-Probe: 1`），生产库 `mode=ro`，**0 账号 / 0 作答 / 0 写入 / 0 LLM**。

## 0 结论

| # | 项 | 结论 | 证据等级 |
|---|---|---|---|
| 1 | R506 发版后 (c) / 到期项 | 全 0 增量；`mistakes_total` 非探针触达仍 0；无新的外部真人证据 | 生产 Caddy + DB 只读，事实 |
| 2 | a11y 0.95 根因 | 唯一失败 `color-contrast`：`.searchbar-t` 被 main W5 `f4ca1904` 从 `--ink-3` 改成 `--ink-4`（`#b0b4c0`/`#fff` = 2.07:1）。全仓 grep `--ink-4` 其它用点均为装饰/图标/禁用态或非首页，Lighthouse 无第二处失败 → **只改这 1 行** | LHR 明细 + 源码，事实 |
| 3 | LCP 回归主因（同机交替 A/B/C/D 各 5 轮，§2） | B（HEAD 修前）LCP 5.86–6.17 s，LCP 元素 = 公告横幅文本 `kg-banner__t`；C（同 dist、`/api/announcement` stub 成 `{item:null}`）3.45–4.06 s，LCP 元素回到 splash；A（`bf1807a6`）3.34–3.90 s。**C ≈ A** 而 **B ≫ C**，且 B/C 请求数完全相同（28 JS / 18 CSS）→ 回归由「公告横幅内容 + 时机」贡献，**组件小 chunk 数（18→28 JS）不是主因** | 同机受控实验，事实 |
| 4 | 修法（不动 W5 布局） | 横幅只渲染 `announce.title`，正文改「详情」按钮点开另起一行（`.ann-body`）；D（修后）LCP 1.83–4.05 s、元素回 splash、a11y 1.00 | 同机受控实验，事实 |
| 5 | 追加 CLS 最小修 | 公告回包前占位由四行段落骨架 `lines`（116 px）改为新 `banner` 预设（48 px，与 `kg-banner` 等高）；CDP 几何：`.kg-sec.sec-h` top 在回包前后由 728→580 变成 660→580（剩余 80 px 是计划卡骨架 288→208，另一处，本轮不动）；D→E 同机 CLS 0.148→0.105 | CDP 几何 + LH，事实 |
| 6 | 发版复采（生产 `b0ed4c13`） | perf 0.98 / 0.98 / 0.96，a11y **1.00 ×3**，LCP 1422 / 1085 / 2319 ms（元素 splash），CLS 0.086 ×3；发版脚本 6b 那一次 a11y 0.94 = R429 已知间歇（同刻 1 条 monitor 上报来自探针网段 moto g UA = 该次 Lighthouse 本身） | 生产 LH ×3 + 脚本 1 次，事实 |
| 7 | 生产 375/1440 CDP | 横幅四子项 `l-icon 20×20 · 标题 190/558×19 · 详情 34×32 · ✕ 44×44`，正文初始不渲染；点「详情」后 `.ann-body` 328×83 / 696×46、`rgb(64,67,78)` 13 px；`docSW==cw`、errs [] | 生产 CDP，事实 |

## 1 (c) 补量 + 到期项（`~/r507_post.sh` → `~/r507_post.out`；发版后 `~/r507b_post.sh` → `~/r507b_post.out`，VPS 上只读）

- R506 容器（19:24:43Z→19:55:19Z）+ R507a 容器（dist D，19:55:19Z→20:08:19Z，145 请求）+ 当前容器（dist E，20:08:19Z 起，50 请求）：5xx 0、静态 404 0、mpUA 0、非探针非 bot 0、非探针 POST 0、401/403 0、Traceback 0、WAL `4,124,152 B` 同字节；monitor 1（20:08:55Z，`140.232.64.4` 探针网段、moto g UA = 发版脚本 6b Lighthouse，内容在中心侧无权限）。
- DB（`mode=ro`）：probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click` 真人 0、nudge 真人 0、`push_subs` 0、时政 qid 非空 0、harness uid 落库 0；`mistakes_total` 非探针触达 0（非探针 `home_bundle` 35 次全在 R503 发版前）。
- `user_profile` 9 行、已过/今天/未来 1/0/8（唯一已过 `umst3tui… · 2026-09-07`，R502 判疑内部）；第 2/3 步字段仍全默认。
- **结论**：无新的外部真人证据；本轮是「先于用户」的性能/可访问性回归修复。

## 2 同机交替 A/B/C/D（R442 法，`~/r507/ab.sh` → `~/r507/ab.txt`/`ab2.txt`）

harness：四个本机静态代理（`~/r507/proxy.py`，`/api/**` 转发生产 GET 加探针头；`STUB_ANN=1` 时 `/api/announcement` 回 `{"item":null}`），同一台机器交替 A1 B1 C1 D1 A2 …，Lighthouse 默认移动配置，`bench` 记录每轮机器基准分以排除机器抖动。

| 变量 | A `bf1807a6` | B HEAD 修前 | C = B + 公告 stub 空 | D = 修后 |
|---|---|---|---|---|
| 公告横幅位置 | 首屏下方 `.card.ann` | hero 下 `kg-banner` | 同 B（无内容） | 同 B |
| 横幅文本 | 标题+正文 | 标题+正文 | — | 只标题 |
| 首屏 JS / CSS 请求 | 18 / 7 | 28 / 18 | 28 / 18 | 28 / 18 |

第二组 5 轮（`ab2.txt`，bench 2342–3730）：

| 轮 | A LCP | B LCP | C LCP | D LCP |
|---|---:|---:|---:|---:|
| 1 | 3755 | 6168 | 4055 | 3529 |
| 2 | 3753 | 5871 | 3452 | 4053 |
| 3 | 3903 | 6074 | 3904 | 3601 |
| 4 | 3345 | 5865 | 3752 | 1844 |
| 5 | 3902 | 5859 | 3453 | 1826 |
| a11y | 1.00 | 0.95 | 0.95 | 1.00 |
| LCP 元素 | splash | `kg-banner__t` | splash | splash |

第一组 5 轮（`ab.txt`，A/B/C）同形态：A 3752–3943、B 5562–6016、C 1882–3792。

- **事实**：B 每轮 LCP 元素都是公告横幅文本（284×75，须等 `GET /api/announcement` 回包再绘 → 时间被推到 API 回包 + 组件挂载之后）；只把公告数据置空（C）LCP 立刻回到 A 的量级并且元素回到 splash，而 C 与 B 的请求数/大小完全一致。
- **推断**：W5 把公告上移到 hero 下并把「标题 + 正文」拼成一段大文本，使它成为首屏最大文本块；chunk 数增加（18→28 JS）最多贡献 A 与 C 之间的差（数百 ms 级、且 C4/C5 与 A 持平），不是 1.5–2.5 s 的主因。
- **不动 W5 布局**：位置本身（hero 下）在 C/D 都保留，LCP 已回到 splash；「挪回首屏下方」无必要。

## 3 修法与源锁

- `home.vue`：`<kg-banner :text="announce.title" :action-text="announce.body && !annOpen ? '详情' : ''" @action="annOpen = true" @close="dismissAnn" />` + `<text v-if="annOpen && announce.body" class="ann-body">`；`.searchbar-t` `color: var(--ink-3)`；公告未回包占位 `<kg-skeleton preset="banner" />`。
- `kg-skeleton.vue`：新增 `banner` 预设（`wd-skeleton theme=image` 单块 `100%×48px`），`SKELETON_PRESETS` 加 `'banner'`。
- 源锁 `frontend-uni/tests/home-r507-lcp-announce-banner-contrast.test.js`（5 例：横幅只用 title / 详情交互 / banner 预设 / `.searchbar-t` 用 `--ink-3` 不用 `--ink-4`）；R467 源锁正则放宽为允许 `:action-text`/`@action` 夹在 `:text` 与 `@close` 之间。
- 门：vitest 816 / eslint（19 既有 warning）/ `lint:tokens` / lint-pages / build 绿；pytest 516 / ruff / pyright（`npx -y pyright`）0；native typecheck/lint 0；`git diff --check` 空。

## 4 CLS 追加（`~/r507/skel_h.py`/`skel_hE.py`/`shift_map.py` → 生产 `shift_map_prod.out`）

| 时刻 | 375 `.strip` 高 | 375 `.kg-sec.sec-h` top | 1440 `.strip` 高 | 1440 `.kg-sec.sec-h` top |
|---|---:|---:|---:|---:|
| 修前 D：骨架 | 116 | 728 | 116 | 740 |
| 修前 D：横幅 | 48 | 580 | 48 | 573 |
| 修后 E / 生产：骨架 | 48 | 660 | 48 | 672 |
| 修后 E / 生产：横幅 | 48 | 580 | 48 | 573 |

- 公告占位造成的抬升 68 px 归零；剩余 80/99 px 来自计划卡 `cards` 骨架（288）→ 实际计划卡（208/189），与 Tabbar `::after` 0.061 一起构成生产 CLS 0.086 的主体——另一处、本轮不动（预算 ≤0.1 已过）。
- 同机 D→E 三轮：CLS 0.148→0.105，LCP/perf 持平（`~/r507/abE.sh`）。

## 5 发版 + 复采

- 预检：宿主 `/dev/vda2` 5.4 G avail / load 0.48 / 兄弟构建 0；两次 `--skip-build` 各一次 rc=0（R507a dist D 19:55Z，rev 标签仍 `51165654` 因当时改动未提交；R507b dist E 20:08Z `rev=b0ed4c13`）。容器 healthy 0 重启；线上 bundle `index-Au2ZsSgt.js` = 本机；7/7 200。
- 脚本 6b：`/` perf 0.93 / LCP 2799 / CLS 0.00 / **a11y 0.94**；`/tiku/` 1.00。
- 本机对生产 ×3（`~/r507/lhr_prodE_{1,2,3}.json`）：perf 0.98/0.98/0.96、a11y 1.00/1.00/1.00、LCP 1422/1085/2319、CLS 0.086 ×3、`color-contrast` 通过、LCP 元素 splash。→ 6b 的 0.94 与 R429/R505a 同形态（间歇、复采不再现），如实登记不追。
- 生产 CDP 375/1440（`~/r507/d_check2_prod.py` → `.out`）见 §0 #7。

## 6 登记不改

- 计划卡 `cards` 骨架（288 px）与实际计划卡（208/189 px）高差是当前生产 CLS 最大可动项；Tabbar `::after` 0.061 是 uni 框架层。
- 发版脚本 6b a11y 间歇 0.94（R429）未拿到 LHR 明细；如再现可让脚本落 `--output-path`。
- 公告「详情」展开后的 `.ann-body` 只在 H5；小程序端公告形态未核。
- 本轮 Lighthouse 全部为本机/脚本采样，非真机 RUM；无 testing agent 录屏（未另行授权）。

## 7 证据索引

- 脚本/输出：`~/r507_post.sh`→`.out`、`~/r507b_post.sh`→`.out`、`~/r507/proxy.py`、`~/r507/ab.sh`→`ab.txt`/`ab2.txt`、`~/r507/abE.sh`→`lhr3_*.json`、`~/r507/lhr2_{A,B,C,D}_{1..5}.json`、`~/r507/skel_h.py`/`skel_hE.py`/`shift_map.py`/`shift_map_prod.py`→`.out`、`~/r507/d_check2E.py`/`d_check2_prod.py`→`.out`、`~/r507/lhr_prodE_{1,2,3}.json`、`~/r507b_deploy.log`。
- 改动：`frontend-uni/src/pages/home/home.vue`、`frontend-uni/src/components/kg-skeleton/kg-skeleton.vue`、`frontend-uni/tests/home-r507-lcp-announce-banner-contrast.test.js`、`frontend-uni/tests/mainloop-r467-hitarea.test.js`（`b0ed4c13`）。
