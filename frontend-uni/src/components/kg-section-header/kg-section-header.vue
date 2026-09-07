<template>
  <view class="kg-sec">
    <text class="kg-sec__t">{{ title }}</text>
    <view v-if="more || $slots.right" class="kg-sec__r">
      <slot name="right">
        <view class="kg-sec__more" role="button" hover-class="kg-sec__more--hover" @click="onMore">
          <text>{{ more }}</text>
          <l-icon name="chevron-right" :size="16" tone="muted" />
        </view>
      </slot>
    </view>
  </view>
</template>

<script>
/** KgSectionHeader（COMPONENTS §1.12）：区块标题 + 「查看全部 ›」，44 高命中区。 */
export default {
  name: 'KgSectionHeader',
  props: {
    title: { type: String, required: true },
    more: { type: String, default: '' },
    to: { type: String, default: '' },
  },
  emits: ['more'],
  methods: {
    onMore() {
      this.$emit('more');
      if (this.to) uni.navigateTo({ url: this.to, fail: () => uni.switchTab({ url: this.to }) });
    },
  },
};
</script>

<style scoped>
.kg-sec { display: flex; align-items: center; justify-content: space-between; margin: var(--sp-24) 0 var(--sp-12); min-height: var(--sp-24); }
.kg-sec__t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); line-height: var(--lh-h1); }
.kg-sec__more { display: inline-flex; align-items: center; gap: var(--sp-4); min-height: var(--hit-min); padding: 0 var(--sp-4); font-size: var(--fs-sub); color: var(--ink-3); }
.kg-sec__more--hover { color: var(--ink-2); }
</style>
