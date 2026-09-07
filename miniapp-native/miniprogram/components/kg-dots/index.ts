// KgDots（v3）：格点进度——每格 = 1 题，结构本身承载「今日 N/目标」信息，取代大数字+渐变条。
// max ≤ 25 时一格一题；更大目标按比例折成 20 格（每格 = max/20 题），避免点过密。
Component({
  properties: {
    value: { type: Number, value: 0 },
    max: { type: Number, value: 20 },
    ariaLabel: { type: String, value: '今日进度' },
  },
  data: { cells: [] as boolean[], per: 1 },
  observers: {
    'value, max'(value: number, max: number) {
      const m = Math.max(1, max || 1);
      const n = m <= 25 ? m : 20;
      const per = m / n;
      const filled = Math.min(n, Math.floor(Math.max(0, value) / per + 1e-6));
      const cells: boolean[] = [];
      for (let i = 0; i < n; i++) cells.push(i < filled);
      this.setData({ cells, per });
    },
  },
});
