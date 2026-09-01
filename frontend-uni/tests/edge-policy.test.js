import { describe, it, expect } from 'vitest';
import {
  isBlockedBot,
  isEdgeCacheable,
  edgeTtl,
  cacheFreshness,
  isCacheableContentType,
  serveMode,
  EDGE_CACHE_TTL,
  API_EDGE_CACHE_TTL,
} from '../../deploy/cf-pages/functions/edge-policy.js';

describe('isBlockedBot', () => {
  it('拦截六个商业爬虫（大小写不敏感）', () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; AwarioBot/1.0)',
      'Mozilla/5.0 (compatible; SemrushBot/7~bl)',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0)',
      'Mozilla/5.0 (compatible; MJ12bot/v1.4.8)',
      'Mozilla/5.0 (compatible; DotBot/1.2)',
      'Mozilla/5.0 (compatible; PetalBot;)',
      'awariobot',
    ]) {
      expect(isBlockedBot('/tiku/q/3', ua)).toBe(true);
    }
  });
  it('robots.txt 放行被拦截 UA（读禁抓声明）', () => {
    expect(isBlockedBot('/robots.txt', 'SemrushBot')).toBe(false);
  });
  it('搜索引擎与真实浏览器不拦截', () => {
    expect(isBlockedBot('/tiku/q/3', 'Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(false);
    expect(isBlockedBot('/tiku/q/3', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120')).toBe(false);
    expect(isBlockedBot('/tiku/q/3', '')).toBe(false);
    expect(isBlockedBot('/tiku/q/3', null)).toBe(false);
  });
});

describe('isEdgeCacheable', () => {
  it('SEO 页族 / 分享落地页 / sitemap / robots 可缓存', () => {
    for (const p of ['/tiku/', '/tiku/q/3', '/s/abc123', '/p/og433f', '/sitemap.xml', '/sitemap-questions-8.xml', '/robots.txt']) {
      expect(isEdgeCacheable('GET', p, false, false)).toBe(true);
    }
  });
  it('允许清单 API 可缓存，非清单 API 不缓存', () => {
    expect(isEdgeCacheable('GET', '/api/question_counts', false, false)).toBe(true);
    expect(isEdgeCacheable('GET', '/api/daily_set', false, false)).toBe(true);
    expect(isEdgeCacheable('GET', '/api/questions', false, false)).toBe(false);
    expect(isEdgeCacheable('GET', '/api/home_bundle', false, false)).toBe(false);
  });
  it('带 Authorization 或 uid 的 API 一律绕过', () => {
    expect(isEdgeCacheable('GET', '/api/question_counts', true, false)).toBe(false);
    expect(isEdgeCacheable('GET', '/api/daily_set', false, true)).toBe(false);
  });
  it('非 GET 不缓存；SPA 壳与管理台不缓存', () => {
    expect(isEdgeCacheable('POST', '/tiku/', false, false)).toBe(false);
    expect(isEdgeCacheable('GET', '/', false, false)).toBe(false);
    expect(isEdgeCacheable('GET', '/admin', false, false)).toBe(false);
  });
});

describe('edgeTtl', () => {
  it('API 60s，页面 300s', () => {
    expect(edgeTtl('/api/question_counts')).toBe(API_EDGE_CACHE_TTL);
    expect(edgeTtl('/tiku/q/3')).toBe(EDGE_CACHE_TTL);
    expect(edgeTtl('/sitemap.xml')).toBe(EDGE_CACHE_TTL);
  });
});

describe('cacheFreshness', () => {
  it('TTL 内 hit，过期 stale（边界含等于）', () => {
    expect(cacheFreshness('1000', 1300, 300)).toBe('hit');
    expect(cacheFreshness('1000', 1301, 300)).toBe('stale');
  });
  it('无 X-Kg-Cached-At（历史副本）视为过期', () => {
    expect(cacheFreshness(null, 1e9, 300)).toBe('stale');
    expect(cacheFreshness('', 1e9, 300)).toBe('stale');
  });
});

describe('serveMode', () => {
  it('无副本同步回源 fetch（无论新鲜度）', () => {
    expect(serveMode(false, 'hit')).toBe('fetch');
    expect(serveMode(false, 'stale')).toBe('fetch');
  });
  it('有副本且 TTL 内直接 hit', () => {
    expect(serveMode(true, 'hit')).toBe('hit');
  });
  it('有副本但过期走 stale-while-revalidate', () => {
    expect(serveMode(true, 'stale')).toBe('swr');
  });
});

describe('isCacheableContentType', () => {
  it('sitemap/robots 接受 xml 与 text/plain', () => {
    expect(isCacheableContentType('/sitemap.xml', false, 'application/xml')).toBe(true);
    expect(isCacheableContentType('/robots.txt', false, 'text/plain; charset=utf-8')).toBe(true);
    expect(isCacheableContentType('/sitemap.xml', false, 'text/html')).toBe(false);
  });
  it('API 只入 json，页面只入 html（错误页/网关页不入缓存）', () => {
    expect(isCacheableContentType('/api/daily_set', true, 'application/json')).toBe(true);
    expect(isCacheableContentType('/api/daily_set', true, 'text/html')).toBe(false);
    expect(isCacheableContentType('/tiku/q/3', false, 'text/html; charset=utf-8')).toBe(true);
    expect(isCacheableContentType('/tiku/q/3', false, 'application/json')).toBe(false);
    expect(isCacheableContentType('/tiku/q/3', false, null)).toBe(false);
  });
});
