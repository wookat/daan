# R126：弹层（mask/sheet）键盘支持——Esc 关闭 + 焦点圈定 + 焦点归还

## 取证（verified facts，2026-08-31 生产实测）

- R123 后全站元素可 Tab/Enter，但弹层打开时键盘行为仍缺失：
  - 首页「言语理解·选择题型」sheet 打开后按 Tab，焦点落到遮罩背后的
    hero「✕」等背景元素（截图 r126_panel.png），弹层无焦点圈定；
  - 弹层打开时焦点不自动进入弹层（activeElement 仍为 BODY/背景）；
  - Esc 键无统一关闭行为（关闭只能 Tab 找到 ✕ 或点击遮罩）。
- 代码事实：全站弹层统一模式为 `<view class="mask" @click="close">` +
  内层 `@click.stop`，共 25 处（practice/book/ask/home/exam/contest/report/
  weekly-report/team/shenlun/export-confirm），全部支持点遮罩关闭——
  「对 mask 元素 dispatch click」即等价于用户点遮罩，可作统一 Esc 语义。

## 方案（纯前端，扩展 src/a11y-focus.js，零业务组件改动）

1. document 捕获阶段 keydown：
   - 取最顶层可见 `.mask`（querySelectorAll 逆序找 offsetParent 非 null）；
   - Escape → preventDefault + mask.click()（等价点遮罩关闭）；
   - Tab → 在 mask 内可见 `[tabindex]` 列表（排除 mask 自身）中手动循环
     （shift 反向），preventDefault 阻止焦点逃逸到背景。
2. MutationObserver（body subtree）跟踪 mask 出现/消失：
   - 出现：记录当前 activeElement，焦点移入弹层内第一个可聚焦元素；
   - 消失：焦点归还到打开前元素（isConnected 才归还）。
3. 无弹层时 keydown 直接 return，零开销路径；不改既有 R10/R12 快捷键
   （其监听在页面层，mask 打开时 Tab/Esc 先被本层捕获属预期语义）。

## 验证

- 本地 lint + vitest + build:h5；
- 生产 1440：打开题型 sheet → 焦点自动进入弹层；Tab×N 焦点始终在弹层内
  循环；Esc 关闭且焦点回到触发卡片；375 复验 + console/overflow 零回归。
