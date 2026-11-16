# R195：/tiku 深色模式正文链接可辨识性 + 启动屏失败态读屏可达性

## 取证（生产一手实测，2026-08-29）

### 1. 深色模式 /tiku 入口页 link-in-text-block 违例
- 全站 axe 4.10.2 复扫（light/dark × 首页/错题本/刷题/统计/我的/tiku/tiku-daily，375px）：
  仅 dark `/tiku/` 有违例——`link-in-text-block` serious × 7。
- 违例节点：入口页 `h2 > a`（5 个模块标题链接）+ 首段 `p` 内「今日每日一练」「考友热议题目」两个内文链接。
- 原因：深色 `--link:#7c9aff` 与周边正文 `--text:#f3f4f6` 对比仅 2.4:1（<3:1），且链接无下划线等非颜色区分。
  浅色模式 BRAND 蓝对 `#17181c` 正文对比 ≥3:1 所以通过，属深色 token 引入（R124）后的盲区；
  R48 只给 `.meta a,.ftr a` 补了下划线，`h2 a` / `p a` 漏网。
- 颜色方案不可行论证：深色下链接需同时满足「对 surface `#1f2937` ≥4.5:1」与「对正文 `#f3f4f6` 对比差 ≥3:1」，
  两约束的亮度区间刚好相抵（边界重合），无可行色值——只能用非颜色区分（下划线）。

### 2. R194 启动屏失败态读屏不可达
- 受控拦截 bundle 后检查失败态 DOM：错误提示 `role=None`、`aria-live=None`、`document.activeElement` 为空。
  读屏用户在 bundle 失败时既听不到失败通报，焦点也不落在重试按钮上（axe 对该态扫描 0 违例，属 axe 盲区，
  动态插入的关键状态消息需 `role="alert"` 才会被 AT 通报）。

## 收口（最小改动）

1. `backend/app/seo.py` `_CSS`：
   - `.meta a,.ftr a` 下划线规则扩为 `.meta a,.ftr a,h2 a,p a`（两种配色一致，非仅深色，视觉语言统一）；
   - 补 `p a.cta,.crumb a{text-decoration:none}` 豁免：胶囊 CTA 与面包屑本就有形状/位置区分，不需内文下划线。
2. `frontend-uni/index.html` watchdog `fail()`：
   - 错误提示 `e.setAttribute('role','alert')`——插入即被读屏通报；
   - 追加后 `b.focus()`——焦点直达「重新加载」按钮，键盘/读屏一步可操作。

## 验证

- 本地：ruff/pytest、ESLint/vitest、H5 build 全绿（见 PR）。
- 生产：dark 375px `/tiku/` axe 复扫 link-in-text-block 清零；light/dark 双模式全页族复扫无新违例；
  受控拦截 bundle 后失败态 `role=alert` 生效、焦点落在重试按钮；1440/375 双视口无溢出、console 无非预期 error。

## 如实局限

- 下划线是全页族生效（含浅色），属有意的视觉语言统一，非最小视觉 diff；
- axe 对动态失败态本就报 0 违例，`role="alert"`/焦点管理属超出 axe 的读屏行为收口，验证方式为 DOM 断言而非真实读屏实测。
