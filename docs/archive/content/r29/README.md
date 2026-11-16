# 轮29 纠错专项：175 条 skip_suspect 存疑题终局裁定

对轮28台账中四模块共 175 条 skip_suspect 存疑题逐题人工复核，终局处置：

- fix_answer：确凿证明存档答案错误且正确答案唯一 → 改正 answer + 补写 hs（UPDATE 带 id+旧answer 守卫，台账 reason 附完整解题过程）
- disable：多选题单字母、缺图缺材料、串题损坏、法条时效冲突、答案不唯一、数据与选项矛盾等不可修复 → 下架 disabled=1
- skip_suspect：仍无法确证 → 保留不动

## 终局统计

| 模块 | 存疑数 | fix_answer | disable | 保留 skip_suspect | 生产剩余空缺 |
|---|---|---|---|---|---|
| changshi | 107 | 45 | 61 | 1 | 1 |
| panduan | 40 | 19 | 20 | 1 | 1 |
| yanyu | 17 | 9 | 8 | 0 | 0 |
| shuliang | 11 | 0 | 11 | 0 | 0 |
| 合计 | 175 | 73 | 100 | 2 | 2 |

保留的 2 条存疑题：changshi 655861、panduan 334296（依据不足以确凿裁定，详见台账）。

## 应用与回归

- 新鲜生产快照校验（module/answer/空hs/在架均一致）→ 快照副本 dry-run：fix 73/73、disable 100/100，剩余空缺恰为 {334296, 655861}
- 生产分 4 批（45/45/45/38），每批前 VACUUM INTO /data/bak_r29_b0-3.db 备份，事务+守卫执行，行数逐条校验 =1
- 生产终局：四模块在架空缺仅剩 [334296, 655861]，与台账保留集完全一致
- 回归：/api/stats 与 /api/questions?module=changshi|panduan|yanyu|shuliang&count=5 均 200
