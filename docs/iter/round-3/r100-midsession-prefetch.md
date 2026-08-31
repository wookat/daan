# R100：练习中场静默预取下一组——「再来一组」零等待

## 取证（2026-08-31 生产）

- `/api/questions` 生产实测冷径长尾复现：无参首发 17.2s、`module=changshi` 33.2s（同批其余 0.3–0.8s）；共享 2GB 宿主外部进程挤占 IO 时随机行读会分钟级 D 态等待，R64 预热/R81 池化只消除了 id 扫描，题目行随机 IO 无法预热覆盖。
- RUM 实证真实用户在最新 bundle（v:CGOz_gX0）上仍反复上报 `questions:10188–13564`（10–13.5s），slow_load 近 24h 多条。
- 现状：首页 → 首组有 R70 预取（`prefetchPack`）零等待；但完成一组点「再来一组」（`retryGroup` → `start`）时 pack 已被消费，必然裸等网络，最差 33s loading。
- 竞品（粉笔）连续刷题组间无感知等待。

## 方案

练习进行中（答到倒数第 3 题时）后台静默预取下一组，复用既有 `prefetchPack` 存储与 `takePrefetch` 消费逻辑（键：module/limit/uid），使「再来一组」命中 pack 零等待：

- 触发点：`next()` 中 `idx` 到达 `items.length - 3`（10 题组即第 7 题），此时距点「再来一组」通常有 30s+，足以吸收最差长尾。
- 仅普通练习预取：`start()` 成功后记录 `_plainStart = !(submodule||adaptive||forceReal||tag3||realMode) && module !== 'ziliao'`（与 `takePrefetch` 的拒收条件、home 预取的 ziliao 排除对齐）；每日一练/时政/背题/错题重练/强化组不预取。
- 已有新鲜 pack（<5min，同键）时跳过，与 home.vue 一致。
- 预取结果过滤掉当前组已出现的题目 id（服务端 uid 排除以 answer_log 为准，本组尚未答完的题可能重复）。
- 失败静默（catch 丢弃），一次会话每组只触发一次（`_prefetched` 标志）。

零后端改动、零新接口、零新存储键。

## 验收标准

- 生产 1440/375：普通练习答到第 7 题时 network 观察到后台 `/api/questions` 预取请求；答完点「再来一组」无网络请求即开新组，且新组题目与 pack 一致、无与上组重复。
- 每日一练/真题模式/子模块练习不触发预取。
- console 0 error、无横向溢出；测试数据清理、保护 uid 零 mutation。
