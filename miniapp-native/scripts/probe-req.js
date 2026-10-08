const automator = require('miniprogram-automator');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  // 先dismiss掉残留模考快照,避免弹窗挡路
  await mp.evaluate(() => { try { wx.removeStorageSync('examSnap'); wx.removeStorageSync('examProgress'); } catch (e) {} });
  await mp.reLaunch('/pages/home/home');
  await sleep(2000);
  const r = await mp.evaluate(() => new Promise((resolve) => {
    let api;
    try { api = require('../../api/exam.js'); } catch (e) { try { api = require('/api/exam.js'); } catch (e2) { resolve({ ok: 0, err: 'req:' + e2.message }); return; } }
    api.fetchExamTemplates()
      .then((d) => resolve({ ok: 1, n: (d.items || []).length }))
      .catch((e) => resolve({ ok: 0, err: String(e && (e.message || e.errMsg || e)) }));
  }));
  console.log('fetchExamTemplates:', JSON.stringify(r));
  const r2 = await mp.evaluate(() => new Promise((resolve) => {
    wx.request({
      url: 'http://localhost:8399/api/exam/templates',
      header: { 'X-Access-Code': wx.getStorageSync('accessCode') || '' },
      success: (res) => resolve({ ok: 1, status: res.statusCode }),
      fail: (err) => resolve({ ok: 0, err: String(err.errMsg) }),
    });
  }));
  console.log('raw+code:', JSON.stringify(r2), 'storedCode:', await mp.evaluate(() => wx.getStorageSync('accessCode') || 'NONE'));
  try { await mp.disconnect(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
