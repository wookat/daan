<template>
  <view class="wrap">
    <view class="card">
      <view class="h">错题模块分布</view>
      <view v-if="!byModule.length" class="spin">暂无数据</view>
      <view v-for="m in byModule" :key="m.module" class="bar">
        <view class="fill" :style="{ width: (m.n / total) * 100 + '%' }" />
        <text class="bt">{{ m.module || '未知' }} × {{ m.n }}</text>
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
.card { background: #fff; border-radius: 20rpx; padding: 24rpx; margin-bottom: 24rpx; box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.06); }
.h { font-size: 28rpx; font-weight: 600; margin-bottom: 14rpx; }
.spin { text-align: center; color: #8a90a0; font-size: 26rpx; padding: 20rpx; }
.bar { background: #eef2ff; border-radius: 10rpx; height: 36rpx; position: relative; margin: 10rpx 0; overflow: hidden; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; background: #2f6fed; border-radius: 10rpx; }
.bt { position: relative; font-size: 22rpx; padding-left: 14rpx; line-height: 36rpx; color: #1f2430; }
.tline { font-size: 26rpx; margin: 8rpx 0; }
.n { color: #2f6fed; font-weight: 600; }
</style>
