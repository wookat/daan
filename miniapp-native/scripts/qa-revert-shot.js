const automator = require('miniprogram-automator');
const { execFileSync } = require('child_process');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = (name) => execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'C:\\Users\\Administrator\\repos\\kaogong-assistant\\miniapp-native\\scripts\\cap.ps1', '-out', `C:\\Users\\Administrator\\qa-screenshots\\miniapp\\${name}.png`, '-l', '0.654', '-t', '0.097', '-r', '0.945', '-b', '0.881'], { stdio: 'inherit' });
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  try {
    let ready = false;
    for (let i = 0; i < 20 && !ready; i++) {
      try { await withTimeout(mp.evaluate(() => 1 + 1), 6000, 'ping'); ready = true; }
      catch (_) { await sleep(3000); }
    }
    if (!ready) throw new Error('simulator never ready');
    await withTimeout(mp.reLaunch('/pages/book/book'), 20000, 'reLaunch');
    await sleep(4000);
    cap('revert-book');
    console.log('done');
  } finally { try { await mp.disconnect(); } catch (_) {} }
  process.exit(0);
})().catch((e) => { console.log('ERR', String(e).slice(0, 200)); process.exit(1); });
