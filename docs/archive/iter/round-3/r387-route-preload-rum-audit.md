# R387：首访 RUM 58 条逐条归因（不新增埋点）+ 大陆可达性一手证据 + 入口路由分包 head 预加载（少一整个串行往返）

取证窗口：2026-09-04 20:30Z ~ 21:30Z（R386 上线后）。全部一手：生产库 `docker exec` 只读查询、Playwright/CDP 对生产域的冷启动瀑布（带 `X-Kg-Probe: 1`）、ChinaZ 31 节点测速（第三方边缘探测，不当用户数据）、本机 DNS/curl 分段计时。

## 0. 结论先行

1. **R386 候选②「先给 boot 埋点加 RUM 字段」不做**：现有 `slow_load` 已带 `nav/ttfb/dom/load/sw/tx/最慢资源/版本/UA`，够归因；近 30 天 58 条非探针记录逐条看完，**全部落在 R372（09-04 06:53Z）修复之前，没有一条能归到外部真人；R372 之后 `slow_load` 0 条、`boot` 7 条且全为 probe=1（testing agent 会话）**。
2. **首访真正可动的结构性瓶颈是「串行往返数」不是「字节数」**：HTML → `index.js`（下载+执行）→ 才发现首页分包 18 个依赖 → 才发 API。节流到 RTT 350 ms / 2 Mbps（大陆到美西边缘的典型量级）后「首个 API 发出」1,653 ms，其中第 3 段（等 `index.js` 执行完再取分包）占 750 ms。本轮把入口路由分包依赖提升到 `<head>` 预加载，与 `index.js` 并行：同条件 A/B 首个 API 1,653 → 1,230 ms（−26%），RTT 200/4 Mbps 913 → 676 ms（−26%）。bundle 不变，只多 794 B gzip 的 HTML。
3. **大陆可达性差距是资源缺口，不是代码缺口**：ChinaZ 31 节点：`kaogong.zalize.com`（CF 边缘）8 节点失败、平均 1.511 s；`kaogong-origin.zalize.com` 8 节点失败、成功节点多为 403（源站拒探测，不代表用户体验）；成功节点 DNS 0.45–1.5 s（粉笔 0.06–0.2 s）、连接 0.15–0.28 s（美西边缘）。同一批节点 `www.fenbi.com` 3 失败、平均 2.432 s（但其页面 1 MB，本站 11 KB，平均值不可直接比）。根因是无备案 → 不能用国内 CDN/国内 DNS；本轮作为资源申请正式提出（见 §5）。

## 1. RUM 58 条 slow_load 归因（近 30 天，`COALESCE(probe,0)=0`；最晚一条 09-03 16:30Z，全部早于 R372 部署 09-04 06:53Z）

| 类别 | 条数 | 归因 | 依据 |
|---|---|---|---|
| `nav` 60–90 s（60,1xx / 78–85 k / 90,1xx） | 35 | **进程被换出 → 请求排队到上游/边缘超时**（R372 取证的机制）。全部落在 08-29 18:23 ~ 08-30 07:43，同窗 12 个 uid 各 1–2 条、0 作答 | 数值贴着超时阈值不是网络分布；R372 后 0 条 |
| `resource` 20,000–20,002 ms（`home_bundle`/`review`） | 5 行（3 事件，2 行同秒重复） | **客户端 20 s 请求超时**，09-02/03，uid `umteojq4sltdhorhm`（73 事件、1 作答、Linux X11 Chrome）= 内部走查会话 | UA `X11; Linux x86_64`、事件密度、与部署窗口重合 |
| `nav-ttfb` 16.9 / 25.9 s | 2 | 09-03 16:29–16:30 同一 uid、Linux X11 Chrome、`sw:0`；`/` 由 Pages 静态直出不回源，TTFB 25 s 只能是客户端到边缘的链路停顿；R374 打标前故 probe=NULL | UA + 时间（部署后数分钟）+ 单 uid 两连发 |
| `hb-gap` reload | 4 | 08-19/08-30 页面被挂起后恢复（心跳空洞），不是加载慢 | 语义即如此 |
| 其它 `resource`（mistakes 33/24 s、questions 9–13.5 s、events 14.8 s、categories 21 s、daily_plan 45 s、history 8.7 s） | 9 | 08-29/30 事故窗内或 R372 前（进程换出期 API 单次 10–45 s 与 R372 取证一致） | 时间窗 |
| `nav` 33 s（08-15 `u18`）、14 s（08-29 17:57） | 2 | R372 前；`u18` 注册当日 0 作答 | 时间窗 |
| **08-31 08:02 `nav:16051;ttfb:1875;dom:7527;load:16028;sw:0;tx:10628;wd-icon.js:13025`** | 1 | 唯一「非 Linux 桌面 UA、非整超时值」样本：TTFB 1.9 s、一个 13 KB 图标分包 13 s。0 作答、仅此 1 事件。**最像真实弱网首访**，但单样本、UA 被截断，仍在 R372 前，无法确认真人 | 字段本身 |

推论（标注为推论）：历史 `slow_load` 不构成「首屏慢」的产品结论，绝大多数是 R372 已消灭的换出事故的客户端侧影；R372 之后没有慢样本（含探针），但也还没有外部真人。因此不再加字段，而是把首访链路中**与用户网络无关、我们能控的串行段**去掉一段（§3），并把大陆可达性作为资源申请提出（§5）。

