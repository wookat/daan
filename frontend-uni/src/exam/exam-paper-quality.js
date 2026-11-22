// 试卷完整度判定与排序：优先呈现 5 模块齐全且题量达标的完整真题卷，残卷/缺模块卷如实标清缺失项。
const MODS = [
  ['changshi', '常识'],
  ['yanyu', '言语'],
  ['shuliang', '数量'],
  ['panduan', '判断'],
  ['ziliao', '资料'],
];

/**
 * 评估单套试卷完整度。
 * 完整卷口径：100 <= n <= 160，且当服务端返回了 mods 构成时五模块均 > 0。
 */
export function paperCompleteness(p) {
  if (!p || typeof p !== 'object') {
    return { complete: false, merged: false, missingMods: [], tagText: '', tagTone: '' };
  }
  const n = Number(p.n) || 0;
  const mods = p.mods && typeof p.mods === 'object' ? p.mods : null;
  const hasAnyMod = !!(mods && MODS.some(([k]) => Number.isInteger(mods[k]) && mods[k] > 0));
  const missingMods = hasAnyMod
    ? MODS.filter(([k]) => !(Number.isInteger(mods[k]) && mods[k] > 0)).map(([, name]) => name)
    : [];

  if (n > 160) {
    return { complete: false, merged: true, missingMods, tagText: '合卷收录', tagTone: 'info' };
  }
  if (missingMods.length) {
    const missLabel = '缺' + missingMods.join('/');
    return {
      complete: false,
      merged: false,
      missingMods,
      tagText: n < 100 ? `${missLabel} · 待补全` : missLabel,
      tagTone: 'warn',
    };
  }
  if (n < 100) {
    return { complete: false, merged: false, missingMods: [], tagText: '题量待补全', tagTone: 'warn' };
  }
  return { complete: true, merged: false, missingMods: [], tagText: '', tagTone: '' };
}

/** 同年份内优先排列完整真题卷（保持最新年份在前，不再把网友回忆残卷顶在首屏第一条）。 */
export function sortPapersCompleteFirst(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const ya = Number(a && a.year) || 0;
    const yb = Number(b && b.year) || 0;
    if (ya !== yb) return yb - ya;
    const ca = paperCompleteness(a).complete ? 1 : 0;
    const cb = paperCompleteness(b).complete ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const na = Number(a && a.n) || 0;
    const nb = Number(b && b.n) || 0;
    if (na !== nb) return nb - na;
    return (Number(b && b.id) || 0) - (Number(a && a.id) || 0);
  });
}
