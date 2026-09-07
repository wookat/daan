# R432：访问归档 gzip（宿主磁盘 94% 的一手可动项）+ probe=0 / error_reason 到期复查

日期：2026-09-06（服务器时间）。分支 `devin/1788611745-r400-formula-dropped-snapshot`（PR #619）。
改动：`scripts/crawler_stats.py`（读 `.jsonl.gz`）、`deploy/cron_access_report.sh`（`zcat -f` 读 + 3 天后 gzip）、
`backend/tests/test_crawler_stats.py`（+1）。后端/前端不动、bundle 不变、不重建容器。

## 一、起点复查（只读，`docker exec deploy-kaogong-1 python3 -` + `file:/data/data.db?mode=ro`）

事实（`created_at` 是 Unix 秒 real，按 `date(created_at,'unixepoch')` 分桶）：

- `answer_log probe=0`：仍只有 R425 那台 vivo 小程序 uid `umst3tuisd7lgzaka`，**22 行全在 09-06**（00:10 UTC 2 行 +
  08:57 UTC 20 行 = R425 复盘过的那次到访），09-06 08:57 UTC 后 **无新行**；09-06 全天其余 55 行 answer_log 为 8 个 probe=1 uid。
  → 无「后续到访」可复盘。该 uid `mistakes` 18 行（mastered 2）、`error_reason` 非空 0。
- `mistakes.error_reason` 非空全库 6 行（3 个 uid：`umsacie728f4ghcv8` 08-01 ×2、`umsn3fw28a73cn3cc` 08-10 ×1、`u32` 09-02 ×3），
  按 uid 关联 `answer_log.probe`：三个 uid 的作答行 **全部 probe=NULL**（60/3/44 行），probe=0 与 probe=1 均为 0。
  `u32` 是 R2 时代手写 uid 形态，属内部走查；另两个是 08-01/08-10 探针口径生效前（R374 是 08-31 上线）的历史 NULL。
  → **probe=0 的 error_reason 仍为 0 行**；≥09-11 的到期复查条件（服务器日期）仍未到。
- 结论：本轮起点三项都无新证据、不改产品代码。**不把 vivo 设备归为外部真人**（口径同 R425）。

`mistakes` / `review_log` / `interview_sessions` / `shared_answers` / `users` 无 `probe` 列，只能经 uid 关联 `answer_log`
（首次查询直接 `probe` 报 `no such column`，已入 SKILL）。

## 二、宿主磁盘：找到一处可直接动、可逆、可验证的项

宿主 `df /`：50 G / 已用 45 G / 剩 3.0 G（94%）。`du` 一手（R431/R432 两次同形）：

```
12G  /var/lib/docker（volumes：recruit_app_pgdata 8.5G / softcopyright_app_storage 2.0G / deploy_kaogong-data 922M）
11G  /var/lib/containerd
7.2G /opt（SoftCopyrightAgent/backups 5.8G）
3.6G /home（recruit-backups 589M / LinkShopProxyHub 548M / kaogong-backups 468M / kaogong-reports/access-archive 415M）
```

大头都是别家产品的数据卷/备份，不是我能动的（扩盘/迁出仍待老板决定）。**kaogong 自己名下唯一可动项**：
`/home/ubuntu/kaogong-reports/access-archive` 415 MB **全部明文** `access-YYYYMMDD.jsonl`（20 个日文件，
最大 08-18 184 MB、09-01 139 MB——两天都是引擎/扫描器灌量日），保留 90 天。

对照同机 crontab：recruit 自己的归档早有 `find access-archive -name 'access-*.jsonl' -mtime +1 -exec gzip -f {} \;`
（60 天），kaogong 的 `cron_access_report.sh` 只有 `-mtime +90 -delete` 没有压缩——R184 切 origin 日志时漏配。

### 读取侧现状（改前）

- `scripts/crawler_stats.py::iter_archive` 只 `open()` 明文，文件名不在 `wanted` 集合就跳过 → `.gz` 会被**静默忽略**，
  先压缩会让 14 天窗口的抓取日报少算前 11 天。
- `deploy/cron_access_report.sh` 周报 `cat access-*.jsonl | access_log_report.py -`（原始日志分支已是 `zcat -f`）。

### 修法（最小）

1. `iter_archive`：`fn.removesuffix(".gz")` 再对 `wanted`，`.gz` 用 `gzip.open(..., "rt")`（Python gzip 原生支持多成员流）。
2. 周报输入改 `zcat -f access-*.jsonl*`（明文原样透传、.gz 解压）。
3. 周报末尾（每周一 08:00，与既有 90 天清理同处）：`find -name 'access-*.jsonl' -mtime +3` → `gzip -c "$f" >> "$f.gz" && rm -f "$f"`。
   - 用 `gzip -c >>` 追加成**多成员 gz**而不是 `gzip -f`：同一天若事后又归档出新 `.jsonl`（如 `.state` 丢失重灌、
     跨日尾巴），不覆盖已有 `.gz`；读侧 `zcat`/`gzip.open` 都能连读多成员。
   - `touch -r "$f" "$f.gz"` 保留原 .jsonl 的 mtime：否则 .gz 以压缩当天计龄，90 天删除会顺延到「压缩后 90 天」
     （首批手压时漏了这一步，事后按原 `ls` 记录的日期 `touch -d` 回写 15 个 .gz，精度到天）。
   - `-mtime +3`：小时级归档 `archive_access_log.py` 对「今天」文件持续追加、昨天文件次日 :17 还会补最后一小时，
     3 天足够冷却；`+3` 与 `+90` 的 `-name 'access-*.jsonl*'` 一并覆盖 .gz。
