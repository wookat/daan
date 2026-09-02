// 练习偏好共享白名单与服务端采用决策（home/practice 同一口径）
export const GROUP_SIZES = [10, 20, 30, 50];

export function normalizeGroupSize(v) {
  return typeof v === 'number' && GROUP_SIZES.includes(v) ? v : null;
}

export function normalizeFlag(v) {
  return typeof v === 'number' && (v === 0 || v === 1) ? v : null;
}

// 返回需覆盖本地的差异对象 {groupSize?, timedMode?, autoNext?}；
// 服务端值缺失/非法/与本地一致时对应键不出现；不修改输入。
export function adoptServerPracticePrefs(local, profile) {
  const out = {};
  if (!profile || typeof profile !== 'object') return out;
  const l = local || {};
  const gs = normalizeGroupSize(profile.group_size);
  if (gs != null && gs !== normalizeGroupSize(l.groupSize)) out.groupSize = gs;
  const tm = normalizeFlag(profile.timed_mode);
  if (tm != null && (tm === 1) !== !!l.timedMode) out.timedMode = tm === 1;
  const an = normalizeFlag(profile.auto_next);
  if (an != null && (an === 1) !== !!l.autoNext) out.autoNext = an === 1;
  return out;
}
