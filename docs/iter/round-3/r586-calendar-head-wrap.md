# R586：学习日历月份标题 375/360 折行（H5+小程序布局小修）+ R585-2 清理脚本空回执究因（工具修）

日期 2026-09-11 · 分支 `devin/1789055923-r586-calendar-head-wrap`（从 #763 分支开，链含 #742–#763）→ PR #764 · 0 后端 · Pages `index-tCexIcFM → ZlaKqs_J` · health 全程 `ec8206e5`

## 1. 研究（只读）

- 宿主：`~/r586/q586a.out` load 14.7–16.6 / mem_avail 186MB / disk 88.7% / health 1.18s `ec8206e5`；未 kill 未改配置。
- 自然样本 167.3h（POST 6590，剔 probe/harness）：`POST /api/practice_result` 自然 `200×4`、非 2xx / status 0 **0**（500×2/400×2/503×7/502×1 全 harness）；`answer_log 200×53`、`practice/progress 200×29`（p90 ≤0.06s）；`daily_set/submit`/`merge_anon`/`favs` 自然 0 → **R580-1 继续不实施**。
- 375 走查（`~/r586/walk586.py`，uid `test-r586-shots`，7 路由取自 `pages.json`）：calendar / exam list / mastery-map / practice-history / weekly-report / search / reminders，API 全 2xx、console/pageerror 0。**唯一一手缺陷：学习日历月份标题折成两行**。
- 错题本首屏 375（`~/r586/book586.py`，新 uid `test-r586-book` 空态）：favs/review/cur/mistakes/review 同 tick 0.43s 发、3.9–4.3s 全 200，`mastery/map` 回包后 4.27s 发（R584-3 既有登记）；空态文案/CTA 层级正常、`docW ≤ winW` 无横向溢出、console/pageerror 0；两条 `requestfailed` 为底栏 tab 图标 `home-on.png / book.png` `ERR_ABORTED`（uni 切 tab 时换 src 取消在途图片请求，非 API、非用户可感知）。无 P0/P1。

## 2. 缺陷量测（生产同 bundle `index-tCexIcFM`，`~/r586/measure586.py`）

| 宽 | `.cal-head` | `.cal-title` | `.cal-ym` 可用 | 箭头实宽 | 行数 |
|---:|---:|---:|---:|---:|---:|
| 360 | 279 | 179.7 | 92.5 | 39.6 | **2** |
| 375 | 294 | 194.7 | 100.6 | 43.1 | **2** |
| 390 | 309 | 198.8 | 102.8 | 44 | 1 |
| 1440 | 686 | 198.8 | 102.8 | 44 | 1 |

同字体 canvas 量文案：「2026 年 9 月」104.4px、「2026 年 12 月」115.5px（390 也放不下 12 月）；`kg-tag`「本月打卡 N 天」91.3px 不可压。

根因：`.cal-head{display:flex;justify-content:space-between}` 里 `‹ 年月 ›` 与 tag 同行，tag 先占宽后剩余给 `.cal-title`，减两个 44px 箭头 + gap 后不够放年月；`.cal-btn` 无 `flex-shrink:0` 还被压到 <44（`--hit-min`）。

## 3. 设计论证

- 用户可感知：360/375 是主流安卓/iPhone 宽度，一进日历就看到「2026 年 9 / 月」两行 + 箭头缩水。
- 候选：(a) 年月缩字号——治标，12 月仍可能折；(b) tag 换行/缩短文案——丢信息或仍与箭头争宽；(c) **tag 下移到「本月共练 N 题」同一行两端对齐**——两者都是「本月」口径、语义成组，标题行只剩 `‹ 年月 ›` 天然 198.8px 够放到「12 月」；不动数据、不动箭头语义/a11y、不动网格。选 (c)。
- 兜底：`.cal-ym white-space:nowrap`、`.cal-btn flex-shrink:0` 保 44px 热区。
- 小程序 `pkgGrow/calendar` 同结构同 CSS 变量，一起改（运行时无通道，UNTESTED，tsc/lint 过）。

## 4. 实修（`b8e0b20a`）

- `frontend-uni/src/pages/stats/calendar.vue`：tag 从 `.cal-head` 移到 `.cal-sub`（`view.cal-sub{flex; space-between}` > `text.cal-sub-t` + `kg-tag`）；`.cal-head` 去 `space-between/gap`；`.cal-ym` nowrap；`.cal-btn` `flex-shrink:0`。
- `miniapp-native/miniprogram/pkgGrow/calendar/calendar.wxml/.wxss` 同口径。
- 测试 `frontend-uni/tests/r586-calendar-head-wrap.test.js`：量测前提（旧结构 375 可用宽 < 文案宽）+ H5/小程序结构与样式源锁；`stats-r430-secondary-fontfloor` 的 `.cal-btn` `--hit-min` 源锁不变。
- 本地门：H5 eslint 0 / vitest 203 文件 1575 / `build:h5` `index-ZlaKqs_J`；小程序 tsc 0 / lint 0 error / vitest 82；`git diff --check` 空。

