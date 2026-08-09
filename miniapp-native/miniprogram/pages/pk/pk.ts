import {
  pkCreate,
  pkJoin,
  pkLeaderboard,
  pkMatch,
  pkMine,
  pkNickname,
  pkRandomMatch,
  pkSubmit,
} from '../../api/p3';
import type { PkLeaderboard, PkMatch, PkMineItem, PkQuestion } from '../../api/p3';
import { MODULE_NAMES } from '../../utils/stats';

const PER_Q_SEC = 30;
const MODS = ['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi'];

interface PkQ extends PkQuestion {
  optList: Array<{ k: string; v: string }>;
  picked: string;
  ms: number;
}

interface MineRow {
  code: string;
  moduleName: string;
  result: '胜' | '负' | '平' | '进行中';
  vs: string;
  myScore: number;
  oppScore: number;
}

Page({
  data: {
    view: 'home' as 'home' | 'quiz' | 'result',
    nickname: '',
    mods: MODS.map((k) => ({ key: k, name: MODULE_NAMES[k] })),
    module: '' as string,
    joinCode: '',
    busy: false,
    // 榜单与我的对局
    lb: null as PkLeaderboard | null,
    mine: [] as MineRow[],
    wins: 0,
    // 对局
    code: '',
    items: [] as PkQ[],
    idx: 0,
    cur: null as PkQ | null,
    secLeft: PER_Q_SEC,
    // 结果
    match: null as PkMatch | null,
    resultText: '',
    waiting: false,
  },
  _timer: 0 as number | ReturnType<typeof setInterval>,
  _pollTimer: 0 as number | ReturnType<typeof setInterval>,
  _qStart: 0,

  onLoad(query: Record<string, string>) {
    this.setData({ nickname: pkNickname() });
    this.loadBoards();
    if (query.code) {
      this.joinByCode(String(query.code));
    }
  },
  onUnload() {
    this.stopTimer();
    this.stopPoll();
  },
  onShareAppMessage() {
    const code = this.data.code;
    return {
      title: code
        ? `${this.data.nickname} 向你发起答题 PK（挑战码 ${code}），敢来应战吗？`
        : '答题 PK：10 题限时对战，来一局？',
      path: '/pages/pk/pk' + (code ? '?code=' + code : ''),
    };
  },

  async loadBoards() {
    try {
      const [lb, mine] = await Promise.all([
        pkLeaderboard().catch(() => null),
        pkMine().catch(() => ({ items: [] as PkMineItem[], wins: 0 })),
      ]);
      const rows: MineRow[] = (mine.items || []).map((m) => {
        const my = m.my_side === 'opponent' ? m.opponent : m.creator;
        const opp = m.my_side === 'opponent' ? m.creator : m.opponent;
        let result: MineRow['result'] = '进行中';
        if (m.status === 'finished') {
          if (!m.winner) result = '平';
          else result = m.winner === m.my_side ? '胜' : '负';
        }
        return {
          code: m.code,
          moduleName: m.module ? MODULE_NAMES[m.module] || m.module : '混合',
          result,
          vs: opp ? opp.name : '等待应战',
          myScore: my ? my.score : 0,
          oppScore: opp ? opp.score : 0,
        };
      });
      this.setData({ lb, mine: rows, wins: mine.wins || 0 });
    } catch (e) {
      /* 非关键路径 */
    }
  },

  onPickMod(e: WechatMiniprogram.TouchEvent) {
    const k = String(e.currentTarget.dataset.mod || '');
    this.setData({ module: this.data.module === k ? '' : k });
  },
  onJoinInput(e: WechatMiniprogram.Input) {
    this.setData({ joinCode: e.detail.value.toUpperCase() });
  },

  async onCreate() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const d = await pkCreate(this.data.module || null);
      this.startQuiz(d.code, d.questions);
    } catch (e) {
      wx.showToast({ title: '发起失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ busy: false });
  },
  onJoin() {
    const code = this.data.joinCode.trim();
    if (!code) {
      wx.showToast({ title: '请输入挑战码', icon: 'none' });
      return;
    }
    this.joinByCode(code);
  },
  async joinByCode(code: string) {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const d = await pkJoin(code);
      this.startQuiz(d.code, d.questions);
    } catch (e) {
      wx.showToast({ title: '应战失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ busy: false });
  },
  async onRandom() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const d = await pkRandomMatch(this.data.module || null);
      wx.showToast({ title: d.matched ? '已匹配到对手，开始！' : '暂无对手，已发起新挑战', icon: 'none' });
      this.startQuiz(d.code, d.questions);
    } catch (e) {
      wx.showToast({ title: '匹配失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ busy: false });
  },

  startQuiz(code: string, questions: PkQuestion[]) {
    const items: PkQ[] = (questions || []).map((q) => ({
      ...q,
      optList: Object.keys(q.options || {})
        .sort()
        .map((k) => ({ k, v: q.options[k] })),
      picked: '',
      ms: 0,
    }));
    if (!items.length) {
      wx.showToast({ title: '对局题目为空', icon: 'none' });
      return;
    }
    this.setData({ view: 'quiz', code, items, idx: 0, cur: items[0], match: null });
    this.startTimer();
  },

  startTimer() {
    this.stopTimer();
    this._qStart = Date.now();
    this.setData({ secLeft: PER_Q_SEC });
    this._timer = setInterval(() => {
      const left = this.data.secLeft - 1;
      if (left <= 0) {
        this.commitPick('');
        return;
      }
      this.setData({ secLeft: left });
    }, 1000);
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },

  onPick(e: WechatMiniprogram.TouchEvent) {
    const k = String(e.currentTarget.dataset.key || '');
    this.commitPick(k);
  },
  commitPick(k: string) {
    this.stopTimer();
    const { idx, items } = this.data;
    const cur = items[idx];
    if (!cur || cur.picked) return;
    cur.picked = k || '-';
    cur.ms = Date.now() - this._qStart;
    const next = idx + 1;
    if (next < items.length) {
      this.setData({ items, idx: next, cur: items[next] });
      this.startTimer();
    } else {
      this.setData({ items, cur: null });
      this.submit();
    }
  },

  async submit() {
    try {
      const d = await pkSubmit(
        this.data.code,
        this.data.items.map((q) => ({
          question_id: q.id,
          answer: q.picked === '-' ? '' : q.picked,
          ms: q.ms,
        }))
      );
      this.applyMatch(d.match);
    } catch (e) {
      wx.showToast({ title: '提交失败：' + (e as Error).message, icon: 'none' });
      this.setData({ view: 'home' });
    }
  },

  applyMatch(m: PkMatch) {
    let text = '等待对手应战…';
    let waiting = true;
    if (m.status === 'finished') {
      waiting = false;
      if (!m.winner) text = '🤝 平局！';
      else text = m.winner === m.my_side ? '🏆 你赢了！' : '💪 惜败，再战一局！';
    }
    this.setData({ view: 'result', match: m, resultText: text, waiting });
    if (waiting) this.startPoll();
    else {
      this.stopPoll();
      this.loadBoards();
    }
  },
  startPoll() {
    this.stopPoll();
    this._pollTimer = setInterval(async () => {
      try {
        const d = await pkMatch(this.data.code);
        if (d.match.status === 'finished') this.applyMatch(d.match);
      } catch (e) {
        /* 轮询失败忽略 */
      }
    }, 4000);
  },
  stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer as ReturnType<typeof setInterval>);
      this._pollTimer = 0;
    }
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.code,
      success: () => wx.showToast({ title: '挑战码已复制，发给研友应战', icon: 'none' }),
    });
  },
  onOpenMatch(e: WechatMiniprogram.TouchEvent) {
    const code = String(e.currentTarget.dataset.code || '');
    if (!code) return;
    this.setData({ code });
    pkMatch(code)
      .then((d) => this.applyMatch(d.match))
      .catch((err) => wx.showToast({ title: (err as Error).message, icon: 'none' }));
  },
  onBackHome() {
    this.stopPoll();
    this.setData({ view: 'home', code: '', match: null });
    this.loadBoards();
  },
});
