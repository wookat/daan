# R40 设计方案：讨论聚合接口 N+1 查询收敛（plaza + /tiku/discuss/）

## 现状取证（2026-08-29，代码实查）
- `GET /api/comments/plaza`（social.py，R33，游客可访问）：先 GROUP BY 取 N 组（≤50），再对每组循环 2 次单独查询（最新评论 + 题干）——每请求 1+2N 条 SQL，最多 **101 条**。
- `GET /tiku/discuss/`（seo.py，R37，SSR 不缓存）：同模式 1+2×30=**61 条**/请求。
- 运行环境：2GB 共享生产机（曾实测其他容器挤占导致 /api/favs 62s 长尾），两接口均无登录门槛、可被爬虫高频命中；R33 立项时即挂账「潜在 N+1，规模大时优化」。

## 差距定级
P2（架构/性能韧性）：当前数据量小无用户可感知问题，但查询数随 limit 线性放大，属既定架构待办收口。

## 方案（不改响应结构，不加依赖）
两处改为**单条 SQL**：GROUP BY 子查询 + 相关子查询取每组最新评论 id + LEFT JOIN questions：

```sql
SELECT g.question_id, g.cnt, g.last_at, c.nickname, c.content, q.question, q.module
FROM (SELECT question_id, COUNT(*) cnt, MAX(created_at) last_at
      FROM question_comments WHERE status='ok'
      GROUP BY question_id ORDER BY last_at DESC LIMIT ?) g
LEFT JOIN question_comments c ON c.id = (
    SELECT id FROM question_comments
    WHERE question_id = g.question_id AND status='ok'
    ORDER BY created_at DESC, id DESC LIMIT 1)
LEFT JOIN questions q ON q.id = g.question_id
ORDER BY g.last_at DESC
```

- plaza：保持现响应字段与语义完全一致（不加 disabled 过滤，缺题回退空串——与现状相同）。
- /tiku/discuss/：保持 `disabled=0` 过滤与缺题跳过语义（SQL 取回后 python 侧按 q 判空跳过，与现状一致）。
- 最新评论并列时序（created_at 相同）以 id 倒序打破，消除原 LIMIT 1 的不确定性（现状同值时顺序未定义，属兼容收敛）。

## 验收
- 本地：临时库造多题多评论数据，改造前后两接口响应逐字段一致；py_compile/ruff 通过。
- 生产：/api/comments/plaza 与 /tiku/discuss/ 返回 200 且内容与改前一致（卡片数/最新评论/题干），前端讨论广场页正常渲染。