## 5. 发版 + 生产复验

- Pages only（`~/r586/pages_deploy.sh`）：线上 bundle `index-ZlaKqs_J` 与本机一致、7 种 Accept-Encoding 全 javascript、7 条回归 URL 200、health 前后 `ec8206e5`。
- 复验（`~/r586/verify586.py`，uid `test-r586-verify`，360/375/390/1440 各一场，`about:blank` 冷进 `/pages/stats/calendar`）：

| 宽 | `.cal-title` | `.cal-ym` | 行数（当月 / 上月 / 回当月） | 箭头 | `.cal-head` 内 tag | 副标题行 | API |
|---:|---:|---:|:--|:--|:--|:--|:--|
| 360 | 198.8 | 102.8 | 1 / 1 / 1 | 44×44 ×2 | 无 | 「本月共练 0 题」x33 + tag x220.7 同行不重叠 | 2 全 200 |
| 375 | 198.8 | 102.8 | 1 / 1 / 1 | 44×44 ×2 | 无 | 同行不重叠 | 3 全 200 |
| 390 | 198.8 | 102.8 | 1 / 1 / 1 | 44×44 ×2 | 无 | 同行不重叠 | 3 全 200 |
| 1440 | 198.8 | 102.8 | 1 / 1 / 1 | 44×44 ×2 | 无 | 同行不重叠 | 3 全 200 |

requestfailed 0、console 0、pageerror 0。截图 `~/r586/shots/v-{360,375,390,1440}-calhead.png` / `-prev.png` / `-full.png`（修前 `~/r586/shots/{360,375,390,1440}-calhead.png`）。

## 6. R585-2 究因 + 工具修（`~/r586/clean586.py` + `run_clean586.sh`）

- 一手：`state()`（41 表命中 + uid 枚举 + 10 张保护表全表 sha256）在宿主上**单趟 27–84s**（同一天四次：84 / 49 / 65 / 27s，随宿主负载漂）；clean 模式 = before + delete + after 两趟 → 慢窗轻松 >170s。`timeout 170` 发 SIGTERM 时 Python 已 `commit()` 但还没到**唯一一句** `print`（在脚本末尾）→ stdout 空、exit 124；R585 launcher 既不落退出码也不落 stderr，只看 stdout 就成了「回执为空」。所以「空回执 + 独立 ro 已删净」完全自洽。
- 修：① commit 后立刻单独吐一行 `{"deleted":…,"committed_at":…}` 再算 after 态（after 被杀也不丢删除回执）；② 逐阶段进度写 stderr（`[  49.5s] committed {...}`）；③ launcher 落 `EXIT`（124 = timeout）+ `stdout_bytes` + stderr 文件，stdout 空时明确打印「不能判成功/失败，须独立 ro 复核」；④ timeout 可调（本轮 400）。
- 本轮清账：`ro 'test-r586-%'` 命中 `{'mistakes': 8, 'practice_results': 1, 'answer_log': 10, 'growth_events': 8, 'daily_set_entries': 1}` 2 uid → clean 删 28 行（逐表相等）→ after `{}` → 独立 `ro` `{}`；共享 `test-r562-modal-%` 42 保持；10 张保护表 digest before == after == 独立 ro。`test-r586-book` 只读走查 0 写入（另 `ro` 核）。

## 7. 如实登记

- UNTESTED：小程序日历运行时/真机（R536-1 累计）；「2026 年 12 月」真实渲染（推算：`.cal-title` 无 space-between 后按内容取宽，44+4+115.5+4+44 = 211.5 < 360 下 `.cal-head` 279，应单行；未到 12 月不能实测，复验里「上个月」= 8 月 单行）；登录态日历；其它浏览器。
- 登记 **R586-1（P3 工具）**：清理脚本 `digest()` 每次全表读 `questions`（10.9 万行）+ `answer_log`，是 ro 单趟 30–80s 的主因；可改成只对目标 uid 相关表做 digest 或用 `PRAGMA data_version`/行数 + 抽样，等下轮。
- 登记 **R586-2（P3 观测）**：uni-h5 底栏切 tab 时 `static/tab/*.png` 在途请求 `ERR_ABORTED`（框架换 src），非缺陷，只为区分 harness/自然 failed 口径。
