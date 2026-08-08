import { fetchMockEvents, mockEnter, mockRegister } from '../../api/index';
import type { MockEvent, MockPastEvent } from '../../api/types';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtWindow(ev: MockEvent): string {
  const o = new Date(ev.open_at * 1000);
  const c = new Date(ev.close_at * 1000);
  return `${o.getMonth() + 1}月${o.getDate()}日 ${pad(o.getHours())}:${pad(o.getMinutes())} - ${
    c.getHours() === 0 ? '24:00' : pad(c.getHours()) + ':' + pad(c.getMinutes())
  }`;
}

function fmtDay(t: number): string {
  const d = new Date(t * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function countdown(ev: MockEvent): string {
  const target = ev.phase === 'upcoming' ? ev.open_at : ev.close_at;
  let s = Math.max(0, Math.floor(target - Date.now() / 1000));
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  return (d ? d + ' 天 ' : '') + h + ' 时 ' + m + ' 分';
}

const PHASE_TEXT: Record<string, string> = {
  upcoming: '未开始',
  running: '进行中',
  ended: '已结束',
};

Page({
  data: {
    loading: true,
    event: null as MockEvent | null,
    phaseText: '',
    windowText: '',
    countdownText: '',
    past: [] as Array<MockPastEvent & { dayText: string }>,
    rulesOpen: false,
  },
  _timer: 0 as number | ReturnType<typeof setInterval>,

  onShow() {
    this.load();
    this._timer = setInterval(() => {
      const ev = this.data.event;
      if (!ev) return;
      const now = Date.now() / 1000;
      if ((ev.phase === 'upcoming' && now >= ev.open_at) || (ev.phase === 'running' && now >= ev.close_at)) {
        this.load();
        return;
      }
      this.setData({ countdownText: countdown(ev) });
    }, 30000);
  },
  onHide() {
    this.stopTimer();
  },
  onUnload() {
    this.stopTimer();
  },
  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer as ReturnType<typeof setInterval>);
      this._timer = 0;
    }
  },

  async load() {
    try {
      const d = await fetchMockEvents();
      const event = d.current || d.next || null;
      this.setData({
        event,
        phaseText: event ? PHASE_TEXT[event.phase] || '' : '',
        windowText: event ? fmtWindow(event) : '',
        countdownText: event ? countdown(event) : '',
        past: (d.past || []).map((p) => ({ ...p, dayText: fmtDay(p.close_at) })),
      });
    } catch (e) {
      wx.showToast({ title: '加载失败：' + (e as Error).message, icon: 'none' });
    }
    this.setData({ loading: false });
  },

  async onRegister() {
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

  async onEnter() {
    const ev = this.data.event;
    if (!ev) return;
    try {
      const d = await mockEnter(ev.id);
      wx.navigateTo({
        url: '/pages/exam-run/exam-run?paper_id=' + d.paper_id + '&event_id=' + ev.id,
      });
    } catch (e) {
      wx.showToast({ title: (e as Error).message, icon: 'none' });
    }
  },

  onPractice() {
    const ev = this.data.event;
    if (!ev) return;
    wx.navigateTo({ url: '/pages/exam-run/exam-run?paper_id=' + ev.paper_id });
  },

  onOpenReport(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    wx.navigateTo({ url: '/pages/contest-report/contest-report?event_id=' + id });
  },

  onPastRow(e: WechatMiniprogram.TouchEvent) {
    const idx = Number(e.currentTarget.dataset.index);
    const p = this.data.past[idx];
    if (p && p.joined) {
      wx.navigateTo({ url: '/pages/contest-report/contest-report?event_id=' + p.id });
    }
  },

  toggleRules() {
    this.setData({ rulesOpen: !this.data.rulesOpen });
  },
});
