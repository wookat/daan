import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const practice = read('../src/pages/practice/practice.vue')+read('../src/practice/daily-ops.js')+read('../src/practice/session-ops.js');
const home = read('../src/pages/home/home.vue');
const api = readdirSync(fileURLToPath(new URL('../src/api/', import.meta.url))).filter((f)=>f.endsWith('.js')).sort().map((f)=>readFileSync(fileURLToPath(new URL('../src/api/'+f, import.meta.url)),'utf8')).join('\n');
const body = (src, name) => {
  const m = src.match(new RegExp(`\\n {4}(?:async )?${name}\\(`));
  expect(m, name).toBeTruthy();
  const rest = src.slice(m.index + 1);
  const end = rest.search(/\n {4}(?:async )?[a-zA-Z_$][\w$]*\([^)]*\) \{\n/);
  return end > 0 ? rest.slice(0, end) : rest;
};

describe('R493 每日一练完成页：成绩提交失败可见可重试、分享仍带每日文案（源文件锁）', () => {
  it('完成页有 dailyErr 失败行，点击走 retryDailySubmit，热区 ≥40px', () => {
    // W5 起走 kg-banner（tone=warn，不可关闭），「重试」由组件 action 槽的 kg-button 承担热区
    expect(practice).toMatch(/<kg-banner\s+v-if="!beiMode && dailyErr"[\s\S]*?tone="warn"[\s\S]*?:closable="false"[\s\S]*?action-text="重试"\s+@action="retryDailySubmit"/);
    expect(practice).toMatch(/text="今日全站同题 · 成绩上传失败（回首页也会自动补传）"/);
    const banner = read('../src/components/kg-banner/kg-banner.vue');
    expect(banner).toMatch(/<kg-button v-if="actionText" variant="text" size="sm" @click="\$emit\('action'\)"/);
  });
  it('markDailyDone 经 sendDailyResult 提交；提交失败且无成绩才置 dailyErr（榜失败不算）', () => {
    expect(body(practice, 'markDailyDone')).toMatch(/this\.sendDailyResult\(\{ uid: anonUid\(\)/);
    const send = body(practice, 'sendDailyResult');
    expect(send).toMatch(/this\.dailyErr = false;/);
    expect(send).toMatch(/\.catch\(\(\) => \{\s*if \(!this\.dailyStats\) this\.dailyErr = true;/);
  });
  it('retryDailySubmit 只重投同日 pending payload，不重新拼装成绩', () => {
    const retry = body(practice, 'retryDailySubmit');
    expect(retry).toMatch(/uni\.getStorageSync\('dailyPendingSubmit'\)/);
    expect(retry).toMatch(/p\.date !== this\._dailyDoneDate/);
    expect(retry).toMatch(/this\.sendDailyResult\(p\)/);
  });
  it('submitResult 复位 dailyErr（下一组普通练习不残留失败行/每日分享文案）', () => {
    expect(body(practice, 'submitResult')).toMatch(/this\.dailyStats = null;\s*this\.dailyErr = false;/);
  });
  it('shareResult 每日分支以 _dailyDoneDate + (dailyStats || dailyErr) 为条件，stats 字段可缺', () => {
    const share = body(practice, 'shareResult');
    expect(share).toMatch(/if \(this\._dailyDoneDate && \(this\.dailyStats \|\| this\.dailyErr\)\) \{/);
    expect(share).toMatch(/const ds = this\.dailyStats \|\| \{\};/);
    expect(share).not.toMatch(/this\.dailyStats\.beat_pct/);
  });
  it('flushDailySubmit 返回 Promise<boolean>，首页补投成功后 syncDsDone 刷新「已完成」外显', () => {
    const flush = api.slice(api.indexOf('export function flushDailySubmit'));
    expect(flush).toMatch(/return Promise\.resolve\(false\);[\s\S]*return Promise\.resolve\(false\);/);
    expect(flush).toMatch(/return submitDailySet\(p\)\.then\(\(\) => true\)\.catch\(\(\) => false\);/);
    expect(home).toMatch(/this\.loadDailySet\(\);\s*flushDailySubmit\(\)\.then\(\(ok\) => \{\s*if \(ok\) this\.syncDsDone\(\);/);
    expect(body(home, 'loadDailySet')).toMatch(/this\.syncDsDone\(\);/);
    expect(body(home, 'syncDsDone')).toMatch(/done\.date === this\.dsMeta\.date \? done : null/);
  });
});
