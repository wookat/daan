import {
  interviewAnswer,
  interviewCategories,
  interviewDraw,
  interviewSession,
} from '../../api/p3';
import type { InterviewCategory, InterviewQuestion } from '../../api/p3';
import { mdToPlain, stripStop } from '../../utils/text';

const DIMS = ['审题立意', '结构逻辑', '内容深度', '语言表达', '整体印象'];

interface ScoreRow {
  name: string;
  score: number;
  pct: number;
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
}

Page({
  data: {
    step: 'pick' as 'pick' | 'answer' | 'report',
    loading: true,
    categories: [] as InterviewCategory[],
    total: 0,
    category: '',
    q: null as InterviewQuestion | null,
    drawLoading: false,
    answer: '',
    timeText: '00:00',
    submitting: false,
    // 报告
    scoreRows: [] as ScoreRow[],
    totalScore: 0,
    summary: '',
    review: '',
    reportDuration: '',
    reportLen: 0,
  },
  _secs: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,

  onLoad(query: Record<string, string>) {
    if (query.sid) {
      this.loadSession(Number(query.sid));
      return;
    }
    this.loadCategories();
  },
  onUnload() {
    this.stopTimer();
  },

  async loadCategories() {
    this.setData({ loading: true });
    try {
      const d = await interviewCategories();
      this.setData({ loading: false, categories: d.categories || [], total: d.total || 0 });
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    }
  },

  onPickCategory(e: WechatMiniprogram.TouchEvent) {
    const c = String(e.currentTarget.dataset.c || '');
    this.setData({ category: c });
    this.draw();
  },
  onRedraw() {
    this.draw(this.data.q ? this.data.q.id : 0);
  },
  async draw(excludeId?: number) {
    if (this.data.drawLoading) return;
    this.setData({ drawLoading: true });
    try {
      const d = await interviewDraw(this.data.category || undefined, excludeId);
      this.setData({ drawLoading: false, q: d.question, step: 'answer', answer: '' });
      this.startTimer();
    } catch (e) {
      this.setData({ drawLoading: false });
      wx.showToast({ title: '抽题失败：' + (e as Error).message, icon: 'none' });
    }
  },

  startTimer() {
    this.stopTimer();
    this._secs = 0;
    this.setData({ timeText: '00:00' });
    this._timer = setInterval(() => {
      this._secs++;
      this.setData({ timeText: fmtSec(this._secs) });
    }, 1000);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },

  onAnswerInput(e: WechatMiniprogram.Input) {
    this.setData({ answer: e.detail.value });
  },

  async onSubmit() {
    const q = this.data.q;
    const ans = this.data.answer.trim();
    if (!q || this.data.submitting) return;
    if (ans.length < 30) {
      wx.showToast({ title: '至少作答 30 字，AI 才能有效点评', icon: 'none' });
      return;
    }
    this.stopTimer();
    this.setData({ submitting: true });
    try {
      const d = await interviewAnswer(q.id, ans, this._secs);
      this.applyReport(d.scores, d.total, d.summary, d.review, this._secs, ans.length);
      this.setData({ submitting: false, step: 'report' });
    } catch (e) {
      this.setData({ submitting: false });
      this.startTimer();
      wx.showToast({ title: '提交失败：' + (e as Error).message, icon: 'none' });
    }
  },

  applyReport(
    scores: Record<string, number>,
    total: number,
    summary: string,
    review: string,
    secs: number,
    len: number
  ) {
    const rows: ScoreRow[] = DIMS.map((name) => {
      const v = Number(scores[name] || 0);
      return { name, score: v, pct: Math.min(100, v * 5) };
    });
    this.setData({
      scoreRows: rows,
      totalScore: total || rows.reduce((s, r) => s + r.score, 0),
      summary: summary || '',
      review: mdToPlain(stripStop(review || '')),
      reportDuration: fmtSec(secs),
      reportLen: len,
    });
  },

  async loadSession(sid: number) {
    this.setData({ loading: true });
    try {
      const d = await interviewSession(sid);
      const s = d.session;
      this.setData({
        loading: false,
        step: 'report',
        q: {
          id: s.question_id,
          category: s.category,
          question: s.question_text,
          source: s.source || '',
        },
        answer: s.answer_text || '',
      });
      this.applyReport(
        s.scores || {},
        s.total || 0,
        '',
        s.review || '',
        s.duration_sec || 0,
        (s.answer_text || '').length
      );
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '记录加载失败：' + (e as Error).message, icon: 'none' });
    }
  },

  onAgain() {
    this.setData({ step: 'pick', q: null, answer: '' });
    this.loadCategories();
  },
  onHistory() {
    wx.navigateTo({ url: '/pages/interview-history/interview-history' });
  },
  onBackHome() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
  },
});
