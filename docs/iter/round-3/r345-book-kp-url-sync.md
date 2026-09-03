# R345：错题本题型/三级考点筛选 URL 同步（?kp= / ?kp3=）

## 取证（生产 + 代码一手证据）

- R276 起错题本已有 URL 同步：`tab/mod/src/sort`（book-url.js 静态白名单）；R340 补 `?rz=`。
- 但二级题型筛选 `kpFilter`（筛选 sheet 题型组 / 按模块查看二级行）与三级考点筛选 `kp3Filter`（按模块查看三级行，R344 已接通重练透传）**均不进 URL**：
  - `syncBookUrl()` 只传 `{ tab, mod, src, rz, sort }`（book.vue）；
  - watcher 中 `kp3Filter()` 只重置分页不调 `syncBookUrl`，`kpFilter` 无 watcher；
  - `onLoad` 的 `parseBookOpts` 无 kp/kp3 字段。
- 后果：筛到「言语理解-语句填空」或「中国古代史」后硬刷/分享链接，筛选态丢失回到全量列表——与 rz/src 行为不一致（同为筛选维度，rz/src 可刷新恢复）。粉笔错题本考点筛选态同样可通过链接还原。

## 方案（纯前端，零后端/零契约）

1. **book-url.js**：`buildBookUrl` 补 `kp`/`kp3`（非空字符串、长度 ≤40、encodeURIComponent；kp3 仅在 kp3 非空时输出，可与 mod/kp 共存）；`parseBookOpts` 补解码 + 同守卫（畸形编码/超长 fail-closed 为空）。kp/kp3 是动态数据（题型组名/三级考点显示名，无静态白名单），入向仅做形状校验，**语义校验延迟到 load() 完成后**。
2. **book.vue**：
   - `onLoad`：`p.kp`/`p.kp3` 暂存 `_pendingKp/_pendingKp3`（不直接设 filter，避免列表未加载时 CTA 文案/空列表闪烁误导）。
   - `load()` 成功后消费 pending：kp 需匹配某项 `groupKey(m)`、kp3 需匹配某项 `tag3_name`（fail-closed：不匹配则丢弃并 `syncBookUrl()` 纠正 URL）；命中时一并设置对应 `filterMod`（从命中项 module 取），保持与 pickGroup 状态形状一致。
   - watcher：`kpFilter`/`kp3Filter` 变化时 `syncBookUrl()`（kp3Filter watcher 已存在，补调用；kpFilter 新增 watcher，保留 pageN 重置）。
   - `syncBookUrl()` 透传 `kp: this.kpFilter, kp3: this.kp3Filter`。
3. 不改 redoAll/redoSet/practice；不新增埋点；fav tab 下与既有维度一致不输出 kp/kp3。

## 测试

- vitest（tests/book-url.test.js 增补）：build 含 kp/kp3 编码、fav 不输出、超长/空值不输出；parse 解码、畸形编码 fail-closed、超长 fail-closed。
- 生产实测（testing agent）：筛三级考点→硬刷恢复（列表+chip+重练卡文案）；筛题型→硬刷恢复；分享 URL 新 context 直达同态；?kp3=不存在的名字 fail-closed 回全量且 URL 被纠正；与 ?rz=/?src= 叠加恢复；375/1440；console 0 error；0 次 /api/explain。

## 非目标

- 不做 kp/kp3 的静态白名单（动态数据，靠 load 后语义校验 fail-closed）。
- 不改后端、不新增 endpoint/表/事件。
