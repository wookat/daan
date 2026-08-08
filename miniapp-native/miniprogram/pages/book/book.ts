import { exportPdf, fetchFavs, fetchMistakes, patchMistake } from '../../api/index';
import type { FavItem, Mistake } from '../../api/types';
import { modName } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface MRow extends Mistake {
  modName: string;
  open: boolean;
}

Page({
  data: {
    tab: 'todo' as 'todo' | 'done' | 'fav',
    loading: true,
    all: [] as MRow[],
    shown: [] as MRow[],
    favs: [] as FavItem[],
    todoCount: 0,
    doneCount: 0,
    detail: null as MRow | null,
    exportVisible: false,
    exporting: false,
  },
  onShow() {
    syncTabBar(this, 1);
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [m, f] = await Promise.all([
        fetchMistakes(),
        fetchFavs().catch(() => ({ items: [] as FavItem[] })),
      ]);
      const all = (m.items || []).map((x) => ({ ...x, modName: modName(x.module), open: false }));
      this.setData({
        all,
        favs: f.items || [],
        todoCount: all.filter((x) => !x.mastered).length,
        doneCount: all.filter((x) => !!x.mastered).length,
      });
      this.applyTab();
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  applyTab() {
    const { tab, all } = this.data;
    const shown =
      tab === 'todo' ? all.filter((x) => !x.mastered) : tab === 'done' ? all.filter((x) => !!x.mastered) : [];
    this.setData({ shown });
  },
  onTab(e: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: e.currentTarget.dataset.tab as 'todo' | 'done' | 'fav' });
    this.applyTab();
  },
  onToggle(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    this.setData({ [`shown[${idx}].open`]: !this.data.shown[idx].open });
  },
  onDetail(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const m = this.data.shown[idx];
    if (m) this.setData({ detail: m });
  },
  onCloseDetail() {
    this.setData({ detail: null });
  },
  noop() {
    /* 阻止冒泡 */
  },
  async onMaster(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const m = this.data.shown[idx];
    if (!m) return;
    const on = !m.mastered;
    try {
      await patchMistake(m.id, { mastered: on ? 1 : 0 });
      wx.showToast({ title: on ? '已标记掌握' : '已移回待掌握', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },
  onRedo() {
    wx.navigateTo({ url: '/pages/practice/practice?mode=redo&source=redo' });
  },
  // 同考点强化：优先 tag3，退化到 module
  onReinforce() {
    const m = this.data.detail;
    if (!m) return;
    let url = '/pages/practice/practice?count=5&source=reinforce';
    if (m.tag3) url += '&tag3=' + encodeURIComponent(m.tag3);
    else if (m.module) url += '&module=' + m.module;
    this.setData({ detail: null });
    wx.navigateTo({ url });
  },
  async onDetailMaster() {
    const m = this.data.detail;
    if (!m) return;
    try {
      await patchMistake(m.id, { mastered: m.mastered ? 0 : 1 });
      this.setData({ detail: null });
      wx.showToast({ title: m.mastered ? '已移回待掌握' : '已标记掌握', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },

  // ---------- PDF 导出 ----------
  onExportOpen() {
    if (!this.data.shown.length) {
      wx.showToast({ title: '当前列表没有错题', icon: 'none' });
      return;
    }
    this.setData({ exportVisible: true });
  },
  onExportClose() {
    this.setData({ exportVisible: false });
  },
  async onExportConfirm(e: WechatMiniprogram.CustomEvent) {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    try {
      const list = this.data.shown.slice(0, 100);
      const ids = list.filter((m) => m.question_id).map((m) => m.question_id as number);
      if (!ids.length) throw new Error('当前错题暂不支持导出');
      const d = new Date();
      await exportPdf({
        title: '错题重练卷 ' + (d.getMonth() + 1) + '月' + d.getDate() + '日',
        question_ids: ids,
        ...(e.detail as { include_answers: boolean; answer_sheet: boolean; include_questions: boolean }),
      });
      this.setData({ exportVisible: false });
    } catch (err) {
      wx.showToast({ title: '导出失败：' + (err as Error).message, icon: 'none' });
    }
    this.setData({ exporting: false });
  },
});
