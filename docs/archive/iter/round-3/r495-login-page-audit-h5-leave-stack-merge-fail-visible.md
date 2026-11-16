# R495：登录页 `pkgA/user/login` 375/1440 只读整页审（nudge「去登录」→ 登录页 → 回完成页留存路径 + wxlogin 503 兜底态）——几何/校验/认证错误/SSO/留存全过；命中「H5 刷新/深链直达登录页时成功后**停在登录页**」+「匿名记录合并失败**完全静默**」→ 最小修（`f281539`），生产 `7100b51` → `f281539`

日期：2026-09-07（UTC）。改动：`frontend-uni/src/pkgA/user/login.vue`（新增 `leave()`：`getCurrentPages().length > 1` 才 `navigateBack`，否则 `switchTab('/pages/stats/stats')`；`submit()` / `ssoLogin()` 成功后 `setTimeout(() => this.leave(), 1200)`；两处 `mergeAnon` 的 catch 由空注释改为 toast `MERGE_FAIL_TIP`）、源锁 `frontend-uni/tests/login-r495-leave-merge-fail.test.js`（3 用例）。**不改**：nudge 展示条件 / 关闭语义、认证接口与 payload、`setAuth()` 持久化、合并失败不阻断登录的既有语义、`wxlogin` 503 兜底、小程序端（W7 分支）任何文件；未配置 `WX_MINIAPP_SECRET`。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量（§1）**：R494 容器（12:47:52Z 起）发版前 140 请求 → 本轮发版后新容器（13:19:59Z 起）88 请求，5xx / assets404 / monitor / Traceback / 小程序 UA 异常全 0；非探针非 bot 0、非探针 POST 0；`*_ask_click` 真人 0（探针 4 行）→ `growth_events.ref ↔ explain_cache.qid` 对账无样本；`explain_cache qid` 0/82；`时政且 qid 非空` 0/0；`error_reason` ≥09-11 0；非探针 `mistakes/analysis` / `explain/stream` 0；probe=0 `answer_log` 53/2、growth 26/4；WAL 4,124,152 B 同字节；`umsacie7…` 12:00Z 后仍 0 回访、`umst3…` 仍只有 R493 那 84 请求。
2. **nudge dismiss/fail 真人首行（§1.1）**：`login_nudge_dismiss` / `push_nudge_dismiss` / `push_nudge_fail` 生产各 1 行、**全为 R494 改后探针（probe=1，12:49Z）**，probe=0 仍 0 行；`push_nudge_ok` 0 行、`push_subs` 0 行；`login_nudge_show`/`push_nudge_show` probe=0 仍只有 `umsacie7` 那 1+1 行。R494 埋点在线上等首行，本轮无真人样本。
3. **登录页整页一手（改前生产 bundle `index-JtJc6eiv.js`，CDP 375/1440 探针头，`/api/auth/*` 全 mock、学习类非 GET abort → 0 生产账号 0 库写入 0 LLM，§2）**：375 卡 337×386、字段 306×42、主按钮 306×44、SSO 按钮 306×44、seg 150×40、`docSW 360` 无横向溢出；1440 卡 656 居中（l 488.5）；短手机号 `请输入 11 位手机号`、短密码 `密码至少 6 位`、401 `手机号或密码错误`、SSO 401 `请先在 account.zalize.com 登录后再试`、busy 期间按钮 disabled；成功后 `authToken`/`authUser` 落 storage、匿名 uid 落 `deviceAnonUid`；nudge「去登录」→ 登录页 → 成功 → **回完成页**、登录 nudge 消失、推送 nudge 独立保留（§2.3 的「登录 nudge 残留」首判是 `.loginnudge` class 复用造成的**误判**，剩余卡是「开启每日一练提醒」）。**留存路径本身成立**。
4. **命中 A（verified，改前生产）：H5 刷新/深链直达登录页（页面栈仅 1 页）→ 登录成功 → 1.2 s 后仍停在 `#/pkgA/user/login`**。两次复跑 `after_wait.hash = '#/pkgA/user/login'`、`login:true`。根因（源码 + 运行时）：成功后 `uni.navigateBack({ fail: () => switchTab(stats) })`——H5 的 `navigateBack` 只是 `history.go(-1)` 且**永不进 `fail`**，页面栈 1 页时既回不去也不兜底；同一份 bundle 里 `practice.vue` R379 已按 `getCurrentPages().length > 1` 分流，登录页没有。用户视角：点了登录、toast 报「已合并/登录成功」、页面纹丝不动、再点一次又发一次 `POST /api/auth/login`。
5. **命中 B（verified 源码 + 改前生产）：`mergeAnon` 失败静默**。`catch (e) { /* 合并失败不阻断登录 */ }`——`merge_anon` 503 时无 toast、无 err，用户只知道「登录成功」、不知道本机几十题记录没并进账号；改前 `mergefail` 场景 `after_submit.toast = None`。生产全历史 `merge_anon` 非 2xx 0 次（§1.2）——可达未触发（R484/R491 同性质）。
6. **修法（最小，§3）**：`leave()` 复用 R379 分流；两处 catch 改 toast「已登录，但本机记录合并失败；退出后重新登录会再次合并」（`setAuth()` 在 uid 不同且 `deviceAnonUid` 为空时才写，本轮不改——因此提示中「退出后重新登录会再次合并」依赖 `deviceAnonUid` 已落且 `anonUid` 仍指向旧匿名 uid 的既有路径，见 §5 如实）。门：vitest 743 / eslint rc=0 / build 绿；pytest 511 / ruff / pyright 0。
7. **发版 + 改后一手（§4）**：宿主 avail 6.3 G / load 0.56 / 无兄弟构建 / prunes 0，`--skip-build` 一次 rc=0；容器 `StartedAt 13:19:59.642Z` healthy 0 重启；`pkgA-user-login.VZROEXEt.js` 线上=本机 md5 `6daa4c3f…`，线上分包含新字符串「已登录，但本机记录合并失败」；7/7 200；bundle `index-gUxy9rlY.js` gzip 126 KB；perf `/` 0.99·1.00·1.00·1.00 LCP 927 CLS 0.06 / `/tiku/` 1.00·1.00·1.00·1.00 LCP 935。**生产三点对照**：375 `fresh` → `#/pages/stats/stats` ✓（改前停登录页）；375 `freshmergefail` → toast「已登录，但本机记录合并失败；退出后重新登录会再次合并」+ 1.2 s 后 `#/pages/stats/stats` ✓；375 nudge `ok` → 回 `#/pages/practice/practice?module=ziliao&source=r495`、登录 nudge 消失、推送 nudge 保留 ✓（与改前一致）；1440 `fresh` 卡 656 居中 + `#/pages/stats/stats` ✓。本地 dist 同四场景逐值一致。
8. **wxlogin 503 兜底（只读，§2.5）**：后端 `auth.py` 无 `WX_MINIAPP_SECRET` → `HTTPException(503, '微信登录暂未开通（服务端未配置小程序密钥）')`；小程序 `utils/request.ts` 非 2xx → `reject(new Error(detail))`，`login.ts onWxLogin()` catch → `setData({ err: e.message })` 页内红字显示该文案、`wxBusy` 复位——**兜底文案可达用户**（源码 verified，真机未核）。Caddy 全历史非探针 `wxlogin` 503 共 4 次（09-06 两个出口 IP），说明有人点过微信登录看到了「暂未开通」；4 次里 2 次间隔 2 s 是**重试**（推断：文案没告诉用户「别再点」）。不改：密钥未配是运营决策；小程序 `mergeAnon` catch 同样静默（W7 分支，登记不动）。

