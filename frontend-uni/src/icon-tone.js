// l-icon 语义色与 SVG 生成（纯函数，vitest 覆盖）。SPEC §2.9：图标只有 Lucide，色只用语义 tone，尺寸 16/20/24/32。
import { MODULE_KEYS } from './module-meta.js';

/** tone → 语义 CSS 变量。图标用亮色系（--ok 而非 --ok-strong），文字才用 -strong。 */
export const ICON_TONES = {
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

export const ICON_SIZES = [16, 20, 24, 32];

/** 合法 tone：表内键，或 `module:<key>`（模块色 --mod-<key>） */
export function isIconTone(v) {
  if (typeof v !== 'string') return false;
  if (v.startsWith('module:')) return MODULE_KEYS.includes(v.slice(7));
  return Object.prototype.hasOwnProperty.call(ICON_TONES, v);
}

function toneVar(tone) {
  return tone.startsWith('module:') ? `var(--mod-${tone.slice(7)})` : ICON_TONES[tone];
}

/**
 * 决定最终 color。tone 优先；color 是 deprecated 的裸值通道（页面迁移期保留）。
 * 两者都没给 → ink-2（与旧默认 #40434e 同色，且跟随深色）。
 */
export function resolveIconColor(tone, color) {
  if (tone && isIconTone(tone)) return toneVar(tone);
  if (color) return color;
  return ICON_TONES['ink-2'];
}

function svgMarkup(body, { stroke, fill, strokeWidth }) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}"` +
    ` stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  );
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64encode(str) {
  let out = '';
  for (let i = 0; i < str.length; i += 3) {
    const c1 = str.charCodeAt(i);
    const c2 = str.charCodeAt(i + 1);
    const c3 = str.charCodeAt(i + 2);
    out += B64[c1 >> 2] + B64[((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)];
    out += isNaN(c2) ? '=' : B64[((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)];
    out += isNaN(c3) ? '=' : B64[c3 & 63];
  }
  return out;
}

/** 旧渲染路径（deprecated color 通道用）：裸色写进 SVG，base64 给 <image>。 */
export function iconSvgUri(body, { stroke, fill = 'none', strokeWidth = 2 }) {
  return 'data:image/svg+xml;base64,' + b64encode(svgMarkup(body, { stroke, fill, strokeWidth }));
}

/**
 * 生成 mask 用的 SVG data URI：颜色统一黑，由 CSS background-color 上色，
 * 这样 var(--xxx) 与深色模式对图标生效（base64 SVG 里放不进 CSS 变量）。
 */
export function iconMaskUri(body, { strokeWidth = 2, fill = 'none' } = {}) {
  const svg = svgMarkup(body, { stroke: '#000', fill: fill === 'none' ? 'none' : '#000', strokeWidth });
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
