const automator = require('miniprogram-automator');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  await mp.reLaunch('/pkgExam/list/list');
  await sleep(2500);
  const r = await mp.evaluate(() => new Promise((resolve) => {
    wx.request({
      url: 'http://localhost:8399/api/exam/templates',
      success: (res) => resolve({ ok: 1, status: res.statusCode, n: (res.data && res.data.items || []).length }),
      fail: (err) => resolve({ ok: 0, err: String(err.errMsg || err) }),
    });
  }));
  console.log('probe:', JSON.stringify(r));
  const r2 = await mp.evaluate(() => new Promise((resolve) => {
    wx.request({
      url: 'https://kaogong.zalize.com/api/exam/templates',
      success: (res) => resolve({ ok: 1, status: res.statusCode }),
      fail: (err) => resolve({ ok: 0, err: String(err.errMsg || err) }),
    });
  }));
  console.log('probe-prod:', JSON.stringify(r2));
  try { await mp.disconnect(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
