# R216：R2 远端备份副本每周独立恢复验证

## 取证（verified）
- R214 的 RESTORE-VERIFY 只验证本地 .gz（与 R2 上传同一产物），远端副本从未独立下载验证过；上传侧仅 rclone size 字节数比对。
- 手工演练：从 r2:zalize-backups/kaogong-sqlite 独立下载当日备份 → md5 与本地一致（161796ca…）→ gunzip → quick_check ok → questions=156792。远端副本可恢复。
- rclone v1.75 实测：`copyto` 远端对象缺失时 exit 0 且不产出文件（不能靠退出码判失败）。

## 方案（最小改动）
kaogong-ops.sh 1b' 段：每周日（或 FORCE_R2_VERIFY=1）从 R2 真实下载当日备份到 /tmp，
以「产物存在 + md5 与本地一致」判定，R2-VERIFY ok/FAILED 入 ops 日志；用后即删。
- 频率取周检：每日全量下载 ~150MB 无必要，本地件已每日 quick_check；周检覆盖「上传成功但远端不可恢复」类风险。
- md5 与本地件比对即可传递 quick_check 结论（本地件当日已验证）。

## 验证
- 成功路径：VPS FORCE_R2_VERIFY=1 实跑两次，`R2-VERIFY ok md5 match data-2026-09-02.db.gz`。
- 失败路径：受控用缺失对象跑同段逻辑，`R2-VERIFY FAILED download`。
- bash -n 通过；已同步 VPS /home/ubuntu/kaogong-ops.sh。

## 限制（如实）
- 验证的是「当日上传件」的远端可恢复性，不回溯历史 30 天存量对象。
- 结果仍只入本地日志，无主动通知通道（挂资源项）。
