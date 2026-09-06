# R441 · 日界公式收口 + 发版后自然旧壳 404 补量 + Lighthouse `/` LCP「一次 WARN」口径纠正

> 承接 R440 登记项 E（`db.daily_plan` 内联日界公式）与 (c)（R430b 自然旧壳 404 路径待发版补量）。
> 本轮无 UI 改动、无 DB 写入、bundle 不变（`index-DaOBPuSg.js` 与 R440 同）→ 不派 testing agent。

## 0. 结论

| # | 项 | 一手结论 | 处置 |
|---|----|----------|------|
| A | 「中国日历日 0 点」公式克隆 | R439 合一后仍有 **3 处**内联 `((ts+8h)//86400)*86400-8h`：`db.daily_plan`（R440 登记）、`insights._week_start`（成长页周切分）、`mock_event._saturday_window`（周六模考窗口）。三处与 `db.cn_day_start()` 数值恒等（同一整数算式），无行为差 | 三处改 `db.cn_day_start(ts)`；单测锁「周一 0 点 / 周六窗口 / 与 day0 整天整点对齐」（`b265cdc`） |
| B | R440 前端发版后自然旧壳 404 (c) | caddy 源站 16:09:48Z（R440 容器起）→ 17:20Z：**160 请求、`/assets/*` 404 = 0、`/api/monitor/report` POST = 0**；非 2xx 仅 2 条 = testing agent 探错路径 `GET /api/plan`（140.232.64.4 探针网段）。无自然旧壳现场——夜间无外部真人 tab、Bing/Yandex 抓 SSR 页不加载壳 | 仍无样本，继续挂 |
| C | Lighthouse `/` LCP WARN 的口径 | 历轮（R424/R427/R431/R435/R437）都记「一次 WARN、宿主负载形态、bundle 不变」。本轮部署 6b `LCP 2793 / perf 0.86` 后**单独重跑 3 次 = 2740 / 2761 / 2734**；翻回 R429 留存的 5 份 lhr：**4/5 也是 2732–2770**（1 次 2002）。即 **`/` 的 LH 移动模拟 LCP ≈ 2.73 s 是稳定基线，2500 预算线在基线之下 ~240 ms**；R439（1820）/ R440（1245）才是低值离群。LCP 元素 = 壳内联 splash `#kg-splash > div.s`；observed TTFB 57–102 ms、全部资产 <200 ms 收完、render-blocking 0、CSS 全内联 → **与服务端/宿主无关**，是 4× CPU 模拟下的主线程成本（`bootup-time` 主包 1.4–2.0 s、`Style & Layout` 0.7 s）+ 模拟 RTT 150 ms | **纠正历轮「宿主负载」归因**；不改预算、不改代码（无设计论证）；登记 D 做下一轮取证 |
| D | 主包脚本执行时间疑似上涨 | 同一台量测机（`benchmarkIndex` 3570 vs R429 3650–3730）：R429 `index-Ct1Bg37q.js` `bootup scripting` **402–450 ms**（5 次），本轮 `index-DaOBPuSg.js` **744 / 757 / 1373 ms**（3 次；后两次 benchmarkIndex 1800–2000 更慢却更低，噪音大）；`TBT` 54–94 → 321–658 | **未定论**（LH 单机噪音、样本少）；R442 起点：同机本地起两版 dist（R429 commit vs HEAD）交替各跑 ≥5 次 A/B，再决定是否有回归 |
| E | 到期复查 | `probe=0` 仍 22 行/1 uid（vivo 小程序，最后 09-06）；`mistakes.error_reason` 非空 6 行不变（≥09-11 再看）；`push_subs` 0；`weekly_reports` 0（`.sheet-x` 仍无正文样本）；WAL 部署后 431 KB（R440 后 165 KB，自然截断周期未到） | 不改 |
| F | 跨部署 app-log（R437 归档） | `d30a9b0` 容器 16:09–16:38Z 1959 行：Traceback / 5xx / locked / WARNING **0**（grep 命中 1 条是 `[indexnow] submitted 533 urls` 误匹配） | 无异常 |

## 1. 一手取证

### 1.1 A：源码

```
$ grep -n "8 \* 3600|28800" backend/app/*.py
db.py:2944      tz = 8 * 3600 ; day0 = ((now + tz) // 86400) * 86400 - tz   # daily_plan
insights.py:171 tz = 8 * 3600 ; day0 = ((ts + tz) // 86400) * 86400 - tz    # _week_start
mock_event.py:102 day0 = ((now + TZ) // 86400) * 86400 - TZ                # _saturday_window
```
其余命中是 `strftime(gmtime(t+8h))` 日期字串 / 周偏移 `weekday` 计算 / `report.py`、`social.py` 的 SQL 常量，语义不是「日 0 点秒」，不动。

改后：`day0 = cn_day_start(now)` / `db.cn_day_start(ts)` / `db.cn_day_start(now)`；`weekday` 仍局部算（不是 day0 语义）。
单测 `test_week_and_saturday_windows_anchor_on_cn_day_start`：3 个 ts（跨日前 / 后 / +5 天）→ `cn_day_start` 为 CST 00:00:00；`_week_start` 与 day0 整天差且为周一；`_saturday_window` open 为周六、整点、close>ts。

