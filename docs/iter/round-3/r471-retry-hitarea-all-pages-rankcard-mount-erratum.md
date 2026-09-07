# R471：R470 起点复核——`pkgA/team/team.vue` 的「rank-card」是同名本地 class 不是组件（勘误）；`pkgA/exam/contest|contest-report` 无低字号；全仓 17 页「加载失败 → 重试 ›」文字链热区 18–22px → 40px；R470/R471a `inline-flex` 把 6 页重试挤到错误文案同行（R471b 修回）

日期：2026-09-07 03:20–04:40Z。生产 `6047881` → `59cd473`（R471a）→ `6e82179`（R471b）。取证方式：源码 `<style>`/模板逐 `@click` 核 + 生产 Playwright CDP 只读量测（375 / 1440，`X-Kg-Probe: 1`，`ctx.route('**/api/**')` **全部 abort** 以稳定制造「加载失败」态，无 DB 写入）+ 本地 dist 预检 + 宿主直读卷 `mode=ro` + 源站 caddy 日志（按 host 过滤）。
改动：前端 12 文件 `<style>`（0 行模板、0 后端）+ 1 源锁。竞品维度：无一手截图，零竞品陈述、不加功能。

## 1. 结论

1. **R470 起点勘误（如实认错）**：R470 汇报写「rank-card 另一挂载点 `pkgA/team/team.vue`」——`git grep rank-card` 命中 team.vue 是因为它有一个**本地 class `.rank-card`**（`<view v-if="weekRank.length" class="card rank-card">` + `.rank-card { padding: 24rpx 28rpx; }`），**不是** `components/rank-card` 组件；组件真正的挂载点全仓只有 `pkgA/exam/report.vue` 一处（R470 已审）。R470 文档已加指针。
2. **`pkgA/team/team.vue` / `pkgA/exam/contest.vue` / `pkgA/exam/contest-report.vue` 字号：0 命中**——三文件 `<style>` 内 `font-size` 20–23rpx 出现 **0 次**（`grep -oE "font-size: ?(1[0-9]|2[0-3])rpx"` 空）。可点元素按模板逐 `@click` 核：team `hero-btn / join-btn / act-btn / remind-btn / rank-copy / sheet-btn / t-row`，contest `cta / cta sub / cta ghost / prow / rules-h / sheet-x`，contest-report `pbtn / pbtn main / wrow`——全部是按钮/整行卡片类（源码 min-height ≥ 40px 或整行可点），**唯一命中 = 三页共有的失败态 `.retry`**。
3. **全仓「加载失败 → 重试 ›」文字链热区（本轮真命中）**：`grep -l 'class="retry"'` 全仓 **17 个 vue**——其中 R464 shenlun / R465 practice / R466 search·discuss / R467 book / R470 list·report 6 个已在各自轮次补到 40px，**剩余 11 个页面 `.retry` 只有 `margin-top + color + font-size`、无 min-height**：`pages/stats/stats`、`pkgA/team/team`、`pkgA/pk/pk`、`pkgA/exam/contest`、`pkgA/exam/contest-report`、`pkgA/social/favorites`、`pkgA/social/inbox`、`pkgA/social/plaza`、`pkgA/stats/practice-history`、`pkgA/stats/mastery-map`、`pkgA/interview/history`。
   - **改前生产一手（`6047881`，全 API abort 制造失败态，375 / 1440）**：10 页 `.retry` 视觉高 **18–22px**（26rpx 文字行高即元素高），`elementFromPoint` ±19 / ±21 **全部不命中**（只有 0 命中）；`inbox` 页在 API 全 abort 下先落到登录/其它分支、`.retry` 未渲染（返回 null），**未在生产真实走到**。
   - **改后（`59cd473` 04:07Z 生产一手）**：10 页 375 / 1440 全部 `h=40`、±19 命中 / ±21 不命中；父容器高度未被异常抬高（stats 61→61.1 / team 70.7 / favorites 125 / plaza 202.6 等，与本地 dist 预检逐项一致）。
