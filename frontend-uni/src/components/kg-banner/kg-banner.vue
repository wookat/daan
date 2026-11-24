<template>
  <view v-if="visible" class="kg-banner-wrap" :class="{ 'is-closing': closing }">
    <view class="kg-banner-clip">
      <view class="kg-banner" :class="[`kg-banner--${tone}`]" role="status">
        <l-icon :name="icon || defaultIcon" :size="20" :tone="tone" />
        <text class="kg-banner__t">{{ text }}</text>
        <kg-button v-if="actionText" variant="text" size="sm" @click="$emit('action')">{{ actionText }}</kg-button>
        <view v-if="closable" class="kg-banner__x" role="button" aria-label="关闭" @click="close">
          <l-icon name="x" :size="16" tone="muted" />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { motionDuration } from '../../a11y/a11y-motion.js';

/** KgBanner（COMPONENTS §2.7）：顶部横幅（网络/同步/公告）。关闭时平滑折叠收拢避免内容突变上跳。 */
export const BANNER_TONES = ['info', 'warn', 'ok', 'bad'];
const ICONS = { info: 'info', warn: 'triangle-alert', ok: 'circle-check', bad: 'circle-x' };

export default {
  name: 'KgBanner',
  props: {
    text: { type: String, required: true },
    tone: { type: String, default: 'info', validator: (v) => BANNER_TONES.includes(v) },
    icon: { type: String, default: '' },
    actionText: { type: String, default: '' },
    closable: { type: Boolean, default: true },
  },
  emits: ['action', 'close'],
  data() { return { visible: true, closing: false }; },
  computed: { defaultIcon() { return ICONS[this.tone]; } },
  beforeUnmount() {
    if (this._closeT) { clearTimeout(this._closeT); this._closeT = null; }
  },
  methods: {
    close() {
      if (this.closing) return;
      const ms = motionDuration(180);
      if (ms <= 0) {
        this.visible = false;
        this.$emit('close');
        return;
      }
      this.closing = true;
      this._closeT = setTimeout(() => {
        this.visible = false;
        this.closing = false;
        this.$emit('close');
      }, ms);
    },
  },
};
</script>

<style scoped>
.kg-banner-wrap {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--dur-base) var(--ease-accel), opacity var(--dur-fast) var(--ease-accel), transform var(--dur-fast) var(--ease-accel);
}
.kg-banner-wrap.is-closing {
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translate3d(0, -4px, 0);
}
.kg-banner-clip { min-height: 0; overflow: hidden; }
.kg-banner { display: flex; align-items: center; gap: var(--sp-8); padding: var(--sp-8) var(--sp-12); border-radius: var(--r-sm); border: 1px solid transparent; font-size: var(--fs-sub); line-height: var(--lh-sub); }
.kg-banner--info { background: var(--info-soft); color: var(--info-strong); border-color: var(--info-line); }
.kg-banner--warn { background: var(--warn-soft); color: var(--warn-strong); border-color: var(--warn-line); }
.kg-banner--ok { background: var(--ok-soft); color: var(--ok-strong); border-color: var(--ok-line); }
.kg-banner--bad { background: var(--bad-soft); color: var(--bad-strong); border-color: var(--bad-line); }
.kg-banner__t { flex: 1; min-width: 0; }
.kg-banner__x { display: flex; align-items: center; justify-content: center; width: var(--hit-min); height: var(--hit-min); margin: calc(-1 * var(--sp-8)) calc(-1 * var(--sp-8)) calc(-1 * var(--sp-8)) 0; flex-shrink: 0; border-radius: var(--r-full); transition: transform var(--dur-instant) var(--ease-standard), background-color var(--dur-fast) var(--ease-standard); }
.kg-banner__x:active { transform: scale(0.9); }
/* #ifdef H5 */
.kg-banner__x { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .kg-banner__x:hover { background: var(--fill); }
}
/* #endif */
</style>
