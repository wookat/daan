# R564：「继续上次练习 / 模考？」恢复确认改 `kg-sheet`——关层一律等于「继续」，丢弃进度只能显式点按

日期：2026-09-10。范围：仅 H5（`frontend-uni`），0 后端 / 协议 / 小程序改动。代码 PR：#744（分支 `devin/1788967428-r564-resume-sheet`，从 main `44c4eb5d` 开，发版前 merge 了待合入的 #742 分支以通过 `deploy_h5.sh` 2b 谱系闸）。生产：`0759a9dd → ccd045d9`（bundle `index-fJpmKbFu.js`）。

## 1. 研究（一手证据）

### 1.1 375 生产截图走查（R563 三轮复验截图/录像：练习退出层 / 完成页）
- 退出层（#741 起 `kg-sheet` 三选项）：标题「先退出？」→ 说明 → 主按钮「保留进度并退出」→ danger「结束本组并退出」→ 「继续做题」，层级清楚，未见文案/间距新问题；完成页层级（R553/R556 已核）不动。**不另立项。**
- 走查过程中把「同类层」列出来比对：退出层已是 app 自有层，而**同一页的「继续上次练习？」恢复确认仍是原生 `uni.showModal`**，且 R563 生产 E FAIL 的根因（uni-h5 modal Esc = `cancel` 回调、cancel 分支放破坏动作）在这三处**原样存在**——这是本轮主项来源，不是竞品推断。

### 1.2 原生层调用方枚举（`rg 'uni.showModal|uni.showActionSheet' frontend-uni/src`）
| 类别 | 处数 | cancel 分支是否破坏 | 处置 |
|---|---|---|---|
| 恢复确认（本机练习快照 / 跨设备快照 / 未交卷模考） | 3 | **是**（清 `pendingSession` / `clearServerProgress` / 删 `examProgress` 并重开计时） | **本轮换 `kg-sheet`** |
| 破坏确认（删错题 / 批量删 / 清缓存 / 退出登录 / 结束复习等） | ≈24 | 否（cancel = 什么都不做） | 不改，R563 原生层 a11y 适配已覆盖 |
| 单按钮告知（`showCancel:false`） | ≈4 | 否 | 不改 |
| editable（恢复码输入） | 1 | 否 | 不改；uni 实现 editable 时 Enter 不 confirm（读已装 `uni-h5.es.js`），仅 jsdom 覆盖 |

已装 `uni-h5.es.js`（读不改）：`usePopup(props, { onEsc: cancel, onEnter: () => !editable && confirm() })`，`cancel = () => (close(), emit('close','cancel'))`。即 **Esc 与「取消」按钮在这三处都等于「不用了 / 重新开始」**，用户 F5 后按 Esc、点遮罩（`showModal` 无遮罩关闭，但 R563 栏已把它纳入 a11y 栈，Esc 仍走 uni）想「先不管」会被清进度。

### 1.3 设计论证
- 三处语义完全同构：「继续（安全，主）」vs「丢弃（破坏，次）」；隐式关闭应落到安全侧——与 R563 #741 退出层的既定决策一致（「破坏动作不能放在原生 modal 的 cancel 分支」），复用其结论不重新论证。
- 备选「保留 `showModal`、把破坏动作挪到 confirm 侧」不选：uni modal 的 Enter = confirm，会把「丢弃」变成 Enter 一键触发，且 Esc 仍只能选二者之一，不存在「关层 = 不选」。
- 备选「不改，等自然样本」不选：生产当前无可确认外部真人（R560），这类丢进度缺陷不会以样本形式出现；且已有同形态生产 FAIL（R563 E）作为一手证据。
- 文案集中到 `resume-ask.js` 纯函数，三处不再各写一份；danger 按钮带计数「重新开始（丢弃已答 N 题）」让代价可见。