## 1. (c) 补量 / 到期项（`~/r495_post.sh` 远端 payload，发版前 `~/r495_post.out` 13:0xZ、发版后 `~/r495_post2.out` 13:2xZ）

| 项 | 发版前（R494 容器 12:47:52Z 起） | 发版后（13:19:59Z 起） |
|---|---|---|
| 容器 | healthy / restarts 0 | healthy / restarts 0 |
| 宿主 avail / load | 6.3 G / 0.56 | 5.9 G / 0.80 |
| WAL | 4,124,152 B | 4,124,152 B（同字节） |
| app log Traceback | 0 | 0 |
| 请求数 | 140 | 88 |
| 5xx / assets404 / monitor / mpUA 异常 | 0/0/0/0 | 0/0/0/0 |
| 非探针非 bot / 非探针 POST | 0 / [] | 0 / [] |
| `*_ask_click` probe=0 | 0（探针 4） | 0 |
| `explain_cache qid` 非空/总 | 0/82 | 0/82 |
| 时政且 qid 非空 | 0 | 0 |
| `error_reason` ≥09-11 | 0 | 0 |
| probe=0 `answer_log` / growth | 53/2 · 26/4 | 53/2 · 26/4 |
| `umsacie7…` / `umst3…` 12:00Z 后 | 0 / 84（R493 那段） | 0 / 84 |

