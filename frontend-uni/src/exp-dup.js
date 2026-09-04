// 官方解析是否已被花生十三解析全文包含（纯函数）：命中则完成页只展示 hs，避免复读

/** expl 去首尾空白后长度 ≥ 20 且为 hs 子串 → true；其余（空/短文本/未包含）一律 false。 */
export function isExplanationCovered(hs, expl) {
  if (typeof hs !== 'string' || typeof expl !== 'string') return false;
  const e = expl.trim();
  if (e.length < 20) return false;
  return hs.includes(e);
}
