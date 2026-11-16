# R92：后端版本可校验——/api/health 暴露 BUILD_REV + 部署脚本后置校验

## 生产取证（2026-08-29）

1. **确认事实**：近 3 天 slow_load 49 条中，仅最新 1 条（ShapBot，本轮容器重建后落库）带 R82 的服务端 `;ua:/;hs:` 追加；其余 48 条（含 14.3h 前的最新真实用户样本）全部无追加。当前容器内 `/app/backend/app/team.py` 已确认含 R82 uav 逻辑与 R91 boot 白名单——即**现在**的后端是最新的，但历史窗口内生产后端长期落后于「已部署」的代码。
2. **代码推断**：R75/R82 的追加是入库侧无条件执行（slow_load 恒追加 `;ua:...;hs:...`），不存在按条件跳过的路径；无第二个 /api/track 入口。因此无追加的行只可能出自旧版本后端。
3. **归因**：deploy_h5.sh 的「部署未生效」校验只覆盖前端（step 5 线上 bundle hash 对比本机构建），后端仅有 ADMIN_TOKEN 注入检查，**没有任何手段确认线上容器实际运行的是哪个版本的代码**。而 R65/R73/R91 三轮 deploy 脚本均在 step 4「重建容器」处 ssh 通道挂起（宿主 load 8–10），人工补跑时只补了 CF Pages/预热/回归——容器是否真的用新代码重建过，一直靠推断而非证据。
4. **假设**（无法回溯验证）：R82~R90 期间某次（或某几次）部署的容器重建实际未完成/未生效，导致后端停留在 pre-R82 版本多日，期间 slow_load 归因数据全部缺失 UA/头指纹。

## 方案（零 UI、零新接口、零依赖）

1. `deploy_h5.sh` step 3 前写入 `backend/BUILD_REV`（`git rev-parse --short HEAD`，工作区有未提交改动追加 `-dirty`），随既有 rsync 到生产。
2. `main.py` 启动时读取该文件（不存在回退 `dev`），`/api/health` 响应补 `rev` 字段——健康探针本来就走完整链路，容器 healthcheck 行为不变（仍看 HTTP 200）。
3. `deploy_h5.sh` step 4 容器重建后新增后端 rev 校验：curl 主域 `/api/health` 的 `rev` 与本机 rev 不一致即 FAIL 退出（与前端 bundle hash 校验对等）。
4. `backend/BUILD_REV` 入 .gitignore（部署产物，不入仓库）。

## 验收

- 本地：ruff 通过；无 BUILD_REV 时 /api/health 返回 `rev:"dev"`。
- 生产：部署后 `/api/health` 返回本机 HEAD 短 SHA；脚本校验步骤输出 OK；healthcheck/autoheal 行为不变（容器 healthy）。

## 边界

- rev 只证明「容器里的代码 = 本次 rsync 的代码」，不证明业务正确性（业务回归仍靠 step 6）。
- /api/health 不在边缘缓存清单，无缓存陈旧问题。
- 历史缺失的 slow_load 归因数据不可回填。