### 1.1 nudge 漏斗（`growth_events`，全表分 probe）

| event | probe | 行 / uid | 时刻 |
|---|---|---|---|
| `login_nudge_show` | 0 | 1/1 | 09-07 11:57:57（`umsacie7`） |
| `login_nudge_show` | 1 | 1/1 | 12:38:52（R494 探针） |
| `login_nudge_dismiss` | 1 | 1/1 | 12:49:11（R494 改后探针） |
| `push_nudge_show` | NULL | 2/1 | 09-02（`u32`） |
| `push_nudge_show` | 0 | 1/1 | 11:57:58（`umsacie7`） |
| `push_nudge_dismiss` | 1 | 1/1 | 12:49:12（探针） |
| `push_nudge_fail` | 1 | 1/1 | 12:49:12（探针） |
| `login_nudge_click` / `push_nudge_ok` | — | 0 | — |

`push_subs` 0 行。真人四类出口仍全 0；R494 埋点在线上等首行。

### 1.2 登录链路生产触达（Caddy 全历史 `…-access*` + `Cf-Connecting-Ip` 判探针）

| 路径 | 状态 | 归属 | 次数 |
|---|---|---|---|
| `POST /api/auth/login` | 401 | probe | 1 |
| `POST /api/auth/register` | 200 / 400 | probe | 2 / 2 |
| `POST /api/auth/sso` | 401 | probe | 4 |
| `POST /api/auth/merge_anon` | 200 | probe | 1 |
| `POST /api/auth/wxlogin` | 503 | **非探针** | 4（09-06 00:11:17Z `39.158.40.85`；08:55:24Z、08:55:26Z 同 IP；21:38:07Z `223.83.2.220`） |
| `POST /api/auth/wxlogin` | 503 | probe | 5 |
| `merge_anon` 非 2xx | — | 任意 | 0 |
| `pkgA-user-login.*.js` 分包加载 | — | 非探针 | 0 |

H5 登录页非探针 **0 次加载**：生产 `users` 16 行全为 8 月账号 + 09-02 两个（`137****`/`139****`，与 `u31`/`u32` 探针时段吻合）。`merged_anon` 表：16 个持 token 用户里多数无 `merged_anon` 行——不能反推「合并失败」（早期版本无该表 / 匿名 uid 与账号 uid 相同就不合并），只读登记。本轮 harness 全部 `/api/auth/*` 走 mock，发版后 auth POST 计数与发版前逐行一致 = 0 生产账号写入。

## 2. 登录页一手（`~/r495_login.py <375|1440> <scen>`，`R495_BASE` 可指本地 dist；改前 `~/r495_login_375_*.out` / `~/r495_login_1440_*.out`）

mock：`POST /api/auth/login|register|sso` 按场景 200 `{token:'r495tok', user:{uid:'u9495',…}}` / 401 `{detail}`；`POST /api/auth/merge_anon` 200 或（`*mergefail`）503；`GET /api/auth/me` 200；`GET /api/questions|submodules|practice/*|review/*|notes|push/pubkey` 假数据；`POST /api/track` 记 `events[]`；其余非 GET abort（`aborted[]` 里可见 `answer_log`/`mistakes`/`practice/progress` 全被拦）。nudge 场景先落 `pstats {type:'object',data:{byModule:…≥30}}` 做 10 题到完成页再点「去登录 ›」；`fresh*` 直接 `goto #/pkgA/user/login`（模拟刷新/深链）。

### 2.1 几何（375 / 1440，`login0`）