## 2. 实修（#744）
- 新 `src/resume-ask.js`：`resumeAsk(kind,{title,done,total}) → {title,tip,cont,drop}`（`local`/`remote`/`exam`）；`resumeDismissAction(act)`：未显式选过（`!act.picked`）时关层返回 `'cont'`。
- `practice.vue`：`askResume(kind, info, cont, drop)` / `resumePick(cont)`（幂等 `picked`，埋点 `practice_resume_cont|drop`）/ `watch resumeOpen` 关层补「继续」；`tryResume()`（本机 `pendingSession`）与 `tryServerResume()`（跨设备快照）只换壳，`adoptLocalPending / adoptRemoteSnap / clearServerProgress / start(...) / startDefault()` 分支原样；桌面快捷键守卫加 `resumeOpen`。
- `exam.vue`：保留 `await new Promise` 形态，`resumePick(cont) → resolve(!!cont)`，关层 `resolve(true)`；恢复分支补 `uni.setNavigationBarTitle`（`saved.mini` → 「迷你模考」，否则试卷名）——本地复现迷你模考恢复后标题停在页面默认「全真模考」。
- 顺手修（R562 既有，本地复现坐实）：`sheet-history.js sheetOpened()` 刷新后 `seq` 归零、新 token 与当前哑条目 `__kgSheet.t` 重合 → Back 落回哑条目被判「层仍开着」不关层。恢复层是「页面一进来就开」的第一个层，把这条边界打成必现（F5 → Esc → F5 → Back）。修法 `seq = max(seq, validMarker(state, href))` 再 `++seq`；`_resetSheetHistory()` 归零 `seq` 以模拟刷新。jsdom 回归去掉修法即 FAIL（1 failed | 14 passed → 15 passed）。
- 测试：新 `tests/r564-resume-sheet.test.js`（文案/关层策略纯函数 + 三处调用方源码契约 + 快捷键守卫）；`r548-redo-pending-resume.test.js` 一条断言从原 modal `content:` 字符串改为 `askResume` 入参仍走 `pendingTitle(s)`（守的行为「标题来源」不变）。

## 3. 本地门与本地实测
- eslint 0 / vitest 183 文件 1411（merge #742 后 193 文件 1447）/ build:h5 / diff --check 空；后端、小程序 0 改动未跑。
- 本地 Playwright（本地 bundle + 反代生产 API `X-Kg-Probe:1`，uid `test-r564-resume-local` / `test-r564-resume-exam`，`~/r564/local_resume.py / local_back.py / local_exam.py`）375+1440：练习 F5 → 恢复层 → Esc 继续同题、0 progress POST / 0 questions GET；F5 → Back 关层留页（修前复现 popups=1 不关）；显式「不用了，开新一组」才发 `POST /api/practice/progress` 空 qids + 新 GET → 1/10；迷你模考 F5 → Esc / Back 同 attempt 2/30 且 0 请求；显式「重新开始（丢弃已答 1 题）」→ `POST /api/exam/start` → 1/30。本地未触发跨设备快照真实回包路径（只有源码契约）。

## 4. 生产复验（testing agent，两轮）
报告：`~/kaogong-reports/r564-resume-ccd045d9-prod-verify.md`、`~/kaogong-reports/r564-resume-27e52f96-prod-verify.md`；截图/审计已附 #744 评论。

### 4.1 复验一 `ccd045d9`（bundle `index-fJpmKbFu.js`，发版前 merge #742 分支满足 2b 谱系闸）
- PASS：A 本机快照 375 Esc / 再 F5 → Back / 遮罩 / 鼠标 X 均停 3/10 同题、0 progress POST、0 questions GET；B 显式「不用了，开新一组」1 空 qids progress + 1 新 GET → 1/10；C 迷你模考 Esc/Back/遮罩/X 同 2/30 同 attempt、标题「迷你模考」，显式重开恰 1 `exam/start`；D 375 真实跨设备练习快照采用 / 丢弃；E 1440 初焦点 X、Tab×7 / Shift+Tab×7 圈定、A–D 不答题；F R563 退出三选项 / 更多操作 X→重开→X→Back 一次离页。
- **FAIL 1（P1，1440 模考）**：2/30 → 物理 F5 → 恢复层初焦点 X → 一次真实 Enter → 层关但 **3/30**（已答仍 1、attempt/endAt 不变、0 `exam/start`；Escape 对照 2/30）。根因：a11y 宿主 keydown 把 Enter 转 click 并 `preventDefault` 关层 → 同一事件冒泡到 `window` 时 `resumeOpen` 已假 → `onExKeydown` 把它当「下一题」。
- **FAIL 2（P1，埋点）**：`practice_resume_cont` ×11 / `practice_resume_drop` ×3 → `POST /api/track` 400 `无效事件`——后端白名单未补。后端本有 `test_frontend_track_events_all_whitelisted` 能拦到，但本轮自认「0 后端改动」没跑 pytest。
- 审计：3544 请求 = 3208×200 + 300 data-URL + 14×400 + 22 自然取消；console/runtime/uni warning/付费 0；精确清 6+2 UID 38 行，41 表 `test-r564-%` 残留 0。

