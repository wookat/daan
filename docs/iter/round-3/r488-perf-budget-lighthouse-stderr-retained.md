# R488：`perf-budget.sh` 吞 Lighthouse stderr 致「运行失败」不可考 → 最小留痕；R487 发版后 (c) 补量 / `practice_ask_click` 真人首条观察

日期：2026-09-07（UTC）。生产仍 `896007c`（本轮 0 产品代码、不发版；改动只在部署侧脚本，运行在部署机不在容器）。

## 0. 结论

1. **(c) 补量 / 到期项 0 增量**（§1）：R487 容器（09:51:52Z 起）108 请求全本机/探针/bot；非探针 `mistakes/analysis` / `explain/stream` / `POST` 0；`umst3tuisd7lgzaka` 0 回访；`practice_ask_click` 仍只有 R487 探针 2 行（probe=1）→ `growth_events.ref ↔ explain_cache.qid` 对账**无真人样本，本轮不可做**。
2. **Lighthouse「运行失败」可考性（修）**（§2）：`deploy/perf-budget.sh` 原 `>/dev/null 2>&1` 把 lighthouse stderr 一并丢掉，83 份部署日志里唯一一次「运行失败」（R487 `/`）因此无根因。改为 stderr 落 `$TMP/<url>.err`、失败时打印 `rc` / 当前 loadavg / stderr 末 20 行，其它 URL 照常继续；`deploy_h5.sh` 6b 非 strict 仍只 WARN 不阻塞。本地实跑：正常路径 rc=0 输出不变；构造失败（`SITE` 指向不存在域名）→ 打出 `rc=1, load=…` + `Runtime error encountered: Chrome prevented page load with an interstitial…`，脚本 rc=1。
3. **R487 `/` perf 0.57 复核**（§3）：该次手动复跑**未落盘**（只保留了 0.88 / 0.93 两份 JSON），0.57 不可复核、本轮不再引用为数据；留痕的 6 次（09:57Z–10:02Z + 本轮预算脚本）perf 0.88–0.93、LCP 2731–2812、TBT 52–253、`benchmarkIndex` 3249–3686、`runWarnings` 全空。83 份部署日志 `/` perf 分布：OK 71 次 0.90–1.00，FAIL 3 次 0.81/0.84/0.86，运行失败 1 次。**「运行失败」根因仍未知**（改动只保证下次可考），不登记为产品回归。

## 1. (c) 补量 / 到期项（生产只读，`~/r487_post.sh` 复用，09-07 ~10:1xZ）

```
container healthy restarts=0 started=2026-09-07T09:51:52Z
disk avail 3.6G   WAL 4,124,152 B（同字节）   Traceback 0
caddy since start: total 108  5xx 0  assets404 0  monitor 0  mpUA 0  non-probe non-bot 0
track posts 5 = [200,200,200,200,400]
  → 2×200 = 140.232.64.4 UA "moto g power (2022)"（R487 手动 Lighthouse 触发的页面埋点，网段归探针）
  → 2×200 + 1×400 = R487 探针 curl（X-Kg-Probe: 1）
practice_ask_click rows: uprobe_r487_pac shuliang/296322 probe=1；uprobe_r487_pac 时政/sz probe=1（仅这 2 行）
probe=0 answer_log 33/1   growth probe=0 20/4   explain_cache qid nonnull 0/82
时政且 qid 非空 answer_log 0 / mistakes 0   error_reason ≥09-11 0
```

`umst3tuisd7lgzaka`：容器起后 0 请求。

## 2. `perf-budget.sh` 留痕（`deploy/perf-budget.sh`）

改前：
```bash
--chrome-flags="--headless=new --no-sandbox" >/dev/null 2>&1 \
  || { echo "FAIL Lighthouse 运行失败: $u"; FAIL=1; continue; }
```
改后：
```bash
err="${out%.json}.err"
… >/dev/null 2>"$err" \
  || { rc=$?
       echo "FAIL Lighthouse 运行失败: $u (rc=$rc, load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null))"
       echo "---- lighthouse stderr (tail 20) ----"; tail -n 20 "$err"; echo "----"
       FAIL=1; continue; }
```
- `rc=$?` 在块首先取，避免被 `$(cut …)` 等后续命令替换覆盖。
- `.err` 与 `.json` 同放 `$TMP`，沿用既有 `trap 'rm -rf "$TMP"' EXIT` 清理。
- 只改失败分支输出；成功路径 stdout 与改前逐行一致（`deploy_h5.sh` 靠退出码判定，不解析文本）。

