const automator = require('miniprogram-automator');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  console.log('connected');
  try {
    const d = await withTimeout(mp.screenshot(), 12000, 'shot-noargs');
    console.log('shot-noargs type:', typeof d, d && d.length ? 'len=' + JSON.stringify(d).length : '');
  } catch(e) { console.log('shot-noargs:', String(e).slice(0,100)); }
  process.exit(0);
})().catch(e => { console.log('FATAL', String(e).slice(0,150)); process.exit(1); });
