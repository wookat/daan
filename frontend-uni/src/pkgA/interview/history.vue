<template>
  <view class="wrap">
    <view class="stats-row">
      <view class="stat-c">
        <text class="stat-n">{{ total }}</text>
        <text class="stat-t">练习次数</text>
      </view>
      <view class="stat-c">
        <text class="stat-n">{{ best == null ? '—' : best }}</text>
        <text class="stat-t">最高得分</text>
      </view>
      <view class="stat-c">
        <text class="stat-n">{{ avg == null ? '—' : avg }}</text>
        <text class="stat-t">平均得分</text>
      </view>
    </view>

    <view v-if="items.length" class="list">
      <view v-for="it in items" :key="it.id" class="item" @click="openSession(it.id)">
        <view class="item-top">
          <text class="tag">{{ it.category }}</text>
          <text class="score" :class="{ good: it.total >= 80 }">{{ it.total }} 分</text>
        </view>
        <view class="q ellip2">{{ it.question_text }}</view>
        <view class="meta">{{ fmtTime(it.created_at) }} · 作答 {{ fmtDur(it.duration_sec || 0) }}</view>
      </view>
    </view>
    <view v-else-if="loadErr" class="empty">
      <text class="empty-t">加载失败：{{ loadErr }}</text>
      <view class="retry" @click="load">重试 ›</view>
    </view>
    <view v-else-if="loaded" class="empty">
      <view class="empty-ico"><l-icon name="mic" :size="30" color="#b0b4c0" /></view>
      <text class="empty-t">还没有练习记录</text>
      <button class="btn-primary" @click="goPractice">去练一题</button>
    </view>
  </view>
</template>

<script>
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
      const d = new Date(ts * 1000);
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    fmtDur(s) {
      const m = Math.floor(s / 60);
      return m + "'" + String(s % 60).padStart(2, '0') + '"';
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
.wrap { padding: 24rpx 32rpx 60rpx; }
.stats-row { display: flex; gap: 20rpx; margin-bottom: 24rpx; }
.stat-c { flex: 1; background: var(--card); border-radius: 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 26rpx 0; display: flex; flex-direction: column; align-items: center; gap: 6rpx; }
.stat-n { font-size: 36rpx; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.stat-t { font-size: 22rpx; color: var(--ink-2); }

.list { display: flex; flex-direction: column; gap: 18rpx; }
.item { background: var(--card); border-radius: 24rpx; box-shadow: 0 2rpx 8rpx rgba(23, 24, 28, 0.04); padding: 24rpx 28rpx; }
.item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.tag { background: #e8effe; color: var(--brand-text); font-size: 22rpx; font-weight: 600; border-radius: 8rpx; padding: 4rpx 14rpx; }
.score { font-size: 30rpx; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.score.good { color: #16a34a; }
.q { font-size: 27rpx; color: var(--ink); line-height: 1.6; }
.ellip2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.meta { font-size: 22rpx; color: var(--ink-2); margin-top: 12rpx; }

.empty { display: flex; flex-direction: column; align-items: center; gap: 16rpx; padding: 120rpx 0; }
.empty-ico { font-size: 72rpx; }
.empty-t { font-size: 27rpx; color: var(--ink-2); }
.retry {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  margin-top: 4rpx;
  color: var(--brand-text);
  font-size: 26rpx;
  font-weight: 500;
}
.btn-primary { background: #2e5bff; color: #fff; border-radius: 999rpx; font-size: 28rpx; font-weight: 600; min-height: 44px; display: flex; align-items: center; justify-content: center; padding: 0 60rpx; margin-top: 12rpx; }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .item:hover { cursor: pointer; }
  .btn-primary:hover { cursor: pointer; }
}

@media (min-width: 1024px) {
  .list { display: grid; grid-template-columns: 1fr 1fr; gap: 24rpx; align-items: stretch; }
  .item:hover { box-shadow: 0 6rpx 20rpx rgba(23, 24, 28, 0.1); }
}
/* #endif */
</style>
