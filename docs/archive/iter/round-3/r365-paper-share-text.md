# R365：按卷练习完成页分享文案归卷

## 取证（2026-08-29，生产 rev e727840）

- R364 已收口按卷完成页归卷态（本卷练完 + 卷名 + 回卷库），但完成页第三按钮「分享成绩」仍走通用文案：
  - `shareResult()` 非每日分支固定为「我在错题邦刷了 N 道行测题，正确率 X%」（`lastModule` 为 null 时回落「行测」），完全丢失卷维度；
  - 分享链接只到首页 `https://kaogong.zalize.com`，接收方无法直达卷库。
- 竞品：粉笔按卷成绩分享带卷名（「我做完了《XX卷》」），卷维度是分享的核心社交货币。
- 每日一练分支（`dailyStats && _dailyDoneDate`）有独立文案与深链，不受影响；模考成绩分享走 report 页海报，不在此路径。

## 方案（纯前端零契约）

- `paper-continue.js` 补 fail-closed 纯函数：

```js
export function paperShareText(ptitle, n, pct) {
  if (!(typeof ptitle === 'string' && ptitle.trim())) return null;
  if (!Number.isInteger(n) || n <= 0 || !Number.isFinite(pct)) return null;
  return (
    '我在错题邦练完了「' + ptitle.trim() + '」全卷 ' + n + ' 题，正确率 ' + pct + '%' +
    '！也来练这套卷：https://kaogong.zalize.com/#/pkgA/exam/list'
  );
}
```

- `shareResult()`：每日分支之后、通用文案之前，`paperShareText(this._ptitle, this.items.length, pct)` 非 null 即用（连对/击败百分比行保持追加语义一致），null 回落原通用路径零变化。
- 埋点沿用 `share_result_copy`，label 用 `paper`（`track` 白名单 category/action 不变，无需后端改动）。

## 非目标

- 不做分享海报图；不新增深链参数（卷库列表已有 ?pid= 高亮，卷名→pid 完成页不持有 pid，保持列表级直达即可）；不动每日/模考分享。

## 验证

- vitest：合法卷名/trim、空白/非字符串/非法 n/pct fail-closed 返回 null。
- 生产：按卷答完 → 分享成绩 → 剪贴板文案带卷名与卷库深链；普通练习分享文案零变化；每日一练分享回归。
