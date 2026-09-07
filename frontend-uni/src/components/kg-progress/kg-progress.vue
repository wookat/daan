<template>
  <view v-if="shape === 'ring'" class="kg-ring" :style="ringStyle" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100" :aria-label="ariaLabel || `进度 ${pct}%`">
    <view class="kg-ring__in">
      <slot><text class="kg-ring__v num">{{ pct }}%</text></slot>
    </view>
  </view>
  <view v-else class="kg-bar" :class="{ 'kg-bar--thick': thickness === 8, 'kg-bar--inverse': inverse }" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100" :aria-label="ariaLabel || `进度 ${pct}%`">
    <view class="kg-bar__fill" :style="{ width: pct + '%', background: fillColor }" />
  </view>
</template>

<script>
import { moduleMeta } from '../../module-meta.js';

/** KgProgress（COMPONENTS §1.13）：线性 4/8px（槽 --brand-soft-2）或环形 48/72/96（conic-gradient）；填色 brand 或模块色。 */
export const PROGRESS_RING_SIZES = [48, 72, 96];

export default {
  name: 'KgProgress',
  props: {
    value: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    shape: { type: String, default: 'bar', validator: (v) => v === 'bar' || v === 'ring' },
    thickness: { type: Number, default: 4, validator: (v) => v === 4 || v === 8 },
    size: { type: Number, default: 48, validator: (v) => PROGRESS_RING_SIZES.includes(v) },
    /** 模块 key → 用 --mod-<key> 填色 */
    module: { type: String, default: '' },
    /** hero 深底上：白槽 + 白填 */
    inverse: Boolean,
    ariaLabel: { type: String, default: '' },
  },
  computed: {
    pct() {
      if (!this.max) return 0;
      return Math.max(0, Math.min(100, Math.round((this.value / this.max) * 100)));
    },
    fillColor() {
      if (this.inverse) return 'var(--on-brand)';
      const m = this.module ? moduleMeta(this.module) : null;
      return m ? m.color : 'var(--brand)';
    },
    ringStyle() {
      return {
        width: this.size + 'px',
        height: this.size + 'px',
        background: `conic-gradient(${this.fillColor} ${this.pct}%, var(--prog-track) 0)`,
      };
    },
  },
};
</script>

<style scoped>
.kg-bar { width: 100%; height: 4px; border-radius: var(--r-full); background: var(--prog-track); overflow: hidden; }
.kg-bar--thick { height: 8px; }
.kg-bar--inverse { background: rgba(255, 255, 255, 0.28); }
.kg-bar__fill { height: 100%; border-radius: var(--r-full); transition: width var(--dur-slow) var(--ease-decel); }
.kg-ring { border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; }
.kg-ring__in { width: calc(100% - 12px); height: calc(100% - 12px); border-radius: var(--r-full); background: var(--card); display: flex; align-items: center; justify-content: center; }
.kg-ring__v { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
</style>
