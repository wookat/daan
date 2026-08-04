<template>
  <view class="wrap">
    <view class="card">
      <view class="cal-head">
        <view class="h" style="margin-bottom: 0">{{ ym.y }}年{{ ym.m + 1 }}月</view>
        <view class="cal-nav">
          <text class="cal-btn" @click="shiftMonth(-1)">‹ 上月</text>
          <text class="cal-btn" :class="{ dis: isCurMonth }" @click="shiftMonth(1)">下月 ›</text>
        </view>
      </view>
      <view class="cal-sub">本月打卡 {{ monthDays }} 天 · 共 {{ monthCount }} 题</view>
      <view class="cal-week">
        <text v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="cal-w">{{ w }}</text>
      </view>
      <view class="cal-grid">
        <view v-for="(c, i) in calCells" :key="i" class="cal-c" :class="c.cls">{{ c.d || '' }}</view>
      </view>
      <view class="cal-legend">
        <text class="lg"><text class="dot part" /> 1-9 题</text>
        <text class="lg"><text class="dot full" /> ≥10 题</text>
        <text class="lg"><text class="dot today" /> 今天</text>
      </view>
    </view>
    <button class="poster-btn" @click="openPoster">生成打卡海报</button>
  </view>
</template>

<script>
export default {
  data() {
    const now = new Date();
    return { pstats: { days: {} }, ym: { y: now.getFullYear(), m: now.getMonth() } };
  },
  computed: {
    isCurMonth() {
      const now = new Date();
      return this.ym.y === now.getFullYear() && this.ym.m === now.getMonth();
    },
    monthPrefix() {
      return `${this.ym.y}-${String(this.ym.m + 1).padStart(2, '0')}-`;
    },
    monthDays() {
      const days = this.pstats.days || {};
      return Object.keys(days).filter((k) => k.startsWith(this.monthPrefix) && days[k] > 0).length;
    },
    monthCount() {
      const days = this.pstats.days || {};
      return Object.keys(days)
        .filter((k) => k.startsWith(this.monthPrefix))
        .reduce((s, k) => s + (days[k] || 0), 0);
    },
    calCells() {
      const { y, m } = this.ym;
      const now = new Date();
      const first = new Date(y, m, 1);
      const lead = (first.getDay() + 6) % 7;
      const total = new Date(y, m + 1, 0).getDate();
      const days = this.pstats.days || {};
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push({ d: 0, cls: 'blank' });
      for (let d = 1; d <= total; d++) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const n = days[key] || 0;
        let cls = '';
        if (n >= 10) cls = 'full';
        else if (n > 0) cls = 'part';
        if (this.isCurMonth && d === now.getDate()) cls += ' today';
        cells.push({ d, cls });
      }
      return cells;
    },
  },
  onShow() {
    this.pstats = uni.getStorageSync('pstats') || { days: {} };
  },
  methods: {
    openPoster() {
      uni.navigateTo({ url: '/pkgA/social/poster' });
    },
    shiftMonth(dir) {
      if (dir > 0 && this.isCurMonth) return;
      let { y, m } = this.ym;
      m += dir;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      this.ym = { y, m };
    },
  },
};
</script>

<style scoped>
.wrap { padding: 24rpx; }
.poster-btn { margin-top: 24rpx; background: var(--brand); color: #fff; font-size: 28rpx; border-radius: 18rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 700; }
.cal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.cal-nav { display: flex; gap: 20rpx; }
.cal-btn { font-size: 24rpx; color: var(--brand); font-weight: 600; padding: 14rpx 8rpx; }
.cal-btn.dis { color: var(--ink-3); }
.cal-sub { font-size: 23rpx; color: var(--ink-2); margin-bottom: 18rpx; }
.cal-week { display: flex; margin-bottom: 8rpx; }
.cal-w { flex: 1; text-align: center; font-size: 20rpx; color: var(--ink-2); }
.cal-grid { display: flex; flex-wrap: wrap; }
.cal-c { width: 14.28%; height: 80rpx; line-height: 80rpx; text-align: center; font-size: 24rpx; color: var(--ink-2); box-sizing: border-box; border-radius: 50%; }
.cal-c.part { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
.cal-c.full { background: var(--brand); color: #fff; font-weight: 700; }
.cal-c.today { border: 2rpx solid var(--brand); }
.cal-legend { display: flex; gap: 26rpx; margin-top: 18rpx; }
.lg { font-size: 21rpx; color: var(--ink-2); display: flex; align-items: center; gap: 8rpx; }
.dot { width: 20rpx; height: 20rpx; border-radius: 50%; display: inline-block; }
.dot.part { background: var(--brand-soft); border: 1rpx solid var(--brand); }
.dot.full { background: var(--brand); }
.dot.today { border: 2rpx solid var(--brand); background: var(--card); }
</style>