| 元素 | 375 | 1440 |
|---|---|---|
| `.card` | 337×386.3，l 11.5 | 656×387，l 488.5（居中） |
| seg 登录/注册 | 150.3×40 ×2 | 同高 40 |
| `.field .input` 手机号/密码 | 306.3×42.2，fs 14.4 | 625 宽 |
| 主按钮「登录」 | 306.3×44.2，fs 15.36 | 625×44 |
| 「Zalize 统一账号一键登录」 | 306.3×44.2 | 同 |
| `.sso-note` | fs 11.52（**<12 px**，登记 §5） | 同 |
| `docSW` | 360（=vw，无横向溢出） | 1425 |

注册态：多出「昵称」字段，主按钮文案「注册」，seg `on` 切换正确。

### 2.2 校验 / 认证错误 / busy

| 场景 | 结果（375 = 1440） |
|---|---|
| `validate` 手机号 `138` | `.err`「请输入 11 位手机号」，0 请求 |
| `validate` 密码 `123` | `.err`「密码至少 6 位」，0 请求 |
| `fail401` | `POST login` 401 → `.err`「手机号或密码错误」，storage 无 token |
| `sso401` | `POST sso` 401 → `.err`「请先在 account.zalize.com 登录后再试」 |
| `hang`（login 不应答） | 按钮 `disabled`、文案「登录中…」，重复点击 0 新请求 |
| `register` | `POST register` 200 → toast「注册成功」/「本机记录已合并到账号」 |

### 2.3 nudge 留存路径（`ok` / `mergefail`，改前）

完成页三卡（到期复习 / 去登录 / 开启提醒）→ 点「去登录 ›」→ `login_nudge_click` 1 条 → `#/pkgA/user/login` → 输入 → `POST login` 200 → `POST merge_anon`（200 或 503）→ 1.2 s → `after_back.hash = #/pages/practice/practice?module=ziliao&source=r495`，`.card.done` 仍在、cards 只剩 `['开启每日一练提醒']`、storage `authToken true / authUser u9495 / deviceAnonUid = 旧匿名 uid`；二次完成 `done2` 同。**首判纠错**：脚本按 `.duenudge, .loginnudge` 收卡，推送 nudge 复用 `.loginnudge` class，首版误记「登录 nudge 残留」——按 `.duenudge-t` 文本判后为推送卡，登录 nudge 已随 `authUser` 消失。留存路径无缺陷。

`direct`（首页 → 登录页 → 成功）：`after_wait.hash = '#/'`（页面栈 2 页，`navigateBack` 正常回退）。

### 2.4 命中 A：`fresh`（直达登录页，页面栈 1 页）——改前两跑

| 跑 | `after_submit` | `after_wait`（+1.2 s +2 s） |
|---|---|---|
| `r495_login_375_fresh` | toast「本机记录已合并到账号」，`authToken true` | **`#/pkgA/user/login` · `login:true`**（停留） |
| `r495_login_375_fresh2` | 同 | 同 |

运行时：页面 context `typeof getCurrentPages === 'undefined'`（`window` 上无此全局，只在 bundle 作用域可用）、`history.length 2`（新 tab 首个 about:blank + 登录页）——`navigateBack` 执行 `history.go(-1)` 回到 about:blank 或什么都不做，取决于浏览器，两跑都停留。源码：`practice.vue` R379 注释「H5 的 navigateBack 只是 history.go(-1) 且永不 fail」，同 bundle 已有分流先例，登录页漏做。

### 2.5 wxlogin 503 兜底（只读源码）

- `backend/app/auth.py api_wxlogin()`：`os.environ.get('WX_MINIAPP_SECRET','')` 为空 → `raise HTTPException(503, '微信登录暂未开通（服务端未配置小程序密钥）')`，在调 `wx.login` code 换 openid 之前，不打微信接口。
- `miniapp-native/miniprogram/utils/request.ts`：`statusCode` 非 2xx → `detail = body.detail`；401/403 含「未登录/登录已过期/重新登录」才走清 token；否则 `reject(new Error(detail || 'HTTP 503'))`。
- `pages/login/login.ts onWxLogin()`：`catch (e) → setData({ err: e.message })`，`finally wxBusy=false`——页内 `.err` 显示后端文案，可再点。`mergeAnon` catch 同 H5 改前一样静默（W7 分支，不动，登记）。
- 生产：非探针 503 共 4 次（§1.2），2 次间隔 2 s 同 IP = 用户看到文案后又点了一次（推断）。文案没有「请用手机号登录」引导——登记不改（W7 分支 + 无更多样本）。

