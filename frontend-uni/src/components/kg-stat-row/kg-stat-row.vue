<template>
  <view class="kg-stats" :class="{ 'is-inverse': inverse }">
    <view v-for="(it, i) in items" :key="it.label" class="kg-stat" :class="{ 'has-line': i > 0 }">
      <view class="kg-stat__v-row">
        <text class="kg-stat__v num" :class="it.tone ? `is-${it.tone}` : ''">{{ it.value }}</text>
        <text v-if="it.unit" class="kg-stat__u">{{ it.unit }}</text>
        <text v-if="it.trend" class="kg-stat__tr num" :class="it.trend > 0 ? 'is-up' : 'is-down'">{{ it.trend > 0 ? '↑' : '↓' }}{{ Math.abs(it.trend) }}</text>
      </view>
      <text class="kg-stat__l">{{ it.label }}</text>
    </view>
  </view>
</template>

<script>
/** KgStatRow（COMPONENTS §2.4）：一行 2–4 个 KPI。items: {label, value, unit?, trend?, tone?: 'ok'|'bad'|'brand'}[]；0 数据由页面换 KgEmptyState compact。 */
export default {
  name: 'KgStatRow',
  props: {
    items: {
      type: Array,
      required: true,
      validator: (arr) => arr.length >= 2 && arr.length <= 4 && arr.every((x) => x && typeof x.label === 'string'),
    },
    inverse: Boolean,
  },
};
</script>

<style scoped>
.kg-stats { display: flex; align-items: stretch; }
.kg-stat { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); padding: 0 var(--sp-8); }
.kg-stat.has-line { border-left: 1px solid var(--line); }
.kg-stat__v-row { display: flex; align-items: baseline; gap: 2px; }
.kg-stat__v { font-size: var(--fs-h1); font-weight: 600; color: var(--ink); line-height: var(--lh-h1); }
.kg-stat__v.is-ok { color: var(--ok-strong); }
.kg-stat__v.is-bad { color: var(--bad-strong); }
.kg-stat__v.is-brand { color: var(--brand-text); }
.kg-stat__u, .kg-stat__l { font-size: var(--fs-sub); color: var(--ink-3); }
.kg-stat__tr { font-size: var(--fs-caption); margin-left: var(--sp-4); }
.kg-stat__tr.is-up { color: var(--ok-strong); }
.kg-stat__tr.is-down { color: var(--bad-strong); }
.kg-stats.is-inverse .kg-stat__v { color: var(--on-brand); }
.kg-stats.is-inverse .kg-stat__u, .kg-stats.is-inverse .kg-stat__l { color: var(--on-brand-2); }
.kg-stats.is-inverse .kg-stat.has-line { border-left-color: rgba(255, 255, 255, 0.24); }
</style>
