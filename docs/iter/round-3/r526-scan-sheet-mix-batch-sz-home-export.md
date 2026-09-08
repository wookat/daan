# R526：`scan_sheet` 对含内联题混合卷的实拍回读（本地真生成卷 + 合成涂卡图）+ 错题本时政 NULL-qid 行批量「标已掌握」/「删除」+ 首页「导出为试卷 PDF」`sheetless` 口径 —— 三项一手核均成立，不改码、0 部署

日期：2026-09-08（UTC 05:30–06:00）。上游：R525（#662，已合入 main `3145ed6a`；生产 `5d999920`）。

## 0. 结论表

| 项 | 一手证据 | 结论 |
|---|---|---|
| A. `scan_sheet` 对混合卷（3 普通 + 2 时政内联）实拍回读 | 本地 `:8525` 真 `POST /api/export/pdf` 生成 3 页 PDF → `pdftoppm` 渲染答题卡页 → 用 `omr.bubble_rect()` 合成涂卡 → `omr.recognize()` + `POST /api/scan_sheet` 200 | 槽 0..2 → `paper_exports.question_ids=[111,112,110]` 逐槽对上；故意涂的第 4 槽（无对应 id）被忽略；`answer_log` +3、错题 +1（112）；时政题未进 `questions` 域；`/api/paper_answers` 同契约（题号 4/5 被忽略） → **不改** |
| A'. R525-1「混合卷机读槽跳号」 | `exam_api.py:20-33` 先 `questions_by_ids(ids)` 再 `append(items)`，`group_by_material()` 只把 `ziliao` 同材料题向前聚组 | 当前 API 下内联题恒在普通题之后 → 机读槽标号 = 1..N 连续，**跳号不可达**（唯一理论路径：手录题 `module=ziliao` 且材料指纹撞上普通资料题时被前聚）→ R525-1 降为「不可达，关闭」，SKILL 口径同步修正 |
| B. 批量「标已掌握」/「恢复复习」/「删除」对 NULL-qid 时政行 | `book.vue batchMaster()/batchDel()` 逐行 `PATCH /api/mistakes/{mid}` / `DELETE /api/mistakes/{mid}?uid=`（按 `mistakes.id`，与 `question_id` 无关）；本地对 2 条 NULL-qid 行实跑 | mastered 1→`mastered_at` 置值→0→`mastered_at NULL`；别 uid PATCH/DELETE 404；删除只删 `mistakes` 行，`shizheng_questions` 141 行不动 → **不改**（「mids 路径」实际不存在：批量掌握/删除不走 `mids=`，只有「重练所选」/「导出所选」走） |
| C. 首页「导出为试卷 PDF」是否需 `sheetless` | `home.vue exportPaper()`（以及 `practice.vue exportPaper()`、`pkgA/exam/list.vue`）题源分别是 `GET /api/questions?limit=…`（`questions` 表）/ `paper.question_ids`，`ids=(d.items).map(q=>q.id).filter(Boolean)`，**不传 `items`** | 三个入口不可能带内联题 → `sheetless` 恒 0，`export-confirm` 不传 prop 即空提示 → **不需要透出，不改** |
| D. R525 发版后 (c) / 到期项 / 簇 | `~/r526/r526_post.out`（SSH 只读） | 容器窗 431 请求 5xx/assets 404/monitor/mpUA/非探针 POST/401·403/Traceback 全 0；WAL `4,173,592` 同字节；probe=0 各表同 R525；`umst3` 四表 32/45/22/1 新增 0；`paper_exports` 05:22Z 后 0 新行、任意 uid `answer_log/mistakes/review_log` 04:52Z 起 0 新行；09-08 503 仍是 75 条（00:28/00:29/01:03，R525-2 已登记）无新增；簇 09-08 至 05:44Z 5387 行 / 5322 IP 仍在跑，日报 humans 4925 基本全簇 |
| E. 生产 `scan_sheet`/`paper_answers`/`paper/{code}` 历史触达 | Caddy 全量 grep | 7 条全为探针网段 `140.232.64.x`（09-02/03/05，422/403/404）→ **从未有外部真人扫过答题卡** |

登记：**R526-1（P3）** 手动录入答案层对 `n=0` 全内联卷显示「共 0 题 · 已选 0」+ 空列表 + 禁用「交卷判分（0 题）」，无解释文案（用户已在确认层被告知「无机读答题卡」，且生产 4 张空卷全是 08-03 探针造的，无真人触达）→ 不为一行文案单独发版，并入下次含发版轮次（候选：`n===0` 时提示「本卷均为时政/手录题，请对照参考答案核对，无需录入」）。

