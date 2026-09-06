# R453：旧 `kaogong.zalize.com` Caddy 块绕边缘直达后端（扫描器成对访问）+ 日报 `humans.ips` 3 扫描器归位 + `.trend-kn` 到期核

日期：2026-09-07（UTC）。生产应用未动（仍 `460120f`）；改的是宿主 `/etc/caddy/Caddyfile`
（删掉 CF Pages 迁移后已无合法流量的 `kaogong.zalize.com` 站点块，备份 `Caddyfile.bak-r453`）。

## 1. 结论

1. **R446/R452 归因纠正**：R446 记为「唯一像外部真人的样本」的 iPhone iOS 18.3 访客
   （`59.83.208.103`，09-03/09-04；uid `umtlhudp91wgn09ab` / `umtnitervssy9b344`）**不是真人**，
   是 Palo Alto Networks 扫描器的配对无头浏览器：
   - 页面/API 请求 UA 是 `iPhone OS 18_3` 描述符，但同会话 `/sw.js` 的 UA 是
     `Mozilla/5.0 (X11; Linux x86_64) …`——Service Worker 注册请求不吃页面级 UA 覆写，
     暴露了宿主是 Linux 无头 Chrome 的移动仿真（真 iPhone Safari 不会为 sw.js 换 UA）；
   - 与 UA `Hello from Palo Alto Networks, find out more about our scans` 的请求**同秒/相邻 IP 成对出现**，
     4 次全部如此：08-20 `180.101.244.16`(iPhone) + `180.101.245.250`(PA)；08-25 `220.196.160.151`(iPhone)；
     09-03 `59.83.208.103`(iPhone) + `220.196.160.125`(PA)；09-04 `59.83.208.103`(iPhone) + `198.235.24.133`(PA)；
   - 全部**直连 VPS IP、SNI `kaogong.zalize.com`**，无 `Cf-Connecting-Ip`/`X-Kg-Ip`/`Cf-Ray`（没经 Cloudflare），
     落在宿主 Caddy 的旧 `kaogong.zalize.com` 块（该块 08-19 起 33,292 行日志 **边缘头 0 行**——DNS 已 CNAME 到 Pages，
     只有拿着历史 A 记录/证书透明度里的主机名直打 IP 的扫描器还在用）。
   → 候选真人名单减一；仍无可确认外部真人作答者。
2. **缺陷（P2，本轮修）**：旧站点块仍 `reverse_proxy 127.0.0.1:8300` 全路径，任何直打 VPS IP 的扫描器都能拿到完整 H5 壳 + 实时 API，
   且后端只看得到直连 IP（三路探针都不命中）→ 写入 probe=0：`growth_events` 09-04 `boot` 1 行（`umtnitervssy9b344`，probe=0），
   09-03 同类 2 行（probe=NULL，当时 boot 事件尚未打 probe）。而日报 `crawler_stats` 只读 `kaogong-origin` 日志，**看不见这条通道**
   ——库内「真人口径」与日报口径在此处不一致（R388 只给 `kaogong-origin` 块加了 `@noedge` 403，旧块漏了）。
   修：删除旧块（不是加 403：块留着 Caddy 会在 09-28 起为该域续签 LE 证书，DNS 在 CF 上 HTTP-01/TLS-ALPN 必失败，
   journal 持续报错到 10-28 过期；删块后 Caddy 不再管理该证书，直打 SNI 收到 TLS alert）。
   `deploy/README.md` 回滚步骤同步改为「DNS 改回 A + 从备份恢复站点块」。
3. **日报 `humans.ips` 未把 3 个扫描器算候选真人**（逐个对账，见 §3）：ShapBot 的 X-Kg-Ua 全文是 `…compatible; ShapBot/0.1.0`
   （R452 表格截 60 字成 `ShapBo`）→ `BOT_GENERIC` 的 `bot` 命中；Firefox/5.0 Ice 与 Mac 单页访客 referer 为 `kaogong-h5.pages.dev`
   → `offhost`；Palo Alto/iPhone 配对根本不在 origin 日志。生产 `crawler-stats.json` 与本地同参数重算一致。
