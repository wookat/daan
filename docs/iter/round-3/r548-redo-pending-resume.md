# R548：错题重练启动即落 `pendingSession`——H5 浏览器前进/刷新回练习页不再变成默认练习（R546-2 P3 既有）

日期 2026-09-08 · 前序 R547（`docs/iter/round-3/r547-book-tab-keepalive.md`）· 分支 `devin/*-r548-redo-pending-resume`（从合入 #688 后 main 开）· 代码 #690（已合入 `abc65401`）· 生产 `29c02a66 → b0747ae4`（本轮发版）→ `9b4a511c`（老板侧合 W13 #691 再发版，R548 三文件两 rev 无差）

## 1. 一手证据与机制

### 1.1 来源

- R546 复验（rev `0a930550`）：错题本 → 重练 → 浏览器后退 → 前进，练习页变默认「言语理解 1/10」，redo 上下文丢。
- R547 复验（rev `29c02a66`）坐实条件：**只在「尚未作答」时发生**；答 1 题后前进弹「继续上次练习 (1/2)」可恢复原集合（`items=2, source=""`）。

### 1.2 机制（`frontend-uni/src/pages/practice/practice.vue` 生命周期源码核）

- `onShow` redoSet 分支：`uni.getStorageSync('redoSet')` → 立即 `removeStorageSync('redoSet')` → 直接赋 `items/session=true` **不写快照**；
- `pendingSession` 只在 `commitPick / next / toggleExcl → saveSession()` 即**作答后**才写；
- 前进/F5 回来 `onShow` → 无 launch/redoSet/preset → `tryResume()` → 本地空 → `tryServerResume()` 空 → 兜底 `start(lastModule || storage.lastModule, …, 'direct')` = 默认练习。
- 普通 `start()` 同样启动后不落快照，未答刷新会重拉一组（体验一致但没人报，本轮顺带修）。

清理侧既有语义（改动前后不变）：`submitResult()` 完成整组、`leave(false)`（「结束本组」/未答直接退出 `quitSummary→null→leave(false)`）、首页续练卡「放弃」→ `removeStorageSync('pendingSession') + clearServerProgress()`；`leave(true)` 保留并 `pushPracticeProgress()`；`tryResume()` 24h 过期丢弃。

## 2. 实修（仅 H5，+169/-5，不改后端/协议）

```diff
 // practice.vue — onShow redoSet 分支 / retryGroup 重练分支 / 普通 start() 成功
   this.session = true;
   this.startQTimer();
+  this.saveSession();                     // 启动即落快照 → 前进/F5 走已有 tryResume()
 // redoSet 分支另加
+  this._source = 'redo'; this._ptitle = null;

 // saveSession() 快照新增一位
+  redo: this._redoItems && this._redoItems.length && !this.lastModule ? 1 : 0,

 // adoptLocalPending(s)
+  this._redoItems = redoItemsFromPending(s);        // redo=1 时剥 _picked/_secs/_excl/_logged/_saved/_mid/_reason/_reported 还原母本
+  if (this._redoItems) uni.showToast({ title: '继续错题重练' });
 // tryResume() 弹窗标题
-  (s.ptitle ? '「' + s.ptitle + '」' : '')
+  const title = pendingTitle(s);  // 卷名 > 「错题重练」 > 空
```

- `practice-progress.js` 新增纯函数 `isRedoPending / pendingTitle / stripPracticeRuntime / redoItemsFromPending / REDO_PENDING_TITLE`；`parsePendingPractice()` 返回多一位 `redo`（旧快照无该位 → `false`）。
- `home.vue` 续练卡 `prLabel()`：卷名 > 「错题重练」 > 模块名（此前 redo 快照 `lastModule=null` 显示模块回落值）。
- 恢复 `_redoItems` 是为了完成页 `redoReport` / 「再来一组」仍按 `_redoItems && !lastModule` 判重练，不因经过 resume 退化为普通完成页。
- `source='redo'` 落 `answer_log.source`（此前 redo 为 null）；后端 `source` 仅透传存储、不参与统计口径（核 `study_api.py`/`db.py`）。
- 测试 `tests/r548-redo-pending-resume.test.js` 12 例（纯函数 + practice.vue/home.vue 源锁）；`practice-progress.test.js` 口径同步 `redo:false`。

## 3. 本地门

vitest 153 文件 1037（+12）/ eslint + tokens + edge 0 / build:h5（`index-DRz09qBD.js`）/ `git diff --check` 空。后端、小程序未改（小程序无浏览器 history 问题域）。

## 4. 生产发版与黑盒复验

