const automator = require('miniprogram-automator');
(async()=>{
  const mp = await automator.connect({wsEndpoint:'ws://localhost:9420'});
  await mp.reLaunch('/pkgSocial/ask/ask');
  await new Promise(r=>setTimeout(r,2500));
  const p = await mp.currentPage();
  console.log('on:', p.path);
  try{await mp.disconnect()}catch(e){}
  process.exit(0);
})().catch(e=>{console.log('FATAL',String(e).slice(0,150));process.exit(1)});
