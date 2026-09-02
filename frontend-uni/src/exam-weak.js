// R307：模考报告薄弱模块判定（纯函数，fail-closed）
const PRACTICE_MODS = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];
const MIN_GAP = 5;
const LOW_PCT = 60;
const MIN_N = 3;

function validPct(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

export function weakModule(modules) {
  if (!Array.isArray(modules)) return null;
  const rows = modules.filter(
    (m) =>
      m &&
      PRACTICE_MODS.includes(m.key) &&
      typeof m.n === 'number' &&
      Number.isFinite(m.n) &&
      m.n >= MIN_N &&
      validPct(m.pct)
  );
  if (!rows.length) return null;
  let best = null;
  for (const m of rows) {
    if (!validPct(m.avgPct)) continue;
    const gap = m.avgPct - m.pct;
    if (gap >= MIN_GAP && (!best || gap > best.gap)) best = { m, gap };
  }
  if (best) {
    return {
      key: best.m.key,
      name: best.m.name || best.m.key,
      reason: '低于全站均值 ' + Math.round(best.gap) + ' 个百分点',
    };
  }
  const low = rows.slice().sort((a, b) => a.pct - b.pct)[0];
  if (low && low.pct < LOW_PCT) {
    return { key: low.key, name: low.name || low.key, reason: '本卷正确率 ' + low.pct + '%，全卷最低' };
  }
  return null;
}
