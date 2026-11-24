<template>
  <view class="kg-col" :class="{ 'is-open': open }">
    <view class="kg-col__in" :aria-hidden="open ? 'false' : 'true'">
      <slot />
    </view>
  </view>
</template>

<script>
/** KgCollapse：GPU/Grid 驱动的零重排高度展开折叠容器（0fr <-> 1fr），严禁动画 height 或 max-height: 9999px。 */
export default {
  name: 'KgCollapse',
  props: {
    open: { type: Boolean, default: false },
  },
};
</script>

<style scoped>
.kg-col {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--dur-base) var(--ease-decel);
}
.kg-col.is-open {
  grid-template-rows: 1fr;
}
.kg-col__in {
  min-height: 0;
  overflow: hidden;
  contain: layout style;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-decel);
}
.kg-col.is-open > .kg-col__in {
  opacity: 1;
}
</style>
