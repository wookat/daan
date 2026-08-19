import {
  fetchCheckinBadges,
  fetchQuestions,
  fetchReviewDue,
  postAnswerLog,
  postMistake,
  postPracticeResult,
  redoMistakes,
  shareCreate,
  trackEvent,
} from '../../api/index';
import type { AnswerLogItem, Question } from '../../api/types';
import { modName, recordStat, streakDays } from '../../utils/stats';

const BADGE_MILESTONES = [3, 7, 14, 30, 60, 100];

const FONT_LABELS = ['小', '标', '大'];
const Q_FS = [28, 32, 36];
const OPT_FS = [26, 30, 34];
const EXP_FS = [24, 28, 32];

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m < 10 ? '0' + m : m}:${r < 10 ? '0' + r : r}`;
}

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
    dueReview: 0,
    timerText: '00:00',
    fontLv: 1,
    fontLabel: FONT_LABELS[1],
    qFs: Q_FS[1],
    optFs: OPT_FS[1],
    expFs: EXP_FS[1],
  },
  _source: null as string | null,
  _mode: '',
  _module: null as string | null,
  _submodule: null as string | null,
  _tag3: null as string | null,
  _qsecs: 0,
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _resultSent: false,
  _shareSid: '',
  _shareTitle: '',
  _badgeChecking: false,

  onLoad(query: Record<string, string>) {
    const savedFont = wx.getStorageSync('fontLv');
    if (savedFont === 0 || savedFont === 2) this.applyFont(savedFont);
    this._source = query.source || null;
    this._module = query.module || null;
    this._submodule = query.submodule ? decodeURIComponent(query.submodule) : null;
    this._tag3 = query.tag3 ? decodeURIComponent(query.tag3) : null;
    const count = Number(query.count) || 10;
    this._mode = query.mode || '';
    this.start(this._mode, count);
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
              adaptive: this._tag3 ? true : undefined,
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
    this.setData({ timerText: '00:00' });
    this._timer = setInterval(() => {
      this._qsecs++;
      this.setData({ timerText: fmtSecs(this._qsecs) });
    }, 1000);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },

  applyFont(lv: number) {
    this.setData({
      fontLv: lv,
      fontLabel: FONT_LABELS[lv],
      qFs: Q_FS[lv],
      optFs: OPT_FS[lv],
      expFs: EXP_FS[lv],
    });
  },
  onCycleFont() {
    const lv = (this.data.fontLv + 1) % 3;
    this.applyFont(lv);
    wx.setStorageSync('fontLv', lv);
    wx.showToast({ title: '字号：' + FONT_LABELS[lv], icon: 'none', duration: 800 });
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
    this.checkBadgeMilestone();
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
      dueReview: 0,
    });
    await this.logAttempts(items);
    this.loadDueReview();
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

  // 分享给队友：生成 sid → 复制链接，并可通过右上角转发卡片直达分享作答页
  // 本地连击只做「疑似达标」预检；解锁与展示以服务端 /api/checkin/badges 的 streak 为准
  async checkBadgeMilestone() {
    const localStreak = streakDays();
    const seen = Number(wx.getStorageSync('badgeSeenMax') || 0);
    if (!BADGE_MILESTONES.some((m) => localStreak >= m && m > seen) || this._badgeChecking) return;
    this._badgeChecking = true;
    try {
      const b = await fetchCheckinBadges();
      const srvStreak = b.streak || 0;
      const hit = BADGE_MILESTONES.filter(
        (m) =>
          srvStreak >= m && m > seen && (b.badges || []).some((x) => x.days === m && x.unlocked)
      ).pop();
      if (hit) {
        wx.setStorageSync('badgeSeenMax', hit);
        trackEvent('badge_unlock', 'badge', String(hit));
        wx.showModal({
          title: '🏅 解锁新徽章！',
          content: `连续打卡 ${srvStreak} 天，解锁 ${hit} 天徽章，坚持就是实力。生成专属海报，晒给考友看？`,
          confirmText: '生成海报',
          cancelText: '稍后再看',
          success: (r) => {
            if (r.confirm) wx.navigateTo({ url: '/pages/social/poster?badge=' + hit });
          },
        });
      }
    } catch (e) {
      /* 非关键路径 */
    }
    this._badgeChecking = false;
  },

  async onShareQ() {
    const cur = this.data.cur;
    if (!cur || !cur.id) {
      wx.showToast({ title: '该题暂不支持分享', icon: 'none' });
      return;
    }
    try {
      const d = await shareCreate(cur.id);
      const mod = d.submodule || modName(d.module || '');
      this._shareSid = d.sid;
      this._shareTitle = `我考你一道${mod}题，你能做对吗？`;
      trackEvent('share_copy', 'share_q', d.sid);
      wx.setClipboardData({
        data: `【${mod}】我刚在错题邦做了一道题，你能做对吗？答完就能看到大家选了啥：https://kaogong.zalize.com/s/${d.sid}`,
        success: () =>
          wx.showToast({ title: '链接已复制，也可点右上角转发给队友', icon: 'none' }),
      });
    } catch (e) {
      wx.showToast({ title: (e as Error).message || '分享失败', icon: 'none' });
    }
  },

  onShareAppMessage(): WechatMiniprogram.Page.ICustomShareContent {
    if (this._shareSid) {
      return { title: this._shareTitle, path: `/pages/share/share?sid=${this._shareSid}` };
    }
    return { title: '一起来刷题' };
  },

  async loadDueReview() {
    try {
      const r = await fetchReviewDue();
      this.setData({ dueReview: r.total || (r.items || []).length });
    } catch (e) {
      /* 非关键路径 */
    }
  },
  onGoReview() {
    trackEvent('review_entry_click', 'practice_done');
    wx.setStorageSync('autoStartReview', 1);
    wx.switchTab({ url: '/pages/book/book' });
  },
  onRetry() {
    this._resultSent = false;
    this.setData({ finished: false, percentile: null });
    this.start(this._mode, this.data.items.length || 10);
  },
  onQuit() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
  },
});
