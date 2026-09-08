import { describe, it, expect } from 'vitest';
import { FOCUS_CSS } from '../src/a11y-focus.js';

// 把注入样式按 {} 切成 selector → 声明 的表，断言意图而不是逐字比对
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) out.push({ sel: m[1].trim(), decl: m[2].trim() });
  return out;
}

const R = rules(FOCUS_CSS);
const find = (pred) => R.find((r) => pred(r.sel));

describe('a11y-focus 注入样式：焦点环不落在原生文本控件上', () => {
  it('非 focus-visible 的 :focus 不画环（鼠标点击无环）', () => {
    expect(find((s) => s === ':focus:not(:focus-visible)').decl).toBe('outline:none');
  });

  it(':focus-visible 环排除 input/textarea 与 uni 内层 .uni-input-input/.uni-textarea-textarea，且仍用 --brand', () => {
    const ring = find((s) => s.includes(':focus-visible') && !s.startsWith(':focus:not'));
    expect(ring).toBeTruthy();
    for (const ex of [':not(input)', ':not(textarea)', ':not(.uni-input-input)', ':not(.uni-textarea-textarea)']) {
      expect(ring.sel).toContain(ex);
    }
    expect(ring.decl).toContain('outline:2px solid var(--brand)');
    expect(ring.decl).toContain('outline-offset:2px');
    expect(FOCUS_CSS).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('输入容器 :focus-within 用 --brand 描边（搜索框胶囊 / wd-search / wd-input / kg-input）', () => {
    const box = find((s) => s.startsWith('.searchbar:focus-within'));
    expect(box).toBeTruthy();
    for (const c of ['.searchbar', '.wd-search__block', '.wd-input', '.kg-input', '.search']) {
      expect(box.sel).toContain(c + ':focus-within');
    }
    expect(box.decl).toBe('outline:2px solid var(--brand);outline-offset:-1px');
  });

  it('裸露的 uni-input/uni-textarea 宿主兜底描边；容器内的宿主不再叠一层', () => {
    const host = find((s) => s === 'uni-input:focus-within,uni-textarea:focus-within');
    expect(host.decl).toContain('var(--brand)');
    const nested = find((s) => s.includes('.searchbar uni-input:focus-within'));
    expect(nested.sel).toContain('.wd-search__block uni-textarea:focus-within');
    expect(nested.decl).toBe('outline:none');
    expect(R.indexOf(nested)).toBeGreaterThan(R.indexOf(host));
  });
});
