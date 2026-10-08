const automator = require('miniprogram-automator');
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  const page = await mp.currentPage();
  console.log('path', page.path);
  console.log('typeof page.data', typeof page.data);
  try {
    const d = await page.data();
    console.log('data() keys:', Object.keys(d).slice(0, 30).join(','));
    console.log('tab=', d.tab, 'stickyCount=', d.stickyCount, 'shown.len=', (d.shown || []).length);
  } catch (e) { console.log('data() err', String(e).slice(0, 150)); }
  try {
    const t = await page.data('tab');
    console.log('data("tab")=', t);
  } catch (e) { console.log('data(key) err', String(e).slice(0, 150)); }
  await mp.close().catch(() => {});
})();
