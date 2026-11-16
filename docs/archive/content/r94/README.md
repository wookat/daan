# 轮94：性能与稳定线（H5 关键页性能测量 + 后端慢查询巡检）

分支 `devin/1786333914-r89`（PR#121）。本轮变更：`backend/app/db.py` 新增 tag3 covering 索引并切换抽题查询走该索引；H5 前端零改动。

## 1. H5 首载/关键页性能测量

- 工具：Lighthouse 13.4.1（headless Chrome，`--form-factor=mobile` + 移动端屏幕仿真，performance 单类目）。
- 页面：首页 `/#/`、练习 `/#/pages/practice/practice`、错题本 `/#/pages/book/book`、统计 `/#/pages/stats/stats`（H5 为 hash 路由，直连 `/pages/...` 路径 404，测量 URL 均带 `#`）。
- 网络两档：
  - **4G**：Lighthouse 默认移动 throttling（slow-4G：RTT 150ms / 1.6Mbps / CPU 4x）；
  - **3G**：自定义 Regular-3G（RTT 300ms / 700Kbps / CPU 4x）。

### 结果（单次测量）

| 页面 | 网络 | 分数 | FCP | LCP | TBT | SI | CLS | 首载总量 |
|---|---|---|---|---|---|---|---|---|
| 首页 | 4G | 89 | 1.4s | 2.1s | 30ms | 2.2s | 0.207 | 158 KiB |
| 练习 | 4G | 99 | 1.4s | 1.6s | 0ms | 1.5s | 0 | 136 KiB |
| 错题本 | 4G | 98 | 1.4s | 1.7s | 10ms | 1.8s | 0.073 | 142 KiB |
| 统计 | 4G | 98 | 1.4s | 1.7s | 40ms | 1.8s | 0.085 | 135 KiB |
| 首页 | 3G | 89 | 2.7s | 3.0s | 10ms | 3.1s | 0.019 | 124 KiB |
| 练习 | 3G | 90 | 2.7s | 3.0s | 0ms | 2.7s | 0 | 136 KiB |
| 错题本 | 3G | 85 | 2.7s | 3.5s | 10ms | 3.0s | 0.073 | 142 KiB |
| 统计 | 3G | 85 | 2.7s | 3.4s | 40ms | 3.0s | 0.085 | 135 KiB |

### 解读与 Top 瓶颈

基础面良好：四页均已按路由分包（页面 chunk 20-25 KiB br）、assets 预压缩 brotli（vendor 主包 index-\*.js 传输仅 97.6 KiB）、首载总量 124-158 KiB，3G 下 LCP 也在 3.0-3.5s，四页分数 85-99。懒加载/分包/预压缩三板斧此前轮次已落地，本轮无需求改。

Top 瓶颈（按影响排序）：

1. **首页 CLS 0.207（4G 场景）**：首页多张卡片（今日计划/时政/到期复习/召回横幅）依赖异步接口 `v-if` 插入，数据到达时把「专项练习」等 `.sec-h` 区块往下推。3G 下因加载节奏不同仅 0.019，属时序敏感型位移。
2. **vendor 主包未用 JS ~59 KiB（未压缩口径）**：uni-app/组件库框架代码在各页首载均报 unused-javascript（3G 下预估节省 ~600ms），是框架级公共包，进一步拆分属大项。
3. 服务端响应 102ms（首页 4G 报告）：已达标，无需处理。

### 当轮优化决策

四页分数 85-99、首载 <160 KiB，前端无「性价比高且低风险」的当轮项——为 CLS 给异步卡片预留占位高度会牺牲空态观感、收益不确定；vendor 拆分属框架级改造。故 H5 本轮零改动，两项列立项（见 §4）。

## 2. 后端慢查询巡检

### Caddy 日志 p95/p99（近7天，/api/ 去参数/归一动态 ID）

