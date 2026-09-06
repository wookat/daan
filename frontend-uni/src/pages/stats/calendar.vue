<template>
  <view class="wrap cal-page">
    <kg-two-col>
      <template #main>
        <kg-card class="calcard">
          <view class="cal-head">
            <view class="cal-title">
              <view class="cal-btn" role="button" aria-label="上个月" hover-class="cal-btn--hover" @click="shiftMonth(-1)"><l-icon name="chevron-left" :size="20" tone="brand-text" /></view>
              <text class="cal-ym num">{{ ym.y }} 年 {{ ym.m + 1 }} 月</text>
              <view class="cal-btn" :class="{ dis: isCurMonth }" role="button" aria-label="下个月" :aria-disabled="String(isCurMonth)" hover-class="cal-btn--hover" @click="shiftMonth(1)"><l-icon name="chevron-right" :size="20" :tone="isCurMonth ? 'faint' : 'brand-text'" /></view>
            </view>
            <kg-tag tone="ok">本月打卡 {{ monthDays }} 天</kg-tag>
          </view>
          <text class="cal-sub">本月共练 {{ monthCount }} 题</text>
          <view class="cal-week">
            <text v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="cal-w">{{ w }}</text>
          </view>
          <view class="cal-grid">
            <view v-for="(c, i) in calCells" :key="i" class="cal-cell"><view class="cal-c num" :class="c.cls">{{ c.d || '' }}</view></view>
          </view>
          <view class="cal-legend">
            <text class="lg"><text class="dot part" /> 1-9 题</text>
            <text class="lg"><text class="dot full" /> ≥10 题</text>
            <text class="lg"><text class="dot today" /> 今天</text>
          </view>
        </kg-card>
      </template>

      <template #aside>
        <kg-skeleton v-if="badgeInfo === null" preset="lines" />
        <kg-card v-else class="ms">
          <view class="ms-h">
            <text class="ms-t">连签里程碑</text>
            <text class="ms-best">历史最长 <text class="num">{{ badgeInfo.best_streak }}</text> 天</text>
          </view>
          <view class="ms-cur">
            <kg-streak-badges :days="badgeInfo.streak || 0" />
            <text class="ms-cur-t">当前连续打卡</text>
          </view>
          <template v-if="nextMilestone">
            <kg-progress :value="nextMilestone.pct" :thickness="8" class="ms-bar" :aria-label="`距下一个徽章 ${nextMilestone.pct}%`" />
            <text class="ms-sub">再打卡 <text class="ms-left num">{{ nextMilestone.left }}</text> 天解锁「{{ nextMilestone.days }} 天」徽章</text>
          </template>
          <text v-else class="ms-sub">已解锁全部打卡徽章，太强了！</text>
          <view class="ms-dots">
            <view v-for="b in badgeInfo.badges" :key="b.days" class="ms-dot" :class="{ on: b.unlocked }">
              <view class="ms-dot-i"><l-icon name="medal" :size="20" :tone="b.unlocked ? 'streak' : 'faint'" /></view>
              <text class="ms-dot-d num">{{ b.days }}天</text>
            </view>
          </view>
        </kg-card>
        <view class="poster">
          <kg-button variant="primary" size="lg" block icon="share-2" :disabled="!canPoster" @click="openPoster">生成打卡海报</kg-button>
          <text v-if="!canPoster" class="poster-tip">今天先练 1 题打上卡，再来生成海报</text>
        </view>
      </template>
    </kg-two-col>
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
    /** 0 天（从未打卡）时海报无内容可生成：按钮 disabled + 说明 */
    canPoster() {
      const days = this.dayMap;
      if (Object.keys(days).some((k) => days[k] > 0)) return true;
      return !!(this.badgeInfo && (this.badgeInfo.streak || this.badgeInfo.best_streak));
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
      } catch (e) {
        // 非关键路径：请求失败时用空徽章数据渲染，避免辅栏一直骨架
        if (this.badgeInfo === null) this.badgeInfo = { streak: 0, best_streak: 0, badges: [] };
      }
    },
    async loadDays() {
      try {
        const d = await fetchCheckinSummary();
        if (d && d.days) this.svDays = d.days;
      } catch (e) { /* 非关键路径，降级本地 pstats */ }
    },
    openPoster() {
      if (!this.canPoster) return;
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
.wrap { padding: var(--sp-16) var(--page-x) var(--sp-40); }

/* 月历 */
.cal-head { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-8); margin-bottom: var(--sp-4); }
.cal-title { display: flex; align-items: center; gap: var(--sp-4); }
.cal-ym { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); line-height: var(--lh-h3); }
.cal-btn { width: var(--hit-min); height: var(--hit-min); display: flex; align-items: center; justify-content: center; border-radius: var(--r-full); }
.cal-btn--hover { background: var(--fill); }
.cal-btn.dis { pointer-events: none; }
.cal-sub { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin-bottom: var(--sp-16); }
.cal-week { display: flex; margin-bottom: var(--sp-8); }
.cal-w { flex: 1; text-align: center; font-size: var(--fs-caption); color: var(--ink-3); }
.cal-grid { display: flex; flex-wrap: wrap; }
.cal-cell { width: 14.28%; height: var(--hit-min); display: flex; align-items: center; justify-content: center; }
.cal-c { width: 36px; height: 36px; line-height: 36px; text-align: center; font-size: var(--fs-sub); color: var(--ink-2); box-sizing: border-box; border-radius: var(--r-full); }
.cal-c.part { background: var(--brand-soft-2); color: var(--brand-text); font-weight: 600; }
.cal-c.full { background: var(--brand); color: var(--on-brand); font-weight: 600; }
.cal-c.today { border: 2px solid var(--brand); }
.cal-legend { display: flex; flex-wrap: wrap; gap: var(--sp-8) var(--sp-16); margin-top: var(--sp-16); }
.lg { font-size: var(--fs-caption); color: var(--ink-3); display: inline-flex; align-items: center; gap: var(--sp-4); }
.dot { width: 10px; height: 10px; border-radius: var(--r-full); display: inline-block; }
.dot.part { background: var(--brand-soft-2); }
.dot.full { background: var(--brand); }
.dot.today { border: 2px solid var(--brand); background: var(--card); box-sizing: border-box; }

