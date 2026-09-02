import { describe, it, expect } from 'vitest';
import { GROUP_SIZES, normalizeGroupSize, normalizeFlag, adoptServerPracticePrefs } from '../src/practice-prefs.js';

describe('GROUP_SIZES', () => {
  it('档位白名单为 10/20/30/50', () => {
    expect(GROUP_SIZES).toEqual([10, 20, 30, 50]);
  });
});

describe('normalizeGroupSize', () => {
  it('合法档位返回自身', () => {
    for (const n of [10, 20, 30, 50]) expect(normalizeGroupSize(n)).toBe(n);
  });
  it('非法值返回 null', () => {
    for (const v of [5, 15, 0, -1, 100, '10', 10.5, true, false, null, undefined, {}, [], NaN]) {
      expect(normalizeGroupSize(v)).toBeNull();
    }
  });
});

describe('normalizeFlag', () => {
  it('严格 0/1 返回自身', () => {
    expect(normalizeFlag(0)).toBe(0);
    expect(normalizeFlag(1)).toBe(1);
  });
  it('非法值返回 null', () => {
    for (const v of [2, -1, '1', 0.5, true, false, null, undefined, {}, NaN]) {
      expect(normalizeFlag(v)).toBeNull();
    }
  });
});

describe('adoptServerPracticePrefs', () => {
  it('服务端合法且与本地不同时返回差异', () => {
    const out = adoptServerPracticePrefs(
      { groupSize: 10, timedMode: false, autoNext: true },
      { group_size: 30, timed_mode: 1, auto_next: 0 }
    );
    expect(out).toEqual({ groupSize: 30, timedMode: true, autoNext: false });
  });
  it('服务端与本地一致时无差异', () => {
    const out = adoptServerPracticePrefs(
      { groupSize: 20, timedMode: true, autoNext: false },
      { group_size: 20, timed_mode: 1, auto_next: 0 }
    );
    expect(out).toEqual({});
  });
  it('服务端缺失/非法时保留本地（不出现在差异中）', () => {
    expect(adoptServerPracticePrefs({ groupSize: 10 }, {})).toEqual({});
    expect(adoptServerPracticePrefs({ groupSize: 10 }, { group_size: 15, timed_mode: '1', auto_next: true })).toEqual({});
    expect(adoptServerPracticePrefs({ groupSize: 10 }, null)).toEqual({});
    expect(adoptServerPracticePrefs({ groupSize: 10 }, 'x')).toEqual({});
  });
  it('local 缺省按 falsy 处理', () => {
    expect(adoptServerPracticePrefs(null, { timed_mode: 1 })).toEqual({ timedMode: true });
    expect(adoptServerPracticePrefs({}, { timed_mode: 0 })).toEqual({});
  });
  it('不修改输入对象', () => {
    const local = { groupSize: 10, timedMode: false, autoNext: true };
    const profile = { group_size: 50, timed_mode: 1, auto_next: 0 };
    adoptServerPracticePrefs(local, profile);
    expect(local).toEqual({ groupSize: 10, timedMode: false, autoNext: true });
    expect(profile).toEqual({ group_size: 50, timed_mode: 1, auto_next: 0 });
  });
});
