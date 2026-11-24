<template>
  <view
    class="kg-sw"
    :class="{ 'is-on': modelValue, 'is-disabled': disabled }"
    role="switch"
    :tabindex="disabled ? -1 : 0"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : null"
    :aria-label="label || undefined"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <view class="kg-sw__dot" />
  </view>
</template>

<script>
/** KgSwitch：Apple 级阻尼弹性开关（--ease-spring-snappy + 按压微横向拉长），统一替代各页杂乱开关与纯文字状态。 */
export default {
  name: 'KgSwitch',
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    label: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'change'],
  methods: {
    toggle() {
      if (this.disabled) return;
      const next = !this.modelValue;
      this.$emit('update:modelValue', next);
      this.$emit('change', next);
    },
  },
};
</script>

<style scoped>
.kg-sw {
  width: 44px;
  height: 26px;
  padding: 2px;
  border-radius: var(--r-full);
  background: var(--line-strong);
  box-sizing: border-box;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  position: relative;
  transition: background-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard);
}
.kg-sw::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 50%;
  height: var(--hit-min);
  transform: translateY(-50%);
}
.kg-sw.is-on {
  background: var(--brand);
}
.kg-sw.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}
.kg-sw__dot {
  width: 22px;
  height: 22px;
  border-radius: var(--r-full);
  background: var(--on-brand);
  box-shadow: var(--sh-1);
  transform: translate3d(0, 0, 0);
  transform-origin: left center;
  transition: transform var(--dur-base) var(--ease-spring-snappy);
}
.kg-sw.is-on .kg-sw__dot {
  transform: translate3d(18px, 0, 0);
  transform-origin: right center;
}
.kg-sw:active:not(.is-disabled) .kg-sw__dot {
  transform: translate3d(0, 0, 0) scaleX(1.14);
}
.kg-sw.is-on:active:not(.is-disabled) .kg-sw__dot {
  transform: translate3d(18px, 0, 0) scaleX(1.14);
}
/* #ifdef H5 */
.kg-sw:not(.is-disabled) {
  cursor: pointer;
}
@media (hover: hover) and (pointer: fine) {
  .kg-sw:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
}
/* #endif */
</style>
