# R401：真题解析「数值位被抠空」126 行逐行人工核定 → 可逆隔离（reason `r401:formula-dropped-value`）+ 隔离脚本并发写入防护

日期 2026-09-05（UTC）。分支 `devin/*-r400-formula-dropped-snapshot`（续 R400，base=main）。生产 rev 上线前 `de23ca7`。

## 1. 起点与取证方式

R400 把「根据公式：。」「所求项为。」这类**标点级骨架**隔离了 210 行。R400 生产复验时 testing agent 在 `/tiku/q/288140` 看到解析正文「则订阅报纸的家庭为，因此只订阅日报的家庭为报的比例最多为，当这」——不是标点骨架，而是句中**数值/表达式位被抠空**（「…为，」后面本应是数字或式子），R400 三信号（colon / enum / quant）不命中。全部证据来自生产库只读 SQL（`file:/data/data.db?mode=ro`）+ 逐行人工阅读命中上下文；不使用二手描述。

### 1.1 288140 不是孤例：全库范围
- 先写只读探针在生产库跑最宽规则「`为[，。；]`」（`is_real=1`、数量/资料两模块、解析非空）：276 行、活跃 177。抽读发现大量正常词尾误报——「因为，」「认为，」「作为，」「成为，」「行为，」「分为，」「定为，」「选为，」「记为，」「较为，」「更为，」「尤为，」「甚为，」「人为，」以及正常承接「可得，」。
- 设计论证（先论证后写码）：把规则收窄为两类互斥形态，全部要求「前一个词在语义上后面必须跟一个值」：
  - `…为[，。；]` 且「为」前一字不在词尾排除表 `因认以作称视成分改定选记行较更尤甚人`；
  - 推导承接词直接接句读：`解得|则有|列式得|列式为|化简得|化简为|整理得|联立` + `[，。；]`（「解得 x＝15」「则有 x＋4y＝3x＋y」不命中）。
  - 只在 `shuliang` / `ziliao` 两模块生效：文字题的「为，」多是表述习惯（「其主要成分为，二氧化硅」），常识/言语不认此信号。
- 收窄后全库 dry-run：**127 行 = 126 行 `value` + 334672（仍以 `enum` 命中，R400 已判误报，继续 `--keep`）；活跃 109，活跃且无 hs 0**。
- **逐行人工阅读 126 行 value 命中上下文**（`~/r401_ctx.txt`，每行最多 3 处命中前后 14 字）：126/126 确认为数值/表达式位被抠空，形态举例：
  - 「音乐系和美术系总人数之比为。因此，选择」（236871）
  - 「设抽取总人数为 x，则有，解得 x＝15」（237012，方程整条被抠、解保留）
  - 「共花费 16560 元，则，解得。则总旧窗户数」（283550）
  - 「2019年经济活力为＜2018年为；」（321450，比较两边数值都被抠）
  - 「国港口生产用码头泊位数量比重为，不足二成」（264585，资料分析结论保留、数值丢失）
  - 「由“有，回来时间为，所以路上时，」（288139）/ 288140 见上。
  - 同一题在不同 source 重复导入（236644/261053、237107/262042、262193/330187、236243/272714、262252/319568）都同样缺值——缺失发生在**导入源侧**（PDF/HTML 公式对象被丢），不是某次清洗写坏。
- 与现状对比：命中行活跃 109 行**全部有 `hs_explanation`**，隔离后用户看到花生十三讲解而非缺值句；读取层（R396）+ 写入层（R400）回落已覆盖错题本/复习。
- 不做的替代方案（与 R396/R400 同口径）：用 hs 改写 base、用 LLM 补数值、按 regex 命中直接写库不经人工。

### 1.2 并发写入者是事实，脚本要能容
取证期间生产 `/data/` 出现 `data.db.bak-w3c`（21:31Z）、宿主 `/tmp/w3c.py`（W3 内容清洗脚本：统计前缀/广告句/汉字间空格归一，`UPDATE questions SET explanation=? … AND explanation=?`），且有另一会话在容器内跑只读核对——**同一时段有第二个写入者在改 `explanation`**。R400 版 `apply()` 是「先按扫描结果 INSERT 快照，再无条件 `UPDATE … SET explanation=NULL WHERE id=?`」：若扫描到写入之间某行被 w3c 改过，quarantine 里存的是过期文本，`--restore` 会把 w3c 的清洗结果覆盖回去。本轮改为 `UPDATE … WHERE id=? AND explanation=?`，`rowcount!=1` 的行不隔离、不留快照、单独打印 `skipped (explanation changed concurrently since scan)`。

