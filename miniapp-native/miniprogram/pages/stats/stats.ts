// 学习统计：对齐 H5 pages/stats/stats.vue 全部区块（服务端 answer_log 口径优先，离线降级本机 pstats）
import { fetchCheckinSummary, fetchGrowth, fetchProfile, trackEvent } from '../../api/index';
import type { GrowthResp } from '../../api/types';
import { fetchExamAttempts, fetchShenlunStats } from '../../api/exam';
import type { ShenlunStats } from '../../api/exam-types';
import { fetchMasteryMap, fetchStats, type StatsResp } from '../../api/grow';
import { examTrend, type ExamTrend } from '../../utils/kg-exam-report';
import { buildHeatmap, dayCountMap, fmtTs, streakFromDays, weekLabel, type HeatCell } from '../../utils/cn-date';
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
/** 周环比最小样本：任一周低于此题数不给涨跌结论 */
const GROWTH_MIN_N = 5;

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
/** 雷达轴带已答题数：薄弱/有数据按 n>0 判，0% 全错模块不再被当未答隐藏 */
interface StatAxis {
  key: string;
  name: string;
  pct: number;
  n: number;
}
/** 柱图条目（原 kg-chart-bars BarItem 形状，迁 ECharts 后仅作 option 构建的中间态） */
interface ChartBar {
  key?: string | number;
  label?: string;
  text?: string;
  pct: number;
  tone?: string;
}
function pctTone(pct: number): string {
  return pct < 60 ? 'bad' : pct < 80 ? 'warn' : 'ok';
}

// ---------- ECharts option（kg-ec 容器，JSON 对象即可跨分包传递）----------
const EC_INK3 = '#6b7280';
const EC_LINE = '#e7e9f0';
const EC_TONE: Record<string, string> = { '': '#2e5bff', ok: '#16a34a', warn: '#d97706', bad: '#dc2626' };

function optRadar(axes: StatAxis[]) {
  return {
    radar: {
      indicator: axes.map((a) => ({ name: `${a.name} ${a.n ? a.pct + '%' : '未练'}`, max: 100 })),
      radius: '64%',
      axisName: { color: EC_INK3, fontSize: 11 },
      splitLine: { lineStyle: { color: EC_LINE } },
      splitArea: { areaStyle: { color: ['transparent'] } },
      axisLine: { lineStyle: { color: EC_LINE } },
    },
    series: [{ type: 'radar', symbol: 'none', data: [{ value: axes.map((a) => a.pct) }], lineStyle: { color: '#2e5bff', width: 2 }, areaStyle: { color: 'rgba(46,91,255,.18)' } }],
  };
}

function optBars(bars: ChartBar[], target?: { pct: number; text: string } | null) {
  return {
    grid: { left: 4, right: 4, top: 16, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: bars.map((b) => b.label || ''), axisTick: { show: false }, axisLine: { lineStyle: { color: EC_LINE } }, axisLabel: { color: EC_INK3, fontSize: 10 } },
    yAxis: { show: false },
    series: [{
      type: 'bar', barWidth: '60%',
      data: bars.map((b) => ({
        value: b.pct,
        label: { show: !!b.text, position: 'top', formatter: b.text || '', fontSize: 10, color: EC_INK3 },
        itemStyle: { color: EC_TONE[b.tone || ''] || '#2e5bff', borderRadius: [4, 4, 0, 0] },
      })),
      markLine: target ? { silent: true, symbol: 'none', lineStyle: { color: '#d97706', type: 'dashed' }, label: { formatter: target.text, fontSize: 10, color: EC_INK3 }, data: [{ yAxis: target.pct }] } : undefined,
    }],
  };
}