4. **`.trend-kn` 到期核**：自然 4 周已掌握样本仍未到——全库 28 天内 `mastered_at` 的只有 vivo 小程序 uid（2 条，小程序端不渲染 H5 趋势卡）。
   改为合成元素量真实 scoped CSS（`data-v-bcbaf750`）：375/1440 `.trend-kn` **fs 12 / h 14 / 600 / #16a34a**，`.trend-n` 同 12px
   → 已在 R411 12px 下限，**闭合**（登记项改为「有真人 k>0 样本时看一眼 4 列排版」）。

## 2. 一手证据

### 2.1 旧块流量（`/var/log/caddy/kaogong.zalize.com-access.log`，08-19 起）
```
total 33292  edge(Cf-Connecting-Ip/X-Kg-Ip/Cf-Ray 任一) 0
08-20 180.101.244.16   33  iPhone 18_3 ×32 + X11 Linux ×1(sw.js)
08-20 180.101.245.250  35  Palo Alto ×32 + X11 Linux ×3
08-25 220.196.160.151  26  iPhone 18_3
09-03 220.196.160.125  62  Palo Alto ×59 + X11 Linux ×3
09-03 59.83.208.103    73  iPhone 18_3 ×70 + X11 Linux ×3(sw.js)
09-04 198.235.24.133    1  Palo Alto
09-04 59.83.208.103    54  iPhone 18_3 ×51 + X11 Linux ×3
09-04 140.232.64.3      2  curl（本人会话 --resolve 探测）
09-06 127.0.0.1         4  curl /api/explain/stream（R422 SSE 复现）
```
块内 `/api` 命中：`announcement`/`checkin/*`/`daily_plan`/`profile`/`questions`/`home_bundle`/`daily_set`/`exam|practice/resume`——
即前端壳冷启动全套，说明扫描器执行了 JS。DNS：`kaogong.zalize.com` → `104.21.15.239 / 172.67.208.162`（CF），
`kaogong-origin.zalize.com` → `150.109.230.174`。旧块 LE 证书 `notBefore Jul 30 / notAfter Oct 28`。

### 2.2 库内（只读 `file:/data/data.db?mode=ro`）
```
umtlhudp91wgn09ab  growth_events [(None,1)]  boot h5 v:DVHbltOg 09-03   answer_log/exam/daily_set 0
umtnitervssy9b344  growth_events [(0,1)]     boot h5 v:Bctw4Xpu 09-04   同上 0
umtlhu8rzkjt4shgh  growth_events [(None,1)]  (Palo Alto 09-03)
umtgyalle1yy98tka  growth_events [(None,1)]  (ShapBot 08-31)
growth_events probe=0 by uid: umsacie728f4ghcv8 3 / umsagboriz4qyurnd 6 / umst3tuisd7lgzaka 8 / umtnitervssy9b344 1
answer_log probe=0: umst3tuisd7lgzaka 22 ；error_reason 6 ；push_subs 0 ；weekly_reports 1（R451 已归因）
mastered_at ≥ now-28d: 仅 umst3tuisd7lgzaka 2（answer_log probe 分布 N,0）
WAL 3,164,192 B ；容器 healthy restarts=0（StartedAt 09-06 19:41Z）；70 min 日志 Traceback/locked/5xx 0
```
`boot` 事件 `v:` 字段两天不同 hash（`DVHbltOg`→`Bctw4Xpu`）说明后端直出的壳跟随部署更新，不是陈旧副本。

