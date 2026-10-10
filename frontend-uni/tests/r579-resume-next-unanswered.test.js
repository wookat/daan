// R579：续做落点与首页「继续今日一练 · 第 k/N 题」同口径。
// 生产 375 实拍（r579 j375/c0-home-logged → c1-resumed）：每日一练答错第 3 题后从顶栏返回 → 首页 hero「继续今日一练 · 第 4/10 题」，
// 点进却落在第 3 题的错答反馈态（顶栏 3/10、toast「第 3/10 题」），要再按一次「下一题」。
// 修法：resumeIndex 快照 idx 停在已答题则接着其后第一道未答题；parsePendingPractice/parseRemotePractice 透出 next（1 基），hero 改用 next。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { adoptPracticeResume, parsePendingPractice, parseRemotePractice, resumeIndex } from '../src/practice-progress.js';
import { adoptPracticeResume as mpAdopt, resumeIndex as mpResumeIndex } from '../../miniapp-native/miniprogram/utils/practice-progress.ts';

const q = (id, picked = '') => ({ id, stem: 's' + id, options: { A: 'a', B: 'b' }, answer: 'A', _picked: picked });
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const practice = read('../src/pages/practice/practice.vue') + read('../src/practice/daily-ops.js') + read('../src/practice/session-ops.js');
const home = readFileSync(new URL('../src/pages/home/home.vue', import.meta.url), 'utf8');

describe('resumeIndex', () => {
  it('idx 停在已答题（答错看反馈时退出）→ 其后第一道未答题', () => {
    expect(resumeIndex([q(1, 'A'), q(2, 'B'), q(3, 'B'), q(4), q(5)], 2)).toBe(3);
  });

  it('idx 停在未答题原地不动；idx 越界/非法回落到 0 后同规则', () => {
    expect(resumeIndex([q(1, 'A'), q(2), q(3)], 1)).toBe(1);
    expect(resumeIndex([q(1), q(2)], 0)).toBe(0);
    expect(resumeIndex([q(1, 'A'), q(2)], -1)).toBe(1);
    expect(resumeIndex([q(1, 'A'), q(2)], 'x')).toBe(1);
    expect(resumeIndex([q(1), q(2, 'A')], 9)).toBe(0);
  });

  it('其后全已答（答题卡跳着做）→ 从头找第一道未答；全部已答/空数组保持原位/0', () => {
    expect(resumeIndex([q(1), q(2, 'A'), q(3, 'A')], 2)).toBe(0);
    expect(resumeIndex([q(1, 'A'), q(2, 'A')], 1)).toBe(1);
    expect(resumeIndex([], 3)).toBe(0);
    expect(resumeIndex(null, 3)).toBe(0);
  });

  it('自定义 picked 谓词（服务端 picks 映射）', () => {
    const picks = { 1: 'A', '2': 'B' };
    const picked = (x) => !!x && (picks[x.id] != null || picks[String(x.id)] != null);
    expect(resumeIndex([q(1), q(2), q(3)], 1, picked)).toBe(2);
  });
});

describe('首页续练数据透出 next（1 基落地题号）', () => {
  const now = Date.now();
  it('parsePendingPractice：done=3、idx=2 已答 → next=4（与 done+1 一致）；idx 停在未答第 2 题 → next=2', () => {
    const items = [q(1, 'A'), q(2, 'B'), q(3, 'B'), q(4), q(5)];
    expect(parsePendingPractice({ t: now, items, idx: 2 }, now)).toMatchObject({ done: 3, next: 4, total: 5 });
    expect(parsePendingPractice({ t: now, items: [q(1, 'A'), q(2), q(3, 'A')], idx: 1 }, now)).toMatchObject({ done: 2, next: 2 });
  });

  it('parseRemotePractice：按 picks 判已答，idx 停在已答 → next 为其后未答', () => {
    const d = { items: [q(1), q(2), q(3), q(4)], picks: { 1: 'A', '2': 'B', 3: 'A' }, idx: 2 };
    expect(parseRemotePractice(d, now)).toMatchObject({ done: 3, next: 4, total: 4 });
  });

  it('adoptPracticeResume：远端快照 idx 停在已答题 → 落在其后未答题', () => {
    const s = adoptPracticeResume({ items: [q(1), q(2), q(3)], picks: { 1: 'A', 2: 'B' }, idx: 1 });
    expect(s.idx).toBe(2);
    expect(s.items[2]._picked).toBe('');
  });
});

describe('调用方接线（源锁）', () => {
  it('practice.vue adoptLocalPending 落点走 resumeIndex（不再原样取 s.idx）', () => {
    const body = practice.slice(practice.indexOf('adoptLocalPending(s) {'), practice.indexOf('adoptRemoteSnap(snap) {'));
    expect(body).toContain('this.idx = resumeIndex(s.items, s.idx);');
    expect(body).not.toContain('Math.min(s.idx, s.items.length - 1)');
    expect(practice).toMatch(/import \{[^}]*resumeIndex[^}]*\} from '[^']*practice-progress\.js';/);
  });

  it('home.vue hero「第 k/N 题」取 next（与落地题号、恢复 toast 同源）', () => {
    expect(home).toContain("'继续今日一练 · 第 ' + r.next + '/' + r.total + ' 题'");
    expect(home).not.toContain('(r.done + 1)');
  });
});

describe('小程序同口径（落点；首页续练卡显「已做 n/N」不涉题号）', () => {
  it('resumeIndex 与 H5 同结果', () => {
    const cases = [
      [[q(1, 'A'), q(2, 'B'), q(3, 'B'), q(4), q(5)], 2],
      [[q(1, 'A'), q(2), q(3)], 1],
      [[q(1), q(2, 'A'), q(3, 'A')], 2],
      [[q(1, 'A'), q(2, 'A')], 1],
      [[q(1, 'A'), q(2)], -1],
      [[], 0],
    ];
    for (const [items, idx] of cases) expect(mpResumeIndex(items, idx)).toBe(resumeIndex(items, idx));
  });

  it('adoptPracticeResume 远端快照落在其后未答题；practice.ts adoptPending 走 resumeIndex', () => {
    const s = mpAdopt({ items: [q(1), q(2), q(3)], picks: { 1: 'A', 2: 'B' }, idx: 1 });
    expect(s.idx).toBe(2);
    const mp = readFileSync(new URL('../../miniapp-native/miniprogram/pages/practice/practice.ts', import.meta.url), 'utf8');
    expect(mp).toContain('this.adopt(s.items.map(toPQ), resumeIndex(s.items, s.idx), s.right, s.streak, s.bestStreak);');
  });
});
