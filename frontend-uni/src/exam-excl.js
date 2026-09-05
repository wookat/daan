// 做卷页「排除干扰项」纯函数（R319）。
// excl 为当前题排除的选项字母数组；输入不可变，非法入参 fail-closed 原样语义返回。

export function toggleExcl(excl, k, picked) {
  const list = Array.isArray(excl) ? excl.filter((x) => typeof x === 'string') : [];
  const cur = typeof picked === 'string' ? picked : '';
  if (typeof k !== 'string' || !k) return { excl: list, picked: cur };
  if (list.includes(k)) return { excl: list.filter((x) => x !== k), picked: cur };
  return { excl: list.concat(k), picked: cur.split('').filter((x) => x !== k).join('') };
}

// 多选题点选（R414）：在已选字母串中切换 k，结果按字母升序，与服务端 normalize_answer 同序。
export function togglePickLetter(picked, k) {
  const cur = typeof picked === 'string' ? picked.split('') : [];
  if (typeof k !== 'string' || !k) return cur.join('');
  const set = cur.includes(k) ? cur.filter((x) => x !== k) : cur.concat(k);
  return [...new Set(set)].sort().join('');
}

export function pickWithExcl(excl, k) {
  const list = Array.isArray(excl) ? excl.filter((x) => typeof x === 'string') : [];
  if (typeof k !== 'string' || !k) return list;
  return list.filter((x) => x !== k);
}

// 刷题页排除态是否呈现（R321）：仅未作答且非背题模式时显示，作答后判分视觉接管。
export function exclVisible(excl, k, picked, beiMode) {
  if (beiMode) return false;
  if (typeof picked === 'string' && picked) return false;
  if (typeof k !== 'string' || !k || !Array.isArray(excl)) return false;
  return excl.includes(k);
}
