# R191：生产磁盘治理——历史手工 DB 快照离站归档 + 磁盘水位巡检

## 取证（一手生产证据）

- 共享宿主根分区 86% 满（50G 用 41G，余 6.7G），多个产品共用。
- kaogong 数据卷（deploy_kaogong-data）实占 2.29GB，其中 5 个 8 月治理轮手工全量 DB 快照占 ~1.85GB：
  backup_r33{,b,c}（8-16，各 372MB）、bak_r96_qa{,2}（8-10，各 370MB）。
- 恢复能力已被替代：kaogong-ops.sh 每日 03:40 `.backup` 快照本地保留 7 份 + R2 离站保留 30 天（zalize-backups/kaogong-sqlite），当日备份 154MB 上传校验 ok。

## 处置（先归档后删除，零数据丢失）

5 个快照逐一 rclone 上传至 `r2:zalize-backups/kaogong-sqlite/archive/`（不在 30 天自动清理路径内），远端字节数与本地校验一致后删除本地文件。结果：

- 数据卷 2.29GB → 450MB；根分区 86% → 83–84%。
- 卷内保留：data.db（416MB）+ WAL/SHM、qimg 图片、iter-r3b（24MB）及若干 KB 级 JSON 治理备份（体量可忽略）。

## 预防（最小改动）

kaogong-ops.sh 新增磁盘水位巡检：根分区使用率 ≥90% 时写 `DISK HIGH n%` 入 ops 日志（每日 cron 自然触发），已同步 VPS 并实跑验证（当前 84% 静默、备份/健康巡检语义不变）。

## 如实局限

- 告警仅入本地日志，无主动通知通道（Slack/邮件通道未接，挂资源项）。
- 根分区其余 ~37GB 为其他产品占用，不在本项目治理范围。
