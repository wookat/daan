// B1/B2/B3 视觉验收驱动：连 :9420，注入 qa-ui-smoke uid，逐页动作后由外部 cap.ps1 截图。
// 用法: node qa-b123.js <step>   step ∈ setup|book|sticky|paper|map
const automator = require('miniprogram-automator');
const withTimeout = (p, ms, tag) => Promise.race([p, new Promise((_, rj) => setTimeout(() => rj(new Error(tag + ' TIMEOUT')), ms))]);

const UID = 'qa-ui-smoke';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pageData = async (mp) => { const p = await withTimeout(mp.currentPage(), 8000, 'currentPage'); return { path: p.path, data: await withTimeout(p.data(), 8000, 'data') } };

async function main() {
  const step = process.argv[2] || 'setup';
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' });
  try {
    if (step === 'setup') {
      // 注入匿名 uid（auth 模块的 storage key 为 anonUid），回到首页让请求层带上
      await mp.evaluate((uid) => {
        wx.setStorageSync('anonUid', uid);
        wx.removeStorageSync('token');
        wx.removeStorageSync('accessCode');
      }, UID);
      await mp.reLaunch('/pages/book/book');
      await sleep(3500);
      const r = await pageData(mp);
      const d = r.data;
      console.log('book loaded:', r.path, 'tab=', d.tab, 'stickyCount=', d.stickyCount, 'shown=', (d.shown || []).length);
      console.log('tabOpts=', JSON.stringify(d.tabOpts));
      console.log('toolItems=', JSON.stringify(d.toolItems));
      return;
    }
    if (step === 'sticky') {
      let page = await withTimeout(mp.currentPage(), 8000, 'currentPage');
      await withTimeout(page.callMethod('onTab', { detail: { value: 'sticky' } }), 8000, 'callMethod');
      await sleep(1200);
      const r2 = await pageData(mp);
      const d2 = r2.data;
      console.log('tab=', d2.tab, 'shown=', (d2.shown || []).length,
        'mastery=', JSON.stringify((d2.shown || []).map((x) => x.mastery_state)));
      return;
    }
    if (step === 'paper') {
      // 触发「长期易错专项卷」→ 应 navigate 到 practice?mode=redoset&source=sticky
      let page = await withTimeout(mp.currentPage(), 8000, 'currentPage');
      await withTimeout(page.callMethod('onStickyPaper'), 8000, 'callMethod');
      await sleep(3500);
      const r3 = await pageData(mp);
      const d3 = r3.data;
      console.log('after stickyPaper page=', r3.path, 'mode=', d3.mode, 'source=', d3.source,
        'len=', (d3.qs || d3.list || []).length, 'diffTag=', JSON.stringify(d3.diffTag));
      return;
    }
    if (step === 'map') {
      await mp.reLaunch('/pkgGrow/mastery-map/mastery-map');
      await sleep(4000);
      const r4 = await pageData(mp);
      const d4 = r4.data;
      console.log('map page=', r4.path, 'diffRows=', JSON.stringify(d4.diffRows), 'secsText=', d4.secsText);
      return;
    }
  } finally {
    await mp.close().catch(() => {});
  }
}

main().catch((e) => { console.log('ERR', String(e).slice(0, 400)); process.exit(1); });
