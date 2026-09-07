<template>
  <wd-popup
    :model-value="modelValue"
    :position="position"
    :safe-area-inset-bottom="position === 'bottom'"
    :z-index="100"
    custom-class="kg-sheet"
    :custom-style="sheetStyle"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="$emit('close')"
  >
    <view class="kg-sheet__in" :class="{ 'is-dialog': position === 'center' }">
      <view v-if="position === 'bottom'" class="kg-sheet__grab" />
      <view v-if="title" class="kg-sheet__hd">
        <text class="kg-sheet__t">{{ title }}</text>
        <view class="kg-sheet__x" role="button" aria-label="关闭" @click="$emit('update:modelValue', false)">
          <l-icon name="x" :size="24" tone="ink-2" />
        </view>
      </view>
      <scroll-view scroll-y class="kg-sheet__body"><slot /></scroll-view>
      <view v-if="$slots.footer" class="kg-sheet__ft"><slot name="footer" /></view>
    </view>
  </wd-popup>
</template>

<script>
/** KgSheet（COMPONENTS §1.11）：wd-popup 封装，≥1024 自动改 dialog 形态。遮罩 --mask、层级 --z-overlay 由 tokens.generated.css 的 --wot-popup-* 决定。 */
export default {
  name: 'KgSheet',
  props: {
    modelValue: Boolean,
    title: { type: String, default: '' },
  },
  emits: ['update:modelValue', 'close'],
  data() { return { wide: false }; },
  computed: {
    position() { return this.wide ? 'center' : 'bottom'; },
    /** wd-popup 把 #fff 写死在 .wd-popup-wrapper[scoped] .wd-popup 上、深色只认 .wot-theme-dark，且 custom-class 挂在非根节点拿不到本组件 scope 属性；用内联 custom-style 让面板底色跟 --card */
    sheetStyle() {
      const base = 'background:var(--card);';
      return this.position === 'center' ? base + 'width:480px;border-radius:var(--r-lg)' : base + 'border-radius:var(--r-lg) var(--r-lg) 0 0';
    },
  },
  mounted() {
    // #ifdef H5
    const mq = window.matchMedia && window.matchMedia('(min-width: 1024px)');
    if (mq) {
      this.wide = mq.matches;
      this._mqOff = () => { this.wide = mq.matches; };
      mq.addEventListener ? mq.addEventListener('change', this._mqOff) : mq.addListener(this._mqOff);
    }
    // #endif
  },
  beforeUnmount() {
    // #ifdef H5
    const mq = window.matchMedia && window.matchMedia('(min-width: 1024px)');
    if (mq && this._mqOff) mq.removeEventListener ? mq.removeEventListener('change', this._mqOff) : mq.removeListener(this._mqOff);
    // #endif
  },
};
</script>

<style>
.kg-sheet__in { display: flex; flex-direction: column; max-height: 70vh; padding: 0 var(--sp-16) var(--sp-16); }
.kg-sheet__grab { width: 36px; height: 4px; border-radius: var(--r-full); background: var(--line); margin: var(--sp-8) auto var(--sp-4); }
.kg-sheet__hd { display: flex; align-items: center; justify-content: space-between; padding: var(--sp-12) 0; }
.kg-sheet__t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.kg-sheet__x { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; margin-right: calc(-1 * var(--sp-12)); }
.kg-sheet__body { flex: 1; min-height: 0; }
.kg-sheet__ft { padding-top: var(--sp-12); }
.kg-sheet__in.is-dialog { padding-top: var(--sp-8); }
</style>
