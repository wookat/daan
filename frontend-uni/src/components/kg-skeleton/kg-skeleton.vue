<template>
  <view v-if="loading" class="kg-skel" :class="[`kg-skel--${preset}`]" aria-busy="true">
    <wd-skeleton v-if="preset === 'hero'" theme="image" :row-col="[{ width: '100%', height: '120px', type: 'rect' }]" :animation="anim" />
    <template v-else-if="preset === 'cards'">
      <wd-skeleton v-for="i in 3" :key="i" theme="image" :row-col="[{ width: '100%', height: '88px', type: 'rect' }]" :animation="anim" />
    </template>
    <wd-skeleton v-else-if="preset === 'banner'" theme="image" :row-col="[{ width: '100%', height: '48px', type: 'rect' }]" :animation="anim" />
    <wd-skeleton v-else theme="paragraph" :row-col="[{ width: '40%', height: '20px' }, 1, 1, { width: '70%' }]" :animation="anim" />
  </view>
  <slot v-else />
</template>

<script>
import { prefersReducedMotion } from '../../a11y-motion.js';

/** KgSkeleton（COMPONENTS §1.9）：wd-skeleton 四套预设（banner = 单行 KgBanner 等高占位，回包后不抬下方内容）；reduced-motion 下静止。空态与骨架互斥由页面保证。 */
export const SKELETON_PRESETS = ['hero', 'cards', 'lines', 'banner'];

export default {
  name: 'KgSkeleton',
  props: {
    preset: { type: String, default: 'lines', validator: (v) => SKELETON_PRESETS.includes(v) },
    loading: { type: Boolean, default: true },
  },
  computed: {
    anim() { return prefersReducedMotion() ? undefined : 'gradient'; },
  },
};
</script>

<style scoped>
.kg-skel { display: flex; flex-direction: column; gap: var(--sp-12); }
.kg-skel :deep(.wd-skeleton__item) { background: var(--fill); border-radius: var(--r-xs); }
</style>
