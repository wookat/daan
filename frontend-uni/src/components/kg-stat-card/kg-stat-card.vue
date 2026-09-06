<template>
  <kg-card variant="flat" class="kg-scard">
    <kg-progress v-if="ring != null" shape="ring" :value="ring" :size="48" :aria-label="label" />
    <view class="kg-scard__body">
      <view class="kg-scard__v-row">
        <text class="kg-scard__v num">{{ value }}</text>
        <text v-if="unit" class="kg-scard__u">{{ unit }}</text>
      </view>
      <text class="kg-scard__l">{{ label }}</text>
    </view>
  </kg-card>
</template>

<script>
/** KgStatCard（COMPONENTS §2.4）：单 KPI 卡，可带 48 环。2 列网格由页面排。 */
export default {
  name: 'KgStatCard',
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], required: true },
    unit: { type: String, default: '' },
    /** 0–100 */
    ring: { type: Number, default: null },
  },
};
</script>

<style scoped>
.kg-scard { display: flex; align-items: center; gap: var(--sp-12); }
.kg-scard__body { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 0; }
.kg-scard__v-row { display: flex; align-items: baseline; gap: 2px; }
.kg-scard__v { font-size: var(--fs-h1); font-weight: 600; color: var(--ink); line-height: var(--lh-h1); }
.kg-scard__u, .kg-scard__l { font-size: var(--fs-sub); color: var(--ink-3); }
</style>
