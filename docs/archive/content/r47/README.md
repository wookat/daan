# 轮47：发现线例行（轮46线上复验 + Flutter parity 补课 + 健康快扫/数据例行）

分支：`devin/1786301528-r47`（自 main c6f3187 切出）。本轮代码改动仅 Flutter 端 4 个文件；后端/H5/小程序零变更，生产零部署。

## 1. 轮46 变更线上复验（全部通过）

测试 UID `t_r47_devin`，验证完成后已在容器库按 UID 守卫清理（mistakes/reminder_prefs/growth_events 残留 0）。

### 1.1 提醒接口 /api/reminders
- POST 登记（wxsub, hour=20）→ 200；GET 查询返回 `{channel:'wxsub',enabled:1,hour:20}`，不含任何敏感字段。
- UID 隔离：跨 UID 查询为空（轮46已验，本轮复核通过）。

### 1.2 H5 打卡横幅触发条件（生产实测，Playwright + 时钟覆写至 19 点）
- 满足「当日未练 + ≥18点 + 有历史学习记录（pstats.days 有值）+ 当天未展示」时横幅出现，文案「今天还没打卡 / 练 1 题即可保住连续打卡…」。
- 点 ✕ 关闭即消失；`reminderShown` 写入当日 key，刷新后不再出现（每日一次去重生效）。
- 新用户（无 pstats 历史）不展示——首次未注入历史数据时横幅未出现，即为该分支验证。
- 实现不依赖 Web Notification API，纯页面横幅，无浏览器兼容问题。

### 1.3 错题复习选项文本
- 造错题后 `/api/mistakes?uid=…` 与 `/api/review?uid=…` 均带回完整 `options` {A,B,C,D}（联查 questions 表）。
- options 缺失/非法时后端 `_parse_options` 返回 null，前端降级为字母（轮46已验，接口行为本轮复核一致）。

### 1.4 收藏 Tab
- POST /api/favs → 200；GET 返回结构使用 `id`（=question_id）与 `module`；DELETE /api/favs → 200 后列表为空。未影响其他 UID。

## 2. Flutter parity 补课（轮44-46 新能力）

| 能力 | 检查结论 | 处置 |
|---|---|---|
| 迷你模考报告薄弱考点卡 | 已有（r38 复刻，exam_report_page 含 weak_tags 卡+去练入口） | 无需改动 |
| 分享文案 A/B | 缺失：分享文案固定、链接无 v 参数、无分桶归因 | 本轮补齐 |
| 打卡提醒 | 已有更强实现：flutter_local_notifications 每日本地定时通知（reminders_page 开关+时间），无需 H5 式横幅 | 补 reminder_optin 埋点 |
| 错题复习选项文本 | 部分缺失：复习模式仅靠从 question_text 启发式拆选项，未用 r46 起 /api/review 回带的 options | 本轮补齐 |

本轮 Flutter 改动（4 文件）：
- `core/api.dart`：新增 `shareVariant()`（与 H5 同款 uid 31 进制稳定哈希，a/b 分桶）与 `qShareText(mod, sid)`（a 好奇型 / b 挑战型文案，链接带 `&v=a|b` 供 H5 落地页 share_a/b 归因）。
- `pages/practice_page.dart`：
  - 「分享给队友」改用 `qShareText`，share_copy 埋点 source 改为 `qbar_a|qbar_b`（对齐 H5 q-social-bar 口径）；
  - 结算页「分享战绩」补 `share_result_copy` 埋点（source=practice）；
  - 复习队列构造 `_questionFromMistake` 优先使用后端回带的 `options`，缺失时仍回退 question_text 启发式拆分，双缺时保持字母作答。
- `pages/share_q_page.dart`：复制分享链接改用 `qShareText`（原固定文案+无 v 参数），移除本页无用常量。
- `pages/reminders_page.dart`：开启提醒时上报 `reminder_optin`（source=app，已在 /api/track 白名单）。

`flutter analyze`：**No issues found**。

说明：Flutter 提醒为设备本地通知，不涉及后端 reminder_prefs（channel 白名单为 wxsub/web，无需为本地通知登记服务端偏好）；未伪造任何微信订阅消息。

## 3. 全站健康快扫（生产只读，全部达标）

- active（disabled=0）：**112,962**（与轮46一致）
- hs 结论字母一致性（`答案[为是选]…[A-D]+` 尾部 vs answer）：**0 不一致**
- options 非 JSON：**0**
- `(cid:` 乱码：**0**
- 空 hs：仅 2 条已知存疑台账题 `changshi:655861`、`panduan:334296`

## 4. 数据例行（自然样本，照实报；本轮测试数据已清理不计入）

- 近 7 天作答：38 次 / 13 uid；近 14 天：752 次 / 17 uid（大头仍是 8/1-8/2 重度用户）。
- 分享 A/B 相关事件累计（growth_events 全量）：
  - share_open：4（share×3、qa×1，均无 v 归因，属 A/B 上线前旧链接）
  - share_answer：2（share）；share_copy：1（share_q）；share_result_copy：0
  - `share_a/share_b/qbar_a/qbar_b/book_a/book_b` 归因样本：**0**（A/B 上线仅 3 天且流量低，无自然分享发生）
- reminder_optin：**0**；reminder_banner_click：**0**（轮46昨日上线，尚无自然样本）
- comeback_view：1（home）；review_entry_click：0
- access log：周报 cron 在位（周一 UTC0），首份周报已产出。当前日志窗口仅约 2 小时 280 条（多为自测 curl/python；/tiku/ 34 次、真实搜索引擎爬虫 0）——日志再次被截短，与 r43 发现的同机 Caddy 重载导致轮转重建一致，属已知环境现象，趋势观测继续以周报累计为准。

## 5. 下一批建议（轮48 候选）

1. **获客仍是最大瓶颈**：自然 uid 个位数、爬虫 0。建议推进站长平台验证（Bing WMT/百度站长，需老板账号/DNS 授权）+ 小程序提审上架（需 AppID）。
2. **A/B 结论待流量**：分享 A/B 三端已对齐，等自然样本积累后出首份漏斗对比（share_copy→share_open→share_answer 按 a/b）。
3. **Flutter 发版**：本轮 parity 改动随下次 APP 构建生效，可安排一次 APK 构建冒烟。
4. **access log 持久性**：Caddy 他项目重载会重建日志，可评估把轮转文件纳入周报聚合（cron 脚本已兼容轮转，主要是确认历史窗口不丢）。
5. 微信订阅消息开闸依赖（AppID+模板 ID）与 LLM key/ACCESS_CODE 补发仍待老板资源。

## 6. 环境限制与未尽事项

- 小程序端本轮无改动，未跑 tsc/eslint（无需）；微信开发者工具无 Linux 版，真机 GUI 走查持续遗留。
- Flutter 改动为静态分析验证（analyze 0 告警）+ 与 H5 实现逐行对照，未做真机运行验证（本机无 Android/iOS 运行环境）。
- LLM 凭据仍缺失，AI 功能保持降级；未新增任何 AI provider 或分发渠道。
