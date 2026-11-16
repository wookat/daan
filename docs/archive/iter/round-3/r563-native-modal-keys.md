# R563：`uni.showModal` / `uni.showActionSheet` 原生层键盘·ARIA 现状核实 → 进 a11y 弹层栈 + 两轮热修（生产三次复验）

日期：2026-09-09～10。范围：仅 H5（`frontend-uni`），0 后端 / 协议 / 小程序改动。代码 PR：#740（e8c11732 主实修）、#741（c0e05ed5 热修一）、#742（0759a9dd 热修二）。生产：`5d162588 → e8c11732 → c0e05ed5 → 0759a9dd`。

## 1. 研究（一手证据）

### 1.1 调用方枚举
- `uni.showModal` 32 处、`uni.showActionSheet` 5 处（`rg` 全仓 `frontend-uni/src`）。分三类：确认型破坏动作（删错题 / 清缓存 / 退出登录 / 结束练习等）、单按钮告知（我的「关于」`showCancel:false`）、editable（恢复码输入）。
- R562 的全局焦点栈只扫 `.mask, .wd-popup`，原生层 `<uni-modal>` / `<uni-actionsheet>` 全不在栈内。

### 1.2 已装 `uni-h5` 实现（不假设，读 `node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js`）
- modal：`usePopup(props, { onEsc: cancel, onEnter: () => !editable && confirm() })`；键盘由 **document keyup** 驱动，映射只有 Escape / Enter，无 Tab；按钮是无 `tabindex` 的 `div.uni-modal__btn`，宿主无 `role`。
- actionsheet：`.uni-actionsheet{ visibility:hidden; transform:translateY(100%); transition: transform .3s, visibility .3s }`，`_toggle` 才 `visibility:visible` → 过渡首帧 `focus()` 会被拒。
- **真实缺陷复现（本地 dist + Chromium CDP）**：错题本 → 更多操作层 → Tab 到「删除」→ **Enter**：a11y 宿主 keydown 触发 `click` → `uni.showModal('删除这道错题？')` nextTick 打开 → **同一次按键的 keyup** 被 uni `Enter→confirm` 吃掉 → 确认框一闪即过、`DELETE /api/mistakes/:id` 直发。Space / 鼠标无此问题。

### 1.3 375 弹层信息层级截图走查
R562 三轮生产录像/截图（筛选层 / 更多操作层）：层级、间距、文案未见新增可感知问题；不另立项。

### 1.4 设计论证
不改 vendor；在既有 `a11y-focus` 栈里加「原生层适配」（`NATIVE_LAYER_SEL='uni-modal, uni-actionsheet'`）：`role=dialog aria-modal` + `aria-labelledby/describedby`、有文本 div 按钮 `tabindex=0 role=button`、Tab 圈定、Enter/Space 激活、**同一次按键 keyup 吞掉**（`shouldSwallowKeyup`）、modal 的 Esc/Enter 语义留给 uni 自身（`hit=null`）。备选「32 处换 `kg-sheet`」代价过大且丢 uni 原生语义，不选。

## 2. 实修

### 2.1 #740（e8c11732）
`modal-policy.js`：`modalEntry` 识别原生层、`initialFocusables('uni-modal')` 只留文本控件否则焦点落面板（保住 uni Enter=确定）、`modalKeyAction → 'activate'`、`shouldSwallowKeyup`、`LEAVE_RE` 加 `uni-fade-leave*`、`reconcileStack → {removed, buried, kept}`。`a11y-focus.js`：window capture keydown/keyup 记 `armed{key,gen}`、`decorateNativeLayer`。顺带修既有栈缺陷：被压层（更多操作层离场同时确认框打开）关闭不再抢顶层焦点。测试 +16。

### 2.2 #741（c0e05ed5）热修一（生产 e8c11732 两 FAIL）
- **F FAIL** actionsheet 初焦点仍在背景（700ms/3200ms 后 active 仍 `.modrow-lnk`）：根因 1.2 的 `visibility` 过渡首帧拒 focus → `focusInto` 逐帧 `requestAnimationFrame` 重试（`FOCUS_RETRY_MAX=30` ≈ 0.5s，用户已先 Tab 进层则不抢）。
- **E FAIL** 练习中途退出确认 Escape = uni `cancel` = 「结束本组」→ 清 `pendingSession` 并回首页：改为 app 自有 `kg-sheet` 三选项（保留进度并退出 / 结束本组并退出 / 继续做题），Esc/Back/X/遮罩一律等于继续做题；`quitPick(keep)` 才 `leave(keep)`。

### 2.3 #742（0759a9dd）热修二（生产 c0e05ed5 E FAIL）
- 现象：退出层 Esc/Back/继续/X/遮罩各关一次再重开后点「结束本组并退出」：副作用全发生（pending 删、恰 1 `practice_quit_end`）但 URL 仍 `#/pages/practice/practice`、界面空壳准备页；fresh context 最小序列 Esc→Back→继续→Tab→End 同样复现；新一组首次开层直接 End PASS → 依赖关层历史。
- 根因（`sheet-history.js`，R562 状态机）：每次开层 `pushState` 哑条目、关层不动历史；连开关 N 次留 N 条哑条目。从最上面已关哑条目 `history.back()` 落到下一条已关哑条目时 `popAction` 第三条规则**无条件** `skipping=true`，链到本页真条目就 `none` 停住。`skipping` 本意只是「从更深页面返回落到哑条目 → 跳过它到本页真条目就停」。同形态 R562 既有缺陷：更多操作层 X 关→重开→X 关→Back 要按两次。
- 修法一行：`skipping: prev == null || skipping`（链起点是别页返回才 skip；本页哑条目上离开的链一路补 back 到真离页）。
- 否决方案：重开时复用本页已关哑条目（`replaceState`）——破坏 R562-fix-2 D1 `?mod` 场景（`syncBookUrl` 就地改哑条目 URL，复用后 Back 关层落到无 query 真条目丢筛选），既有测试立即 FAIL。
- 测试：`popAction` 纯函数两条（本页链 back/back/back 不置 skipping；深页返回穿两条哑条目 back(skip)/back(skip)/none）+ jsdom 两条（连开关三次一次 Back 离页；两条哑条目后 navigateTo 深页 Back 只回本页）。

