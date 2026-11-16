# R196：性能预算回归护栏（Lighthouse 预算脚本 + 部署后自动复验）

## 取证（2026-09-01，生产一手证据）

1. **窗口复核无新缺陷**：7d growth_events：boot 145 / slow_load 47（仍为 nav:60/90s 无 UA 族群 + 个别 mistakes 长尾，均为已知模式，uid 页面侧已被快照即显覆盖）；每日一练/推送参与仍 0（获客侧，已申报）。
2. **/tiku/search 400 复核为误报**：R196 初次探测 `curl "…/tiku/search?q=比重"`（原始 UTF-8 未编码写入请求行）得 400；改用规范 percent-encoding 及浏览器表单提交路径复测均 302 → `/#/pkgA/search/search?q=…`，与后端契约/测试一致。结论：400 系探测方法产物（非法请求行），非生产缺陷，不立项。
3. **SEO 题目页族抽测**：`/tiku/q/1` Lighthouse 四项全 1.0，canonical/301/内链完整；`/tiku/q/50000`（不存在）正确 404。
4. **真实缺口是流程性的**：性能/无障碍水位（R122/R149/R175/R193 建立的 perf≥0.96、a11y=1.0）只靠每隔若干轮手工跑 Lighthouse 维持——R193 的 LCP 双峰、R122 前的 perf 0.91 都曾长时间存在而未被发现。部署脚本 step 5/5b/6 只验证「部署生效 + 接口 200」，对性能/无障碍回归零感知。老板明确列出「性能预算与 Lighthouse 回归」为可推进方向。

## 方案

新增 `deploy/perf-budget.sh`：对生产 URL 集（默认 `/`、`/tiku/`）跑 Lighthouse（无头 Chrome，`CHROME_PATH` 可覆盖），按预算断言：

| 指标 | 预算 | 依据（近期稳定水位） |
|---|---|---|
| performance | ≥ 0.90 | R193 后 0.97–0.99 |
| accessibility | ≥ 1.00 | R130/R164/R195 后稳定 1.0 |
| best-practices | ≥ 0.90 | 稳定 1.0，偶发 /api/track 瞬时 502 记 0.96（R175 实证），预算容忍 |
| seo | ≥ 0.95 | 稳定 1.0 |
| LCP | ≤ 2500ms | R193 后 0.8–1.8s |
| CLS | ≤ 0.10 | R43 后 <0.1 |

另有本地构建产物预算：主 bundle gzip ≤ 160KB（当前 122KB，防未来无意引入巨依赖）。

`deploy_h5.sh` 新增 step 6b：部署后自动跑预算脚本。默认 **WARN 不阻塞**（Lighthouse 单次抖动/共享宿主争抢会产生假红，R173 教训：部署校验不能对非确定信号硬失败）；`PERF_BUDGET_STRICT=1` 时违例即 exit 1。可用 `SKIP_PERF_BUDGET=1` 跳过（如紧急回滚部署）。

不做：CI 集成（仓库无 CI，公司规则）；实验室外 RUM 预算（已有 slow_load 埋点观察）。

## 验证计划

- `bash -n` 两脚本；ESLint/vitest/ruff/pytest 全绿（无生产代码变更，跑以确认零影响）。
- 直接对当前生产跑 `deploy/perf-budget.sh`，预期全部通过（当前水位在预算内）。
- 篡改预算阈值（如 LCP ≤ 1ms）验证违例路径 exit 1 与输出可读。
- 部署路径 step 6b 于下轮部署时自然复验（同 R173 模式）。
