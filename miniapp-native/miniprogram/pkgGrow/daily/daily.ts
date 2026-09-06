// 每日一练（全站同题）/ 时政每日一练：对齐 H5 practice.vue 的 startDaily/markDailyDone/startShizheng/reviewShizheng/markShizhengDone。
// kind=set|daily|shizheng|szreview（daily 同 set；szreview 同 shizheng，今日已完成时直接进回顾态）；archive=1 时先弹近 7 天日期选择（H5 pickArchiveDay）；往期补练不提交榜单、不打卡、不写完成态。
import { postAnswerLog, postMistake } from '../../api/index';
import type { AnswerLogItem, Question } from '../../api/types';
import {
  fetchDailyBoard,
  fetchDailySet,
  fetchShizhengDaily,
  loadSzDaily,
  saveSzDaily,
  submitDailySet,
} from '../../api/grow';
import type { DailyBoardRow, DailySubmitResp, ShizhengQuestion } from '../../api/grow';
import { anonUid } from '../../utils/auth';
import { enqueueAnswers, enqueueMistake } from '../../utils/offline';
import { recordStat } from '../../utils/stats';
import { cnDayKey, cnToday, ymd } from '../../utils/cn-date';
import type { OptionItem } from '../../components/kg-option-group/index';

type Kind = 'set' | 'shizheng';

interface DQ extends Question {
  _picked: string;
  _secs: number;
  _logged: boolean;
  _saved: boolean;
  _sz: boolean;
  optList: OptionItem[];
  expText: string;
}

interface BoardView extends DailyBoardRow {
  secsText: string;
  tone: string;
}

interface ReviewRow {
  n: number;
  question: string;
  picked: string;
  answer: string;
  ok: boolean;
}

function fmtSecs(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? m + '分' + (r < 10 ? '0' + r : r) + '秒' : r + '秒';
}

function toDQ(q: Question | ShizhengQuestion, sz: boolean): DQ {
  const note = sz ? (q as ShizhengQuestion).source_note : null;
  return {
    ...q,
    _picked: '',
    _secs: 0,
    _logged: false,
    _saved: false,
    _sz: sz,
    optList: Object.keys(q.options || {})
      .sort()
      .map((k) => ({ k, v: q.options[k] })),
    expText: (q.explanation || '') + (note ? '\n【出处】' + note : ''),
  };
}

function statsText(d: DailySubmitResp): string {
  let s: string;
  if (d.already) s = '今日全站同题成绩已记录（首次 ' + d.my_right + ' 对） · ' + d.participants + ' 人完成';
  else if (d.beat_pct == null) s = '今日全站同题 · 你是今天第 1 位完成者';
  else s = '今日全站同题 · ' + d.participants + ' 人完成 · 击败 ' + d.beat_pct + '%';
  if (d.streak >= 2) s += ' · 已连续参与 ' + d.streak + ' 天';
  return s;
}

