<template>
  <view v-if="loading" class="kg-skel" :class="[`kg-skel--${preset}`]" aria-busy="true">
    <wd-skeleton v-if="preset === 'hero'" theme="image" :row-col="[{ width: '100%', height: '120px', type: 'rect' }]" :animation="anim" />
    <template v-else-if="preset === 'cards'">
      <wd-skeleton v-for="i in 3" :key="i" theme="image" :row-col="[{ width: '100%', height: '88px', type: 'rect' }]" :animation="anim" />
    </template>
    <wd-skeleton v-else-if="preset === 'banner'" theme="image" :row-col="[{ width: '100%', height: '48px', type: 'rect' }]" :animation="anim" />
    <template v-else-if="preset === 'plan'">
      <wd-skeleton theme="image" :row-col="[{ width: '100%', height: rows ? '80px' : '68px', type: 'rect' }]" :animation="anim" />
      <wd-skeleton theme="image" :row-col="[{ width: '100%', height: rows ? '19px' : '38px', type: 'rect' }]" :animation="anim" />
      <wd-skeleton v-if="rows" theme="image" :row-col="[{ width: '100%', height: '14px', type: 'rect' }]" :animation="anim" />
      <wd-skeleton v-for="i in rows" :key="i" theme="image" :row-col="[{ width: '100%', height: '62px', type: 'rect' }]" :animation="anim" />
      <wd-skeleton theme="image" :row-col="[{ width: '100%', height: rows ? '30px' : '44px', type: 'rect' }]" :animation="anim" />
    </template>
    <wd-skeleton v-else theme="paragraph" :row-col="[{ width: '40%', height: '20px' }, 1, 1, { width: '70%' }]" :animation="anim" />
  </view>
  <view v-else class="kg-skel-body">
    <slot />
  </view>
</template>

<script>
import { prefersReducedMotion, watchReducedMotion } from '../../a11y/a11y-motion.js';

/** KgSkeleton（COMPONENTS §1.9）：wd-skeleton 五套预设，回包后真内容纯透明度柔入（零位移不触发 CLS），reduced-motion 下静止。 */
export const SKELETON_PRESETS = ['hero', 'cards', 'lines', 'banner', 'plan'];

export default {
  name: 'KgSkeleton',
  props: {
    preset: { type: String, default: 'lines', validator: (v) => SKELETON_PRESETS.includes(v) },
    loading: { type: Boolean, default: true },
    rows: { type: Number, default: 0 },
  },
  data() {
    return { reduced: prefersReducedMotion() };
  },
  computed: {
    anim() { return this.reduced ? undefined : 'gradient'; },
  },
  mounted() {
    this._unwatchMotion = watchReducedMotion((v) => { this.reduced = v; });
  },
  beforeUnmount() {
    if (this._unwatchMotion) { this._unwatchMotion(); this._unwatchMotion = null; }
  },
};
</script>

<style scoped>
.kg-skel { display: flex; flex-direction: column; gap: var(--sp-12); }
.kg-skel :deep(.wd-skeleton__item) { background: var(--fill); border-radius: var(--r-xs); }
.kg-skel-body { animation: kg-fade-in var(--dur-fast) var(--ease-decel); }
</style>
