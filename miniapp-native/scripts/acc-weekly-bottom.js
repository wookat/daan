const automator = require('miniprogram-automator');
const path = require('path');
const { execSync } = require('child_process');
const OUT = 'C:\\Users\\Administrator\\qa-screenshots\\batch3';
const cap = (f) => execSync(
  `powershell -NoProfile -ExecutionPolicy Bypass -File "${__dirname}\\cap.ps1" -out "${f}" -l 0.652 -t 0.088 -r 0.947 -b 0.875`
);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  await mp.evaluate(() => { wx.setStorageSync('anonUid', 'dev-uid-0000'); });
  await mp.reLaunch('/pkgGrow/weekly-report/weekly-report');
  await sleep(3500);
  // 隐藏中间段让典型错题/下周计划上浮到一屏内
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    p.setData({ cmp: [], mastery: [], reasons: [], heroStats: [] });
  });
  await sleep(900);
  cap(path.join(OUT, 'b7-weekly-bottom.png'));
  console.log('SHOT b7-weekly-bottom');
  try { await mp.disconnect(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