## 1. A：混合卷实拍回读（本地一手）

脚本 `~/r526/local_scan_mix.py`（输出 `~/r526/local_scan_mix.out`），uid `r522local`，库 `~/r525/app.db`，服务 `:8525`（R525 同一实例，`5d999920` 代码）。

请求体：`question_ids:[110,111,112]` + `items:[shizheng_questions id=1,2 两题]`，`include_answers/answer_sheet/include_questions` 全开。

- 回包 `code=340F4B53`，PDF 97,230 B、3 页；`paper_exports ('340F4B53','[111, 112, 110]','R526混合卷')` —— 顺序是 `questions_by_ids` 的 `(module, submodule)` 排序结果而非请求序，答题卡/正文/`question_ids` 三者同序，对回不受影响。
- 首版脚本渲染「最后一页」得到的是解析页 → `omr.recognize` 抛「未找到答题卡四角定位块」；改为逐页 `pdftotext` 找「机读卷码区」→ 答题卡在 **第 1 页**（`_append_pdf(_omr_sheet_pdf(...), data)` 把答题卡前置）。
- 答题卡页文本：`1 CS-LSRW-000111 / 2 CS-LSRW-000112 / 3 CS-DLGQ-000110`（3 槽，连续编号）；参考答案行 `1. D 2. C 3. B 4. D 5. D`（5 题，时政为 4/5）。
- 合成涂卡（200 DPI，`omr.bubble_rect(slot,opt)` 同几何）：`{0:'D',1:'A'(故意错，真值 C),2:'B',3:'A'(无对应 id)}`。
- `omr.recognize()` → `code 340F4B53 page 1 picks {0:D,1:A,2:B,3:A}`（几何与识别一致）。
- `POST /api/scan_sheet` 200：`total 3 / answered 3 / correct 2 / saved true`；rows `no1→qid111 D ✓`、`no2→qid112 A✗(C)`、`no3→qid110 B ✓`；槽 3 因 `page_ids` 只有 3 个被 `enumerate(page_ids)` 自然截掉。
- 库：`answer_log` +3 `[(110,1,'B'),(112,0,'A'),(111,1,'D')]`；`mistakes` 从 `[(2,NULL),(3,110)]` → 增 `(4,112)`；NULL-qid 时政行 `id 2` 未被触碰；`questions` 0 新行。
- 对照 `POST /api/paper_answers` picks `{1:D,2:C,3:B,4:D,5:D}` → `total 3 / correct 3`，题号 4/5（时政）被 `_judge_paper()` 忽略，与扫描同一契约。

## 2. A'：R525-1 跳号复核

`exam_api.py:18-36`：`questions = questions_by_ids(ids)`（按 module/submodule 排序）→ `for it in items: questions.append(...)` → `group_by_material()`。`group_by_material` 只对 `module=='ziliao'` 且材料指纹相同的题向首现处聚合，内联题 `module` 为 `时政`/手录模块、无 `material_hash`，除「手录资料分析题恰与卷内某普通资料题材料指纹相同」外不会被前移。故 `sheet_questions()` 的 `(卷内题号, q)` 对当前 API 的任何请求都是前缀 `1..N`，本轮真卷即 `1/2/3`。R525 文档/SKILL 中「混合卷会跳号」表述修正为「当前 API 不可达；保留卷内题号的设计是为将来内联题可插中间时仍对得回」。

## 3. B：批量掌握/删除对 NULL-qid 行（本地一手）

脚本 `~/r526/local_batch_sz.py`（输出 `~/r526/local_batch_sz.out`）。

- 请求形态（源码 `book.vue:1749-1788`）：`Promise.all(Object.keys(selIds).map(id => PATCH /api/mistakes/{id} {uid, mastered}))` / `DELETE /api/mistakes/{id}?uid=`；后端 `study_api.py:400-413` → `db.update_mistake(mid, {mastered}, uid)` / `db.delete_mistake(mid, uid)`，SQL `WHERE id=? AND uid=?`，不涉及 `question_id`。
- 实跑：造第 2 条 NULL-qid 时政错题（`POST /api/mistakes question_id:null` 200）→ NULL-qid 行 `[(2,NULL,时政,0),(6,NULL,时政,0)]` → PATCH mastered=1 两条 200 → `[(2,NULL,1,mastered_at✓),(6,NULL,1,✓)]` → PATCH mastered=0 → `mastered_at NULL` → 别 uid PATCH/DELETE 均 404「错题不存在」→ DELETE 6 200 → 剩 `[(2,NULL),(3,110),(4,112)]`；`shizheng_questions` 141 行、id 2 仍在。
- 顺带读数：`GET /api/mistakes?uid=&module=时政&mastered=1` 服务端不吃 `module`/`mastered` 参数（返回全部 4 行），筛选/分 tab 是前端 `shownPage` 本地完成 —— 既有口径，非问题。

