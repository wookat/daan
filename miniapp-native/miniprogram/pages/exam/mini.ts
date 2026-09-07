import { examProgress, examStart, examSubmit, fetchExamReport } from '../../api/index';
import type { ExamStartResp, Question } from '../../api/types';
import { imgUrl } from '../../utils/request';
import { recordStat } from '../../utils/stats';
import {
  clearExamProgress,
  loadExamProgress,
  saveExamProgress,
  type ExamItem,
} from '../../utils/exam-progress';

const SUBMIT_TIMEOUT = 20000;

function toEQ(q: Question): ExamItem {
  return {
    ...q,
    image: imgUrl(q.image),
    _picked: '',
    _secs: 0,
    optList: Object.keys(q.options)
      .sort()
      .map((k) => ({ k, v: q.options[k] })),
  };
}

function confirm(opt: { title: string; content: string; confirmText: string; cancelText: string }) {
  return new Promise<boolean>((resolve) => {
    wx.showModal({ ...opt, success: (r) => resolve(!!r.confirm), fail: () => resolve(false) });
  });
}

Page({
  data: {
    loading: true,
    title: '迷你模考',
    items: [] as ExamItem[],
    idx: 0,
    cur: null as ExamItem | null,
    answered: 0,
    fmtLeft: '--:--',
    lowTime: false,
    cardOpen: false,
    submitting: false,
  },
  _attemptId: 0,
  _paper: null as ExamStartResp['paper'] | null,
  _mini: true,
  _endAt: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _progTimer: 0 as number | ReturnType<typeof setTimeout>,
  _qsecs: 0,

  async onLoad(opt: { paper_id?: string }) {
    const paperId = opt.paper_id ? Number(opt.paper_id) : 0;
    this._mini = !paperId;
    const saved = loadExamProgress();
    if (saved && (paperId ? saved.paperId === paperId : saved.mini)) {
      const done = saved.items.filter((q) => q._picked).length;
      const resume = await confirm({
        title: '继续上次模考？',
        content: '检测到未交卷的进度（已答 ' + done + '/' + saved.items.length + ' 题）',
        confirmText: '继续',
        cancelText: '重新开始',
      });
      if (resume) {
        this._attemptId = saved.attemptId;
        this._paper = saved.paper;
        this._endAt = saved.endAt;
        const idx = Math.min(saved.idx || 0, saved.items.length - 1);
        this.setData({
          loading: false,
          title: saved.paper.title,
          items: saved.items,
          idx,
          cur: saved.items[idx],
          answered: done,
        });
        this.startClock();
        this.guardLeave();
        return;
      }
      clearExamProgress();
    }
    await this.start(paperId);
  },
  async start(paperId: number) {
    try {
      const d = await examStart(paperId || undefined);
      this._attemptId = d.attempt_id;
      this._paper = d.paper;
      const items = (d.items || []).map(toEQ);
      this._endAt = Date.now() + d.paper.duration_min * 60 * 1000;
      this.setData({
        loading: false,
        title: paperId ? d.paper.title : '迷你模考',
        items,
        idx: 0,
        cur: items[0],
        answered: 0,
      });
      this.startClock();
      this.guardLeave();
      this.saveProgress();
    } catch (e) {
      wx.showToast({ title: '开考失败：' + (e as Error).message, icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
    }
  },
  guardLeave() {
    wx.enableAlertBeforeUnload({
      message: '模考进行中，退出后可从卷库「继续上次模考」，确定离开吗？',
    });
  },
  onHide() {
    this.flushQSecs();
    this.saveProgress();
    this.flushProgress();
  },
  onUnload() {
    this.stopClock();
    this.flushQSecs();
    this.saveProgress();
    this.flushProgress();
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
      lowTime: s > 0 && s <= 300,
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

  /** 本地快照立即落盘；服务端进度 1.5s 去抖后同步（与 H5 同口径） */
  saveProgress() {
    if (!this._attemptId || !this._paper || this.data.submitting) return;
    saveExamProgress({
      attemptId: this._attemptId,
      paperId: this._mini ? null : this._paper.id,
      mini: this._mini,
      paper: this._paper,
      items: this.data.items,
      idx: this.data.idx,
      endAt: this._endAt,
    });
    if (this._progTimer) clearTimeout(this._progTimer as ReturnType<typeof setTimeout>);
    this._progTimer = setTimeout(() => this.pushProgress(), 1500);
  },
  flushProgress() {
    if (this._progTimer) {
      clearTimeout(this._progTimer as ReturnType<typeof setTimeout>);
      this._progTimer = 0;
    }
    this.pushProgress();
  },
  pushProgress() {
    if (!this._attemptId || this.data.submitting) return;
    const picks: Record<number, string> = {};
    const secs: Record<number, number> = {};
    this.data.items.forEach((q) => {
      if (q.id == null) return;
      if (q._picked) picks[q.id] = q._picked;
      if (q._secs > 0) secs[q.id] = q._secs;
    });
    examProgress(this._attemptId, picks, this.data.idx, secs).catch(() => {
      /* 进度同步失败不打断作答，本地快照仍可续考 */
    });
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    const k = String(e.currentTarget.dataset.key);
    const cur = this.data.cur;
    if (!cur) return;
    cur._picked = cur._picked === k ? '' : k;
    const answered = this.data.items.filter((q) => q._picked).length;
    this.setData({ cur, answered, [`items[${this.data.idx}]._picked`]: cur._picked });
    this.saveProgress();
    if (cur._picked && this.data.idx + 1 < this.data.items.length) {
      setTimeout(() => this.onNext(), 180);
    }
  },
  onPreviewImg() {
    const cur = this.data.cur;
    if (cur && cur.image) wx.previewImage({ urls: [cur.image] });
  },
  goto(i: number) {
    const { items, idx } = this.data;
    if (i < 0 || i >= items.length || i === idx) return;
    this.flushQSecs();
    this.setData({ idx: i, cur: items[i] });
    this.saveProgress();
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
  onCardVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
    if (!e.detail.visible) this.onCloseCard();
  },
  onJump(e: WechatMiniprogram.TouchEvent) {
    this.setData({ cardOpen: false });
    this.goto(Number(e.currentTarget.dataset.i));
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
  gotoReport(attemptId: number) {
    clearExamProgress();
    wx.hideLoading();
    wx.disableAlertBeforeUnload();
    wx.redirectTo({ url: '/pages/exam/report?attempt_id=' + attemptId });
  },
  async submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true, cardOpen: false });
    this.stopClock();
    this.flushQSecs();
    if (this._progTimer) {
      clearTimeout(this._progTimer as ReturnType<typeof setTimeout>);
      this._progTimer = 0;
    }
    wx.showLoading({ title: '判分中…', mask: true });
    try {
      const picks: Record<number, string> = {};
      const secs: Record<number, number> = {};
      this.data.items.forEach((q, i) => {
        if (q._picked) picks[i + 1] = q._picked;
        if (q._secs) secs[i + 1] = q._secs;
      });
      const d = await examSubmit(this._attemptId, picks, secs, SUBMIT_TIMEOUT);
      // 模考作答计入本地统计（与 H5 同一口径）
      for (const it of d.items || []) {
        if (it.status !== 'ok') continue;
        recordStat(it.module || 'other', !!it.correct, it.submodule || null);
      }
      this.gotoReport(d.attempt_id);
    } catch (e) {
      // 超时/失败先确认服务端是否已判分（请求可能已送达），已判分直接进报告，避免重交撞「已交卷」
      try {
        await fetchExamReport(this._attemptId, 8000);
        this.gotoReport(this._attemptId);
        return;
      } catch {
        /* 未判分，保留作答允许重交 */
      }
      wx.hideLoading();
      this.setData({ submitting: false });
      const timeUp = this._endAt <= Date.now();
      if (!timeUp) this.startClock();
      const retry = await confirm({
        title: '交卷失败',
        content: (e as Error).message + '。作答已保留，可重新提交。',
        confirmText: '重新提交',
        cancelText: timeUp ? '稍后再试' : '继续检查',
      });
      if (retry) this.submit();
    }
  },
});
