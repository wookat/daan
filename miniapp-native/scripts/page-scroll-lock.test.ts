// 源锁（W15-M1）：pkgExam 各页主体统一用 <scroll-view class="page-scroll"> 承担滚动（app.wxss 提供 flex:1/min-height:0），
// 申论页此前是唯一例外（wrap 直接落在 page 上，wx.pageScrollTo 与 tabbar 让位口径不一致）。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'miniprogram');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function pagesOf(pkg: string): string[] {
  const dir = join(ROOT, pkg);
  return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory() && statSync(join(dir, d, `${d}.wxml`), { throwIfNoEntry: false }));
}

describe('pkgExam 页面滚动容器口径', () => {
  it('pkgExam 每个页面 wxml 都有 <scroll-view class="page-scroll" scroll-y>', () => {
    const pages = pagesOf('pkgExam');
    expect(pages.length).toBeGreaterThan(3);
    const missing = pages.filter((p) => !/<scroll-view[^>]*class="page-scroll"[^>]*scroll-y/.test(read(`pkgExam/${p}/${p}.wxml`)));
    expect(missing).toEqual([]);
  });

  it('app.wxss 定义 .page-scroll 占满剩余高度', () => {
    expect(read('app.wxss')).toMatch(/\.page-scroll\s*\{[^}]*flex:\s*1 1 0[^}]*min-height:\s*0/);
  });

  it('申论页 scroll-view 绑定 scrollTop 且 ts 不再调用 wx.pageScrollTo（对 scroll-view 无效）', () => {
    const wxml = read('pkgExam/shenlun/shenlun.wxml');
    const ts = read('pkgExam/shenlun/shenlun.ts');
    expect(wxml).toMatch(/<scroll-view class="page-scroll" scroll-y[^>]*scroll-top="\{\{scrollTop\}\}"/);
    expect((wxml.match(/<scroll-view/g) || []).length).toBe((wxml.match(/<\/scroll-view>/g) || []).length);
    expect(ts).not.toMatch(/wx\.pageScrollTo\(/);
    expect(ts).toContain('scrollToTop()');
    expect(ts).toMatch(/scrollTop:\s*0/);
  });
});
