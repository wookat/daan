// kg-ec：ECharts 容器组件（住 pkgGrow，与 ec-canvas/echarts.js 同分包可互相 require）。
// 页面只传 JSON option（option 属性）+ 高度，图表构建/更新/事件都在此封装；
// 跨分包页面经 componentPlaceholder 异步引用，option 到齐前 view 占位。
// ec-canvas/echarts 是 vendor .js（不入 ts 编译），require 走同分包内路径。
const echarts: any = require('../ec-canvas/echarts.js');

Component({
  properties: {
    option: {
      type: Object,
      value: null as any,
      observer(this: any, o: any) { if (o && this._chart) this._chart.setOption(o, true); },
    },
    height: { type: Number, value: 160 },
    cid: { type: String, value: '' },
  },
  data: { ec: null as any },
  lifetimes: {
    attached(this: any) {
      const self = this;
      // ec.onInit 必须在 ec-canvas ready() 读 this.data.ec 之前就位；
      // attached 时子组件尚未 created，绑定值随渲染传给子组件，时序确定
      self.setData({
        ec: {
          onInit(canvas: any, w: number, h: number, dpr: number) {
            const chart = echarts.init(canvas, null, { width: w, height: h, devicePixelRatio: dpr });
            canvas.setChart(chart);
            self._chart = chart;
            chart.on('click', (p: any) => self.triggerEvent('pointclick', { dataIndex: p.dataIndex, seriesIndex: p.seriesIndex }));
            if (self.data.option) chart.setOption(self.data.option);
            return chart;
          },
        },
      });
    },
    detached(this: any) { if (this._chart) { this._chart.dispose(); this._chart = null; } },
  },
});
