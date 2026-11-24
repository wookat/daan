<template>
  <kg-sheet class="kg-cfm" :model-value="modelValue" :title="title" @update:model-value="onUpdate" @close="onClose">
    <view v-if="desc" class="kg-cfm__desc">
      <text class="kg-cfm__t">{{ desc }}</text>
    </view>
    <slot />
    <template #footer>
      <view class="kg-cfm__acts">
        <template v-if="danger">
          <kg-button variant="primary" size="lg" block :disabled="loading" @click="onCancel">{{ cancelText }}</kg-button>
          <kg-button variant="ghost" size="lg" block tone="bad" :loading="loading" @click="onConfirm">{{ confirmText }}</kg-button>
        </template>
        <template v-else>
          <kg-button variant="primary" size="lg" block :loading="loading" @click="onConfirm">{{ confirmText }}</kg-button>
          <kg-button variant="ghost" size="lg" block :disabled="loading" @click="onCancel">{{ cancelText }}</kg-button>
        </template>
      </view>
    </template>
  </kg-sheet>
</template>

<script>
/**
 * KgConfirmSheet：破坏性/关键操作统一确认抽屉（替代原生 showModal 蓝字锁死与 Esc 误触发风险）。
 * danger=true 时：安全取消钮占主位（primary），危险确认钮退次位（ghost + bad），点遮罩/X/Esc 一律走取消。
 */
export default {
  name: 'KgConfirmSheet',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, required: true },
    desc: { type: String, default: '' },
    confirmText: { type: String, default: '确认' },
    cancelText: { type: String, default: '取消' },
    danger: { type: Boolean, default: true },
    loading: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  methods: {
    onUpdate(v) {
      this.$emit('update:modelValue', v);
      if (!v && !this._picked) this.$emit('cancel');
      if (v) this._picked = false;
    },
    onClose() {
      if (!this._picked) this.$emit('cancel');
      this._picked = false;
    },
    onConfirm() {
      if (this.loading) return;
      this._picked = true;
      this.$emit('update:modelValue', false);
      this.$emit('confirm');
    },
    onCancel() {
      this._picked = true;
      this.$emit('update:modelValue', false);
      this.$emit('cancel');
    },
  },
};
</script>

<style scoped>
.kg-cfm__desc {
  padding: var(--sp-4) 0 var(--sp-8);
}
.kg-cfm__t {
  display: block;
  font-size: var(--fs-body);
  line-height: 1.6;
  color: var(--ink-2);
}
.kg-cfm__acts {
  display: flex;
  flex-direction: column;
  gap: var(--sp-8);
}
</style>
