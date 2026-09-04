export function buildPaceRows(perModule, durationMin, total) {
  const pm = perModule || {};
  const dm = Number(durationMin) || 0;
  const tt = Number(total) || 0;
  if (dm <= 0 || tt <= 0) return [];
  const keys = Object.keys(pm).filter((k) => pm[k] && Number(pm[k].n) > 0);
  const sum = keys.reduce((a, k) => a + (Number(pm[k].secs) || 0), 0);
  if (sum <= 0) return [];
  return keys.map((k) => {
    const n = Number(pm[k].n);
    const secs = Math.max(0, Number(pm[k].secs) || 0);
    // answered 缺失（旧 attempt）视为全部作答；整模块未作答不参与快慢判定
    const answered = pm[k].answered == null ? n : Math.min(n, Math.max(0, Number(pm[k].answered) || 0));
    const perQ = (dm * 60) / tt;
    const refSecs = Math.round(perQ * n);
    if (answered === 0) return { key: k, secs, refSecs, answered, n, status: 'skip' };
    const judgeRef = Math.round(perQ * answered);
    let status = 'ok';
    if (secs > judgeRef * 1.2) status = 'over';
    else if (secs < judgeRef * 0.6) status = 'fast';
    return { key: k, secs, refSecs: judgeRef, answered, n, status };
  });
}

export function fmtMin(secs) {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return r + '秒';
  return r ? m + '分' + r + '秒' : m + '分';
}
