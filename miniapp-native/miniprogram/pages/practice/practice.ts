import {
  fetchQuestions,
  postAnswerLog,
  postMistake,
  postPracticeResult,
  redoMistakes,
} from '../../api/index';
import { fetchShizhengDaily, postQuestionReport } from '../../api/p3';
import type { ShizhengQuestion } from '../../api/p3';
import type { AnswerLogItem, Question } from '../../api/types';
import { modName, recordStat, todayKey } from '../../utils/stats';

const REPORT_TYPES = ['答案错误', '解析错误', '题干或选项错字', '图片缺失', '分类错误', '重复题', '其他'];

interface SzDaily {
  days: Record<string, { right: number; picks: string[] }>;
}

interface SzFav {
  ts: number;
  question: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  source_note: string;
}

interface PQuestion extends Question {
  _picked: string;
  _secs: number;
  _logged: boolean;
  _saved: boolean;
  _sz: boolean;
  _szFav: boolean;
  _reported: boolean;
  source_note?: string;
  optList: Array<{ k: string; v: string }>;
}

function toPQ(q: Question): PQuestion {
  return {
    ...q,
    _picked: '',
    _secs: 0,
    _logged: false,
    _saved: false,
    _sz: false,
    _szFav: false,
    _reported: false,
    optList: Object.keys(q.options)
      .sort()
      .map((k) => ({ k, v: q.options[k] })),
  };
}

function szToPQ(q: ShizhengQuestion): PQuestion {
  return toPQ({
    id: q.id || 0,
    module: 'shizheng',
    submodule: '时政',
    question: q.question,
    options: q.options || {},
    answer: q.answer,
    explanation: q.explanation || '',
  } as Question) as PQuestion;
}

function loadSzFavs(): SzFav[] {
  const v = wx.getStorageSync<SzFav[]>('szFavs');
  return Array.isArray(v) ? v : [];
}

