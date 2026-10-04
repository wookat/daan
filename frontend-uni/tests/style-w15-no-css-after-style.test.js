import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// </style> 之后的 CSS 不会进编译产物（R414/R428 多选提示曾在生产完全无样式）；全仓源锁，不再靠人眼。
const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function vueFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) vueFiles(p, out);
    else if (name.endsWith('.vue')) out.push(p);
  }
  return out;
}

function tailAfterLastStyle(src) {
  const i = src.lastIndexOf('</style>');
  return i < 0 ? '' : src.slice(i + '</style>'.length);
}

describe('src/**/*.vue：最后一个 </style> 之后无非空内容', () => {
  const files = vueFiles(SRC);

  it('扫描到 .vue 文件', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((f) => [f.slice(SRC.length)]))('%s', (rel) => {
    const src = readFileSync(join(SRC, rel), 'utf8');
    expect(tailAfterLastStyle(src).trim()).toBe('');
  });

  it('曾经的三处孤儿 CSS 已回到 <style> 内且模板仍在引用', () => {
    for (const [rel, cls] of [
      ['pkgA/exam/exam.vue', '.multi-tip'],
      ['pkgA/share/share-q.vue', '.multi-bar'],
      ['pkgA/share/share-q.vue', '.multi-hint'],
    ]) {
      const src = readFileSync(join(SRC, rel), 'utf8');
      const styleStart = src.indexOf('<style');
      const styleEnd = src.lastIndexOf('</style>');
      const decl = src.indexOf(cls + ' {');
      expect(decl, rel + ' ' + cls).toBeGreaterThan(styleStart);
      expect(decl).toBeLessThan(styleEnd);
      expect(src.slice(0, styleStart)).toContain('class="' + cls.slice(1));
    }
    const login = readFileSync(join(SRC, 'pkgA/user/login.vue'), 'utf8');
    expect(login).not.toMatch(/\.seg-item/);
  });
});
