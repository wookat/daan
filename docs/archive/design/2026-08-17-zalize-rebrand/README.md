# 上岸错题 · Zalize 品牌换装（2026-08-17）

依据：company-internal PR #3《统一品牌与官网方案》+ career-portal PR #5 `@zalize/brand` 0.1.0。
范围：只做品牌/视觉与文案（不动题库 / AI 讲解 / 错题本逻辑；frontend-uni 功能代码不动，只改品牌视觉层；app-flutter 本轮不动）。

## 命名

- 产品名：考公错题助手 → **上岸错题**（副标保留「考公错题助手」用于 SEO/描述）
- 页脚落款：`© 2026 Zalize 上岸 · 上岸错题`

## 色板映射（@zalize/brand 岸蓝）

| 旧 token（KG v1 / miniapp v2） | 新值（岸蓝） |
| --- | --- |
| primary-600 `#3b6ff5`（主色） | brand-600 `#2e5bff` |
| primary-500 `#6c9bff` / `#5c8cff`（渐变浅端） | brand-400 `#5c82ff` |
| primary-700 `#4338ca` / `#2f57d4`（hover/深） | brand-700 `#1e44d9` |
| miniapp brand-700 `#2545ab` | brand-800 `#1735ab` |
| primary-50 `#edf3fe` / `#eef4ff` | brand-50 `#eef3ff` |
| primary-100 `#e0e7ff` / `#dce8ff` | brand-100 `#dbe6ff` |
| primary-200 `#c7d2fe` / `#b9d0ff` | brand-200 `#b8ccff` |
| miniapp brand-300 `#8ab0ff` | brand-300 `#8aa9ff` |
| legacy frontend `#2f6fed` | brand-600 `#2e5bff` |

字体栈（对齐门户）：`Inter, -apple-system, 'PingFang SC', 'HarmonyOS Sans', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif`。

## 资产

- 子产品图标：career-portal `brand/assets/icons/kaogong.svg`（岸蓝底 + 白色圆形勾选 glyph）→ favicon / logo.png / 小程序登录页 logo。
- 主品牌 token：vendor 自 `@zalize/brand` `tokens.css`（frontend-uni `src/static/brand/`）。

## 互链

- Web 顶部：`https://career.zalize.com/nav.js`（全产品导航，host 自动高亮当前产品）。
- Web 我的页页脚：Zalize 全家桶互链 + 统一落款。

## 原型

见 `prototype.html`（375/768/1440 响应式 + 亮暗，静态视觉稿）。
