# R571：错题本旧快照兜底的诚实口径（R569-1 登记项）

线上基线：后端 `09d664a4`（health），H5 静态层 `index-BE-SJK0E.js`（R570，PR #750 待合入）。分支 `devin/1789002052-r571-stale-snapshot-honest` 从 #750 分支开（含 #742–#750 未合入提交），PR #751：`7f11a532`（主）+ `c1622ca8`（热修 C）。

## 研究（一手）

- 机制（`api.js request()` / `book.vue load()` 源码）：GET 网络失败时 `request()` 以 `apiSnap:<path>` 旧快照 **resolve**（R90，`stale_fallback` 埋点），不是 reject。`book.vue` 拿到的 `/api/review` 旧快照与真实回包同形状 → `dueSynced=true`、头卡「今日待复习 N」与 tab 角标写旧值——与 R569 刚做的「未同步显 —」自相矛盾；页面顶部没有任何「网络异常 / 旧数据」提示（「当前离线」横幅只在 request 真 reject 时出现）；旧 `/api/mistakes` 列表还被 `cacheMistakes()` 回写、刷新 `mistakesCache.ts`。四层数据来源必须分清：① 真实回包 ② `mistakesCache` 同步首帧（R569）③ `apiSnap` 旧快照兜底（本轮）④ 真 reject 的 `mistakesCache` 兜底。
- 生产只读（`growth_events.stale_fallback` 14 天）：20 条 / 非测试 2 uid——其一 0 错题 0 作答 3 次冷启、一次冷启 17 个端点全部回退（宿主 503 窗）；其二 2 错题 3 作答 1 次冷启。样本小，**不能声称广泛可感知缺陷**；但机制上每次宿主慢就会发生（R568/R570 复验窗均见 503/超时），且是「数据陈述真实性」问题 → 只做错题本（到期数 + 「开始复习」是最强时效字段），不做全站。
- 宿主只读探测：load≈17 / mem_avail≈190MB / disk 95%，无他家 build/prune；health 1.4s。后端 0 改动 → 发版只跑 Pages 段；`DEPLOY_RESUME=1` 会在 4a rev 校验 `09d664a4 != HEAD` 处 exit 1（本轮后端无变化、不叠 build），rev 对账待办不变。
- 375 复习页/每日一练截图走查复看 R567/R568 存图：无 P0/P1，不立项。

## 实修（仅 H5，0 后端/小程序）

- `api.js`：`staleMarks = new WeakMap()`；`markStale(data, t)` 只在兜底分支 `return markStale(snap.d, snap.t)`；`export staleAt(data)` 真实回包 0、旧快照 = 快照时刻。按对象身份打标，不改数据形状、其它调用方零感知。
- `snapshot-notice.js`：`snapshotAgeText(snapAt, now)`（刚刚 / n 分钟前 / n 小时前 / n 天前）、`snapshotNotice(snapAt, online, now)`：`online===false` →「当前离线 · 展示{N 前|已}缓存的错题，联网后自动更新」，否则「网络不稳定 · 展示{…}缓存的错题，可稍后重试」；`snapAt=0` 不编造时间。
- `book.vue load()`：`staleD/staleR = staleAt(d/r)`；`if (!staleR)` 才写 due/dueTotal/dueSynced/celebrate dueLeft/autoReview/`setBookBadge`；`if (!staleD)` 才 `cacheMistakes`；`setSnapshotView(staleD, staleR)`（任一 >0 → `showSnapshot(min)`，全 0 → 清横幅 + `unbindNet()`）。真 reject 分支 `showSnapshot(c.ts || 0)`，toast 与横幅同源 `offlineText`。横幅 `kg-banner :text="offlineText" action-text="重试" @action="load"`；head-tip「离线中 · 今日待复习需联网后同步」→「今日待复习需网络恢复后同步」。
- 热修 `c1622ca8`（生产 C FAIL）：`navigator.onLine` 不是 Vue 响应式依赖，`offlineText` computed 只依赖 `snapAt`，同一快照时刻下断网点「重试」不重算 → 横幅仍「网络不稳定」。改 `data.netOnline`：`showSnapshot()` 每次采样；H5 挂 `online`/`offline` 同一 handler（offline → `netOnline=false` 即时换句；online → `netOnline=true` 且 `offlineView` 时 `load()`）；全真实回包 `unbindNet()`，`onUnload` 同。
- 测试：`tests/r571-stale-snapshot-honest.test.js`（纯函数 / `markStale`+`staleAt` 片段求值——`api.js` 含 `#ifdef` 双定义导出不能整模块导入 / `load()` 门控源锁 / `setSnapshotView`+`showSnapshot`+`unbindNet` 运行时 / 模板）；`r569-book-cache-first-frame.test.js` 三处源锁随结构更新（意图保留并加强）。本地门 vitest 191 文件 1486 / eslint 0 error / build:h5 / diff --check 空。
- 发版（`~/r571/pages_deploy.sh`，Pages 4c/5/5b/6）：`index-BE-SJK0E.js → index-yskMSE4e.js`（主）`→ index-Bqtt7zO3.js`（热修，book chunk `PMAnVd9-`），7 项回归 200，health 仍 `09d664a4`。

