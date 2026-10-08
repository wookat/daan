// B1/B2/B3 一站式实走验收：单一连接跑全部步骤，节点处调 cap.ps1 截屏。
const automator = require('miniprogram-automator');
const { execFileSync } = require('child_process');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = (name) => execFileSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'C:\\Users\\Administrator\\repos\\kaogong-assistant\\miniapp-native\\scripts\\cap.ps1', '-out', `C:\\Users\\Administrator\\qa-screenshots\\miniapp\\${name}.png`, '-l', '0.654', '-t', '0.097', '-r', '0.945', '-b', '0.881'], { stdio: 'inherit' });
const pageData = async (mp, tag) => {
  const r = await withTimeout(mp.evaluate(() => {
    const p = getCurrentPages().pop();
    return { path: p && p.route, data: p && p.data };
  }), 9000, tag);
  const p = await withTimeout(mp.currentPage(), 9000, tag + '.currentPage');
  return { path: r.path, page: p, data: r.data };
};

(async () => {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  try {
    // 0) 等模拟器就绪（新项目窗启动要编译一会）
    let ready = false;
    for (let i = 0; i < 20 && !ready; i++) {
      try { await withTimeout(mp.evaluate(() => 1 + 1), 6000, 'ping'); ready = true; }
      catch (_) { await sleep(3000); }
    }
    if (!ready) throw new Error('simulator never ready');
    // 1) 注入 uid → 错题本
    await withTimeout(mp.evaluate((uid) => {
      wx.setStorageSync('anonUid', uid);
      wx.removeStorageSync('token'); wx.removeStorageSync('authToken'); wx.removeStorageSync('accessCode');
    }, 'qa-ui-smoke'), 9000, 'eval');
    await withTimeout(mp.reLaunch('/pages/book/book'), 20000, 'reLaunch-book');
    await sleep(4000);
    let r = await pageData(mp, 'book');
    let d = r.data;
    console.log('[book] path=', r.path, 'tab=', d.tab, 'stickyCount=', d.stickyCount, 'shown=', (d.shown || []).length);
    console.log('[book] tabOpts=', JSON.stringify(d.tabOpts));
    console.log('[book] toolItems=', JSON.stringify(d.toolItems));
    cap('b123-1-book');

    // 2) 切「易错」tab
    await withTimeout(mp.evaluate(() => { getCurrentPages().pop().onTab({ detail: { value: 'sticky' } }); return 1; }), 9000, 'onTab');
    await sleep(1500);
    r = await pageData(mp, 'sticky'); d = r.data;
    console.log('[sticky] tab=', d.tab, 'shown=', (d.shown || []).length,
      'rows=', JSON.stringify((d.shown || []).map((x) => ({ id: x.id, s: x.mastery_state, wrc: x.wrong_review_count }))));
    cap('b123-2-sticky');

    // 3) 长期易错专项卷 → practice redoset
    await withTimeout(mp.evaluate(() => { const p = getCurrentPages().pop(); p.onStickyPaper(); return 1; }), 9000, 'onStickyPaper');
    await sleep(4000);
    r = await pageData(mp, 'paper'); d = r.data;
    console.log('[paper] path=', r.path, 'loadHint=', d.loadHint,
      'items.len=', (d.items || []).length, 'diffTag=', JSON.stringify(d.diffTag),
      'cur=', JSON.stringify(d.cur && { id: d.cur.id, diff: d.cur.difficulty }));
    cap('b123-3-paper');

    // 4) mastery map（难度画像）
    await withTimeout(mp.reLaunch('/pkgGrow/mastery-map/mastery-map'), 20000, 'reLaunch-map');
    await sleep(6000);
    r = await pageData(mp, 'map'); d = r.data;
    console.log('[map] path=', r.path, 'diffRows=', JSON.stringify(d.diffRows), 'secsText=', d.secsText);
    cap('b123-4-map');
  } catch (e) {
    console.log('STEP-ERR', String(e).slice(0, 300));
    try { cap('b123-err'); } catch (_) {}
    process.exitCode = 1;
  } finally {
    try { await mp.disconnect(); } catch (_) {}
  }
  process.exit(0);
})();
