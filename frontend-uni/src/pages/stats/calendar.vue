<template>
  <view class="wrap">
    <view class="cd-cols">
    <view class="cd-main">
    <view class="card">
      <view class="cal-head">
        <view class="cal-title">
          <text class="cal-btn" @click="shiftMonth(-1)">‹</text>
          <view class="h" style="margin-bottom: 0">{{ ym.y }} 年 {{ ym.m + 1 }} 月</view>
          <text class="cal-btn" :class="{ dis: isCurMonth }" @click="shiftMonth(1)">›</text>
        </view>
        <text class="cal-badge">本月打卡 {{ monthDays }} 天</text>
      </view>
      <view class="cal-sub">本月共练 {{ monthCount }} 题</view>
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
    </view>

    <view class="cd-side">
    <view v-if="badgeInfo" class="card ms">
      <view class="ms-h">
        <view class="h" style="margin-bottom: 0">连签里程碑</view>
        <text class="ms-best">历史最长 {{ badgeInfo.best_streak }} 天</text>
      </view>
      <view class="ms-cur">🔥 当前连续打卡 <text class="ms-n">{{ badgeInfo.streak }}</text> 天</view>
      <template v-if="nextMilestone">
        <view class="ms-bar"><view class="ms-fill" :style="{ width: nextMilestone.pct + '%' }" /></view>
        <view class="ms-sub">再打卡 <text class="ms-left">{{ nextMilestone.left }}</text> 天解锁「{{ nextMilestone.days }} 天」徽章</view>
      </template>
      <view v-else class="ms-sub">已解锁全部打卡徽章，太强了！</view>
      <view class="ms-dots">
        <view v-for="b in badgeInfo.badges" :key="b.days" class="ms-dot" :class="{ on: b.unlocked }">
          <text class="ms-dot-i">{{ b.unlocked ? '🏅' : '🔒' }}</text>
          <text class="ms-dot-d">{{ b.days }}天</text>
        </view>
      </view>
    </view>
    <button class="poster-btn" @click="openPoster">生成打卡海报</button>
    </view>
    </view>
  </view>
</template>

<script>
import { fetchCheckinBadges, fetchCheckinSummary } from '../../api.js';

