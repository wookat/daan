# R470 SOP-10 四维审计：主循环三页强制只读读数（0 命中）+ 模考簇（卷库 / 考试 / 成绩报告 + 排名卡组件）字号下限与热区修复；新 4-pre 让行首次实跑

日期：2026-09-07 02:00–03:20Z。生产 `aa29e52` → `6047881`。取证方式：源码 `<style>`/模板逐 `@click` 核 + 生产 Playwright CDP 只读量测（375 / 1440，`X-Kg-Probe: 1`，非 GET 全 abort，`/api/exam/start` 在浏览器侧拦截并用 `/api/exam/papers/{pid}` + `/api/questions` 两个 GET 合成回包，**不建 attempt、无 DB 写入**）+ 宿主直读卷 `mode=ro` + 源站 caddy 日志。
改动：前端 4 文件 `<style>`（0 行模板、0 后端）+ 1 源锁。竞品维度：粉笔模考/报告页仍无一手截图，**零竞品陈述、不据二手加功能**。

## 1. 结论

1. **主循环三页（SKILL R465 新条强制项）：0 命中，不改。** 生产 375/1440 一手：
   - home `.ld-x` 40 / `.ann-x` 40 / `.tk-row` 52.3 / 55（整行可点，±21 全命中，R467 反向锁）；
   - book `.seg-i` `.pbadge-hit` `.mg-go` `.recap-h` 全 40（±19 命中 / ±21 不命中）；
   - practice `.tag` 40 / `.op` 40 / `.fontbtn` 盒 19.9 / 20 **但命中带 −21…+19 全命中**（R465 `::after` 42px 在生产生效）→ 视觉 20 的图标钮不是缺陷。
   - 字号：三页 1440 `<11.9px` 叶节点 **0**；375 计数（home 56 / book 138 / practice 6）全是 24rpx 在 360 仿真下的 11.52px（R460 已知仿真差异，1440 同节点 12px），非 <24rpx 源规则。
2. **选簇 = 模考簇 `pkgA/exam/list.vue` / `exam.vue` / `report.vue`（+ 报告页内 `components/rank-card`）**：08-04 `39844b6` 建页起从未过 R410+ 字号/热区审计（`docs/iter/round-3/` 只有 design-r283–r306 设计文档，无审计文档；R430/R440/R450/R460 四次选簇都没含它）。
   - **字号**：源码 `20–23rpx` 共 **list 9 / exam 5 / report 21 / rank-card 7 = 42 处**（375 下 10–11.5px）→ 全部 `24rpx`。改前生产 1440 `<11.9px` 叶节点 list **490** / report 36 / 报告详情 36 / exam 4；改后 1440 全部 **0**（375 剩余计数全为 11.52px 仿真差异）。
   - **热区（按模板逐个核 `@click`，只对可点元素补 40px）**，改前生产 375 / 1440 一手 → 改后：
     | 元素 | 页 | 改前 | 改后 |
     |---|---|---|---|
     | 答题卡 ✕ `.sheet-x` | exam | 27.7 / 28 | 40（负外边距，`.sheet-h` 28 不抬） |
     | 答题卡题号格 `.acard-n` | exam | 38.4 / 40（`80rpx`，375 仿真 38.4） | 40 min（`min-width/height: 40px`，去 `line-height` 改 flex 居中） |
     | 报告题号格 `.qn` | report | 36.5 / 38 | 40 |
     | 详情弹层 ✕ `.sheet-x`（收藏 ★ 同类） | report | 27.7 / 28 | 40 |
     | 错因 chip `.drz` | report | 源码无 min-height | 40（本 attempt 无错因行、生产未渲染，源锁） |
     | 练同类题行 `.dreinf` | report | 34.3 / 37 | 40 |
     | 「看不懂？AI 详解本题」`.dask` | report | 18 / 19 | 40 |
     | 「题目有问题？纠错」`.report-link` | report | 21.7 / 23 | 40 |
     | ‹ 上一题 / 下一题 › `.dnav-btn` | report | 37.3 / 39 | 40 |
     | 「全部题目」`.dnav-mid` | report | 33.3 / 35 | 40 |
     | 纠错类型 chip `.rp-chip` | report | `min-height: 44rpx`（=22px，R465 同类无效值） | 40（1440 一手 40；375 两行 87.7 = 2×40 + gap） |
     | 加载失败「重试」`.retry` | list / report | 无 min-height | 40（生产无失败态，本地 dist + 源锁） |
     `elementFromPoint` 命中带全部 ±19 命中 / ±21 不命中（W=375 与 1440 一致）。
   - **有意不改（语义核后）**：`.dopt` 报告详情选项 37.3 / 38.8——只展示对错、**无 `@click`**；`.mod` 模块标签、`.lg` 图例、`.acard-foot` 已答统计、`.dstat` 用时、`.note` 说明、`.wrow-s` `.prow-tag` `.prow-v` 报告统计副文、rank-card `.r-col-l` 分数轴刻度 / `.r-hint` 分段提示 / `.r-k`——全是纯信息标签，只抬字号不撑高；卷库 `.fchip` `.pbtn` `.paper-top` `.arow` 原有 44px 保留（源锁反向锁住不回退）。
   - **无一手不加**：粉笔报告页「能力雷达 / 全站分位」等只在二手描述里见过，不加。
