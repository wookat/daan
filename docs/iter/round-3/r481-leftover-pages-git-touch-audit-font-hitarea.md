# R481：R410 后从未整页过审的剩余页面一次列全（git 触碰史法）→ 7 处生产 375/1440 一手命中 → 最小修复上线（`6d7259c` → `21bd0c6`）

日期：2026-09-07 06:55Z–07:12Z。改动 7 文件只 `<style>`（`pkgA/user/offline.vue`、`pkgA/social/plaza.vue`、`pkgA/social/poster.vue`、`pkgA/social/inbox.vue`、`pages/team/join.vue`、`pkgA/user/login.vue`、`components/export-confirm/export-confirm.vue`）+ 新增源锁 `frontend-uni/tests/r481-leftover-pages-audit.test.js`；0 模板、0 后端、0 库写入。

## 0. 结论

1. **清单一次列全**：R473 未扫路由 + R479 下一步点名的候选，按 `git log --oneline 6d7259c -- <path>` 查 R410 起触碰史：`share/*`（`share-q.vue` / `pk-result.vue`）**R450 已整页过审 → 剔除**；其余 7 处 R410 起只有 R471 `.retry` 单点（plaza / inbox）或 0 触碰（offline / poster / join / login / export-confirm）→ 从未按「≥24rpx / ≥40px」规则整页过审。
2. **改前生产一手命中（`6d7259c` bundle `index-DoCoVd0k.js`，375=360 仿真 / 1440）**——按用户真会走到的顺序：
   - 导出弹层 `export-confirm`（卷库 / 首页 / 错题本共用）✕ `.sheet-x` **22.7×26.6 px**（1440 24×27.7），`.opt-note` 22rpx；
   - 离线题包 `offline.vue` 每行「下载 / 更新 / 删除」`.act` **27.5 px**（1440 29），`.hint/.sub2/.hint2` 21–22rpx（375 渲染 10.56–11.04）；
   - 打卡海报 `poster.vue`「保存图片」/「重新生成」uni `button.btn` **34.3 px**（1440 35.8），`.tip` 22rpx；
   - 讨论消息 `inbox.vue`「去登录」`.login-btn` **34.3 px**（1440 35.8）；有消息态 `.act/.time` 22rpx；
   - 讨论广场 `plaza.vue` `.mod/.cnt/.time` 22rpx（卡片 `.item` 本身 125.7 px、±19/±21 全命中——**父卡即热区，不是热区缺陷**）；
   - 小队邀请 `team/join.vue`「登录 / 注册账号 ›」整行 `.reg-tip` **38.2 px**（1440 38；主按钮 `.act-btn.main` 44 不动）；
   - 登录页 `login.vue`「登录 / 注册」分段 `.seg-item` **38.3 px**（1440 39）。
3. **修法（沿 R479 同规则、不改 display 流）**：字号 <24rpx → 24rpx；`.sheet-x` `min-width/min-height:40px` + `margin:-6px -8rpx -6px 0`；`.act`（父 `.pkg` 已 flex）`inline-flex + min-height:40px + border-box`；`.btn/.login-btn` `line-height:40px + min-height:40px`；`.reg-tip/.seg-item` `min-height:40px + border-box`（`.seg-item` 父 `.seg` 已 flex）。
4. **改后生产一手（`21bd0c6` bundle `index-DJhppeDm.js`，375/1440 均确认加载该 bundle）**：上述 7 组可点元素全 **h=40**、`elementFromPoint` 中心 ±19 命中 / ±21 不命中；1440 页面自有 `<11.9px` 叶节点 offline 5 / plaza 4 / poster 1 / export 1 → **全 0**；375 页面自有叶节点全 ≥11.52（=24rpx 下限）。截图布局无回归（离线行、登录分段、海报按钮、导出 sheet、小队邀请、收件箱列表）。
5. **如实登记一处副作用**：导出弹层 `.sheet-h` 头行 375 **22.7 → 28 px**、1440 24 → 28（R479 问答页 `.sheet-h` 改前就是 28，本组件头行原本更矮，负外边距 -6/-6 只能抵到 28）；肉眼截图头行与「导出范围」间距略增、无重叠，登记不再动。
6. 门：vitest **717/717**（+11 源锁）、`npx eslint src tests` **rc=0**、`npm run build:h5` 绿；部署 `deploy_h5.sh --skip-build` 一次 rc=0（rev 谱系闸 OK、rev 一致、bundle 校验、14/14 200、perf `/` 0.99 LCP 938 / `/tiku/` 1.00、a11y 1.00）。
7. 到期项与观测项（§4）：非探针 `mistakes/analysis` **仍 0**、`explain/stream` 第 2 对 **未出现**、`umst3tuisd7lgzaka` **0 回访**、`error_reason` ≥09-11 **0**；(c) R479 容器窗口 116 请求 / 新容器起 53 请求全本机出口，`/assets/*` 404 / 5xx / monitor / 小程序 UA 全 0。

