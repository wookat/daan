// KgPredictCard 小程序版（对齐 H5 components/predict-card）：/api/predict 能力预测分；冷启动进度 / 分值+置信度 / 周曲线 / 五模块分项
import { fetchPredict } from '../../api/exam';
import type { PredictResp } from '../../api/exam-types';

interface HistVM {
  key: number;
  label: string;
  scoreText: string;
  heightPct: number;
  hot: boolean;
}

interface ModVM {
  module: string;
  name: string;
  score: number;
  max: number;
  pct: number;
  trend: 'up' | 'down' | '';
  trendMark: string;
}

interface PredictVM {
  cold: boolean;
  n: number;
  need: number;
  coldLeft: number;
  coldPct: number;
  score: number | null;
  confidence: string;
  deltaText: string;
  deltaDown: boolean;
  nText: string;
  history: HistVM[];
  mods: ModVM[];
}

function barH(score: number, arr: number[]): number {
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  if (max === min) return 60;
  return 25 + ((score - min) / (max - min)) * 70;
}

export function toPredictVM(d: PredictResp): PredictVM {
  const n = d.n || 0;
  const need = d.need || 0;
  if (d.status === 'cold') {
    return {
      cold: true,
      n,
      need,
      coldLeft: Math.max(need - n, 0),
      coldPct: need > 0 ? Math.min((n / need) * 100, 100) : 0,
      score: null,
      confidence: '',
      deltaText: '',
      deltaDown: false,
      nText: '',
      history: [],
      mods: [],
    };
  }
  const hist = d.history || [];
  const scores = hist.map((h) => h.score);
  const dw = d.delta_week;
  return {
    cold: false,
    n,
    need,
    coldLeft: 0,
    coldPct: 100,
    score: d.score == null ? null : d.score,
    confidence: d.confidence || '',
    deltaText: dw == null ? '' : (dw >= 0 ? '↑' : '↓') + ' 较上周' + (dw >= 0 ? '+' : '') + dw,
    deltaDown: dw != null && dw < 0,
    nText: '基于 ' + n + ' 题作答' + (d.n_exam ? ' · ' + d.n_exam + ' 次模考' : ''),
    history:
      hist.length > 1
        ? hist.map((h, i) => ({
            key: h.week_end,
            label: h.label,
            scoreText: String(Math.round(h.score)),
            heightPct: barH(h.score, scores),
            hot: i === hist.length - 1,
          }))
        : [],
    mods: (d.modules || []).map((m) => {
      const t = m.trend || 0;
      return {
        module: m.module,
        name: m.name,
        score: m.score,
        max: m.max,
        pct: m.max > 0 ? Math.max(0, Math.min(100, (m.score / m.max) * 100)) : 0,
        trend: t > 0.03 ? 'up' : t < -0.03 ? 'down' : '',
        trendMark: t > 0.03 ? '↑' : t < -0.03 ? '↓' : '—',
      };
    }),
  };
}

Component({
  data: { loading: true, busy: false, vm: null as PredictVM | null },
  lifetimes: {
    attached() {
      this.load();
    },
  },
  methods: {
    // 页面 onShow 可再次调用刷新；已有数据时静默更新不闪骨架屏
    async load() {
      if (this.data.busy) return;
      const first = !this.data.vm;
      this.setData(first ? { busy: true, loading: true } : { busy: true });
      try {
        const d = await fetchPredict();
        this.setData({ vm: toPredictVM(d) });
      } catch (e) {
        if (first) this.setData({ vm: null });
      }
      this.setData({ loading: false, busy: false });
    },
  },
});
