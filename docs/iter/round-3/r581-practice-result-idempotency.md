# R581 · R580-1 `practice_result` 服务端幂等键 + 本地 pending 重投设计论证（登记不实施）；R580-2 09-07「同秒双行」究因（不是双写）；小程序 `practice.ts` 全答完离页与 H5 R580 同型 → 实修（源锁，0 后端 0 发版）

分支 `devin/1789041045-r580-finalize-on-leave`（链含 #742–#759）。本轮改动：`miniapp-native/miniprogram/pages/practice/practice.ts` + `utils/practice-progress.ts`（`allAnswered`）+ 测试；**H5 源码 0 改动、后端 0 改动、无 Pages/后端发版**。

## 结论（先讲）

1. **R580-2 「09-07 同秒 NULL / 有 uid 双行」不是双写，也不是同秒。** 只读 DB：#302 `19:57:57 uid=umsacie728f4ghcv8 ziliao 10/6 secs=5`、#303 `20:00:28 uid=NULL ziliao 10/6 secs=7`——相差 **151s**、`secs` 不同。只读 Caddy（`kaogong-origin` 09-08T02-49 轮转文件）两条 200 各对应一个客户端：#302 `Windows Chrome / Referer kaogong.zalize.com`（H5，dc692660 起上送 uid）、#303 `Android V2405A … wv / Referer servicewechat.com`（**微信小程序**）。小程序 `postPracticeResult` 带 uid 是 `3846f83e`（09-07）才加的源码，设备上装的是更早的开发包 → uid 缺失是**旧小程序包**，与 H5 那条是两个客户端各一场。R580 记的「同秒」是我把两行读串了，如实更正。
2. **#206/#207（08-31 15:08:33 / :34，0.61s、同 payload `'',10,2,5`、NULL uid）仍不可归因**：`kaogong*` Caddy 日志该时段已轮转丢失（`q581f.sh` 窗内 0 行），uid 列 09-06 才有。只登记，不据此定量。
3. **R580-1 幂等键设计论证通过、但本轮不实施**（P3 登记，方案见下）：需要它的一手证据只有 fin11 B（宿主 ≈60s 无回包 + 503，`answer_log`/`daily_set_entries` 落了、`practice_results` 丢）；30 天 Caddy 自然口径 `/api/practice_result` **natural 200×8 + wx-mp 200×3、非 2xx/status 0 全部是 harness**（0×2 / 400×2 / 500×2 / 502×2 / 503×7）。自然丢失窗内未观测到（n=11），后端改动要占宿主 ≈25 min D 态 + 导出（R573 实测）——在自然样本出现前不动后端；**裸客户端重投在没有服务端幂等键前禁止**（fin11 E 一手：客户端 abort、服务端已落，重投=双计）。
4. **小程序 `practice.ts` 全答完离页与 H5 R580 基线同型（源码级坐实）→ 本轮实修**：末题 `onPick` 只 `saveSession()`，`finish()` 只挂 `onNext`/`autoNext(1.2s, 仅答对)`；答错末题看反馈直接返回 → `onUnload` 走 `flushProgress()` 把 **N/N 写进本机 `pendingSession` + 远端 `practice_progress`**、不 `postPracticeResult` → 下次进页 `tryResume` 弹「上次还有一组未做完（**10/10 题**）」，H5 首页远端续练卡也会显「已做 10/10」。加 `finalizeIfAnswered()`（非结算态 / 非背题 / `_resultSent` 未置 / `allAnswered`）挂 `onUnload` 首位：`_resultSent` 先置位 → 取消 1.5s debounce 的 `flushProgress` → 删本机快照 + `clearServerProgress()` → `logAttempts(items)` 补报 → `postPracticeResult`；`flushProgress` 加 `_resultSent` 闸（`onHide` 晚到的 debounce 不回写 N/N）。结算态展示（`redoReport`/`percentile`/`dueReview`）不在离页路径、不 `setData`（页面已卸载）。小程序无每日一练，无打卡分支。
5. 与 H5 差异如实登记：H5 `finalizeIfAnswered` 还排除模考/时政（小程序练习页无模考；时政题 `_sz` 走同页不排除——`finish()` 本就对时政也 `postPracticeResult`，口径一致）；H5 挂 `leave()` + `onUnload()` 两处，小程序页内退出 `onQuit*` 最终也走 `wx.navigateBack → onUnload`，只挂一处即可（源码核：`grep navigateBack practice.ts`）。

## 一手证据

### R580-2 双行

| 行 | created_at(+8) | uid | module | n/correct/secs | Caddy 对应请求 |
| --- | --- | --- | --- | --- | --- |
| #302 | 09-07 19:57:57 | `umsacie728f4ghcv8` | ziliao | 10/6/5 | `POST /api/practice_result 200 0.02` UA `Windows NT 10.0 … Chrome` Referer `https://kaogong.zalize.com/` |
| #303 | 09-07 20:00:28 | NULL | ziliao | 10/6/7 | `POST /api/practice_result 200 0.02` UA `Linux; Android 16; V2405A … wv` Referer `https://servicewechat.com/…` |
| #206 | 08-31 15:08:33 | NULL | '' | 10/2/5 | 该时段 `kaogong*` Caddy 已轮转，0 行 |
| #207 | 08-31 15:08:34 | NULL | '' | 10/2/5 | 同上 |

