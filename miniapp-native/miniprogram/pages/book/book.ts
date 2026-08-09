import {
  deleteFav,
  fetchFavs,
  fetchMistakes,
  fetchReviewDue,
  patchMistake,
  postReviewRecord,
  shareCreate,
  trackEvent,
} from '../../api/index';
import type { FavItem, Mistake } from '../../api/types';
import { modName } from '../../utils/stats';
import { syncTabBar } from '../../utils/tabbar';

interface MRow extends Mistake {
  modName: string;
  open: boolean;
}

interface RItem extends Mistake {
  requeued?: boolean;
}

function extractLetter(s: string | null | undefined): string {
  const m = /[A-D]/.exec(String(s || '').toUpperCase());
  return m ? m[0] : '';
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
    due: [] as Mistake[],
    dueTotal: 0,
    reviewing: false,
    rItems: [] as RItem[],
    rIdx: 0,
    rCur: null as RItem | null,
    rLetter: '',
    rOpts: [] as { k: string; text: string }[],
    picked: '',
    answered: false,
    wasCorrect: false,
    nextDays: 0,
    rStreak: 0,
    celebrate: false,
    celebrateN: 0,
  },
  _shareSid: '',
  _shareTitle: '',
  onShow() {
    syncTabBar(this, 1);
    this.load();
  },
  async load() {
    this.setData({ loading: true });
    try {
      const [m, r, f] = await Promise.all([
        fetchMistakes(),
        fetchReviewDue().catch(() => ({ items: [] as Mistake[], total: 0 })),
        fetchFavs().catch(() => ({ items: [] as FavItem[] })),
      ]);
      const all = (m.items || []).map((x) => ({ ...x, modName: modName(x.module), open: false }));
      this.setData({
        all,
        favs: f.items || [],
        todoCount: all.filter((x) => !x.mastered).length,
        doneCount: all.filter((x) => !!x.mastered).length,
        due: r.items || [],
        dueTotal: r.total || (r.items || []).length,
      });
      this.applyTab();
      if (wx.getStorageSync('autoStartReview') && (r.items || []).length && !this.data.reviewing) {
        wx.removeStorageSync('autoStartReview');
        this.startReview();
      }
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
  // 错题卡分享给队友：生成 sid → 复制链接，右上角转发卡片直达分享作答页
  async onShareQ(e: WechatMiniprogram.TouchEvent) {
    const m = this.data.shown[Number(e.currentTarget.dataset.index)];
    if (!m || !m.question_id) {
      wx.showToast({ title: '该题暂不支持分享', icon: 'none' });
      return;
    }
    try {
      const d = await shareCreate(m.question_id);
      const mod = d.submodule || modName(d.module || '');
      this._shareSid = d.sid;
      this._shareTitle = `我考你一道${mod}题，你能做对吗？`;
      trackEvent('share_copy', 'share_q', d.sid);
      wx.setClipboardData({
        data: `【${mod}】我刚在考公助手做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/#/pkgA/share/share-q?sid=${d.sid}`,
        success: () =>
          wx.showToast({ title: '链接已复制，也可点右上角转发给队友', icon: 'none' }),
      });
    } catch (err) {
      wx.showToast({ title: (err as Error).message || '分享失败', icon: 'none' });
    }
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    if (this._shareSid) {
      return {
        title: this._shareTitle || '我分享了一道错题，敢来挑战吗？',
        path: `/pages/share/share?sid=${this._shareSid}`,
      };
    }
    return { title: '一起来刷题' };
  },

  onRedo() {
    wx.navigateTo({ url: '/pages/practice/practice?mode=redo&source=redo' });
  },

  // ---------- 收藏 ----------
  onFavPractice(e: WechatMiniprogram.TouchEvent) {
    const mod = String(e.currentTarget.dataset.module || '');
    wx.navigateTo({
      url: '/pages/practice/practice' + (mod ? '?module=' + encodeURIComponent(mod) : ''),
    });
  },
  async onUnfav(e: WechatMiniprogram.TouchEvent) {
    const qid = Number(e.currentTarget.dataset.qid);
    if (!qid) return;
    try {
      await deleteFav(qid);
      wx.showToast({ title: '已取消收藏', icon: 'none' });
      this.load();
    } catch (err) {
      wx.showToast({ title: '操作失败：' + (err as Error).message, icon: 'none' });
    }
  },

  // ---------- 遗忘曲线复习 ----------
  onReviewFromCard() {
    trackEvent('review_entry_click', 'book_card');
    this.startReview();
  },
  startReview() {
    const rItems = [...this.data.due] as RItem[];
    if (!rItems.length) return;
    this.setData({ reviewing: true, rItems, rIdx: 0 });
    this.resetQ();
  },
  resetQ() {
    const cur = this.data.rItems[this.data.rIdx] || null;
    const opts = cur && cur.options ? cur.options : null;
    const rOpts = ['A', 'B', 'C', 'D'].map((k) => ({ k, text: (opts && opts[k]) || '' }));
    this.setData({
      rCur: cur,
      rLetter: extractLetter(cur ? cur.correct_answer : ''),
      rOpts,
      picked: '',
      answered: false,
      wasCorrect: false,
      nextDays: 0,
    });
  },
  onReviewPick(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered) return;
    const o = String(e.currentTarget.dataset.opt);
    this.setData({ picked: o });
    this.recordReview(o === this.data.rLetter);
  },
  onSelfJudge(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered) return;
    this.recordReview(e.currentTarget.dataset.ok === '1');
  },
  async recordReview(correct: boolean) {
    const cur = this.data.rCur;
    if (!cur) return;
    const rItems = this.data.rItems;
    if (!correct && !cur.requeued) {
      rItems.push({ ...cur, requeued: true });
    }
    this.setData({ answered: true, wasCorrect: correct, rItems });
    try {
      const res = await postReviewRecord(cur.id, correct);
      this.setData({ nextDays: res.next_review_days, rStreak: res.streak });
    } catch (e) {
      wx.showToast({ title: '记录失败：' + (e as Error).message, icon: 'none' });
    }
  },
  onNextReview() {
    if (this.data.rIdx + 1 < this.data.rItems.length) {
      this.setData({ rIdx: this.data.rIdx + 1 });
      this.resetQ();
    } else {
      const n = this.data.rItems.length;
      this.exitReview();
      this.setData({ celebrate: true, celebrateN: n });
      trackEvent('review_done_celebrate', 'book');
    }
  },
  onCloseCelebrate() {
    this.setData({ celebrate: false });
  },
  noop() {
    /* 阻断冒泡 */
  },
  exitReview() {
    this.setData({ reviewing: false, rItems: [], rCur: null });
    this.load();
  },
});
