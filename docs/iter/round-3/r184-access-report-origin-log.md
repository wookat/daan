# R184：访问日志周报/归档切换到 origin 日志（修复观测断流）

## 取证（生产一手，2026-09-01）

- `/var/log/caddy/kaogong.zalize.com-access.log` 最后一行 ts=1787677523（2026-08-25），
  自 CF Pages 迁移（R85/R86 架构）后该 Caddy 站点块不再有流量——README 早已注明
  「kaogong.zalize.com 块的日志自 CF Pages 迁移后不再有流量」，但观测管线没跟着切：
  - 每周一周报 cron（`cron_access_report.sh`）`LOG_GLOB` 仍指向死日志；
  - 小时级归档 cron（`archive_access_log.py`，crontab 条目）同样指向死日志。
- 后果：`access-weekly-20260831.txt` 仅 329 字节（近 7 天几乎为空报告），
  真实回源流量全部在 `kaogong-origin.zalize.com-access.log`（roll_size 50MiB /
  roll_keep 14 / 336h），风暴期两次轮转即挤掉历史——不归档则窗口丢失。
- origin 日志字段核验：`User-Agent` 由边缘函数原样转发（与 `X-Kg-Ua` 一致），
  `X-Kg-Ip` 为真实客户端 IP（`remote_ip` 是 CF 边缘 IP）；现有
  `access_log_report.py` 的 UA 分类无需改动。

## 方案

1. `deploy/cron_access_report.sh`：`LOG_GLOB` 切到
   `/var/log/caddy/kaogong-origin.zalize.com-access*.log*`，报告标题注明
   「origin 回源流量（不含 Pages 静态直出与边缘缓存 HIT）」。
2. 服务器 crontab 小时级归档条目同步改 glob（归档目录不变，
   与旧边缘日志归档天然按 ts 分桶续接，`.state` 按文件名记偏移无冲突）。
3. `deploy/README.md` R85 段落补一句周报/归档已切 origin 日志。

语义变化（如实声明）：周报覆盖面从「边缘全量」变为「回源流量」——Pages 静态
资产与边缘缓存 HIT 不经 origin，不在统计内；全量视图需 CF Analytics（现有
token 无该权限，已在资源申报清单）。

## 验证

- 服务器实跑 archiver（新 glob）增量归档 origin 日志成功、`.state` 正常推进；
- 手动触发周报生成，输出含近 7 天回源流量统计（状态码/UA 分类/tiku Top URL），
  不再是空报告；
- crontab 条目已更新（`crontab -l` 复核）。
