const automator = require('miniprogram-automator');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  try {
    const d = await withTimeout(mp.evaluate(() => {
      const p = getCurrentPages().pop();
      return {
        route: p.route,
        items: (p.data.items || []).length,
        idx: p.data.idx,
        cur: p.data.cur ? { id: p.data.cur.id, diff: p.data.cur.difficulty, dlabel: p.data.cur.difficulty_label } : null,
        diffTag: p.data.diffTag,
        curSource: p.data.curSource,
        loadHint: p.data.loadHint,
        loadErr: p.data.loadErr,
        loading: p.data.loading,
        redoSet: wx.getStorageSync('redoSet'),
      };
    }), 10000, 'inspect');
    console.log(JSON.stringify(d, null, 1).slice(0, 1600));
  } finally { try { await mp.disconnect(); } catch (_) {} }
})();
