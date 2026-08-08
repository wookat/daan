import { loadPStats, modName, streakDays, todayCount } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface ModRow {
  key: string;
  name: string;
  done: number;
  correct: number;
  pct: number;
}

interface DayCol {
  label: string;
  n: number;
  acc: number | null;
  h: number;
}

const RADAR_MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'];

// tsconfig 未引 DOM lib，这里只声明用到的 2d 上下文子集
interface Canvas2D {
  scale(x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

Page({
  data: {
    today: 0,
    total: 0,
    totalPct: 0,
    streak: 0,
    rows: [] as ModRow[],
    trend: [] as DayCol[],
    weakName: '',
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
    const totalDone = rows.reduce((n, r) => n + r.done, 0);
    const totalCorrect = rows.reduce((n, r) => n + r.correct, 0);

    // 最近 7 天趋势
    const trend: DayCol[] = [];
    let maxN = 1;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const n = s.days[key] || 0;
      const c = (s.daysCorrect && s.daysCorrect[key]) || 0;
      maxN = Math.max(maxN, n);
      trend.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        n,
        acc: n ? Math.round((c / n) * 100) : null,
        h: 0,
      });
    }
    trend.forEach((t) => {
      t.h = t.n ? Math.max(8, Math.round((t.n / maxN) * 100)) : 4;
    });

    // 弱项提示：做题量 ≥5 中正确率最低的模块
    const weak = rows.filter((r) => r.done >= 5).sort((a, b) => a.pct - b.pct)[0];

    this.setData({
      today: todayCount(),
      total: totalDone,
      totalPct: totalDone ? Math.round((totalCorrect / totalDone) * 100) : 0,
      streak: streakDays(),
      rows,
      trend,
      weakName: weak && weak.pct < 70 ? weak.name : '',
    });
    this.drawRadar(rows);
  },

  drawRadar(rows: ModRow[]) {
    const query = this.createSelectorQuery();
    query
      .select('#radar')
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res && res[0];
        if (!info || !info.node) return;
        const canvas = info.node as WechatMiniprogram.Canvas;
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = info.width * dpr;
        canvas.height = info.height * dpr;
        const ctx = canvas.getContext('2d') as Canvas2D;
        ctx.scale(dpr, dpr);
        const cx = info.width / 2;
        const cy = info.height / 2;
        const R = Math.min(cx, cy) - 34;
        const N = RADAR_MODS.length;
        const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
        const pt = (i: number, r: number) => ({
          x: cx + r * Math.cos(angle(i)),
          y: cy + r * Math.sin(angle(i)),
        });
        // 网格
        ctx.strokeStyle = 'rgba(125, 129, 143, 0.35)';
        ctx.lineWidth = 1;
        for (let ring = 1; ring <= 4; ring++) {
          ctx.beginPath();
          for (let i = 0; i <= N; i++) {
            const p = pt(i % N, (R * ring) / 4);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        for (let i = 0; i < N; i++) {
          const p = pt(i, R);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        // 数据多边形（正确率）
        const byKey: Record<string, ModRow> = {};
        rows.forEach((r) => {
          byKey[r.key] = r;
        });
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const r = byKey[RADAR_MODS[i % N]];
          const v = r && r.done ? r.pct / 100 : 0;
          const p = pt(i % N, R * v);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.fillStyle = 'rgba(59, 111, 245, 0.25)';
        ctx.strokeStyle = '#3b6ff5';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
        // 标签
        ctx.fillStyle = '#7d818f';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < N; i++) {
          const p = pt(i, R + 20);
          ctx.fillText(modName(RADAR_MODS[i]), p.x, p.y);
        }
      });
  },

  onMastery() {
    wx.navigateTo({ url: '/pages/mastery/mastery' });
  },
  onWeekly() {
    wx.navigateTo({ url: '/pages/weekly/weekly' });
  },
  onPracticeWeak() {
    const weak = this.data.rows.filter((r) => r.done >= 5).sort((a, b) => a.pct - b.pct)[0];
    let url = '/pages/practice/practice?count=10&source=stats';
    if (weak) url += '&module=' + weak.key;
    wx.navigateTo({ url });
  },
});
