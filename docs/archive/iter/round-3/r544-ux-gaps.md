# R544（2026-09-08，实现轮·对标粉笔错题本/夸克 生产 UX 走查 → 5 项用户可感知差距实修）

> SOP-04。后端 + H5 + 小程序三端改动，**发 VPS**。竞品口径来自官方公开说明（粉笔 `fenbi.com/page/information-hub-detail/10063`：自动收录 / 按科目模块题型查看 / 重做 / 错因归因 / 移除已掌握 / 「错题本≠收藏夹」；夸克 `scan.quark.cn/intro/183.html`：试卷擦除重练 / 裁剪标注 / 分类成册），**未登录实测两款 App 内部界面**；「固定 A–D 顺序降误触」「统一时间线易理解」属通用可用性推断。

## 1. 差距（一手：生产走查 + 生产库只读统计）

生产 `https://kaogong.zalize.com` rev `74a5d62a` / H5 bundle `ZYsItKK5`，Chrome 仿真 375×812 + 1440×900，隔离 uid `test-r544-ux-20260908`（走查后全表清零），console error 0 / 954 响应全 200。报告 `~/r544-ux/R544-UX-report.md`，录像 `~/screencasts/r544-ux-verified/`、`~/screencasts/r544-home-1440-supplement/`。

| # | 差距 | 级别 | 一手证据 | 根因（源码） |
| --- | --- | --- | --- | --- |
| 1 | 我的 → 「我的收藏 0题」落到错题本**待掌握 3**，需再点「收藏」才见「还没有本机收藏」 | P1 | `favorites-opens-mistakes-{375,1440}.png` | `book.vue` `bookShowFavs` 意图只在 `favs.length` 时切 fav，随后 `tab==='fav' && !favs.length` 又回落 todo |
| 2 | 题 1046897 选项屏幕顺序 **A.517 / D.514 / B.516 / C.515**，重练同题仍如此；判分未错 | P1 | `practice-order-{375,1440}.png`；生产库只读：`questions` 156,792 行中 options 键序非字母序 **200**（活跃 107），`shizheng_questions` 140 行 0 | 导入 `json.dumps(options)` 原样落库；多端按 `Object.keys` 枚举 |
| 3 | 错题卡「点开看答案与详解」`rgb(176,180,192)` 12px 白底 **2.07:1**（AA 4.5:1） | P2 | `book-375.png` computed style | `.hint{color:var(--ink-4)}` |
| 4 | 只练数量（13 题 10 对）：雷达其余四模块显 **0%**，标题「最薄弱」下只有 77% 一项 | P2 | `stats-unpracticed-zero-375.png` | `axes` 未练轴 `{n:0,pct:0}` 模板直出 `a.pct%`；`weakAxes` 已 `n>0` 但 1 项也叫「最薄弱」 |
| 5 | 复习刚答对，同题「历次作答」仍只见初次练习错答 | P2 | `book-history-1440.png` | `question_attempts` 只读 `answer_log`；复习写另一张 `review_log`（无 picked/secs） |
| 6 | 「排列组合」被拆成互不包含的两个筛选标签 | P2 | `book-taxonomy-*.png` | 分类树碎片化，**本轮不做**（需内容侧别名映射，单独立项） |

## 2. 实修（19 文件，#1–#5）

- **#1** `book.vue` `onShow`：`bookShowFavs` 意图**无条件** `tab='fav'`；仅非意图进入且 0 收藏才回落 todo。0 收藏进入即见 `kg-empty-state「还没有本机收藏」`。小程序 `book.ts` 已是无条件切 fav，无改动。
- **#2** `db.py` 新 `options_json(opts)`：键全为单大写字母时按字母序序列化（其余保持原序，`None`/非 dict → `{}`）；`_seed_questions` / `_seed_shizheng` / `import_questions` / `admin_api` 题目编辑四条落库路径统一走它；新 `_normalize_option_order(conn)` 在 `init_db` 末尾一次性重写历史行（`seed_runs` 键 `__option_order_v1` 幂等，`fingerprint` 记改写行数）。**只动键序不动 `answer`/`picked`**（单选按字母判分、多选 `normalize_answer` 排序拼接，与键序无关）。
- **#3** `book.vue` `.hint` `--ink-4 → --ink-3`（`#6b7280` 白底 4.83:1）。小程序 `book.wxss` 同类提示已是 `--ink-3`，无改动。
- **#4** H5 `stats.vue`：轴标签 `a.n ? pct% : '未练'`（`.al-val.none` 用 `--ink-3`）；新 computed `weakTitle`（`weakAxes.length>=2 ? '最薄弱' : '已练模块'`）；按钮 `>=2 ? '去补弱' : '继续练'`。小程序 `kg-chart-radar`（`RadarAxis.n?` + `val` 字段，`index.wxml` 绑 `{{item.val}}`，`.is-none`）+ `stats.wxml` 同文案。`weakAxes`/`hasRadar` 的 W11 `n>0` 口径不动。
- **#5** `review_log` 加列 `picked TEXT / secs INTEGER / via TEXT`（`_ensure_review_log` `PRAGMA table_info` 兼容迁移）；`_advance_review(..., picked, secs, via='review')`，练习 answer_log 连带推进写 `via='answer'`；`/api/review/{mid}` 收 `picked`（`normalize_answer[:8]`）/ `secs`（数值、非 bool、>0）；`question_attempts` 合并两表为一条倒序时间线，每项带 `source: practice|review`，`via='answer'` 行跳过、历史 `via IS NULL` 行与某条练习作答相隔 `<3s` 视为连带推进跳过（旧代码两者同事务写入，间隔 ms 级）。H5 `book.vue` 复习 POST 带 `picked`、历次作答行加「练习/复习」标签；小程序 `postReviewRecord(mid, correct, picked?)`、`recordReview` 三处入口传 picked、`fmtAttempts` 加来源、`AttemptItem` 类型补 `source` 且 `picked/secs` 可空。
- 测试：`backend/tests/test_option_order.py`（+5）、`backend/tests/test_attempts_timeline.py`（+4：合并+source、`via=answer` 不重复、legacy 时间去重、picked/secs 清洗）；`frontend-uni/tests/r544-ux-gaps.test.js`（+9：源锁 + `stats.vue` computed 真跑 1 模块/2 模块口径 + 小程序同口径源锁）；`stats-w11-weak-axes.test.js`（W11 `n>0` 口径 + 最薄弱行 `rs-pct` 直出）无需改动仍过。