| p95(s) | p99(s) | max | n | path |
|---|---|---|---|---|
| 16.47 | 16.47 | 16.47 | 18 | /api/exam/start |
| 6.38 | 13.02 | 16.44 | 383 | /api/questions |
| 2.06 | 2.06 | 2.06 | 8 | /api/exam/submit |
| 0.93 | 0.93 | 0.93 | 12 | /api/followup |
| 0.90 | 0.90 | 0.90 | 2 | /api/papers |
| 0.69 | 0.69 | 0.69 | 2 | /api/export/pdf |
| 0.64 | 0.64 | 0.64 | 4 | /api/health |
| 0.59 | 0.59 | 0.59 | 2 | /api/config |
| 0.50 | 0.83 | 0.83 | 38 | /api/exam/papers |
| 0.38 | 0.38 | 0.38 | 4 | /api/search |

### 根因定位

逐条比对慢请求时间线：`/api/questions` 的 2-16s 长尾**几乎全部集中在带 `tag3=` 的请求**（如 `tag3=CS-LS-01&module=changshi`）。生产库实测复现：

- `idx_q_tag3_disabled(tag3, disabled)` 非 covering，`ORDER BY has_hs DESC, RANDOM()` 需回表读 9,038 行大行（题干/解析全列），单条查询 warm 也要 **1.09s**；一次请求最多跑 3 条这类查询 + uid 排重 NOT IN，冷缓存下叠加到 3-16s。
- `/api/exam/start` 16.5s 为孤立冷启动样本（02:05 容器冷缓存首访）；warm 实测 `create_mock_paper` 模块抽题 0.12s/条（走 idx_q_pick covering），无结构性问题。

### 当轮修复

新增 covering 索引并切换 tag3 抽题路径：

```sql
CREATE INDEX idx_q_tag3_pick ON questions(tag3, disabled, is_real, has_hs, id)
```

`db.random_questions()` 中 `INDEXED BY idx_q_tag3_disabled` 两处改为 `idx_q_tag3_pick`（EXPLAIN 确认 `USING COVERING INDEX`，不再回表）。生产库建索引 2.6s，同条查询 **1.09s → <0.01s**。

### 部署与回归

`deploy/deploy_h5.sh --skip-build` 部署（rsync backend + 重建容器），bundle hash 一致、7 端点回归全 200。线上复验：此前最慢的 `/api/questions?limit=10&tag3=CS-LS-01&module=changshi`（带 uid 排重）**3-16s → 0.6-1.4s**（首发含冷缓存 1.4s，后续 ~0.6s，其中含网络往返）；`/api/exam/start`（mini）warm 0.75s。

## 3. 例行观测 + health_scan

health_scan.py（生产容器内跑）全绿：

```text
active 113304 / full 156792
lt50 0 / badjson 0 / cid 0 / fffd 0 / spam_residue 0
hs_mismatch 0 / empty_hs_beyond_ledger 0（台账 changshi:655861、panduan:334296 未动）
paper_dup 0 / paper_lowcov 仅卷112（65题/58%）
last7d (39, 14)
```

近7天爬虫：YandexBot 84（/tiku 80）+ bingbot 1 + Baiduspider 1；/s/ 12 次仍全为自测/扫描器，无真实落地；Bing 收录仍未破零（站长验证仍 P0）。

QA 清理：本轮性能 QA uid `devin-r94-perf`（1 条未交卷 attempt）及 Lighthouse 匿名访问统计页误触发的 2 条 `heatmap_view`（uid umsmqu…/umsmqw…）已事务删除，复扫残留 0。

## 4. 大项立项（P2）

1. **首页 CLS 治理**：异步卡片（今日计划/时政/到期复习/召回）骨架屏或预留高度方案设计，目标 CLS <0.1（需兼顾空态观感，单独设计后实施）。
2. **vendor 主包瘦身**：uni-app/组件库公共包 unused-JS ~59 KiB，评估组件库按需引入与 manualChunks 进一步拆分（框架级改造，需全站回归）。
3. **冷启动预热**：容器重建后首访存在秒级冷缓存长尾（exam/start 16.5s 孤例），可在部署脚本容器起后加一组预热请求（低成本，下轮顺手做）。

## 5. 限制

- Lighthouse 为单次测量非多次取中位数，分数有 ±3 左右波动（首页 CLS 4G 0.207 vs 3G 0.019 即时序波动的体现）。
- p95/p99 基于近7天低流量样本（部分端点 n<10），统计意义有限，照实列出。
- 慢查询修复只动索引与 INDEXED BY 提示，未改任何抽题语义（随机策略/难度自适应/uid 排重口径均不变）。
