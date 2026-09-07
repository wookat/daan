<template>
  <scroll-view class="kg-chips" :class="[`kg-chips--${size}`]" scroll-x :scroll-into-view="scrollToSelected ? `kgchip-${String(modelValue)}` : ''" scroll-with-animation :show-scrollbar="false">
    <view class="kg-chips__row">
      <view
        v-for="o in options"
        :key="o.value"
        :id="`kgchip-${String(o.value)}`"
        class="kg-chip"
        :class="{ 'is-on': o.value === modelValue }"
        hover-class="kg-chip--hover"
        :hover-stay-time="80"
        role="radio"
        :aria-checked="o.value === modelValue ? 'true' : 'false'"
        @click="$emit('update:modelValue', o.value)"
      >
        <l-icon v-if="o.icon" :name="o.icon" :size="16" tone="inherit" />
        <text>{{ o.label }}</text>
        <text v-if="o.count != null" class="kg-chip__n num">{{ o.count }}</text>
      </view>
    </view>
  </scroll-view>
</template>

<script>
/** KgChipRow（COMPONENTS §1.3）：横滚单选筛选行，右侧 24px 渐隐。>4 项或带计数用它，≤4 项互斥切视图用 wd-segmented。 */
export default {
  name: 'KgChipRow',
  props: {
    options: {
      type: Array,
      default: () => [],
      validator: (arr) => arr.every((o) => o && o.value !== undefined && typeof o.label === 'string'),
    },
    modelValue: { type: [String, Number], default: '' },
    size: { type: String, default: 'md', validator: (v) => v === 'md' || v === 'sm' },
    scrollToSelected: { type: Boolean, default: true },
  },
  emits: ['update:modelValue'],
};
</script>

<style scoped>
.kg-chips { width: 100%; white-space: nowrap; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent); }
.kg-chips__row { display: inline-flex; gap: var(--sp-8); padding-right: var(--sp-24); }
.kg-chip {
  display: inline-flex; align-items: center; gap: var(--sp-4); flex-shrink: 0; white-space: nowrap;
  height: var(--chip-h); padding: 0 14px; border-radius: var(--r-full);
  background: var(--card); border: 1px solid var(--line); color: var(--ink-2);
  font-size: var(--fs-sub); font-weight: 500; line-height: 1;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.kg-chips--sm .kg-chip { height: 28px; padding: 0 var(--sp-12); }
.kg-chip--hover { background: var(--fill); }
.kg-chip.is-on { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
.kg-chip__n { opacity: 0.7; }
</style>
