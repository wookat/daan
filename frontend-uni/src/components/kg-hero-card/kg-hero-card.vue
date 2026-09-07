<template>
  <view class="kg-hero" :class="[`kg-hero--${variant}`]">
    <view class="kg-hero__top">
      <text class="kg-hero__label">{{ label }}</text>
      <kg-streak-badges v-if="streak != null" :days="streak" :inverse="variant === 'brand'" />
    </view>
    <view class="kg-hero__num-row">
      <text class="kg-hero__num num">{{ value }}</text>
      <text v-if="total != null" class="kg-hero__total num">/{{ total }}{{ unit }}</text>
      <text v-else-if="unit" class="kg-hero__total">{{ unit }}</text>
    </view>
    <kg-progress v-if="progress != null" :value="progress" :inverse="variant === 'brand'" class="kg-hero__bar" />
    <slot />
    <view v-if="primary || secondary" class="kg-hero__acts">
      <kg-button v-if="primary" variant="primary" size="lg" :tone="variant === 'brand' ? 'inverse' : 'brand'" :block="!secondary" @click="go(primary, 'primary')">{{ primary.text }}</kg-button>
      <kg-button v-if="secondary" variant="ghost" size="lg" :tone="variant === 'brand' ? 'inverse' : 'brand'" @click="go(secondary, 'secondary')">{{ secondary.text }}</kg-button>
    </view>
  </view>
</template>

<script>
/** KgHeroCard（COMPONENTS §2.5）：brand 变体是全站唯一允许 --brand-grad 的地方；最多 2 个按钮。 */
const isAction = (a) => a == null || (typeof a === 'object' && typeof a.text === 'string');

export default {
  name: 'KgHeroCard',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    total: { type: [String, Number], default: null },
    unit: { type: String, default: '' },
    /** 0–100 */
    progress: { type: Number, default: null },
    /** {text, to?} */
    primary: { type: Object, default: null, validator: isAction },
    secondary: { type: Object, default: null, validator: isAction },
    streak: { type: Number, default: null },
    variant: { type: String, default: 'brand', validator: (v) => v === 'brand' || v === 'plain' },
  },
  emits: ['primary', 'secondary'],
  methods: {
    go(a, evt) {
      this.$emit(evt);
      if (a.to) uni.navigateTo({ url: a.to, fail: () => uni.switchTab({ url: a.to }) });
    },
  },
};
</script>

<style scoped>
.kg-hero { border-radius: var(--r-lg); padding: var(--sp-20); display: flex; flex-direction: column; gap: var(--sp-12); }
.kg-hero--brand { background: var(--brand-grad); color: var(--on-brand); box-shadow: var(--sh-2); }
.kg-hero--plain { background: var(--card); color: var(--ink); border: 1px solid var(--line); }
.kg-hero__top { display: flex; align-items: center; justify-content: space-between; }
.kg-hero__label { font-size: var(--fs-sub); opacity: 0.85; }
.kg-hero__num-row { display: flex; align-items: baseline; gap: var(--sp-4); }
.kg-hero__num { font-size: var(--fs-display); font-weight: 600; line-height: var(--lh-h1); }
.kg-hero__total { font-size: var(--fs-body); opacity: 0.85; }
.kg-hero--brand .kg-hero__label, .kg-hero--brand .kg-hero__total { color: var(--on-brand-2); opacity: 1; }
.kg-hero--plain .kg-hero__label, .kg-hero--plain .kg-hero__total { color: var(--ink-3); opacity: 1; }
.kg-hero__acts { display: flex; gap: var(--sp-12); margin-top: var(--sp-4); }
.kg-hero__acts :deep(.kg-btn) { flex: 1; }
</style>
