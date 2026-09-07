<template>
  <view v-if="visible" class="kg-banner" :class="[`kg-banner--${tone}`]" role="status">
    <l-icon :name="icon || defaultIcon" :size="20" :tone="tone" />
    <text class="kg-banner__t">{{ text }}</text>
    <kg-button v-if="actionText" variant="text" size="sm" @click="$emit('action')">{{ actionText }}</kg-button>
    <view v-if="closable" class="kg-banner__x" role="button" aria-label="关闭" @click="close">
      <l-icon name="x" :size="16" tone="muted" />
    </view>
  </view>
</template>

<script>
/** KgBanner（COMPONENTS §2.7）：顶部横幅（网络/同步/公告）。可自动重试的失败用横幅而不是 toast。 */
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
  data() { return { visible: true }; },
  computed: { defaultIcon() { return ICONS[this.tone]; } },
  methods: {
    close() { this.visible = false; this.$emit('close'); },
  },
};
</script>

<style scoped>
.kg-banner { display: flex; align-items: center; gap: var(--sp-8); padding: var(--sp-8) var(--sp-12); border-radius: var(--r-sm); font-size: var(--fs-sub); line-height: var(--lh-sub); }
.kg-banner--info { background: var(--info-soft); color: var(--info-strong); }
.kg-banner--warn { background: var(--warn-soft); color: var(--warn-strong); }
.kg-banner--ok { background: var(--ok-soft); color: var(--ok-strong); }
.kg-banner--bad { background: var(--bad-soft); color: var(--bad-strong); }
.kg-banner__t { flex: 1; min-width: 0; }
.kg-banner__x { display: flex; align-items: center; justify-content: center; width: var(--hit-min); height: var(--hit-min); margin: calc(-1 * var(--sp-8)) calc(-1 * var(--sp-8)) calc(-1 * var(--sp-8)) 0; flex-shrink: 0; } /* 命中 44，吃掉 banner 自身 padding，不改外观 */
</style>