3. **新 4-pre 让行首次实跑（R469 改动）**：02:43Z 起点 `other_builds=1 prunes=0`（`/opt/SoftCopyrightAgent` 的 `docker compose up -d --build` 已跑 45 min）→ 每 15 s 一次 WAIT ×18 → **300 s 后 WARN 继续重建**（符合设计：只避起点撞车、不阻塞）；本轮窗口内守护 cron 02:45 / 03:00Z 两次触发但盘 89–91% 的 `after guard` 未见 prune 进程（`prunes=0` 全程），让行分支的 prune 路径本轮没被触发。
   构建再次离群：`#10 pip 412.8 s` + `#16 exporting layers 344.1 s`，总 **~1500 s**（02:43:24Z → `KG_COMPOSE_EXIT rc=0 at 03:08:40Z`），与 R467/R468 同形态（同机别家 build 并发 + load 12–16 / mem_avail 180–340 MB）；600 s 轮询按 R468 新文案 FAIL 退出 → 等 rc=0 → `DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` rc=0（4a rev 6047881 一致、Pages、bundle `index-D_ZUYBdC.js` 校验、7 编码变体、回归全 200、perf `/` 0.96 / `/tiku/` 1.00）。重建窗口 02:43–03:08:40Z 源站 256 请求 **200 249 / 304 7、5xx 0**；旧容器全程对外。
