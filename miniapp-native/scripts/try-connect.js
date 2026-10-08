const automator = require('miniprogram-automator');
(async () => {
  for (const ep of ['ws://localhost:9420','ws://localhost:22729','ws://localhost:32123','ws://localhost:20440']) {
    try {
      const mp = await automator.connect({ wsEndpoint: ep });
      console.log('CONNECTED via', ep);
      const page = await mp.currentPage();
      console.log('page:', page.path);
      await mp.close().catch(()=>{});
      process.exit(0);
    } catch(e) { console.log(ep, '=>', String(e).slice(0,100)); }
  }
  process.exit(1);
})();