### 2.3 日报对账（`crawler_stats.py`，本地对 `access-archive` 同参数重算 = 生产 `crawler-stats.json`）
```
ShapBot 08-31 7 行：全 edge（Cf-Connecting-Ip 34.44.196.215，X-Forwarded-Host kaogong.zalize.com）
  X-Kg-Ua "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ShapBot/0.1.0" → is_generic_bot('bot') 剔除
humans: api {09-02:43, 09-03:1, 09-05:83, 09-06:337}  ips {09-02:1, 09-03:1, 09-05:3, 09-06:8}
        direct {08-25:1, 08-31:5, 09-01:2, 09-02:12, 09-03:3, 09-04:30, 09-06:3}  offhost {09-01:5, 09-02:5, 09-04:2}
171.114.10.99（Windows，09-06 06:39:32Z）9 请求同秒：announcement/review/cur/practice|exam/resume/home_bundle/question_counts/daily_set/questions/sw.js，
  edge、referer https://kaogong.zalize.com/、UA 一致 → 仍列候选真人（0 作答）
```

### 2.4 `.trend-kn` 合成量测（`/home/ubuntu/r453/trend_kn.py`，生产只读 + 探针头）
```
1440 trend_n {h:14,w:29.4,fs:12,fw:600}  trend_kn {h:14,w:12.7,fs:12,fw:600,color:#16a34a}  real_trend 0
375  同值
```

## 3. Caddy 变更与验证
- 备份 `/etc/caddy/Caddyfile.bak-r453`（5683 B）→ 脚本按块首 `kaogong.zalize.com {` 至匹配 `}` 删 36 行（78–113），
  断言块内含 `reverse_proxy 127.0.0.1:8300` 与该块日志路径；`caddy validate` Valid → `systemctl reload caddy` active。
- 验证：直打 `--resolve kaogong.zalize.com:443:150.109.230.174` → **TLS alert internal error（curl rc 35，无证书）**；
  公网 `https://kaogong.zalize.com` `/api/health` 200 rev `460120f`、`/api/announcement` 200、`/` 200、`/tiku/` 200；
  `kaogong-origin` 直连 403 不变；jobs/tickets/k12/www 四个兄弟站 200；容器 healthy 0 重启。
- 副作用：reload 打断了 Caddy 正在进行的 `www.zalize.com` 续签（04:36 队列、04:38 `context canceled`），
  该证书 10-04 到期、Caddy 维护循环会自动重试——见 §5 复查。
- 回滚：`sudo cp /etc/caddy/Caddyfile.bak-r453 /etc/caddy/Caddyfile && sudo systemctl reload caddy`。

## 4. 不做的
- 不改库内 3 行扫描器 boot 事件（R374 口径：历史行不造假，probe=0/NULL 保留，本文归因即可）。
- 不让后端按「无边缘头即探针」打标（现在无边缘头已到不了后端；且回滚纯服务器架构时会误伤）。
- 不给 `kaogong.zalize.com-access.log` 留 403 块做观测（日报不读它；续签噪音不值）。

## 5. 限制 / 未验证
- 「Palo Alto 配对无头浏览器」是按 UA 不一致 + 同秒相邻 IP 推断，未查 ASN/归属；4 组配对全一致但样本就 4 组。
- `humans.ips` 剔除口径只对账了这 3 个扫描器 + 1 个 Windows 访客，未全量重新归因 8 个 09-06 ips。
- `.trend-kn` 是合成元素（页面无自然数据），真机字体度量未验。
- **跨产品既有问题（非本轮引入，本轮只登记）**：`www.zalize.com` 的 LE 续签自 09-05 22:48 起持续失败（journal 176 次 queuing、`tls.renew` attempt 11 每 3 h 重试）：LE 侧 tls-alpn-01 `Cannot negotiate ALPN protocol "acme-tls/1"`（该域走 Cloudflare 代理，挑战打到 CF 边缘）、ZeroSSL 回退 `caddy_legacy_user_removed (422)`；证书 **10-04 16:38Z 到期**。我的 reload 只是把正在等待的 attempt 11 `context canceled`，Caddy 已重新排队。修法（CF Origin CA 证书 / Caddy DNS-01 用 CF token / 该域改 dns-only）属 zalize.com 站点运维，需老板定，本仓库不动。
