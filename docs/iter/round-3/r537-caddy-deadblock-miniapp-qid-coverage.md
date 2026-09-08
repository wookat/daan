# R537：VPS Caddyfile `zalize.com`/`www.zalize.com` 死配置移除（备份 → 精确删两块 → validate → reload → 复验）+ 小程序全部写错题路径 qid/`_sz` 守卫覆盖面核（3 处 `postMistake` + 4 个问答入口全成立，不改码）+ (c)/簇

日期：2026-09-08（UTC 11:1x–11:3x）。统筹者指令：R535 定根因的 Caddy 续期失败「若自己有权限修复请直接修并生产复验；若确需老板侧操作请写明具体一步」。本轮 **0 产品代码、0 应用部署**（生产仍 `8ede6eb7`），唯一生产变更是 VPS `/etc/caddy/Caddyfile`（运维配置，已备份）。#674 已合入 main，本轮从合入后 main 另开分支。

## 0. 结论

1. **Caddy 死块已删、复验通过、无需老板侧操作**（`~/r537/caddy_pre.out` 改前 / `~/r537/caddy_fix.out` 改后，脚本 `~/r537/caddy_fix.sh`）：
   - 改前：`sudo -n` 可用、Caddy `2.6.2` active，Caddyfile 内目标两块逐字与 R535 一致（`zalize.com, www.zalize.com { root * /var/www/landing … }` 15 行 + `http://zalize.com, http://www.zalize.com { redir … 301 }` 5 行，后者注释「DNS-only (not CF-proxied)」已过时）。
   - 操作（11:17:20Z）：`cp -p` 备份到 **`/etc/caddy/Caddyfile.bak-r537`**（md5 前 8 位 `edad92a9`）→ Python 按锚定正则只删这两块（断言两块都命中、删后 `kaogong-origin.zalize.com`/`jobs.zalize.com` 仍在，**428 字节**）→ `caddy validate --adapter caddyfile` → `Valid configuration` → `diff` 只有 `1,15d0` / `78,82d62` 两段删除 → `systemctl reload caddy` → `RELOAD_OK` / `active`。
   - 复验：`kaogong-origin` 回环 + `X-Kg-Edge` → `{"ok":true,"rev":"8ede6eb7"}`，证书 `notAfter=Nov 17 2026` / LE `YE1` 不变；公网 `kaogong.zalize.com` 200 / 0.167 s；`zalize.com` / `www.zalize.com` 公网仍 200 `server=cloudflare`（改前改后同为 CF 边缘站点，源站从未回源 → 用户不可见变化）；兄弟站 `jobs/sco/tickets/k12.zalize.com` 回环 SNI 全 200；reload 后 journal 里 `tls.renew releasing lock zalize.com/www.zalize.com` + `job failed … context canceled` = 那条已失败 17 次、每 6 h 重试的续期任务**被取消**；之后经过 19:18:10 CST 10-min 维护 tick，`journalctl -u caddy --since 19:17:30` 里 `zalize.com`/`www.zalize.com` 相关行 **0**（改前每 10 min 一条 renewal queue）；`kaogong-origin` 错误行 0；源站 reload 后 385 请求 5xx 0（`~/r537/r537_c.out`）。
   - 余下四条 warn 为 `api-video.zalize.com` / `k12.zalize.com` / `api.aicdks.com` / `150-109-230-174.sslip.io` 的「no OCSP stapling」，与本改动无关、reload 前已存在（非 kaogong，不动）。
   - **老板侧：本项无需任何操作。** CF 侧（DNS/控制台）本轮未碰、无凭据，也不需要：公网两域名由 CF 边缘证书（GTS WE1，至 10-30）服务，源站 `/var/www/landing` 现为无人引用的静态目录（未删，随时可由 `.bak-r537` 还原两块）。
