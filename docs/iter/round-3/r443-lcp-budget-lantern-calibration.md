# R443 · `/` LCP 预算校准 2500→3000：一手证明 2.73 s 是 Lantern 模拟折算值（真节流实测 0.7 s），双峰是量测机上 ~10 ms 的竞态

> 承接 R442 决策项 (a)（统筹者确认无异议）。本轮只改 `deploy/perf-budget.sh` 一个阈值 + 注释，**不改产品代码、不重建容器、不动 bundle**，生产 rev 仍 `b265cdc`。

## 0. 结论

| # | 项 | 一手结论 | 处置 |
|---|----|----------|------|
| A | `/` LCP 2.73 s 是什么 | **不是页面真实首绘时间**。Lighthouse 默认 `simulate` 口径下，`/` 在量测机上的**观测** FCP/LCP 只有 **110–178 ms**，Lantern 把「观测 FCP 之前已收完的 High/VeryHigh 优先级请求」全部当作可能阻塞首绘的资源，按 150 ms RTT / 1.6 Mbps 重新折算 → 首页 head 里 `<script type=module>` 主包 129 KB + R387 路由预加载的 21 个分包/CSS ≈ **23 个请求 216 KB** 全部落进图 → 模拟 FCP 2119–2142 / LCP 2723–2750 | 源码可证（下 §2） |
| B | 真节流下的 LCP | 同参数改 `--throttling-method=devtools`（真实施加 150 ms / 1.6 Mbps / 4× CPU，指标取观测值）两次：**FCP = LCP = 712 / 722 ms**，LCP 元素同为 `#kg-splash > div.s`，主文档 649–679 ms 收完即首绘，首个分包 1.5–1.8 s 才到 —— 即真实用户在同等弱网下 0.7 s 看到启动屏，与「2.73 s」无关 | 事实 |
| C | 历轮「双峰」（0.8 / 1.2–2.0 / 2.7）的成因 | 同一轮 6 次 simulate：5 次 obsFCP 之前 23 个请求 216 KB 收完 → LCP 2723–2750；**1 次主包 `index-*.js` 在 150 ms 收完、观测 FCP 141 ms（晚 9 ms）→ 主包被排除出图 → 22 个请求 86.7 KB → LCP 2018**。模拟值取决于量测机上主包/分包与首绘谁先到，是 **~10 ms 量级的竞态**，与页面无关。R439 1820 / R440 1245 / 历轮「部署首跑 27xx、复跑 18xx」都是这一竞态的不同落点 | 解释了 R441 的「稳定基线 + 离群低值」，不再当性能信号 |
| D | 预算怎么校准 | 2500 线在 A 口径下恒 WARN、无信息量（R441/R442 已证）；改为 **3000**：把「首绘前 High 优先级字节」这一真实可回归量（主包 + 预加载分包）仍留在护栏内（现值 2723–2793，余量 ~250 ms），同时不再每次部署误报。perf ≥0.90 线不动（同机干净 bench 下 0.92–0.98，R441 那 3 次 0.77–0.86 是 bench 1797–2003 的负载噪音） | `MAX_LCP_MS` 2500→3000 + 注释指向本文 |

## 1. 一手数据

### 1.1 simulate（默认口径，LH 13.4.1 mobile，同机 devin-box）

| 样本 | bench | perf | 观测 FCP | 模拟 FCP | 模拟 LCP | 观测 FCP 前收完的 High/VeryHigh 请求 | 备注 |
|---|---|---|---|---|---|---|---|
| R442 P1 | 3362 | 0.93 | 178 | 2129 | 2734 | 23 个 / 216154 B | |
| R442 P2 | 3655 | 0.92 | 114 | 2138 | 2745 | 23 / 216128 | |
| R443 S1 | 3588 | 0.93 | 137 | 2119 | 2723 | 23 / 216139 | 主包 123 ms 收完 < FCP 137 |
| R443 S2 | 1945 | 0.92 | 145 | 2129 | 2734 | 23 / 216130 | bench 低但结果同 |
| **R443 S3** | 3662 | 0.95 | **141** | **1452** | **2018** | **22 / 86678** | **主包 150 ms 收完 > FCP 141 → 排除** |
| R443 S4 | 3372 | 0.93 | 110 | 2142 | 2750 | 23 / 216128 | |
| R443 6b 部署脚本实跑 | – | 0.97 | – | – | 2020 | （tmp lhr 随脚本清理，与 S3 同形态） | |

23 个请求清单（P1，全部在 105–165 ms 收完）：主文档 13.7 KB（VeryHigh）、`index-DaOBPuSg.js` 129.5 KB（High，head 内 `<script type=module>`）、`kaogong.svg`、R387 `data-kg-route-preload` 注入的 `pages-home-home` 29 KB + `l-icon`/`wd-icon`/`review-snap`/`props`/`export-confirm`/`wd-cell`/`exam-resume`/`tabbar-badge`/`exam-progress-sync`/`practice-prefs`/`daily-goal`/`uni-app.es`/`_plugin-vue_export-helper` 等 JS（High）与其 CSS（VeryHigh）。

### 1.2 devtools 真节流（同 URL、同 `X-Kg-Probe: 1`）

