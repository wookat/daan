# 轮46：r45 P2 消化 + 留存基建（订阅消息可降级 + H5 打卡提醒兜底）

- 分支：`devin/1786297925-r44`（PR#111 追加提交）
- 部署：`deploy/deploy_h5.sh` 全流程通过（本机/线上 bundle 一致 `index-Oz4likn-.js`，7 项接口回归全 200）

## 1. r45 P2 逐项处置

| # | P2 项 | 处置 |
|---|-------|------|
| 1 | 错题复习模式只显示 A-D 字母、无选项文本 | 已修。后端 `list_mistakes`/`due_reviews` LEFT JOIN questions 带回 `options`（`_parse_options` 容错解析），小程序复习卡有文本时纵向展示「A. 选项文本」，无文本降级回字母（老数据兼容）。线上 `/api/mistakes`、`/api/review` 实测返回 options |
| 2 | 收藏 Tab 只展示题面、无操作 | 已修。收藏卡增加「去练同模块」（跳转练习页带 module）与「取消收藏」（调已有 `DELETE /api/favs`，成功后刷新列表）。修正前端 `FavItem` 主键为 `id`（后端 /api/favs 返回完整题目字段） |
| 3 | 模考 Tab 真题卷全部「二期开放」点击无反馈 | 已修。点击卷条目 toast「「XX卷」全真模考二期开放，可先试迷你模考」，明确预期并引导现有功能 |
| 4 | 统计页本机/服务端口径不清 | 已修。热力图下注「热力图为云端口径（练习/模考作答，多端同步）」，分模块正确率标题加「（本机）」并注「仅统计本设备作答记录」 |
| 5 | 首页错题复习任务 dueLoaded 前短暂显示加载态 | 已修。小程序与 H5 首页任务卡加载完成前文案改为「按遗忘曲线安排」（中性描述），不再闪「加载中…」 |
| 6 | 微信开发者工具真机 GUI 走查 | 无法修：当前开发机为 Linux，微信开发者工具无 Linux 版。本轮小程序改动继续以 tsc+eslint+生产 API 契约实测+源码走查代替，真机 GUI 走查仍需 Windows/macOS 环境（遗留） |

## 2. 留存 P1：订阅消息触达基建（可降级）

无 AppID/模板 ID，本轮不做真实发送，只建「开闸即用」的基建：

- 后端新增 `reminder_prefs` 表（uid+channel 主键、enabled、hour、updated_at，UID 隔离），接口：
  - `POST /api/reminders`（channel ∈ {wxsub, web}，enabled/hour 校验，关闭=enabled:false）
  - `GET /api/reminders?uid=`（仅返回该 uid 的偏好）
  - 线上实测：登记/查询/关闭均 200，跨 uid 查询隔离正常（测试数据已清理）
- 小程序「我的」页新增「学习提醒」入口：
  - 模板 ID 常量 `SUBSCRIBE_TMPL_ID` 留空 = 降级态：仅登记提醒意向（channel=wxsub, hour=20），toast 明示「订阅消息上线后自动生效」
  - AppID/模板审核通过后填入常量即开闸：真实走 `wx.requestSubscribeMessage` 授权，拒绝授权时仍登记意向不阻塞
  - 再次点击 = 关闭提醒；埋点 `reminder_optin` 已入 /api/track 白名单
- 开闸剩余工作（AppID 到位后）：填模板 ID、服务端加定时下发任务读取 reminder_prefs 调微信 subscribeMessage.send（需 access_token 凭据，不入库不入代码）
- H5 兜底：首页每日打卡提醒横幅——当日未练 + 18 点后 + 有历史学习记录（新用户不打扰）时展示一次/天，「去刷题 ›」直达每日一练（埋点 `reminder_banner_click`），可关闭，不阻断核心路径。不支持 Notification/权限问题不影响（未用 Web Notification API，纯页面横幅，兼容性最好）

## 3. 部署与三端构建

- `deploy_h5.sh`：构建→.env 预检→rsync（排除 .env）→容器重建（ADMIN_TOKEN 注入校验）→bundle hash 一致→7 项回归全 200
- 小程序：`npx tsc --noEmit` + `npx eslint . --quiet` 通过
- Flutter：`flutter analyze` No issues（本轮无 Flutter 改动，复跑确认）
- 后端 ruff：新增代码 0 告警（仓库存量 17 条为历史代码，未动）

## 4. 健康快扫（生产库）

- active：112,962（与轮42后一致）
- hs 尾部结论字母不一致：0；options 非 JSON：0；`(cid:` 乱码：0
- 四模块 hs 空缺：changshi 1（655861）+ panduan 1（334296）= 仅剩 2 条已知存疑台账题，其余为 0

## 5. 遗留与下一步

- 微信开发者工具真机 GUI 走查：环境限制持续遗留（需 Windows/macOS）
- 订阅消息开闸依赖老板提供 AppID + 模板 ID + 小程序凭据；LLM key/ACCESS_CODE 仍待补发（AI 功能保持降级）
- 建议下一轮：H5 提醒横幅/小程序提醒入口首批数据复盘；服务端下发任务（等 AppID）
