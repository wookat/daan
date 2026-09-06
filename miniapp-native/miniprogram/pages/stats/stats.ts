// 学习统计：对齐 H5 pages/stats/stats.vue 全部区块（服务端 answer_log 口径优先，离线降级本机 pstats）
import { fetchCheckinSummary, fetchGrowth, fetchMistakes, fetchProfile, fetchReviewDue, trackEvent } from '../../api/index';
import type { GrowthResp } from '../../api/types';
import { fetchExamAttempts, fetchShenlunStats } from '../../api/exam';
import type { ShenlunStats } from '../../api/exam-types';
import { fetchMasteryMap, fetchRecommend, fetchStats, type StatsResp, type WeakTopic } from '../../api/grow';
import { examTrend, type ExamTrend } from '../../utils/kg-exam-report';
import type { BarItem } from '../../components/kg-chart-bars/index';
import type { RadarAxis } from '../../components/kg-chart-radar/index';
import { buildHeatmap, dayCountMap, fmtTs, streakFromDays, type HeatCell } from '../../utils/cn-date';
import { dayKey, loadPStats, modName, type PStats } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

const MODS = [
  { key: 'ziliao', name: '资料' },
  { key: 'shuliang', name: '数量' },
  { key: 'yanyu', name: '言语' },
  { key: 'panduan', name: '判断' },
  { key: 'changshi', name: '常识' },
];
const MOD_KEY: Record<string, string> = { 资料分析: 'ziliao', 数量关系: 'shuliang', 言语理解: 'yanyu', 判断推理: 'panduan', 常识判断: 'changshi' };

/** 0 数据折叠阈值：答满该题数前整页只显示解锁卡 */
const UNLOCK_N = 10;

interface ModRow {
  module: string;
  key: string;
  name: string;
  n: number;
}
interface TypeRow {
  question_type: string;
  name: string;
  n: number;
}
interface ReasonRow {
  error_reason: string;
  n: number;
  pct: number;
}
interface GrowthRow {
  week: string;
  label: string;
  n: number;
  pct: number;
  tone: string;
}
interface Medal {
  icon: string;
  name: string;
  got: boolean;
  progress: string;
  ringStyle: string;
}
interface SubChip {
  sub: string;
  done: number;
  pct: number;
  lv: string;
}
interface SubGroup {
  module: string;
  name: string;
  subs: SubChip[];
}
interface RecoView extends WeakTopic {
  name: string;
  meta: string;
}

function pctTone(pct: number): string {
  return pct < 60 ? 'bad' : pct < 80 ? 'warn' : 'ok';
}

function typeName(t: string | null): string {
  if (!t) return '未分类';
  return String(t).replace(/^(数量关系|数学运算|资料分析|言语理解(与表达)?|判断推理|逻辑判断|常识判断|常识)[-－·：:]/, '');
}

