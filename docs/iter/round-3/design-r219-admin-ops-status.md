# R219 设计：运维告警外显到管理台（/api/admin/ops_status + 数据看板运维卡）

## 取证（verified）

- R212/R214/R216 建立的三条运维审计链（容器生命周期、每日备份 RESTORE-VERIFY、
  每周 R2-VERIFY）与磁盘/内存水位巡检，产出全部只落 VPS 本地日志：
  - `/home/ubuntu/kaogong-ops.log`（备份/恢复验证/磁盘/内存/健康巡检行）
  - `/home/ubuntu/kaogong-reports/deploy-history.log`（R203 部署审计）
  - `/home/ubuntu/kaogong-reports/container-events.log`（R212 生命周期审计）
- 老板侧无任何产品内可见入口：RESTORE-VERIFY FAILED、DISK HIGH、UNHEALTHY、
  容器反复重启等告警只有登录 VPS 才能看到，这一「告警只入本地日志无主动通知」
  缺口在 R215/R216 汇报中连续两轮如实申报。
- 管理台数据看板（/admin，A01）已有 KPI/AI 通道状态卡骨架，缺运维状态卡。
- 09-02 实测日志格式（解析依据）：
  - `2026-09-02 00:28:58 RESTORE-VERIFY ok questions=156792`
  - `2026-09-02 00:25:52 R2-VERIFY ok md5 match data-2026-09-02.db.gz`
  - `2026-09-02 00:28:58 MEM mem_avail=489MiB swap_used=2137MiB uvicorn_rss=5160kB`
  - `2026-09-01T16:57:37Z rev=94d28e2 bundle=index-D0KnpgKh.js by=devin-box`
  - `2026-09-01T17:03:01Z CHANGE prev=[…] cur=[…] mem_avail=315MiB …`

## 方案（最小改动）

1. `deploy/kaogong-ops.sh`：LOG 路径从 `/home/ubuntu/kaogong-ops.log` 改为
   `/home/ubuntu/kaogong-reports/kaogong-ops.log`（与另两条审计日志同目录，
   容器可挂载单一目录）。VPS 一次性迁移：追加旧日志内容到新路径后重装脚本。
2. `deploy/docker-compose.yml`：新增只读挂载
   `/home/ubuntu/kaogong-reports:/reports:ro`（仅审计日志目录，不含 .env/备份）。
3. 后端新增 `app/ops_status.py`：纯解析函数 `parse_ops_status(reports_dir)`，
   读取三个日志文件尾部（各最多 64KB），产出结构化 JSON：
   - `last_deploy`（ts/rev/bundle）
   - `backup`/`restore_verify`/`r2_verify`（最近一条 ts + ok/FAILED + 摘要）
   - `mem`（最近一条 mem_avail/swap_used/uvicorn_rss）
   - `container_changes_24h`（CHANGE 行计数）+ `last_container_change`
   - `alerts`：近 7 天含 FAILED / DISK HIGH / UNHEALTHY / SIZE MISMATCH 的行
     （最多 20 条，倒序）
   目录/文件缺失时 `available:false`，不抛异常（本地开发无 /reports）。
4. `admin_api.py` 新增 `GET /api/admin/ops_status`（check_admin 门禁），
   env `OPS_REPORTS_DIR`（默认 `/reports`）。
5. 管理台 `dashboard.js` 新增「运维状态」卡：部署 rev/时间、备份三链最近状态
   （ok 绿 / FAILED 红）、内存水位、24h 容器变更数、告警列表（无告警显示「无」）。

## 明确不做

- 不做外部主动通知通道（邮件/IM webhook 需老板提供资源，继续挂申报项）。
- 不改 ops 巡检逻辑/阈值本身，只改日志落盘目录并外显。
- 不挂载 /home/ubuntu 整目录（含 .env 与备份，越权风险）。

## 验收

- 本地：pytest 新增 parse_ops_status 用例（三链 ok/FAILED/缺文件三态）+ 全量门禁。
- 生产：部署后 /api/admin/ops_status 带 token 实测返回真实三链状态；
  管理台看板 1440 视口出运维卡；无 token 401 不变。
