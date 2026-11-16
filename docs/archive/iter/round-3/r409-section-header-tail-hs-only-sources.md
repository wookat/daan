# R409 试卷分节标题串入末选项/解析尾部（可逆裁剪 47 处）+ 223 道非隔离 hs-only 题来源分布 + hs 命名三处统一 + 磁盘治理（后端 + 脚本 · 写库 · 部署）

日期 2026-09-06 · 分支 devin/*-r400-formula-dropped-snapshot · rev c79a9a8

## 起点
R408 遗留三问：① 练习页「花生十三方法解析」/ SEO「花生十三讲解」/ 错题卡三处 hs 命名要不要统一；② 223 道**非隔离**、活跃、只有 hs 没有 base 解析的题是不是「某批次 base 从未导入」；③ 下次部署前先核磁盘并清 kaogong 侧中间备份。

## 一、223 道非隔离 hs-only 题来源分布（生产只读，`~/r409_pre.sh`/`r409_rows.sh`/`r409_mm.sh` → 同名 .txt）
- 全部 `is_real=1`；模块 panduan 104 / yanyu 67 / shuliang 50 / changshi 2；id 跨 240300–1047051 多个导入批次（id 桶 24 万 6 · 29 万 2 · 33 万 1 · 34 万 6 · 89 万 39 · **104 万 169**）。
- Top source：2024 浙江 41 / 2024 山东 35 / 2024 广东 32 / 2024 江苏 30 / 2024 深圳 25。**同一 source 内其他题有 base 解析**（如 id≥1040000 段：山东 47 题 16 hs-only、浙江 46 题 12、深圳 37 题 17），所以「整批 base 从未导入」不成立；更像同批次 PDF 切题时部分题的解析段未切到（该段 disabled=1 263 行、disabled=0 232 行，其中活跃有 base 63）。原始导入件不可得，不下「曾有官方解析」的结论——维持 R408「不标官方解析缺失」。
- hs 是否讲本题：抽读 1047022/1046914/298973/1046825/896328/896357 六题，hs 均针对本题题干与选项推理、以「确认答案为 X」收尾，不是模板句。全 223 行 hs 显式答案标记与 `answer` 比对：**220 一致 / 3 不一致 / 0 无标记**——1046855（广东，answer D，hs 选 C）、1046866（黑龙江，answer A，hs 选 D）、1046874（江苏，answer C，hs 选 D）；三题 answer_log/mistakes 均 0 行。哪边对本轮无法凭 DB 判定（无原卷），**不改写、不隔离**，列为待人工校源的 3 行。

## 二、顺带取证到的真问题：下一节标题串到上一题末选项/解析尾部
看 223 行样本时发现 896328 选项 D=`⑤②④③①⑥ 三. 数量关系：在这部分试题中，每道题呈现一段表述数字关系的文字，要求你迅速、准确地计算出答案。`——PDF 切题把下一节标题并进了前一题的末字段。R400 的 `strip_page_footers` 只认「第 N 页共 M 页」/「-N- 20XX 年…真题」两种页脚，且 `select_footers` 用 `LIKE '%页共%页%'` / `'%真题%'` 预筛，漏掉了「第 7 页 共 36 页」（带空格）与所有分节标题。
- 新增 `FOOTER_SECTION_RE`：`(~ N ~)? (第 X 部分 | X. / X、) (数量关系|言语理解与表达|言语理解|判断推理|资料分析|常识判断) … 到字段/JSON 值末尾`，只裁**尾部**（`(?=$|")`），正文里提到「本题考查数量关系中的行程问题」「资料分析第二部分表格显示」「一、二、三项均正确」等不动（单测覆盖）。`select_footers` 改为扫全部 `is_real=1`（不再靳预筛），并加守卫 `_blanks_option`：某选项原本非空、裁后为空（该选项整段就是串入标题，说明选项已经错位）→ 打印 SKIP 不进改写清单，需校源人工处理。
- 生产 dry-run（容器内用本轮 quality.py + 脚本，只读）：候选 60 → 守卫 SKIP 13（全部 disabled=1：246002/246022/246077/246111/246145/246273/246365/246421/246578/246657/1046586/1046838/1046954，后三题选项 B 里还并着「B.D.」两个选项、无 hs，属选项整体错位，不自动改）→ **47 处可写**（27 options / 20 explanation；活跃 7：235971 / 236036 解析尾、246097 / 896328 / 1046534 / 1046578 选项 D 尾、1272498 解析尾；其余 40 处为 disabled 行含 R400 漏掉的 334746–334789 带空格页脚 10 处）。47 处 before/after 逐条核：options JSON 键序不变、每个值都是原值前缀、无空值；explanation 均为尾部裁剪或页脚中段剔除。
- 1046534 有一条真人/走查不可区分的错题 m987（uid 匿名，快照解析 99 字讨论焚风效应，与题一致），快照不含 options，不受影响；其余 6 活跃题 answer_log/mistakes 0。

## 三、生产执行（VPS `nohup`，日志 `~/kaogong-reports/r409_apply.log`，本机副本 `~/r409_apply.log`）
第一次跑在 pre-stat 就因 `mistakes` 无 `options` 列 + `set -e` 退出（**未走到备份/写库**），修脚本后重跑：
1. 磁盘 91%（4.4 G）；pre-stat questions 156792/109371、七 reason 不变、`text_footer_fix` 27+3=30（R400）。
2. 活进程 SSR 预热 6 页（896328/1046534/1046578/246097/235971/236036）全部 **LEAK**（页面含「在这部分试题中」「请开始答题」等串入文本）。
3. dry-run 47 → `sqlite3.backup` → `data.db.r409-before` 449 MB quick_check ok、text_footer_fix 30。
4. `--strip-footers --apply`：**applied 47/47**、SKIP 13 同 dry-run；post-stat questions 不变、七 reason 不变、`text_footer_fix` 47 explanation + 30 options = 77（created_at 3 批）；7 活跃题 D/解析尾已干净（1046534 D=`焚风效应`、896328 D=`⑤②④③①⑥`、1272498 尾=`故选C。`）。
5. **不重启立即复访 6 页全部 clean**（版本键活进程失效第四次实证）；活库 quick_check ok。
6. 副本 restore drill：`--restore-footers` 77/77（含 R400 的 30，reason 不分档是 text_footer_fix 既有设计）、1046534 D 回到串入态；re-dry-run **0**。
7. `r409-before` gzip、删 superseded `r407-before.gz` 与 `r400-before.gz`（quarantine 表与 text_footer_fix 本身留原文可还原，中间备份不影响可逆性）；卷内只留 `bak-w3.gz` + `r409-before.gz`。

## 四、hs 命名三处
- 练习页 `practice.vue` 标「花生十三方法解析」；SEO 题目页 R408 标「花生十三讲解」；SEO 列表页 meta description 与 `catchall.py` 用「花生十三方法讲解/解析」。**统一为「花生十三方法解析」**（练习页与站内 meta 既有措辞，产品全站叫「花生十三方法体系」）：`seo/pages.py` 两处 + 单测同步。
- 错题卡：`mistakes.explanation` 是快照字段，R396 读取层回落 hs 时 API 不暴露来源（不外泄 `q_hs`），前端 `book.vue` 拿到的只是一个 `explanation` 字串——**无法标注、也不该猜**；收藏夹/模考报告/练习历史用 `hs_explanation || explanation` 同样无标签。本轮不动：要标注需先在 API 契约里加来源字段，属 R396 契约变更，无真人触达证据前不做。

## 五、磁盘（部署前核）
R408 后 95%（2.8 G）→ 删 r401/r402/r405/r406 中间 gz、r407-before 压缩 → 93%（3.7 G）→ 本轮再删 r400/r407 gz → 91%（4.5 G）。宿主 docker 侧 images 7.2 G / build cache 4.0 G / volumes 13.4 G，主体仍是 recruit-*/softcopyright-*，未动。

## 本地验证
pytest 429（+1 用例扩展）/ ruff（app tests + 本脚本）/ pyright 0。scripts/ 其他文件 ruff 22 处为 main 既有，不在本轮范围。

## 未做 / 限制
- 3 行 hs 与 answer 冲突（1046855/1046866/1046874）与 13 行选项错位 disabled 题都需要原卷才能定，本轮只登记；223 行 hs 只抽读 6 题，其余按显式答案标记比对。
- 236036 解析中段仍留「~ 64 ~」页码标记（另一种页脚形态，本轮未扫全库、不加规则）。
- 47 处改写里 40 处是 disabled 行，改的是文本卫生、不改变上架状态；上架前仍须校源。
