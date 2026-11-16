# R433：kaogong 名下第二可动存储项——卷内手工全库快照离站归档 + `VOLUME-SNAPSHOT` 巡检

日期：2026-09-06（服务器 CST）。范围：只动 kaogong 自有数据，不动 recruit / SoftCopyright / containerd / Docker build cache / 其他产品卷。无 UI、无 DB 写入，不派 testing agent。

## 1. 起点与只读盘点（一手）

R432 留下的问题：`~/kaogong-backups` 468 MB 与 `deploy_kaogong-data` 卷 922 MB 里有没有 kaogong 名下第二个可动项。

宿主（`du -sh`）：

```
/home/ubuntu/kaogong-backups     468M
/home/ubuntu/kaogong-reports      86M   （R432 后）
/home/ubuntu/kaogong-assistant   373M
```

`kaogong-backups` 内容 = 3 份每日 `.backup` gzip，按 `kaogong-ops.sh` 策略保留、每份都已上传 R2 并通过 RESTORE-VERIFY / R2-VERIFY，**不是浪费**：

```
155304575 2026-09-04 data-2026-09-04.db.gz
167314038 2026-09-05 data-2026-09-05.db.gz
167430818 2026-09-06 data-2026-09-06.db.gz
```

容器卷 `/data`（`docker exec deploy-kaogong-1 du -sh /data/*`）：

```
429M  /data/data.db            活跃库
109M  /data/data.db-wal        WAL（不动）
178256882 B  /data/data.db.bak-w3.gz    手工全库快照（W3 清洗前）
179289539 B  /data/r418-before.db.gz    手工全库快照（R418 回填前）
 16M  /data/qimg               题图
 24M  /data/iter-r3b           历史迭代产物
其余 <1.2 MB：R81/R82/shizheng 备份 json、r348/r418/r419/r423/r424 可逆处置记录、0 字节 app.db/kaogong.db
```

→ **第二可动项 = 两份手工全库快照 357 MB**。docs/handoff-context.md 早在 R191 就写过「未来手工快照请直接放 R2 archive 前缀或用 pre-*.db.gz 命名，勿在 /data 卷内长期堆放」，这两份是之后又堆进去的、没人巡检。

共享宿主（`docker system df` / `du`）只记录不动：Images 7.2 G、Local Volumes 11.76 G（`recruit_app_pgdata` 9.05 G、`softcopyright_app_storage` 1.8 G、`deploy_kaogong-data` 608 M）、Build Cache 2.75 G、`/var/lib/containerd` 9.5 G、`/opt/SoftCopyrightAgent` 6.0 G、`recruit-backups` 589 M。

## 2. 处置：离站归档而不是删除（可逆）

脚本 `/home/ubuntu/r433_offload.sh`（临时、未入库，逻辑同 R191）：每份文件 → 容器内 `md5sum` + `stat -c %s` → `gzip -t` → `docker exec cat | rclone rcat --size` 到 `r2:zalize-backups/kaogong-sqlite/archive/<name>` → 远端 `rclone size --json` 字节数 + `rclone cat | md5sum` **真回读** → 两者都与本地一致才 `rm` 本地副本。

结果（耗时 2 m 27 s，含两次 178 MB 回读）：

```
data.db.bak-w3.gz   local 178256882 / 9cebb800a030d70ad4182be61034ec19
                    remote 178256882 / md5(download) 9cebb800a030d70ad4182be61034ec19  → local removed
r418-before.db.gz   local 179289539 / 010485278a84ec23d54636e7cf154211
                    remote 179289539 / md5(download) 010485278a84ec23d54636e7cf154211  → local removed
```

卷 `/data` 922 MB → **581 MB**；`df /` 4.9 → 5.5 G 可用（90→89%，共享宿主随后又回到 91%/4.6 G——别家在写）。容器全程 `healthy restarts=0`。活跃 `data.db`/WAL/SHM/每日备份/qimg/处置记录 json 全部未动。

