<template>
  <view class="kg-opts" :role="multiple ? 'group' : 'radiogroup'">
    <view
      v-for="o in options"
      :key="o.key"
      class="kg-opt"
      :class="[`is-${stateOf(o.key)}`]"
      :style="{ fontSize: optSize }"
      :role="multiple ? 'checkbox' : 'radio'"
      :aria-checked="isPicked(o.key) ? 'true' : 'false'"
      :aria-disabled="locked ? 'true' : 'false'"
      hover-class="kg-opt--hover"
      :hover-stay-time="60"
      @click="pick(o.key)"
      @longpress="exclude(o.key)"
    >
      <view class="kg-opt__k num">
        <l-icon v-if="revealed && stateOf(o.key) === 'right'" class="kg-opt__sym" name="check" :size="16" tone="on-brand" />
        <l-icon v-else-if="revealed && stateOf(o.key) === 'wrong'" class="kg-opt__sym" name="x" :size="16" tone="on-brand" />
        <text v-else>{{ o.key }}</text>
      </view>
      <view class="kg-opt__b">
        <text class="q-text">{{ o.text }}</text>
        <kg-fit-img v-for="(src, si) in (o.images || (o.image ? [o.image] : []))" :key="si" :src="src" class="kg-opt__img" />
      </view>
    </view>
  </view>
</template>

<script>
import { fontSizes } from '../../services/font-size.js';
import { optionState, nextPicked } from '../../utils/option-state.js';

/**
 * KgOptionGroup（COMPONENTS §2.1）：选项组 7 态 idle/selected/right/wrong/dim/excluded/disabled（判定在 option-state.js）。
 * revealed=true 后按 answer 着色；库 radio 不满足「揭晓 + 排除」所以自研。
 */
export default {
  name: 'KgOptionGroup',
  props: {
    options: {
      type: Array,
      required: true,
      validator: (arr) => arr.every((o) => o && typeof o.key === 'string' && typeof o.text === 'string'),
    },
    /** 单选 string，多选 string[] */
    modelValue: { type: [String, Array], default: '' },
    answer: { type: [String, Array], default: '' },
    revealed: Boolean,
    excluded: { type: Array, default: () => [] },
    multiple: Boolean,
    readonly: Boolean,
    fontLevel: { type: Number, default: 1 },
  },
  emits: ['update:modelValue', 'select', 'exclude'],
  computed: {
    optSize() { return fontSizes(this.fontLevel).opt; },
    locked() { return this.readonly || this.revealed; },
    picked() { return Array.isArray(this.modelValue) ? this.modelValue : this.modelValue ? [this.modelValue] : []; },
  },
  methods: {
    ctx() {
      return { picked: this.modelValue, answer: this.answer, revealed: this.revealed, excluded: this.excluded, readonly: this.readonly, multiple: this.multiple };
    },
    isPicked(k) { return this.picked.includes(k); },
    stateOf(k) { return optionState(k, this.ctx()); },
    pick(k) {
      const next = nextPicked(k, this.ctx());
      if (next == null) return;
      this.$emit('update:modelValue', next);
      this.$emit('select', k);
    },
    exclude(k) {
      if (this.locked) return;
      this.$emit('exclude', k);
    },
  },
};
</script>

<style scoped>
.kg-opts { display: flex; flex-direction: column; gap: var(--sp-12); }
.kg-opt {
  display: flex; align-items: flex-start; gap: var(--sp-12); padding: var(--sp-12) var(--sp-16);
  border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--card); color: var(--ink-2); line-height: 1.6;
  transition: background-color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard), opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-spring-snappy);
}
.kg-opt:active:not(.is-disabled):not(.is-right):not(.is-wrong) { transform: scale(0.988); }
.kg-opt--hover { background: var(--fill); }
.kg-opt__k {
  flex-shrink: 0; width: var(--opt-letter); height: var(--opt-letter); border-radius: var(--r-full);
  display: flex; align-items: center; justify-content: center; background: var(--fill); color: var(--ink-2);
  font-size: var(--fs-sub); font-weight: 600;
  transition: background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.kg-opt__sym { animation: kg-pop var(--dur-base) var(--ease-spring); }
.kg-opt__b { flex: 1; min-width: 0; }
.kg-opt__img { display: inline-block; vertical-align: middle; margin: var(--sp-8) var(--sp-8) 0 0; border-radius: var(--r-xs); }
.kg-opt.is-selected { border-color: var(--brand); background: var(--brand-soft); }
.kg-opt.is-selected .kg-opt__k { background: var(--brand); color: var(--on-brand); }
.kg-opt.is-right { border-color: var(--ok); background: var(--ok-soft); }
.kg-opt.is-right .kg-opt__k { background: var(--ok); color: var(--on-brand); animation: kg-pop var(--dur-base) var(--ease-spring); }
.kg-opt.is-wrong { border-color: var(--bad); background: var(--bad-soft); animation: kg-nudge var(--dur-sheet) var(--ease-decel); }
.kg-opt.is-wrong .kg-opt__k { background: var(--bad); color: var(--on-brand); }
.kg-opt.is-dim { opacity: 0.5; }
.kg-opt.is-excluded { opacity: 0.45; text-decoration: line-through; }
.kg-opt.is-disabled { opacity: 0.7; }
@keyframes kg-pop { 0% { transform: scale(0.84); } 55% { transform: scale(1.14); } 100% { transform: scale(1); } }
/* #ifdef H5 */
.kg-opt:not(.is-disabled):not(.is-right):not(.is-wrong) { cursor: pointer; }
@media (hover: hover) and (pointer: fine) {
  .kg-opt:not(.is-disabled):not(.is-selected):not(.is-right):not(.is-wrong):hover { background: var(--fill); border-color: var(--line-strong); }
}
/* #endif */
</style>