## 3. 修法（`f281539`）

```js
const MERGE_FAIL_TIP = '已登录，但本机记录合并失败；退出后重新登录会再次合并';
// methods
leave() {
  // H5 的 navigateBack 只是 history.go(-1) 且永不 fail：深链/刷新直达（页面栈仅 1 页）时会停在登录页
  if (getCurrentPages().length > 1) uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/stats/stats' }) });
  else uni.switchTab({ url: '/pages/stats/stats' });
},
// submit() / ssoLogin() 成功尾：
setTimeout(() => this.leave(), 1200);            // 原 setTimeout(() => uni.navigateBack({ fail: … }), 1200)
// 两处 mergeAnon catch：
} catch (e) { uni.showToast({ title: MERGE_FAIL_TIP, icon: 'none', duration: 2500 }); }   // 原 /* 合并失败不阻断登录 */
```

- 兜底页选 `/pages/stats/stats`（沿用原 `fail` 分支目标，登录后最相关的是账号/统计页）。
- 合并失败仍不阻断：`setAuth()` 已执行、token 落 storage、正常离开；只多一条 toast（`icon:'none'` 2.5 s，比成功 toast 长 0.5 s）。
- 源锁 `tests/login-r495-leave-merge-fail.test.js`：① `leave()` 按 `getCurrentPages().length > 1` 分流且 else 走 `switchTab(stats)`；② `submit`/`ssoLogin` 方法体走 `this.leave()`、不含 `uni.navigateBack`；③ 两处 `await mergeAnon(anon)` 的 catch 必 `showToast(MERGE_FAIL_TIP)` 且常量文案锁定。改前 3/3 红。
- 门：vitest 99 文件 743 / eslint rc=0 / `build:h5` rc=0（`pkgA-user-login.VZROEXEt.js`）；pytest 511 / ruff / pyright 0（后端未改，按流程重跑）。

## 4. 发版 + 三点对照

### 4.1 本地 dist（`python3 -m http.server 8795`，`ln -sf static/sw.js dist/build/h5/sw.js`，`R495_BASE=http://localhost:8795`）

| 场景 | 结果 |
|---|---|
| 375 `fresh` | `after_submit` toast「本机记录已合并到账号」→ `after_wait.hash = #/pages/stats/stats` ✓ |
| 375 `freshmergefail` | toast「已登录，但本机记录合并失败；退出后重新登录会再次合并」→ `#/pages/stats/stats` ✓，`authToken true` |
| 375 nudge `mergefail` | 回完成页、cards `['开启每日一练提醒']`、toast 合并失败 ✓ |
| 375 nudge `ok` | 回完成页、登录 nudge 消失、推送 nudge 保留 ✓ |

harness 噪音（如实）：本地 stats 页 mock 不全 → 分包 `TypeError` + monitor `ERR_FAILED`（`/api/monitor/report` 被 abort），是脚本 mock 覆盖面问题，不是登录页缺陷；`fresh` 跳转后脚本仍尝试再点登录按钮 → `Locator.click Timeout`（核心断言已在之前取到）。

### 4.2 部署（`~/r495_deploy.log`）

4-pre：avail 6.3 G / load 0.56 / 兄弟构建 0 / prunes 0 → `--skip-build` 一次 rc=0；compose `Recreated → Started`，`KG_COMPOSE_EXIT rc=0 13:19:59Z`；容器 `StartedAt 2026-09-07T13:19:59.642Z` healthy 0 重启；7/7 200；`index-gUxy9rlY.js` gzip 126 KB ≤ 160；perf `/` 0.99 / a11y 1.00 / bp 1.00 / seo 1.00 / LCP 926.77 / CLS 0.06；`/tiku/` 1.00·1.00·1.00·1.00 / LCP 935.12 / CLS 0.00。线上 `pkgA-user-login.VZROEXEt.js` md5 前缀 `6daa4c3fe7e6` = 本机；grep 到「已登录，但本机记录合并失败」。部署窗口 Caddy 非探针 0 请求。

