// 批次2验收: node scripts/acc-batch2.js — 本地后端 localhost:8399 + 种子库
// 走: 组卷sheet → 江苏A开考 → 错题本手录深链 → ask simSeed难度/问泽chips
const automator = require('miniprogram-automator');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OUT = 'C:\\Users\\Administrator\\qa-screenshots\\batch2';
const cap = (f) => execSync(
  `powershell -NoProfile -ExecutionPolicy Bypass -File "${__dirname}\\cap.ps1" -out "${f}" -l 0.652 -t 0.088 -r 0.947 -b 0.875`,
  { stdio: 'pipe' }
);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  const shot = async (name) => { cap(path.join(OUT, name + '.png')); console.log('SHOT', name); };
  // 清掉残留的未交卷快照，免得弹「继续上次模考」挡路
  await mp.evaluate(() => {
    ['examSnap', 'examProgress', 'kg_exam_snap', 'exam_progress'].forEach((k) => { try { wx.removeStorageSync(k); } catch (e) {} });
  }).catch(() => {});

  // 1) 组卷 sheet
  await mp.reLaunch('/pkgExam/list/list');
  await sleep(2500);
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    p.onMini && p.onMini();
  });
  await sleep(2200);
  await shot('b4-tpl-sheet');

  // 2) 选江苏A + 薄弱加权 → 开考
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    p.setData({ tplId: 'jiangsu-a', weakBoost: true });
  });
  await sleep(400);
  await shot('b4-tpl-picked');
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    p.onTplStart && p.onTplStart();
  });
  await sleep(3500);
  let cur = await mp.currentPage();
  console.log('exam page:', cur.path);
  await shot('b4-exam-paper');

  // 3) 错题本: bookManualCode 深链(真实卷码由调用方塞入 seed-code.txt)
  const code = fs.readFileSync(path.join(__dirname, 'seed-code.txt'), 'utf8').trim();
  await mp.evaluate((c) => {
    wx.setStorageSync('bookManualCode', c);
    wx.switchTab({ url: '/pages/book/book' });
  }, code);
  await sleep(3000);
  await shot('b5-book-manual');

  // 4) ask 页 simSeed 深链 → 难度档 chips;再补 explanation 让问泽 chips 出现
  await mp.evaluate(() => {
    wx.setStorageSync('simSeed', {
      q: '某工程队修路，计划20天完成，实际提前4天完工，实际工效比计划提高了百分之几？',
      qt: '数量关系-工程问题', mod: 'shuliang', modName: '数量关系',
    });
    wx.navigateTo({ url: '/pkgSocial/ask/ask' });
  });
  await sleep(2500);
  await mp.evaluate(() => {
    const p = getCurrentPages().pop();
    if (p.data.results && p.data.results[0]) p.setData({ 'results[0].explanation': '讲解占位：工程问题用赋值法。' });
  });
  await sleep(1200);
  cur = await mp.currentPage();
  console.log('ask page:', cur.path);
  await shot('b6-ask-chips');

  try { await mp.disconnect(); } catch (e) {}
  console.log('DONE');
  process.exit(0);
})().catch(e => { console.log('FATAL', e); process.exit(1); });
