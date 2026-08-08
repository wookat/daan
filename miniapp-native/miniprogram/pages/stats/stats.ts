import { loadPStats, modName, streakDays, todayCount } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface ModRow {
  key: string;
  name: string;
  done: number;
  correct: number;
  pct: number;
}

Page({
  data: {
    today: 0,
    total: 0,
    streak: 0,
    rows: [] as ModRow[],
  },
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
  },
});