## 4. C：首页/练习页/卷库导出入口

- `home.vue:1153-1181 exportPaper(opts)`：`GET /api/questions?limit=…[&real=1…]` → `ids = items.map(q=>q.id).filter(Boolean)` → `exportPdf({title, question_ids: ids, ...opts})`；`<export-confirm :count="groupSize||20">` 不传 `sheetless`。
- `practice.vue:2404-2426` 同源同形态；`pkgA/exam/list.vue:390` 用 `d.paper.question_ids`。
- `/api/questions` 只查 `questions` 表（时政日练走 `/api/shizheng/*`，不进此入口）→ 三处 `items` 恒无 → `sheetless` 恒 0，`export-confirm.vue sheetlessNote` 第 3 分支返回空。**不需要改**。

## 5. D/E：生产只读读数

`~/r526/r526_post.sh` → `~/r526/r526_post.out`（SSH 执行，`mode=ro`，0 写入）。

- 容器 `healthy restarts=0 started=05:22:04Z`；窗内 431 请求，非探针非 bot 383 全为簇（`/tiku/*`、`Accept-Language en-US`、无 Referer）、其它 0；5xx 0、assets 404 0、monitor 0、mpUA 0、非探针 POST 0、401/403 0、Traceback 0。
- WAL `4173592` 同字节；disk 5.5G；MemAvailable 383 MB；load 1.96/1.08/1.06；无并发 build。
- DB：probe=0 `answer_log` 53/2、growth 26/4、`explain_cache qid` 0/82、`error_reason ≥09-11` 0、`*_ask_click` 0、nudge []、`reinforce_log` 2/2、`push_subs` 0；`umst3` 32/45/22/1、mistake 1953/2784/2914/2915 不变；`paper_exports` 38 行、05:22Z 后 0；`answer_log/mistakes/review_log` 04:52Z 后 0；NULL-qid 错题 28 行 / mastered 0。
- 簇：09-07 1445 行/1443 IP；09-08 至 05:44Z 5387 行/5322 IP（15.6 行/分、UA 14、每 IP ≤2），503 72 条全在 00:28/00:29/01:03（R525-2）。日报 `humans.page 4925 / ips 4863` 基本全簇。
- `scan_sheet`/`paper_answers`/`paper/{code}` 全历史 7 条全 `140.232.64.x`（探针）。生产 `question_ids='[]'` 空卷 4 张全为 08-03 09:08–12:01Z（探针期）。

## 6. 如实

- 全部「成立」证据为本地合成（uid `r522local`，`~/r525/app.db` 累积：`answer_log` 3→6、`mistakes` 2→3 有 id 行）；涂卡图是程序按 `omr.bubble_rect` 同几何合成，非手机实拍（无透视/阴影/曝光变量），只证明「槽位契约」不证明识别鲁棒性。
- 生产 0 写入、0 PDF、0 LLM、0 部署；生产读数全部 `mode=ro` + Caddy 日志；簇归因是特征推断。
- 未做 UI 层批量操作走查（本轮以 API 同形态直打；R520/R524 已做过批量条 UI 只读走查）；无 testing agent 录屏（未另行授权）。
- 首页导出结论基于源码三处入口静态核 + `/api/questions` 数据源，未在生产点击（此前 R520b 已核该确认层可点）。

## 7. 登记

- R526-1（P3）：手动录入层 `n=0` 空卷无解释文案（见 §0）。
- R525-1：关闭（当前 API 不可达，见 §2）。
- R524-1 / R521-1：仍待产品/UX 定。
- 下一步 R527：(c) 补量 + 到期项/簇；四维下一候选先一手核（练习页「导出为试卷 PDF」与首页同函数复制两份的漂移风险——`home.vue`/`practice.vue exportPaper()` 逐字比对；错题本「扫描答题卡」入口对 R525 后混合卷的扫描结果页题号/时政题提示口径——本地扫描结果 sheet 375/1440）；命中则论证→实修→发版→复采。
