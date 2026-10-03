<template>
  <kg-card variant="flat" class="kg-q">
    <view v-if="showMeta" class="kg-q__meta">
      <kg-tag v-if="q.module" tone="module" :module="q.module">{{ modLabel }}</kg-tag>
      <text v-if="q.tag3" class="kg-q__kp" role="button" @click="$emit('tag', q.tag3)">{{ q.tag3 }}</text>
      <text v-if="stars" class="kg-q__stars" aria-label="难度">{{ stars }}</text>
      <kg-tag v-if="q.difficultyLabel" :tone="diffTone">难度·{{ q.difficultyLabel }}</kg-tag>
      <text v-if="accText" class="kg-q__acc num">{{ accText }}</text>
      <kg-tag v-if="q.isReal" tone="warn">真题</kg-tag>
      <kg-tag v-if="q.dueMix" tone="info">曾错题 · 到期复习</kg-tag>
    </view>
    <view v-if="q.material" class="kg-q__mat" :class="{ 'is-open': matOpen }">
      <view class="kg-q__mat-hd" role="button" :aria-expanded="matOpen ? 'true' : 'false'" @click="matOpen = !matOpen">
        <kg-tag v-if="q.groupSeq" tone="neutral">同材料题组 {{ q.groupSeq }}</kg-tag>
        <text class="kg-q__mat-t">材料</text>
        <l-icon :name="matOpen ? 'chevron-down' : 'chevron-right'" :size="16" tone="muted" />
      </view>
      <text v-show="matOpen" class="kg-q__mat-b q-text">{{ q.material }}</text>
    </view>
    <view class="kg-q__stem q-text" :style="{ fontSize: stemSize }">
      <text v-if="total" class="kg-q__idx num">{{ index + 1 }}.</text>
      <slot name="stem"><text>{{ q.stem }}</text></slot>
    </view>
    <view v-if="q.images && q.images.length" class="kg-q__imgs">
      <image v-for="(src, i) in q.images" :key="i" :src="src" mode="widthFix" class="kg-q__img" @click="preview(i)" />
    </view>
    <slot />
  </kg-card>
</template>

<script>
import { moduleLabel } from '../../module-meta.js';
import { fontSizes } from '../../font-size.js';

/**
 * KgQuestionCard（COMPONENTS §2.1）：meta 行 + 材料折叠 + 题干 + 图片。选项/解析是独立组件（模考不显解析、分享页选项只读）。
 * q: {id, module, tag3, stem, material?, images?, difficulty?(1-5), difficultyLabel?, accuracy?(0-100), attemptCount?, isReal?, dueMix?, groupSeq?}
 */
export default {
  name: 'KgQuestionCard',
  props: {
    q: { type: Object, required: true, validator: (q) => typeof q.stem === 'string' },
    index: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    fontLevel: { type: Number, default: 1 },
    showMeta: { type: Boolean, default: true },
  },
  emits: ['tag'],
  data() { return { matOpen: true }; },
  computed: {
    modLabel() { return moduleLabel(this.q.module); },
    stars() {
      const d = this.q.difficulty;
      return d >= 1 && d <= 5 ? '★'.repeat(Math.round(d)) : '';
    },
    accText() {
      const c = this.q.attemptCount;
      if (this.q.accuracy == null || (c != null && c < 5)) return '';
      return `全站正确率 ${this.q.accuracy}%`;
    },
    // B3：校准难度档标签的色调（与小程序 q-stat.ts difficultyTag 同映射）
    diffTone() {
      const d = this.q.difficulty;
      return d >= 5 ? 'bad' : d === 4 ? 'warn' : d === 3 ? 'neutral' : 'info';
    },
    stemSize() { return fontSizes(this.fontLevel).q; },
  },
  methods: {
    preview(i) { uni.previewImage({ current: i, urls: this.q.images }); },
  },
};
</script>

<style scoped>
.kg-q__meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--sp-8); margin-bottom: var(--sp-12); font-size: var(--fs-sub); color: var(--ink-3); }
.kg-q__kp { color: var(--ink-3); }
.kg-q__stars { color: var(--warn); letter-spacing: 1px; }
.kg-q__mat { background: var(--fill); border-radius: var(--r-sm); padding: var(--sp-8) var(--sp-12); margin-bottom: var(--sp-12); }
.kg-q__mat-hd { display: flex; align-items: center; gap: var(--sp-8); min-height: 28px; }
.kg-q__mat-t { flex: 1; font-size: var(--fs-sub); color: var(--ink-3); }
.kg-q__mat-b { display: block; margin-top: var(--sp-8); font-size: var(--fs-sub); color: var(--ink-2); line-height: var(--lh-question); }
.kg-q__stem { color: var(--ink); line-height: var(--lh-question); }
.kg-q__idx { color: var(--ink-3); margin-right: var(--sp-4); }
.kg-q__imgs { margin-top: var(--sp-12); display: flex; flex-direction: column; gap: var(--sp-8); }
.kg-q__img { width: 100%; border-radius: var(--r-sm); }
</style>
