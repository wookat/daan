// 东八区日界工具：服务端 checkin/growth/daily_set 都按北京时间计日/计周，
// 客户端热力图/日历/每日一练必须用同一口径，避免跨时区设备当日作答不落图（与 H5 stats.vue cnToday 一致）。

/** 当前时刻在东八区的本地日期（返回的 Date 仅用 getFullYear/getMonth/getDate/getDay） */
export function cnToday(): Date {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60000);
}

export function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

/** YYYY-MM-DD */
export function ymd(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** 东八区今天的 YYYY-MM-DD（与 H5 practice.vue cnDay 一致） */
export function cnDayKey(): string {
  return ymd(cnToday());
}

/** 从 checkin summary 的 days:{date:{n,c}} 取每天题数 */
export function dayCountMap(days: Record<string, { n?: number } | number> | null | undefined): Record<string, number> {
  const m: Record<string, number> = {};
  if (!days) return m;
  for (const k of Object.keys(days)) {
    const v = days[k];
    m[k] = typeof v === 'number' ? v : (v && v.n) || 0;
  }
  return m;
}

export interface HeatCell {
  lv: number;
  future: boolean;
}

/** 近 12 周热力图：本周周一往前推 11 周；档位 0/1-4/5-14/15-29/30+ 与 H5 一致 */
export function buildHeatmap(days: Record<string, number>): { cols: HeatCell[][]; total: number } {
  const today = cnToday();
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - 77);
  const cols: HeatCell[][] = [];
  for (let w = 0; w < 12; w++) {
    const col: HeatCell[] = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + r);
      const future = d > today;
      const n = days[ymd(d)] || 0;
      let lv = 0;
      if (n >= 30) lv = 4;
      else if (n >= 15) lv = 3;
      else if (n >= 5) lv = 2;
      else if (n > 0) lv = 1;
      col.push({ lv, future });
    }
    cols.push(col);
  }
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 83);
  let total = 0;
  for (const k of Object.keys(days)) {
    const d = new Date(k + 'T00:00:00');
    if (d >= from && d <= today) total += days[k];
  }
  return { cols, total };
}

/** 从 dayMap 倒推连续打卡天数（今天没练则从昨天起算），与 H5 checkinStreak 一致 */
export function streakFromDays(days: Record<string, number>): number {
  const t = cnToday();
  let d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  if (!days[ymd(d)]) d.setDate(d.getDate() - 1);
  let s = 0;
  while (days[ymd(d)]) {
    s++;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return s;
}

export function fmtTs(t: number | null | undefined, withTime = true): string {
  if (!t) return '';
  const d = new Date(t < 1e12 ? t * 1000 : t);
  const base = d.getMonth() + 1 + '/' + d.getDate();
  return withTime ? base + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : base;
}
