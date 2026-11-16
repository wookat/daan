# R214：每日备份可恢复性验证（纯 ops 观测补强，不部署应用）

## 取证（verified）
- 生产复审计：深页 Lighthouse（panduan/papers/daily/q/search）perf·a11y·seo 全 1.0；页族 JSON-LD 全部可解析；6 个 hub 页 516 条内链抽样 60 条全 200——SEO/性能/无障碍面无新缺陷。
- 备份链缺口：kaogong-ops.sh 每日产出本地 7 份 + R2 30 天备份，但备份产物从未被验证过可恢复——若 `.backup`/gzip/磁盘位翻转产出坏文件，只会在灾难恢复当天才发现。
- 手工演练（VPS 实跑）：最新 data-2026-09-01.db.gz 解压 3s → 416MB → PRAGMA quick_check 24s 返回 ok，questions=156792，74 表；根分区余 8.4GB，日验成本可承受。

## 方案（最小改动）
- ops 脚本 R2 上传后新增 1c' 步骤：解压当日 .gz 到 `$BK/.verify.db` → python3 sqlite3 `PRAGMA quick_check` + `count(questions)` → 一行 `RESTORE-VERIFY ok questions=N` 或 `RESTORE-VERIFY FAILED <原因>` 入日志 → 删除临时文件。
- 验证对象是与 R2 上传同一份 .gz 产物（端到端覆盖 backup→gzip 链）；quick_check 而非 integrity_check（同等侦错档位下 IO 减半，共享宿主友好）。
- 不改备份/上传/巡检语义，不改应用。

## 验证
- bash -n 通过；VPS 实装实跑：日志落 `RESTORE-VERIFY ok questions=156792`，临时文件已清理；受控坏 .gz 走 FAILED 分支验证告警路径。
- 本地 ruff/pytest 90、lint(src+tests+edge)、vitest 122、build:h5 全绿（回归确认，本轮未动应用代码）。

## 局限
- FAILED 仅入本地日志，无主动通知通道（既有资源项）；R2 侧副本未逐日下载验证（与本地同源同字节，上传已做 size 校验）。
