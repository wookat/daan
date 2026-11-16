# R473：`inbox` 失败态换路径（先注入登录态再 abort）补齐第 17/17 页 `.retry` 生产一手；SOP-10 §4 硬指标（对比度 / 横向溢出 / console error）R165 以来首次全路由复扫 25 路由 × 2 视口 0 命中；到期项无增量

日期：2026-09-07 04:55–05:10Z。生产仍 `6e82179`（R471b），**本轮 0 行产品代码、不发版**。取证方式：生产 Playwright CDP 只读量测（375 / 1440，`X-Kg-Probe: 1`）、`add_init_script` 往 `localStorage.authToken` 写假 token 后 `route('**/api/**')` 全 abort（inbox）；axe-core 4.x `color-contrast` + `link-in-text-block` 两规则 + 自写「元素越出视口」扫描（25 路由 × 2 视口，非 GET `/api/*` 全 abort，无 DB 写入）；宿主直读卷 `mode=ro` + 源站 caddy 日志（UTC、按 host 过滤）。

## 1. 结论

1. **`pkgA/social/inbox.vue` `.retry` 生产失败态一手补齐，17 页全部闭合**。R471/R472 走不到的原因是 `onShow()` 先 `this.logged = !!getToken()`，`getToken()` 读 `uni.getStorageSync('authToken')`（H5 = `localStorage.authToken`），无 token 直接 `loaded=true` 落登录分支、不调 `load()`。本轮 `context.add_init_script` 在页面脚本前写 `localStorage.authToken='r473-probe-fake'` → `load()` 被调 → `fetchCommentInbox()` 被 abort → `loadErr='request:fail'` → `.retry` 渲染。生产 `6e82179`：
   - 375（360 仿真）：`h=40 w=33.9 top=140.8`，`display:flex`，父 `.empty` flex-column，前一兄弟 `<text class="empty-t">` bottom 133.1 < top（独占行），`elementFromPoint` ±19 命中 / ±21 不命中；
   - 1440：`h=40 w=35.3 top=144`，同上，±19 命中 / ±21 不命中；
   - 截图 `r473_inbox_375.png`：「加载失败：request:fail」上、「重试 ›」下独占一行居中。
   - 假 token 不会造成写入：全部 `/api/**` 在浏览器侧 abort，`readCommentInbox()` 只在 `d.unread` 为真时才调，本路径 `d` 不存在。
2. **SOP-10 §4 硬指标复扫（R464–R472 九轮共改了 20+ 文件 `<style>` 之后）：0 命中**。25 个 H5 路由 × 375/1440：
   - axe `color-contrast` / `link-in-text-block` **0 违例**（R162–R165 对比度治理后首次全路由复核，含 R464–R471 新加的 `.retry` `--brand-text`、chip/tag 抬字号后的节点）；
   - 文档级横向溢出 **0**：`documentElement.scrollWidth == clientWidth`（375→360、1440→1425）全部相等；
   - 元素级「越出视口」7 组命中全部核为**非缺陷**（见 §2b）：exam/list `.fchip` 年份 chip 在 `uni-scroll-view overflow-x:auto` 里（有意横向滚动）；reminders ×4 / discuss ×2 / ask ×1 是 uni `resize-sensor` 的 `visibility:hidden` 探测 div、父 `overflow:hidden` 裁掉；
   - `pageerror` **0**（50 次加载）。
3. **到期项（04:59Z）无增量**：`answer_log` probe=0 33/1、`growth_events` 20/4、`error_reason` 7 / ≥09-11 **0**、`push_subs 0`、`weekly_reports 2`、`exam_attempts` probe=0 1 / 64、healthy 0 重启（`6e82179` 容器 `StartedAt 04:35:18Z`）。(c) R471b 容器起后 kaogong host **90 请求**（R472 54 → 90，增量全是 R472/R473 本机 Playwright，51 带 `X-Kg-Probe`），200=82 / 304=8，`/assets/*` 404 **0**、MiniProgram UA 0、5xx 0，monitor 仍只有 R471 那 1 条；别家 host 0 行。宿主 93% / 3.7 G、load 2.85（本轮无部署、无兄弟构建）、mem_avail 358 MB，守护 prune 04:30 / 04:45Z 各一次（90% → 90%、89% → 88%）。

## 2. 一手证据

### 2a. inbox 失败态