4. **R471a 自身引入的布局回归 + R470 同源（R471b 修回，本轮内闭合）**：R471a 照抄 R470 list/report 的写法 `display: inline-flex`——对「`<view class="spin">加载失败：{{ err }}<view class="retry">重试 ›</view></view>`」这种**与错误文案同容器**的模板（`grep '加载失败[^<]*<view class="retry"'` 全仓 **6 页**：stats / team / pk / contest / list / mastery-map），`<view>` 默认 `display:block` 原本让「重试 ›」独占一行，改成 `inline-flex` 后被挤到错误文案同一行（`59cd473` 生产 375 截图 `r471_post_team_375.png`：「request:fail重试 ›」贴着）。**其中 `pkgA/exam/list.vue` 是 R470 就已上线的同一问题**（R470 §「`.retry` 失败态未在生产走到」的登记项，本轮走到才暴露）。修法：12 个 `.retry` 统一 `display: flex; align-items: center; justify-content: center; min-height: 40px`（与 R464 shenlun 写法一致）——块级独占一行、文字居中、命中带 40px 整行；本地 dist 预检 375 / 1440 12 页 `h=40`、±19 命中 / ±21 不命中、团队页截图「重试 ›」回到独立一行居中（`r471_local2_team_375.png`）。源锁新增：同容器模板的 `.retry` 必须 `display: flex` 且禁 `inline-flex`。
5. **到期项（04:07Z，宿主直读卷）无增量**：`answer_log` probe=0 33/1、`growth_events` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs 0`、`weekly_reports 2`、`exam_attempts` probe=0 1 / 64、healthy 0 重启（`59cd473` 容器 `StartedAt 04:05:53Z`）。
   (c) R471a 容器起后 32 请求：`/assets/*` 404 **0**、`/api/monitor/report` 0、MiniProgram UA 0、kaogong 5xx 0；唯一非 2xx = `/sw.js` 304（正常缓存）。**Caddy 总日志里的 502 全是别家 host**（`sco.zalize.com` / `api-video.zalize.com` / `api.aicdks.com` / `mx-ux.zalize.com`），按 host 过滤后 kaogong 源站重建窗口 5xx 0。

## 2. 一手证据

### 2a. 改前 / 改后生产读数（W=375 / 1440，`elementFromPoint` 中心列 −21/−19/0/+19/+21）

| 页 | 改前 h（≈） | 改前 ±19 | 改后 `59cd473` h / ph（375） | 改后 h / ph（1440） | ±19 / ±21 |
|---|---|---|---|---|---|
| stats | 18–22 | 不命中 | 40 / 61.1 | 40 / 62 | 命中 / 不命中 |
| team | 18–22 | 不命中 | 40 / 70.7 | 40 / 72 | 命中 / 不命中 |
| pk | 18–22 | 不命中 | 40 / 70.7 | 40 / 72 | 命中 / 不命中 |
| contest | 18–22 | 不命中 | 40 / 70.8 | 40 / 72 | 命中 / 不命中 |
| contest-report | 18–22 | 不命中 | 40 / 126.9 | 40 / 129 | 命中 / 不命中 |
| favorites | 18–22 | 不命中 | 40 / 125.3 | 40 / 128 | 命中 / 不命中 |
| plaza | 18–22 | 不命中 | 40 / 202.6 | 40 / 208 | 命中 / 不命中 |
| practice-history | 18–22 | 不命中 | 40 / 183.8 | 40 / 190 | 命中 / 不命中 |
| mastery-map | 18–22 | 不命中 | 40 / 121.3 | 40 / 127 | 命中 / 不命中 |
| interview-history | 18–22 | 不命中 | 40 / 183.8 | 40 / 190 | 命中 / 不命中 |
| inbox | — | — | null（未走到） | null | — |

改前逐页精确值当时只在终端回显、未落文件（如实登记）；改后 JSON：`/home/ubuntu/r471_post_prod.json`。探针脚本：`/home/ubuntu/r471_retry_prod.py`（同一脚本对本地 dist `http://localhost:8466` 复跑 = 预检）。

### 2b. R471b 本地 dist 预检（`6e82179`，W=375 / 1440，h / w / ph）

375：stats 40/292.8/79.1 · team 40/302.4/91.1 · pk 40/302.4/87.7 · contest 40/308.1/88.8 · contest-report 40/308.1/125 · favorites 40/311.9/123.4 · plaza 40/33.9/202.6 · practice-history 40/33.9/183.8 · mastery-map 40/298.6/121.3 · interview-history 40/33.9/183.8；1440 同页全 h=40；全部 ±19 命中 / ±21 不命中。（`w` 差异 = 父容器是块级居中还是 flex 列 `align-items:center`，前者整行可点、后者收缩到文字宽，均 ≥ 文字宽。）

### 2c. 源码
- 改动模式（12 文件同一条）：`.retry { display: flex; align-items: center; justify-content: center; min-height: 40px; margin-top: 4rpx; color: var(--brand-text); font-size: 26rpx; font-weight: 500; }`
- 源锁：`frontend-uni/tests/retry-r471-hitarea.test.js`——递归发现 `class="retry"` 的 vue（≥17 防漏扫）；每个 `.retry` 规则 `min-height: 40px` 且禁 `min-height: Nrpx`；与「加载失败：…」同容器的 6 页禁 `inline-flex`、必须 `display: flex`。
- 门：vitest 90 文件 **699/699**（R471a 682 → +17）、eslint 0 error、`build:h5` 通过。

### 2d. 部署
- R471a：`deploy_h5.sh --skip-build` 起点 `mem_avail=386MB disk 6.0G(88%) load=4.85 other_builds=0 prunes=0` → 600 s FAIL（R468 文案）→ 远端 `#16 exporting layers DONE 1142.5s`、`KG_COMPOSE_EXIT rc=0 at 04:05:55Z`（构建全程守护 `builder prune` 在跑、load 11–23、mem_avail 188–335 MB）→ `DEPLOY_RESUME=1` rc=0：rev 59cd473 一致、bundle 一致、回归全 200。日志 `/home/ubuntu/r471_deploy1.log` / `r471_deploy2.log`。
- R471b：起点 `other_builds=1 prunes=0`（别家 build）4-pre WAIT ×6 后别家退出（`other_builds=0`，未到 300 s WARN）→ `compose-started 04:15:05Z`（`/tmp/kg-compose-6e82179-20260907T041505Z.log`）→ 见 §3 收口。

## 3. R471b 收口读数

（部署完成后回填：rev / bundle / 回归 / perf / 生产 375·1440 `.retry` 读数 + 团队页截图 / 到期项 / (c)。）

## 4. 如实边界
- 375 为 360 仿真直读、真机未量、无 testing agent 录屏（未另行授权）。
- `inbox` 失败态在 API 全 abort 下未渲染 `.retry`（先落登录/其它分支），按源码 + 源锁推断，**未在生产真实走到**。
- 改前逐页精确 h 未落盘，只登记范围 18–22px；改后数值全部落盘。
- team / contest / contest-report 的按钮类可点元素只核了源码 min-height，本轮未逐个生产量测（三页无低字号规则、无 `<text @click>` 裸链接，与 R463–R470 命中形态不同）。
- R471a 布局回归是本轮生产复验截图发现的，不是源锁/单测拦下的——源锁只锁了 min-height，对 display 模式无感；R471b 补锁只覆盖「同容器」这一形态。
- 「builder prune 并发拖慢构建」仍是宿主指标时序相关性（R469 机制），不是逐层因果。
