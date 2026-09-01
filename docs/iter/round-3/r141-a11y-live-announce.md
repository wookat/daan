# R141：读屏动态反馈通报（aria-live）

## 取证（2026-09-01）

- 源码全仓 grep：`aria-live` / `role="alert"` / `role="status"` 在 `frontend-uni/src`、`deploy/cf-pages` 中出现 0 次。
- `@dcloudio/uni-h5` 编译产物（dist/uni-h5.es.js）中 `aria-live` 出现 0 次——即 `uni.showToast` 渲染的 `uni-toast` 元素对读屏完全静默。
- 全站 `uni.showToast` 调用 212 处，是操作反馈的唯一外显通道（保存成功/加载失败/已复制/时间到自动交卷等）；读屏用户对这 212 处反馈全部零可达。
- 刷题页判分横幅（practice.vue `.banner`，「✓ 回答正确 / ✗ 正确答案 X」）为 v-if 插入的视觉文本，无 live region，读屏作答后听不到对错。
- R123/R129/R130 已收口键盘可达与可访问名称，动态通报是读屏链路最后一块缺口。axe 静态扫描不覆盖此类问题（live region 缺失不产生 violation），故此前未被 R120/R132 复扫发现。

## 方案

新增 `src/a11y-live.js`（对称 a11y-focus.js 模式，H5-only，零依赖零后端）：

1. `initA11yLive()`：boot 时向 body 追加常驻 visually-hidden 容器 `role="status" aria-live="polite"`；
2. MutationObserver 监听 body 子树：发现 `UNI-TOAST` 节点即挂子观察器（uni-h5 toast 元素 v-show 复用，仅首次插入），子观察器监听 style/文本变化，元素可见且文案非空时镜像到 live region——212 处 toast 一次性全覆盖，无需逐处改造；
3. 导出 `announce(msg)`：先清空再经 rAF 写入，保证相邻相同文案也能重复通报；
4. practice.vue `pick()` 判分后显式 `announce('回答正确…'/'回答错误，正确答案 X')`（横幅文本非 toast，需显式通报）。

抽纯函数 `toastAnnounceText(visible, text, last)` 决策「是否通报/通报什么」，vitest 回归。

## 边界

- 仅 polite（不打断读屏当前朗读）；不做 assertive 分级。
- uni.showModal/showLoading 本轮不覆盖（modal 有焦点圈定兜底，loading 变化高频易噪声）。
- 非 H5 平台条件编译隔离。

## 验证

- 本地 lint/vitest/build:h5 全绿。
- 生产 1440/375：live region 在位；触发 toast（如练习页复制/时间到）后 region 文本同步；刷题作答后 region 出现对错通报；console 0 error、溢出 0。
