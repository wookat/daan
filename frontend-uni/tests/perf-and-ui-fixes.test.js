import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  isEdgeCacheable,
  edgeTtl,
  isCacheableContentType,
  QIMG_EDGE_CACHE_TTL,
} from '../../deploy/cf-pages/functions/edge-policy.js';
import { getTtl } from '../src/api/api-get-cache.js';
import { isPublicCacheablePath } from '../src/api/api-policy.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('Edge Policy & API Client Caching Optimizations', () => {
  it('edges cache /qimg/* with 86400s TTL and image/* check, plus expanded public APIs while keeping auth bypass', () => {
    expect(QIMG_EDGE_CACHE_TTL).toBe(86400);
    expect(isEdgeCacheable('GET', '/qimg/foo.png', true, true)).toBe(true);
    expect(edgeTtl('/qimg/foo.png')).toBe(86400);
    expect(isCacheableContentType('/qimg/foo.png', false, 'image/webp')).toBe(true);
    expect(isCacheableContentType('/qimg/foo.png', false, 'text/html')).toBe(false);

    for (const p of [
      '/api/shenlun/hotspots',
      '/api/shizheng/daily',
      '/api/exam/templates',
      '/api/access_info',
      '/api/push/pubkey',
    ]) {
      expect(isEdgeCacheable('GET', p, false, false), p).toBe(true);
      expect(isEdgeCacheable('GET', p, true, false), p).toBe(false);
    }
  });

  it('api-get-cache includes /api/stats_bundle and public dim endpoints', () => {
    expect(getTtl('/api/stats_bundle?uid=abc')).toBeGreaterThan(0);
    expect(getTtl('/api/papers')).toBeGreaterThan(0);
    expect(getTtl('/api/shenlun/filters')).toBeGreaterThan(0);
    expect(getTtl('/api/shizheng/daily')).toBeGreaterThan(0);
  });

  it('isPublicCacheablePath identifies uid-less public GETs so logged-in requests drop Authorization', () => {
    expect(isPublicCacheablePath('/api/question_counts')).toBe(true);
    expect(isPublicCacheablePath('/api/papers?kind=zhenti')).toBe(true);
    expect(isPublicCacheablePath('/api/shenlun/questions/12')).toBe(true);
    expect(isPublicCacheablePath('/api/papers?uid=u1')).toBe(false);
    expect(isPublicCacheablePath('/api/stats_bundle?uid=u1')).toBe(false);
  });
});

describe('Frontend Bundle & Runtime Optimizations', () => {
  it('index.html removes unused render-blocking zalize-tokens stylesheet', () => {
    const html = read('../index.html');
    expect(html).not.toContain('zalize-tokens.css');
  });

  it('kg-echart lazily imports pruned echarts-lite and delegates visColors to utils/vis-colors.js', () => {
    const kc = read('../src/components/kg-echart/kg-echart.vue');
    const lite = read('../src/utils/echarts-lite.js');
    const vis = read('../src/utils/vis-colors.js');
    expect(kc).toContain("import('../../utils/echarts-lite.js')");
    expect(kc).toContain("from '../../utils/vis-colors.js'");
    expect(lite).not.toContain('HeatmapChart');
    expect(lite).not.toContain('VisualMapComponent');
    expect(lite).not.toContain('DataZoomComponent');
    expect(vis).toContain('export function visColors()');
  });

  it('home defers prefetchNext, book lazily parses md(), shenlun dedupes onLoad', () => {
    const home = read('../src/pages/home/home.vue');
    expect(home).toContain('_prefetchTimer = setTimeout');

    const book = read('../src/pages/book/book.vue');
    expect(book).not.toContain("html: md(m.explanation || '')");
    expect(book).toContain("if (m.open && !m.html) m.html = md(m.explanation || '');");

    const sl = read('../src/pkgA/shenlun/shenlun.vue');
    expect(sl).toContain("else if (!(opts && (opts.year || opts.region))) this.loadQs();");
  });
});

describe('Frontend 6 UX & Layout Fixes', () => {
  it('App.vue + profile.vue fix async v-if double hairline & debounces MutationObserver; kg-tag uses border-box', () => {
    const app = read('../src/App.vue');
    const profile = read('../src/pages/profile/profile.vue');
    const tag = read('../src/components/kg-tag/kg-tag.vue');
    expect(app).toContain('setTimeout');
    expect(app).toContain('.cellcard .wd-cell + .wd-cell .wd-cell__wrapper');
    expect(app).toContain('.cellcard .wd-cell.is-border .wd-cell__wrapper::after');
    expect(profile).toContain('key="announce"');
    expect(profile).toContain('key="feedback"');
    expect(tag).toContain('box-sizing: border-box');
  });

  it('kg-two-col makes desktop #aside independently scrollable', () => {
    const two = read('../src/components/kg-two-col/kg-two-col.vue');
    expect(two).toContain('overflow-y: auto');
    expect(two).toContain('overscroll-behavior: contain');
  });

  it('book expanded card puts .mexpl before .mfoot and uses compact q-social-bar', () => {
    const book = read('../src/pages/book/book.vue');
    const explIdx = book.indexOf('class="mexpl"');
    const footIdx = book.indexOf('<view v-else class="mfoot">');
    const socIdx = book.indexOf('<q-social-bar compact');
    expect(explIdx).toBeGreaterThan(-1);
    expect(footIdx).toBeGreaterThan(explIdx);
    expect(socIdx).toBeGreaterThan(footIdx);
  });

  it('shenlun detail fixes title header outside scroll-view and measures split via window.innerHeight', () => {
    const sl = read('../src/pkgA/shenlun/shenlun.vue');
    expect(sl).toContain('<view class="d-l-hd">');
    expect(sl).toContain('<scroll-view scroll-y class="d-l-body">');
    expect(sl).toContain('window.innerHeight');
    expect(sl).not.toMatch(/\.paper-tag\s*\{[^}]*overflow:\s*hidden/);
  });

  it('login uses responsive 440/880 centered layout and stats consumes /api/stats_bundle with square heatmap', () => {
    const login = read('../src/pkgA/user/login.vue');
    expect(login).toContain('calc(100vh - var(--window-top, 0px))');
    expect(login).toContain('max-width: 880px');
    expect(login).toContain('label-width="72px"');

    const stats = read('../src/pages/stats/stats.vue');
    expect(stats).toContain('/api/stats_bundle?uid=');
    expect(stats).toContain('aspect-ratio: 1 / 1');
    expect(stats).toContain(':prefetched="statsPredData"');
  });
});
