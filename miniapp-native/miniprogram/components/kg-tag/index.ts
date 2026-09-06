// KgTag 小程序版（COMPONENTS §1.3）：只读标签，tone brand/ok/bad/warn/info/neutral/module；module 时按 module-meta 取 --mod-*。
import { moduleMeta } from '../../utils/module-meta';

const ICON_TONE: Record<string, string> = {
  brand: 'brand-text', ok: 'ok', bad: 'bad', warn: 'warn', info: 'info', neutral: 'ink-2',
};

Component({
  properties: {
    tone: { type: String, value: 'neutral' },
    module: { type: String, value: '' },
    icon: { type: String, value: '' },
  },
  data: { style: '', iconTone: 'ink-2' },
  observers: {
    'tone, module'(tone: string, mod: string) {
      const m = tone === 'module' ? moduleMeta(mod) : null;
      this.setData({
        style: m ? `background:${m.soft};color:${m.color}` : '',
        iconTone: m ? `module:${m.key}` : ICON_TONE[tone] || 'ink-2',
      });
    },
  },
});
