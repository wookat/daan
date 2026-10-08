<template>
  <view class="kg-echart" :style="{ height: px(height) }" ref="el"></view>
</template>

<script>
// ECharts 按需引入（core + 用到的图型/组件 + canvas 渲染）。
// 统一 VIS 口径：色板/字号走 token 变量，页面只传数据语义。
import * as echarts from 'echarts/core';
import { BarChart, LineChart, RadarChart, HeatmapChart } from 'echarts/charts';
import {
  GridComponent, TooltipComponent, LegendComponent,
  VisualMapComponent, DataZoomComponent,
  MarkLineComponent, MarkPointComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, LineChart, RadarChart, HeatmapChart,
  GridComponent, TooltipComponent, LegendComponent,
  VisualMapComponent, DataZoomComponent,
  MarkLineComponent, MarkPointComponent, CanvasRenderer,
]);

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

// 供 option 工厂复用的 VIS 调色板（构建期取不到 CSS 变量时回退到 tokens 源值）
export function visColors() {
  return {
    brand: cssVar('--brand', '#2e5bff'),
    brandSoft2: cssVar('--brand-soft-2', '#dbe6ff'),
    ink: cssVar('--ink', '#17181c'),
    ink2: cssVar('--ink-2', '#40434e'),
    ink3: cssVar('--ink-3', '#6b7280'),
    line: cssVar('--line', '#e7e9f0'),
    fill: cssVar('--fill', '#f2f3f7'),
    card: cssVar('--card', '#ffffff'),
    ok: cssVar('--ok', '#16a34a'),
    warn: cssVar('--warn', '#d97706'),
    bad: cssVar('--bad', '#dc2626'),
    lvUntouched: cssVar('--lv-untouched', '#b0b4c0'),
    lvRumen: cssVar('--lv-rumen', '#d97706'),
    lvGonggu: cssVar('--lv-gonggu', '#2e5bff'),
    lvShulian: cssVar('--lv-shulian', '#7c3aed'),
    lvJingtong: cssVar('--lv-jingtong', '#16a34a'),
  };
}

export default {
  name: 'kg-echart',
  props: {
    option: { type: Object, required: true },
    height: { type: [Number, String], default: 220 },
  },
  data() {
    return { chart: null };
  },
  watch: {
    option: {
      deep: true,
      handler(v) {
        if (this.chart && v) this.chart.setOption(v, { notMerge: true });
      },
    },
  },
  mounted() {
    const el = this.$refs.el && this.$refs.el.$el ? this.$refs.el.$el : this.$refs.el;
    if (!el) return;
    this.chart = echarts.init(el);
    this.chart.on('click', (p) => this.$emit('select', p));
    if (this.option) this.chart.setOption(this.option);
    this._ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.chart && this.chart.resize())
      : null;
    if (this._ro) this._ro.observe(el);
  },
  beforeUnmount() {
    if (this._ro) this._ro.disconnect();
    if (this.chart) {
      this.chart.dispose();
      this.chart = null;
    }
  },
  methods: {
    px(h) {
      return typeof h === 'number' ? h + 'px' : h;
    },
    resize() {
      if (this.chart) this.chart.resize();
    },
  },
};
</script>

<style scoped>
.kg-echart { width: 100%; display: block; }
</style>
