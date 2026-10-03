// 对照 frontend-uni/src/pkgA/stats/weekly-report.vue：/api/report/weekly（ok/pending/empty 三态）、/read 标记已读、/next_event 下一场赛事
import {
  fetchNextWeeklyEvent,
  fetchWeeklyReport,
  markWeeklyReportRead,
  type NextEvent,
  type WeeklyAction,
  type WeeklyReportResp,
} from '../../api/grow';
import { canvas2d, canvasToTemp, roundRect, saveToAlbum, type Ctx2D } from '../../utils/canvas2d';

const W = 660;
const H = 760;

interface CmpRow {
  k: string;
  v: string;
  p: string;
}
interface MasteryRow {
  key: string;
  dir: 'up' | 'down';
  submodule: string;
  text: string;
}
interface ReasonRow {
  reason: string;
  n: number;
  prev_n: number;
  pct: number;
}
interface HeroStat {
  label: string;
  value: string;
  tone: string;
}

function pct(v: number | undefined): number {
  return Math.round((v || 0) * 100);
}
function mins(s: number | undefined): string {
  return Math.round((s || 0) / 60) + ' 分钟';
}
// 赛事时间为北京时间场次，跨时区设备也按东八区显示
function fmtDay(t: number): string {
  const d = new Date(t * 1000 + (new Date().getTimezoneOffset() + 8 * 60) * 60000);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:00`;
}

function trendOf(r: WeeklyReportResp): 'up' | 'down' | 'flat' | 'new' {
  const acc = (r.compare && r.compare.acc) || [0, 0];
  if (!r.prev || !r.prev.n) return 'new';
  if (acc[0] > acc[1] + 0.01) return 'up';
  if (acc[0] < acc[1] - 0.01) return 'down';
  return 'flat';
}
const TREND_TEXT = { up: '↑ 进步', down: '↓ 回落', flat: '→ 持平', new: '✦ 新开始' };

// 与 H5 drawShare 同构；canvas 绘制色值不经 WXSS，故使用品牌色字面量
function drawShare(ctx: Ctx2D, r: WeeklyReportResp): void {
  const g = ctx.createLinearGradient(0, 0, W * 0.7, H);
  g.addColorStop(0, '#5B8AF8');
  g.addColorStop(1, '#2C5AD6');
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = g;
  ctx.fill();
  const pad = 44;
  const s = r.summary || { n: 0, acc: 0, secs: 0, days: 0 };
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '24px sans-serif';
  ctx.fillText('错题邦 · 周学习报告', pad, 52);
  ctx.fillStyle = '#fff';
  ctx.font = '800 52px sans-serif';
  ctx.fillText(r.range, pad, 100);
  const stats: [string, string][] = [
    [String(s.days), '学习天数'],
    [String(s.n), '刷题量'],
    [Math.round(s.acc * 100) + '%', '正确率'],
    [Math.round(s.secs / 60) + '分', '学习时长'],
  ];
  roundRect(ctx, pad, 200, W - pad * 2, 128, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const cw = (W - pad * 2) / 4;
  stats.forEach(([v, l], i) => {
    const cx = pad + cw * i + cw / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '800 40px sans-serif';
    ctx.fillText(v, cx, 226);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '20px sans-serif';
    ctx.fillText(l, cx, 282);
  });
  ctx.textAlign = 'left';
  let y = 380;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '26px sans-serif';
  for (const b of (r.badges || []).slice(0, 3)) {
    ctx.fillText('🏅 ' + b.title + ' · ' + b.desc, pad, y);
    y += 46;
  }
  if (r.mock) {
    ctx.fillText('📝 本周模考最高 ' + r.mock.score + ' 分', pad, y);
    y += 46;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '20px sans-serif';
  ctx.fillText('kaogong.zalize.com · 每周一自动生成', pad, H - 80);
}

Page({
  data: {
    loading: true,
    empty: false,
    pending: false,
    error: '',
    range: '',
    stateDesc: '',
    r: null as WeeklyReportResp | null,
    heroStats: [] as HeroStat[],
    cmp: [] as CmpRow[],
    mastery: [] as MasteryRow[],
    reasons: [] as ReasonRow[],
    mockSub: '',
    nextEvent: null as NextEvent | null,
    nextEventText: '',
    shareImg: '',
    shareErr: '',
    sharing: false,
  },

  _week: '',
  _prevWeek: '',

  onLoad(opt: Record<string, string | undefined>) {
    this._week = opt.week || '';
    this.load();
  },

  async load() {
    try {
      this.apply(await fetchWeeklyReport(this._week || undefined));
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ error: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ loading: false });
  },

  apply(d: WeeklyReportResp) {
    if (d.status === 'empty') {
      const range = d.range || '';
      this.setData({
        empty: true,
        pending: false,
        range,
        stateDesc: range + '\n这周做过题，下周一这里就有周报',
      });
      return;
    }
    if (d.status === 'pending') {
      this._prevWeek = d.prev_week || '';
      const range = d.range || '';
      this.setData({
        pending: true,
        empty: false,
        range,
        stateDesc: range + '\n周一再来看，先看上一周的',
      });
      return;
    }
    const t = trendOf(d);
    const s = d.summary || { n: 0, acc: 0, secs: 0, days: 0 };
    const c = d.compare || { n: [0, 0], acc: [0, 0], secs: [0, 0], days: [0, 0] };
    const reasons = d.reasons || [];
    const max = Math.max(...reasons.map((x) => x.n), 1);
    const m = d.mastery || { up: [], down: [] };
    const mastery: MasteryRow[] = [
      ...m.up.map((x) => ({ key: 'u' + x.submodule, dir: 'up' as const, submodule: x.submodule, text: `${pct(x.prev_acc)}% → ${pct(x.acc)}%` })),
      ...m.down.map((x) => ({ key: 'd' + x.submodule, dir: 'down' as const, submodule: x.submodule, text: `${pct(x.prev_acc)}% → ${pct(x.acc)}%` })),
    ];
    let mockSub = '';
    if (d.mock && d.mock.event_title) {
      mockSub = d.mock.event_title + '：' + (d.mock.rank ? `第 ${d.mock.rank} 名，` : '') + `超过 ${d.mock.pct}% 的考友`;
    }
    this.setData({
      empty: false,
      pending: false,
      error: '',
      r: d,
      heroStats: [
        { label: '学习天数', value: String(s.days), tone: '' },
        { label: '正确率', value: pct(s.acc) + '%', tone: 'brand' },
        { label: '较上周', value: TREND_TEXT[t], tone: t === 'up' ? 'ok' : t === 'down' ? 'bad' : '' },
      ],
      cmp: [
        { k: '刷题量', v: `${c.n[0]} 题`, p: `上周 ${c.n[1]}` },
        { k: '正确率', v: `${pct(c.acc[0])}%`, p: `上周 ${pct(c.acc[1])}%` },
        { k: '学习时长', v: mins(c.secs[0]), p: `上周 ${mins(c.secs[1])}` },
        { k: '学习天数', v: `${c.days[0]} 天`, p: `上周 ${c.days[1]} 天` },
      ],
      mastery,
      reasons: reasons.map((x) => ({ ...x, pct: Math.max(6, (x.n / max) * 100) })),
      mockSub,
    });
    this.markRead(d);
    this.loadNextEvent();
  },

  async markRead(d: WeeklyReportResp) {
    try {
      await markWeeklyReportRead(d.range.slice(0, 10));
      wx.setStorageSync('weeklyReadWs', d.week_start);
    } catch (_e) {
      /* 非关键路径 */
    }
  },

  async loadNextEvent() {
    try {
      const d = await fetchNextWeeklyEvent();
      const ev = d.event;
      this.setData({ nextEvent: ev, nextEventText: ev ? `下一场：${ev.title} · ${fmtDay(ev.open_at)}` : '' });
    } catch (_e) {
      /* 非关键路径 */
    }
  },

  onReload() {
    this.setData({ loading: true, empty: false, pending: false, error: '' });
    this.load();
  },
  onPrevWeek() {
    this._week = this._prevWeek;
    this.onReload();
  },
  onGoPractice() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },
  onGoContest() {
    // 小程序暂无 pkgA/exam/contest 对应页，落到模考 Tab
    wx.switchTab({ url: '/pages/exam/exam' });
  },
  onOpenAttempt() {
    const r = this.data.r;
    if (!r || !r.mock) return;
    wx.navigateTo({ url: '/pages/exam/report?attempt_id=' + r.mock.attempt_id });
  },
  onAction(e: WechatMiniprogram.TouchEvent) {
    const r = this.data.r;
    const a: WeeklyAction | undefined = r && r.actions ? r.actions[Number(e.currentTarget.dataset.i)] : undefined;
    if (!a) return;
    if (a.type === 'review') {
      wx.switchTab({ url: '/pages/book/book' });
    } else if (a.type === 'mock') {
      this.onGoContest();
    } else {
      const url = a.url || '';
      const tag3 = (/tag3=([^&]+)/.exec(url) || [])[1] || '';
      const mod = (/module=([^&]+)/.exec(url) || [])[1] || '';
      const sub = (/submodule=([^&]+)/.exec(url) || [])[1] || '';
      let to = '/pages/practice/practice?count=10&source=weekly';
      if (mod) to += '&module=' + mod;
      if (sub) to += '&submodule=' + sub;
      if (tag3) to += '&tag3=' + tag3;
      wx.navigateTo({ url: to });
    }
  },

  async onBuildShare() {
    if (this.data.shareImg || !this.data.r) return;
    this.setData({ sharing: true, shareErr: '' });
    try {
      const { node, ctx } = await canvas2d('#weeklyCanvas', W, H);
      drawShare(ctx, this.data.r);
      this.setData({ shareImg: await canvasToTemp(node) });
    } catch (e) {
      this.setData({ shareErr: (e as Error).message || '生成失败' });
    }
  },
  onSaveShare() {
    if (this.data.shareImg) saveToAlbum(this.data.shareImg);
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    const r = this.data.r;
    return {
      title: r ? `我的周学习报告：${r.range} 刷题 ${r.summary ? r.summary.n : 0} 题` : '错题邦 · 周学习报告',
      path: '/pages/home/home',
    };
  },
});
