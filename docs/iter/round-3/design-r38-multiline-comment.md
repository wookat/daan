# R38 设计方案：讨论评论多行支持（textarea 输入 + 换行渲染）

## 现状取证（2026-08-29）
- discuss.vue 输入栏是单行 `<input>`（.ipt 固定 72rpx 高、confirm-type=send）：无法换行，长解法（分步推导）只能挤成一行，H5 桌面回车即发布容易误发半截内容。
- 列表侧 `.tx`/`.reply` 直接插值渲染，无 `white-space: pre-wrap`——即使后端存了换行（API 直发可带 \n），前端也会折叠为空格。
- 后端 social.py 对 content 仅 strip + 长度校验（≤500），天然支持多行，无需后端改动。
- 竞品惯例（粉笔评论区）：多行输入框、换行原样展示，长解法分步排版是题目讨论的核心场景。

## 差距定级
P1（功能深度/UGC 质量）：解题讨论以「分步推导」为主要形态，单行输入压制长评论质量。

## 方案（仅改 discuss.vue）
1. `<input>` → `<textarea>`：auto-height + max-height 封顶（约 5 行）避免顶满屏；保留 v-model/draft、maxlength=500、:focus=autoFocus（R36 直达聚焦保持）、@focus=ensureLogin；发布仅走「发布」按钮（多行场景回车=换行，符合惯例）。
2. `.ipt` 样式改为多行形态：min-height 72rpx、max-height 封顶、padding 调整、border-radius 收敛（胶囊→圆角矩形）。
3. `.tx` 与 `.reply` 增 `white-space: pre-wrap`（保留换行与连续空格，长词 break 已有 min-width:0 保护）。

## 不做
- 富文本/图片评论；@提及；后端改动。

## 验收
- build:h5 通过；生产：输入框可换行且随内容长高（有封顶）、发布后列表按换行原样展示、回复同理；R36 focus=1 自动聚焦回归；1440 console 0 error、375 输入栏无溢出；游客登录引导回归。
