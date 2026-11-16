# R572 · 统计页旧快照兜底诚实口径（R571-1）+ 热修：同 Document 切 tab 回来 review 旧快照清上一轮 dueSynced

PR #752（分支 `devin/1789008230-r572-stats-stale-snapshot`，含 #751）；仅 H5，0 后端 / 0 小程序；health 全程 `09d664a4`。

## 研究（一手）

- 生产 30 天非测试 `stale_fallback` 20 条 / 2 uid；端点分布含 `/api/stats` `/api/review` `/api/review/cur` `/api/growth` `/api/mastery/map` `/api/shenlun/stats` `/api/checkin/summary` `/api/exam/attempts` `/api/profile` `/api/home_bundle` `/api/announcement` 等 18 端点——样本小不称广泛缺陷；一次冷启多端点全回退 = 宿主 503 窗。
- 统计页 7 个 `snapPeek + request` 加载器，只有 `/api/review` 把旧快照当业务陈述（到期数 / 「今日待复习」CTA），与 R569/R571 错题本「未同步显 —」自相矛盾；其余是历史图表 / 展示字段。首页 / 我的审计到的旧快照消费全是展示型字段，样本 1 条/端点 → 不立项，登记。
- `request()` 兜底 resolve（非 reject）+ `staleAt()` 按对象身份（WeakMap）——调用方必须在 spread/变形前登记。`snapPeek()` 首帧对象无 stale 标记，不能当本轮回包处理。

## 实修

- 新 `src/snapshot-view.js snapshotViewMixin({ noun, reload })`：`beginSnapshotRound / noteSnapshot(d) / settleSnapshotRound / showSnapshot / unbindNet`，横幅取本轮最旧快照时刻，主回包真实且本轮未见旧快照才 settle；`snapshot-notice.js snapshotNotice()` 加第 4 参 `noun`（默认「错题」不变）。
- `stats.vue`：`paintStats`（snapPeek 铺屏）/ `applyStats`（真实回包，R499 源锁 `this.applyStats(await request(sp))` 不变）；六个次级加载器赋值前 `noteSnapshot(d)`；`/api/review` 旧快照不置 `dueSynced`，到期行三态「N 题今日待复习 / 到期数需网络恢复后同步 / 正在同步到期数…」；`kg-banner` + 「重试」= `refreshAccountData()`；`onUnload → unbindNet()`。
- **热修 `c585ea2f`**（复验一 F FAIL）：`loadReco` review 旧快照 → `dueSynced = false`（dueN 保留撑行）；`book.vue load()` 同形 `if (staleR) this.dueSynced = false;`（due 列表 / CTA 保留，headStats 显 —/—）。
- 测试 `tests/r572-stats-stale-snapshot.test.js`（15 用例）。本地门：vitest 192 文件 1494 / eslint 0 error（lint-pages 20 warn 存量）/ build:h5 / diff --check 空。

## 发版

后端 0 改动 → 只跑 Pages 4c/5/5b/6（`~/r572/pages_deploy.sh`）：`index-Bqtt7zO3 → index-DBsFvyZ8 →（热修）index-XSq5z_z5.js`（book chunk `DFxsA18S`）。`DEPLOY_RESUME=1` rev 对账待办不变。

## 生产复验一（`index-DBsFvyZ8`，`~/r572/prod/report.md`，375+1440）

- PASS：A 十端点各一次 200 / 无横幅 / 真实 2 due；B 阻断 GET + 原生 F5 → 横幅 + 重试 + 到期未知 + 分布保留、无 toast（resolve 路径）；C 主 stats 真实后 review 晚回退 → 横幅重开、到期未知；仅 stats 旧而 review 真实保留真实 2 due；D 重试十端点各恰一次 200、横幅消失；E 真离线 ≈302ms/2s 换句、online 自动真实回包、再切网 0 额外 GET、CDP 确认双监听摘除；错题本 R571 回归。
- **FAIL F（375/1440 同复现）**：真实 2 due → 错题本 → 只阻断 review → 切回统计：横幅出现但到期行仍「2 题今日待复习」（暖轮沿用上一轮 `dueSynced=true`）。冷 Document 混合态（B/C）正确。
- 登记 **R572-1**：`stale_fallback` 埋点在 `getCache.run` 在途合并之外按调用方各记一条（`/api/predict` 两处消费 → 1 次 GET 2 条事件；B 每尺寸 10 失败 GET / 11 条事件），生产「20 条」上界 ≥ 失败 GET 数，不影响行为、不立项。
- 审计：API 321 = 264×200 + 50 有意 abort + 5×429（全为 1440 `POST /api/track`）+ 2 导航取消；超时/503/520 0；应用 console/runtime/rejection 0；12 条 SW warning = harness。清理：本轮 0→67→0 + 研究阶段 `test-r572-shots` 前置 45→0（授权），一次事务 112 行，独立 41 表 0 残留，共享 R562 42 行保持。

## 生产复验二（热修 `index-XSq5z_z5`，`~/r572/prod/report2.md`，UID `test-r572b-1789009786`）

- PASS：F′ 375/1440 同 Document 旧 review → 「到期数需网络恢复后同步」+ 横幅、重试恢复 2 due；F″ 375 错题本暖轮旧 review → —/— + 3 卡 + CTA 保留、重试恢复 2；A′ 375 十端点各一次 200 / 无横幅；R571 缓存首帧 / 旧快照首帧回归。
- **UNTESTED（环境）**：F″ 1440 旧态 PASS 但解除阻断后恢复耗尽 12s/20s 内建重试未回真实（同刻独立探测 health 5.0s→21.9s、`/api/review` 21.7s，宿主慢）；未额外人工重试。
- 审计：API 173 = 150×200 + 7 有意 abort + 13 超时模式 + 3 关闭前无终态；429/非 2xx 0；应用 console/runtime/rejection 0。清理 0→18→0，独立 41 表 0 残留，共享 42 / 五类 hash 保持。
- 本轮未重跑完整 A–E、真离线监听、onUnload 专项。

## 未验证 / 登记

- UNTESTED：真实 SW / 真机 / 小程序（R536-1 累计）/ 其它浏览器 / 跨设备 / 无 `apiSnap` 真 reject 分支 / 富数据申论·模考内容专项 / onUnload 钩子独立证明 / F″ 1440 恢复。
- 登记：R572-1（埋点按调用方计数）；R571-1 首页/我的展示型字段不立项待更多证据；`DEPLOY_RESUME=1 --skip-build` rev 对账（后端无变化）。
