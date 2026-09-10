// R583：统计页 loadReco 两个互不依赖的端点（/api/recommend、/api/review）并发发出。
// 生产一手（375）：串行 await 让 review 恰在 recommend 回包那一刻才发（0.75s 发 / 0.93s 落），
// 慢窗内 recommend 长尾（Caddy 0.6–1.3s、宿主慢时 ≥12s）期间「今日待办」行一直停在「正在同步到期数…」，
// 而 review 本身 Caddy p50 0.01s；其余七个加载器早已同 tick 发出（refreshAccountData）。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stats = readFileSync(new URL('../src/pages/stats/stats.vue', import.meta.url), 'utf8');

function methodBody(src, sig) {
  const m = src.match(new RegExp(`\\n {4}${sig} \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, `${sig} 应存在`).toBeTruthy();
  return m[1];
}

describe('stats.vue loadReco 并发', () => {
  const lr = methodBody(stats, 'async loadReco\\(\\)');

  it('两个请求包在同一个 Promise.all 里，而不是逐个 await；之前只有 snapPeek 即显', () => {
    expect(lr).toMatch(/await Promise\.all\(\[/);
    const inside = lr.slice(lr.indexOf('await Promise.all(['));
    expect(inside).toMatch(/await request\(rp\)/);
    expect(inside).toMatch(/await request\(vp\)/);
    const before = lr.slice(0, lr.indexOf('await Promise.all(['));
    expect(before).not.toMatch(/await request\(/);
    expect(before).toMatch(/snapPeek\(rp\)[\s\S]*snapPeek\(vp\)/);
  });

  it('每个分支各自 try/catch；review 分支保留 R572 旧快照口径（旧快照不置 dueSynced）', () => {
    const branches = lr.match(/\(async \(\) => \{[\s\S]*?\}\)\(\)/g) || [];
    expect(branches).toHaveLength(2);
    for (const b of branches) expect(b).toMatch(/try \{[\s\S]*\} catch \(e\) \{/);
    expect(branches[1]).toContain('if (!this.noteSnapshot(d)) {');
    expect(branches[1]).toContain('this.dueSynced = true;');
    expect(branches[1]).toContain('} else {\n              this.dueSynced = false;');
  });

  it('运行时：两请求同 tick 发出；慢 recommend 不拖到期行——review 先落即 dueN/dueSynced 更新', async () => {
    const order = [];
    const pending = {};
    const request = (url) => {
      order.push(url);
      return new Promise((resolve, reject) => { pending[url] = { resolve, reject }; });
    };
    const noted = [];
    const self = {
      reco: null, dueN: 0, dueSynced: false,
      noteSnapshot(d) { noted.push(d); return !!(d && d.__stale); },
    };
    const uni = { getStorageSync: (k) => (k === 'anonUid' ? 'u1' : '') };
    const fn = new Function(
      'anonUid', 'encodeURIComponent', 'snapPeek', 'request', 'uni',
      `return async function () {${lr}\n};`,
    )(() => 'u1', encodeURIComponent, () => null, request, uni);
    const done = fn.call(self);
    expect(order).toEqual(['/api/recommend?uid=u1', '/api/review?uid=u1']);
    pending['/api/review?uid=u1'].resolve({ total: 2 });
    await Promise.resolve();
    await Promise.resolve();
    expect(self.dueN).toBe(2);
    expect(self.dueSynced).toBe(true);
    expect(self.reco).toBeNull();
    pending['/api/recommend?uid=u1'].reject(new Error('boom'));
    await done;
    expect(self.reco).toBeNull();
    expect(self.dueSynced).toBe(true);
    expect(noted).toEqual([{ total: 2 }]);
  });

  it('运行时：review 回退旧快照 → dueSynced 置 false，dueN 不改写；recommend 真实回包照常落 reco', async () => {
    const pending = {};
    const request = (url) => new Promise((resolve) => { pending[url] = resolve; });
    const self = {
      reco: null, dueN: 5, dueSynced: true,
      noteSnapshot(d) { return !!(d && d.__stale); },
    };
    const uni = { getStorageSync: (k) => (k === 'anonUid' ? 'u1' : '') };
    const snapPeek = (p) => (p.startsWith('/api/review') ? { total: 5 } : null);
    const fn = new Function(
      'anonUid', 'encodeURIComponent', 'snapPeek', 'request', 'uni',
      `return async function () {${lr}\n};`,
    )(() => 'u1', encodeURIComponent, snapPeek, request, uni);
    const done = fn.call(self);
    pending['/api/review?uid=u1']({ total: 0, __stale: true });
    pending['/api/recommend?uid=u1']({ items: [1] });
    await done;
    expect(self.dueN).toBe(5);
    expect(self.dueSynced).toBe(false);
    expect(self.reco).toEqual({ items: [1] });
  });
});
