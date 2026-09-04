// R381：首页壳原始 HTML 此前 0 个 <a href>，/tiku/* 10.9 万页只靠 sitemap 被发现；
// 给引擎一条真实站内入链（uni 挂载后 CSS 隐藏，用户任何时刻看不到）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

describe('index.html 可爬题库导航', () => {
  const nav = html.match(/<nav id="kg-seo-nav"[^>]*>([\s\S]*?)<\/nav>/);
  const hrefs = nav ? [...nav[1].matchAll(/href="([^"]+)"/g)].map((m) => m[1]) : [];

  it('nav 存在且覆盖题库首页/五模块/申论/真题卷/每日一练', () => {
    expect(nav).toBeTruthy();
    expect(hrefs).toEqual([
      '/tiku/',
      '/tiku/yanyu/',
      '/tiku/panduan/',
      '/tiku/shuliang/',
      '/tiku/ziliao/',
      '/tiku/changshi/',
      '/tiku/shenlun/',
      '/tiku/papers/',
      '/tiku/daily/',
    ]);
    // 全部为同源相对路径，且每条都以 / 收尾（与 SEO 路由 canonical 一致，避免 301 折损）
    for (const h of hrefs) expect(h).toMatch(/^\/tiku(\/[a-z]+)?\/$/);
  });

  it('nav 位于 #app 之后、splash 之前（splash 后绘盖住它），脱离文档流，挂载后由 CSS 隐藏', () => {
    const iApp = html.indexOf('<div id="app">');
    const iNav = html.indexOf('<nav id="kg-seo-nav"');
    const iSplash = html.indexOf('<div id="kg-splash">');
    expect(iApp).toBeLessThan(iNav);
    expect(iNav).toBeLessThan(iSplash);
    // 挂载前不占高度：否则 splash 期间文档可滚动（R381 复验观察 1440≈57px / 375≈82px）
    expect(html).toMatch(/#kg-seo-nav\{position:absolute;left:0;right:0;top:0;/);
    expect(html).toContain('#app:not(:empty)~#kg-seo-nav{display:none}');
    // 挂载前 #app 内只有注释占位，:empty 才成立
    expect(html).toContain('<div id="app"><!--app-html--></div>');
  });
});