## 2. 首访链路一手瀑布（生产域，冷缓存，375 iPhone UA，探针头）

无节流（本机到 CF 边缘 RTT ≈ 7 ms）：TTFB 100 / FCP 164 / load 233 ms；`index.js` 129 KB 24 ms；首页分包 18 依赖 186–192 ms 并发起；8 个 API 251–254 ms 并发起（**没有串行瀑布**，R386 候选「首页请求调度」无问题）。`/api/questions` 763 ms、`/api/home_bundle` 722 ms 是回源（Seoul）耗时，不阻塞首屏。

节流 A/B（同一生产资产，只替换 HTML；每档 3 次取中位数）：

| 档位 | 版本 | `index.js` 完成 | 首页分包开始→完成 | **首个 API 发出** | 最后 API 完成 |
|---|---|---|---|---|---|
| RTT 200 / 4 Mbps | before | 471 | 497 → 907 | **913** | 1,219 |
| | after | 631 | **15** → 440 | **676** | 985 |
| RTT 350 / 2 Mbps | before | 875 | 902 → 1,648 | **1,653** | 2,151 |
| | after | 1,189 | **18** → 809 | **1,230** | 1,766 |

after 里 `index.js` 完成变晚是带宽被分包并行下载分走（总字节不变），净效果是首个 API 提前 26%。请求总数 56 = 56、无重复请求（Vite `__vitePreload` 见到同 href 的 `<link>` 跳过）、console 0。FCP 不受影响（splash 由内联 CSS 直出）。

## 3. 改动（`frontend-uni/`，bundle hash 不变）

- `scripts/route-preload.mjs`（新，`build:h5` 在 `inline-critical-css` 之后执行）：从产物 `index-*.js` 解析 `__vite__mapDeps.viteFileDeps` 与各路由 `import("./pages-*.js"),__vite__mapDeps([...])`，只取入口白名单 `pages/home/home`（默认路由）、`pages/practice/practice`（SEO 题目页 CTA / 分享落地）、`pages/book/book`、`pages/team/join`（邀请链接），生成一段内联脚本注入到入口 `<script type="module">` 之前：按 `location.hash` 选路由 → JS 插 `<link rel=modulepreload as=script crossorigin>`、CSS 插 `<link rel=preload as=style>`（不用 stylesheet 以免阻塞 splash 首绘；Vite 随后自插 stylesheet 命中预加载缓存）。未命中白名单的路由不注入（其余路由仍由 `__vitePreload` 按需加载）。
- 幂等（重跑先移除旧注入）；产物结构变化（找不到文件表 / 索引越界 / 依赖文件不在 `assets/` / 入口路由缺失）直接抛错让构建失败，不静默通过。
- HTML 45,944 → 48,473 B（gzip 11,550 → 12,344 B，+794 B）。
- `tests/route-preload.test.js` 5 例：白名单过滤与顺序、越界/缺表抛错、内联脚本在空 hash/`#/`/深链/未知路由下的行为与 rel/as 选择、注入位置与幂等、无提前闭合 `</script>`。

不改：`main.js` RUM（现有字段够用）、`/api/home_bundle`（已是聚合）、小程序（无密钥）、边缘函数（`/` 本就不走 Functions）。

## 4. 验证清单

- 本地：vitest 545（+5）、eslint 0、`build:h5` 全绿，产物 `index-Bctw4Xpu.js` 与生产一致（只变 HTML）。
- 部署后生产复验（testing agent，1440 + 375）：`view-source:/` 含 `data-kg-route-preload`；`/` 首屏 head 内 `link[rel=modulepreload][href*=pages-home-home]` 存在且 `/#/pages/practice/practice?...` 深链下变为 `pages-practice-practice`、`#/pages/stats/stats` 下不注入；Network 面板首页分包与 `index.js` 同批发出、无重复请求；console 0 error；言语 3 题 → 退出保留 → 首页续练卡 → 去继续 回归；`/api` 全 200、容器 0 重启、LEFTOVER 0、questions 156792。
- 部署后同节流 A/B 复采一次（生产 HTML 而非本地替换），写入 PR 复验评论。

## 5. 资源申请与如实说明

- **资源缺口（需老板）**：大陆可达性——ChinaZ 31 节点 8 失败、DNS 0.45–1.5 s、连接到美西边缘 0.15–0.28 s，粉笔同批 3 失败 / DNS 0.06–0.2 s。代码侧已到极限（HTML 12 KB、splash 内联、静态资源边缘 HIT、串行往返本轮再减一段）。下一档必须是 **ICP 备案 → 国内 CDN/回源 或至少国内 DNS**；无备案任何国内 CDN 不接。如无异议将把「备案」列入 handoff 资源缺口清单持续跟踪，不做代码桩。
- 小程序：`WX_MINIAPP_SECRET` 生产未配 → `/api/auth/wxlogin` 503，`users` 16 行 0 个 `wx:` 账号；小程序不是已验证的分发渠道（R386 结论不变）。
- Google：仍只抓 sitemap/robots，`/tiku/q/*` 0 次；本轮未动分发代码。
- 未验证：节流 A/B 是 Chrome 网络仿真，不等于真实大陆链路；预加载在低端设备的 CPU 侧影响未测（分包并行下载不改变解析总量）；`pages/book/book`、`pages/team/join` 两路由只有单测覆盖，生产只复验 home/practice。
- R385 第二冷样本 5,069 ms 未达标项仍保留；宿主 IO 争用（第 10 次上报）。
