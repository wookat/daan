import { fetchMasteryMap } from '../../api/index';
import type { MasteryMapResp, MasteryModule, MasterySub, MasteryTag3 } from '../../api/types';

const LEVEL_CLASS: Record<string, string> = {
  strong: 'lv-strong',
  ok: 'lv-ok',
  weak: 'lv-weak',
  new: 'lv-new',
};

interface Tag3View extends MasteryTag3 {
  cls: string;
}

Page({
  data: {
    loading: true,
    err: '',
    cold: false,
    coldNeed: 30,
    coldN: 0,
    coverage: null as MasteryMapResp['coverage'] | null,
    modules: [] as MasteryModule[],
    curMod: '',
    curSubs: [] as Array<MasterySub & { tag3v: Tag3View[] }>,
    selTag: null as Tag3View | null,
    selSub: '',
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const d = await fetchMasteryMap();
      if (d.cold) {
        this.setData({
          loading: false,
          cold: true,
          coldNeed: d.need || 30,
          coldN: d.n_total || 0,
        });
        return;
      }
      const modules = d.modules || [];
      const curMod = this.data.curMod || (modules[0] ? modules[0].module : '');
      this.setData({
        loading: false,
        cold: false,
        coverage: d.coverage || null,
        modules,
        curMod,
      });
      this.applyMod(curMod, modules);
    } catch (e) {
      this.setData({ loading: false, err: (e as Error).message });
    }
  },

  applyMod(mod: string, modules?: MasteryModule[]) {
    const list = modules || this.data.modules;
    const m = list.find((x) => x.module === mod);
    this.setData({
      curMod: mod,
      curSubs: (m ? m.subs : []).map((s) => ({
        ...s,
        tag3v: s.tag3s.map((t) => ({ ...t, cls: LEVEL_CLASS[t.level] || 'lv-new' })),
      })),
    });
  },

  onMod(e: WechatMiniprogram.TouchEvent) {
    this.applyMod(String(e.currentTarget.dataset.mod));
  },

  onTag(e: WechatMiniprogram.TouchEvent) {
    const si = Number(e.currentTarget.dataset.si);
    const ti = Number(e.currentTarget.dataset.ti);
    const sub = this.data.curSubs[si];
    const tag = sub && sub.tag3v[ti];
    if (tag) this.setData({ selTag: tag, selSub: sub.submodule });
  },
  onCloseTag() {
    this.setData({ selTag: null });
  },
  noop() {
    /* 阻止冒泡 */
  },
  onPracticeTag() {
    const t = this.data.selTag;
    if (!t) return;
    wx.navigateTo({
      url:
        '/pages/practice/practice?count=10&source=mastery&module=' +
        this.data.curMod +
        '&tag3=' +
        encodeURIComponent(t.code),
    });
    this.setData({ selTag: null });
  },
  onGoPractice() {
    wx.navigateTo({ url: '/pages/practice/practice?count=10&source=mastery' });
  },
});
