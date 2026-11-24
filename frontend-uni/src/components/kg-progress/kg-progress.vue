<template>
  <view v-if="shape === 'ring'" class="kg-ring" :style="{ width: size + 'px', height: size + 'px' }" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100" :aria-label="ariaLabel || `进度 ${pct}%`">
    <!-- #ifdef H5 -->
    <svg class="kg-ring__svg" :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle class="kg-ring__track" :cx="center" :cy="center" :r="radius" fill="none" stroke-width="6" />
      <circle
        class="kg-ring__prog"
        :cx="center"
        :cy="center"
        :r="radius"
        fill="none"
        stroke-width="6"
        :stroke="fillColor"
        :stroke-linecap="pct > 0 ? 'round' : 'butt'"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${center} ${center})`"
      />
    </svg>
    <!-- #endif -->
    <view class="kg-ring__in">
      <slot><text class="kg-ring__v num">{{ pct }}%</text></slot>
    </view>
  </view>
  <view v-else class="kg-bar" :class="{ 'kg-bar--thick': thickness === 8, 'kg-bar--inverse': inverse }" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100" :aria-label="ariaLabel || `进度 ${pct}%`">
    <view class="kg-bar__fill" :style="{ transform: `scaleX(${pct / 100})`, background: fillColor }" />
  </view>
</template>

<script>
import { moduleMeta } from '../../utils/module-meta.js';

/** KgProgress（COMPONENTS §1.13）：线性 4/8px（GPU scaleX）或环形 48/72/96（SVG stroke-dashoffset 平滑补间）；填色 brand 或模块色。 */
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
    /** 语义色 override：warn | muted | ok */
    tone: { type: String, default: '' },
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
      if (this.tone === 'warn') return 'var(--warn)';
      if (this.tone === 'muted') return 'var(--ink-4)';
      if (this.tone === 'ok') return 'var(--ok)';
      const m = this.module ? moduleMeta(this.module) : null;
      return m ? m.color : 'var(--brand)';
    },
    center() { return this.size / 2; },
    radius() { return Math.max(1, this.size / 2 - 3); },
    circumference() { return Number((2 * Math.PI * this.radius).toFixed(2)); },
    dashOffset() { return Number((this.circumference * (1 - this.pct / 100)).toFixed(2)); },
  },
};
</script>

<style scoped>
.kg-bar { width: 100%; height: 4px; border-radius: var(--r-full); background: var(--prog-track); overflow: hidden; }
.kg-bar--thick { height: 8px; }
.kg-bar--inverse { background: rgba(255, 255, 255, 0.28); }
.kg-bar__fill { width: 100%; height: 100%; border-radius: var(--r-full); transform-origin: left center; will-change: transform; transition: transform var(--dur-slow) var(--ease-decel); }
.kg-ring { position: relative; border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; }
.kg-ring__svg { position: absolute; inset: 0; display: block; pointer-events: none; }
.kg-ring__track { stroke: var(--prog-track); }
.kg-ring__prog { transition: stroke-dashoffset var(--dur-slow) var(--ease-decel); }
.kg-ring__in { position: relative; z-index: 1; width: calc(100% - 12px); height: calc(100% - 12px); border-radius: var(--r-full); display: flex; align-items: center; justify-content: center; }
.kg-ring__v { font-size: var(--fs-sub); font-weight: 600; color: var(--ink); }
</style>
