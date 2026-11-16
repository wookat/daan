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
/* 栏内末卡 margin-bottom（.sec 10px）会压进 flex item 边界与列间 gap 叠加成 26px 缝——
   列间距由 kg-two 的 gap 独管，栏内末子块的下外边距一律清零（全页面通用：stats/home/book/profile/practice 等） */
:deep(.kg-two__main > :last-child),
:deep(.kg-two__aside > :last-child) { margin-bottom: 0 !important; }
@media (min-width: 1024px) {
  .kg-two, .kg-two--aside-first { flex-direction: row; align-items: flex-start; gap: var(--sp-24); }
  .kg-two__aside { width: 320px; flex-shrink: 0; position: sticky; top: var(--sp-16); }
}
</style>
