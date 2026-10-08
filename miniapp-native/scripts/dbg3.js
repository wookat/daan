const automator = require('miniprogram-automator');
const wt = (p,ms,t) => Promise.race([p, new Promise((_,rj)=>setTimeout(()=>rj(new Error(t+' TO')),ms))]);
(async()=>{
  const mp = await automator.connect({wsEndpoint:'ws://localhost:9420'});
  await mp.reLaunch('/pages/practice/practice');
  await new Promise(r=>setTimeout(r,3000));
  let pg = await wt(mp.currentPage(),8000,'cur');
  console.log('page:', pg.path);
  const opts = await wt(pg.$$('.opt, .option, .choice, .answer-item, [class*="option"]'), 8000, 'opts');
  console.log('options found:', opts.length);
  for (const o of opts.slice(0,6)) { console.log(' -', (await o.text()||'').slice(0,40), '| cls=', (await o.attribute('class')||'').slice(0,60)); }
  if (opts.length) { await opts[0].tap(); console.log('tapped first option'); }
  await new Promise(r=>setTimeout(r,3000));
  const p2 = await mp.currentPage();
  const d = await p2.data().catch(()=>null);
  console.log('after tap keys:', d ? Object.keys(d).slice(0,20).join(',') : 'no data');
  try{await mp.disconnect()}catch(e){}
  process.exit(0);
})().catch(e=>{console.log('FATAL',String(e).slice(0,300));process.exit(1)});
