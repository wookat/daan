<template>
  <view class="wrap">
    <view class="card ov">
      <view class="ovi">
        <text class="ovn">{{ totalDone }}</text>
        <text class="ovt">累计刷题</text>
      </view>
      <view class="ovi">
        <text class="ovn">{{ accPct }}%</text>
        <text class="ovt">总正确率</text>
      </view>
      <view class="ovi">
        <text class="ovn">{{ streakDays }}</text>
        <text class="ovt">连续打卡(天)</text>
      </view>
    </view>

    <view class="card">
      <view class="h">五模块能力雷达</view>
      <view v-if="!hasRadar" class="spin">刷题后生成你的能力画像</view>
      <view v-else class="radar-box">
        <view class="radar">
          <view v-for="i in 4" :key="'g' + i" class="ring" :style="ringStyle(i)" />
          <view class="poly" :style="polyStyle" />
          <view v-for="(a, i) in axes" :key="a.key" class="axis-label" :style="labelStyle(i)">
            <text class="al-name">{{ a.name }}</text>
            <text class="al-val">{{ a.pct }}%</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="h">错题模块分布</view>
      <view v-if="!byModule.length" class="spin">暂无数据</view>
      <view v-for="m in byModule" :key="m.module" class="brow">
        <view class="blabel">
          <text>{{ m.module || '未知' }}</text>
          <text class="n">×{{ m.n }}</text>
        </view>
        <view class="bar">
          <view class="fill" :class="sevClass(m.n)" :style="{ width: (m.n / total) * 100 + '%' }" />
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

const MODS = [
  { key: 'ziliao', name: '资料' },
  { key: 'shuliang', name: '数量' },
  { key: 'yanyu', name: '言语' },
  { key: 'panduan', name: '判断' },
  { key: 'changshi', name: '常识' },
];

export default {
  data() {
    return { byModule: [], byType: [], pstats: { byModule: {}, days: {} } };
  },
  computed: {
    total() {
      return this.byModule.reduce((s, m) => s + m.n, 0) || 1;
    },
    totalDone() {
      return Object.values(this.pstats.byModule).reduce((s, m) => s + m.done, 0);
    },
    accPct() {
      const done = this.totalDone;
      if (!done) return 0;
      const c = Object.values(this.pstats.byModule).reduce((s, m) => s + m.correct, 0);
      return Math.round((c / done) * 100);
    },
    streakDays() {
      const days = this.pstats.days || {};
      let n = 0;
      const d = new Date();
      for (;;) {
        const key = d.toISOString().slice(0, 10);
        if (days[key]) {
          n++;
          d.setDate(d.getDate() - 1);
        } else if (n === 0 && key === new Date().toISOString().slice(0, 10)) {
          d.setDate(d.getDate() - 1);
        } else break;
      }
      return n;
    },
    axes() {
      return MODS.map((m) => {
        const s = this.pstats.byModule[m.key] || { done: 0, correct: 0 };
        return { ...m, pct: s.done ? Math.round((s.correct / s.done) * 100) : 0 };
      });
    },
    hasRadar() {
      return this.axes.some((a) => a.pct > 0);
    },
    polyStyle() {
      const pts = this.axes.map((a, i) => {
        const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const r = (a.pct / 100) * 50;
        return `${50 + r * Math.cos(ang)}% ${50 + r * Math.sin(ang)}%`;
      });
      return { clipPath: `polygon(${pts.join(',')})` };
    },
  },
  onShow() {
    this.pstats = uni.getStorageSync('pstats') || { byModule: {}, days: {} };
    this.load();
  },
  methods: {
    ringStyle(i) {
      const size = i * 25;
      return { width: size + '%', height: size + '%', left: (100 - size) / 2 + '%', top: (100 - size) / 2 + '%' };
    },
    labelStyle(i) {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return {
        left: 50 + 58 * Math.cos(ang) + '%',
        top: 50 + 58 * Math.sin(ang) + '%',
      };
    },
    sevClass(n) {
      const pct = n / this.total;
      if (pct > 0.4) return 'sev-hi';
      if (pct > 0.2) return 'sev-mid';
      return '';
    },
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
.card { background: var(--card); border-radius: var(--radius); padding: 24rpx; margin-bottom: 24rpx; border: 1rpx solid var(--line); box-shadow: 0 4rpx 16rpx rgba(31, 36, 48, 0.05); }
.ov { display: flex; }
.ovi { flex: 1; text-align: center; }
.ovn { display: block; font-size: 48rpx; font-weight: 700; color: var(--ink); }
.ovt { display: block; font-size: 22rpx; color: var(--ink-2); margin-top: 6rpx; }
.h { font-size: 28rpx; font-weight: 600; margin-bottom: 14rpx; }
.spin { text-align: center; color: var(--ink-2); font-size: 26rpx; padding: 20rpx; }
.radar-box { display: flex; justify-content: center; padding: 40rpx 0 30rpx; }
.radar { position: relative; width: 380rpx; height: 380rpx; }
.ring { position: absolute; border: 1rpx solid var(--line); border-radius: 50%; box-sizing: border-box; }
.poly { position: absolute; inset: 0; background: rgba(79, 70, 229, 0.35); border-radius: 2rpx; }
.axis-label { position: absolute; transform: translate(-50%, -50%); text-align: center; white-space: nowrap; }
.al-name { display: block; font-size: 23rpx; color: var(--ink); font-weight: 600; }
.al-val { display: block; font-size: 20rpx; color: var(--brand); }
.brow { margin: 14rpx 0; }
.blabel { display: flex; justify-content: space-between; font-size: 26rpx; color: var(--ink); margin-bottom: 6rpx; }
.bar { background: var(--brand-soft); border-radius: 999rpx; height: 20rpx; position: relative; overflow: hidden; }
.fill { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #6366f1, #4f46e5); border-radius: 999rpx; transition: width 0.6s ease; }
.fill.sev-hi { background: linear-gradient(90deg, #f87171, #ef4444); }
.fill.sev-mid { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.tline { font-size: 26rpx; margin: 8rpx 0; }
.n { color: var(--brand); font-weight: 600; }
</style>
