<template>
  <view class="kg-streak" :class="{ 'is-inverse': inverse, 'is-zero': !days }" :aria-label="`连续打卡 ${days} 天`">
    <l-icon name="flame" :size="16" :tone="inverse ? 'on-brand' : 'streak'" />
    <text class="kg-streak__n num">{{ days }}</text>
    <text class="kg-streak__u">天</text>
  </view>
</template>

<script>
/** KgStreakBadges（COMPONENTS §2.7）：连签火焰 + 天数，颜色只用组件私有 token --streak/--streak-soft。 */
export default {
  name: 'KgStreakBadges',
  props: {
    days: { type: Number, default: 0 },
    inverse: Boolean,
  },
};
</script>

<style scoped>
.kg-streak { display: inline-flex; align-items: center; gap: var(--sp-4); height: 24px; padding: 0 var(--sp-8); border-radius: var(--r-full); background: var(--streak-soft); color: var(--streak); font-size: var(--fs-sub); font-weight: 600; }
.kg-streak__u { font-weight: 400; font-size: var(--fs-caption); }
.kg-streak.is-zero { opacity: 0.6; }
.kg-streak.is-inverse { background: rgba(255, 255, 255, 0.18); color: var(--on-brand); }
</style>
