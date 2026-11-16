# R108：首页专项练习入口去阻塞——question_counts 快照兜底 + 静态模块回退

## 取证（2026-09-01，生产一手证据）

- 生产 origin 再次假死窗口（宿主 load 23、外部 recruit gunicorn/postgres 挤占 2GB 内存），
  `/api/question_counts` 直测两次 524 / 125.1s，恢复后仍 39.8s（health 51s→0.5s）。
- 同窗口真实浏览器（Playwright CDP，全新 uid）首页实录：
  专项练习区块只渲染骨架屏 + 「题库加载中…点此重试」，五个模块卡全部不出现，
  持续 30s+ 无法进入任何专项练习——**核心刷题入口被一个纯装饰性计数接口完全阻塞**。
- 代码链路确认（home.vue）：
  - 模块卡列表 `v-for="c in counts"`，`counts` 仅由 `/api/question_counts` 成功响应填充；
  - `loadCounts()` 失败后 3s 重试 ≤20 次，期间入口不可用；
  - R90 apiSnap 兜底只覆盖「双超时/网络错误」，**5xx（如本次 524）按 HTTP 业务错误透出，不回退快照**；
  - 边缘 stale-if-error（R95）依赖 caches.default 副本仍存在，实测本次未兜住（两次 524 直达客户端）。
- 顺带证伪本轮原候选（R108 原方向）：homepage 到期复习行/duebar 与
  `/api/review` total、`home_bundle.plan.due_mistakes` 实测一致（1 题时 duebar/任务行均正确显示），
  先前观察到的不一致是宿主高负载下 home_bundle 慢返回的时序假象，不立项。

## 差距定级

P1：五大模块专项练习是首页最高频入口；模块 id/名称/图标本就硬编码在前端
（NAMES/ICONS/COLORS），题数 n 只是展示性信息，不应让入口可用性依赖该接口成功。

## 方案（纯前端，零后端改动）

1. **快照兜底**：`loadCounts()` 成功后把 counts 落 `uni.setStorageSync('countsSnap')`；
   data 初始化时先用快照填充 `counts`——老用户即使接口 524/慢也立刻可点（题数为上次值）。
2. **静态回退**：无快照（全新用户）且首次请求失败时，用硬编码模块列表
   `[ziliao, shuliang, yanyu, panduan, changshi]`（n=0）渲染卡片，入口立即可用；
   n=0 时隐藏「done/n + 进度条」，progText 显示「题库加载中…」。
3. **后台刷新**：回退/快照态下保留既有 3s×20 重试，真实 counts 返回后原位替换并更新快照。
4. 「全部随机」sheet 中 n 显示 0 题时不影响开练（startPreset 不依赖 n）。

不改动：/api/question_counts 本身、边缘函数、R90 apiSnap 语义（5xx 不回退是全局决策，
此处仅对该入口做页面级兜底）。

## 验证

- 本地：lint + 前端 build 全绿。
- 生产：
  - 全新 uid + 路由层拦截 question_counts（abort/524 模拟）→ 模块卡静态回退渲染、可点开面板并开练；
  - 放行后 counts 后台刷新、题数原位出现；
  - 老 uid（有快照）拦截下模块卡带题数立即渲染；
  - 1440/375 双视口无溢出、console 0 error；测试数据清理、保护 uid 零 mutation。
