import { describe, it, expect } from 'vitest';
import { weakSpots } from '../src/weak-spots.js';

const NAMES = { yanyu: '言语理解', ziliao: '资料分析' };
const modName = (m) => NAMES[m] || m;
const wrong = (extra) => ({ module: 'yanyu', answer: 'A', _picked: 'B', ...extra });

describe('weakSpots', () => {
  it('空/非数组/无错题返回空数组', () => {
    expect(weakSpots(null, modName)).toEqual([]);
    expect(weakSpots([], modName)).toEqual([]);
    expect(weakSpots([{ module: 'yanyu', answer: 'A', _picked: 'A' }, { module: 'yanyu', answer: 'A' }], modName)).toEqual([]);
  });

  it('同 name 不同 tag3 合并为 1 条，n 累加，tag3 置空走 submodule 入口', () => {
    const r = weakSpots(
      [
        wrong({ question_type: '言语理解-逻辑填空', tag3: 'YY-LJ-01' }),
        wrong({ question_type: '言语理解-逻辑填空', tag3: 'YY-LJ-04' }),
        wrong({ question_type: '言语理解-逻辑填空', tag3: 'YY-LJ-04' }),
      ],
      modName
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: '逻辑填空', module: 'yanyu', submodule: '逻辑填空', tag3: null, n: 3 });
  });

  it('同 name 唯一 tag3 时保留 tag3', () => {
    const r = weakSpots([wrong({ question_type: '言语理解-语句表达', tag3: 'YY-JB-01' }), wrong({ question_type: '言语理解-语句表达', tag3: 'YY-JB-01' })], modName);
    expect(r).toEqual([{ key: 'YY-JB-01', name: '语句表达', module: 'yanyu', submodule: '语句表达', tag3: 'YY-JB-01', n: 2 }]);
  });

  it('错题数倒序仅取前 3', () => {
    const r = weakSpots(
      [
        wrong({ question_type: '言语理解-逻辑填空', tag3: 'a' }),
        wrong({ question_type: '言语理解-语句表达', tag3: 'b' }),
        wrong({ question_type: '言语理解-语句表达', tag3: 'b' }),
        wrong({ question_type: '言语理解-片段阅读', tag3: 'c' }),
        wrong({ question_type: '言语理解-片段阅读', tag3: 'c' }),
        wrong({ question_type: '言语理解-片段阅读', tag3: 'c' }),
        wrong({ module: 'ziliao', question_type: '资料分析-增长率', tag3: 'd' }),
      ],
      modName
    );
    expect(r.map((w) => [w.name, w.n])).toEqual([
      ['片段阅读', 3],
      ['语句表达', 2],
      ['逻辑填空', 1],
    ]);
  });

  it('R524：时政题（_sz）不计入薄弱考点——纯时政组返回空，混合组只留普通题', () => {
    const sz = (extra) => wrong({ module: '时政', question_type: '单选', tag3: null, id: 118, _sz: true, ...extra });
    expect(weakSpots([sz(), sz({ id: 69 })], modName)).toEqual([]);
    const r = weakSpots([sz(), wrong({ question_type: '言语理解-逻辑填空', tag3: 'YY-LJ-01' })], modName);
    expect(r).toEqual([{ key: 'YY-LJ-01', name: '逻辑填空', module: 'yanyu', submodule: '逻辑填空', tag3: 'YY-LJ-01', n: 1 }]);
  });

  it('无 question_type 且无 submodule 时 name 退化为模块名，不同模块同名不合并', () => {
    const r = weakSpots([wrong({ tag3: 'x' }), wrong({ module: 'ziliao', tag3: 'y' })], modName);
    expect(r.map((w) => w.name).sort()).toEqual(['言语理解', '资料分析']);
  });

  it('R576：无 question_type 时 name/submodule 退到题库 submodule 列（每日一练真题 6/10 无 question_type）', () => {
    const r = weakSpots(
      [
        wrong({ question_type: null, submodule: '中心理解', tag3: 'YY-ZX-05' }),
        wrong({ question_type: null, submodule: '中心理解', tag3: 'YY-ZX-02' }),
        wrong({ module: 'ziliao', question_type: null, submodule: '简单计算与读数', tag3: 'ZL-JS-01' }),
      ],
      modName
    );
    expect(r).toEqual([
      { key: 'YY-ZX-05', name: '中心理解', module: 'yanyu', submodule: '中心理解', tag3: null, n: 2 },
      { key: 'ZL-JS-01', name: '简单计算与读数', module: 'ziliao', submodule: '简单计算与读数', tag3: 'ZL-JS-01', n: 1 },
    ]);
  });

  it('R576：有 question_type 时展示名仍取子名，但 submodule 入口传题库 submodule 列原值（后端按该列回退取题）', () => {
    const r = weakSpots([wrong({ question_type: '言语理解-意图判断', submodule: '中心理解', tag3: 'a' }), wrong({ question_type: '言语理解-意图判断', submodule: '中心理解', tag3: 'b' })], modName);
    expect(r).toEqual([{ key: 'a', name: '意图判断', module: 'yanyu', submodule: '中心理解', tag3: null, n: 2 }]);
  });

  it('R576：无 tag3 无 question_type 时按 module|submodule 分桶，不同 submodule 不并成一条模块名', () => {
    const r = weakSpots([wrong({ submodule: '中心理解' }), wrong({ submodule: '逻辑填空' }), wrong({ submodule: '逻辑填空' })], modName);
    expect(r.map((w) => [w.name, w.submodule, w.n])).toEqual([
      ['逻辑填空', '逻辑填空', 2],
      ['中心理解', '中心理解', 1],
    ]);
  });
});
