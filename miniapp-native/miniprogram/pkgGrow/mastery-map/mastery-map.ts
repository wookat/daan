// 对照 frontend-uni/src/pkgA/stats/mastery-map.vue：/api/mastery/map（cold 冷启动 / 覆盖度 / 模块→题型→三级考点色阶）
import { fetchMasteryMap, type MasteryMapResp, type MasterySub, type MasteryTag3 } from '../../api/grow';

const LEVELS = [
  { key: 'untouched', label: '未接触' },
  { key: 'rumen', label: '入门' },
  { key: 'gonggu', label: '巩固' },
  { key: 'shulian', label: '熟练' },
  { key: 'jingtong', label: '精通' },
];
const VIEW_OPTS = [
  { label: '网格', value: 'grid' },
  { label: '列表', value: 'list' },
];

interface Tag3View extends MasteryTag3 {
  pctText: string;
  pct: number;
  dueText: string;
  sel: boolean;
}
interface SubView {
  code: string;
  submodule: string;
  meta: string;
  tag3s: Tag3View[];
}
interface ModChip {
  value: string;
  label: string;
}

function pctOf(n: number, mastery: number): string {
  return n ? Math.round(mastery * 100) + '%' : '未练';
}

Page({
  data: {
    LEVELS,
    viewOpts: VIEW_OPTS,
    view: 'grid',
    loading: true,
    err: '',
    cold: false,
    nTotal: 0,
    need: 30,
    needMore: 30,
    map: null as MasteryMapResp | null,
    curMod: '',
    modChips: [] as ModChip[],
    subs: [] as SubView[],
    selected: null as MasteryTag3 | null,
    selDesc: '',
    // B3：难度画像（by_difficulty 分档 × 正确率）与作答均速
    diffRows: [] as { label: string; n: number; accPct: number; accText: string }[],
    secsText: '',
  },

  _pendingMod: '',
  _selGrp: null as MasterySub | null,

  onLoad(opt: Record<string, string | undefined>) {
    try {
      this._pendingMod = opt.mod ? decodeURIComponent(opt.mod).trim() : '';
    } catch (_e) {
      this._pendingMod = '';
    }
  },
  onShow() {
    this.load();
  },

  async load() {
    this.setData({ err: '' });
    try {
      this.applyMap(await fetchMasteryMap());
    } catch (e) {
      this.setData({ err: '加载失败：' + ((e as Error).message || '网络异常') });
    }
    this.setData({ loading: false });
  },

  applyMap(d: MasteryMapResp) {
    const nTotal = d.n_total || 0;
    const need = d.need || 30;
    if (d.cold) {
      this.setData({ cold: true, nTotal, need, needMore: Math.max(0, need - nTotal) });
      return;
    }
    let curMod = this.data.curMod;
    if (this._pendingMod && d.modules.some((x) => x.module === this._pendingMod)) {
      curMod = this._pendingMod;
      this._pendingMod = '';
    }
    if (!curMod && d.modules.length) curMod = d.modules[0].module;
    const diffRows = (d.by_difficulty || [])
      .filter((b) => b.n > 0)
      .map((b) => ({ label: b.label, n: b.n, accPct: Math.round(b.acc * 100), accText: Math.round(b.acc * 100) + '%' }));
    const bs = d.by_secs;
    const secsText =
      bs && bs.correct_avg != null && bs.wrong_avg != null
        ? `答对均速 ${bs.correct_avg}s · 答错均速 ${bs.wrong_avg}s${bs.wrong_avg > bs.correct_avg * 1.3 ? '（错题多因犹豫）' : bs.correct_avg > bs.wrong_avg * 1.5 ? '（错题多因抢快）' : ''}`
        : '';
    this.setData({
      cold: false,
      nTotal,
      need,
      map: d,
      curMod,
      modChips: d.modules.map((m) => ({ value: m.module, label: m.name + (m.n ? ' ' + Math.round(m.mastery * 100) + '%' : '') })),
      diffRows,
      secsText,
    });
    this.renderSubs();
  },

  renderSubs() {
    const map = this.data.map;
    const m = map ? map.modules.find((x) => x.module === this.data.curMod) : undefined;
    const sel = this.data.selected;
    const subs: SubView[] = (m ? m.subs : []).map((g) => ({
      code: g.code,
      submodule: g.submodule,
      meta: g.n ? Math.round(g.mastery * 100) + '% · ' + g.n + ' 题' : '未练习',
      tag3s: g.tag3s.map((t) => ({
        ...t,
        pctText: pctOf(t.n, t.mastery),
        pct: t.n ? Math.round(t.mastery * 100) : 0,
        dueText: t.due_mistakes > 9 ? '9+' : String(t.due_mistakes),
        sel: !!sel && sel.code === t.code,
      })),
    }));
    this.setData({ subs });
  },

  onModChange(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ curMod: e.detail.value, selected: null, selDesc: '' });
    this._selGrp = null;
    this.renderSubs();
  },
  onViewChange(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ view: e.detail.value });
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    const { g, t } = e.currentTarget.dataset as { g: number; t: number };
    const map = this.data.map;
    const m = map ? map.modules.find((x) => x.module === this.data.curMod) : undefined;
    const grp = m ? m.subs[Number(g)] : undefined;
    const tag = grp ? grp.tag3s[Number(t)] : undefined;
    if (!grp || !tag) return;
    const cur = this.data.selected;
    const next = cur && cur.code === tag.code ? null : tag;
    this._selGrp = grp;
    let desc = '';
    if (next) {
      desc = next.n
        ? `掌握度 ${Math.round(next.mastery * 100)}% · 已练 ${next.n} 题 · 正确率 ${Math.round(next.acc * 100)}%`
        : '还没练过，来试试';
      if (next.due_mistakes) desc += ` · ${next.due_mistakes} 道错题到期`;
    }
    this.setData({ selected: next, selDesc: desc });
    this.renderSubs();
  },

  // 与 H5 practiceLaunch {kind:'start', module, submodule, tag3, count:10} 同义，小程序 practice 页走 query 解析
  onGoPractice() {
    const sel = this.data.selected;
    const grp = this._selGrp;
    const q: string[] = ['count=10', 'source=mastery'];
    if (this.data.curMod) q.push('module=' + encodeURIComponent(this.data.curMod));
    if (sel && grp) {
      q.push('submodule=' + encodeURIComponent(grp.submodule));
      q.push('tag3=' + encodeURIComponent(sel.code));
    }
    wx.navigateTo({ url: '/pages/practice/practice?' + q.join('&') });
  },
  onGoPracticeCold() {
    wx.navigateTo({ url: '/pages/practice/practice?count=10&source=mastery' });
  },
  onGoReview() {
    wx.switchTab({ url: '/pages/book/book' });
  },
  onRetry() {
    this.setData({ loading: true });
    this.load();
  },
});
