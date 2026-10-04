// R360：按卷练习「只练剩余」——paperContinuePlan fail-closed 纯函数
import { describe, it, expect } from 'vitest';
import { paperContinuePlan, paperPracticedState, paperQuery, paperFinishState, paperShareText, paperWrongItems, paperWrongPlan, paperWrongLaunch } from '../src/paper-continue.js';

describe('paperQuery', () => {
  it('基础：src 必带且编码', () => {
    expect(paperQuery({ source: '2015新疆卷' }, false, 'u1')).toBe('src=' + encodeURIComponent('2015新疆卷'));
  });

  it('pid 仅正整数才带（fail-closed）', () => {
    expect(paperQuery({ source: 's', pid: 38 }, false, '')).toBe('src=s&pid=38');
    expect(paperQuery({ source: 's', pid: 0 }, false, '')).toBe('src=s');
    expect(paperQuery({ source: 's', pid: -3 }, false, '')).toBe('src=s');
    expect(paperQuery({ source: 's', pid: 1.5 }, false, '')).toBe('src=s');
    expect(paperQuery({ source: 's', pid: '38' }, false, '')).toBe('src=s');
    expect(paperQuery({ source: 's' }, false, '')).toBe('src=s');
  });

  it('uid 仅不计时且非空才带', () => {
    expect(paperQuery({ source: 's', pid: 7 }, true, 'u-1')).toBe('src=s&pid=7&uid=u-1');
    expect(paperQuery({ source: 's', pid: 7 }, false, 'u-1')).toBe('src=s&pid=7');
    expect(paperQuery({ source: 's' }, true, '')).toBe('src=s');
  });

  it('非法入参 fail-closed', () => {
    expect(paperQuery(null, true, 'u')).toBe('src=&uid=u');
    expect(paperQuery({}, false, '')).toBe('src=');
  });
});

describe('paperContinuePlan', () => {
  it('非数组 fail-closed 空计划', () => {
    expect(paperContinuePlan(null)).toEqual({ doneN: 0, remaining: [] });
    expect(paperContinuePlan(undefined)).toEqual({ doneN: 0, remaining: [] });
    expect(paperContinuePlan({})).toEqual({ doneN: 0, remaining: [] });
  });

  it('无 done 标记（无 uid 契约）全部视为未练', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(0);
    expect(p.remaining).toEqual(items);
  });

  it('done:true 计入已练并从剩余中剔除，顺序保持', () => {
    const items = [{ id: 1, done: true }, { id: 2, done: false }, { id: 3, done: true }, { id: 4 }];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(2);
    expect(p.remaining.map((q) => q.id)).toEqual([2, 4]);
  });

  it('非布尔 done 值 fail-closed 视为未练', () => {
    const items = [{ id: 1, done: 1 }, { id: 2, done: 'true' }, null];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(0);
    expect(p.remaining.length).toBe(3);
  });

  it('全部已练：剩余为空（调用侧不弹窗、从头练）', () => {
    const items = [{ id: 1, done: true }, { id: 2, done: true }];
    const p = paperContinuePlan(items);
    expect(p.doneN).toBe(2);
    expect(p.remaining).toEqual([]);
  });
});

// R361：卷卡按卷练习完成态——paperPracticedState fail-closed 纯函数
describe('paperPracticedState', () => {
  it('非法输入 fail-closed 不显示', () => {
    expect(paperPracticedState(null, 75)).toEqual({ show: false, done: false, text: '' });
    expect(paperPracticedState('3', 75).show).toBe(false);
    expect(paperPracticedState(3.5, 75).show).toBe(false);
    expect(paperPracticedState(3, null).show).toBe(false);
    expect(paperPracticedState(3, 0).show).toBe(false);
    expect(paperPracticedState(3, -1).show).toBe(false);
  });

  it('零练过不显示', () => {
    expect(paperPracticedState(0, 75).show).toBe(false);
    expect(paperPracticedState(-2, 75).show).toBe(false);
  });

  it('部分完成显示进度文案', () => {
    expect(paperPracticedState(3, 75)).toEqual({ show: true, done: false, text: '已练 3/75 题' });
  });

  it('全练完（含超出）显示完成态', () => {
    expect(paperPracticedState(75, 75)).toEqual({ show: true, done: true, text: '已练完全部 75 题 ✓' });
    expect(paperPracticedState(80, 75).done).toBe(true);
  });
});

