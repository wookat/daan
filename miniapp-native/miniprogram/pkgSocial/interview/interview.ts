// AI 结构化面试陪练（对齐 H5 pkgA/interview/interview.vue）：选分类 → 作答（草稿 ivDraft）→ 流式点评（不支持时降级一次性）
import { interviewCategories, interviewDraw, interviewSession, streamInterview } from '../../api/social';
import type { InterviewCategory, InterviewQuestion } from '../../api/social';
import { md } from '../../utils/md';
import { toastInfo } from '../../utils/toast';

interface Draft {
  q: InterviewQuestion;
  cat: string;
  answer: string;
}

interface DimRow {
  k: string;
  v: number;
  pct: number;
}

interface PointRow {
  n: number;
  t: string;
}

interface CatRow extends InterviewCategory {
  sub: string;
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  return m + "'" + String(s % 60).padStart(2, '0') + '"';
}

function dimRows(scores: Record<string, number>): DimRow[] {
  return Object.keys(scores || {}).map((k) => {
    const v = Number(scores[k]) || 0;
    return { k, v, pct: Math.max(0, Math.min(100, v * 10)) };
  });
}

Page({
  _timer: 0 as number,
  _sid: 0 as number,
  question: null as InterviewQuestion | null,

  data: {
    step: 'pick' as 'pick' | 'answer' | 'report',
    categories: [] as CatRow[],
    catLoading: false,
    catErr: '',
    bankTotal: 0,
    doneTotal: 0,
    pickedCategory: '',
    qCategory: '',
    qSource: '',
    qText: '',
    answer: '',
    ansLen: 0,
    canSubmit: false,
    elapsedTxt: "0'00\"",
    submitting: false,
    streaming: false,
    reportCategory: '',
    reportTotal: 0,
    reportSummary: '',
    reportDur: "0'00\"",
    reportLen: 0,
    dims: [] as DimRow[],
    reviewHtml: '',
    reviewMissing: false,
    hasReview: false,
    points: [] as PointRow[],
  },

  onLoad(q: Record<string, string>) {
    if (q && q.session_id) this.loadSession(Number(q.session_id));
    else if (!this.restoreDraft()) this.loadCategories();
  },

  onUnload() {
    this.stopTimer();
  },

  async loadCategories() {
    this.setData({ catLoading: true, catErr: '' });
    try {
      const d = await interviewCategories();
      const cats = (d.categories || []).map((c) => ({ ...c, sub: '共 ' + c.total + ' 题 · 已练 ' + c.done }));
      this.setData({
        categories: cats,
        bankTotal: d.total || 0,
        doneTotal: cats.reduce((n, c) => n + (Number(c.done) || 0), 0),
        catLoading: false,
      });
    } catch (e) {
      this.setData({ catLoading: false, catErr: (e as Error).message || '加载失败' });
    }
  },

  onDrawRandom() {
    this.draw('');
  },

  onPickCat(e: WechatMiniprogram.TouchEvent) {
    this.draw(String(e.currentTarget.dataset.name || ''));
  },

  onRedraw() {
    this.draw(this.data.pickedCategory, this.question ? this.question.id : undefined);
  },

  async draw(category: string, excludeId?: number) {
    this.setData({ pickedCategory: category || '' });
    try {
      const d = await interviewDraw(category, excludeId);
      this.question = d.question;
      this.setData({
        qCategory: d.question.category,
        qSource: d.question.source || '',
        qText: d.question.question,
        answer: '',
        ansLen: 0,
        canSubmit: false,
        reviewHtml: '',
        hasReview: false,
        reviewMissing: false,
        points: [],
        step: 'answer',
      });
      this.startTimer();
    } catch (e) {
      toastInfo((e as Error).message || '抽题失败');
    }
  },

  startTimer() {
    this.stopTimer();
    let elapsed = 0;
    this.setData({ elapsedTxt: fmtDur(0) });
    this._timer = setInterval(() => {
      elapsed += 1;
      this._elapsed = elapsed;
      this.setData({ elapsedTxt: fmtDur(elapsed) });
    }, 1000) as unknown as number;
    this._elapsed = 0;
  },
  _elapsed: 0 as number,

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = 0;
    }
  },

  onInput(e: WechatMiniprogram.TextareaInput) {
    const answer = String(e.detail.value || '');
    this.setData({ answer, ansLen: answer.length, canSubmit: answer.trim().length >= 20 });
    this.saveDraft(answer);
  },

  saveDraft(answer: string) {
    if (!this.question || !this.question.id) return;
    if (answer) wx.setStorageSync('ivDraft', { q: this.question, cat: this.data.pickedCategory, answer } as Draft);
    else wx.removeStorageSync('ivDraft');
  },

  restoreDraft(): boolean {
    const d = wx.getStorageSync('ivDraft') as Draft | '';
    if (!d || !d.q || !d.q.id || !(d.answer || '').trim()) return false;
    this.question = d.q;
    this.setData({
      pickedCategory: d.cat || '',
      qCategory: d.q.category,
      qSource: d.q.source || '',
      qText: d.q.question,
      answer: d.answer,
      ansLen: d.answer.length,
      canSubmit: d.answer.trim().length >= 20,
      step: 'answer',
    });
    this.startTimer();
    toastInfo('已恢复上次未提交的作答');
    this.loadCategories();
    return true;
  },

  onVoice() {
    toastInfo('语音作答即将上线，先用文字练起来吧');
  },

  async onSubmit() {
    if (this.data.submitting || !this.question) return;
    this.setData({ submitting: true });
    this.stopTimer();
    const duration = this._elapsed;
    const ans = this.data.answer.trim();
    try {
      this.setData({
        dims: [],
        reportTotal: 0,
        reportSummary: '',
        reportDur: fmtDur(duration),
        reportLen: ans.length,
        reportCategory: this.question.category,
        reviewHtml: '',
        hasReview: false,
        reviewMissing: false,
        streaming: true,
      });
      const res = await streamInterview({
        questionId: this.question.id,
        answer: ans,
        durationSec: duration,
        onMeta: (m) => {
          this.setData({
            dims: dimRows(m.scores || {}),
            reportTotal: m.total || 0,
            reportSummary: m.summary || '',
            step: 'report',
          });
        },
        onDelta: (full) => this.setReview(full),
      });
      if (res.review) this.setReview(res.review);
      wx.removeStorageSync('ivDraft');
      if (res.session_id) {
        this._sid = res.session_id;
        this.loadPoints(res.session_id);
      }
    } catch (e) {
      toastInfo((e as Error).message || '点评失败，请重试');
      if (this.data.step !== 'report') this.startTimer();
    } finally {
      this.setData({ submitting: false, streaming: false });
    }
  },

  setReview(full: string) {
    this.setData({ reviewHtml: full ? md(full) : '', hasReview: !!full });
  },

  async loadPoints(sid: number) {
    try {
      const d = await interviewSession(sid);
      const pts = (d.session && d.session.points) || [];
      this.setData({ points: pts.map((t, i) => ({ n: i + 1, t })) });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  async loadSession(sid: number) {
    try {
      const d = await interviewSession(sid);
      const s = d.session;
      this._sid = sid;
      this.question = { id: s.question_id, category: s.category, question: s.question_text, source: s.source };
      const review = s.review || '';
      const ans = s.answer_text || '';
      this.setData({
        qCategory: s.category,
        qSource: s.source || '',
        qText: s.question_text,
        answer: ans,
        ansLen: ans.length,
        canSubmit: ans.trim().length >= 20,
        dims: dimRows(s.scores || {}),
        reportTotal: s.total || 0,
        reportSummary: '',
        reportDur: fmtDur(s.duration_sec || 0),
        reportLen: ans.length,
        reportCategory: s.category,
        reviewHtml: review ? md(review) : '',
        hasReview: !!review,
        reviewMissing: review.trim().length < 300,
        points: (s.points || []).map((t, i) => ({ n: i + 1, t })),
        step: 'report',
      });
    } catch (e) {
      toastInfo((e as Error).message || '记录加载失败');
      this.loadCategories();
    }
  },

  onRetry() {
    this.setData({ answer: '', ansLen: 0, canSubmit: false, reviewHtml: '', hasReview: false, points: [], step: 'answer' });
    this.startTimer();
  },

  goHistory() {
    wx.navigateTo({ url: '/pkgSocial/history/history' });
  },
});
