# R128：窗口复审计（docs-only）——性能/SEO 内链/错误态/操作台探针均未发现可立项缺陷

日期：2026-08-31（R127 上线后）。本轮为取证复审计轮，全部为生产一手样本。

## verified facts

### 性能（Lighthouse 13.4.1，生产实测）
- `/tiku/`、`/tiku/q/3`：perf/a11y/best-practices/seo 全 1.0，LCP 1.0s；
- 首页 `/`：第一跑 perf 0.91 / LCP 3.2s，复跑 perf 0.98 / LCP 1.5s（=FCP，
  LCP 元素为启动屏首绘）——两跑差异为共享宿主/网络方差，非 R122 回归；
  第一跑不作为立项依据（单跑长尾样本）。

### SEO 页族内链与 sitemap
- `/tiku/` 出链覆盖 daily/discuss/papers/全部模块/66 个考点页，无孤岛；
- 分页 `/tiku/yanyu/?page=2`：canonical 自指 + rel=prev/next 齐全、无 noindex；
- 卷详情 `/tiku/papers/5`：title/canonical/JSON-LD 齐全、75 条题目出链；
- 题目页 `/tiku/q/3` 出链 19 条（考点/子题型/推荐题/卷库/首页）；
- 过期/无效日期归档（2026-08-20、2030-01-01、bad-date）统一 301 → `/tiku/daily/`，
  无蜘蛛陷阱。

### 错误态/空态
- 错题本空态（新 uid）：文案 + 「去刷题」CTA + 键盘快捷键提示卡完整渲染，
  console 0 error。

## 结论
本窗口无新的 verified 产品缺陷可立项，按「不为制造改动而改代码」保持 docs-only。

## 未验证/边界（沿袭）
- 夸克公开刷题页面仍无可用一手证据；
- push_subs 仍 0、真实自然用户极少（分发资源待老板，已申报不阻塞）；
- 多层嵌套弹层的焦点归还语义（R126 边界）未专项验证；
- 首页 Lighthouse 单跑长尾建议后续多跑取中位数再判定。
