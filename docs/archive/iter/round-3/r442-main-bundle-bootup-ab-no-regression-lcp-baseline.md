# R442 · 主包脚本成本 A/B 取证：R429 dist vs HEAD dist 同机交替 5×5 → **无回归**；`/` LCP 2.73 s 基线复核

> 承接 R441 登记 D（同机主包 `bootup scripting` 402–450 → 744–1373 ms 疑似回归）。本轮**只取证不改码不部署**。

## 0. 结论

| # | 项 | 一手结论 | 处置 |
|---|----|----------|------|
| A | 主包脚本成本回归？ | **否**。同机（devin-box）交替各 5 次：A=R429 `f71db28` 重建 dist 主包 scripting **433–524 ms（均值 472）**，B=HEAD `d30a9b0` dist（生产同字节 `index-DaOBPuSg.js`）**426–480 ms（均值 457）**；TBT A 56–132 / B 60–103；两版主包体积仅差 **81 B**（373957 vs 374038，R430b `main.js` 一处）。R441 记到的 744/757/1373 是量测机同刻有其他负载的噪音（其中 2 次 `benchmarkIndex` 1797–2003，正常 3550–3730） | 关闭 R441-D，不改码 |
| B | 生产复测 | 本轮生产 `/` 两次（bench 3362 / 3655）：perf **0.93 / 0.92**、LCP **2734 / 2745**、TBT 105 / 111、主包 scripting **443 / 458** —— 与 R429 留存 lhr 同一水平 | 与 A 一致 |
| C | `/` LCP 基线 | 累计同机同参数：R429 ×5、R441 ×4、R442 ×2 = **11 次里 10 次 2732–2793**（1 次 2002）；perf 0.86–0.98 跨 0.9 线两侧、LCP 恒在 2500 线之上 ~240 ms。LCP 元素壳内联 splash、TTFB 57–102 ms、render-blocking 0 → 成本 = 4× CPU 模拟主线程 + 150 ms RTT 模拟 | **决策项交老板**：(a) 按基线把 `perf-budget.sh` LCP 线校准到 3000（现状每次部署 WARN 一次、无信息量）；(b) 立项首页主包瘦身（需先取证主包 374 KB 构成、设计论证）；(c) 不动。如无异议按 (a) 执行（只改阈值 + README 注明依据，不改产品代码） |

## 1. 方法

- A 版：`git worktree add f71db28` → 复用同一 `node_modules`（package-lock R387 后未变，R436 已证同 commit 字节级可复现）→ `npm run build:h5` → 主包 `index-BgF7eoj8.js` 373957 B（R429 生产 hash `Ct1Bg37q` 不同：R429 部署时 commit 早于 `f71db28` 的 docs/单测收口，主包差异未逐字节比，体积与本轮 B 只差 81 B 即足够说明 A/B 有效）。
- B 版：`frontend-uni/dist/build/h5` R441 部署产物（与线上 md5 一致）。
- 两版各起一个本地静态服务（`/home/ubuntu/r442/proxy.py`，8811/8812），`/api/*` 代理到生产并加 `X-Kg-Probe: 1`（首页数据请求打 probe=1，不污染真人口径）；静态**不压缩**，故本地 FCP/LCP 3.1–4.1 s 高于生产（374 KB 主包在 1.6 Mbps 模拟下多 ~1.2 s），A/B 两侧同条件、只比主线程指标。
- `ab.sh`：A1 B1 A2 B2 … 交替 5 轮，LH 13.4.1 默认 mobile 模拟（rtt 150 / 1.6 Mbps / cpu 4×），记录 `benchmarkIndex` / perf / FCP / LCP / TBT / 主包 `bootup-time` total·scripting / 前 3 长任务。

## 2. 数据

```
A1 bench=3634 perf=0.78 FCP=3453 LCP=4102 TBT=99  main_total=774 main_script=465 longtasks=[139, 98, 61]
B1 bench=3660 perf=0.80 FCP=3382 LCP=3946 TBT=62  main_total=739 main_script=426 longtasks=[146, 79, 66]
A2 bench=3678 perf=0.81 FCP=3303 LCP=3753 TBT=110 main_total=786 main_script=464 longtasks=[169, 77, 63]
B2 bench=3570 perf=0.80 FCP=3377 LCP=3942 TBT=60  main_total=732 main_script=458 longtasks=[139, 80, 57]
A3 bench=3652 perf=0.79 FCP=3378 LCP=3944 TBT=68  main_total=776 main_script=433 longtasks=[155, 82, 67]
B3 bench=3556 perf=0.79 FCP=3423 LCP=3948 TBT=94  main_total=782 main_script=473 longtasks=[152, 85, 56]
A4 bench=3174 perf=0.79 FCP=3355 LCP=3805 TBT=132 main_total=857 main_script=524 longtasks=[167, 97, 81]
B4 bench=3550 perf=0.85 FCP=3078 LCP=3342 TBT=71  main_total=709 main_script=448 longtasks=[133, 78, 54]
A5 bench=3613 perf=0.85 FCP=3078 LCP=3303 TBT=56  main_total=728 main_script=473 longtasks=[131, 81, 55]
B5 bench=3608 perf=0.85 FCP=3077 LCP=3302 TBT=103 main_total=799 main_script=480 longtasks=[150, 90, 63]

生产 https://kaogong.zalize.com/
P1 bench=3362 perf=0.93 FCP=2129 LCP=2734 TBT=105 main_total=754 main_script=443
P2 bench=3655 perf=0.92 FCP=2138 LCP=2745 TBT=111 main_total=826 main_script=458
```

- 主包 scripting：A 均值 472 / B 均值 457（B 更低 15 ms，在噪音内）；TBT A 均值 93 / B 78。
- 长任务首段 A 131–169 / B 133–152。
- 量测机 `load 0.63`，无并发构建/测试。
- lhr 留存：`/home/ubuntu/r442/lhr_{A,B}_{1..5}.json`、`lhr_P_{1,2}.json`；R441 三次高值 `/home/ubuntu/r441_lhr*.json`（devin-box，非仓库）。

## 3. 如实说明

- A/B 的 A 版是重建 dist 不是 R429 线上原字节（hash 不同），但主包体积差 81 B 且 R436 已证构建可复现；若要严格用原字节需从 R429 时代的边缘缓存/归档取，本轮无此归档。
- 本地静态不压缩使 FCP/LCP 绝对值不可与生产比，只用于两版主线程对照；生产两次复测单独给出。
- R441 三次高值的「同刻其他负载」是推断（R441 那段时间本机在跑 pytest/部署脚本/多次 lighthouse 串行），事实只到「同 URL 同 bundle 同参数今天复测回到 443–458」。
- LCP 基线决策项 (a)/(b)/(c) 未执行，等老板意见；按 CHARTER「提议即默认方案」，下轮无异议按 (a)。
