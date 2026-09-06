// KgActionBar 小程序版（COMPONENTS §1.7）：固定底栏 layout=actions/answer/input；answer 顶部 2px 进度线 + 序号。
Component({
  properties: {
    layout: { type: String, value: 'actions' },
    primaryText: { type: String, value: '' },
    secondaryText: { type: String, value: '' },
    index: { type: Number, value: 0 },
    total: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false },
  },
  data: { pct: 0 },
  observers: {
    'index, total'(index: number, total: number) {
      this.setData({ pct: total > 0 ? Math.round(((index + 1) / total) * 100) : 0 });
    },
  },
  methods: {
    onPrimary() { this.triggerEvent('primary'); },
    onSecondary() { this.triggerEvent('secondary'); },
  },
});
