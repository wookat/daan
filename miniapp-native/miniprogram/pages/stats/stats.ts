import { fetchCheckinSummary, trackEvent } from '../../api/index';
import { loadPStats, modName, streakDays, todayCount } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface ModRow {
  key: string;
  name: string;
  done: number;
  correct: number;
  pct: number;
}

interface HmCell {
  lv: number;
  future: boolean;
}

function dateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function buildHeatmap(days: Record<string, number>): { cols: HmCell[][]; total: number } {
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 周一=0
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow - 77);
  const cols: HmCell[][] = [];
  let total = 0;
  for (let w = 0; w < 12; w++) {
    const col: HmCell[] = [];
    for (let r = 0; r < 7; r++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + r);
      const future = d > today;
      const n = days[dateKey(d)] || 0;
      if (!future) total += n;
      let lv = 0;
      if (n >= 30) lv = 4;
      else if (n >= 15) lv = 3;
      else if (n >= 5) lv = 2;
      else if (n > 0) lv = 1;
      col.push({ lv, future });
    }
    cols.push(col);
  }
  return { cols, total };
}

Page({
  data: {
    today: 0,
    total: 0,
    streak: 0,
    rows: [] as ModRow[],
    hmCols: [] as HmCell[][],
    hmTotal: 0,
    hmYLabels: ['一', '', '三', '', '五', '', '日'],
  },
  _hmTracked: false,
  onShow() {
    syncTabBar(this, 3);
    const s = loadPStats();
    const rows: ModRow[] = Object.keys(s.byModule).map((k) => {
      const m = s.byModule[k];
      return {
        key: k,
        name: modName(k),
        done: m.done,
        correct: m.correct,
        pct: m.done ? Math.round((m.correct / m.done) * 100) : 0,
      };
    });
    rows.sort((a, b) => b.done - a.done);
    this.setData({
      today: todayCount(),
      total: rows.reduce((n, r) => n + r.done, 0),
      streak: streakDays(),
      rows,
    });
    this.loadHeatmap();
  },
  // 热力图：服务端 answer_log（按 uid）为准，失败降级本机 pstats
  async loadHeatmap() {
    let days: Record<string, number> = {};
    try {
      const d = await fetchCheckinSummary();
      for (const k of Object.keys(d.days || {})) {
        days[k] = (d.days as Record<string, { n: number }>)[k].n || 0;
      }
      if (!this._hmTracked) {
        this._hmTracked = true;
        trackEvent('heatmap_view', 'stats');
      }
    } catch (e) {
      days = { ...loadPStats().days };
    }
    const { cols, total } = buildHeatmap(days);
    this.setData({ hmCols: cols, hmTotal: total });
  },
});
