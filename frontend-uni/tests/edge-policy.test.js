import { describe, it, expect } from 'vitest';
import {
  isBlockedBot,
  isEdgeCacheable,
  edgeTtl,
  cacheFreshness,
  isCacheableContentType,
  serveMode,
  notModified,
  carryLastModified,
  shouldRetryOrigin,
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

describe('notModified', () => {
  const ET = 'W/"abc123"';
  const LM = 'Tue, 01 Sep 2026 08:00:00 GMT';
  it('If-None-Match 精确/弱比较/列表/星号命中', () => {
    expect(notModified(ET, null, ET, null)).toBe(true);
    expect(notModified('"abc123"', null, ET, null)).toBe(true);
    expect(notModified('W/"x", W/"abc123"', null, ET, null)).toBe(true);
    expect(notModified('*', null, ET, null)).toBe(true);
  });
  it('If-None-Match 不匹配或副本无 ETag 不 304', () => {
    expect(notModified('W/"other"', null, ET, null)).toBe(false);
    expect(notModified(ET, LM, null, LM)).toBe(false);
  });
  it('If-None-Match 存在时忽略 If-Modified-Since（RFC 9110）', () => {
    expect(notModified('W/"other"', LM, ET, LM)).toBe(false);
  });
  it('If-Modified-Since：晚于/等于 Last-Modified 命中，早于不命中', () => {
    expect(notModified(null, LM, null, LM)).toBe(true);
    expect(notModified(null, 'Tue, 01 Sep 2026 09:00:00 GMT', null, LM)).toBe(true);
    expect(notModified(null, 'Tue, 01 Sep 2026 07:00:00 GMT', null, LM)).toBe(false);
  });
  it('缺头/非法日期不 304', () => {
    expect(notModified(null, null, ET, LM)).toBe(false);
    expect(notModified(null, 'garbage', null, LM)).toBe(false);
  });
});

describe('carryLastModified', () => {
  const NOW = Date.UTC(2026, 8, 1, 10, 0, 0);
  const PREV_LM = 'Tue, 01 Sep 2026 08:00:00 GMT';
  it('指纹未变沿用旧 Last-Modified（含弱化形态）', () => {
    expect(carryLastModified('"abc"', PREV_LM, '"abc"', NOW)).toBe(PREV_LM);
    expect(carryLastModified('W/"abc"', PREV_LM, '"abc"', NOW)).toBe(PREV_LM);
  });
  it('指纹变化取本次回源时刻', () => {
    expect(carryLastModified('"abc"', PREV_LM, '"def"', NOW)).toBe('Tue, 01 Sep 2026 10:00:00 GMT');
  });
  it('任一侧缺 ETag/旧 LM 缺失取本次回源时刻', () => {
    expect(carryLastModified(null, PREV_LM, '"abc"', NOW)).toBe('Tue, 01 Sep 2026 10:00:00 GMT');
    expect(carryLastModified('"abc"', PREV_LM, null, NOW)).toBe('Tue, 01 Sep 2026 10:00:00 GMT');
    expect(carryLastModified('"abc"', null, '"abc"', NOW)).toBe('Tue, 01 Sep 2026 10:00:00 GMT');
  });
});

describe('shouldRetryOrigin', () => {
  it('无副本首次 GET 遇 fetch 异常(0)/502/503/504 重试', () => {
    expect(shouldRetryOrigin('GET', 0, false, 0)).toBe(true);
    expect(shouldRetryOrigin('GET', 502, false, 0)).toBe(true);
    expect(shouldRetryOrigin('GET', 503, false, 0)).toBe(true);
    expect(shouldRetryOrigin('HEAD', 504, false, 0)).toBe(true);
  });
  it('应用级 5xx（500/501）与 4xx/2xx 不重试', () => {
    expect(shouldRetryOrigin('GET', 500, false, 0)).toBe(false);
    expect(shouldRetryOrigin('GET', 501, false, 0)).toBe(false);
    expect(shouldRetryOrigin('GET', 404, false, 0)).toBe(false);
    expect(shouldRetryOrigin('GET', 200, false, 0)).toBe(false);
  });
  it('有陈旧副本走 stale-if-error 不重试', () => {
    expect(shouldRetryOrigin('GET', 502, true, 0)).toBe(false);
  });
  it('仅首次尝试重试（单次上限）', () => {
    expect(shouldRetryOrigin('GET', 502, false, 1)).toBe(false);
  });
  it('非 GET/HEAD（有副作用）不重试', () => {
    expect(shouldRetryOrigin('POST', 502, false, 0)).toBe(false);
    expect(shouldRetryOrigin('PUT', 0, false, 0)).toBe(false);
  });
});
