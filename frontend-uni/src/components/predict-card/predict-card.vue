<template>
  <view v-if="loading" class="pcard">
    <view class="p-head">
      <text class="p-title">能力预测分</text>
    </view>
    <view class="p-skel">
      <view class="p-skel-b lg" />
      <view class="p-skel-b" />
      <view class="p-skel-b sm" />
    </view>
  </view>
  <view v-else-if="data" class="pcard">
    <!-- 冷启动 -->
    <view v-if="data.status === 'cold'" class="p-cold">
      <text class="p-title">能力预测分</text>
      <text class="p-cold-t">数据积累中</text>
      <text class="p-cold-s">再作答 {{ Math.max(data.need - data.n, 0) }} 题即可解锁预测分（{{ data.n }}/{{ data.need }}）</text>
      <view class="p-cold-bar"><view class="p-cold-fill" :style="{ width: Math.min((data.n / data.need) * 100, 100) + '%' }" /></view>
    </view>
    <template v-else>
      <view class="p-head">
        <text class="p-title">能力预测分</text>
        <text class="p-conf">置信度 {{ data.confidence }}</text>
      </view>
      <view class="p-hero">
        <view class="p-score-w">
          <text class="p-score">{{ data.score }}</text>
          <text class="p-unit">分</text>
        </view>
        <view class="p-meta">
          <text v-if="data.delta_week != null" class="p-delta" :class="{ down: data.delta_week < 0 }">{{ data.delta_week >= 0 ? '↑' : '↓' }} 较上周{{ data.delta_week >= 0 ? '+' : '' }}{{ data.delta_week }}</text>
          <text class="p-n">基于 {{ data.n }} 题作答{{ data.n_exam ? ' · ' + data.n_exam + ' 次模考' : '' }}</text>
        </view>
      </view>
      <!-- 进步曲线（周） -->
      <view v-if="data.history && data.history.length > 1" class="p-chart">
        <view v-for="(h, i) in data.history" :key="h.week_end" class="p-col">
          <text class="p-col-v" :class="{ hot: i === data.history.length - 1 }">{{ Math.round(h.score) }}</text>
          <view class="p-bar-w"><view class="p-bar" :class="{ hot: i === data.history.length - 1 }" :style="{ height: barH(h.score) + '%' }" /></view>
          <text class="p-col-l">{{ h.label }}</text>
        </view>
      </view>
      <!-- 五模块分项 -->
      <view class="p-mods">
        <view v-for="m in data.modules" :key="m.module" class="p-mod">
          <text class="p-mod-n">{{ m.name }}</text>
          <view class="p-mod-bar"><view class="p-mod-fill" :style="{ width: (m.score / m.max) * 100 + '%' }" /></view>
          <text class="p-mod-s">{{ m.score }}<text class="p-mod-mx">/{{ m.max }}</text></text>
          <text class="p-mod-t" :class="m.trend > 0.03 ? 'up' : m.trend < -0.03 ? 'down' : ''">{{ m.trend > 0.03 ? '↑' : m.trend < -0.03 ? '↓' : '—' }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';

export default {
  name: 'PredictCard',
  data() {
    return { data: null, loading: true };
  },
  mounted() {
    this.load();
  },
  methods: {
    // 页面 onShow 会重新调用以刷新作答进度；已有数据时静默更新不闪骨架屏
    async load() {
      this.loading = !this.data;
      try {
        this.data = await request('/api/predict?uid=' + encodeURIComponent(anonUid()));
      } catch (e) {
        if (!this.loading) return;
        this.data = null;
      }
      this.loading = false;
    },
    barH(score) {
      const arr = this.data.history.map((h) => h.score);
      const min = Math.min(...arr);
      const max = Math.max(...arr);
      if (max === min) return 60;
      return 25 + ((score - min) / (max - min)) * 70;
    }
  }
};
</script>

<style scoped>
.pcard { background: var(--card); border-radius: 16rpx; padding: 28rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.p-head { display: flex; justify-content: space-between; align-items: center; }
.p-title { font-size: 30rpx; font-weight: 600; color: var(--ink); }
.p-conf { font-size: 22rpx; color: var(--ink-2); background: var(--fill); border-radius: 999rpx; padding: 4rpx 16rpx; }
.p-hero { display: flex; align-items: flex-end; gap: 24rpx; margin: 20rpx 0 8rpx; }
.p-score-w { display: flex; align-items: baseline; }
.p-score { font-size: 76rpx; font-weight: 700; color: var(--brand); line-height: 1; }
.p-unit { font-size: 24rpx; color: var(--ink-2); margin-left: 6rpx; }
.p-meta { display: flex; flex-direction: column; gap: 6rpx; padding-bottom: 6rpx; }
.p-delta { font-size: 24rpx; color: #12b76a; font-weight: 600; }
.p-delta.down { color: #ef4444; }
.p-n { font-size: 22rpx; color: var(--ink-3); }
.p-chart { display: flex; align-items: flex-end; gap: 8rpx; height: 200rpx; margin: 20rpx 0 8rpx; }
.p-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.p-col-v { font-size: 20rpx; color: var(--ink-3); }
.p-col-v.hot { color: var(--brand); font-weight: 600; }
.p-bar-w { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.p-bar { width: 40%; max-width: 24rpx; min-height: 8rpx; background: var(--brand-soft-2); border-radius: 6rpx 6rpx 0 0; }
.p-bar.hot { background: var(--brand); }
.p-col-l { font-size: 20rpx; color: var(--ink-3); margin-top: 6rpx; }
.p-mods { margin-top: 16rpx; display: flex; flex-direction: column; gap: 14rpx; }
.p-mod { display: flex; align-items: center; gap: 14rpx; }
.p-mod-n { width: 120rpx; font-size: 24rpx; color: var(--ink-2); }
.p-mod-bar { flex: 1; height: 14rpx; background: var(--fill); border-radius: 999rpx; overflow: hidden; }
.p-mod-fill { height: 100%; background: linear-gradient(90deg, #7ea3f8, var(--brand)); border-radius: 999rpx; }
.p-mod-s { width: 100rpx; text-align: right; font-size: 24rpx; color: var(--ink); font-weight: 600; }
.p-mod-mx { font-size: 20rpx; color: var(--ink-3); font-weight: 400; }
.p-mod-t { width: 30rpx; text-align: center; font-size: 22rpx; color: var(--ink-3); }
.p-mod-t.up { color: #12b76a; }
.p-mod-t.down { color: #ef4444; }
.p-skel { display: flex; flex-direction: column; gap: 14rpx; margin-top: 20rpx; }
.p-skel-b { height: 24rpx; border-radius: 8rpx; background: var(--fill); width: 70%; animation: p-skel-pulse 1.2s ease-in-out infinite; }
.p-skel-b.lg { height: 60rpx; width: 40%; }
.p-skel-b.sm { width: 50%; }
@keyframes p-skel-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.p-cold { display: flex; flex-direction: column; gap: 10rpx; }
.p-cold-t { font-size: 34rpx; font-weight: 700; color: var(--ink); margin-top: 8rpx; }
.p-cold-s { font-size: 24rpx; color: var(--ink-2); }
.p-cold-bar { height: 12rpx; background: var(--fill); border-radius: 999rpx; overflow: hidden; margin-top: 6rpx; }
.p-cold-fill { height: 100%; background: var(--brand); border-radius: 999rpx; }
</style>
