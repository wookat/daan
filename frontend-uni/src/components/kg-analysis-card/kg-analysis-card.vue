<template>
  <kg-card variant="soft" class="kg-ana">
    <view class="kg-ana__hd">
      <text class="kg-ana__t">正确答案 <text class="kg-ana__ans num">{{ answerText }}</text></text>
      <kg-tag v-if="picked" :tone="isRight ? 'ok' : 'bad'">{{ isRight ? '答对了' : `你选 ${pickedText}` }}</kg-tag>
    </view>
    <view class="kg-ana__body" :class="{ 'is-collapsed': isCollapsed }">
      <rich-text class="kg-ana__md q-text" :nodes="html" />
    </view>
    <kg-button v-if="isCollapsed" variant="text" size="sm" @click="open = true">展开解析</kg-button>
    <view v-if="statLine || (stats && stats.avgSecs)" class="kg-ana__stats">
      <text v-if="statLine">{{ statLine }}</text>
      <text v-if="stats && stats.avgSecs" class="num">· 平均用时 {{ stats.avgSecs }}s</text>
    </view>
    <text v-if="sourceText" class="kg-ana__src">来源：{{ sourceText }}</text>
    <view v-if="tags && tags.length" class="kg-ana__tags">
      <kg-tag v-for="t in tags" :key="t" tone="neutral">{{ t }}</kg-tag>
    </view>
    <view v-if="$slots.social" class="kg-ana__social"><slot name="social" /></view>
  </kg-card>
</template>

<script>
import { md } from '../../md.js';
import { qSourceText, qStatLine } from '../../q-stat.js';

/**
 * KgAnalysisCard（COMPONENTS §2.1）：默认折叠 3 行的解析卡。底部数据行复用 q-stat.js 口径（样本 <5 不显示）；
 * 社交行通过 slot#social 放现有 q-social-bar，不重写。
 */
export default {
  name: 'KgAnalysisCard',
  props: {
    answer: { type: [String, Array], required: true },
    picked: { type: [String, Array], default: '' },
    analysis: { type: String, default: '' },
    /** {accuracy?, attemptCount?, mostWrong?, avgSecs?} */
    stats: { type: Object, default: null },
    source: { type: String, default: '' },
    tags: { type: Array, default: () => [] },
    collapsed: { type: Boolean, default: true },
  },
  data() { return { open: false }; },
  computed: {
    answerText() { return Array.isArray(this.answer) ? this.answer.join('') : this.answer; },
    pickedText() { return Array.isArray(this.picked) ? this.picked.join('') : this.picked; },
    isRight() { return this.pickedText === this.answerText; },
    html() { return md(this.analysis || '暂无解析'); },
    isCollapsed() { return this.collapsed && !this.open; },
    sourceText() { return qSourceText(this.source); },
    statLine() {
      const s = this.stats;
      if (!s) return '';
      return qStatLine({ attempt_count: s.attemptCount, correct_ratio: s.accuracy, most_wrong: s.mostWrong, answer: this.answerText });
    },
  },
};
</script>

<style scoped>
.kg-ana__hd { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.kg-ana__t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.kg-ana__ans { color: var(--ok-strong); }
.kg-ana__body { color: var(--ink-2); font-size: var(--fs-body); line-height: var(--lh-question); }
.kg-ana__body.is-collapsed { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.kg-ana__stats { margin-top: var(--sp-12); font-size: var(--fs-sub); color: var(--ink-3); display: flex; flex-wrap: wrap; gap: var(--sp-4); }
.kg-ana__src { display: block; margin-top: var(--sp-4); font-size: var(--fs-sub); color: var(--ink-3); }
.kg-ana__tags { display: flex; flex-wrap: wrap; gap: var(--sp-8); margin-top: var(--sp-8); }
.kg-ana__social { margin-top: var(--sp-12); padding-top: var(--sp-12); border-top: 1px solid var(--line); }
</style>