// 模考成绩趋势（H5 exam-trend.js：真实已交卷 attempts，<2 条不渲染）
Page({
  data: {
    kmLegendLow: '<60% 薄弱',
    kmLegendHigh: '>80% 掌握',
    unlockN: UNLOCK_N,
    hasData: false,
    unlockLeft: UNLOCK_N,
    unlockPct: 0,
    loadErr: '',
    // 英雄区
    totalDone: 0,
    accPct: 0,
    streak: 0,
    hmTotal: 0,
    hmCols: [] as HeatCell[][],
    // 今日待办
    dueN: 0,
    reco: [] as RecoView[],
    // 雷达
    axes: [] as RadarAxis[],
    hasRadar: false,
    weakAxes: [] as RadarAxis[],
    // 错题
    byModule: [] as ModRow[],
    shownModules: [] as ModRow[],
    modTotal: 1,
    modOpen: false,
    byType: [] as TypeRow[],
    shownTypes: [] as TypeRow[],
    topOpen: false,
    byReason: [] as ReasonRow[],
    // 近 7 日
    trendBars: [] as BarItem[],
    trendHas: false,
    // 成长轨迹
    gwMod: '',
    gwOptions: [] as { label: string; value: string }[],
    growthRows: [] as GrowthRow[],
    growthDeltaText: '',
    growthUp: true,
    showGrowth: false,
    // 申论
    sl: null as ShenlunStats | null,
    slLast: '',
    slIssuesOpen: false,
    // 模考趋势
    exam: null as ExamTrend | null,
    examBars: [] as BarItem[],
    examTitle: '',
    examMid: '',
    // 掌握度地图
    kmCov: null as number | null,
    kmCovText: '--',
    kmCovStyle: '',
    kmDesc: '三级考点五档色阶，看清每个考点的掌握度',
    // 考点地图（本机 bySub）
    subMap: [] as SubGroup[],
    // 勋章
    medals: [] as Medal[],
    medalsGot: 0,
  },
  _pstats: { byModule: {}, days: {} } as PStats,
  _growth: null as GrowthResp | null,
  _hmDays: null as Record<string, number> | null,
  _svStreak: null as number | null,
  _masteredCount: 0,
  _hmTracked: false,

  onShow() {
    syncTabBar(this, 3);
    this._pstats = loadPStats();
    this.recompute();
    this.loadHeatmap();
    // 预测分卡首次 attached 自载；再次进页静默刷新（与 H5 onShow → $refs.predict.load() 一致）
    const pc = this.selectComponent('#predict') as (WechatMiniprogram.Component.TrivialInstance & { load?: () => void }) | null;
    if (pc && typeof pc.load === 'function') pc.load();
    this.loadGrowth();
    this.loadReco();
    this.loadSlStats();
    this.loadMastery();
    this.loadExamTrend();
    this.load();
  },

  // ---------- 派生量（H5 computed）----------
  recompute() {
    const ps = this._pstats;
    const g = this._growth;
    const sv = g && g.total;
    const totalDone = sv ? sv.n || 0 : Object.values(ps.byModule).reduce((s, m) => s + m.done, 0);
    const correct = sv ? sv.c || 0 : Object.values(ps.byModule).reduce((s, m) => s + m.correct, 0);
    const accPct = totalDone ? Math.round((correct / totalDone) * 100) : 0;
    const days = this._hmDays || ps.days || {};
    const { cols, total: hmTotal } = buildHeatmap(days);
    const streak = this._svStreak != null ? this._svStreak : streakFromDays(ps.days || {});

    const axes: RadarAxis[] = MODS.map((m) => {
      if (g && g.modules) {
        const s = g.modules[m.key] || { n: 0, c: 0 };
        return { ...m, pct: s.n ? Math.round((s.c / s.n) * 100) : 0 };
      }
      const s = ps.byModule[m.key] || { done: 0, correct: 0 };
      return { ...m, pct: s.done ? Math.round((s.correct / s.done) * 100) : 0 };
    });
    const weakAxes = axes.filter((a) => a.pct > 0).sort((a, b) => a.pct - b.pct).slice(0, 2);

    // 近 7 日正确率（本机 pstats，H5 同源）
    const dc = ps.daysCorrect || {};
    const trendBars: BarItem[] = [];
    let trendHas = false;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const done = (ps.days || {})[key] || 0;
      const pct = done ? Math.round(((dc[key] || 0) / done) * 100) : 0;
      if (done) trendHas = true;
      trendBars.push({
        key,
        label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
        text: done ? pct + '%' : '',
        pct: done ? Math.max(pct, 6) : 0,
        tone: done && pct < 60 ? 'bad' : '',
      });
    }

    // 勋章
    const best = ps.bestStreak || 0;
    const zhan = this._masteredCount;
    const m = (icon: string, name: string, cur: number, target: number, unit: string): Medal => {
      const got = cur >= target;
      const pct = got ? 100 : Math.min(100, Math.round((cur / target) * 100));
      const color = got ? 'var(--warn)' : 'var(--ink-4)';
      return {
        icon,
        name,
        got,
        progress: got ? '已达成' : cur + '/' + target + ' ' + unit,
        ringStyle: `background:conic-gradient(${color} 0% ${pct}%, var(--fill) ${pct}% 100%)`,
      };
    };
    const medals = [
      m('sprout', '初战告捷', totalDone, 10, '题'),
      m('dumbbell', '小有所成', totalDone, 100, '题'),
      m('trophy', '刷题大师', totalDone, 500, '题'),
      m('flame', '三日不辍', streak, 3, '天'),
      m('zap', '七日连环', streak, 7, '天'),
      m('target', '十连对', best, 10, '连对'),
      m('swords', '斩题十道', zhan, 10, '道'),
      m('crown', '百题斩', zhan, 100, '道'),
    ];

    // 考点地图（本机 bySub，≥3 题）
    const groups: Record<string, SubChip[]> = {};
    for (const [key, s] of Object.entries(ps.bySub || {})) {
      const [mod, sub] = key.split('|');
      if (!sub || s.done < 3) continue;
      const pct = Math.round((s.correct / s.done) * 100);
      (groups[mod] = groups[mod] || []).push({ sub, done: s.done, pct, lv: pct < 60 ? 'lo' : pct <= 80 ? 'mid' : 'hi' });
    }
    const subMap: SubGroup[] = Object.entries(groups).map(([mod, subs]) => ({
      module: mod,
      name: modName(mod),
      subs: subs.sort((a, b) => a.pct - b.pct),
    }));

    const hasData = totalDone > 0 || this.data.byModule.length > 0 || hmTotal > 0;
    this.setData({
      totalDone,
      accPct,
      streak,
      hmTotal,
      hmCols: cols,
      axes,
      hasRadar: axes.some((a) => a.pct > 0),
      weakAxes,
      trendBars,
      trendHas,
      medals,
      medalsGot: medals.filter((x) => x.got).length,
      subMap,
      hasData,
      unlockLeft: Math.max(UNLOCK_N - totalDone, 1),
      unlockPct: Math.min(100, Math.round((totalDone / UNLOCK_N) * 100)),
    });
    this.buildGrowthRows();
  },

  buildGrowthRows() {
    const g = this._growth;
    if (!g || !g.weeks || g.weeks.length < 2) {
      this.setData({ showGrowth: false });
      return;
    }
    const seen = new Set<string>();
    g.weeks.forEach((w) => Object.keys(w.modules || {}).forEach((k) => seen.add(k)));
    const gwOptions = [{ label: '整体', value: '' }].concat(
      MODS.filter((m) => seen.has(m.key)).map((m) => ({ label: m.name, value: m.key }))
    );
    const gwMod = this.data.gwMod;
    const rows: GrowthRow[] = g.weeks.slice(-8).map((w) => {
      const [y, wk] = w.week.split('-');
      const src = gwMod ? (w.modules || {})[gwMod] || { n: 0, c: 0 } : w;
      const pct = src.n ? Math.round((src.c / src.n) * 100) : 0;
      return { week: w.week, label: y.slice(2) + '年第' + Number(wk) + '周', n: src.n, pct, tone: pctTone(pct) };
    });
    let growthDeltaText = '';
    let growthUp = true;
    if (rows.length >= 2) {
      const d = rows[rows.length - 1].pct - rows[rows.length - 2].pct;
      growthUp = d >= 0;
      growthDeltaText = '本周比上周' + (d >= 0 ? '提升' : '下降') + ' ' + Math.abs(d) + ' 个百分点';
    }
    this.setData({ showGrowth: true, gwOptions, growthRows: rows, growthDeltaText, growthUp });
  },
  onGwMod(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ gwMod: e.detail.value });
    this.buildGrowthRows();
  },

  // ---------- 加载 ----------
  async loadHeatmap() {
    try {
      const d = await fetchCheckinSummary();
      this._hmDays = dayCountMap(d.days);
      if (d.streak != null) this._svStreak = d.streak;
      if (!this._hmTracked) {
        this._hmTracked = true;
        trackEvent('heatmap_view', 'stats');
      }
      this.recompute();
    } catch (e) {
      /* 降级用本地 pstats */
    }
  },
  async loadGrowth() {
    try {
      this._growth = await fetchGrowth();
      this.recompute();
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadReco() {
    try {
      const r = await fetchRecommend();
      this.setData({
        reco: (r.items || []).map((it) => ({
          ...it,
          name: it.label || it.submodule || '',
          meta: (it.reason || '') + ' · 正确率 ' + Math.round((it.acc || 0) * 100) + '%（' + (it.n || 0) + '题）',
        })),
      });
    } catch (e) {
      /* 非关键路径 */
    }
    try {
      const d = await fetchReviewDue();
      this.setData({ dueN: d.total || 0 });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadSlStats() {
    try {
      const sl = await fetchShenlunStats();
      this.setData({ sl, slLast: sl.last_at ? fmtTs(sl.last_at, false) : '' });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadMastery() {
    try {
      const d = await fetchMasteryMap();
      const cov = d.cold ? null : d.coverage.pct;
      const pct = cov || 0;
      this.setData({
        kmCov: cov,
        kmCovText: cov != null ? cov + '%' : '--',
        kmCovStyle: `background:conic-gradient(var(--brand) 0% ${pct}%, var(--brand-soft) ${pct}% 100%)`,
        kmDesc: '三级考点五档色阶，看清每个考点的掌握度' + (cov != null ? '，已覆盖 ' + cov + '% 考点' : ''),
      });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async loadExamTrend() {
    try {
      const [att, prof] = await Promise.all([fetchExamAttempts(null, 20), fetchProfile()]);
      const target = prof.profile && prof.profile.target_score != null ? prof.profile.target_score : null;
      const t = examTrend(att.items || [], target);
      this.setData({
        exam: t,
        examBars: t ? t.points.map((pt) => ({ key: pt.id, pct: pt.heightPct, tone: pt.level === 'ok' ? '' : pt.level })) : [],
        examTitle: t ? '模考成绩趋势（近 ' + t.points.length + ' 次）' : '',
        examMid: t ? '最好 ' + t.best + ' 分 · 最近 ' + t.latest + ' 分' : '',
      });
    } catch (e) {
      /* 非关键路径：失败不渲染 */
    }
  },
  applyStats(d: StatsResp) {
    const byModule: ModRow[] = (d.by_module || []).map((m) => ({
      module: m.module,
      key: MOD_KEY[m.module] || m.module,
      name: modName(MOD_KEY[m.module] || m.module),
      n: m.n,
    }));
    const byType: TypeRow[] = (d.by_type || []).map((t) => ({
      question_type: t.question_type || '',
      name: typeName(t.question_type),
      n: t.n,
    }));
    const rTotal = (d.by_reason || []).reduce((s, r) => s + r.n, 0) || 1;
    const byReason: ReasonRow[] = (d.by_reason || []).map((r) => ({ ...r, pct: Math.round((r.n / rTotal) * 100) }));
    this.setData({
      byModule,
      byType,
      byReason,
      modTotal: byModule.reduce((s, m) => s + m.n, 0) || 1,
      shownModules: this.data.modOpen ? byModule : byModule.slice(0, 3),
      shownTypes: this.data.topOpen ? byType : byType.slice(0, 5),
    });
    this.recompute();
  },
  async load() {
    this.setData({ loadErr: '' });
    try {
      this.applyStats(await fetchStats());
      const mk = await fetchMistakes();
      this._masteredCount = (mk.items || []).filter((m) => m.mastered).length;
      this.recompute();
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
  },
  onRetry() {
    this.load();
  },

  // ---------- 交互 ----------
  onToggleMod() {
    const modOpen = !this.data.modOpen;
    this.setData({ modOpen, shownModules: modOpen ? this.data.byModule : this.data.byModule.slice(0, 3) });
  },
  onToggleTop() {
    const topOpen = !this.data.topOpen;
    this.setData({ topOpen, shownTypes: topOpen ? this.data.byType : this.data.byType.slice(0, 5) });
  },
  goShenlun() {
    wx.navigateTo({ url: '/pkgExam/shenlun/shenlun?tab=r' });
  },
  onToggleSlIssues() {
    this.setData({ slIssuesOpen: !this.data.slIssuesOpen });
  },
  // H5 goPractice(mod, source)：模块键或中文名 → 专项练习
  onGoPractice(e: WechatMiniprogram.TouchEvent) {
    const ds = e && e.currentTarget ? e.currentTarget.dataset : {};
    const mod = String(ds.mod || '');
    const k = MOD_KEY[mod] || (MODS.some((m) => m.key === mod) ? mod : '');
    let url = '/pages/practice/practice';
    if (k) url += '?module=' + k + (ds.source ? '&source=' + ds.source : '');
    wx.navigateTo({ url });
  },
  onGoWeak() {
    const w = this.data.weakAxes[0];
    if (!w) return;
    wx.navigateTo({ url: '/pages/practice/practice?module=' + w.key + '&source=weak' });
  },
  // H5 goSub(module, sub, tag3, source)：practicePreset count 10 自适应
  onGoSub(e: WechatMiniprogram.TouchEvent) {
    const ds = e.currentTarget.dataset;
    let url = '/pages/practice/practice?count=10&module=' + String(ds.mod || '');
    if (ds.sub) url += '&submodule=' + encodeURIComponent(String(ds.sub));
    if (ds.tag3) url += '&tag3=' + encodeURIComponent(String(ds.tag3));
    if (ds.source) url += '&source=' + String(ds.source);
    wx.navigateTo({ url });
  },
  onGoReco(e: WechatMiniprogram.TouchEvent) {
    const r = this.data.reco[Number(e.currentTarget.dataset.i)];
    if (!r) return;
    let url = '/pages/practice/practice?count=10&source=reco&module=' + (r.module || '');
    if (r.submodule) url += '&submodule=' + encodeURIComponent(r.submodule);
    if (r.tag3) url += '&tag3=' + encodeURIComponent(r.tag3);
    wx.navigateTo({ url });
  },
  onGoBook() {
    wx.switchTab({ url: '/pages/book/book' });
  },
  onExamBar(e: WechatMiniprogram.CustomEvent<{ index: number }>) {
    const t = this.data.exam;
    if (!t) return;
    const pt = t.points[e.detail.index];
    if (pt) wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + pt.id });
  },
  onGoCalendar() {
    wx.navigateTo({ url: '/pkgGrow/calendar/calendar' });
  },
  onGoMasteryMap() {
    wx.navigateTo({ url: '/pkgGrow/mastery-map/mastery-map' });
  },
  onGoWeekly() {
    wx.navigateTo({ url: '/pkgGrow/weekly-report/weekly-report' });
  },
  // H5 goPlanSetup：回首页打开学习计划设置
  onGoPlanSetup() {
    wx.setStorageSync('openPlanSetup', '1');
    wx.switchTab({ url: '/pages/home/home' });
  },
});
