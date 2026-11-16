# R98：真 Web Push 每日一练提醒（页面关闭也可达）

日期：2026-08-31 · 状态：设计→实现

## 取证

1. 现有「学习提醒」（pkgA/settings/reminders.vue + reminder.js）是页面内 `Notification` 轮询，自我声明「仅在页面保持打开时生效」——页面一关即失效，与竞品原生 App 推送存在代差；留存钩子（每日一练/打卡 streak）没有可达通道。
2. R96/R97 取证已实证当前真实 DAU 极小、boot 24h=0：把「已到访过的用户拉回来」是获客通道（owner 资源未到位）之外唯一可自建的增长杠杆。
3. PWA 基建已就绪：manifest（R54）+ 安装入口（R57/R58）+ sw.js v4（R71），加 push/notificationclick 处理即可。

## 方案

后端（backend/app/push_api.py，新文件）：
- 依赖 pywebpush（Web Push 标准库，VAPID 签名），加入 deploy/Dockerfile.runtime。
- 配置走生产 .env：`KG_VAPID_PRIVATE`（DER base64url EC P-256 私钥）、`KG_VAPID_PUBLIC`（uncompressed point base64url，即 applicationServerKey）、`KG_VAPID_SUB`（mailto:）。未配置时接口返回空 key、订阅 503，前端隐藏入口——零配置环境零影响。
- 表 `push_subs(endpoint PK, uid, sub_json, created_at)`。
- `GET /api/push/pubkey`；`POST /api/push/subscribe {uid, sub}`；`POST /api/push/unsubscribe {endpoint}`。
- 发送线程（main.py 既有 daemon-thread 模式）：每 300s 检查，中国时区 hour==8 且 seo_meta `push_last_day` != 今日 → 向全部订阅发「今日全站同题 10 题已更新」url=/?daily=1；410/404 清除失效订阅；已完成今日每日一练的 uid 跳过（daily_set_entries 查询）。

前端：
- sw.js：`push` → showNotification(payload)；`notificationclick` → focus 已开窗口或 openWindow(url)。
- reminders.vue：新增「离线推送」开关（仅 `'PushManager' in window` 且 pubkey 非空时渲染）：requestPermission → pushManager.subscribe(applicationServerKey) → POST subscribe；关闭时 unsubscribe 双端。

## 边界（如实）

- iOS Safari 需「添加到主屏幕」后才支持 Web Push（16.4+），普通浏览器 tab 不支持——设置页文案注明。
- 微信内置浏览器不支持，开关不渲染。
- 推送到达率受浏览器/系统策略影响，非保证送达。
- 08:00 发送窗依赖容器该时段存活（autoheal 已兜底）。

## 验收

- 本地：ruff + uvicorn 实跑订阅/退订/pubkey；pywebpush 对 Chrome 真实 FCM endpoint 实发实收。
- 生产：VAPID 配置入 .env → 部署 → CDP 真浏览器完整链路（开开关→订阅落库→触发一次实发→通知弹出→点击落 /?daily=1）→ 测试订阅清理。