## 3. 门（全绿）

pytest **606**（R542 基线 599，+9 — 见上）/ ruff 0 / pyright 0；frontend-uni eslint + lint:tokens + lint:edge 0 / vitest **146 文件 994**（基线 985）/ build:h5 ✓；miniapp tsc 0 / eslint 0 / design-tokens check ✓；`git diff --check` 空。

## 4. 生产（发版 + 黑盒复验）

发版 `deploy_h5.sh --skip-build`：`74a5d62a → cda7af0d`，脚本内接口回归全 200、bundle 各编码变体校验通过、Lighthouse `/` perf 0.99 / a11y 1.0 / LCP 1087 ms，`/tiku/` perf 1.0。只读核：`seed_runs.__option_order_v1 = '200'`（与走查前统计的 200 行一致）、`questions` 乱序 0、题 1046897 options `A517/B516/C515/D514`、`answer` 仍 `A`；容器 healthy、20 min 内 Traceback 0。

黑盒复验（testing agent，隔离 uid `test-r544-verify-dd47d4d800`，375×812 + 1440×900，bundle `index-CBPOsyWr.js` 与生产 index.html 一致）：报告 `~/r544-verify/R544-production-verification.md`（含 30 张截图），录像 `~/screencasts/r544-cda7af0d-production/r544-cda7af0d-production-edited.mp4`。

| # | 结果 | 一手 |
| --- | --- | --- |
| 1 收藏入口 | PASS | 待掌握 1 / 收藏 0 → 「我的收藏 0题」直落收藏 tab `kg-empty__t「还没有本机收藏」`；tabBar 无意图进入回待掌握 |
| 2 选项顺序 | PASS | 深链练习 / 错题重练 / SEO `/tiku/q/1046897` 三处 A/B/C/D；选 B 判错自动入本（`mistakes user_answer=B correct_answer=A`）、重练选 A 判对 `reviewed {mistake 3278, streak 2}`；另 4 题屏幕 + 20 题接口键序全序 |
| 3 提示对比度 | PASS | `.hint` computed `rgb(107,114,128)` 白底 4.83:1；点击展开正常 |
| 4 雷达口径 | PASS | 单模块（数量 12 次 92%）四轴「未练」/「已练模块」/「继续练」；加练言语 5 全错 → 「最薄弱」/ 言语 0% 首位 / 「去补弱」；双视口截图 |
| 5 历史合并 | PASS | 复习答 A 后历次作答恰两行「复习 A ✓ / 练习 B ✗」，重练后三行无重复；`POST /api/review/3278` body `picked:"A"`；`GET /api/attempts` 项带 `source`；`review_log` 懒迁移后列 `picked/secs/via` 存在，行 325 `via=review picked=A`、行 326 `via=answer` |
| 回归 | PASS | 964 响应全 200、console error / unhandledrejection 0、375 无横向溢出、桌面 Tab 焦点环可见、付费 AI 请求 0；2 条 tab 图标 `ERR_ABORTED canceled` 为切视口刷新取消、非错误 |

清理：41 张含 uid 表精确删 36 行，`test-r544-verify-%` LEFTOVER 0；`explain_cache` 82 行未变。未测：小程序真机、读屏、全量题库/多选选项顺序、AI/PDF。

## 5. 如实 / 风险

- `_normalize_option_order` 生产首启会全表扫 156,792 行 JSON 解析一次（预估秒级），之后 `seed_runs` 命中直接返回；改写 200 行。若 `init_db` 因该步失败会阻断启动——本地新库/含乱序行测试均通过，发版后核 `docker logs` 与 `/api/health`。
- 历史 `review_log` 行无 `picked/secs`（显「选 —」）、无 `via`：只用 3s 时间窗去重，理论上「练习作答后 3s 内又对同题复习」会被误合并（生产 review_log 行少，可接受）。
- 分类碎片化（#6）未做；小程序改动**未上真机/未跑 DevTools**（R536-1 通道缺口仍在），仅 tsc/eslint/源锁。
- H5/小程序复习 POST 仍**不带 `secs`**（复习页无计时器，接口已支持，后续有计时再接）。
