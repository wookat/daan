import { examStart, examSubmit, mockAttach } from '../../api/index';
import type { Question } from '../../api/types';
import { recordStat } from '../../utils/stats';

const PROG_KEY = 'examProgress';

interface EQ extends Question {
  no: number;
  optList: Array<{ k: string; v: string }>;
}

interface SavedProgress {
  attemptId: number;
  paperId: number | null;
  mini: boolean;
  eventId: number | null;
  title: string;
  endAt: number;
  picks: Record<string, string>;
  secs: Record<string, number>;
  marked: number[];
}

function fmtClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

Page({
  data: {
    loading: true,
    title: '',
    items: [] as EQ[],
    idx: 0,
    cur: null as EQ | null,
    picked: '',
    marked: [] as number[],
    curMarked: false,
    clock: '',
    warn: false,
    sheetOpen: false,
    sheet: [] as Array<{ no: number; state: string }>,
    answeredCount: 0,
    submitting: false,
  },
  _attemptId: 0,
  _paperId: null as number | null,
  _mini: false,
  _eventId: null as number | null,
  _endAt: 0,
  _picks: {} as Record<string, string>,
  _secs: {} as Record<string, number>,
  _qStart: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _submitted: false,

  onLoad(query: Record<string, string>) {
    this._paperId = query.paper_id ? Number(query.paper_id) : null;
    this._mini = query.mini === '1';
    this._eventId = query.event_id ? Number(query.event_id) : null;
    this.boot();
  },
  onUnload() {
    this.stopTimer();
    if (!this._submitted && this._attemptId) this.saveProgress();
  },

  loadSaved(): SavedProgress | null {
    try {
      const s = wx.getStorageSync<SavedProgress>(PROG_KEY);
      if (!s || !s.attemptId || !(s.endAt > Date.now())) return null;
      const match =
        (this._paperId && String(s.paperId) === String(this._paperId)) ||
        (this._mini && s.mini);
      return match ? s : null;
    } catch (e) {
      return null;
    }
  },

  async boot() {
    const saved = this.loadSaved();
    if (saved) {
      const resume = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '继续上次考试？',
          content: '检测到未完成的模考，可继续作答（计时不会重置）',
          confirmText: '继续',
          cancelText: '重新开始',
          success: (r) => resolve(!!r.confirm),
          fail: () => resolve(false),
        });
      });
      if (resume) {
        await this.start(saved);
        return;
      }
      wx.removeStorageSync(PROG_KEY);
    }
    await this.start(null);
  },

  async start(saved: SavedProgress | null) {
    this.setData({ loading: true });
    try {
      const d = await examStart(this._mini ? { mini: true } : { paper_id: this._paperId || 0 });
      const items: EQ[] = (d.items || []).map((q, i) => ({
        ...q,
        no: i + 1,
        optList: Object.keys(q.options)
          .sort()
          .map((k) => ({ k, v: q.options[k] })),
      }));
      if (saved && saved.attemptId === d.attempt_id) {
        this._attemptId = saved.attemptId;
        this._endAt = saved.endAt;
        this._picks = saved.picks || {};
        this._secs = saved.secs || {};
        this.setData({ marked: saved.marked || [] });
      } else {
        this._attemptId = d.attempt_id;
        this._endAt = Date.now() + (d.paper.duration_min || 30) * 60 * 1000;
        this._picks = {};
        this._secs = {};
      }
      // 大赛入口：把本次 attempt 挂到比赛场次
      if (this._eventId) {
        mockAttach(this._eventId, this._attemptId).catch(() => undefined);
      }
      const idx = this.firstUnanswered(items);
      this._qStart = Date.now();
      this.setData({
        loading: false,
        title: d.paper.title || (this._mini ? '迷你模考' : '整卷模考'),
        items,
        idx,
        cur: items[idx] || null,
        picked: items[idx] ? this._picks[String(items[idx].id)] || '' : '',
        curMarked: items[idx] ? this.data.marked.includes(items[idx].no) : false,
        answeredCount: Object.keys(this._picks).length,
      });
      this.startTimer();
      this.saveProgress();
    } catch (e) {
      wx.showToast({ title: '开考失败：' + (e as Error).message, icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  firstUnanswered(items: EQ[]): number {
    for (let i = 0; i < items.length; i++) {
      if (!this._picks[String(items[i].id)]) return i;
    }
    return 0;
  },

  startTimer() {
    this.stopTimer();
    this.tick();
    this._timer = setInterval(() => this.tick(), 1000);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },
  tick() {
    const left = Math.max(0, Math.floor((this._endAt - Date.now()) / 1000));
    this.setData({ clock: fmtClock(left), warn: left <= 300 });
    if (left <= 0 && !this._submitted) {
      wx.showToast({ title: '时间到，自动交卷', icon: 'none' });
      this.submit(true);
    }
  },

  accumSecs() {
    const cur = this.data.cur;
    if (!cur) return;
    const key = String(cur.id);
    this._secs[key] = (this._secs[key] || 0) + Math.round((Date.now() - this._qStart) / 1000);
    this._qStart = Date.now();
  },

  saveProgress() {
    if (!this._attemptId || this._submitted) return;
    const s: SavedProgress = {
      attemptId: this._attemptId,
      paperId: this._paperId,
      mini: this._mini,
      eventId: this._eventId,
      title: this.data.title,
      endAt: this._endAt,
      picks: this._picks,
      secs: this._secs,
      marked: this.data.marked,
    };
    try {
      wx.setStorageSync(PROG_KEY, s);
    } catch (e) {
      /* 存储失败不阻塞作答 */
    }
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    const k = String(e.currentTarget.dataset.key);
    const cur = this.data.cur;
    if (!cur) return;
    this.accumSecs();
    this._picks[String(cur.id)] = k;
    this.setData({ picked: k, answeredCount: Object.keys(this._picks).length });
    this.saveProgress();
  },

  goto(i: number) {
    const { items } = this.data;
    if (i < 0 || i >= items.length) return;
    this.accumSecs();
    const q = items[i];
    this.setData({
      idx: i,
      cur: q,
      picked: this._picks[String(q.id)] || '',
      curMarked: this.data.marked.includes(q.no),
      sheetOpen: false,
    });
  },
  onPrev() {
    this.goto(this.data.idx - 1);
  },
  onNext() {
    if (this.data.idx + 1 >= this.data.items.length) {
      this.openSheet();
      return;
    }
    this.goto(this.data.idx + 1);
  },
  onMark() {
    const cur = this.data.cur;
    if (!cur) return;
    const marked = this.data.marked.slice();
    const at = marked.indexOf(cur.no);
    if (at >= 0) marked.splice(at, 1);
    else marked.push(cur.no);
    this.setData({ marked, curMarked: at < 0 });
    this.saveProgress();
  },

  openSheet() {
    const sheet = this.data.items.map((q) => ({
      no: q.no,
      state: this._picks[String(q.id)]
        ? 'done'
        : this.data.marked.includes(q.no)
          ? 'mark'
          : '',
    }));
    this.setData({ sheet, sheetOpen: true });
  },
  closeSheet() {
    this.setData({ sheetOpen: false });
  },
  noop() {
    /* 阻止冒泡 */
  },
  onSheetJump(e: WechatMiniprogram.TouchEvent) {
    this.goto(Number(e.currentTarget.dataset.index));
  },

  onAskSubmit() {
    const unanswered = this.data.items.length - this.data.answeredCount;
    wx.showModal({
      title: '确认交卷？',
      content: unanswered > 0 ? `还有 ${unanswered} 题未作答，交卷后不可修改` : '交卷后不可修改',
      confirmText: '交卷',
      cancelText: '再看看',
      success: (r) => {
        if (r.confirm) this.submit(false);
      },
    });
  },

  async submit(auto: boolean) {
    if (this._submitted || this.data.submitting) return;
    this.setData({ submitting: true });
    this.accumSecs();
    this.stopTimer();
    try {
      const picks: Record<number, string> = {};
      const secs: Record<number, number> = {};
      Object.keys(this._picks).forEach((k) => {
        picks[Number(k)] = this._picks[k];
      });
      Object.keys(this._secs).forEach((k) => {
        secs[Number(k)] = this._secs[k];
      });
      const d = await examSubmit(this._attemptId, picks, secs);
      this._submitted = true;
      wx.removeStorageSync(PROG_KEY);
      // 已答题目并入本地统计（与 exam.vue 交卷后合并 pstats 对齐）
      this.data.items.forEach((q) => {
        const p = this._picks[String(q.id)];
        if (p) recordStat(q.module, p === q.answer, q.submodule);
      });
      const url =
        this._eventId != null
          ? '/pages/contest-report/contest-report?event_id=' + this._eventId
          : '/pages/exam-report/exam-report?attempt_id=' + d.attempt_id;
      wx.redirectTo({ url });
    } catch (e) {
      this.setData({ submitting: false });
      if (!auto) wx.showToast({ title: '交卷失败：' + (e as Error).message, icon: 'none' });
      if (auto) this.startTimer();
    }
  },

  onQuit() {
    wx.showModal({
      title: '退出考试？',
      content: '进度已保存，回来可继续作答',
      confirmText: '退出',
      cancelText: '继续答题',
      success: (r) => {
        if (r.confirm) {
          this.saveProgress();
          wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/exam/exam' }) });
        }
      },
    });
  },
});
