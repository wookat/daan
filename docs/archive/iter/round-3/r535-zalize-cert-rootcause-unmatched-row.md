# R535（2026-09-08，取证轮）：`zalize.com`/`www.zalize.com` 证书续期失败根因（域已切 Cloudflare 代理，Caddy 源站块成死配置）+ 28 条无 `question_id` 错题里唯一未匹配时政表的一行成因（小程序 DevTools 探针「问答页加入错题本」LLM 改写题干）+ (c)/到期项

生产仍 `8ede6eb7`（R534），本轮 0 产品代码、0 部署、0 写入 / 0 PDF / 0 LLM。全部读数来自 SSH 只读（journal / Caddy 访问日志 / `mode=ro` DB）+ 本机 `curl/dig/openssl` 对公网边缘的只读探测。

## §0 结论一览

| 项 | 结论 | 事实 / 推断 / 未知 |
| --- | --- | --- |
| Caddy 续期 `zalize.com` / `www.zalize.com` | **持续失败**：第 17 次重试，已失败 1.5 天（`elapsed 129703 s`），每 6 h 重试一次，`max_duration` 30 天；源站证书 **10-04 16:38Z 到期**。根因：两域名 DNS 已指向 Cloudflare（A `172.67.208.162` / `104.21.15.239`，AAAA `2606:4700:3031::…`），Let's Encrypt 的 http-01 校验打到的是 CF 边缘（错误行里的校验 IP `2606:4700:3031::6815:fef` 就是该 AAAA），边缘回 404；tls-alpn-01 经 CF 无法协商 `acme-tls/1`；ZeroSSL 回落 `HTTP 422 caddy_legacy_user_removed`。 | 事实（journal 逐行） |
| 对用户的影响 | **无**。公网 `https://zalize.com` / `www` 由 Cloudflare 直接服务：边缘证书 Google Trust Services WE1，有效期至 **10-30**（CF 自动管理）；且边缘回的页面（`<title>zalize – Small, honest tools people actually use`，44.5 KB）与 VPS Caddy `/var/www/landing`（`Welcome \| ZALIZE`，21.5 KB）**不是同一站点** → 该域已不回源到本 VPS，Caddy 的 `zalize.com, www.zalize.com` 块与 `http://…` 301 块已是死配置（Caddyfile 注释「zalize.com is DNS-only (not CF-proxied)」已过时）。 | 事实（边缘/源站 body md5 不同、`cf-ray` 头、证书链） |
| 处置建议 | 由老板定：(a) 从 VPS Caddyfile 删掉两块（Caddy 停止无意义续期、journal 不再每 6 h 报错）；或 (b) 保留不动（10-04 后 Caddy 只对直连 VPS IP 且 SNI=zalize.com 的请求给过期证书，公网无人走这条路）。**我不改 Caddyfile**（非 kaogong 资源）。 | 建议 |
| 28 条无 qid 错题里 1 条未匹配 `shizheng_questions` | `mistakes.id 2836`（uid `umtpnlge4mrl9kyxq`，模块 `yanyu` 病句辨析，`question_text` 90 字，`created_at 2026-09-06T10:20:39Z`）。**成因**：同秒 Caddy 日志只有 `POST /api/mistakes` → 紧接 `POST /api/ask/cur`，无 `answer_log`；来源 IP `140.232.64.5`（KG_PROBE_CIDRS 网段）、UA iPhone + Referer `servicewechat.com/touristappid/devtools/` = **微信开发者工具里跑的小程序（兄弟 Devin 会话 W7 走查）**，路径是问答页识题后「加入错题本」。题干是 LLM 识题（R422 无 qid 路径）改写后的 90 字，与题库原题 `1272810` 全文前缀不等、首行前缀相等（`questions LIKE 首行%` 候选 1 条）。 | 事实（DB + Caddy 逐行） |
| 该行对 R534 顺序的意义 | R534 顺序对它正确：时政等值查未命中（0.9 ms）→ 原 LIKE 阶梯（全文% 落空 → 首行%次行% → 首行% 命中 `1272810`），2–3 × 3.34 s 只落在这个探针 uid 的重练请求上。真人 `_sz` 作答回写的 27 行首行 **全部** 精确等于 `shizheng_questions.question`（R534 一手），「首行恒等」在真人有量路径成立。 | 事实 |
| 是否立项 | **不立项**。非时政无 qid 行生产只此 1 条且为探针产物；要根治 LIKE 阶梯需给 `questions.question` 前缀建索引（`substr(question,1,N)` 表达式索引，10.9 万行）——盘 94% 满、收益面为 0 真人行，登记 R535-1（P3，条件：出现真人无 qid 非时政行）。 | 决策 |
| 簇 09:34Z 段 | 至 **10:38:03Z 仍在跑**（10:26–10:37 每分 34–50 行，同 Mac/Win Chrome UA 对，`/tiku/q/*`）→ 「何时停」未到；**09-09 00:00Z 日界未到**，不预判。 | 事实 / 未知 |
| 宿主 | 10:38Z `restarts=0 health=healthy`，load `2.50 2.13 1.78`，`/` **3.1G 可用 94%**（R534 收尾 2.4G → 兄弟栈重建收尾后回 3.1G），无 compose build 进程。 | 事实 |

