<template>
  <view v-if="data" class="rcard">
    <view class="r-head">
      <text class="r-title">全卷排名</text>
      <text v-if="data.small_sample" class="r-tag">样本 {{ data.total }} 人</text>
    </view>
    <view class="r-main">
      <view class="r-beat">
        <text class="r-beat-n">{{ data.beaten_pct }}%</text>
        <text class="r-beat-l">已击败{{ data.small_sample ? '（样本 ' + data.total + ' 人）' : '考生' }}</text>
      </view>
      <view class="r-kv">
        <view class="r-kv-i"><text class="r-k">排名</text><text class="r-v">{{ data.rank }}<text class="r-v-s">/{{ data.total }}</text></text></view>
        <view class="r-kv-i"><text class="r-k">平均分</text><text class="r-v">{{ data.avg }}</text></view>
      </view>
    </view>
    <!-- 分数分布 -->
    <view class="r-dist">
      <view v-for="(n, i) in data.distribution" :key="i" class="r-col">
        <view class="r-bar-w"><view class="r-bar" :class="{ me: i === data.my_bucket }" :style="{ height: barH(n) + '%' }" /></view>
        <text class="r-col-l">{{ i * 10 }}</text>
      </view>
    </view>
    <text class="r-hint">你在 {{ data.my_bucket * 10 }}-{{ data.my_bucket * 10 + 10 }} 分段（蓝色）</text>
  </view>
</template>

<script>
import { request, anonUid } from '../../api.js';

export default {
  name: 'RankCard',
  props: { attemptId: { type: [Number, String], required: true } },
  data() {
    return { data: null };
  },
  mounted() {
    this.load();
  },
  methods: {
    async load() {
      try {
        this.data = await request('/api/exam/rank/' + this.attemptId + '?uid=' + encodeURIComponent(anonUid()));
      } catch (e) {
        this.data = null;
      }
    },
    barH(n) {
      const max = Math.max(...this.data.distribution, 1);
      return n ? 15 + (n / max) * 85 : 4;
    }
  }
};
</script>

<style scoped>
.rcard { background: #fff; border-radius: 16rpx; padding: 28rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04); }
.r-head { display: flex; justify-content: space-between; align-items: center; }
.r-title { font-size: 30rpx; font-weight: 600; color: #111827; }
.r-tag { font-size: 22rpx; color: #b45309; background: #fff4e5; border-radius: 999rpx; padding: 4rpx 16rpx; }
.r-main { display: flex; align-items: center; gap: 40rpx; margin: 22rpx 0 10rpx; }
.r-beat { display: flex; flex-direction: column; }
.r-beat-n { font-size: 64rpx; font-weight: 700; color: #3b6ff5; line-height: 1.1; }
.r-beat-l { font-size: 22rpx; color: #6b7280; }
.r-kv { display: flex; gap: 40rpx; }
.r-kv-i { display: flex; flex-direction: column; }
.r-k { font-size: 22rpx; color: #9ca3af; }
.r-v { font-size: 34rpx; font-weight: 600; color: #111827; }
.r-v-s { font-size: 22rpx; color: #9ca3af; font-weight: 400; }
.r-dist { display: flex; align-items: flex-end; gap: 6rpx; height: 140rpx; margin-top: 14rpx; }
.r-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.r-bar-w { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.r-bar { width: 60%; min-height: 4rpx; background: #e5e7eb; border-radius: 4rpx 4rpx 0 0; }
.r-bar.me { background: #3b6ff5; }
.r-col-l { font-size: 18rpx; color: #9ca3af; margin-top: 4rpx; }
.r-hint { font-size: 22rpx; color: #9ca3af; margin-top: 8rpx; }
</style>
