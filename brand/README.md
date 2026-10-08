# 答岸 品牌资产

标识含义：**对话泡 × 日出岸线**——「答」=拍题即答的对话泡外廓（左下指向尾），泡内「岸」=半升旭日 + 三道光芒 + 岸线。扁平、单色、几何，与产品 VIS 同源。

## 文件

| 文件 | 用途 |
|---|---|
| `logo.svg` | 主标识（蓝砖圆角 + 白色线稿），任何底色上的首选 |
| `glyph.svg` | 线稿单标（品牌蓝，透明底），用于浅色底内嵌 |
| `glyph-white.svg` | 线稿单标（白，透明底），用于品牌蓝/深色底 |
| `lockup.svg` | 横排组合（标 + 答岸），浅色底 |
| `lockup-mono.svg` | 横排组合全白版，品牌蓝底专用 |
| `icon-1024/512/256/144.png` | 应用图标导出（商店、小程序头像、后台上传） |
| `favicon-64/32.png` | 站点 favicon |
| `mascot-flag.png` / `mascot-study.png` | 吉祥物「岸仔」：插旗上岸 / 坐着刷题 |
| `mascot-*-512.png` | 吉祥物 web 尺寸 |

## 规范（与 DESIGN.md / tokens.json 一致）

- 品牌蓝 `#2e5bff`，砖圆角 ≈ 23%（96 视窗 rx22）
- 线稿描边统一宽（96 视窗 stroke 6）、圆头；禁改粗细制造层级
- 最小尺寸 16px；logo 周围留白 ≥ 标高的 1/4
- 禁：渐变、投影、旋转、换色、描边外发光
- 吉祥物「岸仔」只出扁平实色版本，动作库随素材扩充

## 各端接入点

- 小程序：登录页 `pages/login/login.wxml` 用 `images/brand/icon.png`；**小程序头像/名称需在 mp 后台手动更换**（头像用 `icon-512.png`，名称改「答岸」）
- H5：favicon/开屏图 `frontend-uni/src/static/brand/daan.svg`；og 卡 `scripts/gen_og_card.py` 重新生成
- 落地页：`landing/index.html` nav 内嵌线稿 + assets/mascot
