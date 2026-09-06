<template>
  <view class="kg-empty" :class="{ 'is-compact': compact }" role="status">
    <view class="kg-empty__ico"><l-icon :name="icon" :size="compact ? 24 : 32" tone="muted" /></view>
    <view class="kg-empty__body">
      <text class="kg-empty__t">{{ title }}</text>
      <text v-if="desc" class="kg-empty__d">{{ desc }}</text>
      <view v-if="ctaText || secondaryText" class="kg-empty__acts">
        <kg-button v-if="ctaText" variant="primary" :size="compact ? 'sm' : 'lg'" @click="go">{{ ctaText }}</kg-button>
        <kg-button v-if="secondaryText" variant="text" :size="compact ? 'sm' : 'md'" @click="$emit('secondary')">{{ secondaryText }}</kg-button>
      </view>
    </view>
  </view>
</template>

<script>
/** KgEmptyState（COMPONENTS §1.8）：自研，不用 wd-status-tip 远程插图。CTA 规格只有 lg（默认）与 sm（compact）。 */
export default {
  name: 'KgEmptyState',
  props: {
    icon: { type: String, default: 'inbox' },
    title: { type: String, required: true },
    desc: { type: String, default: '' },
    ctaText: { type: String, default: '' },
    /** 页面路径；不传则只 emit cta */
    ctaTo: { type: String, default: '' },
    secondaryText: { type: String, default: '' },
    compact: Boolean,
  },
  emits: ['cta', 'secondary'],
  methods: {
    go() {
      this.$emit('cta');
      if (this.ctaTo) uni.navigateTo({ url: this.ctaTo, fail: () => uni.switchTab({ url: this.ctaTo }) });
    },
  },
};
</script>

<style scoped>
.kg-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--sp-32) var(--sp-16); max-width: 280px; margin: 0 auto; gap: var(--sp-12); }
.kg-empty__ico { width: 64px; height: 64px; border-radius: var(--r-full); background: var(--fill); display: flex; align-items: center; justify-content: center; }
.kg-empty__body { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.kg-empty__t { font-size: var(--fs-body); font-weight: 500; color: var(--ink); }
.kg-empty__d { font-size: var(--fs-sub); color: var(--ink-3); line-height: var(--lh-sub); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kg-empty__acts { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); margin-top: var(--sp-12); }
.kg-empty.is-compact { flex-direction: row; text-align: left; padding: var(--sp-16); max-width: none; }
.kg-empty.is-compact .kg-empty__ico { width: 40px; height: 40px; flex-shrink: 0; }
.kg-empty.is-compact .kg-empty__body { align-items: flex-start; }
.kg-empty.is-compact .kg-empty__acts { flex-direction: row; margin-top: var(--sp-8); }
</style>
