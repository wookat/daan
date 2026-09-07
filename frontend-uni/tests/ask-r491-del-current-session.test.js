// R491：历史 sheet 里删除「正在查看」的会话（curSid === s.id）后，结果区仍显示它、curSid 未清；
// 随后「新对话」/切换会话触发 archiveCurrent() 用同一 sid 重新归档 → 本机列表 + 服务端 POST 同时复活，
// 与 R330「删除即终态」矛盾（生产 bundle 375/1440 CDP 一手复现）。修法：删的是当前会话时同步清空当前视图。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(new URL('../src/pages/ask/ask.vue', import.meta.url), 'utf8');

function method(name) {
  const m = SRC.match(new RegExp(`\\n {4}${name}\\([^)]*\\) \\{[\\s\\S]*?\\n {4}\\},`));
  expect(m, name).not.toBeNull();
  return m[0];
}

describe('ask.vue 删除当前会话不复活', () => {
  it('delSession 删到 curSid（含刷新后仅存 askCurSid 的情形）时清空当前视图', () => {
    const del = method('delSession');
    expect(del).toContain('this.dropRemoteSession(s.id)');
    expect(del).toMatch(
      /if \(s\.id === \(this\.curSid \|\| Number\(uni\.getStorageSync\('askCurSid'\)\) \|\| 0\)\) this\.clearCurrent\(\);/,
    );
  });

  it('clearCurrent 清 results/curSid/本机快照并推空 ask/cur；newSession 复用它', () => {
    const clr = method('clearCurrent');
    expect(clr).toContain('this.results = [];');
    expect(clr).toContain('this.curSid = 0;');
    expect(clr).toContain("uni.removeStorageSync('askCurSession');");
    expect(clr).toContain("uni.removeStorageSync('askCurSid');");
    expect(clr).toContain('this._curCleared = true;');
    expect(clr).toMatch(/request\('\/api\/ask\/cur', \{ method: 'POST', data: \{ uid: anonUid\(\), items: \[\] \} \}\)/);
    const ns = method('newSession');
    expect(ns).toContain('this.archiveCurrent();');
    expect(ns).toContain('this.clearCurrent();');
  });
});
