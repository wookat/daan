// 答题 PK（对齐 frontend-uni/src/pkgA/pk/pk.vue）：大厅（本周榜/我的对局）→ 30 秒/题限时答题 → 结果/等待页。
// 提交失败先向服务端确认是否已生效，未生效则常驻「重新提交」；未交卷局 creator/opponent 双侧可续答；观战不标「（我）」。
import { trackEvent } from '../../api/index';
import {
  pkCreate,
  pkJoin,
  pkLeaderboard,
  pkMatch,
  pkMine,
  pkRandomMatch,
  pkSubmit,
} from '../../api/social';
import type { PkLeaderboardResp, PkMatch, PkPlayer, PkQuestion } from '../../api/social';
import { pkNickname } from '../../utils/auth';
import { SITE_URL } from '../../utils/config';
import { MODULE_KEYS, MODULES } from '../../utils/module-meta';
import { toastInfo } from '../../utils/toast';

type Side = 'creator' | 'opponent';
type View = 'home' | 'quiz' | 'result';

const PER_Q_SEC = 30;

interface Ans {
  question_id: number;
  answer: string;
  ms: number;
}

interface MineRow {
  code: string;
  title: string;
  desc: string;
  badge: string;
  tone: string;
}

interface LbRow {
  rank: number;
  name: string;
  wins: number;
  tone: string;
}

interface PSide {
  name: string;
  score: string;
  meta: string;
  done: boolean;
}

function modLabel(k: string | null | undefined): string {
  return (k && MODULES[k] && MODULES[k].label) || '混合';
}

function fmtMs(ms?: number | null): string {
  if (ms == null) return '—';
  return (ms / 1000).toFixed(1) + 's';
}

function sideOf(m: PkMatch, side: Side | null): PkPlayer | null {
  return side === 'opponent' ? m.opponent : m.creator;
}

function otherOf(m: PkMatch, side: Side | null): PkPlayer | null {
  return side === 'opponent' ? m.creator : m.opponent;
}

function matchDesc(m: PkMatch): string {
  const my = sideOf(m, m.my_side);
  const their = otherOf(m, m.my_side);
  if (m.status === 'finished') return `${my ? my.score : '—'} : ${their ? their.score : '—'} · ${their ? their.name : ''}`;
  if (!my || !my.done) return '待作答';
  return their ? `等待 ${their.name} 完成` : '等待对手应战';
}

function matchBadge(m: PkMatch): { t: string; tone: string } {
  if (m.status !== 'finished') return { t: '等待中', tone: 'warn' };
  if (m.winner === 'draw') return { t: '平局', tone: 'neutral' };
  return m.winner === m.my_side ? { t: '胜', tone: 'ok' } : { t: '负', tone: 'bad' };
}

function pSide(p: PkPlayer | null, n: number, mine: boolean): PSide {
  if (!p) return { name: '虚位以待', score: '?', meta: '等待对手完成同组 10 题', done: false };
  if (!p.done) return { name: p.name, score: '?', meta: '等待对手完成同组 10 题', done: false };
  return {
    name: p.name + (mine ? '（我）' : ''),
    score: String(p.score == null ? '—' : p.score),
    meta: `答对 ${p.correct == null ? '—' : p.correct}/${n} · 用时 ${fmtMs(p.time_ms)}`,
    done: true,
  };
}

