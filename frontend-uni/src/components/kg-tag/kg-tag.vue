<template>
  <view class="kg-tag" :class="[`kg-tag--${tone}`]" :style="modStyle">
    <l-icon v-if="icon" :name="icon" :size="16" tone="inherit" />
    <text class="kg-tag__t"><slot /></text>
  </view>
</template>

<script>
import { moduleMeta } from '../../module-meta.js';

/** KgTag（COMPONENTS §1.3）：只读状态/模块标，高 20，颜色全由 token。tone=module 时传 module=key。 */
export const TAG_TONES = ['brand', 'ok', 'bad', 'warn', 'info', 'neutral', 'module'];

export default {
  name: 'KgTag',
  props: {
    tone: { type: String, default: 'neutral', validator: (v) => TAG_TONES.includes(v) },
    module: { type: String, default: '' },
    icon: { type: String, default: '' },
  },
  computed: {
    modStyle() {
      if (this.tone !== 'module') return null;
      const m = moduleMeta(this.module);
      return m ? { background: m.soft, color: m.color } : null;
    },
  },
};
</script>

<style scoped>
.kg-tag {
  display: inline-flex; align-items: center; gap: var(--sp-4);
  height: var(--tag-h); padding: 0 var(--sp-8); border-radius: var(--r-xs);
  font-size: var(--fs-caption); font-weight: 500; line-height: 1; white-space: nowrap;
  background: var(--fill); color: var(--ink-3);
  max-width: 100%;
}
.kg-tag__t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kg-tag--brand { background: var(--brand-soft); color: var(--brand-text); }
.kg-tag--ok { background: var(--ok-soft); color: var(--ok-strong); }
.kg-tag--bad { background: var(--bad-soft); color: var(--bad-strong); }
.kg-tag--warn { background: var(--warn-soft); color: var(--warn-strong); }
.kg-tag--info { background: var(--info-soft); color: var(--info-strong); }
</style>
