# R65 设计：降级态 UX——海报页错误重试 + 消息收件箱游客登录引导

## 一手证据（2026-08-31 生产走查）

1. 打卡海报页（pkgA/social/poster）在 /api/checkin/summary 双超时（R64 实测冷路径 125s/62s）时，页面直出原始错误文案 `request:fail timeout`，无任何重试路径——用户只能手动刷新。
2. 讨论消息收件箱（pkgA/social/inbox）游客/登录过期访问：/api/comments/inbox 返回 401（console 实测），页面 toast 一次「登录已过期」后落到「暂无消息」空态——误导用户以为没有消息，而非需要登录。

## 方案

### poster.vue
- 错误态：timeout/网络类错误映射为友好文案「网络不给力，打卡数据没取到」，并新增「重新生成」按钮（重置 loading/err 后重跑 build()）。

### inbox.vue
- onShow 先判 getToken()：未登录不再发 401 请求，直接渲染登录引导空态（🔐 登录后查看消息 + 去登录按钮，跳 pkgA/user/login）；已登录逻辑不变。

## 验证

- build:h5 + 部署后生产走查：游客访问 inbox 无 401 请求、显示登录引导；poster 正常路径海报生成不回归；拦截 summary 请求模拟失败时显示友好文案+重试按钮，放行后重试成功。1440/375 双视口、console 0 error、无水平溢出。
