// 批次3验收: node scripts/acc-batch3.js — 本地后端 localhost:8399 + 种子库
// 走: 申论热点三段式 → 我的笔记 → 周报典型错题/下周计划 → stats番茄钟 → ask语音按钮
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT = 'C:\\Users\\Administrator\\qa-screenshots\\batch3';
const cap = (f) => execSync(
  `powershell -NoProfile -ExecutionPolicy Bypass -File "${__dirname}\\cap.ps1" -out "${f}" -l 0.652 -t 0.088 -r 0.947 -b 0.875`,
  { stdio: 'pipe' }
);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  const shot = async (name) => { cap(path.join(OUT, name + '.png')); console.log('SHOT', name); };

  // uid 切到种子用户
  await mp.evaluate(() => { wx.setStorageSync('anonUid', 'dev-uid-0000'); });

  // 1) 申论素材页 → 热点 tab
  await mp.reLaunch('/pkgExam/shenlun/shenlun?tab=m');
  await sleep(3000);
  await mp.evaluate(() => { const p = getCurrentPages().pop(); p.setMtype && p.setMtype('热点'); });
  await sleep(2500);
  // 展开第一个热点
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    if (p.data.hots && p.data.hots[0]) { p._expanded = 'h' + p.data.hots[0].topic; p.renderHots(); }
  });
  await sleep(800);
  await shot('b7-hotspot');

  // 展开「其他」段
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    if (p.data.hots && p.data.hots[0]) { p.toggleHotOthers({ currentTarget: { dataset: { topic: p.data.hots[0].topic } } }); }
  });
  await sleep(600);
  await shot('b7-hotspot-others');

  // 2) 我的笔记
  await mp.evaluate(() => { const p = getCurrentPages().pop(); p.setMtype && p.setMtype('我的笔记'); });
  await sleep(2000);
  await shot('b7-notes');

  // 笔记表单
  await mp.evaluate(() => { const p = getCurrentPages().pop(); p.onNoteAdd && p.onNoteAdd(); });
  await sleep(800);
  await shot('b7-note-form');
  await mp.evaluate(() => { const p = getCurrentPages().pop(); p.onNoteClose && p.onNoteClose(); });

  // 3) 周报：典型错题 + 下周计划
  await mp.reLaunch('/pkgGrow/weekly-report/weekly-report');
  await sleep(3500);
  await shot('b7-weekly-top');
  // 滚到底部看 plan/typical
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    p.setData({}); // noop
  });
  // 用 scroll-view 滚动
  await mp.evaluate(() => {
    const pages = getCurrentPages(); const p = pages.pop();
    const sv = p.selectComponent ? null : null;
    wx.pageScrollTo ? wx.pageScrollTo({ scrollTop: 2000 }) : null;
  }).catch(() => {});
  await sleep(800);
  await shot('b7-weekly-mid');

  // 4) stats → 番茄专注入口
  await mp.evaluate(() => { wx.switchTab({ url: '/pages/stats/stats' }); });
  await sleep(3000);
  await shot('b8-stats-pomo-row');
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    p.onGoPomo && p.onGoPomo();
  });
  await sleep(2000);
  let cur = await mp.currentPage();
  console.log('pomo page:', cur.path);
  await mp.evaluate(() => { const p = getCurrentPages().pop(); p.onStart && p.onStart(); });
  await sleep(2500);
  await shot('b8-pomo-running');

  // 5) ask 页 → 文字题面板语音按钮
  await mp.reLaunch('/pkgSocial/ask/ask');
  await sleep(2500);
  await mp.evaluate(() => { const p = getCurrentPages().pop(); p.openText ? p.openText() : p.setData({ textOpen: true }); });
  await sleep(1200);
  await shot('b8-ask-voice');

  try { await mp.disconnect(); } catch (e) {}
  console.log('DONE');
  process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
