export function buildPaceRows(perModule, durationMin, total) {
  const pm = perModule || {};
  const dm = Number(durationMin) || 0;
  const tt = Number(total) || 0;
  if (dm <= 0 || tt <= 0) return [];
  const keys = Object.keys(pm).filter((k) => pm[k] && Number(pm[k].n) > 0);
  const sum = keys.reduce((a, k) => a + (Number(pm[k].secs) || 0), 0);
  if (sum <= 0) return [];
  return keys.map((k) => {
    const secs = Math.max(0, Number(pm[k].secs) || 0);
    const refSecs = Math.round((dm * 60 * Number(pm[k].n)) / tt);
    let status = 'ok';
    if (secs > refSecs * 1.2) status = 'over';
    else if (secs < refSecs * 0.6) status = 'fast';
    return { key: k, secs, refSecs, status };
  });
}

export function fmtMin(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return r + '秒';
  return r ? m + '分' + r + '秒' : m + '分';
}
