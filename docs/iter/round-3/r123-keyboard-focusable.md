# R123：SPA 键盘可达性——click 绑定元素可聚焦可激活

## 取证（verified facts，2026-08-31 生产 CDP 实测，1440 视口）

- 首页可聚焦元素数 = 0（`a[href],button,input,textarea,select,[tabindex]` 可见项为空）；
- 连按 10 次 Tab，activeElement 始终停留在 body——整个 SPA 无任何键盘落点；
- 根因：uni-app h5 把所有交互元素编译为 `uni-view`/`uni-text` div，click 由 Vue
  runtime `addEventListener` 直挂，无 tabindex/role，键盘用户完全无法操作
  （R10/R12 桌面快捷键只覆盖错题本/刷题页作答，不解决全站 Tab 可达）。
- 对照：粉笔/夸克公开页面基于原生 a/button，天然键盘可达。

## 方案（纯前端 H5，新增 src/a11y-focus.js，main.js 引入，零后端）

1. 包一层 `Element.prototype.addEventListener`：当 `type === 'click'` 且宿主为
   `UNI-VIEW/UNI-TEXT/UNI-IMAGE/UNI-LABEL` 且无 tabindex 时：
   - `tabindex="0"`（进入 Tab 序）；
   - 挂 keydown：Enter/Space 且 `e.target === el` 时 `preventDefault()` + `el.click()`；
2. rAF 延迟定 role（挂听器时子树未插入）：无内嵌 tabindex 子元素且文本 ≤40 字符的
   叶子级元素补 `role="button"`；含子交互元素/长文本容器不设 role，避免 button
   角色把子树扁平化伤害读屏语义；
3. 全局样式 `:focus-visible` 品牌色 outline（仅键盘聚焦显示，触摸/鼠标不显示）。

## 验证

- 本地 eslint/vitest/build:h5；
- 生产：Tab 序可落在 tabbar/首页卡片/CTA，Enter 实际触发导航；
- axe 首页复扫无新增 violations；1440/375 视觉零回归、console 0 error。
