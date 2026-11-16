# R129：图标-only 控件可访问名称收口

## 取证（verified facts，2026-08-31）

- 生产 1440 首页焦点遍历实测：Tab 序列第 14 站为无名可聚焦元素——
  公告关闭按钮 `.ann-x`（内部 l-icon 为 aria-hidden 图片，无文本、无 aria-label），
  读屏/键盘用户听到的是空名称按钮；
- 全站源码核查（`name="x"` 图标）：同模式共 24 处——弹层 `.sheet-x` 关闭 ×18、
  搜索清空（searchclear/sclear）×3、公告关闭 ann-x ×1、回复取消 rx ×1、
  图片移除 ×1，全部无可访问名称；
- R123 的运行时 role=button 分配仅覆盖「有短文本」元素（t.length>0），
  图标-only 元素天然漏网，此为 R123 已知边界的实证样本。

## 方案

逐处在模板补 `role="button"` + 语义化 `aria-label`（uni h5 属性透传到宿主元素）：
- `.sheet-x` → `aria-label="关闭"`；
- `.ann-x` → `aria-label="关闭公告"`；
- searchclear/sclear → `aria-label="清空搜索"`；
- `.rx` → `aria-label="取消回复"`；
- ask 图片确认 `.sheet-x`（clearImage）→ `aria-label="移除图片"`。
不走共享运行时按 class 猜名（脆弱耦合），显式模板标注最忠实语义。
零后端/零逻辑改动，纯模板属性。

## 验证

- 本地 lint + vitest + build:h5；
- 生产 1440/375：首页无名可聚焦元素归零；打开弹层实测 sheet-x
  accessible name=关闭；console 0 error、溢出 0。
