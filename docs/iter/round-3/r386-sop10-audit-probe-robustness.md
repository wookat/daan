# R386：SOP-10 四维审计（R376 后第 10 轮）+ 探针打标去单点（网段 / 显式头 / 自动化 UA 三路）+ 看板口径起点外显

取证窗口：2026-09-04 ~2026-09-05 04:20Z，全部为本会话一手证据（源站 Caddy 全量访问日志 08-09 起、生产库 `docker exec` 只读查询、容器日志、`seo_meta`）。

## 0. 本轮最重要的一条事实

**清洗到目前为止，错题邦没有可辨识的外部真人用户。**

- 源站全量 `/api/` 访问日志剔除探针网段 `140.232.64.0/24`、引擎/通用 bot UA、`test-/probe-` uid 后剩 2,922 行、34 个（IP×日）会话；其中 ≥100 行的 6 个「大会话」全部来自 AWS `54.69.238.189` / `54.201.200.193`（UA `Python-urllib/3.10|3.12`、`X11; Linux x86_64 Chrome/133|137`、`iPhone OS 15_0` 模拟）——这是 R374 打标之前 Devin 会话的旧出口，不是用户。
- 剩余会话里能称为真人设备的只有两台：vivo `V2405A`（UA 含 `MiniProgramEnv/android`，即**微信小程序**，08-10/11/13/14/09-02 共 9 个会话，含 `auth/wxlogin`、`share/create` ×2、资料模块作答 2 题）和一台 iPhone `iOS 18.3 Safari`（08-11 ~09-03 共 8 个会话，09-03 打开首页 13 秒内离开、0 作答）。两台设备的行为模式（部署后随即出现、逐页点遍）与内部验收一致，无法证明是外部用户。
- 09-04 05:42 的「iPhone 直连 origin 403」来自 AWS `3.238.133.204`，是伪装 UA 的扫描器，不是用户被拒。
- 入库口径同证：近 6 天 `/api/track` 1,323 行中 1,317 行探针；`mistakes` 243 行仅 6 行有 `error_reason`（3 概念不清 / 2 方法不会 / 1 粗心）；`review_log` 30 行 5 个 uid。

推论（标注为推论）：R372–R385 共 14 轮里 9 轮是运行时/索引/性能修复，服务的对象事实上是探针与爬虫；**「有没有人来」已经压倒「来了慢不慢」成为第一瓶颈**。这不是否定前面几轮（生产 5xx 从 24% 到 0、慢查询逐个消灭是任何用户到来前必须做完的地基），而是审计结论要求后续轮次改配比。

## 1. SOP-10 四维审计表

| 维度 | 一手证据 | 结论 / 差距 |
|---|---|---|
| 实体操作台 | 看板「今日作答/活跃/新增/14 天趋势」按 `COALESCE(probe,0)=0` 算真人（db.py `REAL_TRAFFIC`），但打标自 09-04 08:41Z 起才有效；之前 26 天的行全是 NULL 按真人计，而上表证明其中绝大多数是旧出口的探针。看板未告知这一口径起点 | **命中（本轮修）**：看板对历史区间「说真话但不说全」，老板看 14 天趋势会把探针高峰当用户高峰。另：探针识别只有「网段」一路，网段一换（AWS 54.x → 140.232.64.x 已发生过一次）即全部漏标，需去单点 |
| 核心功能 | 09-02 小程序会话：首屏并发 7 个请求（badges/profile/review/reminders/mistakes/badges/summary），每次切 tab 重复拉 profile/badges/review/mistakes（60 秒内各 3 次），全部 <0.4 s；作答→`answer_log`+`mistakes` 200；`share/create` ×2 成功。08-14 5G 会话同一批请求在宿主 IO 尖峰时各 4.7 s | 无 P0。差距：小程序首屏未用 H5 的 `/api/home_bundle` 聚合（H5 1 次 vs 小程序 7 次）；错题本「错因/知识点聚合」仍无数据支撑（6 条标注），继续不做 |
| 落地页/首页 UI | Google 仍只抓 sitemap/robots（17 次/3 天，`/tiku/q/*` 0）；Yandex 189、Bing 60 次题目页；IndexNow 已把全部活跃题 URL 提交完（`seo_meta.indexnow_last_qid`=6525883 > max 活跃 id 1482630，页族 hash 未变则不重复提交），Bing 于 08-09、09-02 各校验过 key 文件；百度 0 次（无站长账号，R377 已提申请）。Lighthouse `/` 0.98 `/tiku/` 1.00（R381） | 页面本体无 P0。**差距在渠道**：中文考公用户的搜索入口是百度与微信，Bing/Yandex 的抓取不构成获客；百度需要账号（资源缺口，非代码可解） |
| 系统架构 | 容器 healthy / RestartCount 0 / 当前起于 19:23Z；R372 后候选真人 5xx 0；3 天 1,702 个 5xx 全部落在探针并发/扫描器/bot 且多为 25 s 上游超时窗口；R385 第二冷样本 5,069 ms 归宿主 iowait 81–88%（第 8 次上报） | 无新 P0。`_pick_pools` 预构建 / `governance_scan` 物化两项候选：在零真人前提下收益仅对探针可见，**降为 P2 不在本轮做** |

