<template>
  <view v-if="visible" class="mask" :class="{ 'above-tabbar': aboveTabbar }" @click="$emit('close')">
    <view class="sheet" @click.stop>
      <view class="sheet-h">
        <text class="sheet-t">导出 PDF</text>
        <view class="sheet-x" @click="$emit('close')">✕</view>
      </view>
      <view class="info-row">
        <text class="info-k">导出范围</text>
        <text class="info-v">{{ scope }}</text>
      </view>
      <view class="info-row">
        <text class="info-k">题数</text>
        <text class="info-v">{{ countText }}</text>
      </view>
      <view class="exp-opts">
        <text class="expchip" :class="{ on: withAns && !only }" @click="only = false; withAns = !withAns">含解析</text>
        <text class="expchip" :class="{ on: only }" @click="only = !only">仅答案</text>
        <text class="expchip" :class="{ on: withSheet && !only }" @click="only = false; withSheet = !withSheet">含答题卡</text>
      </view>
      <view class="opt-note">{{ only ? '只导出参考答案页，不含题目' : '导出题目' + (withAns ? ' + 答案解析' : '') + (withSheet ? ' + 机读答题卡' : '') }}</view>
      <view class="confirm-btn" :class="{ dim: busy }" :aria-disabled="String(!!busy)" @click="onConfirm">{{ busy ? '正在生成 PDF…' : '确认导出' }}</view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ExportConfirm',
  props: {
    visible: { type: Boolean, default: false },
    scope: { type: String, default: '当前题目' },
    count: { type: Number, default: null },
    busy: { type: Boolean, default: false },
    aboveTabbar: { type: Boolean, default: false },
  },
  data() {
    return { withAns: true, withSheet: true, only: false };
  },
  computed: {
    countText() {
      return this.count != null ? this.count + ' 题' : '按当前设置组卷';
    },
  },
  methods: {
    onConfirm() {
      if (this.busy) return;
      this.$emit('confirm', {
        include_answers: this.only || this.withAns,
        answer_sheet: !this.only && this.withSheet,
        include_questions: !this.only,
      });
    },
  },
};
</script>

<style scoped>
.mask { position: fixed; inset: 0; background: rgba(15, 18, 30, 0.5); z-index: 90; display: flex; align-items: flex-end; }
/* #ifdef H5 */
/* H5 底部 TabBar 常驻：整个弹层收在 TabBar 上方（仅 tab 页需要） */
@media (max-width: 767px) {
  .mask.above-tabbar { bottom: calc(50px + env(safe-area-inset-bottom)); }
}
/* #endif */
.sheet { width: 100%; box-sizing: border-box; background: var(--card); border-radius: 32rpx 32rpx 0 0; padding: 32rpx 28rpx calc(36rpx + env(safe-area-inset-bottom)); max-height: 76vh; overflow-y: auto; }
.sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; }
.sheet-t { font-size: 30rpx; font-weight: 700; color: var(--ink); }
.sheet-x { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; font-size: 28rpx; color: var(--ink-2); margin: -6px -8rpx -6px 0; }
.info-row { display: flex; align-items: baseline; gap: 20rpx; margin-bottom: 12rpx; }
.info-k { flex-shrink: 0; font-size: 24rpx; color: var(--ink-2); }
.info-v { font-size: 26rpx; color: var(--ink); font-weight: 500; }
.exp-opts { display: flex; gap: 12rpx; margin-top: 20rpx; }
.expchip { flex: 1; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1rpx solid var(--line); border-radius: 12rpx; font-size: 24rpx; color: var(--ink-2); background: var(--fill); }
.expchip.on { border-color: var(--brand-text); color: var(--brand-text); background: var(--brand-soft); font-weight: 600; }
.opt-note { margin-top: 14rpx; font-size: 24rpx; color: var(--ink-3); }
.confirm-btn { margin-top: 24rpx; min-height: 44px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: var(--brand); color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; }
.confirm-btn.dim { opacity: 0.6; }
</style>
