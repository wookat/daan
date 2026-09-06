// 选题与练习设置（对应 H5 home.vue 的「练习设置」sheet + 「选二级题型」sheet + 专项练习列表）
// 设置项键名与 H5 同：realMode/realYear/realRegion/groupSize/dailyGoal；每组题量同时写服务端 /api/profile。
import { fetchQuestionCounts, trackEvent } from '../../api/index';
import {
  fetchRealFilters,
  fetchSubmodules,
  fetchSubmoduleProgress,
  saveGroupSize,
  type SubmoduleCount,
  type SubmoduleProgress,
} from '../../api/learn';
import { anonUid } from '../../utils/auth';
import { moduleMeta, MODULE_KEYS } from '../../utils/module-meta';
import { dayKey, getDailyGoal, loadPStats, setDailyGoal } from '../../utils/stats';

// H5 checkin.js loadSzDaily：时政每日一练完成记录按 uid 分键存本地
function szTodayDone(): boolean {
  const d = wx.getStorageSync<{ days?: Record<string, unknown> } | ''>('szDaily:' + anonUid());
  return !!(d && d.days && d.days[dayKey()]);
}

interface Opt {
  value: string | number;
  label: string;
}
interface ModVM {
  key: string;
  name: string;
  icon: string;
  color: string;
  soft: string;
  n: number;
  sub: string;
  pct: number;
  hasProg: boolean;
}
interface SubVM {
  submodule: string;
  n: number;
  prog: string;
}

const GOAL_OPTS: Opt[] = [20, 50, 100].map((g) => ({ label: g + ' 题', value: g }));
const GROUP_OPTS: Opt[] = [10, 20, 30, 50].map((n) => ({ label: String(n), value: n }));
const SRC_OPTS: Opt[] = [
  { label: '题库模式', value: 0 },
  { label: '真题模式', value: 1 },
];

function buildMods(counts: Record<string, number>): ModVM[] {
  const st = loadPStats().byModule;
  return MODULE_KEYS.map((key) => {
    const m = moduleMeta(key);
    const n = counts[key] || 0;
    const s = st[key] || { done: 0, correct: 0 };
    let sub = '';
    if (!n && !s.done) sub = '题库加载中…';
    else if (!s.done) sub = '共 ' + n + ' 题 · 未开始';
    else sub = '已做 ' + s.done + ' 题 · 正确率 ' + Math.round((s.correct / s.done) * 100) + '%';
    return {
      key,
      name: m.label,
      icon: m.icon,
      color: m.color,
      soft: m.soft,
      n,
      sub,
      pct: n && s.done ? Math.min(100, Math.round((s.done / n) * 100)) : 0,
      hasProg: !!(n && s.done),
    };
  });
}

function buildSubs(items: SubmoduleCount[], prog: SubmoduleProgress): SubVM[] {
  return items.map((s) => {
    const p = prog[s.submodule];
    return {
      submodule: s.submodule,
      n: s.n,
      prog: p && p.n ? '已做 ' + p.n + ' 题 · 正确率 ' + Math.round((100 * p.c) / p.n) + '%' : '',
    };
  });
}

