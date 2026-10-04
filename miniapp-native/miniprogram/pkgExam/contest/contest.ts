// 模考大赛：对照 H5 pkgA/exam/contest.vue（当前/下一场 hero、往期折叠、赛制说明、公共榜单围观）
import { fetchMockEvents, fetchMockRank, mockEnter, mockRegister } from '../../api/exam';
import type { MockEvent, MockPastEvent, MockRankResp } from '../../api/exam-types';

const PHASE_TEXT: Record<string, string> = { upcoming: '未开始', running: '进行中', ended: '已结束' };
const RULES = [
  '1. 每周六 09:00-24:00（东八区）全站同卷比赛，报名可选，开赛后随时进入。',
  '2. 只有比赛窗口内交卷的成绩计入排名，且以首次交卷为准。',
  '3. 交卷后即可看到成绩与实时排名，比赛结束后排名冻结并生成赛后报告。',
  '4. 比赛结束后试卷转为普通试卷，可自由练习，不影响比赛榜单。',
  '5. 参赛人数较少时，报告会同时展示历史同卷分数池作为参照。',
];

const p2 = (n: number) => String(n).padStart(2, '0');

function fmtWindow(ev: MockEvent): string {
  const o = new Date(ev.open_at * 1000);
  const c = new Date(ev.close_at * 1000);
  const close = c.getHours() === 0 ? '24:00' : p2(c.getHours()) + ':' + p2(c.getMinutes());
  return `${o.getMonth() + 1}月${o.getDate()}日 ${p2(o.getHours())}:${p2(o.getMinutes())} - ${close}`;
}

function fmtCountdown(ev: MockEvent, nowSec: number): string {
  const target = ev.phase === 'upcoming' ? ev.open_at : ev.close_at;
  let s = Math.max(0, Math.floor(target - nowSec));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  return (d ? d + ' 天 ' : '') + h + ' 时 ' + m + ' 分';
}

function fmtDay(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

interface PastVM extends MockPastEvent {
  dayText: string;
  scoreText: string;
}

Page({
  data: {
    loading: true,
    loadErr: '',
    event: null as MockEvent | null,
    phaseText: '',
    phaseTone: 'neutral',
    seriesText: '',
    windowText: '',
    peopleText: '',
    countdown: '',
    past: [] as PastVM[],
    pastOpen: false,
    rulesOpen: false,
    rules: RULES,
    boardOpen: false,
    boardLoading: false,
    boardTitle: '',
    board: null as MockRankResp | null,
  },
  _timer: 0 as ReturnType<typeof setInterval> | 0,

  onShow() {
    this.load();
    this.stopTimer();
    this._timer = setInterval(() => {
      const ev = this.data.event;
      const now = Math.floor(Date.now() / 1000);
      if (ev) this.setData({ countdown: fmtCountdown(ev, now) });
      if (ev && ev.phase === 'upcoming' && now >= ev.open_at) this.load();
      if (ev && ev.phase === 'running' && now >= ev.close_at) this.load();
    }, 30000);
  },
  onHide() {
    this.stopTimer();
  },
  onUnload() {
    this.stopTimer();
  },
  stopTimer() {
    if (this._timer) clearInterval(this._timer);
    this._timer = 0;
  },

  onShareAppMessage() {
    const ev = this.data.event;
    return {
      title: ev ? `${ev.title} · 全站同卷模考大赛，敢来吗？` : '岸上见 · 模考大赛',
      path: '/pkgExam/contest/contest',
    };
  },

  async load() {
    this.setData({ loadErr: '' });
    try {
      const d = await fetchMockEvents();
      const ev = d.current || d.next;
      const now = Math.floor(Date.now() / 1000);
      this.setData({
        event: ev,
        phaseText: ev ? PHASE_TEXT[ev.phase] || '' : '',
        phaseTone: ev ? (ev.phase === 'running' ? 'ok' : ev.phase === 'upcoming' ? 'warn' : 'neutral') : 'neutral',
        seriesText: ev ? (ev.series === 'weekly' ? '每周六 · 全站同卷' : '专场比赛') : '',
        windowText: ev ? fmtWindow(ev) : '',
        peopleText: ev
          ? ev.registered || ev.submitted
            ? ev.registered + ' 人报名 · ' + ev.submitted + ' 人交卷'
            : '本场首批报名开放中 · 全站同卷'
          : '',
        countdown: ev ? fmtCountdown(ev, now) : '',
        past: (d.past || []).map((p) => ({
          ...p,
          dayText: fmtDay(p.close_at),
          scoreText: p.joined ? p.score + ' 分' + (p.rank ? ' · 第 ' + p.rank + ' 名' : '') : '',
        })),
      });
    } catch (e) {
      const msg = (e as Error).message || '网络异常';
      this.setData({ loadErr: msg });
      wx.showToast({ title: '加载失败：' + msg, icon: 'none' });
    }
    this.setData({ loading: false });
  },

  async register() {
    const ev = this.data.event;
    if (!ev) return;
    try {
      await mockRegister(ev.id);
      wx.showToast({ title: '报名成功，周六见！', icon: 'none' });
      this.load();
    } catch (e) {
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },
  async enter() {
    const ev = this.data.event;
    if (!ev) return;
    try {
      const d = await mockEnter(ev.id);
      wx.navigateTo({ url: '/pkgExam/exam/exam?paper_id=' + d.paper_id + '&event_id=' + ev.id });
    } catch (e) {
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },
  practice() {
    const ev = this.data.event;
    if (ev) wx.navigateTo({ url: '/pkgExam/exam/exam?paper_id=' + ev.paper_id });
  },
  openReport() {
    const ev = this.data.event;
    if (ev) wx.navigateTo({ url: '/pkgExam/contest-report/contest-report?event_id=' + ev.id });
  },
  onPastTap(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const p = this.data.past.find((x) => x.id === id);
    if (!p) return;
    if (p.joined) wx.navigateTo({ url: '/pkgExam/contest-report/contest-report?event_id=' + p.id });
    else this.openBoard(p.id, p.title);
  },
  onBoardCurrent() {
    const ev = this.data.event;
    if (ev) this.openBoard(ev.id, ev.title);
  },
  async openBoard(id: number, title: string) {
    this.setData({ boardOpen: true, boardLoading: true, boardTitle: title, board: null });
    try {
      const board = await fetchMockRank(id);
      this.setData({ board, boardLoading: false });
    } catch (e) {
      this.setData({ boardOpen: false, boardLoading: false });
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },
  closeBoard() {
    this.setData({ boardOpen: false, board: null });
  },
  togglePast() {
    this.setData({ pastOpen: !this.data.pastOpen });
  },
  toggleRules() {
    this.setData({ rulesOpen: !this.data.rulesOpen });
  },
  goList() {
    wx.navigateTo({ url: '/pkgExam/list/list' });
  },
});