describe('R364 paperFinishState 完成页归卷', () => {
  it('非空卷名走本卷完成态（trim）', () => {
    expect(paperFinishState('2015年新疆卷')).toEqual({ isPaper: true, big: '本卷练完', title: '2015年新疆卷' });
    expect(paperFinishState('  卷名  ').title).toBe('卷名');
  });

  it('空串/空白/非字符串 fail-closed 走通用完成态', () => {
    for (const v of ['', '   ', null, undefined, 7, {}, []]) {
      expect(paperFinishState(v)).toEqual({ isPaper: false, big: '本组完成', title: '' });
    }
  });
});

describe('R365 paperShareText 按卷分享基句', () => {
  it('合法卷名+n+pct 生成带卷名基句（trim）', () => {
    expect(paperShareText('2015年新疆卷', 38, 87)).toBe('我在岸上见练完了「2015年新疆卷」全卷 38 题，正确率 87%');
    expect(paperShareText('  卷名  ', 10, 0)).toBe('我在岸上见练完了「卷名」全卷 10 题，正确率 0%');
  });

  it('无卷名/空白/非字符串 fail-closed 返回 null', () => {
    for (const v of ['', '   ', null, undefined, 7, {}, []]) {
      expect(paperShareText(v, 38, 87)).toBeNull();
    }
  });

  it('非法 n/pct fail-closed 返回 null', () => {
    expect(paperShareText('卷', 0, 87)).toBeNull();
    expect(paperShareText('卷', -1, 87)).toBeNull();
    expect(paperShareText('卷', 1.5, 87)).toBeNull();
    expect(paperShareText('卷', '38', 87)).toBeNull();
    expect(paperShareText('卷', 38, NaN)).toBeNull();
    expect(paperShareText('卷', 38, Infinity)).toBeNull();
    expect(paperShareText('卷', 38, '87')).toBeNull();
  });
});

describe('R366 paperWrongItems 完成页错题重练题集', () => {
  it('只取答错题、保持卷面顺序、清除会话态', () => {
    const items = [
      { id: 1, answer: 'A', _picked: 'A', _saved: false },
      { id: 2, answer: 'B', _picked: 'C', _saved: true, _mid: 9, _secs: 12, done: true },
      { id: 3, answer: 'D', _picked: '', _saved: false },
      { id: 4, answer: 'A', _picked: 'D' },
    ];
    const out = paperWrongItems(items);
    expect(out.map((q) => q.id)).toEqual([2, 4]);
    expect(out[0]).toEqual({ id: 2, answer: 'B' });
    expect(out[1]).toEqual({ id: 4, answer: 'A' });
  });

  it('R370 清除 _logged/_excl：重练作答能被 logAttempts 重新落库，排除标记不残留', () => {
    const out = paperWrongItems([
      { id: 2, answer: 'B', _picked: 'C', _logged: true, _excl: ['A'], _saved: true, _secs: 3 },
    ]);
    expect(out).toEqual([{ id: 2, answer: 'B' }]);
    expect('_logged' in out[0]).toBe(false);
    expect('_excl' in out[0]).toBe(false);
  });

  it('全对/未作答/空数组返回空', () => {
    expect(paperWrongItems([{ id: 1, answer: 'A', _picked: 'A' }])).toEqual([]);
    expect(paperWrongItems([{ id: 1, answer: 'A' }])).toEqual([]);
    expect(paperWrongItems([])).toEqual([]);
  });

  it('非数组/非法条目 fail-closed', () => {
    for (const v of [null, undefined, 'x', 7, {}]) {
      expect(paperWrongItems(v)).toEqual([]);
    }
    expect(paperWrongItems([null, undefined, { answer: 'A', _picked: 3 }])).toEqual([]);
  });

  it('不改动原条目（浅拷贝）', () => {
    const q = { id: 2, answer: 'B', _picked: 'C', _saved: true };
    paperWrongItems([q]);
    expect(q._picked).toBe('C');
    expect(q._saved).toBe(true);
  });
});

