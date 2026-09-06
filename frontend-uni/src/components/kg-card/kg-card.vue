<template>
  <view
    class="kg-card"
    :class="[`kg-card--${variant}`, { 'is-clickable': clickable, 'is-selected': selected, 'kg-card--p12': padding === 12 }]"
    :hover-class="clickable ? 'kg-card--hover' : 'none'"
    :hover-stay-time="80"
    :role="clickable ? 'button' : undefined"
    @click="clickable && $emit('click', $event)"
  >
    <view v-if="$slots.header" class="kg-card__hd"><slot name="header" /></view>
    <slot />
    <view v-if="$slots.footer" class="kg-card__ft"><slot name="footer" /></view>
    <l-icon v-if="clickable && chevron" class="kg-card__chev" name="chevron-right" :size="20" tone="faint" />
  </view>
</template>

<script>
/** KgCard（COMPONENTS §1.4）：flat 描边无影 / raised 影无边 / soft 填充；描边与阴影不并用。 */
export const CARD_VARIANTS = ['flat', 'raised', 'soft'];

export default {
  name: 'KgCard',
  props: {
    variant: { type: String, default: 'flat', validator: (v) => CARD_VARIANTS.includes(v) },
    clickable: Boolean,
    selected: Boolean,
    chevron: Boolean,
    padding: { type: Number, default: 16, validator: (v) => v === 16 || v === 12 },
  },
  emits: ['click'],
};
</script>

<style scoped>
.kg-card {
  position: relative; background: var(--card); border-radius: var(--r-md); padding: var(--card-pad);
  transition: background-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
}
.kg-card + .kg-card { margin-top: var(--card-gap); }
.kg-card--p12 { padding: var(--sp-12); }
.kg-card--flat { border: 1px solid var(--line); }
.kg-card--raised { box-shadow: var(--sh-1); }
.kg-card--soft { background: var(--fill); }
.kg-card--flat.kg-card--hover, .kg-card--soft.kg-card--hover { background: var(--fill); }
.kg-card--raised.kg-card--hover { box-shadow: var(--sh-2); }
.kg-card.is-selected { border: 1px solid var(--brand); box-shadow: 0 0 0 2px var(--brand-soft); }
.kg-card__hd { margin-bottom: var(--sp-12); }
.kg-card__ft { margin-top: var(--sp-12); }
.kg-card__chev { position: absolute; right: var(--sp-12); top: 50%; transform: translateY(-50%); }
@media (min-width: 1024px) {
  .kg-card--raised.is-clickable:hover { box-shadow: var(--sh-2); }
  .kg-card--flat.is-clickable:hover { background: var(--fill); }
}
</style>
