# R454：删旧 Caddy 块后只读复验——直打 SNI 无 journal 噪音、库内无新绕边缘 boot；pages.dev 域名扫描器实况（只取证登记，不改码不部署）

- 生产应用仍 `460120f`；宿主 Caddyfile 为 R453 删块后状态（备份 `/etc/caddy/Caddyfile.bak-r453`）。
- 取证时间：2026-09-06 20:38Z（R453 reload）→ 20:50Z；DB 均为 `file:/data/data.db?mode=ro` 只读连接；caddy 日志 = `kaogong-origin.zalize.com-access.log` 实时 + `access-archive/` 归档。
- 结论一句话：R453 删块生效且无副作用；本轮**无缺陷命中、无新真人样本**；顺带抓到一个经 `kaogong-h5.pages.dev` 预览域名的扫描器活体，7 天该域名 37 请求 / 0 POST / 0 库内写入 → 「pages.dev 规范化跳转」登记 P3 不动手。

## 1. 删块后：直打 `kaogong.zalize.com` SNI 的 TLS 握手是否刷 journal

| 项 | 观测 | 说明 |
|---|---|---|
| 直打复测 | `curl --resolve kaogong.zalize.com:443:150.109.230.174 https://kaogong.zalize.com/api/health` → HTTP 000、curl rc=35 | TLS alert，与 R453 删块即时验证一致 |
| 旧块访问日志 | `/var/log/caddy/kaogong.zalize.com-access.log` mtime `2026-09-06 06:07:42Z`，最后一行 `06:07:42Z /api/explain/stream` | 删块（20:38Z）后 0 新行；最后一行早于删块 14.5 h，说明旧块最后一段流量就是 R453 记录的扫描器/直连 |
| caddy journal（reload 后 12 min）error/warn 按 logger | 只有 `http.handlers.reverse_proxy` `aborting with incomplete response` / `http2: stream closed` 48 条 | **不属于 kaogong**：同秒窗口对 5 个 access log 逐个比对，`api-video.zalize.com` 111 条、`jobs.zalize.com` 2 条、`kaogong-origin` **0** 条、旧块 0 条；该错误 7 天分布 09-05 2 / 09-06 22 / 09-07(CST) 1454，04:10 / 04:25 / 04:40 CST 三次成簇，早于 reload（04:38 CST）即已出现 → 兄弟产品 api-video 的客户端中途断流，与 R453 reload 无关 |
| TLS 握手噪音 | journal 中 **0 条** `tls.handshake` / `no certificate available` 类日志 | Caddy 默认日志级别不记录对未知 SNI 的握手失败（直接 alert 断开），因此「删块后是否刷噪音」的答案是**不刷**；如需观察直打量只能靠 `ss`/tcpdump 计数，本轮不加 |
| www.zalize.com 续签 | reload 后只有 R453 已记录的 `context canceled` 一条，未到下一次 attempt | 仍是跨产品既有问题（10-04 到期），本仓库不动 |

## 2. 库内是否再现「无 origin 日志对应」的 boot 事件

`growth_events` 表实际列：`id, uid, event, source, ref, created_at, probe`（不是 `ts/kind/meta`；R454 脚本第一版按错列名跑失败，已纠正）。

近 24 h `event='boot'` 共 **33 行**：
- 32 行 `probe=1`（Devin 网段 GUI/testing agent 走查，含 `test-pr629-*` 显式测试 uid），`ref` 形如 `v:<bundle>;sw:0|1`；
- **1 行 `probe=0`**：`umsagboriz4qyurnd` 09-06 08:58:39Z `h5 v:C20u7mnq;sw:1` = R446 已归因的 vivo 手机 Chrome 第二入口 uid（同一持有者），非新样本；
- **0 行 `probe IS NULL`**、0 行来源不明。

对照：R453 认定为「经旧块绕边缘写库」的 3 个扫描器 uid 逐个复核库内行：

| uid | 来源（R452/R453） | growth_events 行 |
|---|---|---|
| `umti20sltzkr5tv9x` | Firefox 5.0 Ice（`35.232.97.83`，经 pages.dev） | **0 行** |
| `umtgyalle1yy98tka` | ShapBot/0.1.0 | 1 行 `slow_load` probe=NULL 08-31 |
| `umtlhu8rzkjt4shgh` | Palo Alto / iPhone 配对（旧块直打） | 1 行 `boot` probe=NULL 09-03 |

→ 扫描器留下的库内行只有 2 行 NULL（保留不改，R453 结论不变）；删块后 24 h 内无新增。

## 3. 顺带：`kaogong-h5.pages.dev` 预览域名的扫描器活体（20:41:46Z）

删块 3 min 后 origin 日志出现同秒 9 条：

```
20:41:46 34.44.11.77 200 /api/exam/resume?uid=umtqa1ylfslqv9pmd   UA=SonyEricssonW810i/R4EA Browser/NetFront/3.3 ...  referer https://kaogong-h5.pages.dev/
20:41:46 34.44.11.77 200 /api/practice/resume?uid=...             （同 UA）
20:41:46 34.44.11.77 200 /api/review/cur?uid=... /api/announcement /api/home_bundle?uid=... /api/question_counts /api/daily_set /api/questions?limit=10&uid=...
20:41:46 34.44.11.77 200 /sw.js                                   UA=Mozilla/5.0 (X11; Linux x86_64) ... HeadlessChrome/143.
```

