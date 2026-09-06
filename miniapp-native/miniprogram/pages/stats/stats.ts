import { fetchCheckinSummary, fetchGrowth, fetchProfile, trackEvent } from '../../api/index';
import { fetchExamAttempts, fetchShenlunStats } from '../../api/exam';
import type { ShenlunStats } from '../../api/exam-types';
import { examTrend, type ExamTrend } from '../../utils/kg-exam-report';
import { loadPStats, modName, streakDays, todayCount } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';
import { moduleMeta } from '../../utils/module-meta';

interface ModRow {
  key: string;
  name: string;
  done: number;
  correct: number;
  pct: number;
  color: string;
  soft: string;
  icon: string;
  weak: boolean;
  gap: number;
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

// 各模块正确率行 + 弱项判定（≥5 题的模块中低于均值 10 个点）
function buildRows(byModule: Record<string, { done: number; correct: number }>): ModRow[] {
  const rows: ModRow[] = Object.keys(byModule).map((k) => {
    const m = byModule[k];
    const meta = moduleMeta(k);
    return {
      key: k,
      name: modName(k),
      done: m.done,
      correct: m.correct,
      pct: m.done ? Math.round((m.correct / m.done) * 100) : 0,
      color: meta.color,
      soft: meta.soft,
      icon: meta.icon,
      weak: false,
      gap: 0,
    };
  });
  rows.sort((a, b) => b.done - a.done);
  const scored = rows.filter((r) => r.done >= 5);
  if (scored.length >= 2) {
    const avg = Math.round(scored.reduce((n, r) => n + r.pct, 0) / scored.length);
    for (const r of scored) {
      if (avg - r.pct >= 10) {
        r.weak = true;
        r.gap = avg - r.pct;
      }
    }
  }
  return rows;
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
    modSrc: '本机口径',
    hmCols: [] as HmCell[][],
    hmTotal: 0,
    hmYLabels: ['一', '', '三', '', '五', '', '日'],
    zero: false,
    examTrend: null as ExamTrend | null,
    slStats: null as ShenlunStats | null,
    slLast: '',
    slTypes: [] as string[],
    slIssues: [] as Array<{ tag: string; tone: string; text: string }>,
    slIssuesOpen: false,
  },
  _hmTracked: false,
  onShow() {
    syncTabBar(this, 3);
    const rows = buildRows(loadPStats().byModule);
    this.setData({
      today: todayCount(),
      total: rows.reduce((n, r) => n + r.done, 0),
      streak: streakDays(),
      rows,
    });
    this.syncZero();
    this.loadGrowth();
    this.loadHeatmap();
    this.loadExamTrend();
    this.loadSlStats();
    // 预测分卡首次 attached 自载；再次进页静默刷新（与 H5 onShow → $refs.predict.load() 一致）
    const pc = this.selectComponent('#predict') as (WechatMiniprogram.Component.TrivialInstance & { load?: () => void }) | null;
    if (pc && typeof pc.load === 'function') pc.load();
  },
  // 模考成绩趋势（近 10 次，与 H5 stats.vue examTrendD 同源：/api/exam/attempts + profile.target_score）
  async loadExamTrend() {
    try {
      const [att, prof] = await Promise.all([fetchExamAttempts(null, 20), fetchProfile()]);
      const target = prof.profile && prof.profile.target_score != null ? prof.profile.target_score : null;
      this.setData({ examTrend: examTrend(att.items || [], target) });
    } catch (e) {
      /* 非关键路径：失败不渲染 */
    }
  },
  onExamReport(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    if (id) wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + id });
  },
  async loadSlStats() {
    try {
      const s = await fetchShenlunStats();
      const d = s.last_at ? new Date(s.last_at * 1000) : null;
      const p = (n: number) => (n < 10 ? '0' + n : String(n));
      this.setData({
        slStats: s,
        slLast: d ? p(d.getMonth() + 1) + '-' + p(d.getDate()) : '',
        slTypes: (s.by_type || []).map((t) => t.qtype + ' ×' + t.n),
        slIssues: (s.issues || []).map((it) => ({
          tag: it.kind === '提升建议' ? '建议' : '遗漏',
          tone: it.kind === '提升建议' ? 'warn' : 'bad',
          text: it.text,
        })),
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onSlIssues() {
    this.setData({ slIssuesOpen: !this.data.slIssuesOpen });
  },
  goShenlun() {
    wx.navigateTo({ url: '/pkgExam/shenlun/shenlun?tab=r' });
  },
  // 0 数据折叠为解锁卡：累计/今日/连签/热力图全为 0 才折叠
  syncZero() {
    const d = this.data;
    this.setData({ zero: !d.total && !d.today && !d.streak && !d.hmTotal });
  },
  onGoPractice() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },
  // 模块正确率/累计题数：服务端 answer_log（按 uid，与 H5 统计页同源）为准，失败保留本机 pstats
  async loadGrowth() {
    try {
      const g = await fetchGrowth();
      const byModule: Record<string, { done: number; correct: number }> = {};
      for (const k of Object.keys(g.modules || {})) {
        byModule[k] = { done: g.modules[k].n || 0, correct: g.modules[k].c || 0 };
      }
      const rows = buildRows(byModule);
      this.setData({
        rows,
        total: g.total ? g.total.n || 0 : rows.reduce((n, r) => n + r.done, 0),
        modSrc: '云端口径',
      });
      this.syncZero();
    } catch (e) {
      /* 离线：沿用 onShow 已渲染的本机 pstats */
    }
  },
  onWeakGo(e: WechatMiniprogram.TouchEvent) {
    const mod = String(e.currentTarget.dataset.mod || '');
    wx.navigateTo({ url: `/pages/practice/practice?module=${mod}` });
  },
  // 热力图与连签：服务端 answer_log（按 uid）为准，失败降级本机 pstats
  async loadHeatmap() {
    let days: Record<string, number> = {};
    try {
      const d = await fetchCheckinSummary();
      for (const k of Object.keys(d.days || {})) {
        days[k] = (d.days as Record<string, { n: number }>)[k].n || 0;
      }
      if (d.streak != null) this.setData({ streak: d.streak });
      if (d.today_n != null) this.setData({ today: d.today_n });
      if (!this._hmTracked) {
        this._hmTracked = true;
        trackEvent('heatmap_view', 'stats');
      }
    } catch (e) {
      days = { ...loadPStats().days };
    }
    const { cols, total } = buildHeatmap(days);
    this.setData({ hmCols: cols, hmTotal: total });
    this.syncZero();
  },
});
