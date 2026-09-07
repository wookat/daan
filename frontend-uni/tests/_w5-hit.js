// W5（main）设计系统合入后，页面级「✕ / 文字链 / chip / 按钮」大多换成 kg-* 组件，
// 命中区由组件层的 --hit-min 统一保证；R410–R500 各轮的源锁改为：
//   ① 组件层命中规则本身被锁（assertHitLayer）；
//   ② 页面仍自绘的可点元素：规则里必须有 ≥40px 的 min-height / var(--hit-min)（HIT40 / rule）。
import { readFileSync } from 'node:fs';

export const read = (rel) => readFileSync(new URL('../src/' + rel, import.meta.url), 'utf8');
export const styleOf = (src) => src.slice(src.indexOf('<style'));
export const templateOf = (src) => src.slice(0, src.indexOf('<script'));

/** 取 `.sel { ... }` 单条规则体（支持逗号并列选择器与 :deep(.sel)）；找不到返回 '' */
export function rule(css, sel) {
  const name = sel.replace(/^\./, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[\\n,}])\\s*(?::deep\\()?\\.${name}\\)?\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  return m ? m[1] : '';
}

export const HIT40 = /min-height:\s*(?:4\d|5\d|6\d)px|min-height:\s*var\(--hit-min\)/;
export const BOX40 = /(?:min-)?width:\s*(?:4\dpx|var\(--hit-min\))[^}]*(?:min-)?height:\s*(?:4\dpx|var\(--hit-min\))/;

const usesClass = (tpl, cls) => new RegExp(`class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"`).test(tpl);

/** 旧页面级选择器：模板仍挂 → 规则须 ≥40px；模板已不挂（换成 kg-* 组件）→ 通过 */
export function legacyHit(expect, src, sel, extra = HIT40) {
  const cls = sel.replace(/^\./, '');
  if (!usesClass(templateOf(src), cls)) return 'componentized';
  expect(rule(styleOf(src), sel), sel).toMatch(extra);
  return 'own';
}

/** 组件层命中规则（tokens + kg-button / kg-sheet / kg-chip-row / kg-section-header / kg-banner） */
export function assertHitLayer(expect) {
  const tokens = read('styles/tokens.generated.css');
  expect(tokens).toMatch(/--hit-min:\s*44px;/);
  expect(tokens).toMatch(/--btn-h-lg:\s*44px;/);
  const btn = read('components/kg-button/kg-button.vue');
  expect(btn).toMatch(/\.kg-btn\.kg-btn--sm::after, \.kg-btn\.kg-btn--md::after \{[^}]*height: var\(--hit-min\)/);
  expect(btn).toMatch(/\.kg-btn\.kg-btn--sm, \.kg-btn\.kg-btn--md \{ position: relative; overflow: visible !important; \}/);
  const sheet = read('components/kg-sheet/kg-sheet.vue');
  expect(sheet).toMatch(/class="kg-sheet__x" role="button" aria-label="关闭"/);
  expect(rule(styleOf(sheet), '.kg-sheet__x')).toMatch(/width: var\(--hit-min\); height: var\(--hit-min\)/);
  const chips = read('components/kg-chip-row/kg-chip-row.vue');
  expect(rule(styleOf(chips), '.kg-chip::after')).toMatch(/height: var\(--hit-min\)/);
  const sec = read('components/kg-section-header/kg-section-header.vue');
  expect(rule(styleOf(sec), '.kg-sec__more')).toMatch(/min-height: var\(--hit-min\)/);
  const banner = read('components/kg-banner/kg-banner.vue');
  expect(rule(styleOf(banner), '.kg-banner__x')).toMatch(/width: var\(--hit-min\); height: var\(--hit-min\)/);
}

/** 统计模板里的 kg-* 组件用量 */
export const countTag = (src, tag) => (templateOf(src).match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
