# R434 — R2 `kaogong-sqlite` 前缀盘点：30 天清理递归误伤 `archive/`（差 2.6 天）+ archive 统一 gzip

日期：2026-09-06 22:40–23:10 CST（服务器时间）。范围：只读盘点 R2 前缀 + `deploy/kaogong-ops.sh` 1 行修 + archive/ 对象格式整理。
不动活跃库、不动每日备份、不动别家前缀（`d1/ honestcv-kv/ probe/ recruit-pg/`）、不重建容器。

## 1. 只读盘点（`rclone lsl r2:zalize-backups/kaogong-sqlite/`，rclone v1.75.0）

| 对象 | 字节 | 修改时间 | 归属 |
|---|---|---|---|
| `data-2026-08-27.db.gz` … `data-2026-09-06.db.gz`（11 份） | 135.7–167.5 MB | 每日 03:40（09-01/09-02/09-06 为手工重跑） | ops 脚本每日上传 |
| `archive/backup_r33_1786813083.db` / `_r33b_` / `_r33c_` | 372.3 MB ×3 | 08-16 | R191 归档的 R33 系列手工快照（未压缩 .db） |
| `archive/bak_r96_qa.db` / `bak_r96_qa2.db` | 370.7 MB ×2 | 08-10 | R191 归档的 R96 手工快照（未压缩 .db） |
| `archive/data.db.bak-w3.gz` / `archive/r418-before.db.gz` | 178.3 / 179.3 MB | 09-06 22:28 | R433 归档 |

合计 18 对象 3.585 GiB；bucket 全部前缀 73 对象 5.641 GiB（R2 免费额度 10 GB，超出按 $0.015/GB·月计费）。
每日备份最早 08-27（R2 上传从 R184 起），未满 30 天 → 「30 天保留是否真在执行」目前**无可观测样本**，只能看清理命令的作用域（见 §2）。
ops 日志 `r2 upload ok` 累计 17 行，与 11 个对象 + 6 次同日重传一致（同名覆盖）。

## 2. 命中：`rclone delete --min-age 30d "r2:$BUCKET_PREFIX/"` 递归进 `archive/`

`rclone delete` 默认递归。`--dry-run --min-age 1s` 复现（真实生产前缀，只 dry-run）：

```
rclone delete --min-age 1s --dry-run r2:zalize-backups/kaogong-sqlite/
  → 11 份 data-*.db.gz  +  archive/ 全部 7 个对象   ← 旧命令作用域
rclone delete --min-age 1s --max-depth 1 --include "data-*.db.gz" --dry-run r2:zalize-backups/kaogong-sqlite/
  → 只有 11 份 data-*.db.gz                          ← 新命令作用域
rclone delete --min-age 30d --dry-run （新旧两版）
  → 空（今天没有任何对象 ≥30 天）
```

对象年龄（09-06 22:43 计）：`bak_r96_qa*.db` 27.4 天、`backup_r33*.db` 21.9 天、R433 两份 0 天。
即：**按旧命令，09-09 13:21 后 `bak_r96_qa*.db` 满 30 天，09-10 03:40 的日常 cron 就会把它们删掉**，09-16 删 r33 三份，10-06 删 R433 两份——
R191 建的「永久归档」实际是「30 天后静默消失」，此前没出事只因为最早的归档还差 2.6 天到期。这是事实（dry-run 可复现），不是推断。

修（`deploy/kaogong-ops.sh` 1 行）：

```diff
-      rclone delete --min-age 30d "r2:$BUCKET_PREFIX/" 2>/dev/null
+      # 只清顶层每日备份；archive/ 是永久手工快照，rclone delete 默认递归会把它一并按 30 天清掉
+      rclone delete --min-age 30d --max-depth 1 --include "data-*.db.gz" "r2:$BUCKET_PREFIX/" 2>/dev/null
```

