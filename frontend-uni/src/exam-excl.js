// 做卷页「排除干扰项」纯函数（R319）。
// excl 为当前题排除的选项字母数组；输入不可变，非法入参 fail-closed 原样语义返回。

export function toggleExcl(excl, k, picked) {
  const list = Array.isArray(excl) ? excl.filter((x) => typeof x === 'string') : [];
  const cur = typeof picked === 'string' ? picked : '';
  if (typeof k !== 'string' || !k) return { excl: list, picked: cur };
  if (list.includes(k)) return { excl: list.filter((x) => x !== k), picked: cur };
  return { excl: list.concat(k), picked: cur === k ? '' : cur };
}

export function pickWithExcl(excl, k) {
  const list = Array.isArray(excl) ? excl.filter((x) => typeof x === 'string') : [];
  if (typeof k !== 'string' || !k) return list;
  return list.filter((x) => x !== k);
}
