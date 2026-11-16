# R148：PDF 导出资料分析题按同材料聚组排版（R147 去重的排序补全）

## 取证（一手证据）

- R147 的相邻去重只在同材料题**相邻**时生效；而错题卷/自选卷导出的题序来自错题本/练习的加入顺序，同材料小题常被其他材料题隔开。
- 生产实测（rev 2f3e10c）：交错导出两组同材料题（ids 37,753,38,754,39,755，material_hash 各 3 题）→ PDF 出现 4 个「【资料】」块（理想为 2），读者在两段材料间来回跳。
- `db.questions_by_ids` 现仅按 `(module, submodule)` 稳定排序，不感知材料。

## 方案

仅改 `exam_api.api_export_pdf` 的导出前排序（不动 `questions_by_ids`，其余 16 处调用方均为 dict 查找不依赖序）：

```python
def _group_ziliao(questions):
    # 稳定：非 ziliao 相对顺序不变；ziliao 按材料键（material_hash 优先，
    # 否则 pdf_export._split_material 的去空白材料文本）首现位置聚组
```

- 同材料小题聚到该材料首现处，组内保持原相对顺序；无法取键的题保持原位。
- 聚组后 R147 相邻去重自然生效：每组材料只排一次。

## 验收

- pytest 新增用例锁定聚组稳定性（非 ziliao 不动 / 交错聚合 / 无键保位）。
- 本地 ruff + pytest 全绿；生产复测同一交错 id 序导出 → 「【资料】」块 4→2。
