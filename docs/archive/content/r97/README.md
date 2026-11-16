# 轮97：传输层/响应头合规 + admin 暴露面收敛 + 备份权限收尾

日期：2026-08-10（服务器时区）。分支 devin/1786341111-r96。承接 r96 安全审计建议做安全收尾。

## 1. Caddy 安全响应头（生产 /etc/caddy/Caddyfile，非仓库文件）

原配置仅有 TLS/反代/gzip/JSON 访问日志，无任何安全响应头。本轮修改前备份至
`/etc/caddy/Caddyfile.bak_r97`（root:root 600），`caddy validate` 通过后 systemctl reload。

新增全站响应头：

```
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: SAMEORIGIN
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()
Content-Security-Policy:
  default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://cdn.dcloud.net.cn;
  font-src 'self' data: https://at.alicdn.com;
  connect-src 'self'; object-src 'none'; base-uri 'self';
  frame-ancestors 'self'; form-action 'self'
```

另对 `/admin*` 与 `/api/*` 追加 `X-Robots-Tag: noindex, nofollow`（SEO `/tiku/*`、`/s/*`
不受影响，/tiku 收录面保持）。

### CSP 兼容性考虑

- `script-src 'unsafe-inline'`：uni-app 构建产物 index.html 有内联 viewport 检测脚本、
  SEO 页有内联 JSON-LD、`/s/` 分享页有内联 `location.replace` 秒跳——三处均为现存内联脚本，
  故本轮放行 inline；后续可升级 nonce/hash CSP（P3，需改后端 HTML 生成与构建注入）。
- `img-src data: blob:`：H5 PDF 导出/图片预览用 blob:；另放行 `cdn.dcloud.net.cn`
  （uni-app 组件默认阴影图）。
- `font-src https://at.alicdn.com`：wot-design-uni 图标字体 CDN，首轮 CSP 上线后浏览器
  实测发现被拦（错题本等页图标字体 404 级降级），当轮补白名单后复验 0 违规。
- 其余资源/API 全同源，`connect-src 'self'` 即可。

### 线上验证

- 响应头核验：`/`、`/tiku/`、`/admin`、`/api/stats`、`/s/*` 全部携带上述头；
  `X-Robots-Tag` 仅出现在 `/admin`、`/api/*`。
- 全站功能回归：deploy_h5.sh 回归 8 端点全 200；Playwright 375px 走查 7 页
  （首页/练习/错题本/统计/模考/tiku/s 分享跳转）console error 0、CSP 违规 0。
- 已知非本轮问题：FastAPI GET 路由不自动响应 HEAD（`curl -I /tiku/` 显示 404，GET 为 200），
  存量行为照实记 P3。

## 2. admin 暴露面收敛

- 路由盘点：`/api/admin/*` 33 条 + `/admin` 静态面板共 34 条；脚本核验 33 条 API 全部调用
  `check_admin`，唯一例外 `/admin` 为纯静态 HTML 面板（不出数据，操作全走带 token 的 API），
  已加 noindex 防收录。
- token 比较改 `hmac.compare_digest`（防时序侧信道）；错误 token 走全局失败计数限流
  `rate_limit("admin_token_fail", 20, 300)`——线上实测连续错误 token 约 20 次后 401→429，
  正确 token 不受影响（容器内验证 200，不打印 token）。
- 限制：限流为进程内存计数，容器重启/多副本会重置（同 r96 P2，多副本前需 Redis）。

## 3. 服务器备份文件权限

- 容器 `/data`（docker volume，宿主路径在 /var/lib/docker 下、宿主已 root-only 遮蔽）：
  19 个备份文件（bak_r45~r96 各 .db/-shm/-wal、R81/R82 JSON、r66 jsonl 等）由 644 收紧为
  600 root；`data.db` 同步收紧 600（应用以 root 运行，收紧后 API 回归全 200）。
  /data 未被 Web 挂载（仅 /qimg 图片子目录静态暴露），备份不可被 URL 访问。
- Caddy 访问日志：`kaogong.zalize.com-access.log`（含 IP/UA）由 644 收紧 640，且 Caddyfile
  日志块加 `mode 0640` 保证轮转后新文件同权限。jobs.zalize.com 日志属其他项目未动，照实记。
- 建议（P3）：/data 下 r79-r96 共 11 个 370MB 备份约 4.1GB，可立项按「保留最近 3 轮」滚动清理。

## 4. 例行 + health_scan

health_scan.py 全绿：active 113,304 / full 156,792 / lt50 0 / badjson 0 / 乱码 0 /
推广残留 0 / hs_mismatch 0 / 台账外空 hs 0（两条 intentional：changshi:655861、
panduan:334296 未动）/ 卷内重复 0 / 低覆盖仅卷 112（65/112）。
近7天 39 次 / 14 uid；growth 与基线持平（本轮走查误触发 QA uid 2 条 heatmap_view 已清，残留 0）。
爬虫 7 天：YandexBot 84 + bingbot 1 + Baiduspider 1；/s/ 14 次无真实落地，Bing 收录仍未破零。
注：容器重建导致容器内 /tmp/health_scan.py 丢失，本轮由仓库 scripts/health_scan.py 重新下发执行
（脚本已入库防丢，符合 r85 沉淀初衷）。

## 5. 变更清单

- 仓库：`backend/app/main.py`（check_admin 常数时间比较+错误 token 限流）、本报告。
- 服务器（不入库）：/etc/caddy/Caddyfile 响应头（备份 .bak_r97）、日志 mode 0640、
  备份/DB/日志权限收紧。Caddy 配置为服务器态，建议后续立项把 Caddyfile 纳入 deploy/ 版本化（P2）。
