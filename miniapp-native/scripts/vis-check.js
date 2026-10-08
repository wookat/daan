// VIS 验收：重载首页 + 错题本 + 统计页，截屏验证书案暖纸配色生效
const automator = require('miniprogram-automator');

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  const pages = ['/pages/home/home', '/pages/book/book', '/pages/stats/stats'];
  for (const p of pages) {
    try {
      await mp.reLaunch(p);
      await new Promise((r) => setTimeout(r, 2500));
      const cur = await mp.currentPage();
      console.log('launched', p, '->', cur.path);
    } catch (e) {
      console.log('fail', p, String(e).slice(0, 120));
    }
  }
  await mp.disconnect();
})().catch((e) => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
