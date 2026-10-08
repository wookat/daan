const automator = require('miniprogram-automator');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  console.log('connected');
  const page = await withTimeout(mp.currentPage(), 8000, 'currentPage');
  console.log('page:', page.path);
  try {
    await withTimeout(mp.reLaunch('/pages/book/book'), 15000, 'reLaunch');
    console.log('reLaunch done');
  } catch(e) { console.log('reLaunch fail:', String(e).slice(0,120)); }
  const p2 = await withTimeout(mp.currentPage(), 8000, 'currentPage2');
  console.log('now page:', p2.path);
  try {
    await withTimeout(mp.screenshot({ path: 'C:\\Users\\Administrator\\qa-screenshots\\miniapp\\dbg.png' }), 15000, 'screenshot');
    console.log('screenshot done');
  } catch(e) { console.log('shot fail:', String(e).slice(0,120)); }
  try { await mp.disconnect(); } catch(e){}
  process.exit(0);
})().catch(e => { console.log('FATAL', String(e).slice(0,200)); process.exit(1); });
