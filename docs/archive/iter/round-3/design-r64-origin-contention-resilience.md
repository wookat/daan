# R64 设计：共享宿主资源竞争下的 origin 韧性（uid 热表预热 + 容器 CPU 权重）

## 一手证据（2026-08-31 生产实测）

1. 生产页面走查中，打卡海报页渲染出 `request:fail timeout`（/api/checkin/summary 双超时后错误文案直出）。
2. 复现同端点冷路径：连续 3 次 curl 实测 **125.1s(CF 524) → 61.9s(200) → 1.5s(200)**——典型「页/缓存逐步变热」曲线。
3. 该端点 SQL 本身极便宜：dbstat 实测 uid 热表总量 <0.5MB（answer_log 1275 行 0.09MB、review_log 51 行、user_profile 12 行等），questions 主表 194.7MB 才是 DB 大头，但该端点不触碰。
4. 同时刻宿主机：load 12.28、free 81MB、`recruit-postgres` 154% CPU / 568MB（另一产品的 Postgres，pg_stat_activity 实查为其自身业务查询）。deploy-kaogong-1 仅 0.5% CPU / 58MB。
5. 结论（区分事实与推断）：
   - 事实：长尾发生时 kaogong 容器自身资源占用极低，竞争方是同宿主其他产品容器；SQL 与数据量不构成 60–125s 量级。
   - 推断：冷窗口下 kaogong 的热页被挤出 + CPU 调度饥饿共同造成分钟级挂起；第 3 次 1.5s 佐证「变热即恢复」。

## 方案（两项，均只动本仓库）

### 1. `_warmup` 扩展：uid 热表整表预热
既有 `_warmup`（300s 周期）只预热抽题 id 池与题目索引，不覆盖 uid 专属小表。追加对 uid 热表整表 SELECT（总量 <0.5MB，单轮开销毫秒级），维持其数据页常驻 OS page cache，收窄 checkin/summary、daily_plan、favs 等 uid 端点的冷长尾。

表清单（缺表跳过）：answer_log、review_log、user_profile、question_favs、fav_folders、question_notes、question_comments、comment_likes、growth_events、mistakes、pk_matches、interview_sessions、shenlun_answers。

### 2. docker-compose：kaogong 容器 `cpu_shares: 4096`
CPU shares 是相对权重（默认 1024），仅在宿主 CPU 争抢时生效，空闲时零影响。面向用户的 kaogong API 相对后台批处理容器（recruit-worker 等）应获得更高调度权重。不设 memory limit（避免 OOM kill 风险），不动其他产品容器。

## 边界（如实声明）

- 本方案**不能根治**共享 2GB 宿主的资源竞争（recruit-postgres 峰值 154% CPU 不受本仓库控制），只能收窄 kaogong 侧受害面；主机隔离/迁移仍是架构待办，需老板决策。
- cpu_shares 不保证下限，IO 争抢（非 CPU）场景无效。
- 预热不覆盖 questions 主表 194.7MB（无法常驻 1.9GB 宿主内存，抽题冷路径已由既有 id 池预热+R55 索引收敛）。

## 验证方式

- 本地：import app.main 成功、warmup 一轮无异常、缺表容错。
- 生产：部署后 compose 确认 CPUShares=4096 生效；闲置 30+ 分钟后冷测 /api/checkin/summary 等 uid 端点响应时间对比。
