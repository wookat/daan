const automator = require('miniprogram-automator');
const target = process.argv[2] || '/pages/home/home';
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  await mp.reLaunch(target);
  await new Promise((r) => setTimeout(r, 3000));
  const cur = await mp.currentPage();
  console.log('on', cur.path);
  await mp.disconnect();
})().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
