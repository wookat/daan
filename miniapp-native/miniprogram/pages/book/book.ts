import {
  deleteFav,
  fetchFavs,
  fetchMistakes,
  fetchQuestions,
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
  extra?: boolean;
  simFetched?: boolean;
  appended?: number;
}

interface RecapRow {
  name: string;
  n: number;
  pct: number;
}

const REASONS = ['粗心大意', '概念不清', '方法不会', '纯蒙的'];

function monthRecap(all: Mistake[]): { total: number; byModule: RecapRow[]; byReason: RecapRow[] } {
  const now = new Date();
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
  const cur = all.filter((m) => Number(m.created_at || 0) >= m0);
  const agg = (keyf: (m: Mistake) => string): RecapRow[] => {
    const map: Record<string, number> = {};
    for (const m of cur) {
      const k = keyf(m);
      map[k] = (map[k] || 0) + 1;
    }
    return Object.keys(map)
      .map((name) => ({ name, n: map[name], pct: Math.round((map[name] / cur.length) * 100) }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  };
  return {
    total: cur.length,
    byModule: agg((m) => modName(m.module) || m.module || '其他'),
    byReason: agg((m) => m.error_reason || '未标注'),
  };
}

function extractLetter(s: string | null | undefined): string {
  const m = /[A-D]+/.exec(String(s || '').toUpperCase());
  return m ? Array.from(new Set(m[0])).sort().join('') : '';
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
    rMulti: false,
    rOpts: [] as { k: string; text: string }[],
    picked: '',
    answered: false,
    wasCorrect: false,
    nextDays: 0,
    rStreak: 0,
    celebrate: false,
    celebrateN: 0,
    REASONS,
    recapOpen: false,
    recap: { total: 0, byModule: [] as RecapRow[], byReason: [] as RecapRow[] },
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
        recap: monthRecap(all),
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
    const rLetter = extractLetter(cur ? cur.correct_answer : '');
    this.setData({
      rCur: cur,
      rLetter,
      rMulti: rLetter.length > 1,
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
    if (this.data.rMulti) {
      const set = new Set(this.data.picked.split('').filter(Boolean));
      if (set.has(o)) set.delete(o);
      else set.add(o);
      this.setData({ picked: Array.from(set).sort().join('') });
      return;
    }
    this.setData({ picked: o });
    this.recordReview(o === this.data.rLetter);
  },
  onConfirmMulti() {
    if (this.data.answered || !this.data.picked) return;
    this.recordReview(this.data.picked === this.data.rLetter);
  },
  onSelfJudge(e: WechatMiniprogram.TouchEvent) {
    if (this.data.answered) return;
    this.recordReview(e.currentTarget.dataset.ok === '1');
  },
  async recordReview(correct: boolean) {
    const cur = this.data.rCur;
    if (!cur) return;
    if (cur.extra) {
      this.setData({ answered: true, wasCorrect: correct });
      return;
    }
    const rItems = this.data.rItems;
    if (!correct && !cur.requeued) {
      rItems.push({ ...cur, requeued: true });
    }
    this.setData({ answered: true, wasCorrect: correct, rItems });
    if (!correct) this.appendSimilar(cur);
    try {
      const res = await postReviewRecord(cur.id, correct);
      this.setData({ nextDays: res.next_review_days, rStreak: res.streak });
    } catch (e) {
      wx.showToast({ title: '记录失败：' + (e as Error).message, icon: 'none' });
    }
  },
  // 答错自动加推：本轮末尾追加最多 2 道同类新题（extra 题不写 SRS，不影响复习记录）
  async appendSimilar(cur: RItem) {
    if (cur.simFetched || cur.requeued || !cur.module) return;
    const idx = this.data.rIdx;
    this.setData({ [`rItems[${idx}].simFetched`]: true, 'rCur.simFetched': true });
    const qt = cur.question_type || '';
    const sub = qt.indexOf('-') > -1 ? qt.split('-').slice(1).join('-') : null;
    try {
      const d = await fetchQuestions({ limit: 2, module: cur.module, submodule: sub });
      const add: RItem[] = (d.items || [])
        .filter((x) => x.id !== cur.question_id)
        .slice(0, 2)
        .map((x) => ({
          id: -1,
          question_id: x.id,
          extra: true,
          module: x.module,
          question_text:
            x.question +
            '\n' +
            Object.keys(x.options || {})
              .sort()
              .map((k) => `${k}.${x.options[k]}`)
              .join(' '),
          user_answer: '',
          correct_answer: x.answer,
          explanation: x.hs_explanation || x.explanation || '',
          options: x.options || null,
        }));
      if (add.length) {
        const rItems = this.data.rItems.concat(add);
        this.setData({ rItems, [`rItems[${idx}].appended`]: add.length, 'rCur.appended': add.length });
        trackEvent('review_similar_auto', cur.module || '');
      }
    } catch (e) {
      /* 非关键路径 */
    }
  },
  async onReviewReason(e: WechatMiniprogram.TouchEvent) {
    const rz = String(e.currentTarget.dataset.rz || '');
    const cur = this.data.rCur;
    if (!rz || !cur || cur.extra) return;
    const i = this.data.rIdx;
    this.setData({ 'rCur.error_reason': rz, [`rItems[${i}].error_reason`]: rz });
    try {
      await patchMistake(cur.id, { error_reason: rz });
      trackEvent('review_reason_tag', rz);
    } catch (err) {
      /* 非关键路径 */
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
  onToggleRecap() {
    this.setData({ recapOpen: !this.data.recapOpen });
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