Page({
  data: {
    view: 'home' as View,
    module: '',
    modOpts: MODULE_KEYS.map((k) => ({ value: k, label: MODULES[k].label })).concat({ value: '', label: '混合' }),
    joinCode: '',
    myWins: 0,
    myRank: 0,
    lbRows: [] as LbRow[],
    mineRows: [] as MineRow[],
    mineWins: 0,
    loading: true,
    loadErr: '',
    // 对局
    code: '',
    myName: pkNickname(),
    mySide: null as Side | null,
    qIndex: 0,
    total: 0,
    curQ: null as PkQuestion | null,
    curOpts: [] as { k: string; v: string }[],
    curTag: '',
    picked: '',
    answered: 0,
    timeLeft: PER_Q_SEC,
    streak: [] as string[],
    rivalName: '',
    rivalAv: '?',
    rivalDone: false,
    submitting: false,
    submitFailed: false,
    // 结果
    resTitle: '',
    resModule: '',
    me: null as PSide | null,
    them: null as PSide | null,
    myScore: '',
    finished: false,
    noOppHint: false,
  },

  questions: [] as PkQuestion[],
  answers: [] as Ans[],
  mineItems: [] as PkMatch[],
  match: null as PkMatch | null,
  qStart: 0,
  timerId: 0 as ReturnType<typeof setInterval> | 0,
  waitTimerId: 0 as ReturnType<typeof setTimeout> | 0,
  waitPollId: 0 as ReturnType<typeof setInterval> | 0,
  fromRandom: false,

  onLoad(query: Record<string, string>) {
    if (query && query.code) {
      this.setData({ joinCode: query.code });
      this.joinByCode();
    }
  },
  onShow() {
    if (this.data.view === 'home') this.loadHome();
  },
  onUnload() {
    this.stopTimer();
    this.stopWaitWatch();
  },
  onShareAppMessage() {
    const code = this.data.code || (this.match && this.match.code) || '';
    return { title: `${this.data.myName} 向你发起答题 PK，敢来应战吗？`, path: `/pkgSocial/pk/pk?code=${code}` };
  },

  // ---------- 大厅 ----------
  async loadHome() {
    this.setData({ loadErr: '' });
    try {
      const [lb, mine] = (await Promise.all([pkLeaderboard(), pkMine()])) as [PkLeaderboardResp, { items: PkMatch[]; wins: number }];
      this.setData({
        myWins: lb.my_wins || 0,
        myRank: lb.my_rank || 0,
        lbRows: lb.items.map((e, i) => {
          const rank = e.rank || i + 1;
          return { rank, name: e.name, wins: e.wins, tone: rank === 1 ? 'warn' : rank <= 3 ? 'brand' : 'neutral' };
        }),
        mineWins: mine.wins || 0,
        mineRows: mine.items.map((m) => {
          const b = matchBadge(m);
          return { code: m.code, title: `${modLabel(m.module)} · ${m.code}`, desc: matchDesc(m), badge: b.t, tone: b.tone };
        }),
      });
      this.mineItems = mine.items;
    } catch (e) {
      this.setData({ loadErr: (e as Error).message || '网络异常' });
    }
    this.setData({ loading: false });
  },

  onPickModule(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ module: e.detail.value || '' });
  },
  onCodeInput(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({ joinCode: e.detail.value });
  },

  async createMatch() {
    try {
      wx.showLoading({ title: '出题中…' });
      const d = await pkCreate(this.data.module || null);
      wx.hideLoading();
      this.fromRandom = false;
      this.startQuiz(d.code, d.questions, 'creator');
    } catch (e) {
      wx.hideLoading();
      toastInfo((e as Error).message || '发起失败');
    }
  },

  async randomMatch() {
    try {
      wx.showLoading({ title: '匹配中…' });
      const d = await pkRandomMatch(this.data.module || null);
      wx.hideLoading();
      if (d.matched) {
        toastInfo('已匹配到对手！');
        this.startQuiz(d.code, d.questions, 'opponent');
        this.loadRival(d.code);
      } else {
        toastInfo('暂无对手，已为你开局等待匹配');
        this.fromRandom = true;
        this.startQuiz(d.code, d.questions, 'creator');
      }
    } catch (e) {
      wx.hideLoading();
      toastInfo((e as Error).message || '匹配失败');
    }
  },

  async joinByCode() {
    const code = (this.data.joinCode || '').trim().toUpperCase();
    if (!code) {
      toastInfo('请输入挑战码');
      return;
    }
    try {
      wx.showLoading({ title: '加入中…' });
      const d = await pkJoin(code);
      wx.hideLoading();
      this.startQuiz(d.code, d.questions, 'opponent');
      this.loadRival(d.code);
    } catch (e) {
      wx.hideLoading();
      const msg = (e as Error).message || '';
      // 已提交过：直接看结果
      if (msg.includes('已被') || msg.includes('自己')) this.viewResult(code);
      else toastInfo(msg || '加入失败');
    }
  },

  async loadRival(code: string) {
    try {
      const d = await pkMatch(code);
      const their = otherOf(d.match, d.match.my_side);
      if (their) this.setData({ rivalName: their.name, rivalAv: (their.name || '?').slice(0, 1), rivalDone: their.done });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  onOpenMatch(e: WechatMiniprogram.BaseEvent) {
    const code = String(e.currentTarget.dataset.code || '');
    const m = this.mineItems.find((x: PkMatch) => x.code === code);
    if (!m) return;
    const my = sideOf(m, m.my_side);
    if (m.my_side && !(my && my.done)) {
      // 未交卷（提交失败/中途离开）：重新拉题续答
      this.resumeMatch(m);
      return;
    }
    this.viewResult(m.code);
  },

  async resumeMatch(m: PkMatch) {
    try {
      wx.showLoading({ title: '加载中…' });
      const d = await pkJoin(m.code);
      wx.hideLoading();
      this.fromRandom = false;
      this.startQuiz(d.code, d.questions, m.my_side || 'creator');
      this.loadRival(d.code);
    } catch (e) {
      wx.hideLoading();
      toastInfo((e as Error).message || '加载失败');
    }
  },

  // ---------- 答题 ----------
  startQuiz(code: string, questions: PkQuestion[], side: Side) {
    if (side !== 'creator') this.fromRandom = false;
    this.questions = questions;
    this.answers = [];
    this.setData({
      code,
      mySide: side,
      total: questions.length,
      qIndex: 0,
      answered: 0,
      picked: '',
      submitFailed: false,
      rivalName: '',
      rivalAv: '?',
      rivalDone: false,
      view: 'quiz',
    });
    this.beginQ();
  },

  beginQ() {
    const q = this.questions[this.data.qIndex] || null;
    const o = (q && q.options) || {};
    this.qStart = Date.now();
    this.setData({
      curQ: q,
      curTag: q ? [modLabel(q.module), q.submodule || ''].filter(Boolean).join(' · ') : '',
      curOpts: Object.keys(o).map((k) => ({ k, v: String(o[k] == null ? '' : o[k]) })),
      picked: '',
      timeLeft: PER_Q_SEC,
      streak: this.questions.map((_q: PkQuestion, i: number) => (i < this.answers.length ? 'ok' : i === this.data.qIndex ? 'cur' : '')),
    });
    this.stopTimer();
    this.timerId = setInterval(() => {
      const left = Math.max(0, PER_Q_SEC - Math.floor((Date.now() - this.qStart) / 1000));
      if (left !== this.data.timeLeft) this.setData({ timeLeft: left });
      if (left <= 0) this.lockAnswer('');
    }, 250);
  },

  stopTimer() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = 0;
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    if (this.data.picked) return;
    const k = String(e.currentTarget.dataset.k || '');
    this.setData({ picked: k });
    setTimeout(() => this.lockAnswer(k), 350);
  },

  lockAnswer(k: string) {
    if (this.answers.length > this.data.qIndex) return;
    this.stopTimer();
    const q = this.data.curQ;
    if (!q) return;
    const ms = Math.min(Date.now() - this.qStart, PER_Q_SEC * 1000);
    this.answers.push({ question_id: q.id, answer: k, ms });
    this.setData({ answered: this.answers.length });
    if (this.data.qIndex < this.questions.length - 1) {
      this.setData({ qIndex: this.data.qIndex + 1 });
      this.beginQ();
    } else {
      this.finishQuiz();
    }
  },

  async finishQuiz() {
    if (this.data.submitting) return;
    this.setData({ submitting: true, submitFailed: false });
    try {
      wx.showLoading({ title: '判分中…' });
      const d = await pkSubmit(this.data.code, this.answers);
      wx.hideLoading();
      this.showResult(d.match, d.match.my_side || this.data.mySide);
      if (this.fromRandom && d.match.status !== 'finished') this.startWaitWatch();
    } catch (e) {
      wx.hideLoading();
      // 超时/断连时提交可能已在服务端生效，先确认比分再决定是否让用户重试
      try {
        const d = await pkMatch(this.data.code);
        const mySide = d.match && d.match.my_side;
        const me = mySide ? sideOf(d.match, mySide) : null;
        if (me && me.done) {
          this.showResult(d.match, mySide);
          if (this.fromRandom && d.match.status !== 'finished') this.startWaitWatch();
          return;
        }
      } catch (e2) {
        /* 忽略确认失败，走重试提示 */
      }
      this.setData({ submitFailed: true });
      toastInfo((e as Error).message || '提交超时，请重试');
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ---------- 结果 ----------
  showResult(m: PkMatch, side: Side | null) {
    this.match = m;
    const finished = m.status === 'finished';
    let resTitle = '⏳ 等待对手应战';
    if (finished) {
      if (!side) resTitle = '🏳️ 对局已结束';
      else if (m.winner === 'draw') resTitle = '🤝 平局！';
      else resTitle = m.winner === side ? '🏆 胜利！' : '💪 惜败，再战一局';
    }
    const meP = sideOf(m, side);
    this.setData({
      view: 'result',
      code: m.code,
      mySide: side,
      finished,
      resTitle,
      resModule: modLabel(m.module) === '混合' ? '混合模块' : modLabel(m.module),
      me: pSide(meP, m.n_questions, !!side),
      them: pSide(otherOf(m, side), m.n_questions, false),
      myScore: meP && meP.score != null ? String(meP.score) : '—',
    });
  },

  async viewResult(code: string) {
    try {
      const d = await pkMatch(code);
      this.showResult(d.match, d.match.my_side);
    } catch (e) {
      toastInfo((e as Error).message || '对局不存在');
    }
  },

  async refreshMatch() {
    await this.viewResult(this.data.code);
    toastInfo(this.match && this.match.status === 'finished' ? '对手已完成！' : '对手还没完成，稍后再看');
  },

  startWaitWatch() {
    this.stopWaitWatch();
    this.setData({ noOppHint: false });
    this.waitTimerId = setTimeout(() => {
      if (this.data.view === 'result' && this.match && this.match.status !== 'finished') this.setData({ noOppHint: true });
    }, 30000);
    this.waitPollId = setInterval(async () => {
      if (this.data.view !== 'result') {
        this.stopWaitWatch();
        return;
      }
      try {
        const d = await pkMatch(this.data.code);
        this.showResult(d.match, d.match.my_side || this.data.mySide);
        if (d.match.status === 'finished') {
          this.stopWaitWatch();
          toastInfo('对手已完成！');
        }
      } catch (e) {
        /* 非关键路径 */
      }
    }, 5000);
  },

  stopWaitWatch() {
    if (this.waitTimerId) clearTimeout(this.waitTimerId);
    if (this.waitPollId) clearInterval(this.waitPollId);
    this.waitTimerId = 0;
    this.waitPollId = 0;
  },

  copyCode() {
    if (!this.match) return;
    wx.setClipboardData({ data: this.match.code, success: () => toastInfo('挑战码已复制') });
  },
  shareMatch() {
    toastInfo('点右上角「…」转发给好友');
  },
  shareResult() {
    if (!this.match) return;
    const code = this.match.code;
    trackEvent('pk_result_copy', 'pk_share', code);
    wx.setClipboardData({
      data: `【答题PK战绩】不服来战：${SITE_URL}/p/${code}`,
      success: () => toastInfo('战绩链接已复制，发给考友吧'),
    });
  },
  rematch() {
    this.stopWaitWatch();
    this.setData({ module: (this.match && this.match.module) || '', view: 'home', noOppHint: false });
    this.loadHome();
  },
  backHome() {
    this.stopWaitWatch();
    this.setData({ view: 'home', noOppHint: false });
    this.loadHome();
  },
});
