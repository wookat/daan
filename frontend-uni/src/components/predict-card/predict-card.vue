<template>
  <kg-card v-if="loading" variant="flat" class="pcard">
    <view class="p-head">
      <text class="p-title">能力预测分</text>
    </view>
    <view class="p-skel">
      <view class="p-skel-b lg" />
      <view class="p-skel-b" />
      <view class="p-skel-b sm" />
    </view>
  </kg-card>
  <kg-card v-else-if="data" variant="flat" class="pcard">
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
      <kg-echart v-if="data.history && data.history.length > 1" :option="historyOption" :height="130" />
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
  </kg-card>
</template>

<script>
import { request, anonUid } from '../../api.js';
import { visColors } from '../kg-echart/kg-echart.vue';

export default {
  name: 'PredictCard',
  data() {
    return { data: null, loading: true };
  },
  computed: {
    historyOption() {
      const c = visColors();
      const h = this.data && this.data.history;
      if (!h || h.length < 2) return {};
      const scores = h.map((x) => Math.round(x.score));
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const pad = Math.max((max - min) * 0.3, 5);
      return {
        animationDuration: 400,
        grid: { left: 8, right: 8, top: 22, bottom: 2, containLabel: true },
        xAxis: {
          type: 'category',
          data: h.map((x) => x.label),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: c.ink3, fontSize: 11 },
        },
        yAxis: { type: 'value', min: Math.max(min - pad, 0), max: max + pad, show: false },
        series: [{
          type: 'line',
          data: scores.map((s, i) => ({
            value: s,
            label: { show: true, position: 'top', color: i === scores.length - 1 ? c.brand : c.ink3, fontSize: 11, fontWeight: i === scores.length - 1 ? 600 : 400 },
            itemStyle: { color: i === scores.length - 1 ? c.brand : c.brandSoft2, borderColor: c.brand, borderWidth: i === scores.length - 1 ? 0 : 1 },
          })),
          smooth: true,
          symbolSize: 7,
          lineStyle: { color: c.brand, width: 2 },
          areaStyle: { color: c.brandSoft2, opacity: 0.35 },
        }],
      };
    },
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
  }
};
</script>

<style scoped>
.pcard { margin-bottom: var(--card-gap); }
.p-head { display: flex; justify-content: space-between; align-items: center; }
.p-title { font-size: var(--fs-body); font-weight: 600; color: var(--ink); }
.p-conf { font-size: var(--fs-caption); color: var(--ink-2); background: var(--fill); border-radius: var(--r-full); padding: 2px var(--sp-8); }
.p-hero { display: flex; align-items: flex-end; gap: var(--sp-12); margin: var(--sp-8) 0 var(--sp-4); }
.p-score-w { display: flex; align-items: baseline; }
.p-score { font-size: var(--fs-h1); font-weight: 600; color: var(--brand-text); line-height: 1; }
.p-unit { font-size: var(--fs-caption); color: var(--ink-2); margin-left: var(--sp-4); }
.p-meta { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: var(--sp-4); }
.p-delta { font-size: var(--fs-caption); color: var(--ok-strong); font-weight: 600; }
.p-delta.down { color: var(--bad-strong); }
.p-n { font-size: var(--fs-caption); color: var(--ink-3); }
.p-mods { margin-top: var(--sp-8); display: flex; flex-direction: column; gap: var(--sp-8); }
.p-mod { display: flex; align-items: center; gap: var(--sp-8); }
.p-mod-n { width: 60px; font-size: var(--fs-caption); color: var(--ink-2); }
.p-mod-bar { flex: 1; height: var(--sp-8); background: var(--fill); border-radius: var(--r-full); overflow: hidden; }
.p-mod-fill { height: 100%; background: var(--brand); border-radius: var(--r-full); }
.p-mod-s { width: 50px; text-align: right; font-size: var(--fs-caption); color: var(--ink); font-weight: 600; }
.p-mod-mx { font-size: var(--fs-caption); color: var(--ink-3); font-weight: 400; }
.p-mod-t { width: 16px; text-align: center; font-size: var(--fs-caption); color: var(--ink-3); }
.p-mod-t.up { color: var(--ok-strong); }
.p-mod-t.down { color: var(--bad-strong); }
.p-skel { display: flex; flex-direction: column; gap: var(--sp-8); margin-top: var(--sp-8); }
.p-skel-b { height: var(--sp-12); border-radius: var(--r-xs); background: var(--fill); width: 70%; animation: p-skel-pulse 1.2s ease-in-out infinite; }
.p-skel-b.lg { height: 30px; width: 40%; }
.p-skel-b.sm { width: 50%; }
@keyframes p-skel-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.p-cold { display: flex; flex-direction: column; gap: var(--sp-4); }
.p-cold-t { font-size: var(--fs-h3); font-weight: 600; color: var(--ink); margin-top: var(--sp-4); }
.p-cold-s { font-size: var(--fs-caption); color: var(--ink-2); }
.p-cold-bar { height: 6px; background: var(--fill); border-radius: var(--r-full); overflow: hidden; margin-top: var(--sp-4); }
.p-cold-fill { height: 100%; background: var(--brand); border-radius: var(--r-full); }
</style>
