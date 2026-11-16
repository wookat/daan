# R48 设计方案：/tiku SSR 页族正文链接可辨识性（link-in-text-block）

## 一手证据（2026-08-29 生产取证）

Lighthouse（https://kaogong.zalize.com/tiku/q/39）：SEO 1.0、best-practices 1.0、**accessibility 0.92**，唯一失败项 `link-in-text-block`（正文链接仅靠颜色区分，色弱用户无法辨识）：

- `main .card p.meta > a`（题目页考点归属链接）
- `body > footer.ftr > a` ×4（首页/题库/隐私/条款/邮箱）

根因：SSR 共享 `_CSS` 中 `a{text-decoration:none}`，正文段落内链接与灰色文字仅有色相差。App H5 端（R46 后 a11y 1.0）无此问题，为 /tiku SSR 页族独有。

## 方案

`backend/app/seo.py` `_CSS` 增加一条：`.meta a,.ftr a{text-decoration:underline}`——仅正文/页脚内嵌链接加下划线，导航（.hdr）、卡片标题、tags 胶囊、CTA 按钮等非正文链接保持现状（axe 对非 text-block 链接不要求下划线）。

## 验收标准

- 生产复验 /tiku/q/*、/tiku/ 首页、考点列表页 a11y 均 1.0（link-in-text-block 通过）；
- 页面视觉仅正文/页脚链接多下划线，其余零变化；
- 注意边缘缓存 TTL 300s，复验需带 cache-busting query 或等 TTL 过期。

## 风险

无逻辑改动，纯 CSS 一条；回滚删除该行即可。