Page({
  data: {
    kind: 'set' as Kind,
    title: '每日一练',
    subTitle: '',
    state: 'loading' as 'loading' | 'error' | 'empty' | 'play' | 'done',
    errMsg: '',
    past: false,
    qFs: 16,
    optFs: 15,
    expFs: 14,
    date: '',
    items: [] as DQ[],
    idx: 0,
    cur: null as DQ | null,
    right: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    qsecs: 0,
    qsecsText: '0秒',
    // 完成态
    totalSecsText: '',
    dailyStats: null as DailySubmitResp | null,
    dailyStatsText: '',
    board: [] as BoardView[],
    myRank: null as number | null,
    review: [] as ReviewRow[],
    showReview: false,
    doneTitle: '',
  },
  _timer: 0 as number,
  _archiveDate: '' as string,
  _reviewMode: false,

  onLoad(query: Record<string, string>) {
    const kind: Kind = query.kind === 'shizheng' || query.kind === 'szreview' ? 'shizheng' : 'set';
    this.setData({ kind, title: kind === 'shizheng' ? '时政每日一练' : '每日一练' });
    if (query.date) {
      this._archiveDate = query.date;
      this.load();
    } else if (query.archive === '1') {
      this.pickArchiveDay();
    } else {
      this.load();
    }
  },
  onUnload() {
    this.stopTimer();
  },
  onHide() {
    this.stopTimer();
  },
  onShow() {
    if (this.data.state === 'play' && this.data.cur && !this.data.cur._picked) this.startTimer();
  },

  // 近 7 天往期（H5 pickArchiveDay：东八区日界，昨天/前天标注）
  pickArchiveDay() {
    const days: string[] = [];
    const base = cnToday();
    for (let i = 1; i <= 7; i++) {
      const d = new Date(base.getTime() - i * 86400e3);
      days.push(ymd(d));
    }
    wx.showActionSheet({
      itemList: days.map((d, i) => d + (i === 0 ? '（昨天）' : i === 1 ? '（前天）' : '')),
      success: (res) => {
        this._archiveDate = days[res.tapIndex];
        this.load();
      },
      fail: () => {
        if (this.data.state === 'loading' && !this.data.items.length) this.load();
      },
    });
  },
  onRetry() {
    this.load();
  },
  onPickArchive() {
    this.pickArchiveDay();
  },

  async load() {
    this.stopTimer();
    this._reviewMode = false;
    this.setData({ state: 'loading', errMsg: '', dailyStats: null, dailyStatsText: '', board: [], review: [], showReview: false });
    const cnDay = cnDayKey();
    const archive = this._archiveDate;
    const past = !!archive && archive !== cnDay;
    try {
      if (this.data.kind === 'shizheng') {
        // 今日已完成 → 回顾态（H5 reviewShizheng），不重复计分
        const rec = !past ? loadSzDaily().days[cnDay] : null;
        const d = await fetchShizhengDaily(past ? archive : undefined);
        if (!d.items || !d.items.length) {
          this.setData({ state: 'empty', errMsg: '时政题库准备中，敬请期待' });
          return;
        }
        const items = d.items.map((q) => toDQ(q, true));
        if (rec) {
          items.forEach((q, i) => {
            q._picked = (rec.picks || [])[i] || '';
            q._secs = (rec.secs || [])[i] || 0;
            q._logged = true;
            q._saved = true;
          });
          this._reviewMode = true;
          this.setData({ items, date: d.date, past: false, right: rec.right || 0, bestStreak: rec.best || 0, subTitle: '今日已完成 · 回顾' });
          this.finish(false);
          return;
        }
        this.begin(items, d.date, past);
        wx.showToast({ title: past ? '往期时政 · ' + d.date : '时政每日一练 · ' + d.date, icon: 'none' });
      } else {
        const d = await fetchDailySet(past ? archive : undefined);
        if (!d.items || !d.items.length) {
          this.setData({ state: 'empty', errMsg: '今日题组尚未生成，稍后再来' });
          return;
        }
        const isPast = d.date !== cnDay;
        this.begin(
          d.items.map((q) => toDQ(q, false)),
          d.date,
          isPast
        );
        wx.showToast({ title: isPast ? '往期每日一练 · ' + d.date : '每日一练 · 今日全站同题', icon: 'none' });
      }
    } catch (e) {
      this.setData({ state: 'error', errMsg: (e as Error).message || '连接失败' });
    }
  },
  begin(items: DQ[], date: string, past: boolean) {
    this.setData({
      state: 'play',
      items,
      date,
      past,
      idx: 0,
      cur: items[0],
      right: 0,
      wrong: 0,
      streak: 0,
      bestStreak: 0,
      qsecs: 0,
      qsecsText: '0秒',
      subTitle: (past ? '往期补练 · ' : '') + date,
    });
    this.startTimer();
  },

  startTimer() {
    this.stopTimer();
    this._timer = setInterval(() => {
      const s = this.data.qsecs + 1;
      this.setData({ qsecs: s, qsecsText: fmtSecs(s) });
    }, 1000) as unknown as number;
  },
  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = 0;
  },

  onPick(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const { cur, idx, items } = this.data;
    if (!cur || cur._picked) return;
    this.stopTimer();
    const picked = e.detail.key;
    const correct = picked === cur.answer;
    cur._picked = picked;
    cur._secs = this.data.qsecs;
    items[idx] = cur;
    const streak = correct ? this.data.streak + 1 : 0;
    this.setData({
      cur,
      items,
      right: this.data.right + (correct ? 1 : 0),
      wrong: this.data.wrong + (correct ? 0 : 1),
      streak,
      bestStreak: Math.max(this.data.bestStreak, streak),
    });
    // 本地统计（首页今日题数）与 H5 pick 同步；往期补练同样计入练题量
    recordStat(cur.module || (cur._sz ? '时政' : ''), correct, cur.submodule);
    try {
      wx.vibrateShort({ type: correct ? 'light' : 'medium' });
    } catch (err) {
      /* 不支持则忽略 */
    }
    if (!correct) this.saveWrong(cur);
    this.logAttempts([cur]);
  },
  onNext() {
    const { idx, items } = this.data;
    const next = idx + 1;
    if (next < items.length) {
      this.setData({ idx: next, cur: items[next], qsecs: 0, qsecsText: '0秒' });
      this.startTimer();
    } else {
      this.finish(true);
    }
  },

  // 完成：当日提交榜单/打卡；往期只展示成绩（H5 markDailyDone / markShizhengDone）
  finish(fresh: boolean) {
    this.stopTimer();
    const { items, kind, past, date, right, bestStreak } = this.data;
    const totalSecs = items.reduce((a, q) => a + (q._secs || 0), 0);
    const review: ReviewRow[] = items.map((q, i) => ({
      n: i + 1,
      question: q.question,
      picked: q._picked || '—',
      answer: q.answer,
      ok: q._picked === q.answer,
    }));
    this.setData({
      state: 'done',
      cur: null,
      totalSecsText: fmtSecs(totalSecs),
      review,
      doneTitle: past ? '往期补练完成' : kind === 'shizheng' ? '时政每日一练完成！' : '今日一练完成，打卡成功！',
    });
    if (!fresh) return;
    if (past) {
      wx.showToast({ title: kind === 'shizheng' ? '往期时政补练完成' : '往期补练完成', icon: 'none' });
      return;
    }
    if (kind === 'shizheng') {
      const sz = loadSzDaily();
      sz.days[cnDayKey()] = {
        right,
        best: bestStreak,
        picks: items.map((q) => q._picked || ''),
        secs: items.map((q) => q._secs || 0),
      };
      saveSzDaily(sz);
      return;
    }
    if (!date) return;
    submitDailySet({ date, right, total: items.length, secs: totalSecs })
      .then((d) => {
        this.setData({ dailyStats: d, dailyStatsText: statsText(d), myRank: d.my_rank });
        return fetchDailyBoard();
      })
      .then((b) => {
        const rows = ((b && b.items) || []).slice(0, 10).map((r) => ({
          ...r,
          secsText: r.secs ? ' · ' + fmtSecs(r.secs) : '',
          tone: r.rank <= 3 ? 'warn' : 'neutral',
        }));
        this.setData({ board: rows });
      })
      .catch(() => {
        /* 已落待提交队列，首页 flushDailySubmit 补发 */
      });
  },

  async logAttempts(qs: DQ[]) {
    const uid = anonUid();
    const pending = qs.filter((q) => q._picked && !q._logged);
    const items: AnswerLogItem[] = pending.map((q) => ({
      qid: q.id || null,
      module: q.module || null,
      submodule: q.submodule || null,
      correct: q._picked === q.answer,
      secs: q._secs || 0,
      picked: q._picked,
      source: null,
      t: Date.now(),
    }));
    if (!items.length) return;
    pending.forEach((q) => {
      q._logged = true;
    });
    try {
      await postAnswerLog(items);
    } catch (err) {
      enqueueAnswers(uid, items);
    }
  },
  async saveWrong(q: DQ) {
    if (q._saved) return;
    q._saved = true;
    const optText = q.optList.map((o) => o.k + '.' + o.v).join(' ');
    const m = {
      question_id: q._sz ? null : q.id || null,
      module: q.module,
      question_type: q.question_type || q.submodule,
      question_text: q.question + '\n' + optText,
      user_answer: q._picked,
      correct_answer: q.answer,
      explanation: q.explanation || '',
    };
    try {
      await postMistake(m);
    } catch (e) {
      enqueueMistake({ uid: anonUid(), ...m });
    }
  },

  onToggleReview() {
    this.setData({ showReview: !this.data.showReview });
  },
  onAgain() {
    // 时政今日已完成后只允许回顾（H5 reviewShizheng）；每日一练再练一遍走随机题
    if (this.data.kind === 'shizheng' && this._reviewMode) {
      wx.showToast({ title: '今日时政已完成，明天再来', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/practice/practice?count=10' });
  },
  onHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },
  onQuit() {
    if (this.data.state !== 'play' || !this.data.items.some((q) => q._picked)) {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
      return;
    }
    wx.showModal({
      title: '退出练习？',
      content: '已作答记录已上报，未完成不计入今日一练完成态',
      confirmText: '退出',
      success: (r) => {
        if (r.confirm) wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/home' }) });
      },
    });
  },
  onShareAppMessage() {
    const { kind, date, right, items, dailyStats } = this.data;
    let title = kind === 'shizheng' ? '时政每日一练 · ' + date : '每日一练 · 全站同题';
    if (this.data.state === 'done' && items.length) {
      title = '我完成了 ' + date + (kind === 'shizheng' ? ' 时政每日一练' : ' 每日一练') + '，答对 ' + right + '/' + items.length;
      if (dailyStats && dailyStats.beat_pct != null) title += '，击败全站 ' + dailyStats.beat_pct + '%';
    }
    return { title, path: '/pkgGrow/daily/daily?kind=' + kind };
  },
});