- `X-Forwarded-Host` 9/9 = `kaogong-h5.pages.dev`（Pages 函数透传的真实访问域名），`host` = `kaogong-origin.zalize.com`，全部 GET，**0 POST**（没有 `/api/track`），库内 `umtqa1ylfslqv9pmd` growth_events **0 行**、answer_log 0 行。
- UA 是 2006 年功能机描述符 + `/sw.js` 暴露 `HeadlessChrome/143` → 与 R453 iPhone 配对样本同一手法（页面级 UA 覆写、SW 注册请求漏真身）；IP `34.44.11.77` 与 R452 ShapBot `34.44.196.215` 同 GCP `34.44.0.0/16`。
- 日报归类：`crawler_stats.py` 按 `--host` 白名单把非正式域名计 `humans.offhost`（R393），不进 `humans.ips` → 不污染候选真人。

7 天（09-01 起有 `X-Forwarded-Host`）经 pages.dev 的全部流量：**37 请求 / 13 个 IP / 0 POST / 0 引擎 UA / 1 条 Devin 网段**；逐日 IP+UA（非 Devin）：

```
09-01 190.102.106.158 X11 Linux ×1 | 35.232.97.83 X11 Linux ×1 + Firefox Ice ×5 | 94.154.43.129 Win ×1
09-02 149.57.180.14 Mac ×5
09-04 2a0f:ca80:b00b:104::5 Mac ×1 Win ×2 Firefox ×2 Linux ×1 | 93.123.109.53 Mac ×1 | 94.154.43.180 Win ×1
09-05 96.126.130.210 Win ×2
09-06 2001:4ca0:108:42::24 Win ×2 | 34.44.11.77 功能机 ×8 + HeadlessChrome sw.js ×1 | 94.154.43.122 Win ×2
```

全是一次性访客（每 IP ≤ 9 请求、多数 1–2）、`94.154.43.0/24` 三次换尾号、无 referer 链、无作答 → 扫描器/探测器族群，**无真人特征**；也没有任何搜索引擎 UA 抓过 pages.dev 域名（无重复收录风险的一手证据）。

### 处置论证：pages.dev 要不要 301 到正式域名

- 收益：切断扫描器拿「完整壳 + 实时 API」的第二入口（第一入口旧块 R453 已删）；防未来重复收录。
- 成本/约束：`deploy/cf-pages/_routes.json` 把 `/`、`/index.html`、`/static/*` **排除在函数之外**（Pages 迁移原始设计 `3d28c33`：README「静态层由 Pages CDN 直出」；`/assets/*` 后来在 #163 收回函数），函数里按 `url.hostname` 跳转覆盖不到首页壳；要么把 `/` 收回函数（改动 `3d28c33` 静态层设计，需重测首屏/缓存），要么用 CF 账户级 Bulk Redirects（本仓库不可见的宿主配置）。
- 现状危害：7 天 0 POST、0 库内写入、0 引擎抓取、日报已单列 → **无实际损失**。
- 决定：**登记 P3 不动手**；触发条件写进 SKILL：pages.dev 出现 POST `/api/track`/作答、或引擎 UA 抓 pages.dev、或 offhost 日均 > 50，再立项（方案优先 Bulk Redirects，避免改 `_routes.json`）。

## 4. 到期项（只读）

| 项 | R453 | R454 | 说明 |
|---|---|---|---|
| `answer_log probe=0` | 22 行 / 1 uid | **22 / 1**（`umst3tuisd7lgzaka`） | 无新行 |
| `mistakes.error_reason` | 6 行 | **6 行** | 3 个 uid（`umsacie728f4ghcv8`×2、`umsn3fw28a73cn3cc`×1、`u32`×3）的 answer_log probe 全为 NULL（R374 前历史），probe=0 关联 0；`error_reason` 在 `mistakes` 表不在 `answer_log`（脚本第一版查错表已纠正） |
| `push_subs` | 0 | **0** | |
| `weekly_reports` | 1 | **1** | R451 已归因 probe=1 uid |
| `growth_events probe=0` | 18 行 / 4 uid | **18 / 4**（`umsacie728f4ghcv8` 3、`umsagboriz4qyurnd` 6、`umst3tuisd7lgzaka` 8、`umtnitervssy9b344` 1） | 同 R446 |
| `mistakes.next_review` 非 CST 00:00 | 0 / 29 | **0 / 29** | |
| WAL | 3,164,192 B | **3,164,192 B** | 字节数未变：删块后 12 min 内无写入 |
| 容器 | healthy / 0 重启 | **healthy / 0 重启** | 容器起于 09-06 19:41Z 未动 |
| 宿主盘 | 91% / 4.5 G（R452） | **92% / 3.9 G** | `/var/lib/docker` 12 G（镜像 7.2 G + 卷 11.6 G + build cache 3.4 G）；24 h 内新增 >50 MB 文件为 containerd 新层（`python3.12/site-packages/cv2`，非 kaogong 镜像）、softcopyright/recruit 备份；`kaogong-backups` 480 M（R433 468 M，+12 M 正常） |

## 5. 未验证 / 如实说明

- 「api-video `http2: stream closed` 1454 条」只做了归属判定（按同秒 access log 排除 kaogong），根因未查（跨产品，不在本仓库范围）。
- 「Caddy 不记录未知 SNI 握手失败」是按本轮 journal 0 条 + 直打 rc=35 的观测结论，未翻 Caddy 源码/未调 debug 级别验证。
- pages.dev 「无真人」是按 UA 族群/请求形态推断（无 referer、一次性 IP、0 作答），未查 IP ASN；`34.44.11.77` 与 ShapBot 同 /16 只说明同云厂商。
- 宿主盘增长 0.6 G 的精确来源未逐文件核（只到目录级 + 24 h 新大文件清单）。
