// 错题本 tabBar 角标。uni API 不传回调时返回 Promise，非 tabBar 页（含分包超时的 AsyncError 态）
// 调用会以 {errMsg:'setTabBarBadge:fail not TabBar page'} 拒绝且 try/catch 接不住 → 显式传 fail 吞掉。
const BOOK_TAB_INDEX = 1;
const noop = () => {};

export function badgeText(due) {
  const n = Number(due) || 0;
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

export function setBookBadge(due) {
  const text = badgeText(due);
  if (text) uni.setTabBarBadge({ index: BOOK_TAB_INDEX, text, fail: noop });
  else uni.removeTabBarBadge({ index: BOOK_TAB_INDEX, fail: noop });
}
