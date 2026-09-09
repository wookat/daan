// R548：错题重练启动后未作答，H5 浏览器后退→前进 / F5 回到练习页会变成默认练习（R546/R547 生产复验坐实的既有 P3）。
// 机理：redoSet 在 onShow 一次性消费并 removeStorage；pendingSession 只在 commitPick/next/toggleExcl 的 saveSession()
// 才写 → 未答时二者皆无 → tryResume() 无可恢复 → 兜底 start(lastModule,'direct')。
// 修法：重练启动（onShow redoSet 分支 / 完成页 retryGroup 重练分支）与普通 start() 成功即 saveSession()，
// 快照加 redo=1 标记；adoptLocalPending 按标记恢复 _redoItems（剥掉运行时作答字段），完成页 redoReport/「再来一组」语义不丢。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  isRedoPending,
  parsePendingPractice,
  pendingTitle,
  redoItemsFromPending,
  stripPracticeRuntime,
  REDO_PENDING_TITLE,
} from '../src/practice-progress.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const practice = read('../src/pages/practice/practice.vue');
const script = practice.slice(practice.indexOf('<script'), practice.indexOf('</script>'));
const home = read('../src/pages/home/home.vue');

const redoItem = { id: 11, mistake_id: 7, module: 'shuliang', answer: 'B', options: { A: '1', B: '2' } };

describe('R548 pendingSession redo 标记', () => {
  it('isRedoPending 只认 redo===1/true；缺位、0、字符串一律 false', () => {
    expect(isRedoPending({ redo: 1 })).toBe(true);
    expect(isRedoPending({ redo: true })).toBe(true);
    expect(isRedoPending({ redo: 0 })).toBe(false);
    expect(isRedoPending({ redo: '1' })).toBe(false);
    expect(isRedoPending({})).toBe(false);
    expect(isRedoPending(null)).toBe(false);
  });

  it('parsePendingPractice 透出 redo，旧快照（无 redo 位）为 false', () => {
    const now = 1700000000000;
    const items = [{ ...redoItem, _picked: '' }, { ...redoItem, id: 12 }];
    expect(parsePendingPractice({ t: now, items, lastModule: null, redo: 1 }, now)).toEqual({
      done: 0, total: 2, module: '', ptitle: '', redo: true, daily: null,
    });
    expect(parsePendingPractice({ t: now, items, lastModule: 'yanyu' }, now).redo).toBe(false);
  });

  it('pendingTitle：卷名优先 > 错题重练 > 空（普通练习由调用方回落模块名）', () => {
    expect(pendingTitle({ ptitle: '2024 国考行测', redo: 1 })).toBe('2024 国考行测');
    expect(pendingTitle({ redo: 1 })).toBe(REDO_PENDING_TITLE);
    expect(pendingTitle({ redo: 0, lastModule: 'yanyu' })).toBe('');
    expect(pendingTitle(null)).toBe('');
  });
});

describe('R548 从快照恢复重练母本', () => {
  it('stripPracticeRuntime 剥掉运行时作答字段，保留题目与 mistake_id，不改原对象', () => {
    const q = { ...redoItem, _picked: 'A', _secs: 12, _excl: ['C'], _logged: true, _saved: false, _mid: 3, _reason: '粗心大意', _reported: true };
    const out = stripPracticeRuntime(q);
    expect(out).toEqual(redoItem);
    expect(q._picked).toBe('A');
    expect(stripPracticeRuntime(null)).toBeNull();
  });

  it('redoItemsFromPending：redo 快照 → 干净母本；非 redo / 空 items → null', () => {
    const items = [{ ...redoItem, _picked: 'A', _logged: true }, { ...redoItem, id: 12, _saved: false }];
    expect(redoItemsFromPending({ redo: 1, items })).toEqual([redoItem, { ...redoItem, id: 12 }]);
    expect(redoItemsFromPending({ redo: 0, items })).toBeNull();
    expect(redoItemsFromPending({ redo: 1, items: [] })).toBeNull();
    expect(redoItemsFromPending(undefined)).toBeNull();
  });
});