- 源码时间线：后端 `practice_results.uid` 列 + H5 上送 `dc692660`（09-06）；小程序 `postPracticeResult` 带 `uid: anonUid()` `3846f83e`（09-07）。
- Caddy access log 不含 body，无法比对 payload；#302/#303 已由 UA/Referer/间隔/secs 排除「同一请求双写」。
- 脚本：`~/r581/q581a.sh`（DB 30 天 153 行 + 邻近对）、`q581b.sh`（09-07 窄窗 Caddy）、`q581f.sh`（08-31 窄窗 Caddy）。

### R580-1 需求强度（30 天 Caddy 写路径分账 `q581c.sh` / `q581e.sh`）

| 端点 | 自然 | wx-mp | harness |
| --- | --- | --- | --- |
| `/api/practice_result` | 200×8 | 200×3 | 200×224 / 0×2 / 400×2 / 500×2 / 502×2 / 503×7 / >12s×6 / >60s×2 |
| `/api/answer_log` | 200×103 | 200×45 | — |
| `/api/daily_set/submit` | 200×1 | — | — |
| 自然非 2xx | `/api/mistakes` ×3（2 条种子 uid、1 条 iPhone 畸形请求）、`/api/auth/wxlogin` 503×4（`WX_MINIAPP_SECRET` 未配置的既定 503，`auth.py`） | | |

→ 宿主级 503/超时在自然 `practice_result` 上窗内 0 例；机制真实（harness 同端点 503×7、fin11 B 丢成绩）但发生率不可从 n=11 估。

### 小程序全答完离页（源码）

- `onPick`（L648–690）：末题作答 → `saveSession()`；`autoNext` 仅答对且开关开时 1.2s 后 `onNext()` → `finish()`。
- 基线 `onUnload`（L262–269）：`flushProgress()` → `collectPracticeProgress(items…)` 全 `_picked` 也照发；`logAttempts`；无 `postPracticeResult`。
- `tryResume`（L408–437）：`done === items.length` 无特殊分支 → 弹「上次还有一组未做完（N/N 题）」。

## 实修（`miniapp-native`）

```ts
// utils/practice-progress.ts
export function allAnswered(items) { return Array.isArray(items) && items.length > 0 && items.every((q) => !!(q && q._picked)); }

// pages/practice/practice.ts
onUnload() {
  this.stopTimer(); this.clearAutoTimer();
  if (!this.finalizeIfAnswered()) { this.flushProgress(); this.logAttempts(this.data.items); }
  this._unloaded = true;
}
finalizeIfAnswered(): boolean {
  const { items, right, finished, beiMode } = this.data;
  if (finished || beiMode || this._resultSent || !allAnswered(items)) return false;
  this._resultSent = true;
  clearTimeout(this._progressTimer); this._progressTimer = 0;
  wx.removeStorageSync(PENDING_KEY); this.clearServerProgress();
  this.logAttempts(items);
  postPracticeResult(this._module || '', items.length, right, items.reduce((s, q) => s + (q._secs || 0), 0)).catch(() => {});
  return true;
}
// flushProgress: if (finished || this._resultSent || offline || !items.length) return;
```

测试：`frontend-uni/tests/r581-miniapp-finalize-on-leave.test.js`（`allAnswered` 与 H5 `quit-summary.allAnswered` 同结果 + `practice.ts` 接线源锁）；`miniapp-native/scripts/reason-toggle.test.ts` R559 源锁正则随 `onUnload` 结构更新（`_unloaded` 仍在末尾置位）。

## R580-1 设计（登记 · 待自然样本或下次后端轮合并实施）

- 服务端：`practice_results` 加 `client_key TEXT` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_ckey ON practice_results(client_key) WHERE client_key IS NOT NULL`；`api_practice_result` 读 `body.key`（`[A-Za-z0-9_-]{8,64}`，可选），`save_practice_result(..., client_key)` 用 `INSERT OR IGNORE`，被忽略时仍按本次 `correct/n` 算 percentile 返回 → 重放回包稳定；**不带 key 的旧客户端（旧小程序包 / 缓存 H5 bundle）行为不变**。
- H5：会话开始生成 `key = uid + '.' + sessionId`（随 `pendingSession` 持久，刷新后恢复同 key）；`submitResult` 先落 `practiceResultPending`（与 `dailyPendingSubmit` 同模式：先落地再发、2xx 删、失败保留），首页 `onShow` 幂等补投；同 key 服务端 IGNORE → 双计不可能。
- 顺序约束：**服务端先上线一版（旧客户端不受影响）→ 再发带 key + pending 的 H5**；客户端补投绝不早于服务端幂等键。
- 触发条件：自然 `/api/practice_result` 出现非 2xx / status 0 首例，或任一后端轮顺带。

## 本地门

- H5：`vitest` 199 文件 / 1558 通过、`eslint src tests` 0；H5 源码未改 → 不 `build:h5`、不发 Pages。
- 小程序：`tsc --noEmit` 0、`lint` 0 error、`vitest --config scripts/vitest.config.mts` 82 通过。
- 后端未改。`git diff --check` 空。

## UNTESTED / 不称验证过

- 小程序运行时（微信开发者工具 / 真机）：`onUnload` 实际触发、`postPracticeResult` 实发、`tryResume` 不再弹 N/N——**仅源锁 + 类型**（R536-1 累计，无运行时通道）。
- `onHide` 在途 `practice_progress` POST 与随后 `qids: []` 的到达顺序（同客户端顺序发出，未证明服务端按序落）。
- R580-1 方案未写代码；#206/#207 不可归因。
