<template>
  <text class="kg-num num">{{ prefix }}{{ shown }}{{ suffix }}</text>
</template>

<script>
import { motionDuration } from '../../a11y/a11y-motion.js';

/** KgNumber：可打断的数值补间显示（360ms easeOutCubic，tabular-nums 防横向抖动，reduced-motion 下 0ms 直出；严禁用于 1s 倒计时）。 */
export default {
  name: 'KgNumber',
  props: {
    value: { type: [Number, String], default: 0 },
    decimals: { type: Number, default: 0 },
    prefix: { type: String, default: '' },
    suffix: { type: String, default: '' },
    duration: { type: Number, default: 360 },
  },
  data() {
    const n = Number(this.value);
    return { cur: Number.isFinite(n) ? n : 0 };
  },
  computed: {
    shown() {
      const n = Number(this.value);
      if (!Number.isFinite(n)) return String(this.value == null ? '' : this.value);
      return this.decimals > 0 ? this.cur.toFixed(this.decimals) : String(Math.round(this.cur));
    },
  },
  watch: {
    value(nextVal) {
      const target = Number(nextVal);
      if (!Number.isFinite(target)) return;
      this.animateTo(target);
    },
  },
  beforeUnmount() {
    this.cancelRaf();
  },
  methods: {
    cancelRaf() {
      if (this._rafId != null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    },
    animateTo(target) {
      this.cancelRaf();
      const dur = motionDuration(this.duration);
      const from = Number.isFinite(this.cur) ? this.cur : 0;
      if (dur <= 0 || from === target || typeof requestAnimationFrame !== 'function') {
        this.cur = target;
        return;
      }
      const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const step = (now) => {
        const t = Math.min(1, Math.max(0, (now - start) / dur));
        const eased = 1 - Math.pow(1 - t, 3);
        this.cur = from + (target - from) * eased;
        if (t < 1) {
          this._rafId = requestAnimationFrame(step);
        } else {
          this.cur = target;
          this._rafId = null;
        }
      };
      this._rafId = requestAnimationFrame(step);
    },
  },
};
</script>

<style scoped>
.kg-num {
  font-variant-numeric: tabular-nums;
}
</style>