- `deploy_h5.sh --skip-build` `29c02a66 → b0747ae4`：谱系闸 OK、回归全 200、Lighthouse `/` 0.99/1.00/1.00/1.00、`/tiku/` 全 1.00。
- 复验中途老板侧合 #690 + W13 #691 发版 `9b4a511c`（bundle `index-C6y4w2jt.js`）；`git diff b0747ae4 origin/main -- practice.vue practice-progress.js home.vue` 为空。

**testing agent，uid `test-r548-verify-38f34d719e`（b0747ae4 全量 375×812 + 1440×900）/ `test-r548-verify-c4514ce083`（9b4a511c 仅 375 抽检第 1/2 项）；报告 `~/r548-verify/R548-b0747ae4-production-verification.md`，录像 `~/screencasts/r548-b0747ae4-production/` + `~/screencasts/r548-9b4a511c-spot/`。**

| # | 断言 | 375 | 1440 |
|---|---|---|---|
| 1 | 重练「错题重练开始」；未答后退→前进仍同 IDs 64/381、同题干、1/2、idx 0、`redo=1/source=redo`，未变 10 题普通练习 | PASS | PASS |
| 2 | 未答 F5 恢复原两题 + 「继续错题重练」toast | PASS | PASS |
| 3a | 答 1 题后退→前进弹「继续上次练习？」含「错题重练」「1/2 题」；继续保留原集合与已选 A | PASS | PASS |
| 3b | 「不用了」：旧 redo 快照 remove → 5/6 ms 后新普通快照 `redo=0/source=direct`、10 题不含 64/381；服务端 `qids:[]` clear 200 | PASS | PASS |
| 3c | 「start 网络返回前即时读」/「server clear 响应先于新快照」严格时序 | UNTESTED（start 命中缓存、无独立网络窗口） | UNTESTED |
| 4 | 完成页仍「错题重练效果」1 纠正/1 仍错/0 掌握；pending 清；「再来一组」重建 `redo=1` 未答快照 | PASS | PASS |
| 5 | 未答显式退出清 pending，首页无续练卡 | PASS | PASS |
| 6 | 首页「错题重练 · 已做 1/2 题」；点卡恢复重练；「放弃」清本地/服务端进度 | PASS | PASS |
| 7 | 普通数量练习未答后退→前进同 10 题、`redo=0`；首页「数量关系 · 已做 0/10 题」 | PASS | PASS |
| 回归 | 复习/讨论返回、错题本 tab 切换保筛选（R547）、主 tabs；375 无横向溢出、桌面焦点环可见 | PASS | PASS |
| 抽检 | `9b4a511c`：第 1/2 项，health/HTML/runtime 三证 `9b4a511c / index-C6y4w2jt.js` | PASS | — |

- 网络：全量 1161 = 1142×200 + 19×304；抽检 442 = 434×200 + 8×304；400/普通 HTTP 失败/console/runtime/rejection 0；canceled 6（5 图 + 1 XHR）/ 4（图）单列；付费 AI 0。
- 清理：两 uid 各 41 张 uid-bearing 表精确删 + `test-r548-%` 前缀独立只读复核 0 残留；`explain_cache` 82 行、latest 与全表 SHA-256 前后一致。

## 5. 如实边界

- 3c 严格时序未验：「不用了」分支本地 remove→新 set 只隔 5/6 ms 且 start 命中缓存，无法取「网络返回前」窗口；服务端 clear 200 已证，但与新快照写入的先后未证。功能上旧 redo 已清、新普通快照不含旧题即为验收口径。
- 375「不用了」后新快照 `lastModule=null`（该 uid 无 `lastModule` storage → `start(null)` 默认混合）、1440 为 `shuliang`（先做过普通数量练习）；两者均 `redo=0/source=direct`。
- 未答刷新走 `adoptLocalPending`（无弹窗），普通练习也如此——这是本轮新行为（此前重拉一组），已在第 7 项验证。
- 小程序无此问题域未改；R536-1 累计真机 UNTESTED。
- 快照 `items` 直接存运行时对象（含 `_picked` 等），恢复 redo 母本靠 `stripPracticeRuntime` 白名单剥字段；新增运行时字段需同步 `PRACTICE_RUNTIME_KEYS`。

## 6. 证据索引

- 代码 #690 https://github.com/wookat/kaogong-assistant/pull/690（合入 `abc65401`）
- 复验报告 `~/r548-verify/R548-b0747ae4-production-verification.md`；`identity.json / request-evidence.json / network-audit.json / clean.txt / readonly-after-clean.txt`（`~/r548-verify/`、`~/r548-spot/`）
- 录像 `~/screencasts/r548-b0747ae4-production/r548-b0747ae4-production-edited.mp4`、`~/screencasts/r548-9b4a511c-spot/r548-9b4a511c-spot-edited.mp4`
- 截图 `~/r548-verify/{forward,prompt,home-card}-{375-viewport,1440}.png`、`~/r548-spot/{forward-375,visible-toast-22}.png`
