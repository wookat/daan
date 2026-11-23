<template>
  <view class="kg-echart" :style="{ height: px(height) }" ref="el"></view>
</template>

<script>
// ECharts 懒加载（core + 仅实际用到的 3 种图型与 3 个组件 + canvas 渲染），避免首屏同步打包与解析。
import { visColors } from '../../utils/vis-colors.js';

export { visColors };

let _echartsMod = null;
function loadEcharts() {
  if (_echartsMod) return Promise.resolve(_echartsMod);
  return import('../../utils/echarts-lite.js').then((m) => {
    _echartsMod = m;
    return m;
  });
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
        this._apply(v);
      },
    },
  },
  mounted() {
    const el = this.$refs.el && this.$refs.el.$el ? this.$refs.el.$el : this.$refs.el;
    if (!el) return;
    this._disposed = false;
    loadEcharts()
      .then((m) => {
        if (this._disposed || !el) return;
        try {
          this.chart = m.init(el);
          this.chart.on('click', (p) => this.$emit('select', p));
        } catch (e) {
          this.chart = null;
          return;
        }
        this._apply(this.option);
        this.$nextTick(() => {
          if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => this.resize());
          } else {
            this.resize();
          }
        });
        this._ro = typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => this.resize())
          : null;
        if (this._ro) this._ro.observe(el);
      })
      .catch(() => {
        this.chart = null;
      });
  },
  beforeUnmount() {
    this._disposed = true;
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
    _apply(v) {
      // 空 option / 瞬时渲染异常只静默跳过——单张图失败不许拖垮整卡
      if (!this.chart || !v || !v.series || !v.series.length) return;
      try {
        this.chart.setOption(v, { notMerge: true });
      } catch (e) { /* noop */ }
    },
    resize() {
      try { if (this.chart) this.chart.resize(); } catch (e) { /* noop */ }
    },
  },
};
</script>

<style scoped>
.kg-echart { width: 100%; display: block; }
</style>
