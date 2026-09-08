# R528（实现轮）：错题本「扫描答题卡 / 手动录入」结果 sheet 与录入层对混合卷（普通题 + 时政/手录内联题）注明「另 M 题不参与机读判分」——`paper_exports.inline_n` 落库 + `paper/{code}` / `paper_answers` / `scan_sheet` 回包透出；OMR 槽位契约（R525）不动

日期：2026-09-08（UTC 06:3x–07:xx）。上游：R527（#664，已合入 main `ea82b25c`）。统筹者指令：实现轮口径，命中即论证→实修→发版→复采。

## 0. 结论表

| 项 | 设计论证（样本 / 现状 / 目标 / 契约 / 失败闭合 / 验证） | 结论 |
|---|---|---|
| A. 结果 sheet 对混合卷的口径 | **样本**：R526 真卷 `340F4B53`（`question_ids=[111,112,110]` + 时政内联 2 题，卷内题号 1–3 普通、4–5 时政，卷末参考答案 `1. D 2. C 3. B 4. D 5. D`）。**现状（R526 一手 + 本轮改前源码）**：`scan_sheet`/`paper_answers` 回包 `total=len(results)` 只算机读普通题，结果 sheet 总结行「卷码 340F4B53 · 第 1 页 · 已作答 3/3 · 答对 2 题」，逐题行 1/2/3；卷子上明明 5 题，用户看到 `3/3` 无从得知第 4/5 题去了哪、要不要自己核。手动录入层同样只有「共 3 题」。**目标**：机读口径不变（`total/answered/correct` 仍是普通题），另加一句说明「另 2 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对」，录入层与结果层同一文案。**契约不动**：OMR `槽 i ↔ question_ids[i]`、`sheet_questions()`、卷内题号、逐题 items 语义、时政 NULL-qid 不进 `questions` 域，全部照旧；只新增一个说明性整数 `inline_n`。**失败闭合**：`inline_n` 缺列/为 0/非法 → 前端 `inlineSkipNote()` 返回空串不渲染；历史 `paper_exports` 行读为 0（不造数）。**否决**：把 `total` 改成 5（会让 `已作答 3/5` 像漏扫、且 `items` 只有 3 行对不上）；前端按 `n` 与卷面题数差算（前端拿不到卷面题数）；给时政题造槽位（R525 已否决，撞号） | **实现**：后端 `save_paper_export(..., inline_n)` + `add_column_if_missing` 幂等加列 + 三个回包透出；前端 `paper-inline-note.js inlineSkipNote()` + `book.vue` 录入层/结果 sheet 各一行 `.scan-note` |
| B. 全内联卷 `n=0`（R527 已上线） | `manualPaper.n===0` 走 R527 「这张卷的题目均为时政/手录题…」文案；本轮说明行加 `v-if="manualPaper.n && …"` 守卫，避免与 R527 文案重复 | 不重复出文案（源锁） |
| C. 小程序端同形态 | `miniapp-native/miniprogram/pages/book/book.wxml:222/242` 手动录入层 + 结果 sheet 与 H5 同结构、同样只渲染 `total`；回包新增字段对其向后兼容（多一个 key 不读即忽略） | **本轮 H5-only**（Linux 无微信开发者工具、小程序历轮未动未跑），登记 **R528-1（P3）**：小程序两处按同文案接 `inline_n` |
| D. 历史卷 | 生产 `paper_exports` 38 行（R527 读数）全在本轮之前导出，加列后 `inline_n` 读为 0 → 混合历史卷不出说明。生产 `scan_sheet/paper_answers/paper/{code}` 全历史调用全为探针（R526 §5），无真人受影响 | 不回填（回填需按 `title/created_at` 猜卷面题数，无依据） |

## 1. 改动