2. **小程序全部写错题路径 qid/`_sz` 守卫覆盖面 = 成立，不改码**（源码一手，`miniapp-native/miniprogram`）：
   - `postMistake` 调用点全仓只有 3 处：`pages/practice/practice.ts:682` `question_id: q.id || null`（`:89` 归一化时 `_sz` 题 `id` 已置 null，R521 守卫）；`pkgGrow/daily/daily.ts:362` `question_id: q._sz ? null : q.id || null`（每日一练自带 `_sz` 守卫）；`pkgSocial/ask/ask.ts:456/563`（R536 已核：普通保存带 `r.qid`、同款题有意 `null`）。三处失败均 `enqueueMistake({uid, ...m})` 进离线队列（`utils/offline.ts`）同 payload 重放，不会丢 qid 也不会把 `_sz` id 补回。
   - 复习页（`pages/book` 复习作答）不写 `mistakes`，只 PATCH `review`/`postAnswerLog`，与 H5 同口径；`appendSimilar()` 加练题 `extra:true` 不写 SRS（`book.ts:957`）。
   - 问答入口 qid 覆盖：小程序有 **4** 个入口（H5 6 个）——`pages/practice onDeepExplain` `qid: q.id || null`（`_sz` 已 null）、`pkgLearn/search onAsk` `qid: d.id`、`pkgLearn/practice-history` `qid: q.id`、`pkgSocial/favorites onAsk` `askQid(it.id)`，均经 `openExplain()`/同契约写 `redoQid` storage → `ask.ts:195 askQid(getStorageSync('redoQid'))` → R536 后随 `question_id` 上送。小程序**没有**错题本/模考报告页的「AI 讲解」入口（H5 `book_ask_click`/`report_ask_click`）——功能缺口非缺陷，并入 R528-1 小程序整包，不单立项。
   - 服务端对照：`ai_api.py` 非缓存路径 `meta.qid = extracted.get("qid")`（`_linked()` 只在 `question_id>0` 且题库命中时给）、`save_explain_cache` 落 `qid`；**原文 key 缓存命中分支 `meta0` 不回 `qid`**（`ai_api.py:129–139`）→ 客户端靠本地 qid 保留（H5 `ask.vue:614` `askQid(m.qid) || qid` 早有、小程序 R536 补上）。生产 `explain_cache.qid` 非空恒 0 = 至今没有一条「带 qid 深链 + 题库命中 + LLM 正文完成」的自然请求，指标本身有效（写入路径存在）。不给 `meta0` 补 `qid`：0 真人受益行，先不动，登记 R537-1（P3）。
3. **(c)/簇**（`~/r537/r537_c.out` 11:26Z）：簇 09:34Z 段至 **11:26:12Z 仍在跑**（per10 389/391/260，11h 1040 行/350 IP）、**09-09 00:00Z 日界未到** → R538；非探针非 GET 0；R534 发版后 `/api/mistakes/redo` 0 行（自然样本仍 0）；容器 healthy 0 重启、5xx/Traceback 0；load 1.70 / `/` 3.1G(94%) / MemAvailable 309 MB / SwapFree 3.57G；DB `answer_log 1324 / mistakes 360 / review_log 37 / paper_exports 38 / explain_cache 82`、`explain_cache qid 非空 0`、`mistakes null qid 28`、`max(created_at)` 两表不变、WAL `4,173,592` 同字节 → 0 写入 0 PDF 0 LLM。无新的外部真人证据。
4. **如实**：Caddy 改动是 VPS 上非 kaogong 站点块的运维配置删除（统筹者本轮明示授权），已留 `.bak-r537`；「源站从未回源」沿用 R535 由证书链/页面 body 对比得出的推断，CF 侧配置未查；小程序覆盖面结论只有源码一手（R536 已证请求构造层），无真机/DevTools 运行时；簇归因推断；生产应用段只读；无 testing agent 录屏（未另行授权）。

## 1. Caddy 改动前后（摘自 `caddy_fix.out`）

```
backup /etc/caddy/Caddyfile.bak-r537 edad92a9
removed 428 bytes
Valid configuration
1,15d0  < # zalize.com landing site … zalize.com, www.zalize.com { … }
78,82d62 < # zalize.com is DNS-only … http://zalize.com, http://www.zalize.com { redir https://zalize.com{uri} 301 }
RELOAD_OK / active
{"ok":true,"rev":"8ede6eb7"}  notAfter=Nov 17 03:56:10 2026 GMT  issuer=… Let's Encrypt, CN = YE1
kaogong.zalize.com 200 0.166763 / zalize.com 200 server=cloudflare / www.zalize.com 200 server=cloudflare
jobs 200 sco 200 tickets 200 k12 200
journal: tls.renew releasing lock zalize.com / www.zalize.com; tls job failed [zalize.com] context canceled（续期任务随配置移除被取消）
```

还原（如需）：`sudo cp -p /etc/caddy/Caddyfile.bak-r537 /etc/caddy/Caddyfile && sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy`。

## 2. 登记

- R537-1（P3）：`/api/explain/stream` 原文 key 缓存命中分支 `meta0` 不回 `qid`（非缓存分支回）；客户端两端均已本地保留，无真人受益行 → 有 `explain_cache.qid` 非空自然行后再评。
- R535-2 关闭（死块已删）；R528-1 追加「小程序错题本/报告页无 AI 讲解入口（H5 有）」。
- 环境蓝图：本轮无本机安装/配置，无需更新。

## 3. 下一步（R538）

(c) 补量 + 到期项/簇（09:34Z 段何时停 / **09-09 00:00Z 日界后是否接续** / Caddy 6 h 内 `zalize.com` 续期行是否确认为 0）；四维对标粉笔错题本 P0/P1 下一候选一手核（H5 错题本→复习→掌握闭环里「已掌握」判定后再答错的回流形态 / 错题本「恢复复习」批量对 `_sz` 行 / 复习到期推送与首页到期数同源）→ 命中即论证→实修→本地全绿→发版→复采。
