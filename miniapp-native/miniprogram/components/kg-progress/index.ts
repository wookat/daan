// KgProgress 小程序版（COMPONENTS §1.13）：线性 4/8px + 环形 48/72/96；槽色统一 --prog-track（修深色槽漏网）。
import { moduleMeta } from '../../utils/module-meta';

Component({
  properties: {
    value: { type: Number, value: 0 },
    max: { type: Number, value: 100 },
    shape: { type: String, value: 'bar' },
    thickness: { type: Number, value: 4 },
    size: { type: Number, value: 48 },
    module: { type: String, value: '' },
    inverse: { type: Boolean, value: false },
    label: { type: String, value: '' },
    ariaLabel: { type: String, value: '进度' },
  },
  data: { pct: 0, fillStyle: '', ringColor: 'var(--brand)' },
  observers: {
    'value, max, module, inverse'(value: number, max: number, mod: string, inverse: boolean) {
      const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
      const m = mod ? moduleMeta(mod) : null;
      const color = inverse ? 'var(--on-brand)' : m ? m.color : 'var(--brand)';
      this.setData({ pct, fillStyle: m && !inverse ? `background:${m.color}` : '', ringColor: color });
    },
  },
});
