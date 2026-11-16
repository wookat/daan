# R587：新访客首页 hero 一句价值文案压进右上角 ✕（H5 小修）+ R586-1 清理脚本保护表 digest 改窄（工具）

日期 2026-09-11 · 分支 `devin/1789057885-r587-hero-label-x`（从 #764 分支开，链含 #742–#764）→ PR #765 · 0 后端 · Pages `index-ZlaKqs_J → k16i1KRf` · health 全程 `ec8206e5`

## 1. 研究（只读）

- 宿主（`~/r587/q587a.out`）：load 17.2–18.1 / mem_avail 231MB / disk 88.6% / health 1.74s `ec8206e5`；未 kill 未改配置。
- 自然样本 167.4h（POST 6610，剔 probe/harness）：`POST /api/practice_result` 自然 `200×4`、非 2xx / status 0 **0**（500×2/400×2/503×7/502×1 全 harness）；`answer_log 200×53`、`practice/progress 200×29`（p90 ≤0.06s）；`daily_set/submit`/`merge_anon`/`favs` 自然 0 → **R580-1 继续不实施**。
- 360 走查 20 路由（`~/r587/walk587.py`，uid `test-r587-shots`：home/book/ask/stats/profile/login/offline/shenlun/examlist/contest/discuss/plaza/inbox/favorites/poster/interview/ihist/team/pk/weekly）：API 全 2xx、console/pageerror 0；**走查脚本用 Playwright `route('**/api/track')` 直接 fulfill stub 200**（R586 教训：只看不答也会落 `growth_events`）→ 本轮两 uid 独立 `ro` 命中 **`{}`**，0 写入、0 清理。
- 申论页 360 20s 稳定性（`~/r587/shenlun587.py`）：3s 已有 20 卡、20s 仍在，questions/filters/qfavs 全 200，6.26s 一次 `/api/track` 被 stub。
- 自动几何审计（`docW`、越界、nowrap 截断、标题折行）标出的「OVER/CLIP」经复核多为 uni-h5 空包裹元素、chip 行预期横向滚动、标题 `scrollWidth` 误报，**不作缺陷结论**；唯一经截图 + 量测坐实的一手缺陷：**首页新访客 hero 文案压进 ✕**（修前截图 `~/r587/shots/360-home.png` 可见「迷你模考」末字与 ✕ 叠在一起）。

## 2. 缺陷量测（生产 `index-ZlaKqs_J`，`~/r587/hero587.py`，13px 同字体）

| 宽 | `.kg-hero__top` | 文案右缘 | ✕ 热区 | ✕ glyph | 压热区 | 压 glyph | 行数 |
|---:|:--|---:|:--|:--|---:|---:|---:|
| 360 | 36..309（273） | 302.8 | 277..321 | 291..307 | **25.8** | **11.8** | 1 |
| 375 | 36..324（288） | 302.8 | 292..336 | 306..322 | **10.8** | −3.2 | 1 |
| 390 | 36..339（303） | 302.8 | 307..351 | 321..337 | −4.2 | −18.2 | 1 |
| 414 | — | 302.8 | 331..375 | 345..361 | 分离 | 分离 | 1 |

根因：`.hero-x{position:absolute; right:8px; width/height:44px}` 从卡片右缘向内占 52px，卡片 padding 20 → 热区压在 `.kg-hero__top` 内容列上 32px、glyph 左缘距内容列右缘 18px；而 `.kg-hero__label` 没有为 ✕ 预留任何右侧空间，文案 266.8px 在 360 下直接铺到 302.8 压过 glyph，375 下压在热区里（点末字「模考」= 关 hero）。

## 3. 设计论证

- 用户可感知：360/375 新访客第一屏第一句话就与关闭按钮叠字 / 误触关闭，且是免注册转化的唯一价值陈述。
- 候选：(a) 只缩短文案——治标，任何后续文案改动都可能再叠；(b) 只预留右内边距——结构上永远不叠，但 266.8 > 241/256（360/375 可用宽）会折两行，hero 高 19px；(c) **(b)+(a)**：`.hero-wrap :deep(.kg-hero__top){padding-right: var(--sp-32)}` 结构保证 + 文案「拍题 AI 讲解 · 遗忘曲线复习 · 迷你模考」227.8px < 241 → 三档单行。选 (c)。
- 文案候选量测（canvas）：原 266.8 / 去「错题按」227.8 / 去「按」253.8 / 「AI 拍题讲解 · 错题遗忘曲线复习 · 迷你模考」249.7 / 去「迷你」240.8——只有 227.8 在 360 可用 241 内。「遗忘曲线复习」仍点明错题复习机制（设计稿 `design-landing-firstvisit.md` 副标题的三要素保留）。
- 只作用 `.hero-wrap`（新访客 hero）；有记录态 hero 无 ✕ 不受影响；小程序首页无该新访客 hero（grep 无 `hero-x`/该文案），不改。

