# R239：deploy shell 脚本 shellcheck 门禁 + 存量清零

## 取证（verified / inference / unknown）

- verified：仓库 5 个 shell 脚本（deploy_h5.sh / kaogong-ops.sh / kaogong-lifecycle-watch.sh / cron_access_report.sh / perf-budget.sh）历轮验收仅 `bash -n`（纯语法），无语义级静态检查；shellcheck（业界标准 shell 静态分析）全量实扫报 4 处：
  - kaogong-ops.sh SC2166（warning）：`[ p -o q ]` POSIX 未定义行为——R2 周验证触发条件 `[ "$(date +%u)" = "7" -o "$FORCE_R2_VERIFY" = "1" ]`，真实正确性风险（bash 当前实现恰好可用，但属未定义语义，跨 shell/版本不保证）。
  - kaogong-ops.sh SC1090 / SC2012、cron_access_report.sh SC2086：非常量 source、受控文件名 ls 解析、故意展开的 glob——均为有意为之，定点 directive 豁免并注明理由。
- verified：本轮 24h origin 复审计无新产品缺陷：4xx 全部为历史探针流量（140.232.64.5 共享 NAT，/api/exam/* 历史风暴 + 本会话各轮探针；/llms.txt、/tiku/shenlun/ 的 404 全部早于 R231/R236 部署时刻，当前均 200）；慢样本聚簇在部署窗口（lb_try 排队属设计行为）。
- verified（R238 收口补证）：TTL 过期后生产实测 stats/dashboard `X-Kg-Cache: stale`（0.01–0.03s 回旧值）→ 下一请求 `hit`，SWR 后台刷新逐请求证实；R235 lb_try 实施（09-01 21:31 UTC）后 3 次容器重建 origin 零 502。
- inference：这批 ops 脚本管备份/生命周期/周报，静默语义错误的代价是「灾难恢复时才发现备份链坏了」，静态门禁性价比高。
- unknown：/api/exam/* 历史 502、storm guard 历史未触发根因（继续挂观察，不做猜测性改动）。

## 方案

1. 修复 SC2166：`[ p -o q ]` → `{ [ p ] || [ q ]; }`（POSIX 明确定义，行为等价）。
2. 有意为之处定点 `# shellcheck disable=SCxxxx` 并注明理由（对齐 R217 pyright 定点豁免手法），不做全局压制。
3. 门禁基线：`shellcheck deploy/*.sh` 0 输出（默认严格度，含 info），与 `bash -n` 并列为 shell 变更验收项。
4. VPS 侧同步 kaogong-ops.sh（runtime 行为触及行 = R2 周验证触发条件），受控 FORCE_R2_VERIFY=1 实跑复验。

## 边界（不做）

- 不改任何脚本业务逻辑/输出格式/cron 语义；
- 不引入 CI（公司规则 Actions 保持禁用），shellcheck 为本地门禁；
- 不扫 node_modules 内第三方脚本。

## 验证

- `shellcheck deploy/*.sh` 0 输出 + `bash -n` 5 脚本全过；
- VPS 同步后 FORCE_R2_VERIFY=1 实跑：R2-VERIFY 行正常入日志（触发条件重写后仍触发）；
- backend/frontend 零触及，不跑对应门禁；无生产产物变更不走 deploy_h5.sh。
