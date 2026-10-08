const automator = require('miniprogram-automator');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  try {
    const r = await withTimeout(mp.evaluate(() => {
      const pages = getCurrentPages();
      const p = pages[pages.length - 1];
      return {
        route: p && p.route,
        keys: p ? Object.keys(p.data) : null,
        data: p ? p.data : null,
      };
    }), 10000, 'inspect');
    console.log('route=', r.route);
    console.log('keys=', (r.keys || []).join(','));
    const d = r.data || {};
    console.log('cold=', d.cold, 'loading=', d.loading, 'diffRows=', JSON.stringify(d.diffRows), 'secsText=', d.secsText);
    console.log('map=', JSON.stringify(d.map || d.mastery || {}).slice(0, 500));
  } finally { try { await mp.disconnect(); } catch (_) {} }
})();