## 2. 改动
1. `backend/app/quality.py`：`_FD_VALUE_RE`（词尾排除 + 承接词）；`formula_dropped()` 新增第四信号 `value`，仅数量/资料模块，判定顺序 colon → enum → quant → value。
2. `scripts/r396_explanation_quarantine.py`：`--apply` 尊重 `--reason`（R400 版固定写 `r400:*`）；`apply()` 条件更新 + 并发改动报出（§1.2）。
3. 单测 `test_r400_formula_dropped.py` +3：value 信号正/反例 11 条（含 288140/288139 生产形态、词尾排除、`可得，`、非数量模块不认）；自定义 reason apply 后按 reason 独立 `--restore`；并发写入者改过的行跳过不隔离。

## 3. 生产执行实录

（见 §3.1–3.3，数字均来自容器内实跑输出；`~/kaogong-reports/r401_apply.log`）

### 3.1 第一次尝试（未写库）
- `pre` 只读统计：questions 156792/109371、quarantine r396 307 / r400 210、r401 0、288140 base 非空 hs 104、334672 base 保留、历史空快照 15。
- `python sqlite3.backup` → `/data/data.db.r401-before`（449,310,720 B，21:28Z 写完），随后 `integrity_check` 在宿主 iowait 78% / IO pressure 98% / load 20 下进入 D 态 20+ 分钟，SSH 会话内的远程 bash 静默消失，`== apply` 从未打印。**只读复核确认库未变**：WAL mtime 停在 21:12Z、r401 reason 0 行、288140 仍非空——没有半截写入。
- 教训：生产长 IO 任务不能挂在 SSH 会话上，改为 `nohup … > ~/kaogong-reports/r401_apply.log` 后台跑、轮询日志。

### 3.2 第二次（nohup）
- 13:56Z `verify backup`：`/data/data.db.r401-before` 449,310,720 B，`pragma quick_check` **ok**（耗时 15 min，同宿主 IO pressure 90%+），`questions 156792/109371`、quarantine r396 307 / r400 210、288140 base 167 字——备份是写库前状态。
- 14:11Z `--garbled --keep 334672 --reason r401:formula-dropped-value --apply`：`targets: 126 (active 109, active without hs 0); skipped: 1`（334672 仍以 `enum` 命中、keep）→ **`applied: quarantined 126, mistakes snapshots rewritten 0`**，无 `skipped (explanation changed concurrently)` 行——扫描到写入之间没有并发改动。耗时 26 s。

### 3.3 复核
- 14:11Z `post`（只读）：`questions 156792/109371` 不变；quarantine **r396 307 / r400 210 / r401 126**；r401 活跃 109、活跃无 hs 0；隔离行 explanation 仍非空 **0**；288140 `explanation IS NULL`=1、hs 104 字；334672 base 保留；`mistakes` 引用 r401 id **0**（无真人错题受影响）；历史空快照仍 15（不回填）。
- 14:14Z `restore drill`（生产库只读 `backup` 到 `/tmp/r401_drill.db` 上跑）：`restored 126/126 (reason=r401:formula-dropped-value)`，副本里 quarantine 只剩 r396 307 / r400 210，288140 base 回到 167 字——**按 reason 可逆、不碰 R396/R400**。副本已删。
- 14:14Z `re-dry-run`：`targets: 0 … skipped: 1`——幂等。
- 全程容器未重启；`/api/health` 200 `rev de23ca7`。运行中的进程有 `_render_question` lru_cache，隔离对 SSR 题目页生效以本轮部署重建容器为准（§4 后）。

## 4. 本地验证
pytest 416（+3）/ ruff / pyright 0；vitest 559 / eslint / build:h5 全绿（前端本轮无改动，构建产物 route-preload 4 入口 / 61 依赖、precache 95 与 R400 一致）。

## 5. 未验证 / 需注意
- `value` 规则与 R400 三信号一样只是**候选 finder**：本轮 126 行是人工逐行读过的；再跑 `--garbled --apply` 前必须 dry-run 逐行看。
- 词尾排除表是从 276 行样本归纳的，其他模块/新导入可能有新的「X为，」正常词尾；规则 fail-closed（不命中就不动），漏报可接受、误报靠人工。
- 缺值的**源头**（导入时公式对象/上下标丢失）与 R396/R400 同一困境：`import_batch` 全 NULL、原件不可得；已隔离行若要恢复官方解析需重新取源。
- 与 w3c 清洗并发：本轮脚本已防护，但 w3c 那侧对已被本轮置 NULL 的行是 `AND explanation=?` 条件更新，天然跳过；两侧 backup 文件各自独立（`.bak-w3c*` / `.r401-before`）。
- 宿主 IO 争用（第 16 次上报）：449 MB 备份写 4 min、全量校验 >20 min，同宿主 recruit-*/newapi/softcopyright 容器持续读写；`/data/` 下历史备份已 11 个 ×~430 MB，建议下轮清理 `bak-r348/bak-w2/r396-before`（保留最近两轮）。
