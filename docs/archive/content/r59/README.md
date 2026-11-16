# 轮59：589769 个案裁定 + 分享体验微信外降级打磨 + 例行

日期：2026-08-09 · 分支 devin/1786308692-r55（PR#114）

## 1. 589769 选项残缺个案裁定处理

裁定：题目知识点与答案（D）正确，仅 D 项文字残缺（「亚硝酸盐或增宜尽快食用」不通顺，解析中自注"表述不完整"），历史作答 0 次，不下架、修文案。

处置（备份 bak_r59_589769.db + 守卫断言事务）：
- D 项改为「隔夜绿叶蔬菜中的亚硝酸盐或会增加，宜冷藏保存并尽快食用」；
- 解析中"选项D表述不完整…"句同步改写为对 D 项的正面解释；
- 线上 /tiku/q/589769 复核：新文案已渲染；修正口径一致性复扫仍 0 残留。

## 2. 增长线：分享链路微信外浏览器降级体验 + OG 预览卡

### 2.1 wx API 降级审计（代码级）

全前端仅 3 处原生 `wx.*` 调用，均在 `#ifdef MP-WEIXIN` 条件编译块内（api.js PDF 保存 ×2、reminder.js 订阅消息 ×1），H5 构建产物不含任何裸 wx API——微信外浏览器零 wx 报错风险。分享/复制均走 uni.setClipboardData（H5 有原生降级）。

### 2.2 线上实测（Android Chrome UA，390px，Playwright）

- 分享落地页 `/#/pkgA/share/share-q?sid=…&v=a`（真实 share 走 /api/share/create 创建）：题目+4 选项渲染、作答后答案/解析/大家的作答正常展示、「去刷同类题」CTA 在位；「复制分享链接」按钮仅分享者可见属既有设计（受访者动线为刷同类题），非缺陷；
- 组队邀请页 `/#/pages/team/join?code=…`：邀请码渲染正常；无效码点加入后正确降级到错误态（「邀请码无效或小队不存在」+「手动输入邀请码」入口）；
- PK 页 `/#/pkgA/pk/pk`：模块选择/发起界面渲染正常；
- 三页 JS 报错均为 0。测试数据（t_r59_devin 的 share/作答记录）已守卫清理，残留 0。

### 2.3 OG/meta 预览卡补齐（本轮变更）

原 index.html 无 description、无任何 OG 标签且 `lang="en"`——外部 App（Telegram/Twitter/QQ 等）粘贴链接无预览卡。本轮补上：

- `lang="zh-CN"`、`meta description`；
- `og:type/site_name/title/description/url/og:image`（image 用线上 /static/logo.png，实测 200）。

SPA hash 路由下所有分享链接共享同一张站点级预览卡（按题动态 OG 需 SSR 化分享页，列为后续可选项）。注：`<title>` 由 uni manifest 在构建时注入「考公错题助手」，OG 标签原样保留，线上 curl 复核 6 个 og: 标签齐全。微信内分享卡片走小程序/JS-SDK 通道，不依赖 OG，此项主要覆盖微信外场景。

## 3. 部署与回归

deploy_h5.sh 全流程：bundle 一致（index-BGFOtlL1.js，本轮仅 index.html/数据变更，chunk hash 不变），7 项接口回归全 200。

## 4. 健康快扫 + 数据例行

```
active 112,962；hs 一致性 0；options 非JSON 0；(cid: 0
空缺仅 2 条台账题：panduan:334296、changshi:655861
近7天作答 0 次 / 0 uid；爬虫流量 0（分段命中：题目页为主，年份/考点页 0）
```

## 5. 下一批建议

1. 站长平台验证仍是收录破零 P0（需老板资源）；
2. 分享页按题动态 OG（SSR 化 /s/{sid} 落地页）——收录/外部分发起量后再做，当前站点级卡片够用；
3. changshi 低分批次模板句式批量重写（P2，r58 已立项）；
4. LLM key/ACCESS_CODE 仍待补发。