describe('R367 paperPracticedState 卷卡错题数', () => {
  it('已练进度带错题数', () => {
    expect(paperPracticedState(10, 38, 3).text).toBe('已练 10/38 题 · 错 3 题');
    expect(paperPracticedState(38, 38, 5)).toEqual({ show: true, done: true, text: '已练完全部 38 题 ✓ · 错 5 题' });
  });

  it('无错/缺省 wrong 与 R359 文案一致', () => {
    expect(paperPracticedState(10, 38, 0).text).toBe('已练 10/38 题');
    expect(paperPracticedState(10, 38).text).toBe('已练 10/38 题');
    expect(paperPracticedState(38, 38, undefined).text).toBe('已练完全部 38 题 ✓');
  });

  it('非法/超出已练数的 wrong 忽略（fail-closed）', () => {
    for (const w of [-1, 1.5, '3', null, NaN, 11]) {
      expect(paperPracticedState(10, 38, w).text).toBe('已练 10/38 题');
    }
    expect(paperPracticedState(0, 38, 3).show).toBe(false);
  });
});

describe('R367 paperWrongPlan 卷库只练错题题集', () => {
  it('只取 wrong===true 并保持卷面顺序、清除 done/wrong', () => {
    const items = [
      { id: 1, answer: 'A', done: true, wrong: false },
      { id: 2, answer: 'B', done: true, wrong: true },
      { id: 3, answer: 'C', done: true, wrong: 'true' },
      { id: 4, answer: 'D', done: true, wrong: true },
    ];
    const out = paperWrongPlan(items);
    expect(out.map((q) => q.id)).toEqual([2, 4]);
    expect(out[0]).toEqual({ id: 2, answer: 'B' });
    expect(out[1]).toEqual({ id: 4, answer: 'D' });
  });

  it('无错/未带 wrong/空数组返回空', () => {
    expect(paperWrongPlan([{ id: 1, done: true, wrong: false }])).toEqual([]);
    expect(paperWrongPlan([{ id: 1, done: true }])).toEqual([]);
    expect(paperWrongPlan([])).toEqual([]);
  });

  it('非数组/非法条目 fail-closed', () => {
    for (const v of [null, undefined, 'x', 7, {}]) {
      expect(paperWrongPlan(v)).toEqual([]);
    }
    expect(paperWrongPlan([null, undefined, 1])).toEqual([]);
  });

  it('不改动原条目（浅拷贝）', () => {
    const q = { id: 2, done: true, wrong: true };
    paperWrongPlan([q]);
    expect(q.done).toBe(true);
    expect(q.wrong).toBe(true);
  });
});

describe('R369 paperWrongLaunch 错题本「重练本卷错题」直达', () => {
  const items = [
    { id: 1, done: true, wrong: false },
    { id: 2, done: true, wrong: true },
    { id: 3, done: true },
    { id: 4, done: true, wrong: true },
  ];

  it('wantWrong=true 且有错题：只含错题、保持卷面顺序、去 done/wrong 标记', () => {
    expect(paperWrongLaunch(items, true)).toEqual([{ id: 2 }, { id: 4 }]);
  });

  it('wantWrong 非 true（false/undefined/1/"true"）不直达，回落常规流程', () => {
    for (const v of [false, undefined, null, 1, 'true']) {
      expect(paperWrongLaunch(items, v)).toBeNull();
    }
  });

  it('无错题/空题集/非数组 → null（fail-open 回落续练或重练弹窗）', () => {
    expect(paperWrongLaunch([{ id: 1, done: true }, { id: 2, done: true, wrong: false }], true)).toBeNull();
    expect(paperWrongLaunch([], true)).toBeNull();
    for (const v of [null, undefined, 'x', 7, {}]) {
      expect(paperWrongLaunch(v, true)).toBeNull();
    }
  });

  it('不改动原条目', () => {
    const q = { id: 9, done: true, wrong: true };
    paperWrongLaunch([q], true);
    expect(q).toEqual({ id: 9, done: true, wrong: true });
  });
});
