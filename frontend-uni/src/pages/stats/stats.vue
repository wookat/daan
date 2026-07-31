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
      <view class="cal-head">
        <view class="h" style="margin-bottom: 0">学习日历</view>
        <text class="cal-sub">本月打卡 {{ monthDays }} 天</text>
      </view>
      <view class="cal-week">
        <text v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="cal-w">{{ w }}</text>
      </view>
      <view class="cal-grid">
        <view v-for="(c, i) in calCells" :key="i" class="cal-c" :class="c.cls">{{ c.d || '' }}</view>
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

    <view v-if="trendHas" class="card">
      <view class="h">近 7 日正确率</view>
      <view class="trend">
        <view v-for="t in trend" :key="t.key" class="tcol">
          <text class="tpct">{{ t.done ? t.pct + '%' : '' }}</text>
          <view class="tbar">
            <view class="tfill" :class="{ lo: t.done && t.pct < 60 }" :style="{ height: (t.done ? Math.max(t.pct, 6) : 0) + '%' }" />
          </view>
          <text class="tday">{{ t.label }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <view class="h">错题模块分布</view>
      <view v-if="!byModule.length" class="spin">暂无数据</view>
      <view v-for="m in byModule" :key="m.module" class="brow" @click="goPractice(m.module)">
        <view class="blabel">
          <text>{{ m.module || '未知' }}</text>
          <text class="n">×{{ m.n }} 去练 ›</text>
        </view>
        <view class="bar">
          <view class="fill" :class="sevClass(m.n)" :style="{ width: (m.n / total) * 100 + '%' }" />
        </view>
      </view>
    </view>
    <view v-if="byReason.length" class="card">
      <view class="h">错因分布</view>
      <view v-for="r in byReason" :key="r.error_reason" class="brow">
        <view class="blabel">
          <text>{{ r.error_reason }}</text>
          <text class="n">×{{ r.n }}</text>
        </view>
        <view class="bar">
          <view class="fill rz" :style="{ width: (r.n / reasonTotal) * 100 + '%' }" />
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
    return { byModule: [], byType: [], byReason: [], pstats: { byModule: {}, days: {} } };
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
    trend() {
      const days = this.pstats.days || {};
      const dc = this.pstats.daysCorrect || {};
      const out = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const done = days[key] || 0;
        out.push({
          key,
          label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
          done,
          pct: done ? Math.round(((dc[key] || 0) / done) * 100) : 0,
        });
      }
      return out;
    },
    trendHas() {
      return this.trend.some((t) => t.done > 0);
    },
    reasonTotal() {
      return this.byReason.reduce((s, r) => s + r.n, 0) || 1;
    },
    monthDays() {
      const now = new Date();
      const pre = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
      return Object.keys(this.pstats.days || {}).filter((k) => k.startsWith(pre) && this.pstats.days[k] > 0).length;
    },
    calCells() {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
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
        if (d === now.getDate()) cls += ' today';
        cells.push({ d, cls });
      }
      return cells;
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
    goPractice(mod) {
      const KEY = { '资料分析': 'ziliao', '数量关系': 'shuliang', '言语理解': 'yanyu', '判断推理': 'panduan', '常识判断': 'changshi' };
      const k = KEY[mod] || (Object.values(KEY).includes(mod) ? mod : '');
      if (k) uni.setStorageSync('practiceModule', k);
      uni.switchTab({ url: '/pages/practice/practice' });
    },
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
        this.byReason = d.by_reason || [];
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
.fill.rz { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.trend { display: flex; align-items: flex-end; gap: 12rpx; height: 220rpx; padding-top: 8rpx; }
.tcol { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.tpct { font-size: 18rpx; color: var(--brand); height: 28rpx; }
.tbar { flex: 1; width: 36rpx; background: var(--soft-bg); border-radius: 999rpx; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.tfill { width: 100%; background: linear-gradient(180deg, #6366f1, #4f46e5); border-radius: 999rpx; }
.tfill.lo { background: linear-gradient(180deg, #fbbf24, #f59e0b); }
.tday { font-size: 19rpx; color: var(--ink-2); margin-top: 8rpx; }
.cal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.cal-sub { font-size: 22rpx; color: var(--ink-2); }
.cal-week { display: flex; margin-bottom: 8rpx; }
.cal-w { flex: 1; text-align: center; font-size: 20rpx; color: var(--ink-2); }
.cal-grid { display: flex; flex-wrap: wrap; }
.cal-c { width: 14.28%; height: 64rpx; line-height: 64rpx; text-align: center; font-size: 22rpx; color: var(--ink-2); box-sizing: border-box; border-radius: 50%; }
.cal-c.part { background: var(--brand-soft); color: var(--brand); font-weight: 600; }
.cal-c.full { background: var(--brand); color: #fff; font-weight: 700; }
.cal-c.today { border: 2rpx solid var(--brand); }
.n { color: var(--brand); font-weight: 600; }
</style>
