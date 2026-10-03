// 全真模考 / 迷你模考 / 组卷模考（卷型模板+薄弱加权）/ 按卷练习（不计时）— 对齐 frontend-uni/src/pkgA/exam/exam.vue
// 入参：paper_id=<id>[&event_id=<eid>] | mini=1 | template=<id>&boost=<0|1> | mode=practice&pid=<id>&src=<psource>
import {
  examStartPaper,
  examStartMini,
  examStartTemplate,
  examProgress,
  examSubmitFull,
  fetchExamReportQuick,
  mockAttach,
  fetchPaperQuestionsById,
} from '../../api/exam';
import { postAnswerLog } from '../../api/index';
import type { ExamPaperInfo, ExamSubmitResp, Question, AnswerLogItem } from '../../api/types';
import { anonUid } from '../../utils/auth';
import { recordStat } from '../../utils/stats';
import { moduleLabel } from '../../utils/module-meta';
import { ExamTimer, QuestionTimer, fmtClock, toggleExcl, pickWithExcl, type TimeAlert } from '../../utils/kg-exam-timer';
import {
  type EQuestion,
  type ExamProgressSnap,
  toEQ,
  loadSnap,
  saveSnap,
  clearSnap,
  submitFailPlan,
} from '../../utils/kg-exam-progress';
import type { AnswerCell } from '../../components/kg-answer-card/index';
import type { OptionItem } from '../../components/kg-option-group/index';

const FONT_PX: Record<number, number> = { 0: 15, 1: 17, 2: 19 };

interface PQuestion extends EQuestion {
  _logged?: boolean;
}

function optList(q: Question | null): OptionItem[] {
  const o = (q && q.options) || {};
  return Object.keys(o)
    .sort()
    .map((k) => ({ k, v: String(o[k] == null ? '' : o[k]) }));
}

function cellsOf(items: EQuestion[], practice: boolean): AnswerCell[] {
  return items.map((q, i) => {
    let state: AnswerCell['state'] = '';
    if (practice && q._picked) state = q._picked === q.answer ? 'right' : 'wrong';
    else if (q._marked) state = 'marked';
    else if (q._picked) state = 'done';
    return { no: i + 1, state, module: moduleLabel(q.module) };
  });
}

