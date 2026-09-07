// R307：模考报告薄弱模块判定（纯函数，fail-closed）
// 判定按「已答」口径：answered / ansPct(=correct/answered)，缺省回落 n / pct（旧 attempt 无 answered）；整模块未答不判薄弱
const PRACTICE_MODS = ['changshi', 'yanyu', 'shuliang', 'panduan', 'ziliao'];
const MIN_GAP = 5;
const LOW_PCT = 60;
const MIN_N = 3;

function validPct(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

function validCount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function answeredOf(m) {
  return m.answered == null ? m.n : m.answered;
}

function pctOf(m) {
  if (validPct(m.ansPct)) return m.ansPct;
  if (m.answered != null && validCount(m.correct) && m.answered > 0) return Math.round((m.correct / m.answered) * 100);
  return m.pct;
}

function partialNote(m) {
  const a = answeredOf(m);
  return m.answered != null && a < m.n ? '（按已答 ' + a + '/' + m.n + ' 题折算）' : '';
}

export function weakModule(modules) {
  if (!Array.isArray(modules)) return null;
  const rows = modules.filter(
    (m) =>
      m &&
      PRACTICE_MODS.includes(m.key) &&
      validCount(m.n) &&
      validCount(answeredOf(m)) &&
      answeredOf(m) >= MIN_N &&
      validPct(pctOf(m))
  );
  if (!rows.length) return null;
  let best = null;
  for (const m of rows) {
    if (!validPct(m.avgPct)) continue;
    const gap = m.avgPct - pctOf(m);
    if (gap >= MIN_GAP && (!best || gap > best.gap)) best = { m, gap };
  }
  if (best) {
    return {
      key: best.m.key,
      name: best.m.name || best.m.key,
      reason: '低于全站均值 ' + Math.round(best.gap) + ' 个百分点',
    };
  }
  const low = rows.slice().sort((a, b) => pctOf(a) - pctOf(b))[0];
  if (low && pctOf(low) < LOW_PCT) {
    return { key: low.key, name: low.name || low.key, reason: '本卷正确率 ' + pctOf(low) + '%，全卷最低' + partialNote(low) };
  }
  return null;
}
