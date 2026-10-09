<template>
  <view class="wrap">
    <kg-two-col>
      <template #main>
        <kg-card v-if="items.length" class="stats">
          <kg-stat-row :items="statItems" />
        </kg-card>

        <view v-if="items.length" class="list">
          <kg-card v-for="it in items" :key="it.id" clickable chevron class="item" @click="openSession(it.id)">
            <view class="item-top">
              <kg-tag tone="brand">{{ it.category }}</kg-tag>
              <text class="score num" :class="{ good: it.total >= 80 }">{{ it.total }} 分</text>
            </view>
            <text class="q q-text ellip2">{{ it.question_text }}</text>
            <text class="meta">{{ fmtTime(it.created_at) }} · 作答 {{ fmtDur(it.duration_sec || 0) }}</text>
          </kg-card>
        </view>
        <kg-empty-state
          v-else-if="loadErr"
          icon="wifi-off"
          :title="'加载失败：' + loadErr"
          cta-text="重试"
          @cta="load"
        />
        <kg-empty-state
          v-else-if="loaded"
          icon="mic"
          title="还没有练习记录"
          desc="AI 面试陪练会记录每次作答与得分，先去练一题吧"
          cta-text="去练一题"
          @cta="goPractice"
        />
        <kg-skeleton v-else preset="cards" />
      </template>
      <template #aside>
        <kg-card v-if="items.length" variant="soft" class="aside-card">
          <text class="aside-t">继续练习</text>
          <text class="aside-d">随机抽一题模拟面试，AI 即时点评</text>
          <kg-button variant="primary" size="lg" block icon="mic" @click="goPractice">去练一题</kg-button>
        </kg-card>
      </template>
    </kg-two-col>
  </view>
</template>

<script>
import { fmtMDHM, fmtDur as fmtDurShared } from '../../fmt.js';
import { interviewHistory } from '../../api.js';

export default {
  data() {
    return { items: [], total: 0, best: null, loaded: false, loadErr: '' };
  },
  computed: {
    avg() {
      if (!this.items.length) return null;
      return Math.round(this.items.reduce((s, i) => s + (i.total || 0), 0) / this.items.length);
    },
    statItems() {
      return [
        { label: '练习次数', value: this.total },
        { label: '最高得分', value: this.best == null ? '—' : this.best, tone: 'ok' },
        { label: '平均得分', value: this.avg == null ? '—' : this.avg, tone: 'brand' },
      ];
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      this.loadErr = '';
      try {
        const d = await interviewHistory(100);
        this.items = d.items || [];
        this.total = d.total || 0;
        this.best = d.best;
      } catch (e) {
        this.loadErr = e.message || '网络异常';
        uni.showToast({ title: e.message || '加载失败', icon: 'none' });
      }
      this.loaded = true;
    },
    fmtTime(ts) {
      return fmtMDHM(ts);
    },
    fmtDur(s) {
      return fmtDurShared(s);
    },
    openSession(id) {
      uni.navigateTo({ url: '/pkgA/interview/interview?session_id=' + id });
    },
    goPractice() {
      uni.navigateTo({ url: '/pkgA/interview/interview' });
    },
  },
};
</script>

<style scoped>
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-48); }
.stats { margin-bottom: var(--sp-16); }
.list { display: flex; flex-direction: column; gap: var(--card-gap); }
.item-top { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-8); }
.score { font-size: var(--fs-h3); color: var(--ink); flex-shrink: 0; }
.score.good { color: var(--ok); }
.q { display: block; font-size: var(--fs-body); color: var(--ink); }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.meta { display: block; font-size: var(--fs-caption); color: var(--ink-3); margin-top: var(--sp-8); }
.aside-card { display: flex; flex-direction: column; gap: var(--sp-8); }
.aside-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.aside-d { font-size: var(--fs-sub); color: var(--ink-3); margin-bottom: var(--sp-8); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap { max-width: 1044px !important; }
}
/* #endif */
</style>
