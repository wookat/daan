<template>
  <view class="kg-two" :class="{ 'kg-two--aside-first': asideFirst }">
    <view class="kg-two__main"><slot name="main" /></view>
    <view v-if="$slots.aside" class="kg-two__aside"><slot name="aside" /></view>
  </view>
</template>

<script>
/** KgTwoCol（PAGES §2）：≥1024 双栏 main/aside（aside 320 sticky），窄屏单列顺序 main→aside（asideFirst 反过来）。 */
export default {
  name: 'KgTwoCol',
  props: {
    asideFirst: Boolean,
  },
};
</script>

<style scoped>
.kg-two { display: flex; flex-direction: column; gap: var(--sp-16); }
.kg-two--aside-first { flex-direction: column-reverse; }
.kg-two__main { min-width: 0; flex: 1; }
@media (min-width: 1024px) {
  .kg-two, .kg-two--aside-first { flex-direction: row; align-items: flex-start; gap: var(--sp-24); }
  .kg-two__aside { width: 320px; flex-shrink: 0; position: sticky; top: var(--sp-16); }
}
</style>
