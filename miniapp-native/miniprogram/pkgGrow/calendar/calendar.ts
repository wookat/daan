// 对照 frontend-uni/src/pages/stats/calendar.vue：服务端 /api/checkin/summary（Asia/Shanghai 日界）优先，降级本地 pstats
import { fetchCheckinBadges, fetchCheckinSummary } from '../../api/index';
import type { CheckinBadgesResp } from '../../api/types';
import { cnToday } from '../../utils/cn-date';
import { loadPStats } from '../../utils/stats';

interface CalCell {
  d: number;
  cls: string;
}
interface BadgeView {
  days: number;
  unlocked: boolean;
}
interface NextMilestone {
  days: number;
  left: number;
  pct: number;
}

const WEEK = ['一', '二', '三', '四', '五', '六', '日'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

Page({
  data: {
    week: WEEK,
    y: 0,
    m: 0, // 0-based
    ymText: '',
    isCurMonth: true,
    monthDays: 0,
    monthCount: 0,
    cells: [] as CalCell[],
    badgeLoading: true,
    streak: 0,
    bestStreak: 0,
    badges: [] as BadgeView[],
    next: null as NextMilestone | null,
    canPoster: false,
    dayErr: false,
  },

  _dayMap: {} as Record<string, number>,
  _svDays: null as Record<string, number> | null,
  _badgeInfo: null as CheckinBadgesResp | null,

  onLoad() {
    const t = cnToday();
    this.setData({ y: t.getFullYear(), m: t.getMonth() });
  },

  onShow() {
    const p = loadPStats();
    this._dayMap = this._svDays || p.days || {};
    this.render();
    this.loadBadges();
    this.loadDays();
  },

  async loadDays() {
    try {
      const d = await fetchCheckinSummary();
      if (d && d.days) {
        const m: Record<string, number> = {};
        for (const k of Object.keys(d.days)) m[k] = (d.days[k] && d.days[k].n) || 0;
        this._svDays = m;
        this._dayMap = m;
        this.setData({ dayErr: false });
        this.render();
      }
    } catch (_e) {
      // 非关键路径：降级本地 pstats
      this.setData({ dayErr: !this._svDays });
    }
  },

  async loadBadges() {
    try {
      this._badgeInfo = await fetchCheckinBadges();
    } catch (_e) {
      if (!this._badgeInfo) this._badgeInfo = { streak: 0, best_streak: 0, badges: [] };
    }
    this.renderBadges();
  },

  renderBadges() {
    const b = this._badgeInfo;
    if (!b) return;
    const ms = (b.badges || []).map((x) => x.days);
    const s = b.streak || 0;
    const nextDays = ms.find((m) => m > s);
    let next: NextMilestone | null = null;
    if (nextDays) {
      const prev = ms.filter((m) => m <= s).pop() || 0;
      next = { days: nextDays, left: nextDays - s, pct: Math.round(((s - prev) / (nextDays - prev)) * 100) };
    }
    this.setData({
      badgeLoading: false,
      streak: s,
      bestStreak: b.best_streak || 0,
      badges: (b.badges || []).map((x) => ({ days: x.days, unlocked: !!x.unlocked })),
      next,
      canPoster: this.calcCanPoster(),
    });
  },

  calcCanPoster(): boolean {
    const days = this._dayMap;
    if (Object.keys(days).some((k) => days[k] > 0)) return true;
    const b = this._badgeInfo;
    return !!(b && (b.streak || b.best_streak));
  },

  render() {
    const { y, m } = this.data;
    const today = cnToday();
    const isCurMonth = y === today.getFullYear() && m === today.getMonth();
    const prefix = `${y}-${pad2(m + 1)}-`;
    const days = this._dayMap;
    const keys = Object.keys(days).filter((k) => k.startsWith(prefix));
    const monthDays = keys.filter((k) => days[k] > 0).length;
    const monthCount = keys.reduce((s, k) => s + (days[k] || 0), 0);

    const first = new Date(y, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(y, m + 1, 0).getDate();
    const cells: CalCell[] = [];
    for (let i = 0; i < lead; i++) cells.push({ d: 0, cls: 'blank' });
    for (let d = 1; d <= total; d++) {
      const n = days[`${prefix}${pad2(d)}`] || 0;
      let cls = '';
      if (n >= 10) cls = 'full';
      else if (n > 0) cls = 'part';
      if (isCurMonth && d === today.getDate()) cls += ' today';
      cells.push({ d, cls });
    }
    this.setData({
      ymText: `${y} 年 ${m + 1} 月`,
      isCurMonth,
      monthDays,
      monthCount,
      cells,
      canPoster: this.calcCanPoster(),
    });
  },

  onPrev() {
    this.shift(-1);
  },
  onNext() {
    this.shift(1);
  },
  shift(dir: number) {
    if (dir > 0 && this.data.isCurMonth) return;
    let { y, m } = this.data;
    m += dir;
    if (m < 0) {
      m = 11;
      y--;
    }
    if (m > 11) {
      m = 0;
      y++;
    }
    this.setData({ y, m });
    this.render();
  },

  onRetry() {
    this.loadDays();
    this.loadBadges();
  },

  onPoster() {
    if (!this.data.canPoster) return;
    wx.navigateTo({ url: '/pages/social/poster' });
  },
});
