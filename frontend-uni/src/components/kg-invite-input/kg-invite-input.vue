<template>
  <view class="kg-inv">
    <view class="kg-inv__row" :class="{ 'is-err': !!error }">
      <input
        class="kg-inv__in num"
        :value="modelValue"
        type="text"
        :maxlength="maxlength"
        :placeholder="placeholder"
        placeholder-class="kg-inv__ph"
        confirm-type="done"
        :disabled="loading"
        @input="onInput"
        @confirm="submit"
      />
      <kg-button variant="primary" size="md" :disabled="!valid" :loading="loading" @click="submit">{{ buttonText }}</kg-button>
    </view>
    <text v-if="error" class="kg-inv__err" role="alert">{{ error }}</text>
  </view>
</template>

<script>
/** KgInviteInput（COMPONENTS §1.2）：邀请码输入 + 加入，inline 错误态不用 toast。team/join 与 pkgA/team 共用。 */
export default {
  name: 'KgInviteInput',
  props: {
    modelValue: { type: String, default: '' },
    maxlength: { type: Number, default: 8 },
    minlength: { type: Number, default: 4 },
    placeholder: { type: String, default: '输入邀请码' },
    buttonText: { type: String, default: '加入' },
    error: { type: String, default: '' },
    loading: Boolean,
  },
  emits: ['update:modelValue', 'submit'],
  computed: {
    valid() { return this.modelValue.trim().length >= this.minlength; },
  },
  methods: {
    onInput(e) {
      const v = String(e.detail.value || '').replace(/\s+/g, '').toUpperCase();
      this.$emit('update:modelValue', v);
    },
    submit() {
      if (!this.valid || this.loading) return;
      this.$emit('submit', this.modelValue.trim());
    },
  },
};
</script>

<style scoped>
.kg-inv { display: flex; flex-direction: column; gap: var(--sp-4); }
.kg-inv__row { display: flex; align-items: center; gap: var(--sp-8); height: var(--input-h); padding: 0 var(--sp-4) 0 var(--sp-12); background: var(--fill); border-radius: var(--r-sm); border: 1px solid transparent; transition: border-color var(--dur-fast) var(--ease-standard); }
.kg-inv__row:focus-within { border-color: var(--brand); }
.kg-inv__row.is-err { border-color: var(--bad); }
.kg-inv__in { flex: 1; min-width: 0; height: 100%; font-size: var(--fs-body); color: var(--ink); letter-spacing: 2px; }
.kg-inv__ph { color: var(--ink-4); letter-spacing: 0; }
.kg-inv__err { font-size: var(--fs-sub); color: var(--bad-strong); padding-left: var(--sp-4); }
</style>
