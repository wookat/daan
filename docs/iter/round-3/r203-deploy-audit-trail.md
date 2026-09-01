# R203：部署审计日志（服务器侧 deploy-history）

## 取证（2026-09-01，生产一手）

- 当日 16:11–18:37 origin 日志出现 ~21k 条 /api/exam/submit、/api/exam/report/* 404
  错误风暴（单 60s 滚动窗口峰值 262 条），期间 **零 429**——而 R182 ErrorStormGuard
  阈值为 30 错误/60s；同日 22:08 对生产实测 35 连发 404 探测第 31 次起即 429，
  且本地 pytest 同样复现守卫生效。风暴窗口内守卫失效原因无法定案。
- 关键归因障碍：dockerd journal 显示 deploy-kaogong-1 当日 16:00–22:00 被反复重建
  （sbJoin/重建事件约每 10–25 分钟一次，22:00 镜像重新 build），但**没有任何持久记录
  能回答「某时刻线上跑的是哪个 rev、由谁部署」**——/api/health 只暴露当前 rev，
  历史容器与镜像已销毁，无从判断风暴窗口内运行的构建是否包含 R182 守卫。
- 另证：风暴来源 IP 与本会话出口 IP 相同（140.232.64.5），但该出口为 Devin 基础设施
  共享 NAT，多个会话共用——此前 R183/R185 按该 IP 做的「本会话探针」归因实际是
  「全部 Devin 会话」口径，需在观测口径中如实校正。

## 方案

- deploy_h5.sh 在 rev 校验通过后（step 4a 之后）追加一行部署审计记录到服务器侧
  `/home/ubuntu/kaogong-reports/deploy-history.log`：
  `UTC时间 rev=<BUILD_REV> bundle=<index-*.js> by=<本机 hostname>`。
- 只追加不轮转（每次部署一行，年增量 <100KB）；写失败不阻塞部署（`|| true` + WARN）。
- 不动：部署流程其余步骤、容器、后端、前端。

## 验证计划

- bash -n 语法检查；ruff/pytest 全量回归（后端零改动，应保持 81 passed）。
- 真实部署一次：deploy-history.log 出现本次记录且 rev 与 /api/health 一致；
  R196 性能预算、1440/375 双视口复验照常。
