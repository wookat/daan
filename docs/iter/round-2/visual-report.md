# 视觉走查报告 · 轮 2

日期：2026-08-06 ｜ 范围：网页端（kaogong.zalize.com，375/1440 × 浅色/深色）+ Flutter APP（Android 模拟器）
对照：docs/design-v3/DESIGN.md 设计 token、docs/design-benchmark/report.md P1/P2 清单、docs/iter/round-1/visual-report.md

截图目录：`screenshots/`（web-m-* 移动端 375px，web-d-* 宽屏 1440px，*-dark-* 深色；app-* 为模拟器截图）；标注图：`annotated/`。

---

## 一、已实施（本 PR，纯样式）

### W1（P0）深色模式页面背景失效，全站区块标题不可见
- 现象：深色模式下卡片是深色，但页面底（uni-page-body）仍是浅色 `#f6f7fb`，浅色文字的区块标题（首页「专项练习/更多练习」、我的页「学习/偏好设置/其他」等）落在浅底上完全不可见。见 `annotated/web-m-dark-home-anno.png`、`annotated/web-m-dark-profile-anno.png`。
- 根因：uni-app H5 编译会把 `page` 选择器展开出一份**裸 `body` 规则**（丢失 `.theme-dark` 前缀）。原 `.theme-dark page { …vars }` 没带背景色，同时 `.theme-dark body` 又被编译出裸 `body{background:#15161c}` 副本——反过来把**浅色模式**（尤其宽屏）的 body 染成深色（轮 1 报告已记录该桌面浅色模式黑底问题，本轮定位到根因）。
- 修复（frontend-uni/src/App.vue）：
  ```css
  /* 之前 */
  .theme-dark body { background:#15161c }
  .theme-dark page { …dark vars… }          /* 无背景，且编译出裸 body 副本 */
  /* 之后：直接写编译目标元素，绕过 page/body 选择器改写 */
  html.theme-dark body { background:#15161c }
  .theme-dark uni-page-body { background:#15161c; …dark vars… }
  ```
- 验证：本地 build:h5 后编译产物只剩 `body{background:#f6f7fb}`、`html.theme-dark body{…}`、`.theme-dark uni-page-body{…}` 三条，无裸深色 body 规则；截图对比见 annotated/ 与 PR 描述。

### W2（P1）宽屏（≥768px）首页双栏失衡
- 现象：`.modlist` 占左列、`.more-grid` 占右列，但两者之间隔着全宽的 `.sec-h`（更多练习标题），grid 自动布局把 more-grid 挤到 modlist 之后的新行右列，导致右列上方约一屏空白、更多练习悬在右下。见 `annotated/web-d-home-anno.png`。
- 修复（pages/home/home.vue 媒体查询内，纯 CSS）：modlist 改为全宽两列网格（智能刷题卡跨双列），more-grid 改为全宽四列。列宽均衡、无空洞，与 design-v3「桌面≥768px 多列布局」一致。

### F1（P0）Flutter 7 个页面静态色 token 不随主题，深色模式白底/低对比
- 现象：ask/home/pk/search/exam_report/favorites/shizheng 共约 200 处直接引用 `KgColors.t1–t4/border/fill/successBg/errorBg/warningBg/brand50`（浅色常量），深色模式下出现白色分隔条、浅灰文字压深底、浅蓝答案卡刺眼等（轮 1 已修 5 处核心组件，本轮扩大到页面级）。
- 修复：机械替换为语义色 `context.kg.*`（brand50→brandBg，ask 页 1 处 brand100 边框→border），并去除受影响表达式的 `const`。不改任何布局/字号/逻辑。
- 验证：`flutter analyze` → **No issues found**；模拟器深色模式前后对比截图见 annotated/。

---

## 二、发现但仅列清单（功能/结构类，本轮不实施）

| 编号 | 页面/端 | 问题 | 建议 | 级别 |
|---|---|---|---|---|
| L1 | H5 练习页 | 深链 `pages/practice/practice?module=…` 冷启动时长时间停留「正在准备练习…」（见 web-m-practice.png），无骨架屏/超时重试 | 加载骨架 + 失败重试态 | P1·功能 |
| L2 | H5 统计页 | 数据口径不一致：顶部「学习统计」为 0/0%/0，下方「能力预测分」却显示基于 60 题作答；五模块雷达仍是「还没有能力数据」空态 | 统一取数口径；有作答即出雷达 | P1·功能 |
| L3 | H5 统计页 | 「高频错题型 TOP10」只有「未分类×21」，信息量为零 | 错题保存时带上题型标签 | P2·数据 |
| L4 | H5 错题本 | 列表每行都是「点开看答案与详解」折叠行，重复度高、单屏信息密度低（粉笔错题本直接预览题干首行+错误选项） | 折叠行内显示题干摘要 | P2·结构 |
| L5 | H5 AI问答 | 空态只有一句说明文案，插画风格与整体线性图标不统一 | 统一插画风格 + 提供示例问题 chips | P2·资源 |
| L6 | H5 真题卷列表 | 卡片全部同构（名称+年份+题数），无进度/得分/状态区分，长列表密度低（web-m-exam-list.png） | 卡片加做题进度条与上次得分角标 | P2·结构 |
| L7 | H5 深色 | wot-design-uni 弹层（ActionSheet/MessageBox）内部仍是浅色变量，与自定义深色卡片切换突兀 | 补齐 --wot-* 深色变量映射 | P2·样式（涉及组件库变量面较广，留下轮） |
| L8 | 双端 | 首页「今日建议」列表行/主攻 chips 与粉笔相比缺少完成态勾选反馈，练完不消项 | 建议项完成后置灰/打勾 | P2·功能 |

## 三、与粉笔观感差距（重点条目）

1. **进度可视化**：粉笔在模块行、卷子卡、日历格上都有明确进度/正确率色带；本产品模块行进度条常为空灰（0 数据时不显示占位），卷列表完全无状态。→ L6。
2. **空态设计**：粉笔空态有品牌插画 + 引导按钮；本产品统计雷达/AI问答空态偏文字化、占位大而信息少。→ L2/L5。
3. **深色模式完成度**：粉笔深色下分组背景、弹层、图表全套换色；本产品本轮修掉页面底与页面级 token 后，剩余差距集中在 wot 弹层与图表配色。→ L7。
4. **信息分层**：粉笔首页第一屏即「继续学习」强 CTA + 学习数据；本产品英雄区已有今日进度，但下方「制定学习计划」「今日建议」「公告」「时政」四条横幅连排，视觉权重相近、层级扁平。建议后续按「主 CTA > 建议 > 公告」重排（结构类，未实施）。

## 四、验证记录

- `npm run build:h5`：成功（dist/build/h5），并人工核对编译后 CSS 的 body/uni-page-body 规则。
- `flutter analyze`：No issues found（0 error 0 warning）。
- 本地 dist 截图（375 深色 / 1440 浅色）确认 W1/W2 修复效果；线上前后对比截图见 annotated/ 与 PR 描述。
- Flutter 模拟器（Android x86_64, bench30）深色/浅色逐页截图见 screenshots/app-*。
