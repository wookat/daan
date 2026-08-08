import {
  fetchQuestions,
  postAnswerLog,
  postMistake,
  postPracticeResult,
  redoMistakes,
} from '../../api/index';
import type { AnswerLogItem, Question } from '../../api/types';
import { modName, recordStat } from '../../utils/stats';

interface PQuestion extends Question {
  _picked: string;
  _secs: number;
  _logged: boolean;
  _saved: boolean;
  optList: Array<{ k: string; v: string }>;
}

function toPQ(q: Question): PQuestion {
  return {
    ...q,
    _picked: '',
    _secs: 0,
    _logged: false,
    _saved: false,
    optList: Object.keys(q.options)
      .sort()
      .map((k) => ({ k, v: q.options[k] })),
  };
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
    recordStat(cur.module, correct, cur.submodule);
    this.logAttempts([cur]);
    if (!correct) this.saveWrong(cur, k);
    try {
      wx.vibrateShort({ type: correct ? 'light' : 'medium' });
    } catch (err) {
      /* 不支持则忽略 */
    }
  },

  // answer_log 上报：先标记 _logged 再发请求，避免在途并发重复落库（对齐 practice.vue）
  async logAttempts(qs: PQuestion[]) {
    try {
      const pending = qs.filter((q) => q._picked && !q._logged);
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
    this.setData({
      finished: true,
      cur: null,
      pct: Math.round((right / items.length) * 100),
      totalSecs,
      wrongCount: items.filter((q) => q._picked && q._picked !== q.answer).length,
    });
    await this.logAttempts(items);
    if (!this._resultSent) {
      this._resultSent = true;
      try {
        const d = await postPracticeResult(this._module || '', items.length, right, totalSecs);
        if (d.percentile != null) this.setData({ percentile: d.percentile });
      } catch (e) {
        /* 非关键路径 */
      }
    }
  },

  onRetry() {
    this._resultSent = false;
    this.setData({ finished: false, percentile: null });
    this.start('', this.data.items.length || 10);
  },
  onQuit() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
  },
});
