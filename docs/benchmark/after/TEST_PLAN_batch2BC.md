# 批次2·B/C 生产验证计划 (PR #163, bundle index-BlHAb__Y.js)

环境：https://kaogong.zalize.com 生产站。SW 缓存已知风险：先核对 performance resources 里 index chunk hash == BlHAb__Y，不一致则 SW update + Ctrl+Shift+R。
视口：375×667（CDP Emulation.setDeviceMetricsOverride 常驻 ws daemon）与 1440×900（新标签页/桌面窗口）。
Console：每屏用 CDP Runtime/Log 收集 console error（区分 SW/第三方 nav.js 警告）。
数据红线：不删除任何已有错题/记录；只做浏览与少量正常做题。

## T1 P0-1 刷题直达（375 与 1440）
直接打开 /#/pages/practice/practice（无参数，强刷绕过 SW）。
- PASS: 立即出现骨架屏（题干+选项占位块动画）+ 秒级提示文案（出题中… → 超3秒变「题库首次加载稍慢…（N秒）」）+「返回首页」，随后自动进入答题（题干+ABCD 选项出现），不停留在旧版「正在准备练习…点此返回首页」死等。
- 截图 after-practice-loading-375/1440.png（骨架屏瞬间；若加载太快截答题态并注明）。
- 附加：做 2-3 题验证判分/自动跳题正常（数据可保留）。
- 失败面板（尽力而为）：CDP Fetch 拦截 *api/questions* failRequest 后 retryStart，应出现「题目加载失败」+ 重试/返回首页按钮；点重试恢复。此步只在 375 做。

## T2 P0-2 AI 拍题相机优先（375 与 1440）
底部 Tab「AI 拍题」（无结果空态）。
- PASS: 深色取景屏：四角蓝色取景框、提示「将题目放入框内拍下，AI 讲给你听」、模式行「拍单题(高亮)/整页批改·即将上线(灰)/文字输入」、快门圆键、左「相册」右「面试」、右上「历史」「错题」chip。
- 点快门：应立即触发文件选择（桌面 Chrome 弹系统文件选择框=预期，capture 回退）。用 window.showOpenFilePicker 不适用——直接观察弹框截图后 Esc 取消。
- 截图 after-ask-camera-375/1440.png。

## T3 P0-3 桌面 1440 限宽
1440×900 视口打开首页。
- PASS: 应用壳 max-width 1140px 居中（getComputedStyle(uni-app).maxWidth=='1140px'，两侧对称留白可见），208px 侧栏在壳内左缘（非视口左缘），document.documentElement.scrollWidth <= 1440（无横向滚动条）。
- FAIL if 内容满宽贴视口左缘或出现横向滚动。

## T4 P1 首页（375 与 1440）
- PASS: 搜索栏左侧有考试切换 chip（如「行测」/考试名），模块行右侧显示 done/total 进度数字（形如 12/300）。
- 截图 after-home-375/1440.png。

## T5 P1 错题本 FAB（375 与 1440）
Tab「错题本」。
- PASS: 右下角「＋」浮动按钮；点击展开出现「扫描答题卡」「手动录入」两项；再点收起。不点击其内部功能（避免写数据）。
- 截图 after-book-fab-375/1440.png（展开态）。

## T6 P1 统计页未登录顶条（375 与 1440）
Tab「统计」（匿名未登录态）。
- PASS: 顶部为轻量登录提示条（单行小条）而非大卡片。
- 截图 after-stats-375/1440.png。

## T7 P1 全真模考列表（375 与 1440）
首页进入全真模考列表（#/pkgA/exam/list）。
- PASS: 试卷卡片显示「N 人考过」；paper id=5 的卷显示「2 人考过」。
- 截图 after-exam-list-375/1440.png。

## T8 Console error 汇总
每屏切换后读取收集到的 console errors。
- PASS: 每屏 0 个 error 级消息（SW/nav.js 警告单列，不计失败）。T1 故障注入步骤产生的网络 error 不计。

产物：12+ 张截图存 docs/benchmark/after/，全程录屏。