Page({
  data: {
    loading: true,
    items: [] as PQuestion[],
    idx: 0,
    cur: null as PQuestion | null,
    picked: '',
    right: 0,
    finished: false,
    pct: 0,
    percentile: null as number | null,
    moduleName: '',
    totalSecs: 0,
    wrongCount: 0,
    // 时政模式
    szMode: false,
    szReview: false,
    // 纠错
    reportOpen: false,
    reportTypes: REPORT_TYPES,
    reportType: '',
    reportDetail: '',
    reportBusy: false,
  },
  _source: null as string | null,
  _module: null as string | null,
  _submodule: null as string | null,
  _tag3: null as string | null,
  _qsecs: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _resultSent: false,

  onLoad(query: Record<string, string>) {
    this._source = query.source || null;
    this._module = query.module || null;
    this._submodule = query.submodule ? decodeURIComponent(query.submodule) : null;
    this._tag3 = query.tag3 ? decodeURIComponent(query.tag3) : null;
    if (query.mode === 'shizheng' || query.mode === 'szreview') {
      this.startShizheng(query.mode === 'szreview');
      return;
    }
    const count = Number(query.count) || 10;
    this.start(query.mode || '', count);
  },
  onUnload() {
    this.stopTimer();
    // 中途退出：把已答未上报的作答补报（与 practice.vue quit 对齐）
    this.logAttempts(this.data.items);
  },

  async start(mode: string, count: number) {
    this.setData({ loading: true, moduleName: modName(this._module || '') });
    try {
      const d =
        mode === 'redo'
          ? await redoMistakes(count)
          : await fetchQuestions({
              limit: count,
              module: this._module,
              submodule: this._submodule,
              tag3: this._tag3,
            });
      if (!d.items || !d.items.length) {
        wx.showToast({ title: '该模块暂无题目', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      const items = d.items.map(toPQ);
      this.setData({ loading: false, items, idx: 0, cur: items[0], picked: '', right: 0 });
      this.startTimer();
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 时政每日一练（完成状态存 szDaily，与 frontend-uni 一致）
  async startShizheng(review: boolean) {
    this.setData({ loading: true, szMode: true, szReview: review, moduleName: '时政' });
    try {
      const d = await fetchShizhengDaily();
      if (!d.items || !d.items.length) {
        wx.showToast({ title: '今日时政题目更新中，明天再来', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
        return;
      }
      const favs = loadSzFavs();
      const items = d.items.map(szToPQ);
      items.forEach((q) => {
        q._sz = true;
        q._szFav = favs.some((f) => f.question === q.question);
      });
      const sz = wx.getStorageSync<SzDaily>('szDaily') || { days: {} };
      const done = sz.days ? sz.days[d.date] : null;
      if (review && done) {
        items.forEach((q, i) => {
          q._picked = done.picks[i] || q.answer;
        });
        const right = items.filter((q) => q._picked === q.answer).length;
        this.setData({ loading: false, items, idx: 0, cur: items[0], picked: items[0]._picked, right });
        return;
      }
      this.setData({ loading: false, items, idx: 0, cur: items[0], picked: '', right: 0 });
      this.startTimer();
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
      this.setData({ loading: false });
    }
  },

  startTimer() {
    this.stopTimer();
    this._qsecs = 0;
    this._timer = setInterval(() => {
      this._qsecs++;
    }, 1000);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    if (this.data.picked) return;
    const k = String(e.currentTarget.dataset.key);
    const cur = this.data.cur;
    if (!cur) return;
    cur._picked = k;
    cur._secs = this._qsecs;
    this.stopTimer();
    const correct = k === cur.answer;
    const right = this.data.right + (correct ? 1 : 0);
    this.setData({
      picked: k,
      right,
      cur,
      [`items[${this.data.idx}]._picked`]: k,
    });
    if (!cur._sz) {
      recordStat(cur.module, correct, cur.submodule);
      this.logAttempts([cur]);
      if (!correct) this.saveWrong(cur, k);
    }
    try {
      wx.vibrateShort({ type: correct ? 'light' : 'medium' });
    } catch (err) {
      /* 不支持则忽略 */
    }
  },

  // answer_log 上报：先标记 _logged 再发请求，避免在途并发重复落库（对齐 practice.vue）
  async logAttempts(qs: PQuestion[]) {
    try {
      const pending = qs.filter((q) => q._picked && !q._logged && !q._sz);
      const items: AnswerLogItem[] = pending.map((q) => ({
        qid: q.id || null,
        module: q.module || this._module || null,
        submodule: q.submodule || null,
        correct: q._picked === q.answer,
        secs: q._secs || 0,
        picked: q._picked,
        source: this._source || null,
      }));
      if (items.length) {
        pending.forEach((q) => {
          q._logged = true;
        });
        await postAnswerLog(items).catch(() => undefined);
      }
    } catch (e) {
      /* 非关键路径 */
    }
  },

  async saveWrong(q: PQuestion, picked: string) {
    if (q._saved) return;
    q._saved = true;
    const optText = q.optList.map((o) => `${o.k}.${o.v}`).join(' ');
    try {
      await postMistake({
        question_id: q.id || null,
        module: q.module,
        question_type: q.question_type || q.submodule,
        question_text: q.question + '\n' + optText,
        user_answer: picked,
        correct_answer: q.answer,
        explanation: q.explanation || '',
      });
    } catch (e) {
      q._saved = false;
    }
  },

  onNext() {
    const { idx, items } = this.data;
    const next = idx + 1;
    if (next < items.length) {
      this.setData({ idx: next, cur: items[next], picked: items[next]._picked || '' });
      if (!items[next]._picked) this.startTimer();
      return;
    }
    this.finish();
  },

  async finish() {
    this.stopTimer();
    const { items, right } = this.data;
    const totalSecs = items.reduce((s, q) => s + (q._secs || 0), 0);
    if (this.data.szMode && !this.data.szReview) {
      const sz = wx.getStorageSync<SzDaily>('szDaily') || { days: {} };
      if (!sz.days) sz.days = {};
      sz.days[todayKey()] = { right, picks: items.map((q) => q._picked || '') };
      wx.setStorageSync('szDaily', sz);
    }
    this.setData({
      finished: true,
      cur: null,
      pct: Math.round((right / items.length) * 100),
      totalSecs,
      wrongCount: items.filter((q) => q._picked && q._picked !== q.answer).length,
    });
    await this.logAttempts(items);
    if (!this._resultSent && !this.data.szMode) {
      this._resultSent = true;
      try {
        const d = await postPracticeResult(this._module || '', items.length, right, totalSecs);
        if (d.percentile != null) this.setData({ percentile: d.percentile });
      } catch (e) {
        /* 非关键路径 */
      }
    }
  },

  // 时政收藏（本机，storage key szFavs）
  onToggleSzFav() {
    const { cur, idx } = this.data;
    if (!cur || !cur._sz) return;
    const favs = loadSzFavs();
    const on = !cur._szFav;
    const next = on
      ? [
          {
            ts: Date.now(),
            question: cur.question,
            options: cur.options,
            answer: cur.answer,
            explanation: cur.explanation || '',
            source_note: cur.source_note || '',
          },
          ...favs.filter((f) => f.question !== cur.question),
        ]
      : favs.filter((f) => f.question !== cur.question);
    wx.setStorageSync('szFavs', next);
    cur._szFav = on;
    this.setData({ cur, [`items[${idx}]._szFav`]: on });
    wx.showToast({ title: on ? '已收藏到时政收藏' : '已取消收藏', icon: 'none' });
  },

  // 题目纠错
  onOpenReport() {
    const q = this.data.cur;
    if (!q || !q.id || q._reported) return;
    this.setData({ reportOpen: true, reportType: '', reportDetail: '' });
  },
  onCloseReport() {
    this.setData({ reportOpen: false });
  },
  onReportType(e: WechatMiniprogram.TouchEvent) {
    this.setData({ reportType: String(e.currentTarget.dataset.t || '') });
  },
  onReportDetail(e: WechatMiniprogram.Input) {
    this.setData({ reportDetail: e.detail.value });
  },
  async onSubmitReport() {
    const q = this.data.cur;
    if (!q || !q.id || !this.data.reportType || this.data.reportBusy) return;
    this.setData({ reportBusy: true });
    try {
      await postQuestionReport(q.id, this.data.reportType, this.data.reportDetail);
      q._reported = true;
      this.setData({ reportOpen: false, cur: q, [`items[${this.data.idx}]._reported`]: true });
      wx.showToast({ title: '感谢反馈，我们会尽快核查', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '提交失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ reportBusy: false });
  },

  // 每题讨论区
  onOpenDiscuss() {
    const q = this.data.cur;
    if (!q || !q.id) return;
    wx.navigateTo({ url: '/pages/discuss/discuss?qid=' + q.id });
  },
  noop() {
    /* 阻止冒泡 */
  },

  onRetry() {
    this._resultSent = false;
    this.setData({ finished: false, percentile: null });
    if (this.data.szMode) {
      this.startShizheng(true);
      return;
    }
    this.start('', this.data.items.length || 10);
  },
  onQuit() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
  },
});
