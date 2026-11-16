# 轮40：Caddy access log + 周报召回态 + 双引号规范化

## 1. Caddy access log（生产宿主机）

- `/etc/caddy/Caddyfile` 为 `kaogong.zalize.com` 站点新增 `log` 块（修改前已备份 `Caddyfile.bak_r40`）：
  - 输出：`/var/log/caddy/kaogong.zalize.com-access.log`
  - 格式：JSON
  - 轮转：`roll_size 50MiB` + `roll_keep 14` + `roll_keep_for 336h`（14天），磁盘占用上限约 50MiB×14
- `caddy validate` 通过后 `systemctl reload caddy`（不中断其他站点）。
- 验证：请求 `/tiku/q/273028` 与 `/tiku/q/412606` 后，日志尾部均出现对应 JSON 记录（uri + status 200）。

## 2. H5 学习周报召回态 + comeback_view 埋点

- 现状检查：`pkgA/stats/weekly-report.vue` 周报页本身对无数据/未结束周已有空态；但 7 天不活跃老用户回访时首屏（首页）无任何召回提示。
- 改动（`pages/home/home.vue`）：
  - 新增首页顶部「回访召回卡」：本地 `pstats.days` 判断上次练习距今 ≥7 天且历史有练习记录时展示；
  - 文案：「欢迎回来！你已累计练 X 题 / 上次练习是 N 天前 · 继续保持，看看你的学习周报」，CTA 直达周报页；
  - 每天最多展示一次（localStorage `comebackShown` 去重），展示时上报一次 `comeback_view(source=home)`；可手动关闭。
  - 注：用户 7 天不活跃时「上周练题数」通常为 0，故召回文案采用「累计练 X 题 + 上次练习 N 天前」口径，周报页内仍展示逐周数据。
- 后端：`team.py` `/api/track` 事件白名单加入 `comeback_view`。线上实测上报 200 入库（测试记录已按 uid 守卫清理）。
- 暂不发邮件，仅页面基建+埋点。

## 3. 双引号叠加规范化（内容治理）

- 口径：轮39 的「约 1,976 条」= 题干含 `“‘` 的 active 行（本轮快照实测恰为 1,976）。
- 替换规则（保守）：仅将紧邻叠加的 `“‘X’”`（X 内不含任何引号字符）规范为 `“X”`；
  形如 `“灭火器使用口诀‘提拔握压’”`、`“‘白望’与‘乌衣’”` 等合法中文嵌套引号（460 条）不改动。
- 流程：
  1. 生产 `VACUUM INTO /data/bak_r40_quotes.db` 备份（更新前）；
  2. 本机快照 dry-run：命中 1,516 条；其中 16 条规范化后与库内既有题干撞 `UNIQUE(question)` 约束（如 388632→187090「洞庭湖」重复题），予以跳过；实际可更新 1,500 条，dry-run 1500/1500；
  3. 生产事务更新，UPDATE 守卫 `id + 原question + answer + options + disabled=0`，行数不符即回滚；实际 committed 1500；
  4. 校验：全库 `answer/options` 哈希与备份完全一致（零变更）；active 剩余叠加模式 16 条=全部为撞唯一约束跳过项；
  5. 抽检 20 条 old/new 逐条比对（仅题干变化，answer/options 与备份一致），全部通过。

## 4. 部署与回归

- H5 `npm run build:h5` 构建通过；rsync backend/deploy/dist → 重建 deploy-kaogong-1。
- 回归全部 200：`/api/stats`、`/api/questions?module=yanyu|changshi&count=5`、`/tiku/`、`/tiku/q/412606`（题干已显示规范化后的 `商代“比干”`）、`/admin`、H5 首页。
- `/api/track` comeback_view 上报 200；Caddy access log 实时落 `/tiku/` 与 `/api/track` 请求。

## 5. 遗留

- 16 条因 UNIQUE(question) 撞重跳过的叠加题干（与既有题重复语义，可另行评估去重下架）。
- comeback_view 自然样本需等待老用户回访，建议下轮数据复盘。
