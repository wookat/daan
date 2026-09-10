// R582：我的页 loadRemote 三个互不依赖的端点（/api/profile、/api/growth、/api/announcement）并发发出。
// 生产一手：宿主慢时串行 await 让 growth 在 profile 回包后才发（5.4s 才发、8.3s 才落），
// 「错题本」计数比并发晚整整一个 RTT 才从「—」变数字。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const profile = readFileSync(new URL('../src/pages/profile/profile.vue', import.meta.url), 'utf8');

function methodBody(src, sig) {
  const m = src.match(new RegExp(`\\n {4}${sig} \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, `${sig} 应存在`).toBeTruthy();
  return m[1];
}

describe('profile.vue loadRemote 并发', () => {
  const lr = methodBody(profile, 'async loadRemote\\(\\)');

  it('三个请求包在同一个 Promise.all 里，而不是逐个 await', () => {
    expect(lr).toMatch(/await Promise\.all\(\[/);
    const inside = lr.slice(lr.indexOf('await Promise.all(['));
    expect(inside).toMatch(/await request\(pp\)/);
    expect(inside).toMatch(/this\.applyGrowth\(await request\(gp\), uid\);/);
    expect(inside).toMatch(/await request\('\/api\/announcement'\)/);
    // Promise.all 之前不再有任何 await request（快照即显只读 snapPeek）
    const before = lr.slice(0, lr.indexOf('await Promise.all(['));
    expect(before).not.toMatch(/await request\(/);
    expect(before).toMatch(/snapPeek\(pp\)[\s\S]*snapPeek\(gp\)/);
  });

  it('每个分支各自 try/catch，任一失败不影响其余（Promise.all 不会因单个 reject 短路）', () => {
    const branches = lr.match(/\(async \(\) => \{[\s\S]*?\}\)\(\)/g) || [];
    expect(branches).toHaveLength(3);
    for (const b of branches) {
      expect(b).toMatch(/try \{[\s\S]*\} catch \(e\) \{/);
    }
  });

  it('运行时：三请求同 tick 发出，慢 profile 不拖慢 growth 落 mistakeN', async () => {
    const order = [];
    const pending = {};
    const request = (url) => {
      order.push(url);
      return new Promise((resolve, reject) => { pending[url] = { resolve, reject }; });
    };
    const self = {
      profile: null, dailyGoal: 20, announce: null, mistakeN: null, growth: null,
      applyGrowth(g) { this.growth = g; this.mistakeN = g.mistakes ? g.mistakes.total : 0; },
    };
    const fn = new Function(
      'anonUid', 'encodeURIComponent', 'snapPeek', 'request', 'adoptServerDailyGoal', 'uni',
      `return async function () {${lr}\n};`,
    )(() => 'u1', encodeURIComponent, () => null, request, () => null, { setStorageSync() {} });
    const done = fn.call(self);
    expect(order).toEqual(['/api/profile?uid=u1', '/api/growth?uid=u1', '/api/announcement']);
    pending['/api/growth?uid=u1'].resolve({ mistakes: { total: 8 } });
    await Promise.resolve();
    await Promise.resolve();
    expect(self.mistakeN).toBe(8);
    expect(self.profile).toBeNull();
    pending['/api/profile?uid=u1'].reject(new Error('boom'));
    pending['/api/announcement'].resolve({ item: { id: 1 } });
    await done;
    expect(self.announce).toEqual({ id: 1 });
    expect(self.mistakeN).toBe(8);
  });
});