- `backend/app/db.py`：`save_paper_export(code, question_ids, title, inline_n=0)` —— `CREATE TABLE IF NOT EXISTS` 后 `add_column_if_missing(conn, "paper_exports", "inline_n", "INTEGER DEFAULT 0")`，`INSERT OR REPLACE` 多写一列；`get_paper_export()` 回 `d["inline_n"] = int(d.get("inline_n") or 0)`（旧表无列 → 0）。
- `backend/app/exam_api.py`：`/api/export/pdf` 调 `save_paper_export(..., inline_n=sum(1 for q in questions if not q.get("id")))`（与 `question_ids` 谓词 `q.get("id")` 互补）；`GET /api/paper/{code}`、`POST /api/paper_answers`、`POST /api/scan_sheet` 回包各加 `"inline_n": paper.get("inline_n") or 0`；`total/answered/correct/items` 不变。
- `frontend-uni/src/paper-inline-note.js`（新）：`inlineSkipNote(inlineN)` → `Number()` 后 `<=0`/NaN 返回 `''`，否则「另 M 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对」。
- `frontend-uni/src/pages/book/book.vue`：import + `methods.inlineSkipNote`；手动录入层 `scan-sum` 下 `<text v-if="manualPaper.n && inlineSkipNote(manualPaper.inline_n)" class="scan-note">`；结果 sheet 总结行下 `<text v-if="inlineSkipNote(scanResult.inline_n)" class="scan-note">`，逐题行仍只 `v-for="r in scanResult.items"`；样式 `.scan-note { display:block; font-size: var(--fs-sub); color: var(--ink-3); line-height: 1.6; margin: 0 0 var(--sp-8) }`。
- `backend/tests/test_r528_paper_inline_n.py`（新，4 例）：round-trip 默认 0 / 显式 2；旧表无列读 0 → 首次保存幂等加列 → 旧行仍 0、新行 1、二次 `add_column_if_missing` 返回 `False`；`/api/export/pdf` 混合体（2 普通 + 1 时政 `id:None`）落 `inline_n=1` 且 `paper/{code}` 回 `n:2 inline_n:1`；`paper_answers` / `scan_sheet`（monkeypatch `omr.recognize`）回包 `total 2 / inline_n 3 / page 1`。
- `frontend-uni/tests/book-r528-paper-inline-note.test.js`（新，3 例）：`inlineSkipNote` 边界（2 / '1' / 0 / undefined / null / 'x' / -1）；结果 sheet 总结行→说明行→`scan-list` 逐字相邻；录入层说明行 `v-if` 含 `manualPaper.n &&` 且紧邻 R527 `manual-empty` 行；`.scan-note` 样式。

## 2. 本地一手（`:8525`，DB `~/r525/app.db`，uid `r522local`，`~/r528/`）

- 后端重启到本分支后：`GET /api/paper/340F4B53` → `inline_n:0`（历史行、加列后默认值，§0-D 形态）。
- `local_export_mix.py`（R526 法复用）：真 `POST /api/export/pdf` `question_ids=[110,111,112] + items=[时政×2]` → 同卷码 `340F4B53`（卷码对同 uid/题集稳定）、`INSERT OR REPLACE` 后 `paper_exports ('[111, 112, 110]', 'R528混合卷', 2)`；PDF 3 页，答题卡第 1 页槽 `1 CS-LSRW-000111 / 2 CS-LSRW-000112 / 3 CS-DLGQ-000110`，卷末答案 `1. D 2. C 3. B 4. D 5. D`；合成涂卡 `{0:D,1:A(错),2:B,3:A(无题)}` → `omr.recognize` 同值。
- `local_r528.py 375/1440`（`local_post_{375,1440}.out` + 截图 `local_{W}_{manual_layer,manual_result,scan_result}.png`）：
  - `GET /api/paper/340F4B53` 200 `{n:3, inline_n:2}` → 录入层 3 行题号 `1/2/3` + `.scan-note`「另 2 题为时政/手录题，不参与机读判分，请对照卷末参考答案核对」（375：343×42 两行；1440：448×21 单行；13px）。
  - 真 `POST /api/paper_answers` 200 `{total 3, inline_n 2, answered 3, correct 2, saved}` items `(1,111,D,D,✓) (2,112,A,C,✗) (3,110,B,B,✓)` → 结果 sheet「对答案结果 · R528混合卷 / 卷码 340F4B53 · 已作答 3/3 · 答对 2 题 · 已记入做题记录 / 另 2 题为…核对 / 1 D 答案 D ✓ / 2 A 答案 C ✗ / 3 B 答案 B ✓ / 完成」，`ROWS 3`。
  - 真 `POST /api/scan_sheet`（`sheet_filled.png`）200 `{page 1, total 3, inline_n 2, correct 2, saved}` 同 items；用 route 把页面的 `paper_answers` 回包替换为该 scan 回包 → 结果 sheet 多「第 1 页」，说明行同上，`ROWS 3`。
  - `answer_log` 22→28→34（每视口 scan 3 + paper_answers 3），`mistakes` 4 不变（112 已在），`question_ids` 不变；非 GET 仅 `track / paper_answers ×2`；`errs []`（两视口）。
- 门：pytest 577（R527 573 + 4）/ ruff；vitest 137 文件 / 927 例（R527 136/924，+1 文件 +3 例）、eslint 0 error / 19 warn（既有）、`lint:tokens`、`build:h5`；`git diff --check` 空。

## 3. 发版

（见下）

## 4. 生产只读复采

（见下）

## 5. (c) / 到期项 / 簇

（见下）

## 6. 登记 / 未做

- **R528-1**（P3）：小程序 `pages/book/book.wxml` 手动录入层 / 结果 sheet 接 `inline_n` 同文案（回包已带字段，仅显示层）。
- 历史混合卷 `inline_n=0` 不回填（§0-D）。
- 生产 `scan_sheet` 真上传不做（会写 `answer_log/mistakes`）；生产只读复采只能证 `paper/{code}` 回包字段 + 录入层说明行，结果 sheet 说明行靠本地一手 + 源锁（前端对 `paper_answers`/`scan_sheet` 回包同一 `scanResult.inline_n` 路径）。