`--max-depth 1` 排除子前缀，`--include "data-*.db.gz"` 再限文件名（双保险，日后有人往顶层放别的文件也不会被清）。
同步：`bash -n` → `scp` → 两端 md5 `362cba733835c53b5c2ae6446f9f2ac1` 一致 → 新命令在生产**非 dry-run 实跑一次** rc=0、对象仍 18 个 3.585 GiB（今天无到期对象，行为等价于 dry-run，但证明参数在 v1.75 有效）。
不再整脚本重跑（R433 22:36 已跑过，唯一改动的就是这一行且已单独实跑）。

## 3. archive/ 5 份未压缩 .db → gzip（流式、不落宿主盘、回读一致才删原件）

5 份 .db 共 1.86 GB 未压缩（每日备份同库 gzip 后 ≈ 2.6:1），宿主只剩 4.6 G 不能下载到本地，走
`rclone cat x.db | gzip -6 | rclone rcat x.db.gz` → `rclone cat x.db.gz | gunzip | md5sum` 与 `rclone cat x.db | md5sum` 一致 → `rclone deletefile x.db`。
脚本 `/home/ubuntu/r434_archive_gzip.sh`（`setsid nohup` 后台，日志 `~/r434_archive_gzip.log`）。结果见 §3.1。

### 3.1 结果（5/5 回读 md5 一致、原件已删；每份 97–131 s；期间容器 healthy、`/api/health` 200）

| 对象 | 原 .db 字节 / md5 | .gz 字节 | gunzip 回读 md5 |
|---|---|---|---|
| `backup_r33_1786813083` | 372310016 / `019eac36…` | 135649401 | `019eac36…` ✓ |
| `backup_r33b_1786815272` | 372334592 / `544f3dd1…` | 135659577 | `544f3dd1…` ✓ |
| `backup_r33c_1786816960` | 372342784 / `e6f9f040…` | 135661007 | `e6f9f040…` ✓ |
| `bak_r96_qa` | 370716672 / `6acfe1bd…` | 134983007 | `6acfe1bd…` ✓ |
| `bak_r96_qa2` | 370716672 / `6cf7d4a9…` | 134987761 | `6cf7d4a9…` ✓ |

archive/ 1.86 GB → **987 MiB**（7 对象）；`kaogong-sqlite/` 3.585 → **2.484 GiB**；bucket 5.64 → 4.54 GiB。
注意副作用：这 5 个 .gz 的 R2 mtime 变成 09-06（上传时刻）——在旧的递归清理下反而「续命」到 10-06，但清理已改作用域，不再相关；
快照的真实日期保留在文件名（`1786813083` 等 Unix 秒 / `r96`）。
整理后新清理命令 `--dry-run --min-age 1s` 作用域仍是 11 份每日备份、archive/ 0 个。

## 4. 卷内其余项归属（只读）

`/data/iter-r3b/` 24 MB = R3b 题库清洗账本（`ledger.jsonl` 15 MB、`fixes.sql` 9.3 MB、`delist.sql`、`scripts/`、`report.md`），是题目改写的可追溯依据 → 保留不动；
`/data/r4xx-*.json` 各轮处置记录（restore 输入）→ 保留；`/data/qimg` 200 张 16 MB → 保留。无新增可动项。

## 5. 未验证 / 登记

- 「30 天清理真在执行」要到 09-26（08-27 那份满 30 天）后看 R2 是否少一份，现在只能证明作用域正确。
- R2 用量：kaogong 稳态 ≈ 30 × 170 MB ≈ 5 GB + archive；bucket 已 5.6 GiB、多产品共用，超 10 GB 后是付费不是失败——记录，不在本轮决定保留天数。
- archive/ 现为单副本（R2 一处），本轮不改。
- 别家（recruit-pg 等）是否有同样的递归清理写法：`/home/ubuntu` 下无其他 `rclone delete` 脚本，别家脚本位置不在本轮范围，未看。
