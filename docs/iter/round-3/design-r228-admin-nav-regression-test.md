# R228 设计论证：管理台侧栏导航可访问名称静态契约回归测试

## 取证（生产证据优先）
- 24h origin 日志复审计：20.5k /api/exam/* 404 + 562 502 + 146 429 全部对应历史 09-01 08:11–10:00 风暴（R225 部署前，X-Kg-Guard 头缺失符合预期）与共享 NAT 受控测试（curl/Devin UA），非新外部事件；X-Kg-Fetch 四模式（pass 90/swr 25/miss 8/retry 2）正常落日志，19:29 无副本深页 miss→retry→品牌 503 链路按 R218 设计工作。当前无新 verified 产品缺陷。
- 流程缺口 verified：R227 修复的「折叠侧栏可访问名称仅剩 emoji」只靠生产 Playwright 验证，仓库内零回归覆盖——admin/index.html 12 个导航 title 与 .txt 文案的一致性、折叠态 sr-only（非 display:none）隐藏策略，任何后续改动都可能静默回退且 axe link-name 规则不报（emoji 也算名称）。backend/tests 已有同类静态资产契约测试先例（test_print_styles/test_tiku_link_underline/test_tiku_focus_visible）。

## 方案
新增 backend/tests/test_admin_nav_names.py，纯静态解析（不起服务）：
1. index.html `.side nav` 内 12 个 `<a data-page=...>`：均有非空 `title`，且 title == 该链接 `.txt` 文案（防双维护漂移）；
2. admin.css ≤1023px 折叠块：`.side nav a .txt` 不再出现在 display:none 组选择器中，且存在 clip 式 sr-only 隐藏规则（position:absolute + clip）。

## 顺带修正
design-r227 文档「13 个侧栏 `<a>`」为表述错误，实际实施 12 个导航链接（logo 不补 title），修正措辞与实现精确一致。

## 明确不做
- 不做 DOM 级渲染测试（无 headless 浏览器依赖进后端门禁）；
- 不改任何生产资源（纯测试 + docs，无部署）。

## 验收
- 新测试在当前实现下通过；人为改回 display:none 或删 title 时失败（受控验证后还原）；
- 全部本地门禁全绿。
