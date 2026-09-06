// 讨论广场（对齐 frontend-uni/src/pkgA/social/plaza.vue）：全站热议题目聚合，点进题目讨论区
import { fetchCommentsPlaza } from '../../api/social';
import type { PlazaItem } from '../../api/social';
import { MODULES, moduleLabel } from '../../utils/module-meta';
import { toastInfo } from '../../utils/toast';

interface PlazaRow extends PlazaItem {
  modName: string;
  time: string;
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

Page({
  data: {
    items: [] as PlazaRow[],
    totalCnt: 0,
    loaded: false,
    loadErr: '',
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchCommentsPlaza();
      const items = (d.items || []).map((it) => ({
        ...it,
        modName: MODULES[it.module] ? moduleLabel(it.module) : '综合',
        time: fmtTime(it.last_at),
      }));
      this.setData({ items, totalCnt: items.reduce((s, x) => s + (Number(x.cnt) || 0), 0) });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg });
      toastInfo(msg);
    }
    this.setData({ loaded: true });
  },

  openDiscuss(e: WechatMiniprogram.BaseEvent) {
    wx.navigateTo({ url: '/pkgSocial/discuss/discuss?qid=' + e.currentTarget.dataset.qid });
  },
  goPractice() {
    wx.switchTab({ url: '/pages/home/home' });
  },
});