## 生产复验一（`index-yskMSE4e.js`，`~/r571/prod/report.md`）

**结论：A/B/D/E/F PASS；C 真离线文案 FAIL（→ 热修）；不判整轮全通过。**

| 项 | 结果 | 事实 |
|---|---|---|
| A 375 旧快照（真实 3 卡 2 due 前置 → abort 两 GET → F5） | PASS | 3 卡保留、头卡 `—/—`、head-tip、横幅「网络不稳定 · 展示刚刚缓存的错题，可稍后重试」+ 重试；`mistakesCache` 原字节不变 ts `1789003102161→1789003102161`；恰 2 条 `stale_fallback` 200 |
| A 角标 | PASS（口径澄清） | 冷 Document uni tabBar 角标本为空；旧 review 快照未把 2 重新写上——指令原话「角标未变」措辞不精确 |
| B 阻断重试 / 解除重试 | PASS | 横幅保持 / 真实 2 题 2 分钟 CTA 与角标 2 恢复 |
| **C 真离线文案** | **FAIL** | `setOffline(true)` 点重试，`navigator.onLine=false` 但横幅仍「网络不稳定」（300ms / 1.9s 同）；无 toast（resolve 路径不进 catch，正确） |
| C online 自动恢复 | PASS | unroute 后 `setOffline(false)` 不点按钮自动 load 恢复真实 2 due |
| D 最旧时刻 | PASS | 仅 review 快照 t 改早 2h → 「2 小时前缓存的错题」 |
| E R569 kp 首帧 / 三态 / 1440 | PASS | 首帧 1 卡 `—/—` → 回包同 1 卡 2/2；独立 uid 真 0 到期 `0/0` 非 `—`；1440 横幅/`—/—`/tip 完整 |
| F R563 E（有限一次） | PASS | 唯一一次 redo 200 三题 → 答 1 题 2/3 ✓1 → harness 误点页头返回 → Forward 走 R548「继续上次练习」恢复同 session（不算第二次 redo）→ 工具栏「退出练习」→ Esc 关 → 重开 → 「结束本组并退出」落 `#/pages/book/book` 3 卡、pending 空、无练习空壳 |

审计：134 API = 104×200 + 30 取消（12 故意 GET 阻断 / 4 context 离线 track / 12 ≈12s 超时 / 2 导航），非 2xx 0；应用 console/runtime/rejection 0；16 Browser 网络 error 为主动离线、11 SW warning 为 harness。清理精确删 24 行（主 uid 22 + 零到期 uid 2），41 表前缀 0→24→0，共享 R562 42 行 / 五类 hash 保持。

## 生产复验二（热修 `index-Bqtt7zO3.js`，`~/r571/prod/report2.md`）

**结论：C1/C2/C3、A′、1440 C1 全 PASS。**

| 项 | 结果 | 事实 |
|---|---|---|
| C1 375 | PASS | 旧快照态 → `setOffline(true)` 点重试 → 306ms / 2.003s 均「当前离线 · 展示刚刚缓存的错题，联网后自动更新」 |
| C2 事件切换 | PASS | 仍阻断时 online 不点击 → 恰 1 mistakes GET + 1 review GET、横幅回「网络不稳定」；再 offline 不点击 → ≈300ms 换「当前离线」、新增 GET 0 |
| C3 解除后自动恢复 + unbind | PASS | online 自动两个 200 → 真实 2 题 2 分钟 CTA、横幅消失；再切 offline/online 7.15s 窗口内额外 GET 0、横幅未再出现 |
| A′ 回归 | PASS | 3 卡 `—/—` tip；cache 原字节 ts `1789004562375→1789004562375`；2 条 `stale_fallback` 200；重试恢复 |
| 1440 C1 | PASS | 301ms / 2.003s 文案准确、3 卡可见 |

审计：83 API = 61×200 + 22 失败（12 主动 GET abort / 8 主动 offline track / 2 ≈12s 超时），非 2xx 0；应用 console/runtime/rejection 0；21 Browser 网络 error 为主动断网、5 SW warning。起终 health 200 `09d664a4` 但 24.5s / 15.1s（宿主级）。清理精确删 17 行，41 表前缀 0→17→0，共享 42 / 五类 hash 保持。

## 登记 / 下一步

- R571-1：首页 / 统计 / 我的等其它 `snapPeek + request` 页面仍静默旧快照，按同一 `staleAt` 口径逐页评估（先量生产 `stale_fallback` 端点分布：`/api/stats` `/api/profile` `/api/exam/attempts` 有样本）。
- `dueSynced` 已由真实回包置真、之后 reload 撞旧快照 → 到期数保留上次真实值 + 横幅（不清零），有意为之。
- UNTESTED：无 `apiSnap` 的真 reject 分支（R569 B′ 已覆盖旧文案版）、只一条 API stale 的混合态、onUnload 监听清理专项、真实 SW、真机/小程序、其它浏览器/跨设备。
- 待办不变：宿主可用时 `DEPLOY_RESUME=1 ./deploy/deploy_h5.sh --skip-build` 让 health 到 HEAD（只是 rev 对账）；R566-1 Cloudflare beacon 撞 CSP 等老板。
