// 遍历所有页面截图冒烟: node scripts/walk-pages.js [outdir]
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'C:\\Users\\Administrator\\qa-screenshots\\miniapp';
const appJson = require('../miniprogram/app.json');

const pages = [...appJson.pages];
for (const sp of appJson.subPackages || []) {
  for (const p of sp.pages) pages.push(`${sp.root}/${p}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  const results = [];
  for (const pg of pages) {
    const file = path.join(OUT, pg.replace(/\//g, '_') + '.png');
    try {
      await mp.reLaunch('/' + pg);
      await new Promise(r => setTimeout(r, 2500));
      const cur = await mp.currentPage();
      // mp.screenshot and heavy $$ queries hang on headless GPU-less box; capture simulator region via OS
      require('child_process').execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${__dirname}\\cap.ps1" -out "${file}"`,
        { stdio: 'pipe' }
      );
      const ok = cur.path === pg || cur.path === '/' + pg;
      results.push({ page: pg, landed: cur.path, ok });
      console.log(`${ok ? 'OK ' : 'MISS'} ${pg} -> ${cur.path}`);
    } catch (e) {
      results.push({ page: pg, error: String(e).slice(0, 200) });
      console.log(`ERR ${pg} :: ${String(e).slice(0, 160)}`);
    }
  }
  fs.writeFileSync(path.join(OUT, '_results.json'), JSON.stringify(results, null, 2));
  try { await mp.disconnect(); } catch (e) { /* mp.close() would kill IDE; disconnect keeps it alive */ }
  const bad = results.filter(r => !r.ok);
  console.log(`\nDONE ${results.length - bad.length}/${results.length} ok`);
  process.exit(bad.length ? 2 : 0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
