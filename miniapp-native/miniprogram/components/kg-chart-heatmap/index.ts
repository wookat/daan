// KgChartHeatmap：近 12 周学习热力图（7 行 × 12 列），cols 由 utils/cn-date.buildHeatmap 算好（东八区日界）。
// 4 档只用品牌色透明度，深色自动跟随（与 H5 stats.vue 同）。
Component({
  properties: {
    cols: { type: Array, value: [] as Array<Array<{ lv: number; future: boolean }>> },
    total: { type: Number, value: 0 },
    note: { type: String, value: '统计练习/模考/复习作答' },
  },
  data: {
    yLabels: ['一', '', '三', '', '五', '', '日'],
    legend: [0, 1, 2, 3, 4],
  },
});