## 1. 清单：git 触碰史法

| 路径 | R410 起触碰（`git log 6d7259c -- path`） | 整页过审？ | 用户真会走到？ |
|---|---|---|---|
| `pkgA/share/share-q.vue` / `pk-result.vue` | R428（多选判分）、**R450 SOP-10 整页审计** | 是 | 是（分享链路非探针 2 uid） |
| `components/export-confirm` | 0（最近 R164 token） | 否 | 是（卷库「导出 PDF」是主循环页按钮） |
| `pkgA/user/offline.vue` | 0 | 否 | 中（个人页入口） |
| `pkgA/social/poster.vue` | 0（R304 海报功能） | 否 | 中（打卡 / 模考报告出口） |
| `pkgA/social/inbox.vue` | R471 `.retry` 单点 | 否 | 中（讨论有回复时） |
| `pkgA/social/plaza.vue` | R471 `.retry` 单点 | 否 | 中 |
| `pages/team/join.vue` | 0 | 否 | 是（邀请码链路入口） |
| `pkgA/user/login.vue` | 0（R164 / SSO） | 否 | 是（登录是所有同步链路入口） |

## 2. 改前一手（生产 `6d7259c`，375=360 仿真 dpr2 / 1440，`X-Kg-Probe:1`，API 只放 GET、`/api/comments/plaza` 与 `/api/comments/inbox` 浏览器侧 fulfill 占位，0 库写入）

脚本 `/home/ubuntu/r481_scan.py`（叶节点 computed `font-size` <11.9 + 可点元素 bounding box + `elementFromPoint` ±19/±21）、`/home/ubuntu/r481_inbox.py`（`add_init_script` 写裸 `localStorage.authToken` 进有消息态、abort 非 GET 避开 `readCommentInbox` 回写）。日志 `/home/ubuntu/r481_{375,1440}.log`。

### 2.1 可点元素（px）

| 页 | 元素 | 375 h | 1440 h | ±19 / ±21（375） | 判定 |
|---|---|---|---|---|---|
| 导出弹层 | `.sheet-x` ✕ | **22.7**（w 26.6） | 24 | ✗ / ✗ | 命中 |
| 离线题包 | `.act` 下载 ×5 | **27.5** | 29 | ✗ / ✗ | 命中（独立 `@click`，同行「更新 / 删除」共用规则） |
| 海报 | `button.btn` 保存图片 | **34.3** | 35.8 | ✗ / ✗ | 命中（`.btn.retry` 共用规则） |
| 收件箱·登录态 | `.login-btn` 去登录 | **34.3** | 35.8 | ✗ / ✗ | 命中 |
| 广场 | `.item` 卡片 | 125.7 | 131.8 | ✓ / ✓ | 不改（父卡即热区） |
| 小队邀请 | `.reg-tip` 整行 | **38.2** | 38 | ✓ / ✗ | 命中（差 1.8） |
| 小队邀请 | `.act-btn.main` | 44 | 44 | ✓ / ✓ | 不改 |
| 登录 | `.seg-item` ×2 | **38.3** | 39 | ✗ / ✗ | 命中 |

### 2.2 字号 <24rpx（页面自有叶节点，排除 uni tabbar label 10 px）

