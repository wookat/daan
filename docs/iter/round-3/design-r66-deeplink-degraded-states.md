# R66 设计：深链降级态收敛——无参/坏参页面不再卡死或直出 [object Object]

## 一手证据（2026-08-30 生产实测，Playwright CDP 375×812）

对全部带必选参数的路由做无参直链走查（模拟用户从外部/历史收藏进入的坏深链）：

| 路由（无参直链） | 生产表现 | 判级 |
| --- | --- | --- |
| `#/pkgA/exam/contest-report` | 页面直出 **`[object Object]`**（console 1 条 4xx） | P1 |
| `#/pkgA/exam/exam` | 永久「试卷加载中…」卡死（console 2 条 4xx；toast 后 `navigateBack()` 在无历史栈的 H5 新标签页静默失败） | P1 |
| `#/pkgA/social/discuss` | toast「缺少题目参数」一闪后永久「加载中…」卡死（loading 初始 true 从未复位） | P2 |
| `#/pkgA/exam/report` | ✅ 已有友好空态+「去卷库」CTA（对照组） | — |
| `#/pkgA/share/pk-result` | ✅ 「战绩链接无效」（对照组） | — |
| `#/pkgA/share/share-q` | ✅ 「分享链接无效」（对照组） | — |

`[object Object]` 根因：`/api/mock/events/undefined/report` 返回 FastAPI 422，`detail` 为**校验错误对象数组**，api.js 直接 `new Error(detail)`，数组 toString 即 `[object Object]`。这属于全局问题：任何页面收到 422 都会透出同样的乱码文案。

R60 的未匹配路由兜底只覆盖「路由不存在」，不覆盖「路由存在但缺必选参数」；R65 收敛了海报/收件箱降级态，本轮把剩余三个坏深链卡死点收口，向对照组页面（report/pk-result/share-q）的既有友好空态模式对齐。

## 方案

1. **api.js（全局）**：非字符串 `detail`（422 校验数组等）不再透传，回退 `HTTP <status>`：
   `const detail = typeof res.data?.detail === 'string' ? res.data.detail : '';`
2. **contest-report.vue**：`onLoad` 先判 `event_id`，缺参直接置友好 err 不发请求；err 态复用 report.vue 空态样式：标题「暂无大赛报告」+ 说明 + 「去模考大赛」CTA（reLaunch contest）。
3. **exam.vue**：`start()` 失败分支 `navigateBack()` 改为 `navigateBack` 失败/无历史栈时 `reLaunch` 到卷库 `exam/list`（H5 新标签页深链场景），并把 spinner 换成错误文案避免视觉卡死窗口。
4. **discuss.vue**：缺 qid 时不再只 toast，置 `loading=false` + err 空态（「链接缺少题目参数」+「去讨论广场」CTA reLaunch plaza），输入栏隐藏。

不改后端、不加依赖；错误态样式复用各页既有 empty/spin class。

## 验证

- 生产坏深链复验：三条路由 375/1440 均出现友好空态/正确回跳，无 `[object Object]`、无永久 spinner。
- 回归：正常带参路径（真实开考、赛后报告、讨论页）全流程不受影响；422 以外错误文案（如「分享不存在」）不变。
- console 0 error（除后端本身的 4xx 网络行，属预期）；无横向溢出。
