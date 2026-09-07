// Lucide 图标（与 H5 l-icon 同名同 props）：SVG 作 CSS mask，颜色由 tone 语义变量决定，随深色模式切换。
// paths.ts 由 tools/design-tokens/build.mjs 从 H5 paths.js 生成；tone 表与 frontend-uni/src/icon-tone.js 保持一致。
import { PATHS } from './paths';

const TONES: Record<string, string> = {
  ink: 'var(--ink)',
  'ink-2': 'var(--ink-2)',
  muted: 'var(--ink-3)',
  faint: 'var(--ink-4)',
  brand: 'var(--brand)',
  'brand-text': 'var(--brand-text)',
  ok: 'var(--ok)',
  bad: 'var(--bad)',
  warn: 'var(--warn)',
  info: 'var(--info)',
  streak: 'var(--streak)',
  'on-brand': 'var(--on-brand)',
  inherit: 'currentColor',
};

function maskUri(body: string, strokeWidth: number, filled: boolean): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="' + (filled ? '#000' : 'none') + '" stroke="#000"' +
    ' stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

Component({
  properties: {
    name: { type: String, value: '' },
    /** 16 / 20 / 24 / 32 */
    size: { type: Number, value: 20 },
    tone: { type: String, value: 'ink-2' },
    strokeWidth: { type: Number, value: 2 },
    filled: { type: Boolean, value: false },
  },
  data: {
    px: '20px',
    fill: TONES['ink-2'],
    mask: '',
  },
  observers: {
    'name, size, tone, strokeWidth, filled'(name: string, size: number, tone: string, strokeWidth: number, filled: boolean) {
      const body = PATHS[name] || '';
      this.setData({
        px: size + 'px',
        fill: TONES[tone] || TONES['ink-2'],
        mask: 'url("' + maskUri(body, strokeWidth, filled) + '") center / contain no-repeat',
      });
    },
  },
});