## 4. 实修（`19594f34`）

- `frontend-uni/src/pages/home/home.vue`：label 收短 + `.hero-wrap :deep(.kg-hero__top) { padding-right: var(--sp-32); }`。
- 测试 `frontend-uni/tests/r587-hero-label-x.test.js`：量测前提（旧文案 360 压 glyph / 375 压热区 / 390 不压）+ 新文案三档单行 + 源锁（文案 / padding-right / `.hero-x` 仍 44×44 `right: var(--sp-8)`）。
- 本地门：H5 eslint 0 error / vitest 204 文件 1578 / `build:h5` `index-k16i1KRf`；`git diff --check` 空。

## 5. 发版 + 生产复验

- Pages only（`~/r587/pages_deploy.sh`）：线上 bundle `index-k16i1KRf` 与本机一致、7 种 Accept-Encoding 全 javascript、7 条回归 URL 200、health 前后 `ec8206e5`。
- 复验（`~/r587/verify587.py`，uid `test-r587-verify`，360/375/390/1440 各一场新 context 冷进首页，`/api/track` stub）：

| 宽 | `.kg-hero__top` padR | 文案右缘 / 宽 | ✕ 热区 | 压热区 | 压 glyph | 行数 | A 点文案末字 hero 仍在 | B 点 ✕ 关闭 + `landingHide=1` | API |
|---:|:--|:--|:--|---:|---:|---:|:--|:--|:--|
| 360 | 32px | 263.8 / 227.8 | 277..321 | −13.2 | −27.2 | 1 | PASS | PASS | 9 全 2xx |
| 375 | 32px | 263.8 / 227.8 | 292..336 | −28.2 | −42.2 | 1 | PASS | PASS | 9 全 2xx |
| 390 | 32px | 263.8 / 227.8 | 307..351 | −43.2 | −57.2 | 1 | PASS | PASS | 9 全 2xx |
| 1440 | 32px | 544.3 / 227.8 | 940.5..984.5 | −396.2 | −410.2 | 1 | PASS | PASS | 9 全 2xx |

requestfailed 0、console 0、pageerror 0、`docW ≤ winW`。截图 `~/r587/shots/v{360,375,390,1440}-hero.png` / `-home.png` / `-home-after-x.png`（修前 `~/r587/shots/360-home.png`）。

## 6. R586-1 清理脚本 digest 改窄（`~/r587/clean587.py` + `run_clean587.sh`，工具侧不入库）

- 论证：clean 模式只执行 `DELETE … WHERE uid IN (目标)`；非目标行只可能被「误删」、不可能被改值 → 保护不变量只需「每张表非目标行的 `count(*)` / `sum(rowid)` / `max(rowid)` 前后相等」，任一非目标行被删必然改变 count 与 sum(rowid)；覆盖面从 10 张保护表扩到全部 41 张 uid 表。共享 fixture `test-r562-modal-%` 42 行是前缀误删风险所在，仍保留逐行 sha256（`shared_r562: [42, hash]`）。
- 宿主一手对照（同一趟 `--full` 同时算旧口径）：41 表窄聚合 **0.08s** vs 旧 10 表逐行 JSON→sha256 **60.54s**；hits 0.4–0.76s、shared digest 1.04–1.17s → `state()` 单趟 ≈62s → ≈2s，clean 两趟远在 `timeout 170` 内，R585-2/R586 那类「commit 后被杀」结构上不再发生。
- 边界如实：窄口径检测不到「非目标行被改值」——本脚本无 UPDATE 语句，该风险不存在；若未来脚本加入 UPDATE，需恢复逐行 digest（脚本保留 `--full` 开关）。
- 本轮 `ro`（uid `test-r587-shots` / `test-r587-verify`）两次 `{}`、共享 42、无需 clean。

## 7. 如实登记

- UNTESTED：真机 360 渲染（Playwright 视口 + DPR2）；登录态首页（新访客 hero 仅 `showLanding` 时出现，登录后不显）；其它浏览器字体下 227.8px 是否仍 < 241（Inter/PingFang 缺失回落 Noto Sans SC 时字宽可能略变，但 padding-right 结构保证只会折行不会叠字）；小程序端（未改）。
- 自动几何审计的误报口径（uni-h5 wrapper / chip 横滚 / `docW` 345 < 360）入 SKILL，避免下轮再把审计标记当缺陷。
- 登记 **R587-1（P3 观测）**：首页公告条「欢迎使用错题邦（原上岸错题）」在 360 折两行，属预期换行非缺陷，不改。
