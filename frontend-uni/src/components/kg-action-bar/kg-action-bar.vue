<template>
  <view class="kg-bar" :class="[`kg-bar--${layout}`]" role="toolbar">
    <template v-if="layout === 'actions'">
      <kg-button v-if="secondaryText" variant="ghost" size="lg" @click="$emit('secondary')">{{ secondaryText }}</kg-button>
      <kg-button variant="primary" size="lg" :block="!secondaryText" :disabled="disabled" :loading="loading" @click="$emit('primary')">{{ primaryText }}</kg-button>
    </template>
    <template v-else-if="layout === 'answer'">
      <view class="kg-bar__prog">
        <slot name="left">
          <text class="kg-bar__n num">{{ index + 1 }}/{{ total }}</text>
          <kg-progress :value="index + 1" :max="total" class="kg-bar__pb" />
        </slot>
      </view>
      <view class="kg-bar__tools"><slot name="tools" /></view>
      <kg-button variant="primary" size="lg" :disabled="disabled" :loading="loading" @click="$emit('primary')">{{ primaryText }}</kg-button>
    </template>
    <template v-else>
      <slot />
    </template>
  </view>
</template>

<script>
/**
 * KgActionBar（COMPONENTS §1.7）：固定底栏，三变体 actions / answer / input。
 * 页面内容底部留 padding-bottom: calc(88px + env(safe-area-inset-bottom))（全局 .has-bar）。≥1024 不再 fixed（随主列 sticky）。
 */
export const ACTION_BAR_LAYOUTS = ['actions', 'answer', 'input'];

export default {
  name: 'KgActionBar',
  props: {
    layout: { type: String, default: 'actions', validator: (v) => ACTION_BAR_LAYOUTS.includes(v) },
    primaryText: { type: String, default: '确定' },
    secondaryText: { type: String, default: '' },
    index: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    disabled: Boolean,
    loading: Boolean,
  },
  emits: ['primary', 'secondary'],
};
</script>

<style scoped>
.kg-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--z-bar);
  display: flex; align-items: center; gap: var(--sp-12);
  padding: var(--sp-12) var(--page-x) calc(var(--sp-12) + env(safe-area-inset-bottom, 0px));
  background: var(--card); border-top: 1px solid var(--line);
  animation: kg-bar-in var(--dur-base) var(--ease-decel);
}
.kg-bar--actions :deep(.kg-btn) { flex: 1; }
.kg-bar__prog { display: flex; flex-direction: column; gap: var(--sp-4); min-width: 56px; }
.kg-bar__n { font-size: var(--fs-sub); color: var(--ink-2); }
.kg-bar__tools { flex: 1; display: flex; justify-content: center; gap: var(--sp-8); }
.kg-bar__tools :deep(.kg-tool) { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); }
@keyframes kg-bar-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@media (min-width: 1024px) {
  .kg-bar { position: sticky; }
}
</style>
