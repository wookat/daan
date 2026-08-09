import { examStart, examSubmit } from '../../api/index';
import type { ExamStartResp, Question } from '../../api/types';
import { recordStat } from '../../utils/stats';

interface EQuestion extends Question {
  _picked: string;
  _secs: number;
  optList: Array<{ k: string; v: string }>;
}

function toEQ(q: Question): EQuestion {
  return {
    ...q,
    _picked: '',
    _secs: 0,
    optList: Object.keys(q.options)
      .sort()
      .map((k) => ({ k, v: q.options[k] })),
  };
}

Page({
  data: {
    loading: true,
    items: [] as EQuestion[],
    idx: 0,
    cur: null as EQuestion | null,
    answered: 0,
    fmtLeft: '--:--',
    cardOpen: false,
    submitting: false,
  },
  _attemptId: 0,
  _paper: null as ExamStartResp['paper'] | null,
  _endAt: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _qsecs: 0,

  async onLoad() {
    try {
      const d = await examStart();
      this._attemptId = d.attempt_id;
      this._paper = d.paper;
      const items = (d.items || []).map(toEQ);
      this._endAt = Date.now() + d.paper.duration_min * 60 * 1000;
      this.setData({ loading: false, items, idx: 0, cur: items[0] });
      this.startClock();
      wx.enableAlertBeforeUnload({
        message: '模考进行中，退出将不保留本次作答，确定离开吗？',
      });
    } catch (e) {
      wx.showToast({ title: '开考失败：' + (e as Error).message, icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },
  onUnload() {
    this.stopClock();
  },

  startClock() {
    this.stopClock();
    this._qsecs = 0;
    this.tick();
    this._timer = setInterval(() => {
      this._qsecs++;
      this.tick();
    }, 1000);
  },
  stopClock() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },
  tick() {
    const s = Math.max(0, Math.round((this._endAt - Date.now()) / 1000));
    this.setData({
      fmtLeft: Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'),
    });
    if (s <= 0) {
      wx.showToast({ title: '时间到，自动交卷', icon: 'none' });
      this.submit();
    }
  },
  flushQSecs() {
    const cur = this.data.cur;
    if (cur && this._qsecs) {
      cur._secs = (cur._secs || 0) + this._qsecs;
      this._qsecs = 0;
    }
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    const k = String(e.currentTarget.dataset.key);
    const cur = this.data.cur;
    if (!cur) return;
    cur._picked = cur._picked === k ? '' : k;
    const answered = this.data.items.filter((q) => q._picked).length;
    this.setData({ cur, answered, [`items[${this.data.idx}]._picked`]: cur._picked });
    if (cur._picked && this.data.idx + 1 < this.data.items.length) {
      setTimeout(() => this.onNext(), 180);
    }
  },
  goto(i: number) {
    const { items, idx } = this.data;
    if (i < 0 || i >= items.length || i === idx) return;
    this.flushQSecs();
    this.setData({ idx: i, cur: items[i] });
  },
  onPrev() {
    this.goto(this.data.idx - 1);
  },
  onNext() {
    this.goto(this.data.idx + 1);
  },
  onOpenCard() {
    this.setData({ cardOpen: true });
  },
  onCloseCard() {
    this.setData({ cardOpen: false });
  },
  onJump(e: WechatMiniprogram.TouchEvent) {
    this.setData({ cardOpen: false });
    this.goto(Number(e.currentTarget.dataset.i));
  },

  noop() {
    /* 阻断浮层冒泡 */
  },
  onConfirmSubmit() {
    const blank = this.data.items.length - this.data.answered;
    wx.showModal({
      title: '确认交卷？',
      content: blank
        ? '还有 ' + blank + ' 题未作答，交卷后不能再修改'
        : '已全部作答，交卷查看成绩报告',
      confirmText: '交卷',
      cancelText: '再检查',
      success: (r) => {
        if (r.confirm) this.submit();
      },
    });
  },
  async submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    this.stopClock();
    this.flushQSecs();
    wx.showLoading({ title: '判分中…', mask: true });
    try {
      const picks: Record<number, string> = {};
      const secs: Record<number, number> = {};
      this.data.items.forEach((q, i) => {
        if (q._picked) picks[i + 1] = q._picked;
        if (q._secs) secs[i + 1] = q._secs;
      });
      const d = await examSubmit(this._attemptId, picks, secs);
      // 模考作答计入本地统计（与 H5 同一口径）
      for (const it of d.items || []) {
        if (it.status !== 'ok') continue;
        recordStat(it.module || 'other', !!it.correct, it.submodule || null);
      }
      wx.hideLoading();
      wx.disableAlertBeforeUnload();
      wx.redirectTo({ url: '/pages/exam/report?attempt_id=' + d.attempt_id });
    } catch (e) {
      wx.hideLoading();
      this.setData({ submitting: false });
      this.startClock();
      wx.showToast({ title: '交卷失败：' + (e as Error).message, icon: 'none' });
    }
  },
});
