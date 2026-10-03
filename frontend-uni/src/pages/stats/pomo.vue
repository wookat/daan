<template>
  <view class="wrap">
    <kg-two-col>
      <template #main>
        <kg-card class="sec">
          <view class="dial" :class="phase">
            <text class="dial-phase">{{ phaseText }}</text>
            <text class="dial-time num">{{ leftText }}</text>
            <view class="dial-bar"><view class="dial-fill" :style="{ width: pct + '%' }" /></view>
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
          <view class="stat-row">
            <view class="stat"><text class="stat-n num">{{ todayDone }}</text><text class="stat-k">今日番茄</text></view>
            <view class="stat"><text class="stat-n num">{{ todayMins }}</text><text class="stat-k">今日分钟</text></view>
            <view class="stat"><text class="stat-n num">{{ total }}</text><text class="stat-k">累计番茄</text></view>
          </view>
          <text class="tip">每 25 分钟专注 + 5 分钟休息为一轮，切后台计时继续。</text>
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
// 番茄专注：纯前端计时器（25/5 循环），完成数与时长存本地 kgPomo
const KEY = 'kgPomo';
const FOCUS_MIN = 25;
const BREAK_MIN = 5;

function dayKey() {
  const d = new Date(Date.now() + (new Date().getTimezoneOffset() + 8 * 60) * 60000);
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
      _timer: null,
      _leftAt: 0,
    };
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
      const total = (this.phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60;
      return Math.round(((total - this.left) / total) * 100);
    },
  },
  onLoad() {
    const st = loadStore();
    this.todayDone = st.done;
    this.todayMins = Math.round(st.secs / 60);
    this.total = st.total;
  },
  onUnload() {
    this._stopTick();
  },
  onHide() {
    this._leftAt = Date.now();
  },
  onShow() {
    if (this._leftAt && this.running) {
      const gone = Math.floor((Date.now() - this._leftAt) / 1000);
      this.left = Math.max(0, this.left - gone);
      if (this.left <= 0) this.finishPhase();
    }
    this._leftAt = 0;
  },
  methods: {
    _stopTick() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    },
    _tick() {
      this._timer = setInterval(() => {
        this.left -= 1;
        if (this.left <= 0) this.finishPhase();
      }, 1000);
    },
    start(phase) {
      this._stopTick();
      this.phase = phase;
      this.left = (phase === 'break' ? BREAK_MIN : FOCUS_MIN) * 60;
      this.running = true;
      this._tick();
    },
    pause() {
      this._stopTick();
      this.running = false;
    },
    resume() {
      if (!this.left) return;
      this.running = true;
      this._tick();
    },
    finishPhase() {
      this._stopTick();
      if (this.phase === 'focus') {
        const st = loadStore();
        st.done += 1;
        st.secs += FOCUS_MIN * 60;
        st.total += 1;
        uni.setStorageSync(KEY, st);
        this.todayDone = st.done;
        this.todayMins = Math.round(st.secs / 60);
        this.total = st.total;
        this.round += 1;
        uni.vibrateShort && uni.vibrateShort({ type: 'medium' });
        this.start('break');
      } else {
        this.phase = 'done';
        this.running = false;
      }
    },
    skipBreak() {
      this._stopTick();
      this.phase = 'done';
      this.running = false;
    },
    reset() {
      this._stopTick();
      this.phase = 'idle';
      this.running = false;
      this.left = FOCUS_MIN * 60;
      this.round = 0;
    },
  },
};
</script>

<style scoped>
.sec { margin-bottom: var(--card-gap); }
.dial { display: flex; flex-direction: column; align-items: center; gap: var(--sp-8); padding: var(--sp-16) 0; }
.dial-phase { font-size: var(--fs-caption); color: var(--ink-3); }
.dial.focus .dial-phase { color: var(--brand-text); }
.dial.break .dial-phase { color: var(--success); }
.dial-time { font-size: 56px; font-weight: var(--fw-semibold); color: var(--ink); line-height: 1.1; }
.dial-bar { width: 70%; height: 6px; border-radius: var(--r-full); background: var(--fill); overflow: hidden; }
.dial-fill { height: 100%; border-radius: var(--r-full); background: var(--brand); transition: width 0.4s linear; }
.dial.break .dial-fill { background: var(--success); }
.dial-round { font-size: var(--fs-caption); color: var(--ink-3); }
.ops { display: flex; flex-direction: column; gap: var(--sp-4); }
.stat-row { display: flex; align-items: center; justify-content: space-around; }
.stat { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.stat-n { font-size: var(--fs-h1); font-weight: var(--fw-semibold); color: var(--ink); }
.stat-k { font-size: var(--fs-caption); color: var(--ink-3); }
.tip { display: block; margin-top: var(--sp-8); font-size: var(--fs-caption); color: var(--ink-3); }
</style>