/* 连签里程碑 */
.ms-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--sp-12); }
.ms-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); }
.ms-best { font-size: var(--fs-caption); color: var(--ink-3); }
.ms-cur { display: flex; align-items: center; gap: var(--sp-8); }
.ms-cur-t { font-size: var(--fs-sub); color: var(--ink-2); }
.ms-bar { margin-top: var(--sp-12); }
.ms-sub { display: block; font-size: var(--fs-sub); color: var(--ink-3); margin-top: var(--sp-8); line-height: var(--lh-sub); }
.ms-left { color: var(--streak); font-weight: 600; }
.ms-dots { display: flex; justify-content: space-between; margin-top: var(--sp-16); }
.ms-dot { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.ms-dot-i { width: 32px; height: 32px; border-radius: var(--r-full); background: var(--fill); display: flex; align-items: center; justify-content: center; }
.ms-dot.on .ms-dot-i { background: var(--streak-soft); }
.ms-dot-d { font-size: var(--fs-caption); color: var(--ink-3); }
.ms-dot.on .ms-dot-d { color: var(--ink); }

.poster { margin-top: var(--sp-16); display: grid; gap: var(--sp-8); }
.poster-tip { text-align: center; font-size: var(--fs-caption); color: var(--ink-3); }

/* #ifdef H5 */
@media (min-width: 1024px) {
  .wrap.cal-page { max-width: 1064px; }
  .ms { margin-top: 0; }
}
/* #endif */
</style>