Page({
  data: {
    loading: true,
    loadErr: '',
    mini: false,
    practice: false,
    title: '全真模考',
    items: [] as PQuestion[],
    idx: 0,
    cur: null as PQuestion | null,
    opts: [] as OptionItem[],
    answered: 0,
    fmtLeft: '--:--',
    lowTime: false,
    cardOpen: false,
    cells: [] as AnswerCell[],
    submitting: false,
    fontPx: 17,
    // 练习模式
    revealed: false,
    correctN: 0,
  },
  _attemptId: 0,
  _paper: null as ExamPaperInfo | null,
  _paperId: 0,
  _src: '',
  _tpl: '',
  _boost: false,
  _eventId: null as number | null,
  _endAt: 0,
  _clock: null as unknown as ExamTimer,
  _qt: null as unknown as QuestionTimer,
  _progTimer: 0 as ReturnType<typeof setTimeout> | 0,
  _retryTimer: 0 as ReturnType<typeof setTimeout> | 0,
  _submitTries: 0,
  _tsx: 0,

  async onLoad(opt: Record<string, string>) {
    this._clock = new ExamTimer();
    this._qt = new QuestionTimer();
    const fontLv = Number(wx.getStorageSync('fontLv'));
    this.setData({ fontPx: FONT_PX[fontLv] || 17 });
    this._eventId = opt.event_id ? Number(opt.event_id) : null;
    if (opt.mode === 'practice') {
      this.setData({ practice: true, title: '按卷练习' });
      await this.startPractice(Number(opt.pid) || 0, opt.src ? decodeURIComponent(opt.src) : '');
      return;
    }
    const mini = opt.mini === '1' || opt.mini === 'true';
    this._paperId = Number(opt.paper_id) || 0;
    // B4：卷型模板组卷（template=<id>&boost=1）——不进 mini 快照链路
    this._tpl = String(opt.template || '');
    this._boost = opt.boost === '1' || opt.boost === 'true';
    this.setData({ mini, title: mini ? '迷你模考' : this._tpl ? '组卷模考' : '全真模考' });
    const saved = loadSnap();
    if (
      !this._tpl &&
      saved &&
      saved.endAt > Date.now() &&
      ((opt.paper_id && String(saved.paperId) === String(opt.paper_id)) || (mini && saved.mini))
    ) {
      const resume = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '继续上次模考？',
          content:
            '检测到未交卷的进度（已答 ' +
            saved.items.filter((q) => q._picked).length +
            '/' +
            saved.items.length +
            ' 题）。重新开始会丢弃这些作答，从第 1 题重新计时。',
          confirmText: '继续',
          cancelText: '重新开始',
          success: (r) => resolve(!!r.confirm),
          fail: () => resolve(true),
        });
      });
      if (resume) {
        this._attemptId = saved.attemptId;
        this._paper = saved.paper;
        this._paperId = saved.paperId;
        this._endAt = saved.endAt;
        if (saved.eventId) this._eventId = saved.eventId;
        const items = saved.items.map((q) => ({ ...q, _excl: q._excl || [] }));
        this.mount(items, Math.min(saved.idx || 0, items.length - 1), saved.paper);
        return;
      }
      clearSnap();
    }
    await this.start(opt, mini);
  },
  onUnload() {
    this._clock.stop();
    if (this._retryTimer) clearTimeout(this._retryTimer);
    if (this.data.practice) {
      this.logAttempts(this.data.items);
      return;
    }
    this.saveProgress();
    this.flushProgress();
  },
  onHide() {
    if (this.data.practice) return;
    this.saveProgress();
    this.flushProgress();
  },
  onShareAppMessage() {
    return { title: this._paper ? this._paper.title : '考公行测模考', path: '/pages/home/home' };
  },

  async start(opt: Record<string, string>, mini: boolean) {
    const tpl = this._tpl;
    if (!mini && !tpl && !opt.paper_id) {
      wx.showToast({ title: '链接缺少试卷参数，去卷库选卷', icon: 'none' });
      setTimeout(() => wx.redirectTo({ url: '/pkgExam/list/list' }), 1200);
      return;
    }
    this.setData({ loading: true, loadErr: '' });
    try {
      const d = tpl
        ? await examStartTemplate(tpl, this._boost)
        : mini
          ? await examStartMini()
          : await examStartPaper(Number(opt.paper_id));
      this._attemptId = d.attempt_id;
      this._paper = d.paper;
      this._paperId = d.paper.id;
      this._endAt = Date.now() + d.paper.duration_min * 60 * 1000;
      this.mount((d.items || []).map(toEQ), 0, d.paper);
      this.saveProgress();
    } catch (e) {
      this.setData({ loading: false, loadErr: '开考失败：' + (e as Error).message });
    }
  },
  onRetry() {
    if (this.data.practice) {
      this.startPractice(this._paperId, this._src);
      return;
    }
    this.start(
      this._tpl
        ? { template: this._tpl }
        : this.data.mini
          ? { mini: '1' }
          : { paper_id: String(this._paperId) },
      this.data.mini
    );
  },
  onBack() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pkgExam/list/list' }) });
  },
  mount(items: PQuestion[], idx: number, paper: ExamPaperInfo) {
    const title = this.data.mini ? '迷你模考' : paper.title.slice(0, 16);
    // 模板卷标题带模板名（后端 title_prefix 已是模板名/「· 薄弱加权」）
    this.setData({
      loading: false,
      loadErr: '',
      title,
      items,
      idx,
      cur: items[idx] || null,
      opts: optList(items[idx] || null),
      answered: items.filter((q) => q._picked).length,
      cells: cellsOf(items, false),
    });
    this.startClock();
    wx.enableAlertBeforeUnload({ message: '模考进行中，退出后可从卷库「继续模考」续考，确定离开吗？' });
  },

  // ---------- 计时 ----------
  startClock() {
    this._qt.start();
    this._clock.start(this._endAt, {
      onTick: (left: number, alert: TimeAlert | null) => {
        this.setData({ fmtLeft: fmtClock(left), lowTime: left > 0 && left <= 300 });
        if (alert) {
          const blank = this.data.items.length - this.data.answered;
          wx.showToast({
            title: alert.label + (blank ? '，还有 ' + blank + ' 题未作答' : ''),
            icon: 'none',
            duration: 3500,
          });
        }
      },
      onEnd: () => {
        wx.showToast({ title: '时间到，自动交卷', icon: 'none' });
        this.submit();
      },
    });
  },
  flushQSecs() {
    const cur = this.data.cur;
    const s = this._qt.flush();
    if (cur && s > 0) {
      cur._secs = (cur._secs || 0) + s;
      this.data.items[this.data.idx] = cur;
    }
  },

  // ---------- 作答 ----------
  onPick(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const cur = this.data.cur;
    if (!cur) return;
    if (this.data.practice) {
      this.practicePick(cur, e.detail.key);
      return;
    }
    const k = e.detail.key;
    cur._excl = pickWithExcl(cur._excl, k);
    cur._picked = cur._picked === k ? '' : k;
    this.refreshCur(cur);
    this.saveProgress();
    if (cur._picked && this.data.idx + 1 < this.data.items.length) {
      setTimeout(() => this.onNext(), 180);
    }
  },
  onExcl(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const cur = this.data.cur;
    if (!cur) return;
    const r = toggleExcl(cur._excl, e.detail.key, cur._picked);
    cur._excl = r.excl;
    cur._picked = r.picked;
    this.refreshCur(cur);
    this.saveProgress();
  },
  onMark() {
    const cur = this.data.cur;
    if (!cur) return;
    cur._marked = !cur._marked;
    this.refreshCur(cur);
    this.saveProgress();
  },
  refreshCur(cur: PQuestion) {
    const items = this.data.items;
    items[this.data.idx] = cur;
    this.setData({
      cur,
      [`items[${this.data.idx}]`]: cur,
      answered: items.filter((q) => q._picked).length,
      cells: cellsOf(items, this.data.practice),
    });
  },
  goto(i: number) {
    const { items, idx } = this.data;
    if (i < 0 || i >= items.length || i === idx) return;
    if (!this.data.practice) this.flushQSecs();
    const cur = items[i];
    this.setData({ idx: i, cur, opts: optList(cur), revealed: !!cur._picked });
    if (!this.data.practice) this.saveProgress();
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
  onJump(e: WechatMiniprogram.CustomEvent<{ index: number }>) {
    this.setData({ cardOpen: false });
    this.goto(e.detail.index);
  },
  onTouchStart(e: WechatMiniprogram.TouchEvent) {
    this._tsx = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
  },
  onTouchEnd(e: WechatMiniprogram.TouchEvent) {
    const x = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0;
    const dx = x - this._tsx;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) this.onNext();
    else this.onPrev();
  },

  // ---------- 进度 ----------
  saveProgress() {
    if (!this._attemptId || this.data.submitting || !this._paper) return;
    const snap: ExamProgressSnap = {
      attemptId: this._attemptId,
      paperId: this._paperId,
      mini: this.data.mini,
      eventId: this._eventId,
      paper: this._paper,
      items: this.data.items,
      idx: this.data.idx,
      endAt: this._endAt,
    };
    saveSnap(snap);
    if (this._progTimer) clearTimeout(this._progTimer);
    this._progTimer = setTimeout(() => this.pushProgress(), 1500);
  },
  flushProgress() {
    if (this._progTimer) clearTimeout(this._progTimer);
    this._progTimer = 0;
    this.pushProgress();
  },
  pushProgress() {
    if (!this._attemptId || this.data.submitting) return;
    const picks: Record<number, string> = {};
    const marks: number[] = [];
    const secs: Record<number, number> = {};
    const excl: Record<number, string[]> = {};
    this.data.items.forEach((q) => {
      const id = q.id;
      if (id == null) return;
      if (q._picked) picks[id] = q._picked;
      if (q._marked) marks.push(id);
      if (Number.isInteger(q._secs) && q._secs > 0) secs[id] = q._secs;
      if (Array.isArray(q._excl) && q._excl.length) excl[id] = q._excl;
    });
    examProgress(this._attemptId, { picks, idx: this.data.idx, marks, secs, excl }).catch(() => {});
  },

  // ---------- 交卷 ----------
  onConfirmSubmit() {
    const blank = this.data.items.length - this.data.answered;
    wx.showModal({
      title: '确认交卷？',
      content: blank ? '还有 ' + blank + ' 题未作答，交卷后不能再修改' : '已全部作答，交卷查看成绩报告',
      confirmText: '交卷',
      cancelText: '再检查',
      success: (r) => {
        if (r.confirm) {
          this._submitTries = 0;
          this.submit();
        }
      },
    });
  },
  async submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true, cardOpen: false });
    this._clock.stop();
    this.flushQSecs();
    wx.showLoading({ title: '判分中…', mask: true });
    try {
      const picks: Record<number, string> = {};
      const secs: Record<number, number> = {};
      const marks: number[] = [];
      this.data.items.forEach((q, i) => {
        if (q._picked) picks[i + 1] = q._picked;
        if (q._secs) secs[i + 1] = q._secs;
        if (q._marked) marks.push(i + 1);
      });
      const d = await examSubmitFull(this._attemptId, picks, secs, marks);
      clearSnap();
      this.mergeIntoStats(d);
      await this.gotoReport(d.attempt_id);
    } catch (e) {
      // 超时/失败先确认服务端是否已判分（请求可能已送达），已判分直接进报告，避免重交撞「已交卷」
      try {
        await fetchExamReportQuick(this._attemptId, 8000);
        clearSnap();
        await this.gotoReport(this._attemptId);
        return;
      } catch (e2) {
        /* 未判分，按失败分流决定重试方式 */
      }
      wx.hideLoading();
      const msg = (e as Error).message;
      const plan = submitFailPlan({ message: msg, timeUp: this._endAt <= Date.now(), tries: this._submitTries });
      this._submitTries += 1;
      if (plan.action === 'terminal') {
        clearSnap();
        wx.disableAlertBeforeUnload();
        wx.showModal({
          title: '交卷失败',
          content: '试卷会话已失效，本次作答无法判分（' + msg + '）',
          showCancel: false,
          confirmText: '返回卷库',
          success: () => wx.redirectTo({ url: '/pkgExam/list/list' }),
        });
        return;
      }
      this.setData({ submitting: false });
      if (plan.action === 'retry') {
        wx.showToast({
          title: '交卷失败：' + msg + '，' + Math.round(plan.delayMs / 1000) + ' 秒后自动重试',
          icon: 'none',
          duration: 3000,
        });
        this._retryTimer = setTimeout(() => {
          this._retryTimer = 0;
          this.submit();
        }, plan.delayMs);
        return;
      }
      if (this._endAt > Date.now()) this.startClock();
      wx.showToast({ title: '交卷失败：' + msg + '，作答已保留，可再次交卷', icon: 'none', duration: 3000 });
    }
  },
  async gotoReport(attemptId: number) {
    wx.disableAlertBeforeUnload();
    if (this._eventId) {
      try {
        await mockAttach(this._eventId, attemptId);
        wx.hideLoading();
        wx.redirectTo({ url: '/pkgExam/contest-report/contest-report?event_id=' + this._eventId });
        return;
      } catch (e) {
        wx.showToast({ title: '未计入比赛：' + (e as Error).message, icon: 'none', duration: 2500 });
      }
    }
    wx.hideLoading();
    wx.redirectTo({ url: '/pkgExam/report/report?attempt_id=' + attemptId });
  },
  // 模考作答同步计入本地统计（统计页/打卡日历与练习同一口径）
  mergeIntoStats(d: ExamSubmitResp) {
    try {
      for (const it of d.items || []) {
        if (it.status !== 'ok') continue;
        recordStat(it.module || 'other', !!it.correct, it.submodule || null);
      }
      const hist = (wx.getStorageSync('practiceHistory') as unknown[]) || [];
      hist.unshift({
        t: Date.now(),
        uid: anonUid(),
        module: '',
        n: d.total,
        correct: d.correct,
        secs: this.data.items.reduce((a, q) => a + (q._secs || 0), 0),
        exam: this.data.mini ? 'mini' : 'full',
      });
      wx.setStorageSync('practiceHistory', hist.slice(0, 100));
    } catch (e) {
      /* 非关键路径 */
    }
  },

  // ---------- 按卷练习（不计时，选后即判） ----------
  async startPractice(pid: number, src: string) {
    this.setData({ loading: true, loadErr: '' });
    this._paperId = pid;
    this._src = src;
    try {
      const d = await fetchPaperQuestionsById(pid, src);
      this._qt.start();
      const items = (d.items || []).map(toEQ) as PQuestion[];
      if (items.length < 20) {
        wx.showToast({ title: '试卷题目不足，换一张试试', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      this.setData({
        loading: false,
        items,
        idx: 0,
        cur: items[0],
        opts: optList(items[0]),
        answered: 0,
        correctN: 0,
        revealed: false,
        cells: cellsOf(items, true),
        fmtLeft: '不计时',
      });
    } catch (e) {
      this.setData({ loading: false, loadErr: '加载试卷失败：' + (e as Error).message });
    }
  },
  onRetryPractice() {
    this.startPractice(this._paperId, this._src);
  },
  practicePick(cur: PQuestion, k: string) {
    if (cur._picked) return;
    cur._picked = k;
    cur._secs = this._qt.flush();
    const correct = k === cur.answer;
    const items = this.data.items;
    items[this.data.idx] = cur;
    this.setData({
      cur,
      [`items[${this.data.idx}]`]: cur,
      revealed: true,
      answered: items.filter((q) => q._picked).length,
      correctN: items.filter((q) => q._picked && q._picked === q.answer).length,
      cells: cellsOf(items, true),
    });
    recordStat(cur.module || 'other', correct, cur.submodule || null);
    this.logAttempts([cur]);
    try {
      wx.vibrateShort({ type: correct ? 'light' : 'medium' });
    } catch (err) {
      /* 不支持则忽略 */
    }
  },
  async logAttempts(qs: PQuestion[]) {
    try {
      const pending = qs.filter((q) => q._picked && !q._logged);
      if (!pending.length) return;
      const items: AnswerLogItem[] = pending.map((q) => ({
        qid: q.id || null,
        module: q.module || null,
        submodule: q.submodule || null,
        correct: q._picked === q.answer,
        secs: q._secs || 0,
        picked: q._picked,
        source: 'paper',
      }));
      pending.forEach((q) => {
        q._logged = true;
      });
      await postAnswerLog(items);
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onFinishPractice() {
    const { answered, correctN, items } = this.data;
    wx.showModal({
      title: '本卷练习完成',
      content: '已练 ' + answered + '/' + items.length + ' 题，答对 ' + correctN + ' 题',
      showCancel: false,
      confirmText: '返回卷库',
      success: () => wx.navigateBack(),
    });
  },
});