export default {
  data() {
    const now = new Date();
    return { pstats: { days: {} }, ym: { y: now.getFullYear(), m: now.getMonth() }, badgeInfo: null, svDays: null };
  },
  computed: {
    isCurMonth() {
      const now = new Date();
      return this.ym.y === now.getFullYear() && this.ym.m === now.getMonth();
    },
    monthPrefix() {
      return `${this.ym.y}-${String(this.ym.m + 1).padStart(2, '0')}-`;
    },
    dayMap() {
      // 服务端 answer_log（Asia/Shanghai 日界）优先，未返回时降级本地 pstats
      if (this.svDays) {
        const m = {};
        for (const [k, v] of Object.entries(this.svDays)) m[k] = (v && v.n) || 0;
        return m;
      }
      return this.pstats.days || {};
    },
    monthDays() {
      const days = this.dayMap;
      return Object.keys(days).filter((k) => k.startsWith(this.monthPrefix) && days[k] > 0).length;
    },
    monthCount() {
      const days = this.dayMap;
      return Object.keys(days)
        .filter((k) => k.startsWith(this.monthPrefix))
        .reduce((s, k) => s + (days[k] || 0), 0);
    },
    nextMilestone() {
      if (!this.badgeInfo) return null;
      const ms = (this.badgeInfo.badges || []).map((b) => b.days);
      const s = this.badgeInfo.streak || 0;
      const next = ms.find((m) => m > s);
      if (!next) return null;
      const prev = ms.filter((m) => m <= s).pop() || 0;
      return { days: next, left: next - s, pct: Math.round(((s - prev) / (next - prev)) * 100) };
    },
    calCells() {
      const { y, m } = this.ym;
      const now = new Date();
      const first = new Date(y, m, 1);
      const lead = (first.getDay() + 6) % 7;
      const total = new Date(y, m + 1, 0).getDate();
      const days = this.dayMap;
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
    this.loadBadges();
    this.loadDays();
  },
  methods: {
    async loadBadges() {
      try {
        this.badgeInfo = await fetchCheckinBadges();
      } catch (e) { /* 非关键路径 */ }
    },
    async loadDays() {
      try {
        const d = await fetchCheckinSummary();
        if (d && d.days) this.svDays = d.days;
      } catch (e) { /* 非关键路径，降级本地 pstats */ }
    },
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
.ms { margin-top: 24rpx; }
.ms-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.ms-best { font-size: 24rpx; color: var(--ink-2); }
.ms-cur { font-size: 26rpx; color: var(--ink-1, #1f2430); }
.ms-n { font-size: 34rpx; font-weight: 800; color: #d97706; }
.ms-bar { height: 14rpx; background: var(--line); border-radius: 999rpx; margin-top: 14rpx; overflow: hidden; }
.ms-fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #d97706); border-radius: 999rpx; }
.ms-sub { font-size: 24rpx; color: var(--ink-2); margin-top: 10rpx; }
.ms-left { color: #d97706; font-weight: 700; }
.ms-dots { display: flex; justify-content: space-between; margin-top: 20rpx; }
.ms-dot { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.ms-dot-i { font-size: 30rpx; opacity: 0.45; }
.ms-dot.on .ms-dot-i { opacity: 1; }
.ms-dot-d { font-size: 24rpx; color: var(--ink-2); }
.poster-btn { margin-top: 24rpx; background: var(--brand); color: #fff; font-size: 28rpx; border-radius: 18rpx; }
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.h { font-size: 30rpx; font-weight: 700; }
.cal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.cal-title { display: flex; align-items: center; gap: 16rpx; }
.cal-badge { font-size: 24rpx; color: #166534; background: var(--ok-soft, #dcfce7); border-radius: 8rpx; padding: 4rpx 14rpx; }
.cal-btn { font-size: 30rpx; color: var(--brand-text); font-weight: 600; min-width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; }
.cal-btn.dis { color: var(--ink-3); }
.cal-sub { font-size: 24rpx; color: var(--ink-2); margin-bottom: 18rpx; }
.cal-week { display: flex; margin-bottom: 8rpx; }
.cal-w { flex: 1; text-align: center; font-size: 24rpx; color: var(--ink-2); }
.cal-grid { display: flex; flex-wrap: wrap; }
.cal-c { width: 14.28%; height: 80rpx; line-height: 80rpx; text-align: center; font-size: 24rpx; color: var(--ink-2); box-sizing: border-box; border-radius: 50%; }
.cal-c.part { background: var(--brand-soft); color: var(--brand-text); font-weight: 600; }
.cal-c.full { background: var(--brand); color: #fff; font-weight: 700; }
.cal-c.today { border: 2rpx solid var(--brand); }
.cal-legend { display: flex; gap: 26rpx; margin-top: 18rpx; }
.lg { font-size: 24rpx; color: var(--ink-2); display: flex; align-items: center; gap: 8rpx; }
.dot { width: 20rpx; height: 20rpx; border-radius: 50%; display: inline-block; }
.dot.part { background: var(--brand-soft); border: 1rpx solid var(--brand); }
.dot.full { background: var(--brand); }
.dot.today { border: 2rpx solid var(--brand); background: var(--card); }

/* #ifdef H5 */
@media (min-width: 768px) {
  .wrap { max-width: 1044px; margin: 0 auto; }
  .cal-btn:hover, .poster-btn:hover, .cal-btn.dis:hover { cursor: pointer; }
}

@media (min-width: 1024px) {
  .cd-cols { display: flex; gap: 32rpx; align-items: flex-start; }
  .cd-main { flex: 1; min-width: 0; }
  .cd-side { width: 420px; flex: none; position: sticky; top: 24rpx; }
  .cd-side .ms { margin-top: 0; }
}
/* #endif */
</style>
