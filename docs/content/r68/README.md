# 轮68：小程序代码级走查 + Flutter 构建复验 + 例行观测

日期：2026-08-09 ｜ 分支：devin/1786315936-r67（PR#116） ｜ 环境说明：Linux 无微信开发者工具，小程序按「代码审查 + 生产 API 冒烟」口径走查。

## 1. 小程序 QA/UX（第 1 项）

### 1.1 构建健康

- `npm run typecheck`（tsc --noEmit）：0 错误。
- `npm run lint`（eslint miniprogram --ext .ts）：0 错误。

### 1.2 新用户首次打开视角逐页面代码走查（10 页面 + utils，共 2,364 行 TS）

| 页面/模块 | 走查结论 |
|---|---|
| app / utils/auth | 匿名 uid 首次生成并持久化；登录合并/退出回退 deviceAnonUid 逻辑闭环 |
| utils/request | X-Access-Code/Bearer 头、401 仅登录态失效才踢登录、访问码弹窗重试一次——与 H5 api.js 对齐 |
| home | 首开无画像时任务卡/连签/到期复习均安全降级（catch 静默、本地 streak 兜底）；六模块入口/直链参数正确 |
| practice | 首开抽题失败有 toast+返回；作答先标记 `_logged` 再上报防重复；中途退出 onUnload 补报；错题落库失败可重试 |
| book | 错题/到期复习/收藏三源并行加载各自降级；autoStartReview 一次性消费；答错复习题重入队一次 |
| exam / mini / report | 迷你模考计时到点自动交卷有 submitting 防重入；退出确认 enableAlertBeforeUnload；报告页薄弱考点直链 tag3 正确 |
| stats | 热力图服务端 answer_log 口径、失败降级本机 pstats（有口径差异标注） |
| profile | 提醒开关未配置订阅模板时降级为登记意向（阶段性设计，非缺陷）；徽章墙服务端口径 |
| login | 手机号/密码前端校验；登录后匿名记录合并失败不阻断 |
| share / team / panel / poster / pk-result | sid 无效有错误态；一键入队防重；海报画布无 DOM 依赖 |

**P0/P1：无。** P2 清单（不影响新用户主路径，暂不动）：

1. practice「再练一组」onRetry 固定走普通抽题，从错题重做（mode=redo）进入后重试会切回普通题源；
2. book 复习作答 `extractLetter` 仅识别单字母 A-D，多选/含 E 选项错题只能走「自我判定」分支（现库多选错题极少）；
3. exam 列表页真题卷点击仅 toast「二期开放」，新用户无预期管理文案入口（与 H5 一致，二期统一处理）。

### 1.3 生产 API 冒烟（首开链路全部端点）

以全新 uid 冒烟 12 个端点（questions/带模块抽题/mistakes/review/favs/reminders/profile/plan/checkin summary+badges/papers/team mine）：**全部 200**。

## 2. Flutter 复验（第 2 项）

- `flutter analyze`：No issues found。
- `flutter build apk --debug`：构建成功（app-debug.apk 产出正常）。

## 3. 爬虫/数据例行 + 健康快扫（第 3 项）

- 爬虫（当日归档 access-20260809.jsonl，1,537 行）：bot 59 次 = YandexBot 58 + bingbot 1；其中 57 次命中 /tiku/y 年份页——Yandex 对年份页持续到访，与 r66 观测一致。归档窗口仍只有 1 天（同机 Caddy 重载 caveat 延续）。
- 数据例行（近 7 天）：作答 39 次 / 14 uid；source=seo 归因（14 天）0；growth_events：share_open 5、share_answer 3、heatmap_view 4、comeback_view 1、task_card_click 1、reminder_optin/review_entry_click/badge_unlock 0。
- 健康快扫全绿：active 112,962；options 非 JSON 0；`(cid:` 乱码 0；hs 一致性 0；空 hs 仅 2 条台账题（panduan:334296、changshi:655861）；active `<50` = 0。

## 4. 下一轮建议

1. 站长平台验证仍是 P0（需老板资源）。
2. 小程序提审前置项（AppID/订阅模板）到位后回填 `SUBSCRIBE_TMPL_ID` 并真机回归。
3. P2 三项待流量/提审节奏合适时顺手消化。