本地验证（部署机 = 本机）：
```
bash -n deploy/perf-budget.sh → OK
bash deploy/perf-budget.sh /  → OK / performance=0.93 … LCP 2782.73 … CLS 0.06；rc=0
SITE=https://nonexistent-r488.invalid bash deploy/perf-budget.sh /
  ==> Lighthouse https://nonexistent-r488.invalid/
  FAIL Lighthouse 运行失败: / (rc=1, load=0.21 0.53 0.58)
  ---- lighthouse stderr (tail 20) ----
  Runtime error encountered: Chrome prevented page load with an interstitial. …
  ----
  性能预算存在违例。   rc=1
```
顺带观察（一手）：`CHROME_PATH=/nonexistent/chrome` 时 lighthouse **并不失败**，照常跑完 perf 0.93——`CHROME_PATH` 无效时 chrome-launcher 回落到自行找 Chrome（现象可复现；回落机制为推断，未读 chrome-launcher 源码）。因此 R487 的「运行失败」不是 Chrome 路径类问题能解释的。

## 3. R487 `/` perf 0.57 复核

| 样本 | 时间 (UTC) | perf | LCP ms | TBT ms | benchmarkIndex | runWarnings |
|---|---|---|---|---|---|---|
| R487 手动 #1 `/tmp/lh_1.json` | 09-07 09:57:19 | 0.88 | 2812 | 253 | 3656 | [] |
| R487 手动 #2 `/tmp/lh_2.json` | 09-07 09:57:32 | 0.93 | 2738 | 70 | 3686 | [] |
| R487 手动 #3–#5 `/tmp/lh_3..5.json` | 09-07 10:02:34–58 | 0.92 / 0.93 / 0.93 | 2735 / 2731 / 2734 | 142 / 88 / 52 | 3249 / 3407 / 3407 | [] |
| 本轮预算脚本 | 09-07 ~10:1x | 0.93 | 2783 | — | — | — |

- R487 汇报中的 **0.57 无 JSON 落盘**（当时第一次手动跑未 `--output-path`），不可复核；本文与 handoff 不再把它当数据点。
- 历史 83 份部署日志 `/` perf：OK 71 次（0.90 ×1、0.91 ×3、0.92 ×11、0.93 ×5、0.94 ×1、0.95 ×2、0.96 ×4、0.97 ×10、0.98 ×18、0.99 ×15、1.00 ×1）、FAIL 3 次（0.81 / 0.84 / 0.86）、运行失败 1 次（R487）。LCP FAIL 18 次全为 R443 前 2500 线时代的 2730–2793（已校准到 3000）、a11y 0.94 ×2（R429 已核）。
- 判读：留痕样本全部在预算内、`runWarnings` 空、bench 正常区间；「运行失败」为单次事件、根因不可考。**不登记为首页性能回归；登记为「已加留痕、待下次自然复现」。**

## 4. 设计取舍

- 只留痕不重试：一次失败在非 strict 下只是 WARN，不值得为它加重试（多跑 1–2 min、且掩盖偶发）。
- 不把 lighthouse 完整 stdout/JSON 归档到 `~/kaogong-reports`：现有部署日志已保存 OK/FAIL 行，失败时 stderr 末 20 行足以定位类别（interstitial / 超时 / Chrome 起不来 / 协议错误）。
- 不改 `deploy_h5.sh`：6b 的 WARN/strict 语义不动。

## 5. 如实说明

- 本轮 0 产品代码、生产不发版；脚本只在部署机执行，改动生效于下一次 `deploy_h5.sh` 6b。
- 「运行失败」根因仍未知，本轮只把「下次可考」补上。
- 构造失败用的是不存在域名（interstitial 路径），未复现 R487 那次的具体失败类型。
- `CHROME_PATH` 无效仍能跑通的回落机制为现象观察 + 推断。
- 无真人 `practice_ask_click`，`ref ↔ qid` 对账未做；无 testing agent 录屏（未另行授权）；仍无可确认外部真人作答者。
