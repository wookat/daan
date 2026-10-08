const automator = require('miniprogram-automator');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  try {
    const uid = await mp.evaluate(() => wx.getStorageSync('anonUid'));
    console.log('anonUid in sim =', uid);
    const r = await mp.evaluate(() => new Promise((res) => {
      wx.request({
        url: 'http://127.0.0.1:8300/api/mistakes?uid=qa-ui-smoke',
        success: (x) => res({ ok: 1, status: x.statusCode, n: (x.data && x.data.items || []).length, first: (x.data && x.data.items && x.data.items[0] && x.data.items[0].mastery_state) }),
        fail: (e) => res({ ok: 0, err: e.errMsg }),
      });
    }));
    console.log('direct wx.request =', JSON.stringify(r));
  } finally { await mp.close().catch(() => {}); }
})().catch((e) => { console.log('ERR', String(e).slice(0, 300)); process.exit(1); });