### 4.3 生产（`~/r495_prod_{375_fresh,375_freshmergefail,375_ok,1440_fresh}.out`，探针头，`/api/auth/*` 全 mock）

| 场景 | 改前 | 改后 |
|---|---|---|
| 375 `fresh` | 停 `#/pkgA/user/login` | **`#/pages/stats/stats`** ✓；`calls_after` 恰 `login` + `merge_anon` 各 1 |
| 375 `freshmergefail` | 无 toast（改前无此场景，按 `mergefail` 推） | toast「已登录，但本机记录合并失败；退出后重新登录会再次合并」+ `#/pages/stats/stats` ✓，`merge_anon` 503 1 次 |
| 375 nudge `ok` | 回完成页 / 登录 nudge 消失 / 推送 nudge 保留 | 同 ✓（`back_calls` = login + merge_anon） |
| 1440 `fresh` | — | 卡 656×387 l 488.5、`docSW 1425`、toast 合并成功、`#/pages/stats/stats` ✓ |

harness 噪音（如实）：`fresh` 落到 stats 页后，页面用 mock token `r495tok` 请求生产 `GET /api/checkin/summary|shenlun/stats|growth|recommend|exam/attempts?uid=u9495` → **403**（服务端拒绝非本人 token 读，只读、无写入、`u9495` 不存在），属 mock token 与生产后端不匹配，不是产品错误；`errs` 全为该 403 的 `Failed to load resource`。生产 auth POST 计数发版前后逐行一致，0 账号写入。

## 5. 如实 / 未验证 / 登记

- **verified**：§1 全部数值；§2.1–2.4 改前生产、§4.1 本地、§4.3 改后生产逐值；`wxlogin` 503 服务端与小程序 catch 路径（源码）；线上分包 md5。
- **推断**：`wxlogin` 503 同 IP 2 s 两次 = 用户重试；`umsacie7`/`umst3` 身份仍不确定。
- **未验证**：CDP 非真机（无 TabBar 高度、无软键盘遮挡）；SSO 成功路径只 mock（`account.zalize.com` 真实 cookie 未测）；小程序真机 `wxlogin` 503 文案外显未核（源码 verified）；`leave()` 在 `history.length` 更大但页面栈仍 1 的 H5 场景（外站 → 深链）按 `getCurrentPages()` 判、与 R379 同源，未单独构造。
- **提示文案的依赖（源码 verified，运行时未复验）**：「退出后重新登录会再次合并」依赖 `api.js clearAuth()`：`dev = getStorageSync('deviceAnonUid'); if (dev) setStorageSync('anonUid', dev)`——退出后 `anonUid` 回到旧匿名 uid，再登录时 `anon !== r.user.uid` 成立、再次 `mergeAnon`；`setAuth()` 只在 `deviceAnonUid` 为空时写入，首次登录必落。本轮未跑「退出 → 重登 → 再合并」运行时用例，登记为下一轮只读核项。
- **登记不改**：`.sso-note` 11.52 px（<12 px，说明性小字、非可点）；`.err` 无 `role=alert`；`merged_anon` 表覆盖不全（历史版本）；小程序 `login.ts` 两处 `mergeAnon` catch 静默（W7 分支）；`wxlogin` 503 文案无「改用手机号」引导；`WX_MINIAPP_SECRET` 未配（运营决策）。
- 本轮 0 生产账号、0 学习写入、0 LLM；无 testing agent 录屏（未另行授权）。

## 6. 脚本 / 输出

`~/r495_login.py`（场景 `ok|fail401|mergefail|sso401|validate|register|direct|fresh|freshmergefail|hang`，`R495_BASE` 可指本地 dist）；改前生产 `~/r495_login_{375,1440}_<scen>.out` + `~/r495_login_*_<scen>_{375,1440}.png`；改后本地 `~/r495_local_375_{fresh,freshmergefail,mergefail,ok}.out`；改后生产 `~/r495_prod_{375_fresh,375_freshmergefail,375_ok,1440_fresh}.out`；补量 `~/r495_post.sh`（远端 payload）→ `~/r495_post.out`（发版前）/ `~/r495_post2.out`（发版后）；部署 `~/r495_deploy.log`；后端门 `~/r495_backend_gate.out`。
