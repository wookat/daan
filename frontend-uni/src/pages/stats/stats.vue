<template>
  <view class="wrap">
    <view class="card">
      <view class="h">错题模块分布</view>
      <view v-if="!byModule.length" class="spin">暂无数据</view>
      <view v-for="m in byModule" :key="m.module" class="brow">
        <view class="blabel">
          <text>{{ m.module || '未知' }}</text>
          <text class="n">×{{ m.n }}</text>
        </view>
        <view class="bar">
          <view class="fill" :style="{ width: (m.n / total) * 100 + '%' }" />
        </view>
      </view>
    </view>
    <view class="card">
      <view class="h">高频错题型 TOP10</view>
      <view v-if="!byType.length" class="spin">暂无数据</view>
      <view v-for="t in byType" :key="t.question_type" class="tline">
        {{ t.question_type || '未知' }} <text class="n">×{{ t.n }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { request } from '../../api.js';

export default {
  data() {
    return { byModule: [], byType: [] };
  },
  computed: {
    total() {
      return this.byModule.reduce((s, m) => s + m.n, 0) || 1;
    },
  },
  onShow() {
    this.load();
  },
  methods: {
    async load() {
      try {
        const d = await request('/api/stats');
        this.byModule = d.by_module;
        this.byType = d.by_type;
      } catch (e) {
        uni.showToast({ title: '加载失败：' + e.message, icon: 'none' });
      }
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.card { background: #fff; border-radius: var(--radius); padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 28rpx; font-weight: 600; margin-bottom: 14rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 20rpx; }
.brow { margin: 14rpx 0; }
.blabel { display: flex; justify-content: space-between; font-size: 26rpx; color: var(--ink); margin-bottom: 6rpx; }
.bar { background: var(--brand-soft); border-radius: 999rpx; height: 20rpx; position: relative; overflow: hidden; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #6366f1, #4f46e5); border-radius: 999rpx; }
.tline { font-size: 26rpx; margin: 8rpx 0; }
.n { color: var(--brand); font-weight: 600; }
</style>
