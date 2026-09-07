// KgChartBars：柱状趋势（正确率/速度/模考分/预测分历史），对齐 H5 stats.vue .trend / .trend7 两种形态。
// bars: [{ label?, value, pct(0-100 高度), tone: ''|'ok'|'warn'|'bad', text? }]，调用方在 ts 里算好 pct/tone；
// targetPct 给一条目标虚线（模考目标分）。
export interface BarItem {
  key?: string | number;
  label?: string;
  text?: string;
  pct: number;
  tone?: string;
}

Component({
  properties: {
    bars: { type: Array, value: [] as BarItem[] },
    height: { type: Number, value: 80 },
    labels: { type: Boolean, value: false },
    targetPct: { type: null, value: null },
    targetText: { type: String, value: '' },
    leftText: { type: String, value: '旧' },
    midText: { type: String, value: '' },
    rightText: { type: String, value: '新' },
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('bar', { index: Number(e.currentTarget.dataset.i) });
    },
  },
});