describe('R548 practice.vue 接线', () => {
  it('onShow redoSet 分支：标 _source=redo、清 _ptitle，session=true 后立刻 saveSession()，再 toast', () => {
    const i = script.indexOf("uni.removeStorageSync('redoSet');");
    expect(i).toBeGreaterThan(0);
    const branch = script.slice(i, script.indexOf("uni.showToast({ title: '错题重练开始", i));
    expect(branch).toContain("this._source = 'redo';");
    expect(branch).toContain('this._ptitle = null;');
    expect(branch).toMatch(/this\.session = true;\s*this\.startQTimer\(\);\s*this\.saveSession\(\);/);
  });

  it('retryGroup 重练分支与普通 start() 成功后同样 saveSession()（前进/刷新走已有 tryResume）', () => {
    const rg = script.slice(script.indexOf('retryGroup() {'), script.indexOf("uni.showToast({ title: '错题重练再来一组'"));
    expect(rg).toMatch(/this\.session = true;\s*this\.startQTimer\(\);\s*this\.saveSession\(\);/);
    const st = script.slice(script.indexOf('async start(module, submodule'), script.indexOf("uni.setStorageSync('lastModule', module || '');"));
    expect(st).toMatch(/this\.session = true;\s*this\.startQTimer\(\);\s*this\.saveSession\(\);\s*$/);
  });

  it('saveSession 快照带 redo 位（_redoItems 非空且无 lastModule）', () => {
    const ss = script.slice(script.indexOf('saveSession() {'), script.indexOf('pushPracticeProgress() {'));
    expect(ss).toContain('redo: this._redoItems && this._redoItems.length && !this.lastModule ? 1 : 0,');
    expect(ss).toContain("if (this.examMode || this.beiMode || this._shizheng || !this.session || !this.items.length) return;");
  });

  it('adoptLocalPending 按标记恢复 _redoItems 并提示「继续错题重练」；续练弹窗标题走 pendingTitle', () => {
    const ap = script.slice(script.indexOf('adoptLocalPending(s) {'), script.indexOf('adoptRemoteSnap(snap) {'));
    expect(ap).toContain('this._redoItems = redoItemsFromPending(s);');
    expect(ap).toContain("if (this._redoItems) uni.showToast({ title: '继续' + REDO_PENDING_TITLE, icon: 'none' });");
    const tr = script.slice(script.indexOf('tryResume() {'), script.indexOf('async rateHs('));
    expect(tr).toContain('const title = pendingTitle(s);');
    expect(tr).toContain("content: (title ? '「' + title + '」' : '') + '上次还有一组未做完（'");
    expect(script).toMatch(/import \{ collectPracticeProgress, adoptPracticeResume, pendingTitle, redoItemsFromPending, dailyFromPending, dailyPendingFor, cnDayOf, REDO_PENDING_TITLE[^}]*\} from '\.\.\/\.\.\/practice-progress\.js';/);
  });

  it('完成页 redoReport 与「再来一组」仍按 _redoItems && !lastModule 判重练（恢复后语义不丢）', () => {
    expect(script).toContain('const isRedo = this._redoItems && this._redoItems.length && !this.lastModule;');
    expect(script).toContain('if (this._redoItems && this._redoItems.length && !this.lastModule) {');
  });

  it('未作答显式退出仍清快照：quitSummary 无已答返回 null → leave(false) removeStorage', () => {
    expect(script).toMatch(/if \(!sum\) \{\s*this\.leave\(false\);/);
    expect(script).toMatch(/\} else \{\s*uni\.removeStorageSync\('pendingSession'\);/);
  });
});

describe('R548 首页续练卡', () => {
  it('标签：卷名 > 错题重练 > 模块名', () => {
    expect(home).toContain('{{ prLabel(practiceResume) }} · 已做 {{ practiceResume.done }}/{{ practiceResume.total }} 题');
    expect(home).toMatch(/prLabel\(r\) \{\s*if \(r\.ptitle\) return r\.ptitle;\s*if \(r\.redo\) return REDO_PENDING_TITLE;\s*if \(r\.daily\) return dailyPendingTitle\(r\.daily\);\s*return this\.prModName\(r\.module\);/);
  });
});