| 页 | 规则 | 源 rpx | 375 渲染 | 1440 叶节点数 |
|---|---|---|---|---|
| 离线题包 | `.hint` / `.sub2` / `.hint2` | 22 / 21 / 22 | 10.56–11.04 | 5 |
| 广场 | `.mod` / `.cnt` / `.time` | 22 | 10.56 | 4 |
| 海报 | `.tip` | 22 | 10.56 | 1 |
| 导出弹层 | `.opt-note` | 22 | 10.5（1440） | 1 |
| 收件箱·有消息态 | `.act` / `.time` | 22 | 10.56 | — |

## 3. 改后一手（生产 `21bd0c6` bundle `index-DJhppeDm.js`）

日志 `/home/ubuntu/r481_{375,1440}_post.log`、`/home/ubuntu/r481_inbox_{375,1440}_post.log`；截图 `/home/ubuntu/r481_{offline,plaza,poster,inbox_login,inbox_list,join,login,export}_{375,1440}.png`。

| 元素 | 375 h / ±19 / ±21 | 1440 h / ±19 / ±21 |
|---|---|---|
| 导出 `.sheet-x` | 40×40 ✓ ✗ | 40×40 ✓ ✗ |
| 导出 `.sheet-h` 头行 | 28（改前 22.7） | 28（改前 24） |
| 离线 `.act` ×5 | 40 ✓ ✗ | 40 ✓ ✗ |
| 海报 `.btn` | 40 ✓ ✗ | 40 ✓ ✗ |
| 收件箱 `.login-btn` | 40 ✓ ✗ | 40 ✓ ✗ |
| 小队 `.reg-tip` | 40 ✓ ✗ | 40 ✓ ✗ |
| 登录 `.seg-item` ×2 | 40 ✓ ✗ | 40 ✓ ✗ |

页面自有 `<11.9px` 叶节点：1440 offline 5 / plaza 4 / poster 1 / export 1 / inbox 有消息态 → **全 0**；375 全部 ≥11.52（24rpx 在 360 仿真下即 11.52，脚本 `<11.9` 计数仍非 0 但逐项核全为 11.52，是仿真视口口径，与 R465–R479 同判）。收件箱有消息态 `.act/.time` 11.52 / 12，父 `.item` 卡 77 px ±19/±21 命中。

## 4. 观测项（07:10Z，宿主只读）

- 容器 `deploy-kaogong-1` running/healthy，`StartedAt 07:06:34Z`，restarts 0；容器日志 Traceback / `database is locked` / 5xx 0；`/api/health` rev `21bd0c6`。
- R479 容器窗口（06:44–07:06Z）116 请求 = 110 2xx + 6 3xx，全本机出口；新容器起 53 请求全本机（部署 curl / Lighthouse / 本轮 Playwright）；非探针 AI / ask / `umst3tuisd7lgzaka` 0；`/assets/*` 404 0、5xx 0、monitor 0、小程序 UA/Referer 0。
- 到期项无增量：`answer_log probe=0` 33/1、`growth_events probe=0` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs` 0、`weekly_reports` 2、`exam_attempts probe=0` 1/64、`explain_cache` 82 空 0 min 50、WAL 4,124,152 B 同字节。

## 5. 如实说明

- 375 为 360 仿真、真机未量、无 testing agent 录屏（未另行授权）。
- 离线题包「更新 / 删除」态（已下载包）与海报失败态「重新生成」未在生产渲染，与「下载」/「保存图片」共用 `.act` / `.btn` 规则（源码 + 源锁）。
- 广场 / 收件箱有消息态为浏览器侧 fulfill 占位数据（Unix 秒时间戳，首版误用毫秒/字符串致 `NaN-NaN` 为占位数据错误、非产品缺陷）；收件箱已读回写 `readCommentInbox` 被 abort 未走到。
- 「从未过审」按 git 触碰史判定（R450 分享簇按提交信息剔除），非逐轮文档复核。
- `.sheet-h` 22.7 → 28 为改动副作用，已登记，不再补修。
