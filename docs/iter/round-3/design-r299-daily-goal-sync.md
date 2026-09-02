# R299 设计：每日刷题目标 dailyGoal 服务端化

## 取证（SOP-10 四维复审计 + 源码）

四维复审计（R298 后重扫）：

- 操作台/桌面：R276–R294 已把筛选态 URL 化、报告复盘工作台化，无新的桌面级结构缺口。
- 核心功能深度：模考闭环（R281–R290）与申论深度（R291–R297）已收口；剩余深度缺口集中在「账号资产服务端化」尾巴。
- 落地页/首页：首页目标卡、进度条、任务卡、打卡风险卡全部依赖 `dailyGoal`，但该值是纯本机 storage。
- 移动 IA/跨设备：R296（申论收藏）/R297（申论草稿）/R298（模考进度）之后，`dailyGoal` 是最后一个影响首页主视觉的纯本机个性化资产。

源码取证：

- `home.vue`：`dailyGoal: uni.getStorageSync('dailyGoal') || 20`；`setGoal(g)` 只写本地；目标卡/进度条/每日任务/打卡风险均消费该值。
- `profile.vue`：`cycleGoal()` 在 20/50/100 间轮换，只写本地；`loadRemote()` 已拉 `/api/profile` 但不同步目标。
- `practice.vue`：完成页目标 chips `setGoal(g)` 只写本地。
- `stats.vue`「清理本地数据」会删本地 `dailyGoal`——清理后应能从服务端恢复（跨设备语义的自然结果）。
- 后端 `user_profile` + `/api/profile`（GET/POST，字段白名单 `PROFILE_FIELDS`）现成；`user_profile` 已在 `_UID_PK_TABLES`，匿名登录归并天然覆盖新列。
- 竞品口径：粉笔的每日目标是账号级设置，跨端一致。

## 问题定义

每日刷题目标只存本机：清缓存、换设备、跨浏览器后回落默认 20 题，首页目标卡/进度/打卡风险口径随设备漂移；三个设置入口（首页/个人页/练习完成页）各自为政没有账号级权威值。

## 方案（复用 /api/profile，零新端点）

### 后端

- `user_profile` 增列 `daily_goal INTEGER`：`_ensure_user_profile` 用 `PRAGMA table_info` 幂等补列（生产旧库无需重建）；`PROFILE_FIELDS` 增 `daily_goal`；INSERT 路径带上该列。
- `POST /api/profile` 校验：`daily_goal` 键存在时，`None` 允许（清除）；否则必须是产品档位白名单 {20, 50, 100} 中的整数（显式拒绝 bool——Python 中 bool 是 int 子类），浮点/字符串/越档整数一律 400：三个页面的目标 UI 只提供这三档，服务端不静默持久化任意整数，档位演进时前后端白名单同步更新。
- `GET /api/profile` 经 `SELECT *` 自然返回新列，零改动。
- 匿名归并：`user_profile` 已在 `_UID_PK_TABLES`，行级归并自动带走 `daily_goal`。

### 前端

- 纯函数 `src/daily-goal.js`：
  - `DAILY_GOALS = [20, 50, 100]` 共享档位白名单（home/profile/practice 三页同一口径）；
  - `normalizeDailyGoal(v)`：仅数字类型且命中档位 → 该值，其余（数字字符串/浮点/布尔/越档整数）→ null；
  - `adoptServerDailyGoal(localGoal, profile)`：服务端目标合法且与本地不同 → 返回服务端值；缺失/非法/相同 → null（保留本地）；不修改输入。
- `home.vue`：`applyBundle`（home_bundle 已含 profile）与 `loadProfile` 回退路径均 adopt 服务端目标并回写本地；`setGoal(g)` 本地即时生效 + fire-and-forget `POST /api/profile {daily_goal}`（失败静默不阻断）。
- `profile.vue`：`loadRemote()` adopt；`cycleGoal()` 本地即时 + 异步服务端保存。
- `practice.vue`：`setGoal(g)` 同上；页面 `onShow` 已重读本地 storage，adopt 结果自然生效，不动练习 session 语义。
- 降级：服务端失败时本地值继续可用（现状不变）；服务端权威值只在成功响应且合法时覆盖。

### 边界（不做）

- 不新增 daily-goal 专用端点；不改目标选项 UI（仍 20/50/100）；不伪造目标完成率/打卡/增长数据；不同步 groupSize 等其他偏好（另轮评估）。

## 测试

- 后端：roundtrip 保存/读回/覆盖、不影响既有字段、非法值（4/501/0/-1/"50"/20.5/True）400、None 清除、缺键不触碰。
- 前端 vitest：normalize 合法/非法矩阵、adopt 覆盖/一致返回 null/缺失非法保留本地、输入不可变。

## 生产复验计划

临时 UID：桌面 1440×900 设目标 → 实查 POST/GET `/api/profile`；清本地 storage 后同 UID 全新 375×812 context 验证目标恢复、三页口径一致；溢出 0、console 0 error、性能预算；测试数据全库清理 leftover=0。