Page({
  data: {
    goalOpts: GOAL_OPTS,
    groupOpts: GROUP_OPTS,
    srcOpts: SRC_OPTS,
    yearOpts: [] as Opt[],
    regionOpts: [] as Opt[],
    dailyGoal: 20,
    groupSize: 10,
    realMode: 0,
    realYear: '' as string | number,
    realRegion: '',
    mods: [] as ModVM[],
    countsLoaded: false,
    countsErr: false,
    // 题型 sheet
    subOpen: false,
    subModule: '',
    subModuleName: '',
    subAllN: 0,
    subs: [] as SubVM[],
    subLoading: false,
    subErr: '',
    szTodayDone: false,
  },
  _counts: {} as Record<string, number>,
  _autoModule: '',

  onLoad(query: Record<string, string>) {
    this._autoModule = query.module || '';
    this.setData({
      dailyGoal: getDailyGoal(),
      groupSize: Number(wx.getStorageSync('groupSize')) || 10,
      realMode: wx.getStorageSync('realMode') ? 1 : 0,
      realYear: wx.getStorageSync('realYear') || '',
      realRegion: String(wx.getStorageSync('realRegion') || ''),
      szTodayDone: szTodayDone(),
    });
    if (this.data.realMode) this.loadRealFilters();
    this.loadCounts();
  },
  onShow() {
    if (this.data.countsLoaded) this.setData({ mods: buildMods(this._counts) });
  },

  async loadCounts() {
    this.setData({ countsErr: false });
    try {
      const d = await fetchQuestionCounts();
      const map: Record<string, number> = {};
      (d.counts || []).forEach((c) => {
        map[c.module] = c.n;
      });
      this._counts = map;
      this.setData({ mods: buildMods(map), countsLoaded: true });
      if (this._autoModule) {
        const m = this._autoModule;
        this._autoModule = '';
        this.openModule(m);
      }
    } catch (e) {
      this.setData({ mods: buildMods({}), countsLoaded: true, countsErr: true });
    }
  },
  async loadRealFilters() {
    try {
      const d = await fetchRealFilters();
      this.setData({
        yearOpts: [{ label: '全部', value: '' } as Opt].concat((d.years || []).map((y) => ({ label: String(y.y), value: y.y }))),
        regionOpts: [{ label: '全部', value: '' } as Opt].concat((d.regions || []).map((r) => ({ label: r.r, value: r.r }))),
      });
    } catch (e) {
      /* 非关键路径：筛选项拉不到时仍可按「全部」真题开练 */
    }
  },

  // ---- 设置项（键名/口径同 H5 home.vue setGoal/setReal/setRealYear/setRealRegion/setGroup） ----
  onGoal(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    setDailyGoal(Number(e.detail.value));
    this.setData({ dailyGoal: Number(e.detail.value) });
  },
  onSrc(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const v = Number(e.detail.value) ? 1 : 0;
    wx.setStorageSync('realMode', v ? '1' : '');
    this.setData({ realMode: v });
    if (v && !this.data.yearOpts.length) this.loadRealFilters();
  },
  onYear(e: WechatMiniprogram.CustomEvent<{ value: string | number }>) {
    const y = e.detail.value || '';
    wx.setStorageSync('realYear', y);
    this.setData({ realYear: y });
  },
  onRegion(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const r = String(e.detail.value || '');
    wx.setStorageSync('realRegion', r);
    this.setData({ realRegion: r });
  },
  onGroup(e: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const n = Number(e.detail.value);
    wx.setStorageSync('groupSize', n);
    this.setData({ groupSize: n });
    saveGroupSize(n).catch(() => {});
  },

  // ---- 开练 ----
  launch(module: string, submodule?: string) {
    let url = '/pages/practice/practice?count=' + (this.data.groupSize || 10);
    if (module) url += '&module=' + module;
    if (submodule) url += '&submodule=' + encodeURIComponent(submodule);
    this.setData({ subOpen: false });
    wx.navigateTo({ url });
  },
  onStartMixed() {
    this.launch('');
  },
  onModTap(e: WechatMiniprogram.TouchEvent) {
    this.openModule(String((e.currentTarget.dataset as { m: string }).m || ''));
  },
  // H5 openModule：题型 <2 个直接开练，否则弹题型 sheet 并拉本人分题型进度
  async openModule(module: string) {
    if (!module) return;
    const meta = moduleMeta(module);
    this.setData({
      subOpen: true,
      subModule: module,
      subModuleName: meta.label,
      subAllN: this._counts[module] || 0,
      subs: [],
      subLoading: true,
      subErr: '',
    });
    try {
      const d = await fetchSubmodules(module);
      const items = (d.items || []).filter((s) => s.submodule);
      if (items.length < 2) {
        this.launch(module);
        return;
      }
      this.setData({ subs: buildSubs(items, {}), subLoading: false });
      fetchSubmoduleProgress(module)
        .then((p) => {
          if (this.data.subModule === module) this.setData({ subs: buildSubs(items, p.items || {}) });
        })
        .catch(() => {});
    } catch (e) {
      this.setData({ subLoading: false, subErr: (e as Error).message || '网络异常' });
    }
  },
  onSubRetry() {
    this.openModule(this.data.subModule);
  },
  onSubClose() {
    this.setData({ subOpen: false });
  },
  onSubAll() {
    this.launch(this.data.subModule);
  },
  onSubPick(e: WechatMiniprogram.TouchEvent) {
    const s = String((e.currentTarget.dataset as { s: string }).s || '');
    this.launch(this.data.subModule, s);
  },
  onRetryCounts() {
    this.loadCounts();
  },

  // 时政每日一练 / 每日一练：页面由 Grow 组提供（pkgGrow），此处仅保留 H5 同位入口
  onShizheng() {
    trackEvent('daily_open', this.data.szTodayDone ? 'szreview' : 'shizheng');
    wx.navigateTo({
      url: '/pkgGrow/daily/daily?kind=' + (this.data.szTodayDone ? 'szreview' : 'shizheng'),
      fail: () => wx.showToast({ title: '时政每日一练即将上线', icon: 'none' }),
    });
  },
  onDaily() {
    trackEvent('daily_open', 'daily');
    wx.navigateTo({
      url: '/pkgGrow/daily/daily?kind=daily',
      fail: () => wx.showToast({ title: '每日一练即将上线', icon: 'none' }),
    });
  },
});
