import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '../src/components');
const files = fs
  .readdirSync(dir)
  .filter((d) => d.startsWith('kg-'))
  .map((d) => path.join(dir, d, `${d}.vue`))
  .filter((f) => fs.existsSync(f));

// 根元素 class；薄封装库组件（wd-button/wd-popup…）用 custom-class 挂在库组件根上
const rootClass = (src) =>
  src.match(/<template>\s*<[a-z-]+[^>]*\s(?:custom-)?class="([a-z][\w-]*)/)?.[1] ||
  // :custom-class="cls" 绑定：取 cls 里的第一个块名（如 kg-button 的 'kg-btn'）
  src.match(/cls\(\)\s*\{[\s\S]*?['"`](kg-[a-z]+)['"`]/)?.[1];
const scopedBlocks = (src) => [...src.matchAll(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
const simpleSelectors = (cssText) =>
  [...cssText.matchAll(/(^|[,}]\s*)\.([a-z][\w-]*)\s*(\{|:)/gm)].map((m) => m[2]);

describe('Kg* 组件 scoped 样式不互相污染', () => {
  it('每个 kg-* 组件的根 class 唯一（子组件根元素会继承父 scoped 选择器）', () => {
    const seen = new Map();
    for (const f of files) {
      const c = rootClass(fs.readFileSync(f, 'utf8'));
      expect(c, f).toBeTruthy();
      expect(seen.has(c), `${path.basename(f)} 与 ${seen.get(c)} 根 class 同为 .${c}`).toBe(false);
      seen.set(c, path.basename(f));
    }
    expect(seen.size).toBeGreaterThanOrEqual(20);
  });

  it('scoped 里的单类选择器不命中其他组件的根 class', () => {
    const roots = new Map(files.map((f) => [rootClass(fs.readFileSync(f, 'utf8')), path.basename(f)]));
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const own = rootClass(src);
      for (const block of scopedBlocks(src)) {
        for (const sel of simpleSelectors(block)) {
          if (sel !== own && roots.has(sel)) {
            throw new Error(`${path.basename(f)} 的 scoped .${sel} 会污染 ${roots.get(sel)} 的根元素`);
          }
        }
      }
    }
  });
});
