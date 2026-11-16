# R107：专项练习首跳预取覆盖——模块选题面板打开即后台预取

## 生产取证（2026-08-31）

- 全新 uid 首次专项练习（changshi 10 题）实测在「出题中…」阶段等待约 19–20s（页面兜底文案「网络较慢，仍在努力加载…」直出到 19 秒）；同 uid 复测 0.4–0.6s、另测冷 6.98s——冷路径由 2GB 共享宿主页缓存换出所致（R81/R64 已收敛惊群与预热，抽题池本身常驻）。
- RUM 真实用户 slow_load 持续录得 `questions:9–13.5s`。
- 既有预取只覆盖两处：首页 onShow 预取 `lastModule`（新用户为空=混合池）、练习中场预取下一组（R100）。用户在首页点具体模块卡（最常见入口：五模块卡 → 二级题型面板 → 全部随机/子题型）时，`prefetchPack.module` 与所点模块不匹配，必然裸等网络。

## 方案（纯前端零后端）

1. `home.vue` 抽出 `prefetchModule(module)`（复用现 `prefetchNext` 主体，参数化 module）；`prefetchNext` 改为 `prefetchModule(lastModule)`。
2. `openModule(module)` 打开二级题型面板成功后即调 `prefetchModule(module)`——用户浏览子题型的数秒窗口并行拉「全部随机」题包；选「全部随机」时 practice `takePrefetch` 精确命中零等待。
3. 守卫沿用现约定：realMode 关、`module!=='ziliao'`（分组参数不同）、已有同键新鲜 pack（<5min）跳过、失败静默。
4. 选子题型/自定义数量时键不匹配自然回退网络请求，行为不变。

## 验收

1. `npm run build:h5` 通过。
2. 生产 1440：新 uid 点模块卡 → 面板打开即发出 `/api/questions?module=` 预取请求；等预取落地后点「全部随机」→ 0 次 questions 网络请求直入题组，且题目与 pack 一致。
3. 375：同流程无溢出、console 0 error。
4. 子题型入口回归：仍正常发网络请求开练。
5. 测试数据清理（scripts/clean_test_data.py）、保护 uid 零 mutation。