function optHeatmap(cols: HeatCell[][]) {
  const data: [number, number, number][] = [];
  cols.forEach((col, w) => col.forEach((c, r) => { if (!c.future) data.push([w, r, c.lv]); }));
  return {
    grid: { left: 4, right: 4, top: 4, bottom: 4, containLabel: false },
    xAxis: { type: 'category', data: Array.from({ length: 12 }, () => ''), show: false },
    yAxis: { type: 'category', data: ['一', '二', '三', '四', '五', '六', '日'], show: false },
    visualMap: { show: false, min: 0, max: 4, inRange: { color: ['#f2f3f7', '#dbe6ff', '#8fa8ff', '#2e5bff', '#1e44d9'] } },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: '#ffffff', borderWidth: 2 } }],
  };
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
    // 雷达
    axes: [] as StatAxis[],
    hasRadar: false,
    weakAxes: [] as StatAxis[],
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
    trendBars: [] as ChartBar[],
    trendHas: false,
    // 成长轨迹
    gwMod: '',
    gwOptions: [] as { label: string; value: string }[],
    growthRows: [] as GrowthRow[],
    growthDeltaText: '',
    growthDeltaTone: 'muted' as 'up' | 'down' | 'muted',
    showGrowth: false,
    // 申论
    sl: null as ShenlunStats | null,
    slLast: '',
    slIssuesOpen: false,
    // 模考趋势
    exam: null as ExamTrend | null,
    examBars: [] as ChartBar[],
    examTitle: '',
    examMid: '',
    // 掌握度地图
    kmCov: null as number | null,
    kmCovText: '',
    // 考点地图（本机 bySub）
    subMap: [] as SubGroup[],
  },
  _pstats: { byModule: {}, days: {} } as PStats,
  _growth: null as GrowthResp | null,
  _hmDays: null as Record<string, number> | null,
  _svStreak: null as number | null,
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

    const axes: StatAxis[] = MODS.map((m) => {
      if (g && g.modules) {
        const s = g.modules[m.key] || { n: 0, c: 0 };
        return { ...m, n: s.n, pct: s.n ? Math.round((s.c / s.n) * 100) : 0 };
      }
      const s = ps.byModule[m.key] || { done: 0, correct: 0 };
      return { ...m, n: s.done, pct: s.done ? Math.round((s.correct / s.done) * 100) : 0 };
    });
    const weakAxes = axes.filter((a) => a.n > 0).sort((a, b) => a.pct - b.pct).slice(0, 2);

    // 近 7 日正确率（本机 pstats，H5 同源）
    const dc = ps.daysCorrect || {};
    const trendBars: ChartBar[] = [];
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
    const hasRadar = axes.some((a) => a.n > 0);
    this.setData({
      totalDone,
      accPct,
      streak,
      hmTotal,
      hmCols: cols,
      axes,
      hasRadar,
      weakAxes,
      trendBars,
      trendHas,
      subMap,
      hasData,
      unlockLeft: Math.max(UNLOCK_N - totalDone, 1),
      unlockPct: Math.min(100, Math.round((totalDone / UNLOCK_N) * 100)),
      optRadar: hasRadar ? optRadar(axes) : null,
      optTrend: trendHas ? optBars(trendBars) : null,
      optHm: optHeatmap(cols),
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
      const src = gwMod ? (w.modules || {})[gwMod] || { n: 0, c: 0 } : w;
      const pct = src.n ? Math.round((src.c / src.n) * 100) : 0;
      return { week: w.week, label: weekLabel(w.week), n: src.n, pct, tone: pctTone(pct) };
    });
    let growthDeltaText = '';
    let growthDeltaTone: 'up' | 'down' | 'muted' = 'muted';
    if (rows.length >= 2) {
      const cur = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      if (cur.n < GROWTH_MIN_N || prev.n < GROWTH_MIN_N) {
        growthDeltaText = '两周中有一周不足 ' + GROWTH_MIN_N + ' 题，暂不比较';
      } else {
        const d = cur.pct - prev.pct;
        growthDeltaTone = d >= 0 ? 'up' : 'down';
        growthDeltaText = cur.label + '比' + prev.label + (d >= 0 ? '提升' : '下降') + ' ' + Math.abs(d) + ' 个百分点';
      }
    }
    this.setData({ showGrowth: true, gwOptions, growthRows: rows, growthDeltaText, growthDeltaTone });
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
      this.setData({
        kmCov: cov,
        kmCovText: cov != null ? '已覆盖 ' + cov + '%' : '',
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
      const bars = t ? t.points.map((pt) => ({ key: pt.id, pct: pt.heightPct, tone: pt.level === 'ok' ? '' : pt.level })) : [];
      this.setData({
        exam: t,
        examBars: bars,
        examTitle: t ? '模考成绩趋势（近 ' + t.points.length + ' 次）' : '',
        examMid: t ? '最好 ' + t.best + ' 分 · 最近 ' + t.latest + ' 分' : '',
        optExam: t ? optBars(bars, t.targetPct ? { pct: t.targetPct, text: '目标 ' + t.target + ' 分' } : null) : null,
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
  onExamBar(e: WechatMiniprogram.CustomEvent<{ index?: number; dataIndex?: number }>) {
    const t = this.data.exam;
    if (!t) return;
    const idx = e.detail.dataIndex != null ? e.detail.dataIndex : e.detail.index;
    const pt = idx != null ? t.points[idx] : null;
    if (pt) wx.navigateTo({ url: '/pkgExam/report/report?attempt_id=' + pt.id });
  },
  onGoCalendar() {
    wx.navigateTo({ url: '/pkgGrow/calendar/calendar' });
  },

  onGoPomo() {
    wx.navigateTo({ url: '/pkgGrow/pomo/pomo' });
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