## §1 证书：journal 逐行（`~/r535/r535_cert2.out`，CST 16:49:47–53 = 08:49Z）

```
tls.renew  renewing certificate  identifier=www.zalize.com  remaining=2274545 s（26.3 天）
tls.renew  renewing certificate  identifier=zalize.com
http.acme_client  trying to solve challenge  zalize.com  http-01  ca=acme-staging-v02（推断：连续失败后 Caddy 先用 staging 试探）
http.acme_client  challenge failed  zalize.com  http-01  403 unauthorized
   "2606:4700:3031::6815:fef: Invalid response from http://zalize.com/.well-known/acme-challenge/atQr…: 404"
http.acme_client  challenge failed  www.zalize.com  http-01  403
   "2606:4700:3031::ac43:d0a2: Invalid response from http://www.zalize.com/.well-known/acme-challenge/nQwa…: 404"
http.acme_client  challenge failed  zalize.com / www  tls-alpn-01  403
   "Cannot negotiate ALPN protocol \"acme-tls/1\" for tls-alpn-01 challenge"
tls.renew  could not get certificate from issuer  issuer=acme-v02.api.letsencrypt.org
   "no solvers available for remaining challenges (configured=[http-01 tls-alpn-01] offered=[dns-01 …])"
tls.renew  could not get certificate from issuer  issuer=acme.zerossl.com-v2-DV90
   "account pre-registration callback: failed getting EAB credentials: HTTP 422: caddy_legacy_user_removed (code 2977)"
tls.renew  will retry  attempt=17  retrying_in=21600  elapsed=129703.85  max_duration=2592000
```

校验 IP `2606:4700:3031::6815:fef` / `::ac43:d0a2` 与本机 `dig AAAA zalize.com / www.zalize.com` 结果**逐字相同**（`~/r535/r535_dns.out`），即 LE 打到的是 Cloudflare 边缘而非本 VPS。

## §2 证书：边缘 vs 源站（`~/r535/r535_dns.out` / `r535_origin.out`）

| | 边缘（本机 → 公网） | 源站（VPS 本地 `--resolve zalize.com:443:127.0.0.1`） |
| --- | --- | --- |
| HTTP | `HTTP/2 200`，`server: cloudflare`，`cf-cache-status: DYNAMIC`，`cf-ray: …-PDX` | `200` |
| 证书 | `CN=zalize.com` / `CN=www.zalize.com`，issuer **Google Trust Services WE1**，`notAfter Oct 30 06:32 2026` | Let's Encrypt YE1/YE2，`notAfter Oct 4 16:38:52 2026`（R534 一手） |
| 页面 | `<title>zalize – Small, honest tools people actually use`，44546 B，md5 `048cebd3…` | `<title>Welcome \| ZALIZE`，21509 B，md5 `7ce2add9…` |
| `/.well-known/acme-challenge/test-r535` | 404（边缘） | — |

两侧 body 不同 → 边缘不是在代理本源站。VPS Caddyfile 相关块（只读 `sed -n`）：

```
# zalize.com landing site
zalize.com, www.zalize.com { root * /var/www/landing  file_server … }
# zalize.com is DNS-only (not CF-proxied), so plain HTTP can safely 301 to HTTPS
http://zalize.com, http://www.zalize.com { redir https://zalize.com{uri} 301 }
```

注释前提（DNS-only）已不成立。`kaogong-origin.zalize.com` 不受影响（直连源站，LE 证书有效期至 **11-17**，R534 一手）。

如实：Caddy 该块无 `log` 指令，journal 24 h 内 `"host":"zalize.com"` 计 0 **不能**作为「无流量」证据（不记访问日志）；「不回源」结论依据是 body/证书链不同。

