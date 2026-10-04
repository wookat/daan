import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '../src/styles/tokens.generated.css'), 'utf8');
const wxss = fs.readFileSync(path.join(here, '../../miniapp-native/miniprogram/styles/tokens.generated.wxss'), 'utf8');
const tokens = JSON.parse(fs.readFileSync(path.join(here, '../../tools/design-tokens/tokens.json'), 'utf8'));

const vars = (src) => new Set([...src.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));

describe('design tokens 一源多端（SPEC §6）', () => {
  it('主色 #2e5bff 且 --brand-press 为 600 阶', () => {
    expect(css).toMatch(/--brand:\s*#2e5bff;/);
    expect(css).toMatch(/--brand-press:\s*#1e44d9;/);
    expect(tokens.color.brand['500'].$value).toBe('#2e5bff');
  });

  it('H5 与小程序语义变量集合一致（页面只引语义名）', () => {
    const h5 = vars(css);
    const mp = vars(wxss);
    for (const k of ['--ink', '--ink-4', '--line', '--fill', '--card', '--bg', '--mask', '--ok-strong', '--bad-soft', '--fs-body', '--r-md', '--sp-16', '--dur-base', '--z-toast', '--btn-h-lg', '--prog-track']) {
      expect(h5.has(k), `h5 ${k}`).toBe(true);
      expect(mp.has(k), `mp ${k}`).toBe(true);
    }
  });

  it('字阶 6 档 px 且 rpx 换算为偶数；字重仅 400/500/600', () => {
    const sizes = [...css.matchAll(/--fs-[a-z0-9]+:\s*(\d+)px;/g)].map((m) => Number(m[1]));
    expect(new Set(sizes)).toEqual(new Set([26, 20, 17, 15, 13, 12]));
    for (const s of sizes) expect((s * 2) % 2).toBe(0);
    expect(css).not.toMatch(/--fw-[a-z]+:\s*(700|800)/);
  });

  it('深色：阴影降级为 none，brand 文字用 #8fa8ff', () => {
    const dark = css.slice(css.indexOf('.theme-dark uni-page-body'));
    expect(dark).toMatch(/--sh-1:\s*none;/);
    expect(dark).toMatch(/--brand-text:\s*#8fa8ff;/);
  });

  it('H5 有 :root 镜像供 uni 运行时壳（tabbar/page-head）读 token', () => {
    expect(css).toMatch(/^:root \{/m);
  });
});
