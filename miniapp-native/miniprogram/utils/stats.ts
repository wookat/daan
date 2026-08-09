// 本地练习统计（storage key 与 frontend-uni 的 pstats/dailyGoal 一致）

export interface PStats {
  byModule: Record<string, { done: number; correct: number }>;
  bySub?: Record<string, { done: number; correct: number }>;
  days: Record<string, number>;
  daysCorrect?: Record<string, number>;
  bestStreak?: number;
}

export function loadPStats(): PStats {
  return wx.getStorageSync<PStats>('pstats') || { byModule: {}, days: {} };
}

export function savePStats(s: PStats): void {
  wx.setStorageSync('pstats', s);
}

// 日界按设备本地时区（国内用户即北京时间），与服务端 answer_log 的 Asia/Shanghai 日界一致
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function todayKey(): string {
  return dayKey();
}

export function todayCount(): number {
  return loadPStats().days[todayKey()] || 0;
}

export function getDailyGoal(): number {
  return wx.getStorageSync<number>('dailyGoal') || 20;
}

export function setDailyGoal(n: number): void {
  wx.setStorageSync('dailyGoal', n);
}

export function recordStat(module: string, correct: boolean, submodule?: string | null): void {
  const s = loadPStats();
  if (!s.byModule[module]) s.byModule[module] = { done: 0, correct: 0 };
  s.byModule[module].done++;
  if (correct) s.byModule[module].correct++;
  if (submodule) {
    if (!s.bySub) s.bySub = {};
    const key = module + '|' + submodule;
    if (!s.bySub[key]) s.bySub[key] = { done: 0, correct: 0 };
    s.bySub[key].done++;
    if (correct) s.bySub[key].correct++;
  }
  const day = todayKey();
  s.days[day] = (s.days[day] || 0) + 1;
  if (!s.daysCorrect) s.daysCorrect = {};
  if (correct) s.daysCorrect[day] = (s.daysCorrect[day] || 0) + 1;
  savePStats(s);
}

export const MODULE_NAMES: Record<string, string> = {
  ziliao: '资料分析',
  shuliang: '数量关系',
  yanyu: '言语理解',
  panduan: '判断推理',
  changshi: '常识判断',
  shenlun: '申论',
};

export function modName(m: string): string {
  return MODULE_NAMES[m] || m || '行测';
}

export function streakDays(): number {
  const days = loadPStats().days;
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = dayKey(d);
    if (days[key]) {
      n++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return n;
}