4. **到期项（03:12Z，宿主直读卷）无增量**：`answer_log` probe=0 33/1、`growth_events` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs 0`、`weekly_reports 2`、`exam_attempts` 64（probe=0 **1**，R283 起唯一一条，历轮已登记）、healthy 0 重启。
   (c) 新容器起后 3062 请求（含部署 4b 预热、Lighthouse、本轮探针）：`/assets/*` 404 **0**、`/api/monitor/report` 0；非 2xx = `/api/health` 403 ×6 + `/` 403 ×2（无边缘头直连扫描，R388）、`/api/auth/wxlogin` 503 ×1（`WX_MINIAPP_SECRET` 未配，已登记）、`/sitemap-questions-12.xml` 404 ×1（索引只到 11，爬虫存旧分片，R437 已登记）。

## 2. 一手证据

### 2a. 改前生产读数（`aa29e52`，W=375 / 1440，`/home/ubuntu/r470_prod.json`）

```
exam 答题卡  .sheet-x h=27.7/28   .acard-n h=38.4/40 (hits ±19 ✓ ±21 ✗ 仅 1440)
report      .qn 36.5/38  详情 .sheet-x 27.7/28  .report-link 21.7/23  .dnav-btn 37.3/39  .dnav-mid 33.3/35  .dreinf 34.3/37  .dask 18/19
<11.9px 叶节点 1440：list 490 / exam 4 (tbtn, acard-foot, kbd-note, SPAN) / report 36 / 详情 36
```

### 2b. 改后生产读数（`6047881`，03:10–03:13Z，`r470_verify2.py` / `r470_small1440.py`）

```
W=375  exam .sheet-x 40×40 hits{-21:F,-19:T,0:T,19:T,21:F}  .acard-n 40×40 同  .sheet-h 28  .lg 11.52px  .acard-foot 11.52px  .mod 11.52px
       report .qn 40×40 同  详情 .sheet-x 40×40  .dreinf 40  .dask 40  .report-link 40  .dnav-btn 40×125.3  .dnav-mid 40×67.2  .dopt 37.3(无 @click)
       纠错弹层 .sheet-x 40  .rp-submit 44  chip 容器 87.7(两行)
W=1440 全部同值 40；.lg/.acard-foot/.mod/.dstat/.note/.report-link/.dnav-mid 12px；.qn 12.5px
<11.9px 叶节点 1440：list 0 / report 0 / 详情 0
```

截图（375）：改前 `r470_prod_exam_card_375.png` / `r470_prod_report_375.png`；改后 `r470_post_exam_card_375.png` / `r470_post_report_detail_375.png` / `r470_post_report_qc_375.png`（附 PR #619 评论）。

### 2c. 本地门

vitest **664/664**（+5：4 页无 <24rpx + list / exam / report 三条热区源锁，含 `.rp-chip` 不得 `min-height: Nrpx` 的 R465 同类反锁）、eslint 0、`build:h5` 通过；本地 dist（`localhost:8466`，API GET 中继生产）预检数值与 2b 逐项一致。
源锁第一版 `expect(css).not.toMatch(/min-height:\s*\d+rpx/)` 误伤 `.rp-detail`（纠错正文 textarea `min-height: 140rpx` 合法）→ 收窄到 `.rp-chip`，不是为了过而改断言。

### 2d. 部署一手（`/home/ubuntu/r470_deploy1.log` / `r470_deploy2.log`）

```
02:43Z  host: mem_avail=311MB disk_avail=5.3G(89%) load=16.68 other_builds=1 prunes=0
        WAIT ×18（15 s） → WARN: 300s 后仍有其它 build/prune 在跑，继续重建
        宿主：PID 761180 docker compose … up -d --build（/opt/SoftCopyrightAgent，etimes 2691 s）
        #10 pip DONE 412.8s   #11 COPY 23.6s   #16 exporting layers DONE 344.1s
        FAIL: 600s 内 compose 未退出（新文案 4 行）→ KG_COMPOSE_EXIT rc=0 at 03:08:40Z
03:09Z  DEPLOY_RESUME=1 … --skip-build → 4a rev 6047881 OK → 4c Pages → 5 bundle OK → 6 回归全 200 → 6b perf 0.96 / 1.00 → rc=0
守护日志：02:45:02 triggered at 90% after 89%；03:00:01 triggered at 91% after 91%（prunes 进程本轮 4-pre 期间 0）
```

### 2e. 到期项 / (c)（03:12Z）

```
probe0_answer_log|33|1  growth_probe0|20|4  error_reason|7|0  push_subs|0  weekly|2  exam_attempts probe0 1 / total 64
container healthy restarts=0 started=03:08:34Z
源站 02:43–03:08:40Z n=256 {200:249,304:7}；03:08:40Z 起 n=3062 {200:3001,304:49,302:2,404:1,403:8,503:1} assets404=0
```

## 3. 如实说明（验证过 / 没验证过）

- 375 为 360 仿真直读、真机未量；11.52px 是 24rpx 仿真差异（1440 同节点 12px）。无 testing agent 录屏（未另行授权），量测为 Playwright CDP 只读脚本。
- `.drz` 错因 chip / list·report `.retry` 失败态 / 报告「练同类题」跳转后页面 未在生产真实走到（本 attempt 无错因行、生产无失败态），按源码 + 本地 dist 同规则 + 源锁。
- 报告页 `[class*=type]` 选择器在 375 抓到的是 chip 容器（两行 87.7），单个 `.rp-chip` 40 只在 1440 与本地 dist 直读到；`.rp-chip` 375 单值按源锁 + 同规则推断。
- 考试页量测用浏览器侧合成的 `/api/exam/start` 回包（`multi:false`、无答案），只为渲染答题卡几何；交卷 / 计时到点 / 续考进度门控（R415）未走。
- 4-pre 的 prune 让行分支本轮没被真实触发（`prunes=0` 全程），只有 build 让行分支走通；prune 分支仍只有 R469 的宿主模拟循环证据。
- 构建 ~1500 s 归因「别家并发 build + 层缓存」是 `etimes` + 宿主指标相关性，未逐层核 `buildx du`。
- rank-card 同时被 `pkgA/exam/team.vue`（如有）等复用，字号抬升对其它挂载点未逐页量测；组件无 `@click`，只有字号改动。

## 4. 处置 / 登记

- 已修（本轮）：上表 12 类热区 + 42 处字号；源锁 `frontend-uni/tests/exam-r470-audit.test.js`。
- 登记不改：`.dopt` 无点击语义；纯信息标签不撑高；`sitemap-questions-12.xml` 404（R437）；宿主级守护 prune 参数仍待老板定（R469 §4）。
- 下次 SOP-10 审计 ~R480；届时按 SKILL 新条把 practice/book/home + 本簇一并回读。
