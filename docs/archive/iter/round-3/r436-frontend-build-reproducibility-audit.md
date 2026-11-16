# R436 — 前端构建链「本地≠线上」缺口核查（只取证登记，不改码不部署）

日期：2026-09-06 23:15–23:25 CST 前后（服务器时间）。范围：R435 命中 B（后端依赖裸装最新版）之后，同类问题是否存在于前端构建链 / 基础镜像；顺带 WAL 截断观测与 probe=0 / error_reason 到期复查。
无生产写入、无部署、无 UI 改动。

## 1. 前端构建链一手核查

### 1.1 锁文件与安装树
- `frontend-uni/package-lock.json` 已入库（lockfileVersion 3，1253 个包），最后改动 R117（`6f79b57`）；`package.json` 最后改动 R387（`47bb705`）**只改了 `scripts`（build:h5 追加两步 + lint）**，`dependencies`/`devDependencies` 与锁文件根条目逐项相等（脚本比对 0 差异）。
- 本机 `node_modules/.package-lock.json` 1253 个包，与 `package-lock.json` 逐包 `version` 比对：**差异 0、缺失 0、多装 0**；`npm ls --all` 无 missing/invalid/extraneous。
  （`npm install --dry-run` 打印「added 103 packages」是 npm 对 119 个 optional 平台包的干跑口径，不是真实缺包——上面按包逐一比对为 0。）

### 1.2 构建可复现性（关键实验）
生产现役 bundle `index-junWyPAm.js`（H5 dist 119 个文件）。本机在同一 commit 上重跑 `npm run build:h5`（17.2 s，rc=0，inline-critical-css 3 / route-preload 4+62 / precache 97 与上次一致）：

```
find dist/build/h5 -type f -exec md5sum {} + | sort   # 构建前 119 行
find dist/build/h5 -type f -exec md5sum {} + | sort   # 构建后 119 行
diff → 0 行
```
**119 个文件字节级全同**（含带 hash 的 chunk 文件名）。VPS 上 rsync 到的 `~/kaogong-assistant/frontend-uni/dist/build/h5/assets/index-junWyPAm.js` md5 `84c250a1…` 与本机一致。

### 1.3 装法
- 生产走 `deploy/Dockerfile.runtime`：`COPY frontend-uni/dist/build/h5`——用本机预构建产物，镜像内不装 node、不跑 npm，**不存在 R435 那种「build 时拉最新」的路径**。
- 备用 `Dockerfile`（多阶段，生产未用）：`node:20-slim` + `npm ci --no-audit --no-fund` + `COPY frontend-uni` → 也是按锁文件装。

### 1.4 结论
前端链：锁文件入库 + 安装树与锁逐包相等 + 同 commit 重建字节全同 + 生产装法不经过包管理器 → **没有 R435 命中 B 的同类缺口，不改**。

### 1.5 登记（版本口径差，非缺口）
| 项 | 本机 | 生产 / 备用镜像 | 处置 |
|---|---|---|---|
| Node | v22.23.2（npm 10.9.8） | 备用 `Dockerfile` node:20-slim；生产不含 node | 无 `engines`/`.nvmrc`；两版都能出同一 bundle 未被证伪也未被证实（备用镜像本轮没跑）。**不加 engines**——没有任何一次因 Node 版本导致的差异样本。 |
| Python | 3.12.13 | 3.12.14（`python:3.12-slim` = Debian 13 trixie，基础层 2026-09-01 构建） | 补丁版差，无影响样本。 |
| SQLite | 3.37.2（Ubuntu 22.04 系统库） | 3.46.1 | 本地单测跑在**更老**的 SQLite 上；代码只用 `json_extract`（1 处，3.37 含 JSON1）无 `->>`/RETURNING/STRICT/unixepoch。老库能过 → 新库超集能过；反向风险（本地能过线上不能）不存在。 |
| 基础镜像 tag | — | `python:3.12-slim` 浮动 tag，compose `up -d --build` 不带 `--pull`；buildkit 默认每次 build 重解析 tag 摘要（推断，来源 buildkit 行为；生产基础层日期 09-01 与官方镜像近期发布相符） | 与 pip 同类的「随时间漂移」，但漂移面只有 Python 补丁版 + Debian 安全更新，**无一次事故样本，不钉 digest**（钉了就要有人负责跟安全更新，收益小于成本）。日后若出现基础层变更导致的差异，再按 R435 方式钉。 |

## 2. WAL 截断观测（R435 命中 A 跟踪）
- 23:12 容器重建后 `/data/data.db-wal` 16512 B，至 23:22 未变；`PRAGMA journal_size_limit` 生产连接读回 67108864（64 MiB）。
- 「大写入 → checkpoint → WAL 重置 → 文件截回」的自然周期**尚未发生**（需一次 >64 MiB 的 WAL 增长），继续挂观测；机理由 R435 单测覆盖。

## 3. probe=0 / error_reason 到期复查（只读 `file:/data/data.db?mode=ro`）
- `answer_log.probe=0`：仍只有 `umst3tuisd7lgzaka` 22 行（R425 那台 vivo 小程序，最后一行 09-06），无新 uid、无新行。
- `mistakes.error_reason` 非空 6 行，与任何 probe=0 uid 关联 **0 行**（口径修正：`error_reason` 在 `mistakes` 表，不在 `answer_log`——先前一次写错列名，查询报 `no such column`，本文件按正确表重查）。≥09-11 再看。

## 4. 生产状态（顺带）
`/api/health` `{"ok":true,"rev":"3c451c9"}`；`deploy-kaogong-1` Up 10 min (healthy)；无部署。

## 5. 事实 / 推断 / 未解
- **事实**：锁文件与安装树逐包相等；同 commit 重建 119 文件 md5 全同；生产 runtime 镜像不经包管理器装前端；本机/生产 Node、Python、SQLite 版本如上表；WAL 16 KB、jsl 64 MiB；probe=0 与 error_reason 无变化。
- **推断**：buildkit 每次重解析 `python:3.12-slim` 摘要（未抓 build 日志验证 `resolve image config` 行）；备用 `Dockerfile` 在 node:20 下能出同一 bundle（未跑）。
- **未解 / 不做**：不加 `engines`、不钉基础镜像 digest、不动前端锁文件——三项都没有一手事故样本。
