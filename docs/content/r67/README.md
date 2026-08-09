# 轮67：过期分收尾 + 内容更新链路自动重打分补缺

日期：2026-08-09 ｜ 分支：devin/1786315936-r67 ｜ 生产库：/data/data.db（active 112,962）

## 0. 结论速览

- **过期分收尾：已归零，无需再回写。** 轮66 处置 2,211 条假队列时已顺带跑过官方 `score_all` 全库刷分（156,792 行含下架题），本轮全表逐条复算复扫确认：**存量分与现行口径 0 不一致**（active 112,962 条 stale 0，全表 156,792 条 stale 0），47,482 条同类过期分已在该次刷分中一并消除。
- **自动重打分缺口检查：新题入库有钩子，内容更新链路缺失——已补上并部署上线。**
- 健康快扫全绿；数据例行照常。

## 1. 过期分收尾复扫（第 1 项）

| 范围 | 行数 | 复算不一致 | 复算后 <50 |
|---|---|---|---|
| active（disabled=0） | 112,962 | 0 | 0 |
| 全表（含下架/待审） | 156,792 | 0 | 0 |

时间线说明：轮66 报告发现 47,482 条过期分后，当轮已执行 `score_all(conn)` 全库刷分归一（14 秒）；本轮按要求复扫确认收尾，无残留，不需要再做守卫回写（备份 `/data/bak_r66_rescore2211.db` 仍在位可回溯）。

## 2. 内容更新链路自动重打分补缺（第 2 项）

### 2.1 摸底结论

- **已有**：新题入库钩子 `_enrich_new_question`（db.py）在导入时即调用 `quality.score_question` 写分，入库链路无缺口。
- **缺口**：四个内容/信号更新路径改完字段后均不重打分，是本次 47,482 条过期分的根因：
  1. `admin_update_question`（管理后台编辑题干/选项/答案/解析等 12 个字段）；
  2. `set_question_hs_explanation`（AI 精讲写回）；
  3. `import_hs_explanations`（hs/xp 批量导入——历史补齐即走此路径）；
  4. `rate_question_hs`（用户点赞/点踩，hs_up/hs_down 直接参与打分）。

### 2.2 修复（小改动，backend/app/db.py）

新增通用钩子并在上述四处调用（同连接同事务，提交前回写）：

```python
def rescore_question(conn, qid: int):
    """按现行口径重算并回写单题 quality_score（内容变更后调用，防打分过期）。"""
    row = conn.execute("SELECT * FROM questions WHERE id=?", (qid,)).fetchone()
    if row:
        conn.execute(
            "UPDATE questions SET quality_score=? WHERE id=?",
            (quality.score_question(dict(row)), qid),
        )
```

单题 SELECT+UPDATE，主键命中，无性能顾虑；批量治理脚本仍沿用「落地后同轮 score_all」口径（r66 §2.5）。

### 2.3 部署与验证

- `deploy_h5.sh` 全流程部署：bundle `index-BGFOtlL1.js` 线上一致，接口回归 7 项全 200。
- 线上钩子实测：对 618800 以原文本回写 hs（幂等，内容不变），钩子触发后 quality_score=63，与现行口径独立复算一致（63/63），hs 文本零变化。

## 3. 健康快扫 + 数据例行（第 3 项）

- active 112,962；options 非 JSON 0；`(cid:` 乱码 0；hs 答案一致性 0 不一致；空 hs 仅 2 条台账题（panduan:334296、changshi:655861）；active `quality_score<50` = 0。
- 近 7 天作答 39 次 / 14 uid。

## 4. 下一轮建议

1. 站长平台验证仍是 P0（需老板资源）。
2. 内容线大盘保持清零；后续任何治理批次照 r66 §2.5 口径执行（落地同轮刷分+立项前复算预检），本轮钩子已消除单题编辑路径的过期分来源。
3. 发现线可转向爬虫/收录趋势复盘与增长实验。
