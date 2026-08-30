# R61：slow_load RUM 增加导航阶段拆解——归因真实用户 60/90s 首载挂起

## 背景与取证（2026-08-29 生产 growth_events 实测）

R47 加的 slow_load RUM 已捕获真实用户长尾（共 66 条，近 17 小时集中出现）：

- 高频形态 `nav:90xxx` / `nav:60xxx`（load 事件 90s/60s 整附近才触发），
  分布在多个不同匿名 uid（umtf7x…、umtf8t…、umtfa2… 等各 1–2 条），非单用户网络问题；
- 这些条目均无伴随 `;资源:耗时` 明细——现有上报只挑 duration>8s 的最慢资源，
  说明挂起不落在任何已完成的 resource entry 上；
- 另有 API 长尾实证：daily_plan:45s、categories:21s、questions:13.5s、history:8.7s
  （与 R55 记录的共享 2GB 宿主通用长尾一致）。

无法归因的关键缺口：`nav.duration` 只有总时长，不知道 90s 花在
文档 TTFB（origin/CF 层）还是 DOM 解析后 load 事件被子资源拖死（SW/客户端层）。

## 方案

main.js rumCheck 的 ref 增加导航阶段拆解（PerformanceNavigationTiming 均为既有标准字段，零新依赖）：

```text
nav:90372;ttfb:xxx;dom:xxx;load:xxx;sw:1;tx:12345(;最慢资源:耗时)
```

- `ttfb` = responseStart（文档首字节，区分 origin/边缘层挂起）；
- `dom` = domContentLoadedEventStart；`load` = loadEventStart（区分解析后子资源挂起）；
- `sw` = navigator.serviceWorker.controller 存在与否（区分 SW 拦截路径）；
- `tx` = nav.transferSize（0=缓存/SW 直出）。

后端 slow_load ref 上限 200 字符（team.py 既有），足够容纳。
触发阈值/频次/去重逻辑不变，仅丰富 payload。

## 验收标准

1. CDP 节流模拟慢载，实测上报 ref 含 ttfb/dom/load/sw/tx 字段且数值合理；
2. 正常快载不触发上报（阈值不变）；
3. 1440/375 console 0 error、页面零视觉变化；
4. build:h5 全绿、部署 hash 一致。

## 验收结果（待部署后回填）