```
lhr_devtools_1  bench 3276 perf 0.91 FCP 722 LCP 722 TBT 346 SI 1606 TTI 3282 obsLoad 3410  doc end 679  home chunk end 1817
lhr_devtools_2  bench 3632 perf 0.92 FCP 712 LCP 712 TBT 331 SI 1586 TTI 3264 obsLoad 3158  doc end 649  home chunk end 1785
```

两次都带 runWarning「page loaded too slowly to finish within the time limit」（真节流下网络空闲判定被首页后续请求拖住），FCP/LCP 均在 warning 前落定，不影响本文用到的值；TBT 331–346 是 4× CPU 真施加在 2 vCPU 量测机上的观测值，与 simulate 的 TBT 60–111 不同口径，不比较。

留存：`/home/ubuntu/r443/lhr_sim_{1..4}.json`、`lhr_devtools_{1,2}.json`（R442 的 `lhr_P_{1,2}.json` 在 `/home/ubuntu/r442/`）。

## 2. 机理（Lighthouse 源码，非推断）

量测机 npx 缓存中 LH 13.4.1 的 Lantern FCP 实现（`@paulirish/trace_engine/models/trace/lantern/metrics/FirstContentfulPaint.ts`，LH `core/computed/metrics/lantern-first-contentful-paint.js` 直接继承）：

- `getFirstPaintBasedGraph`：以**观测 FCP** 为 `cutoffTimestamp`，网络节点凡 `endTime > cutoff` 一律排除；剩下的按 `treatNodeAsRenderBlocking` 过滤——悲观图 = `node.hasRenderBlockingPriority()`（VeryHigh/High 优先级都算），乐观图再排除 `initiatorType === 'script'`。
- 「明确不阻塞」的例外只对能在 CPU 节点 `getEvaluateScriptURLs()` 里找到 EvaluateScript 的 URL 生效；找不到（模块脚本走的是模块求值事件）就「不能下结论，跳过」——即**保留在图里**。
- FCP = 0.5 × 乐观 + 0.5 × 悲观；LCP 用同一族图另一组系数。

于是：主包（parser 发起、High）进乐观+悲观两图，R387 预加载分包（script 注入、High）进悲观图；量测机越快、观测 FCP 前收完的请求越多，模拟 FCP/LCP 越高——**这是「量测机快」被折算成「页面慢」**。真节流不走 Lantern，直接给观测值 0.7 s。

与历史吻合：R193–R386 handoff 里 `/` 复跑值 0.80–0.93 为主、偶见 1.8，「部署首跑」才出 2645–2707（R315/R324/R334/R343 都记为「单样本波动」）——R387 之前 head 只有主包一个 High 候选，图里「只主文档 / +主包」两档；R387（`47bb705`，head 预加载分包）之后 2.73–2.79 成主峰、1.2–2.0 成离群——多了 21 个预加载候选，全进图才是 2.73。「首跑 vs 复跑」差异 = 首跑时边缘/浏览器缓存状态让主包与首绘的先后不同。这些历史归因是按机理回看的**推断**，本轮一手只到 §1.1 六个样本。

## 3. 改动

- `deploy/perf-budget.sh`：`MAX_LCP_MS` 默认 2500 → **3000**，注释注明依据并指向本文；其余阈值不动。`bash -n` 过；对生产实跑一次 6 项 ×2 URL 全 OK（`/` perf 0.97 / LCP 2020、`/tiku/` perf 1.00 / LCP 957、bundle gzip 125 KB ≤ 160）。
- 不改 `deploy_h5.sh`、不改产品代码、不部署。

## 4. 为什么不是 (b) 主包瘦身、不是换 devtools 口径

- (b)：真节流下首屏 0.7 s、主包 gzip 125 KB 在 160 KB 预算内、R442 已证主线程成本无回归——没有性能事实支撑立项；R387 预加载的目的正是让首屏之后的路由分包早到（真节流下 home 分包 1.8 s 到，去掉预加载只会更晚）。
- 换 `--throttling-method=devtools`：观测值对量测机负载敏感（TBT 331–346 vs simulate 60–111）、跑一次要 60–90 s、每次带「loaded too slowly」warning，且历轮 R122/R193/R196 的水位全是 simulate 口径——换口径会让所有历史对照失效。保留 simulate，只校准 LCP 线。

## 5. 如实边界

- 「3000 线仍能拦住临界字节增长」是按 Lantern 机理的推断（216 KB → 2.73 s；余量 ~250 ms 对应大约几十 KB High 优先级字节），未做「故意加 N KB 预加载看 LCP 涨多少」的对照实验。
- 双峰机理只在本机 6 个样本上验证（5 高 1 低、低值那次主包晚于 FCP 9 ms），R439/R440 的低值当时 lhr 未留存、只能按机理归类。
- devtools 口径的 perf 0.91/0.92 与 simulate 的 0.93–0.97 不能互比。
- 未验证 LH 其它版本是否同样把模块脚本「跳过不排除」（本文只看了缓存中的 13.4.1 源码）。

## 6. 到期项（本轮未动）

`.sheet-x`/自然旧壳 404 (c) 仍无样本；`error_reason` ≥09-11 看 probe=0；`.trend-kn` 需 4 周已掌握样本；WAL 截断观测；仍无可确认外部真人、`WX_MINIAPP_SECRET` 未配、R385 第二冷样本未达标；宿主扩盘/迁出 recruit·softcopyright 待老板。下次 SOP-10 审计 ~R450。