### 1.2 B：caddy 源站（`/var/log/caddy/kaogong-origin.zalize.com-access.log`，ts ≥ 1788718188）

```
since deploy total 160   monitor POST 0 {}
assets 404 0
non2xx 2
  (404, '/api/plan', '140.232.64.4', 'curl/7.81.0') 2      ← R440 testing agent 探错路径
```

### 1.3 C/D：Lighthouse（LH 13.4.1，mobile 模拟：rtt 150 ms / 1.6 Mbps / cpu 4×；量测机 devin-box 2 vCPU）

| 样本 | bundle | bench | perf | FCP | LCP | TBT | 主包 bootup / scripting |
|---|---|---|---|---|---|---|---|
| R429 home_1 | Ct1Bg37q | 3728 | 0.98 | 1412 | 2002 | 64 | 680 / 402 |
| R429 home_2 | Ct1Bg37q | 3717 | 0.93 | — | 2732 | 68 | — |
| R429 home_3 | Ct1Bg37q | 3682 | 0.93 | 2127 | 2732 | 94 | 801 / 450 |
| R429 home_4 | Ct1Bg37q | 3650 | 0.93 | — | 2763 | 54 | — |
| R429 home_5 | Ct1Bg37q | 3720 | 0.93 | — | 2770 | 86 | — |
| R441 deploy 6b | DaOBPuSg | — | 0.86 | — | 2793 | — | — |
| R441 lhr_1 | DaOBPuSg | 3570 | 0.77 | 2161 | 2740 | 658 | 1971 / 1373 |
| R441 lhr_2 | DaOBPuSg | 1797 | 0.86 | 2151 | 2761 | 321 | 1432 / 744 |
| R441 lhr_3 | DaOBPuSg | 2003 | 0.82 | 2128 | 2734 | 432 | 1510 / 757 |

- LCP 元素：`body > div#kg-splash > div.s`（壳内联 splash 副标）；`lcp-breakdown`：observed TTFB 102 ms + render delay 131 ms。
- `render-blocking-insight` items = []；壳 HTML 48.8 KB（传输 13.7 KB），5 段 `<style>` 全内联（uni.css 20.6 KB 等），4 段内联脚本 0.4–2.6 KB，唯一外链 `<script type=module>` 主包。
- 网络（observed，未节流）：文档 1→103 ms，主包 121→183 ms，其余 assets 全部 ≤200 ms 收完 → 服务端/边缘不在关键路径。
- 长任务：主包 505 + 220 + 115 ms（R429 同位置 147 + 86 + 56）。
- 宿主同刻 `load 0.44`、无 buildx 在跑；devin-box `load 0.20`。
- lhr 留存：`/home/ubuntu/r441_lhr.json`、`r441_lhr_2.json`、`r441_lhr_3.json`（R429 的在 `/home/ubuntu/r429_lh/home_{1..5}.json`）。

### 1.4 E/F：生产只读

```
probe0 answer_log (22, 1, '2026-09-06 16:57:54')
error_reason nonempty (6,)
push_subs (0,) weekly_reports (0,)
wal 440872
d30a9b0 app-log 1959 行：Traceback/5xx/locked/WARNING 0
```

## 2. 部署与复验（`b265cdc`）

- `deploy_h5.sh`：宿主快照 `mem_avail=342MB disk 4.8G(90%) load 0.59 other_builds=0`；compose rc=0 首轮收敛；`/api/health` `{"ok":true,"rev":"b265cdc"}`；容器 healthy、RestartCount 0；线上 bundle `index-DaOBPuSg.js` 与本机一致（前端未动）；后端代码与本机一致；回归全部 200。
- 容器日志 187 行 5xx/Traceback/locked 0。
- 6b：`/tiku/` 全过；`/` perf 0.86 / LCP 2793 WARN（见 §0 C——**这是基线不是本轮引入**，bundle 与 R440 同一字节）。
- 本地：pytest **501 passed**（+1）/ ruff 0 / pyright 0。

## 3. 如实说明

- A 是纯等价重构（同一整数算式），单测锁的是「锚点在 CST 0 点且周一/周六正确」，没有也不需要生产行为对照。
- C 的纠正只依据本机 Lighthouse 留存 lhr（R429 ×5 + R441 ×4）；LH 单机 `benchmarkIndex` 在 1797–3728 波动，绝对值不能横向比机器，但同一预算脚本、同一台机、同一模拟参数下 9 次里 8 次 >2500 足以否定「偶发」。
- D 主包 scripting 上涨**未定论**：R429 5 次 402–450 vs 本轮 3 次 744–1373，方向一致但 benchmarkIndex 与样本数都不够；R430–R440 前端改动里只有 R430b `main.js`/`monitor-client.js` 与 R440 `home.vue` 涉及主包，先 A/B 再归因，不猜。
- B 的「无自然旧壳样本」是深夜 70 min 窗口，不是「路径已验证」；(c) 继续挂。
