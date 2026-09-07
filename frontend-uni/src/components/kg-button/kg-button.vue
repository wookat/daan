<template>
  <wd-button
    :type="wotType"
    :size="wotSize"
    :plain="variant === 'secondary'"
    :block="block"
    :loading="loading"
    :disabled="disabled"
    :aria-disabled="disabled || loading ? 'true' : null"
    :custom-class="cls"
    @click="onClick"
  >
    <view class="kg-btn__in">
      <l-icon v-if="icon" :name="icon" :size="size === 'sm' ? 16 : 20" tone="inherit" />
      <slot />
    </view>
  </wd-button>
</template>

<script>
/**
 * KgButton（COMPONENTS §1.1）：4 级 × 3 尺寸 × 6 态，薄封装 wd-button。
 * 高度/圆角/字号/padding 由 tokens.generated.css 的 --wot-button-* 决定；这里只翻译 variant → wot type/plain 并补 secondary/ghost/tone 的底色。
 * H5 的 <uni-button> 不是原生 button，wd-button 的 disabled 只落 is-disabled 类，须显式 aria-disabled 才对辅助技术/axe 可见。
 */
export const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'text'];
export const BUTTON_SIZES = ['lg', 'md', 'sm'];
export const BUTTON_TONES = ['brand', 'bad', 'inverse'];
const WOT_TYPE = { primary: 'primary', secondary: 'primary', ghost: 'default', text: 'text' };
const WOT_SIZE = { lg: 'large', md: 'medium', sm: 'small' };

export default {
  name: 'KgButton',
  props: {
    variant: { type: String, default: 'primary', validator: (v) => BUTTON_VARIANTS.includes(v) },
    size: { type: String, default: 'md', validator: (v) => BUTTON_SIZES.includes(v) },
    /** bad：危险动作（删除/退出，四级都可）；inverse：brand hero 上的白底按钮（配 primary/ghost） */
    tone: { type: String, default: 'brand', validator: (v) => BUTTON_TONES.includes(v) },
    block: Boolean,
    disabled: Boolean,
    loading: Boolean,
    icon: { type: String, default: '' },
  },
  emits: ['click'],
  computed: {
    wotType() { return WOT_TYPE[this.variant]; },
    wotSize() { return WOT_SIZE[this.size]; },
    cls() {
      return ['kg-btn', `kg-btn--${this.variant}`, `kg-btn--${this.size}`, `kg-btn--tone-${this.tone}`].join(' ');
    },
  },
  methods: {
    onClick(e) {
      if (this.disabled || this.loading) return;
      this.$emit('click', e);
    },
  },
};
</script>

<style>
/* 非 scoped：custom-class 挂在 wd-button 根上，scoped 属性穿不进去 */
.kg-btn { font-weight: 500; transition: background-color var(--dur-instant) var(--ease-standard), color var(--dur-instant) var(--ease-standard); }
.kg-btn--lg { font-weight: 600; }
/* wot medium 自带 min-width:120，行内工具位（筛选/批量）放不下且挤压同排分段控件；宽度由内容+padding 决定，与 sm/lg 一致 */
.kg-btn.kg-btn--md { min-width: 0 !important; }
.kg-btn.kg-btn--secondary { background: var(--brand-soft) !important; color: var(--brand-text) !important; border-color: transparent !important; }
.kg-btn.kg-btn--secondary:active { background: var(--brand-soft-2) !important; }
.kg-btn.kg-btn--ghost { background: var(--card) !important; color: var(--ink-2) !important; border: 1px solid var(--line) !important; }
.kg-btn.kg-btn--ghost:active { background: var(--fill) !important; }
.kg-btn.kg-btn--text { background: transparent !important; color: var(--brand-text) !important; padding: 0 var(--sp-4) !important; }
.kg-btn.kg-btn--text:active { color: var(--brand-press) !important; }
.kg-btn.is-block { width: 100%; flex-basis: 100%; }
.kg-btn.kg-btn--tone-bad.kg-btn--primary { background: var(--bad) !important; color: var(--on-brand) !important; }
.kg-btn.kg-btn--tone-bad.kg-btn--primary:active { background: var(--bad-strong) !important; }
.kg-btn.kg-btn--tone-bad.kg-btn--secondary { background: var(--bad-soft) !important; color: var(--bad-strong) !important; }
.kg-btn.kg-btn--tone-bad.kg-btn--ghost { color: var(--bad-strong) !important; border-color: var(--bad-strong) !important; }
.kg-btn.kg-btn--tone-bad.kg-btn--text { color: var(--bad-strong) !important; }
.kg-btn.kg-btn--tone-inverse.kg-btn--primary { background: var(--on-brand) !important; color: var(--brand) !important; }
.kg-btn.kg-btn--tone-inverse.kg-btn--ghost { background: rgba(255, 255, 255, 0.16) !important; color: var(--on-brand) !important; border-color: transparent !important; }
.kg-btn.is-disabled, .kg-btn[disabled] { opacity: 0.4 !important; pointer-events: none; }
.kg-btn__in { display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-8); }
/* sm(28)/md(36) 视觉高度不变，命中区纵向扩到 --hit-min（并排间距 ≥ sp-8 不会互相吞）。
   uni-h5 给 button 默认 overflow:hidden 会把伸出的 ::after 裁掉，须放开 */
.kg-btn.kg-btn--sm, .kg-btn.kg-btn--md { position: relative; overflow: visible !important; }
/* 复用 wd-button 自带的 ::after（text 变体下它 display:none、宽 200% 做 hairline），全部覆写成命中层 */
.kg-btn.kg-btn--sm::after, .kg-btn.kg-btn--md::after { content: ''; display: block; position: absolute; left: 0; right: 0; width: auto; top: 50%; height: var(--hit-min); border: none; transform: translateY(-50%); }
@media (min-width: 1024px) {
  .kg-btn.kg-btn--primary:hover { background: var(--brand-press) !important; }
  .kg-btn.kg-btn--secondary:hover { background: var(--brand-soft-2) !important; }
  .kg-btn.kg-btn--ghost:hover { background: var(--fill) !important; }
  .kg-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
}
</style>
