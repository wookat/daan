export const DAILY_GOALS = [20, 50, 100];

export function normalizeDailyGoal(v) {
  return typeof v === 'number' && DAILY_GOALS.includes(v) ? v : null;
}

export function adoptServerDailyGoal(localGoal, profile) {
  if (!profile || typeof profile !== 'object') return null;
  const server = normalizeDailyGoal(profile.daily_goal);
  if (server == null) return null;
  return server === normalizeDailyGoal(localGoal) ? null : server;
}