4. 单测 `test_iter_archive_reads_gzipped_and_multi_member_files`：明文 + 单成员 gz + 多成员 gz 混读、窗口外 gz 不读、
   多成员两段都计数。

未改：`archive_access_log.py`（归档写入侧不动）、`access_log_report.py`（读 stdin，不感知压缩）、保留期 90 天。

## 三、本地验证

- `pytest tests/test_crawler_stats.py` 14 passed（+1）；全量 pytest **490 passed**（R431 489 + 1）。
- `ruff check` 0（首版 `fn[:-3] if fn.endswith(".gz")` 被 FURB188 要求改 `removesuffix`，已改）。
- `pyright ../scripts/crawler_stats.py`：1 error = `Import "access_log_report" could not be resolved`（脚本目录不在
  pyright roots，**改前 stash 对照同 1 error**，非本轮引入）。
- `bash -n deploy/cron_access_report.sh` 通过（本机无 shellcheck）。

## 四、生产上线与一手验证

`scripts/` 与 `deploy/` 不在 `deploy_h5.sh` rsync 清单里（README 早有说明）→ `scp` 两个文件到
`/home/ubuntu/kaogong-assistant/{scripts,deploy}/`，md5 与本地一致（`00338b23…` / `bef30794…`）。
不重建容器（后端不动），不部署。

压缩步骤不等周一 cron，手工跑与脚本**逐字相同**的 while 循环（`nice gzip -c >> && rm -f`）：

| 项 | 改前 | 改后 |
|---|---|---|
| `access-archive` | 415 MB / 20 个 .jsonl | **86 MB** / 15 个 .gz（≤09-01）+ 5 个 .jsonl（09-02…09-06） |
| `df /` | 89% / 5.5 G 可用（压缩前一刻） | **88% / 5.9 G 可用** |
| 耗时 | — | 3.3 s（user 3.0 s，nice） |

（R431 收尾量的是 94%/3.0 G，压缩前一刻已是 89%/5.5 G——中间有他家 cron（`docker builder prune`/image prune 04:20 等）
释放过，不是本轮；**本轮自身贡献 = 5.5 → 5.9 G ≈ 330 MB**，与 415→86 MB 一致。）

压缩正确性：
- `gzip -t` 15 个 .gz 全通过；`zcat access-20260901.jsonl.gz | wc -l` = 81,250 行。
- **抓取日报**：改前 `crawler-stats.json`（14:03 UTC cron 产物）vs 用新脚本对压缩后目录重算：`days` 08-24…09-06 同、
  引擎 hits `Yandex 1184 / Bing 119 / Google 47 / Apple 3` 同、除 `generated_at` 外**所有键逐一相等**（`changed_keys []`）。
- **周报**：改前 `cat *.jsonl | access_log_report.py - --days 7` 30 行输出 vs 改后 `zcat -f access-*.jsonl* | …`：`diff` 空
  → **WEEKLY_IDENTICAL**。
- 上线后自然 cron：见文末「后续 cron 观察」。

## 五、登记 / 如实说明

- 这是「kaogong 名下唯一可动项」，不是宿主问题的解：动后 88%/5.9 G，别家 12 G 卷 + 11 G containerd + 5.8 G 备份没有变，
  扩盘/迁出 recruit·softcopyright 仍待老板决定；本轮**未删任何文件**（只是 .jsonl → .gz），无 Docker prune、无 DB 动作。
- 压缩比：被压的 15 个文件 ≈360 MB → 14.4 MB（**≈25:1**；08-18 184→6.1 MB、09-01 139→6.4 MB 这类扫描灌量日 UA/路径高度
  重复压得最好），剩余 86 MB 里 75 MB 是尚未到 3 天的 5 个明文。脚本注释写的「约 10:1」是保守估算，以此处实测为准。
- `-mtime +3` 的判断依据是 `archive_access_log.py` 的按天写入形态（今天追加、昨天 :17 补尾），未做「第 3 天还会不会写」
  的长期观测；若出现同日 `.jsonl` 与 `.gz` 并存，读侧两个都读、下周一再追加成多成员，不丢行；是否重复计数取决于归档侧
  有没有重灌（`.state` 丢失才会），与压缩无关——宁重不丢。
- 三个起点（vivo 后续、error_reason、`.trend-kn` 4 周样本）都是「等数据」，无可确认外部真人；`WX_MINIAPP_SECRET` 未配；
  R385 第二冷样本未达标项保留。

## 六、后续 cron 观察（上线后自然运行）

- 14:17 UTC 小时级归档：`access-20260906.jsonl` 12,519,568 → 12,904,485 B、`.state` 更新，未对已压缩日期产生新 .jsonl。
- 14:23 UTC 抓取日报（新 `crawler_stats.py` 读 15 .gz + 5 .jsonl）：`generated_at` 14:23:02、`days` 仍 08-24…09-06、
  Yandex 1184（来自 .gz 天数的历史计数未丢）/ Bing 120（+1）/ Google 49（+2，最近一小时新抓取）/ Apple 3。
- 容器 healthy、RestartCount 0、load 1.3；`access-archive` 86 MB、`df /` 88%/5.9 G。
- 15 个 .gz 的 mtime 已按原日期回写（精度到天），`-mtime +90` 口径与压缩前一致。