## 3. 本地门
- #740：vitest 1392 / eslint 0 / tokens / build:h5 / diff --check 空。
- #741：vitest 182 文件 1398 / eslint 0（20 既有 page warn）/ build:h5 / diff --check 空。
- #742：vitest 182 文件 1402 / eslint 0 / build:h5（`index-CJGmmlXG.js`）/ diff --check 空。

## 4. 生产复验（testing agent 独立、真实 CDP、375 + 1440、精确清理）

### 4.1 e8c11732（#740）`~/kaogong-reports/r563-native-modal-e8c11732-prod-verify.md`
PASS：A 首 Enter 后确认框停住 ≥1.2s、0 写；ARIA `role=dialog aria-modal labelledby/describedby`；B Tab/Shift+Tab 圈定、`role=button tabindex=0`、有意 Enter 恰 1 DELETE；C/D Space·鼠标；E 退出框 Tab 圈定；「关于」单按钮；F actionsheet role/Tab 循环/Esc 归还；G R562 更多/筛选/Back 回归。**FAIL**：F 初焦点仍在背景；E 练习退出 Esc 回首页清 pending。审计 41 表 0 残留。

### 4.2 c0e05ed5（#741）`~/kaogong-reports/r563-fix-c0e05ed5-prod-verify.md`
PASS：F 首开/重开焦点 18–31ms 进首日期（两宽）；F 可见控件圈定/Esc；E 取消五路径（Esc/Back/继续/X/遮罩）留页、pending 全对象不变、0 quit/progress POST；E 键盘圈定；E Keep 回首页续练卡恰 1 keep；新组首次直接 End 回首页；未答退出；A/About 回归；1003 请求全 200、console/runtime/uni warning/付费 0；精确清 15 行。**FAIL**：E 取消历史后 End 停在练习页空壳（两宽、fresh 最小序列亦复现）→ #742。
边界（非本轮引入、登记）：click 后 ~16ms 立即 Shift+Tab 早于 visibility 可聚焦时刻（~28ms 才进层），已入层后 Shift+Tab 到取消并保持 820ms 正常；1440 原生取消 cell 父级隐藏（rect 0）只循环 7 个日期。

### 4.3 0759a9dd（#742）`~/kaogong-reports/r563-fix2-0759a9dd-prod-verify.md`
| 断言 | 375 | 1440 |
|---|---|---|
| E1 fresh Esc→Back→继续→Tab→End：离 practice 回 `#/`、删 pending、恰 1 end；history.length `3→4→5→6→6→7` End 后不变 | PASS | PASS |
| E2 五种取消无副作用 → Keep 续练卡恰 1 keep | PASS（Esc 观察窗改 4200ms 静默） | PASS |
| E3 首次开层直接 End / Keep | PASS | PASS |
| E4 两条哑条目 → 真实讨论深页 → 一次 Back 只回原 practice | PASS | PASS |
| R1 更多操作 X→重开→X→一次 Back 离页（原 R562 需两次） | PASS | PASS |
| D1 `?mod=yanyu` go_back / 真 Alt+Left：Back1 保留 query 归焦点、Back2 离页 | PASS | PASS |
| F1 首开/重开首日期焦点 17–31ms、可见项循环、Esc 归还 | PASS | PASS（日期循环） |
审计：6879 请求 = 6857 真实 200 + 6 初始化 document + 16 自然资源取消；非 2xx / API 取消 / console / runtime / uni warning / 付费 0；528 API 双证、718 非 API 缺 ExtraInfo；精确清 82 行、41 表 0 残留、共享 R562 42 行保持。harness 偏差 3 次（E2 计时窗跨入自动下一题+保存 debounce；375 用桌面限定 ArrowLeft；yanyu-only fixture 无 shuliang chip）已修正披露。

## 5. 如实 / UNTESTED
- 不能声称：全站 32 处 showModal 逐一通过（只走删除确认 / 关于 / 练习退出 / 5 处 actionsheet 之一）；小程序（原生 API 不受影响，且无真机）；IME、其它浏览器、真机手势；删除确认 / 关于本轮 0759a9dd 未重跑（c0e05ed5 PASS）；续练后继续答题 / 刷新 / 跨设备恢复。
- 已知边界：立即 Shift+Tab 早于 actionsheet 可聚焦时刻属按键窗口非重试抢焦；1440 原生取消隐藏只循环日期属既有响应式行为。
- 教训：History 状态机里「跳过哑条目」必须区分链的**起点**（别页返回 vs 本页离开）；navigateBack 类离页动作复验要断言最终 URL/内容，不能只看副作用（pending 删、事件 1 条）；纠删/退出类确认的 Esc 语义必须和「取消」一致，不能让 uni 默认 cancel 落到破坏分支。
