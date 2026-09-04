// 完成页薄弱考点聚合（纯函数）：先按 tag3 聚合错题，再按展示名合并同名条目

const subName = (qt) => (qt && qt.includes('-') ? qt.split('-').slice(1).join('-') : qt || null);

/**
 * items → 薄弱考点前 3（错题数倒序）。
 * /api/questions 不回 tag3_name，展示名只能取 question_type 子名；同子名多个 tag3 合并为一条，
 * 合并后 tag3 仅在唯一时保留，否则置 null 走 submodule 强化入口。
 */
export function weakSpots(items, modName) {
  const byTag = {};
  for (const q of items || []) {
    if (!q || !q._picked || q._picked === q.answer) continue;
    const key = q.tag3 || q.question_type || q.module || 'other';
    if (!byTag[key]) {
      const sub = subName(q.question_type || '');
      byTag[key] = { key, name: sub || modName(q.module), module: q.module, submodule: sub, tag3: q.tag3 || null, n: 0 };
    }
    byTag[key].n++;
  }
  const byName = {};
  for (const w of Object.values(byTag)) {
    const k = w.module + '|' + w.name;
    const m = byName[k];
    if (!m) {
      byName[k] = { ...w };
    } else {
      m.n += w.n;
      if (m.tag3 !== w.tag3) m.tag3 = null;
      if (!m.submodule) m.submodule = w.submodule;
    }
  }
  return Object.values(byName)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
}
