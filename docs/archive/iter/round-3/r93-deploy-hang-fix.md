# R93：部署脚本容器重建通道去挂起——远端 compose 后台化 + rev/StartedAt 轮询收敛

## 生产确认事实
- R65/R73/R91/R92 四轮部署，脚本均在 step 4「重建容器」的 ssh 通道上长时间挂起（宿主 load ~10），远端 compose 实际早已完成（独立 ssh/curl 可证容器 healthy、rev 正确），但脚本拿不到返回、后续 4a–6 步骤从未在脚本内自然执行，只能人工补跑等价校验。
- R93 取证（生产 DB）：`boot` 事件全表 0 行、近 3 天 49 条 slow_load 中 48 条缺 R82 无条件追加的 `;ua:`（含 2026-08-30 的样本），而 R82 的追加在入库侧是无条件的——即 R92 重建前的生产后端容器长期运行旧代码；期间近 48h 仍有 17 个真实 uid 在 answer_log 产生作答。老后端缺 R91 allowlist 会把 boot 上报 400 拒绝，boot=0 首先由后端版本解释，不能归因客户端。
- 当前容器（R92 部署后）rev=99a8e1c-dirty 与本机一致，/api/health 可作为部署 ground truth（R92 已建立）。

## 代码推断
- deploy_h5.sh step 4 以前台 ssh 长通道执行 `docker compose up -d --build`，高负载宿主上该通道可无限挂起；`set -euo pipefail` 下脚本整体卡死，后续校验步骤全部旁路。
- 人工补跑不含 compose 重建时，「rsync 已更新代码」≠「容器已用新代码」，这正是 R92 取证的后端长期旧版窗口的最可能成因（假设级，历史证据不可回填）。

## 方案（本轮，零依赖）
1. SSH_OPTS 增加 `ConnectTimeout=15 ServerAliveInterval=15 ServerAliveCountMax=4`：所有 ssh/rsync 通道不再无限挂起。
2. step 4 改为远端后台执行：`nohup docker compose up -d --build > /tmp/kg-compose.log 2>&1 &`，ssh 立即返回。
3. 新增收敛轮询（≤600s，每 10s）：记录部署前容器 StartedAt，轮询至「StartedAt 变化（容器已重建）且 /api/health rev == 本机 BUILD_REV」才继续；超时打印远端 /tmp/kg-compose.log 尾部并 FAIL。
4. 收敛后取回 compose 日志尾部展示，其余步骤（ADMIN_TOKEN/4a/4b/4c/5/6）不变。

## 边界
- 若本次 rev 与线上相同（重复部署同一提交），靠 StartedAt 变化保证确实发生了重建，不会提前放行。
- 轮询本身用短命 ssh + curl，单次失败继续重试，不因瞬时抖动 FAIL。
- 共享宿主高负载根因（recruit-* 竞争）不变，属 owner-level 决策。

## 验收
- bash -n 通过；完整跑一次 `deploy_h5.sh --skip-build`：脚本自然走完 4→4a→…→6/6 不挂起，全绿。
- 生产 /api/health rev 与本机一致、容器 healthy、关键路由 200。
