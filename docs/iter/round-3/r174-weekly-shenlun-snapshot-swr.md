# R174：周报/申论历史快照即显（客户端 stale-while-revalidate 收尾）

## 取证（2026-08-29，源码一手证据）

R169–R172 后全站消费 `snapPeek()` 的页面：stats/home/profile/exam-list/practice-history/mastery-map。剩余含 uid GET 的入口逐一核查：

- `pkgA/stats/weekly-report.vue` `load()`：`/api/report/weekly?uid=…[&week=…]` 单次探测，长尾下整屏 loading 骨架；报告内容自带 range 标注（上周报告本身即历史数据），陈旧即显无误导。
- `pkgA/shenlun/shenlun.vue` `switchRec()`：`/api/shenlun/history?limit=50&uid=…` 切「练习记录」tab 时 recLoading spinner。
- `pkgA/exam/contest.vue`：`/api/mock/events?uid=…` 的 current/next 报名/进行中状态强时间敏感，陈旧即显可能误导报名截止/开考状态，本轮明确不做。
- `exam.vue`/`report.vue`/`contest-report.vue`：做卷/成绩即时会话页，快照即显不适用。
- `shenlun.vue` `syncFavs()`（同步逻辑非展示）与 `loadHistory(qid)`（详情内非关键路径）不做。

## 方案

对称复用 R169 模式（R90 apiSnap 存储/24h TTL，零后端零白名单变更）：

- weekly-report：抽出 `applyReport(d, stale)` 承接 empty/pending/正常三态赋值；`load()` 起始 `snapPeek(path)` 命中即 `applyReport(snap, true)` 并 `loading=false`；stale 路径跳过 `markRead`（POST 副作用）与 `loadNextEvent`，真实响应走原路径覆盖并触发副作用；失败保留既有错误态。
- shenlun `switchRec()`：命中快照即 `recs = snap.items`、`recLoading=false` 提前铺屏；真实响应覆盖；失败保留 rErr。

## 验收

- 本地 ESLint / vitest / H5 build 全绿；
- 生产部署后（R173 轮询校验首个真实部署复验）：测试 uid 建快照 → 拦截 uid API 重载，1440/375 周报内容/申论记录 tab 即显、无整屏 loading/spinner、console 0 error、溢出 0；
- 测试数据清理、保护 uid 零 mutation。