### 4.2 热修 `27e52f96`（#744 追加 commit）
- `onExKeydown` / `onPKeydown`：`if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;`——任何已被弹层按钮激活消费的 keydown 不再进页面快捷键；模考守卫加 `resumeOpen`。
- `backend/app/team.py` `/api/track` 白名单 + `practice_resume_cont` / `practice_resume_drop`；`test_track_whitelist_sync.py` 同步。后端 pytest 746 / ruff / pyright 0；H5 vitest 1416。
- 本地复现修前 2/30→3/30、修后 2/30 且 0 请求，再发版。

### 4.3 复验二 `27e52f96`（bundle `index-Cz_UU7OO.js`）窄复验全 PASS
- 1440 模考：X 上 Enter → 仍 2/30、已答 1、attempt/endAt/picks 不变、0 `exam/start`、标题迷你模考；Tab 到「继续上次模考」Enter 同样。
- 1440 练习：真实错答停 1/10 反馈态 → F5 → X Enter / 「继续上次练习」Enter → 仍 1/10 同题干/picked/反馈，`pendingSession` 全对象不变。
- 375：显式继续/丢弃埋点均 200、`growth_events` probe=1 行落库；显式丢弃 1 空 qids + 1 新 GET → 1/10；恢复 Esc 同 2/10 0 业务请求（1 条 cont 埋点 200 为设计）；模考重开恰 1 `exam/start`；R563 退出 Esc = 继续。
- 审计：1316 请求 = 1313×200 + 3 自然 F5 `exam/progress` 取消；非 2xx / console / runtime / uni warning / 付费 0；精确清 3 UID 17 行 + fixture 4 行 + 3 张 mock 卷，`test-r564-%` 残留 0，共享 R562 42 行保持。

### 4.4 发版观测
- 6b `/` Lighthouse：a11y 0.94 一次（独立重跑 3 次均 1.00，warm-up 形态同 R560）；LCP 1087 / 3568 / 2606 / 3748ms 四次两次违例，**benchmarkIndex 均 ≈3500–3650（高）**，R562「本机 CPU 漂移」解释不覆盖这组 → 登记 **R564-1**：下轮取 LH JSON 对比 Lantern 关键链归因。本轮未改首页文件；主 bundle 仅 `sheet-history.js` 数百字节变化。

## 5. 如实边界
- 其余 ≈29 处 `showModal` / 5 处 `showActionSheet` 未改未逐一走查（cancel 分支非破坏，R563 原生层适配已覆盖键盘/ARIA）。
- 小程序三处恢复确认仍是 `wx.showModal`（无 Esc 语义、遮罩不关），本轮不改；小程序全部无真机（R536-1 累计）。
- 跨设备**练习**快照 375 生产 PASS；跨设备**模考**快照、非 mini 试卷恢复、IME / 其它浏览器 / 真机手势 UNTESTED。
- 教训：① 弹层按钮上的 Enter/Space 激活，生产复验必须断言「同题/同页」而非只看层关（同一 keydown 会在层关后冒泡到页面快捷键）；② 前端新增 `/api/track` 事件名 = 后端改动，必须跑 pytest（`test_track_whitelist_sync`），「0 后端改动」不能凭前端 diff 判断；③ 隐式关层触发 `cont` 埋点是设计，不能把它当「0 请求」口径。
