# R300 设计：练习偏好（每组题量/限时训练/自动下一题）服务端化

## 取证（SOP-10 四维复审计 + 源码）

四维复审计（R299 后重扫）：

- 操作台/桌面：无新的结构性缺口；练习页工具面板（每组题量/限时训练/自动下一题）为高频操作入口。
- 核心功能深度：账号资产服务端化尾巴——R296（申论收藏）/R297（申论草稿）/R298（模考进度）/R299（每日目标）之后，练习偏好三项仍是纯本机 storage。
- 落地页/首页：首页「练习设置」弹层含每组题量 chips（10/20/30/50），与练习页同一 storage 键但无账号级权威值。
- 移动 IA/跨设备：换设备/清缓存后每组题量回落 10、限时训练回落关闭、自动下一题回落开启，与粉笔「练习设置为账号级、跨端一致」口径不符。

源码取证：

- `home.vue` `setGroup(n)`（chips [10,20,30,50]）与 `practice.vue` `setGroup(n)` 均只写本地 `groupSize`。
- `practice.vue` `toggleTimed()` 写 `timedMode`（'1'/''）、`toggleAutoNext()` 写 `autoNextOff`（'' 为开启）。
- `beiMode` 为会话瞬时态（多处主动清空），`fontLv`/`sfxOff` 为设备级呈现偏好，均不收。
- 后端 `user_profile` + `/api/profile` 已承载 `daily_goal`（R299），字段白名单 + 严格校验模式现成；`user_profile` 在 `_UID_PK_TABLES`，匿名归并自动覆盖新列。

## 问题定义

练习偏好三项（每组题量、限时训练、自动下一题）只存本机，跨设备漂移；首页与练习页两个设置入口无账号级权威值。

## 方案（复用 /api/profile，零新端点，镜像 R299）

### 后端

- `user_profile` 增列 `group_size INTEGER`、`timed_mode INTEGER`、`auto_next INTEGER`（新表直建 + PRAGMA 幂等 ALTER 迁移旧库）；`PROFILE_FIELDS` 增三键；INSERT 路径带上。
- `POST /api/profile` 校验（键存在时）：
  - `group_size`：None 清除；否则必须为 {10, 20, 30, 50} 白名单整数（显式拒 bool/浮点/字符串/越档整数），否则 400；
  - `timed_mode`/`auto_next`：None 清除；否则必须为整数 0/1（显式拒 bool，保持与 daily_goal 同一严格口径），否则 400。
- `GET /api/profile`/`home_bundle` 经 `SELECT *` 自然返回；匿名归并零改动。

### 前端

- 纯函数 `src/practice-prefs.js`：
  - `GROUP_SIZES = [10, 20, 30, 50]`；
  - `normalizeGroupSize(v)`：数字且命中白名单 → v，否则 null；
  - `normalizeFlag(v)`：严格 0/1（拒 bool/其他）→ v，否则 null；
  - `adoptServerPracticePrefs(local, profile)`：返回需覆盖本地的差异对象 `{groupSize?, timedMode?, autoNext?}`（服务端值合法且与本地不同才出现；缺失/非法/相同不出现；不修改输入）。
- `home.vue`：`applyBundle`/`loadProfile` adopt `groupSize` 并回写本地；`setGroup(n)` 本地即时 + fire-and-forget `POST {group_size}` 失败静默。
- `practice.vue`：既有 `syncDailyGoal()`（onShow 一次）同一响应顺带 adopt 三项偏好并回写本地（`timedMode`→'1'/''、`autoNext`→`autoNextOff` '' /'1'）；`setGroup`/`toggleTimed`/`toggleAutoNext` 本地即时 + 异步 POST 失败静默。
- 降级：服务端失败本地值继续可用；只在成功响应且合法时覆盖。

### 边界（不做）

- 不收 beiMode/fontLv/sfxOff/realMode 等（瞬时态或设备级）；不新增端点；不改设置 UI 档位；不伪造使用数据。

## 测试

- 后端：三字段 roundtrip/覆盖/None 清除/缺键不触碰；非法矩阵（group_size: 5/15/0/-1/"10"/10.5/True；timed_mode/auto_next: 2/-1/"1"/0.5/True/False）全部 400；不影响既有字段与 daily_goal。
- 前端 vitest：normalize 合法/非法矩阵、adopt 差异/一致/缺失/非法行为、输入不可变。

## 生产复验计划

临时 UID：1440×900 练习页改三项偏好 → 实查 POST/GET `/api/profile`；同 UID 全新 375×812 context 验证三项恢复、首页 chips 口径一致；断网 fallback；溢出 0、console 0 error、性能预算；测试数据全库清理 leftover=0。