## 3. 巡检：`kaogong-ops.sh` 新增 `VOLUME-SNAPSHOT`（只报不删）

```bash
SNAP=$(docker exec deploy-kaogong-1 sh -c "find /data -maxdepth 1 -type f \( -name '*.db*' -o -name '*.gz' \) ! -name 'data.db*' -size +1M -exec ls -l {} + 2>/dev/null" \
  | awk '{s+=$5; n++; f=f" "$NF} END{if(n) printf "%d file(s) %d MB:%s", n, s/1048576, f}')
[ -n "$SNAP" ] && echo "$TS VOLUME-SNAPSHOT $SNAP (move to r2:$BUCKET_PREFIX/archive/)" >> "$LOG"
```

- 只看 `/data` 顶层、只匹配 `*.db*`/`*.gz`、排除 `data.db*`（活跃库 + wal/shm）、只报 >1 MB（0 字节 `app.db`/`kaogong.db` 空壳与 KB 级 json 不报）。
- `backend/app/ops_status.py::ALERT_PAT` 加 `VOLUME-SNAPSHOT`，管理台运维状态按告警外显（否则又是「日志里有、没人看」）；单测 `test_failed_lines_marked_and_alerted` 加 1 行断言（alerts 4→5）。
- 同步前 `diff` 生产副本发现一处**未入库改动**：本地保留份数 7→3（注释「主机 50G 盘紧张」），先回收进仓库再 scp，避免把生产改动覆盖回 7 份。

## 4. 验证

- 本地：`bash -n deploy/kaogong-ops.sh` 过；`pytest tests/test_ops_status.py` 4 passed；ruff 0；pyright 0（`npx pyright app/ops_status.py`）。
- 远端演练（改前）：`head -c 2 MiB /dev/zero > /data/r433-selftest.db.gz` → 巡检输出 `1 file(s) 2 MB: /data/r433-selftest.db.gz`；删掉后输出空。
- 生产同步：`cp -p` 备份 `kaogong-ops.sh.bak-r433` → scp → 两端 md5 `863db0bd0c23b05f69d50d99acbc8273` 一致。
- 生产整脚本实跑一次（22:36:31 CST，rc=0，157 s）：`r2 upload ok data-2026-09-06.db.gz (167520935)` / `RESTORE-VERIFY ok questions=156792` / `R2-VERIFY ok md5 match` / `DISK HIGH 91%` / `MEM …` / `OK api=200 backup done`；**无 `VOLUME-SNAPSHOT` 行**（卷内已无快照，符合预期）；本地备份仍 3 份、`/data` 顶层无 daily.db 残留、`healthy restarts=0`、`/api/health` 200。`sqlite3` CLI 不在容器内 → 走 python `.backup` 回落（既有行为）。
- `ops_status` 告警外显属后端改动，随下次容器重建上线（本轮 bundle 不变、不为一行正则单独重建）；到那之前日志行已在、只是管理台不标红。

## 5. 如实说明 / 未解

- 这不是宿主容量问题的解：kaogong 名下能动的已动完（R432 归档 −330 MB、R433 快照 −340 MB），宿主仍 91%/4.6 G，大头是 recruit pgdata / containerd / SoftCopyright，扩盘或迁出仍待老板决定。
- 两份快照现在只在 R2 `archive/`（单副本、无本地）；R2 侧未设生命周期规则，需要时 `rclone copy` 回来。
- `iter-r3b` 24 MB / `qimg` 16 MB / 各轮 json 处置记录留在卷内：都是 restore 输入或题图，不算浪费。
- 生产副本 7→3 的改动来源不可考（无 git、无注释署名），按现状回收；若哪一轮需要更多本地历史，改 `tail -n +4` 即可。
- `probe=0`/`error_reason` 复查 R432 已做（无新行），本轮未重复；`.sheet-x`/自然旧壳 404 (c) 待下次发版；`.trend-kn` 需 4 周样本。下次 SOP-10 审计 ~R440。
