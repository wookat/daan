// 关键功能流抽查: 刷题作答→结果态 / 错题本列表+筛选 / 模考列表 / 组卷sheet
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OUT = 'C:\\Users\\Administrator\\qa-screenshots\\flows';
const cap = (f) => execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${__dirname}\\cap.ps1" -out "${f}" -l 0.652 -t 0.088 -r 0.947 -b 0.875`, { stdio: 'pipe' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  const shot = async (n) => { cap(path.join(OUT, n + '.png')); console.log('SHOT', n); };

  // 1) 刷题：加载一题并作答
  await mp.reLaunch('/pages/practice/practice');
  await sleep(3500);
  const q = await mp.evaluate(() => { const p = getCurrentPages().pop(); return { hasQ: !!(p.data.q && (p.data.q.stem || p.data.q.question)), opts: (p.data.q && p.data.q.options && p.data.q.options.length) || 0, keys: Object.keys(p.data).slice(0, 40) }; });
  console.log('practice:', JSON.stringify(q));
  const answered = await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    const fns = Object.keys(p).filter(k => typeof p[k] === 'function' && /pick|option|answer|select|choose/i.test(k));
    return fns;
  });
  console.log('answer fns:', JSON.stringify(answered));
  if (answered.length) {
    await mp.evaluate((fn) => {
      const p = getCurrentPages().pop();
      try { p[fn]({ currentTarget: { dataset: { i: 1, index: 1, k: 'B', v: 'B' } } }); } catch (e) { try { p[fn](1); } catch (e2) {} }
    }, answered[0]);
    await sleep(1500);
  }
  await shot('flow-practice');

  // 2) 错题本：列表 + 易错 seg
  await mp.evaluate(() => { wx.setStorageSync('anonUid', 'dev-uid-0000'); });
  await mp.reLaunch('/pages/book/book');
  await sleep(3000);
  const book = await mp.evaluate(() => { const p = getCurrentPages().pop(); return { n: (p.data.list || p.data.items || []).length, keys: Object.keys(p.data).slice(0, 30) }; });
  console.log('book:', JSON.stringify(book));
  await shot('flow-book');

  // 3) 模考列表
  await mp.reLaunch('/pkgExam/list/list');
  await sleep(2500);
  await shot('flow-exam-list');

  // 4) 组卷 sheet（list 页入口）
  const opened = await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    const fns = Object.keys(p).filter(k => typeof p[k] === 'function' && /sheet|group|paper|make|config/i.test(k));
    return fns;
  });
  console.log('list fns:', JSON.stringify(opened));
  await shot('flow-list-top');
  try { await mp.disconnect(); } catch (e) {}
  console.log('DONE');
  process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
