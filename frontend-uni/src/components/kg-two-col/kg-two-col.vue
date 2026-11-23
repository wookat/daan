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
.kg-two { display: flex; flex-direction: column; gap: var(--card-gap); }
.kg-two--aside-first { flex-direction: column-reverse; }
.kg-two__main { min-width: 0; flex: 1; }
.kg-two__aside:empty { display: none; }
/* 栏内末卡 margin-bottom 与次栏首卡 margin-top 均不得与列间 gap 叠加（防 26/32/40px 巨缝）：
   常规卡片衔接恒为 --card-gap（10px）；次栏若以 .kg-sec 起头则补足到 --sp-24（10+14=24px）与常规段距一致 */
:deep(.kg-two__main > :last-child),
:deep(.kg-two__aside > :last-child) { margin-bottom: 0 !important; }
.kg-two:not(.kg-two--aside-first) :deep(.kg-two__aside > :first-child),
.kg-two--aside-first :deep(.kg-two__main > :first-child) { margin-top: 0 !important; }
.kg-two:not(.kg-two--aside-first) :deep(.kg-two__aside > .kg-sec:first-child),
.kg-two--aside-first :deep(.kg-two__main > .kg-sec:first-child) { margin-top: calc(var(--sp-24) - var(--card-gap)) !important; }
@media (min-width: 1024px) {
  .kg-two, .kg-two--aside-first { flex-direction: row; align-items: flex-start; gap: var(--sp-24); }
  .kg-two__aside { width: 320px; flex-shrink: 0; position: sticky; top: calc(var(--window-top, 0px) + var(--sp-16)); }
  :deep(.kg-two__aside > :first-child),
  :deep(.kg-two__main > :first-child) { margin-top: 0 !important; }
}
@media (min-width: 1280px) {
  .kg-two__aside { width: 344px; }
}
</style>