## §3 未匹配行 2836（`~/r535/r535_unmatched.out` / `r535_u2.out` / `r535_u3.out`）

```
UNMATCHED id 2836 uid umtpnlge4mrl9kyxq module yanyu created 1788690039 (2026-09-06T10:20:39Z)
  head: 下列各句中，没有语病的一句是：
  shizheng like head[:20]%: []                 ← 时政表无此题
  questions like head[:30]%: [(1272810, 'yanyu')]
(2836, 'umtpnlge4mrl9kyxq', 'yanyu', source=None, '病句辨析', user 'A', correct 'B', len 90, times 1, mastered 0)
full-prefix candidates 0   head-prefix candidates 1
other mistakes same uid: (1, 1)        answer_log same uid: 0（含 probe 任意值）
```

Caddy 源站日志（`kaogong-origin.zalize.com-access*.log*` 6 个文件，窗 10:05–10:25Z 340 行）里该 uid / 该秒：

```
10:20:39 POST /api/mistakes 200  140.232.64.5  UA iPhone OS 15_0…  Referer https://servicewechat.com/touristappid/devtools/page-frame.html
10:20:40 POST /api/ask/cur  200  140.232.64.5  同 UA / 同 Referer
```

窗内 101/102 行来自 `140.232.64.{3,4,5}`（KG_PROBE_CIDRS 本机出口），另 1 行非探针为无关 GET。`touristappid/devtools` = 微信开发者工具未绑 AppID 的小程序预览（W7 兄弟会话走查小程序）；「先 `POST /api/mistakes` 无 `question_id`、紧接 `POST /api/ask/cur`」是问答页识题后「加入错题本」的形态（H5 `pages/ask/ask.vue save()` 同形态但会带 `askQid(r.qid)`；小程序端此次未带）。题干 90 字与库题 `1272810` 全文前缀不等 → 是 LLM 识题输出的改写题干（R422 无 qid 路径），非时政题、非真人。

## §4 (c) / 簇 / 宿主（`~/r535/r535_cert_cluster.out` 10:34Z / `r535_cluster3.out` 10:38Z）

- 簇：`per-min [10:26 41, 10:27 36, 10:28 46, 10:29 43, 10:30 34, 10:31 50, 10:32 38, 10:33 38, 10:34 40, 10:35 39, 10:36 43, 10:37 40, 10:38 1]`，`last 2026-09-08T10:38:03Z` → 09:34Z 段 **64+ min 仍在跑**；日界未到。
- 宿主：`restarts=0 health=healthy`，load `2.95 1.93 1.64`（10:34Z）→ `2.50 2.13 1.78`（10:38Z），`/` 3.1G 94%（R534 收尾 2.4G 95% 已回落）。
- DB/WAL 未重采（本轮无部署、R534 10:3xZ 已核 `1324/360/37/38` + WAL 同字节；本轮脚本全 `mode=ro`）。

## §5 登记

- **R535-1（P3）**：非时政无 qid 行的 `questions LIKE` 阶梯每阶 3.34 s（生产仅 1 行且为探针产物）；根治需 `questions(substr(question,1,N))` 表达式索引，盘 94% 满不动；条件：出现真人无 qid 非时政行。
- **R535-2（信息项，老板决策）**：VPS Caddyfile `zalize.com, www.zalize.com` + `http://` 301 两块为死配置（域已 CF 代理且不回源），Caddy 每 6 h 续期失败一次直到 10-04 过期，公网无影响；建议删块。
- **R535-3（信息项）**：小程序端问答页「加入错题本」不带 `question_id`（H5 带 `askQid`），当前只见探针一手；真人小程序有量后再评是否对齐（并入 R528-1 小程序整包）。
- 到期项转 R536：簇何时停 / 09-09 00:00Z 日界。

## §6 如实

- 本轮 0 产品代码 0 部署；生产段只读（SSH journal / 访问日志 / `mode=ro` DB / 本机对公网边缘 GET）。
- 「不回源」是 body/证书链对比推出的事实，CF 侧配置（Workers/Pages 绑定、SSL 模式）未查（无 CF 账号只读凭据在本会话）。
- 行 2836 的「小程序问答页加入错题本」是 Caddy 时序 + UA/Referer + 请求形态推出的归因，未复现小程序端代码路径。
- 簇归因仍为推断；无 testing agent 录屏（未另行授权）。
