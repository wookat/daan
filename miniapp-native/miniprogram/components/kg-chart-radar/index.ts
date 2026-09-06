// KgChartRadar：N 轴能力雷达（纯 view + clip-path polygon，与 H5 stats.vue 同实现，零依赖不占分包体积；
// 颜色全走 token，深色自动跟随，这是不用 canvas 手绘的原因——canvas 无法读 CSS 变量）。
export interface RadarAxis {
  key: string;
  name: string;
  pct: number;
}

interface LabelPos extends RadarAxis {
  style: string;
}

const LABEL_PAD = 30;
const LABEL_GAP = 14;

Component({
  properties: {
    axes: { type: Array, value: [] as RadarAxis[] },
    size: { type: Number, value: 160 },
  },
  data: {
    rings: [] as string[],
    polyStyle: '',
    labels: [] as LabelPos[],
    boxStyle: '',
    plotStyle: '',
  },
  observers: {
    'axes, size'(axes: RadarAxis[], size: number) {
      const n = axes.length || 1;
      const pts = axes.map((a, i) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = (Math.max(0, Math.min(100, a.pct)) / 100) * 50;
        return `${(50 + r * Math.cos(ang)).toFixed(2)}% ${(50 + r * Math.sin(ang)).toFixed(2)}%`;
      });
      const rings = [1, 2, 3, 4].map((i) => {
        const s = i * 25;
        return `width:${s}%;height:${s}%;left:${(100 - s) / 2}%;top:${(100 - s) / 2}%`;
      });
      // 标签留在盒内：绘图区向内缩 LABEL_PAD，标签放在绘图半径外 LABEL_GAP 处（px 定位，不随百分比溢出）
      const plotR = Math.max(24, size / 2 - LABEL_PAD);
      const labR = plotR + LABEL_GAP;
      const c = size / 2;
      const labels = axes.map((a, i) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        return { ...a, style: `left:${(c + labR * Math.cos(ang)).toFixed(1)}px;top:${(c + labR * Math.sin(ang)).toFixed(1)}px` };
      });
      this.setData({
        rings,
        labels,
        polyStyle: pts.length >= 3 ? `clip-path:polygon(${pts.join(',')})` : 'display:none',
        boxStyle: `width:${size}px;height:${size}px`,
        plotStyle: `left:${c - plotR}px;top:${c - plotR}px;width:${plotR * 2}px;height:${plotR * 2}px`,
      });
    },
  },
});
