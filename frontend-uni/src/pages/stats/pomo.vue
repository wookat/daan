<template>
  <view class="wrap pomo-page">
    <kg-card class="sec">
      <view class="dial" :class="phase">
        <text class="dial-phase">{{ phaseText }}</text>
        <text class="dial-time num">{{ leftText }}</text>
        <view class="dial-bar"><view class="dial-fill" :style="{ transform: 'scaleX(' + Math.max(0, Math.min(1, pct / 100)) + ')' }" /></view>
        <text v-if="round" class="dial-round">今日第 {{ round }} 个</text>
      </view>
      <view class="ops">
        <kg-button v-if="phase === 'idle' || phase === 'done'" variant="primary" size="lg" block icon="clock" @click="start('focus')">开始专注 25 分钟</kg-button>
        <template v-if="phase === 'focus'">
          <kg-button v-if="running" variant="secondary" size="lg" block @click="pause">暂停</kg-button>
          <kg-button v-else variant="primary" size="lg" block @click="resume">继续</kg-button>
          <kg-button variant="text" size="md" block @click="reset">放弃本轮</kg-button>
        </template>
        <template v-if="phase === 'break'">
          <kg-button variant="secondary" size="lg" block @click="skipBreak">跳过休息</kg-button>
        </template>
      </view>
    </kg-card>

    <kg-card class="sec">
      <kg-stat-row :items="[
        { label: '今日番茄', value: todayDone },
        { label: '今日分钟', value: todayMins },
        { label: '累计番茄', value: total },
      ]" />
      <text class="tip">每 25 分钟专注 + 5 分钟休息为一轮，切后台或返回后计时继续。</text>
    </kg-card>
  </view>
</template>

<script>
// 番茄专注：纯前端计时器（25/5 循环），完成数与时长存本地 kgPomo，进行中状态存 kgPomoLive
import { toastOk, toastInfo } from '../../utils/toast.js';

const KEY = 'kgPomo';
const LIVE_KEY = 'kgPomoLive';
const FOCUS_MIN = 25;
const BREAK_MIN = 5;

