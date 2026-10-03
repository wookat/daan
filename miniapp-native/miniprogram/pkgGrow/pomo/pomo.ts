// 番茄专注：纯前端计时器（25/5 循环），完成数与时长存本地 kgPomo
// 不依赖后端；跨天归零按 Asia/Shanghai 日界
import { cnToday } from '../../utils/cn-date';

const KEY = 'kgPomo';
const FOCUS_MIN = 25;
const BREAK_MIN = 5;

interface PomoStore {
  day: string; // YYYY-MM-DD
  done: number; // 今日完成番茄数
  secs: number; // 今日累计专注秒数
  total: number; // 累计完成番茄数
}

function dayKey(): string {
  const t = cnToday();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

function loadStore(): PomoStore {
  const d = dayKey();
  const raw = (wx.getStorageSync(KEY) || {}) as Partial<PomoStore>;
  if (raw.day !== d) return { day: d, done: 0, secs: 0, total: raw.total || 0 };
  return { day: d, done: raw.done || 0, secs: raw.secs || 0, total: raw.total || 0 };
}

function saveStore(s: PomoStore): void {
  wx.setStorageSync(KEY, s);
}

Page({
  data: {
    phase: 'idle' as 'idle' | 'focus' | 'break' | 'done',
    left: FOCUS_MIN * 60,
    leftText: `${FOCUS_MIN}:00`,
    pct: 0,
    round: 0, // 本轮第几个番茄
    todayDone: 0,
    todayMins: 0,
    total: 0,
    running: false,
  },

  _timer: 0 as ReturnType<typeof setInterval> | 0,
  _store: null as PomoStore | null,

  onLoad() {
    this._store = loadStore();
    this.setData({
      todayDone: this._store.done,
      todayMins: Math.round(this._store.secs / 60),
      total: this._store.total,
    });
  },

  onUnload() {
    this._stopTick();
  },
  onHide() {
    // 退后台按时间差结算：不清计时，记录锚点
    this._leftAt = Date.now();
  },
  onShow() {
    if (this._leftAt && this.data.running) {
      const gone = Math.floor((Date.now() - this._leftAt) / 1000);
      const left = Math.max(0, this.data.left - gone);
      this.setData({ left });
      if (left <= 0) this._finishPhase();
      else this._paint();
    }
    this._leftAt = 0;
  },
  _leftAt: 0,

  _stopTick() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = 0;
    }
  },

  _paint() {
    const total = (this.data.phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60;
    const left = this.data.left;
    const m = Math.floor(left / 60);
    const s = left % 60;
    this.setData({
      leftText: `${m}:${String(s).padStart(2, '0')}`,
      pct: Math.round(((total - left) / total) * 100),
    });
  },

  _startPhase(phase: 'focus' | 'break') {
    this._stopTick();
    this.setData({ phase, running: true, left: (phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60 });
    this._paint();
    this._timer = setInterval(() => {
      const left = this.data.left - 1;
      if (left <= 0) {
        this._finishPhase();
        return;
      }
      this.setData({ left });
      this._paint();
    }, 1000);
  },

  _finishPhase() {
    this._stopTick();
    wx.vibrateShort({ type: 'medium' }).catch(() => {});
    if (this.data.phase === 'focus') {
      const st = this._store || loadStore();
      st.done += 1;
      st.secs += FOCUS_MIN * 60;
      st.total += 1;
      this._store = st;
      saveStore(st);
      this.setData({ todayDone: st.done, todayMins: Math.round(st.secs / 60), total: st.total, round: this.data.round + 1 });
      this._startPhase('break');
    } else {
      this.setData({ phase: 'done', running: false });
      wx.showToast({ title: '休息结束，再来一个？', icon: 'none' });
    }
  },

  onStart() {
    this._startPhase('focus');
  },
  onPause() {
    this._stopTick();
    this.setData({ running: false });
  },
  onResume() {
    if (!this.data.left) return;
    this.setData({ running: true });
    this._timer = setInterval(() => {
      const left = this.data.left - 1;
      if (left <= 0) {
        this._finishPhase();
        return;
      }
      this.setData({ left });
      this._paint();
    }, 1000);
  },
  onSkipBreak() {
    this._stopTick();
    this.setData({ phase: 'done', running: false });
  },
  onReset() {
    this._stopTick();
    this.setData({ phase: 'idle', running: false, left: FOCUS_MIN * 60, round: 0 });
    this._paint();
  },
});