## 2. 本轮改动（最小、可验证、不改任何用户可见功能）

### 2.1 探针识别去单点（`backend/app/auth.py`）

现状 `probe_ip(request)` 只看 `X-Kg-Ip ∈ KG_PROBE_CIDRS`。新增 `probe_request(request)`，三路任一命中即打标：

```python
def probe_request(request) -> bool:
    if request.headers.get("x-kg-probe") == "1":      # 显式声明：脚本/冒烟/testing agent
        return True
    if ip_in_nets(client_ip(request), PROBE_NETS):    # 出口网段（原有）
        return True
    ua = client_ua(request).lower()                   # X-Kg-Ua 优先，回退 User-Agent
    return any(m in ua for m in PROBE_UA_MARKERS)     # python-urllib / python-requests / curl/ / wget/ / headlesschrome / playwright / httpx/ / go-http-client
```

- 六个入库点（`study_api.answer_log`、`team.track`、`team` 卷答、`exam_api` ×3）从 `probe_ip` 换成 `probe_request`；`probe_ip` 保留。
- UA 签名清单只收「H5 真人浏览器绝不会带」的自动化标识，**不含** `X11; Linux` Chrome 或 iPhone 模拟 UA（这些真人也会有）；这意味着旧出口那类 GUI 会话仍需靠网段或显式头，UA 路只兜脚本。
- 边缘 `[[path]].js` 用 `new Request(ORIGIN…, request)` 复制全部请求头，`X-Kg-Probe` 无需改边缘即可透传（代码级确认，部署后用带头请求实测）。
- 与 `KG_PROBE_CIDRS` 为空时的行为：显式头与 UA 路仍生效（脚本永远不是用户，不依赖配置）。

### 2.2 看板口径起点外显（`db._admin_dashboard_uncached` + `dashboard.js`）

- 后端新增 `probe_since = MIN(created_at) FROM answer_log WHERE probe IS NOT NULL`（首条被打标的行 = 口径生效时刻；无打标行为 `null`）。
- 看板副标题在原「已剔除探针作答 今日/昨日」之后追加：「探针口径自 YYYY-MM-DD 起生效，此前行无法区分、按真人计」。历史行不回填、不删（与 R374 一致，如实保留）。

### 2.3 测试 SKILL 增补

- 生产冒烟/取证脚本一律带 `X-Kg-Probe: 1`（curl `-H`、Playwright `extraHTTPHeaders`），不再只依赖出口网段。

## 3. 明确不做

- 不回填历史 `probe`、不删旧行；不按 UA 反推历史真人数（做不到且不该造）。
- 不动 `_pick_pools` / `governance_scan`（P2）。
- 不做错题本错因/知识点聚合（6 条标注不构成依据）。
- 不改小程序（无真机/开发者工具环境，改动不可验证；候选 `home_bundle` 聚合记入 backlog，待可真机验证的会话做）。
- 不做百度推送桩（R377 已判定：账号+token 到位前推送无意义）。

## 4. 测试

- `backend/tests/test_probe_tagging.py` 新增：`X-Kg-Probe: 1` 打标（网段配置为空亦生效）、`X-Kg-Ua: Python-urllib/3.12` / `User-Agent: curl/8` 打标、真人 UA + 非探针 IP 不打标、`probe_since` 为首条打标行时间且无打标行为 `None`。
- 本地：pytest / ruff / pyright；前端 admin 为纯 JS 无构建，H5 零改动。

## 5. 生产复验清单

- 部署后：`curl -H 'X-Kg-Probe: 1' POST /api/track` → `growth_events.probe=1`；同 uid 不带头 + 真人 UA + 非探针 IP → 0（testing agent 走 CF 域名验证边缘透传）。
- 看板副标题出现口径起点日期 = `answer_log` 首条 `probe IS NOT NULL` 行的日期（预期 2026-09-04）。
- 1440/375 看板文案单行不挤压；其余回归（言语练习→退出保留→续练卡）不劣化；容器 0 重启；LEFTOVER 0。

## 6. 对后续轮次的审计建议（提议即默认方案，如无异议按此执行）

1. **R387 起把轮次配比从「性能:功能:分发 ≈ 6:2:2」改到「分发/激活:核心功能:性能 ≈ 5:4:1」**。性能只在有真人 slow-req 或 5xx 时再开轮。
2. 分发侧代码可做的：微信小程序是唯一有真人痕迹的渠道——① 小程序首屏 `home_bundle` 聚合 + 切 tab 去重（需真机验证会话）；② 分享卡（`share/create` 已被真人用过 2 次）落地页转化路径复核；③ `/tiku/*` 页面的微信内打开体验（WeChat webview 无 `navigator.share`、`vibrate`）。
3. 需要老板提供的资源（再次汇总，不阻塞）：百度站长平台账号/推送 token；GSC 所有者邮箱；小程序后台管理员（确认是否已发布正式版、查看小程序搜索/分享数据）；Cloudflare `Zone Analytics Read` token。
4. 下次 SOP-10 审计 ~R396。