```
375 inbox {"h": 40, "w": 33.9, "top": 140.8, "disp": "flex", "prev": {"cls": "empty-t", "tag": "UNI-TEXT", "top": 113.1, "bottom": 133.1, "disp": "block"}, "sameLine": false, "parentDisp": "flex", "parentFlexDir": "column", "hits": {"0": true, "19": true, "21": false, "-21": false, "-19": true}}
1440 inbox {"h": 40, "w": 35.3, "top": 144, "disp": "flex", "prev": {"cls": "empty-t", "tag": "UNI-TEXT", "top": 116, "bottom": 136, "disp": "block"}, "sameLine": false, "parentDisp": "flex", "parentFlexDir": "column", "hits": {"0": true, "19": true, "21": false, "-21": false, "-19": true}}
```

脚本：`/home/ubuntu/r473_inbox.py`（R472 `r472_retry_ctx2.py` + `add_init_script("localStorage.setItem('authToken','r473-probe-fake')")`）。

### 2b. 硬指标复扫（`/home/ubuntu/r473_axe.py` → `r473_axe.out` / `r473_axe.json`）

路由（25）：home / book / ask / stats / profile / practice / calendar / shenlun / login / exam/list / exam/report?attempt_id=1 / exam/contest / weekly-report / search?q=abc / discuss?qid=1 / inbox / plaza / favorites / interview / interview/history / team / pk / reminders / mastery-map / practice-history。未扫：`exam/exam`、`contest-report`、`share/*`、`poster`、`user/offline`、`team/join`（需 attempt / 分享参数或会跳转）。

| 视口 | axe 违例 | `scrollWidth==clientWidth` | 元素越出视口命中 | pageerror |
|---|---|---|---|---|
| 375 | 0 / 25 | 25 / 25（360） | exam/list、discuss、reminders | 0 |
| 1440 | 0 / 25 | 25 / 25（1425） | exam/list、discuss、ask | 0 |

越出命中逐个核（`/home/ubuntu/r473_ovf.py`）：

| 路由 | 元素 | 几何 | 判定 |
|---|---|---|---|
| exam/list 375 / 1440 | `uni-text.fchip` 年份 chip ×N | right 379…526（375） | 父 `div.uni-scroll-view overflow-x:auto`，横向滚动筛选行，设计如此 |
| reminders 375 | `div` ×4 | l=0 r=400 w=400 | `visibility:hidden`、父 `overflow:hidden` → uni resize-sensor 探测块 |
| discuss 375 / 1440 | `div` ×2 | w=100000 / 490 | 同上，且在 `position:fixed` 的 `.inputbar` 内 |
| ask 1440 | `div` ×1 | w=100000 | 同上 |

## 3. 未验证 / 如实说明

- 375 为 Playwright 360 仿真、真机未量；无 testing agent 录屏（未另行授权）。
- inbox 只验了失败态；有消息态 / 已读回写（`readCommentInbox`）未在生产走到（需真实登录 + 真实消息，本轮不制造）。
- axe 只跑了 `color-contrast` + `link-in-text-block` 两规则（与 R162–R165 治理口径一致），未跑全规则集；对比度只覆盖首屏渲染态，弹层 / 抽屉 / hover / 深色模式未展开（R165 曾分别核过，本轮不重复）。
- 「越出视口 = 非缺陷」依据是元素 `visibility:hidden` + 祖先 `overflow:hidden|auto`；未逐个截图核视觉。
- 0 代码，本轮无新门（沿用 R471b vitest 699/699）。

## 4. 下一步

- 17 页 `.retry` / display 回扫 / 硬指标三条线至此闭合，不再在这条线上加轮次。
- R474 起点：R473 (c) 待下次前端发版再补量；`error_reason` ≥09-11；选下一处四维高价值差距时转「功能深度」维度（字号 / 热区 / 对比度 / 溢出四条 UI 硬指标线 R464–R473 已扫平，再在这条线上加轮次是低价值微修）：先只读盘点 R281–R310 上线的模考报告用时 / 统计锚点 / 目标分 / AI 出口在生产真实回包里的呈现频率（`exam_attempts` 64 条里 probe=0 仅 1 条，是否大多数用户根本走不到这些卡片），再定下一簇。
- 宿主盘 / 守护 prune 参数 / `www.zalize.com` 证书仍待老板定。