function dayKey() {
  // 按中国标准时间（UTC+8）按日清零，避免 getTimezoneOffset() 与 getUTC* 叠加导致 08:00 才重置
  const d = new Date(Date.now() + 8 * 3600000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
function loadStore() {
  const d = dayKey();
  const raw = uni.getStorageSync(KEY) || {};
  if (raw.day !== d) return { day: d, done: 0, secs: 0, total: raw.total || 0 };
  return { day: d, done: raw.done || 0, secs: raw.secs || 0, total: raw.total || 0 };
}

export default {
  data() {
    return {
      phase: 'idle', // idle | focus | break | done
      running: false,
      left: FOCUS_MIN * 60,
      round: 0,
      todayDone: 0,
      todayMins: 0,
      total: 0,
    };
  },
  created() {
    this._timer = null;
    this._endAt = 0;
  },
  computed: {
    phaseText() {
      return { idle: '准备开始', focus: '专注中', break: '休息一下', done: '本轮完成' }[this.phase];
    },
    leftText() {
      const m = Math.floor(this.left / 60);
      return `${m}:${String(this.left % 60).padStart(2, '0')}`;
    },
    pct() {
      if (this.phase === 'done') return 100;
      const total = (this.phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60;
      return Math.min(100, Math.max(0, Math.round(((total - this.left) / total) * 100)));
    },
  },
  onLoad() {
    const st = loadStore();
    this.todayDone = st.done;
    this.todayMins = Math.round(st.secs / 60);
    this.total = st.total;
    this.round = st.done;
    const live = uni.getStorageSync(LIVE_KEY);
    if (live && (live.phase === 'focus' || live.phase === 'break')) {
      this.phase = live.phase;
      this.running = !!live.running;
      this.left = Number(live.left) || (live.phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60;
      this._endAt = Number(live.endAt) || 0;
      if (this.running && this._endAt) {
        this._syncLeft();
        if (this.running) this._tick();
      }
    }
  },
  onUnload() {
    this._saveLive();
    this._stopTick();
  },
  onHide() {
    this._saveLive();
    if (this.running) this._stopTick();
  },
  onShow() {
    if (this.running && this._endAt) {
      this._syncLeft();
      if (this.running && !this._timer) this._tick();
    }
  },
  methods: {
    _saveLive() {
      if (this.phase === 'focus' || this.phase === 'break') {
        uni.setStorageSync(LIVE_KEY, { phase: this.phase, running: this.running, left: this.left, endAt: this._endAt });
      } else {
        uni.removeStorageSync(LIVE_KEY);
      }
    },
    _stopTick() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    },
    _syncLeft() {
      if (!this._endAt) return;
      this.left = Math.max(0, Math.ceil((this._endAt - Date.now()) / 1000));
      if (this.left <= 0) this.finishPhase();
    },
    _tick() {
      this._stopTick();
      this._timer = setInterval(() => this._syncLeft(), 1000);
    },
    start(phase) {
      this._stopTick();
      this.phase = phase;
      this.left = (phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60;
      this._endAt = Date.now() + this.left * 1000;
      this.running = true;
      this._saveLive();
      this._tick();
    },
    pause() {
      this._syncLeft();
      this._stopTick();
      this._endAt = 0;
      this.running = false;
      this._saveLive();
    },
    resume() {
      if (!this.left) return;
      this._endAt = Date.now() + this.left * 1000;
      this.running = true;
      this._saveLive();
      this._tick();
    },
    finishPhase() {
      this._stopTick();
      this._endAt = 0;
      if (this.phase === 'focus') {
        const st = loadStore();
        st.done += 1;
        st.secs += FOCUS_MIN * 60;
        st.total += 1;
        uni.setStorageSync(KEY, st);
        this.todayDone = st.done;
        this.todayMins = Math.round(st.secs / 60);
        this.total = st.total;
        this.round = st.done;
        uni.vibrateShort && uni.vibrateShort({ type: 'medium' });
        toastOk('专注完成，开始休息 5 分钟');
        this.start('break');
      } else {
        this.phase = 'done';
        this.left = 0;
        this.running = false;
        this._saveLive();
      }
    },
    skipBreak() {
      this._stopTick();
      this._endAt = 0;
      this.phase = 'done';
      this.left = 0;
      this.running = false;
      this._saveLive();
    },
    reset() {
      this._stopTick();
      this._endAt = 0;
      this.phase = 'idle';
      this.running = false;
      this.left = FOCUS_MIN * 60;
      this.round = this.todayDone;
      this._saveLive();
      toastInfo('已结束本轮专注');
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-40); }
.dial { display: flex; flex-direction: column; align-items: center; gap: var(--sp-8); padding: var(--sp-16) 0; }
.dial-phase { font-size: var(--fs-caption); color: var(--ink-3); }
.dial.focus .dial-phase { color: var(--brand-text); }
.dial.break .dial-phase { color: var(--ok-strong); }
.dial-time { font-size: 56px; font-weight: var(--fw-semibold); color: var(--ink); line-height: 1.1; }
.dial-bar { width: 70%; height: 6px; border-radius: var(--r-full); background: var(--fill); overflow: hidden; }
.dial-fill { width: 100%; height: 100%; border-radius: var(--r-full); background: var(--brand); transform-origin: left center; transition: transform var(--dur-base) var(--ease-standard); }
.dial.break .dial-fill { background: var(--ok); }
.dial-round { font-size: var(--fs-caption); color: var(--ink-3); }
.ops { display: flex; flex-direction: column; gap: var(--sp-12); max-width: 360px; margin: 0 auto; width: 100%; }
.tip { display: block; margin-top: var(--sp-12); font-size: var(--fs-caption); color: var(--ink-3); text-align: center; }
/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap.pomo-page { max-width: 520px; margin: 0 auto; }
}
/* #endif */
</style>
