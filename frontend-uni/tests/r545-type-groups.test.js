// R545：错题本题型二级聚合（生产实测：同组「排列组合 / 概率问题 / 排列组合与概率」平级三 chip、重练互不包含）
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BOOK_PATH, buildBookUrl, parseBookOpts } from '../src/book-url.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const book = read('../src/pages/book/book.vue');
const script = book.slice(book.indexOf('<script'), book.indexOf('</script>'));
const fn = (name, args = '') => {
  const m = script.match(new RegExp(`\\n {4}${name}\\(${args}\\) \\{([\\s\\S]*?)\\n {4}\\},`));
  expect(m, name).toBeTruthy();
  return m[1];
};
const NAMES = { ziliao: '资料分析', shuliang: '数量关系', yanyu: '言语理解', panduan: '判断推理', changshi: '常识判断' };
const ANSWER_FORMATS = ['单选', '多选', '判断', '不定项'];
const mkVm = (state) => {
  const vm = { tab: 'todo', filterMod: '', kpFilter: '', qtFilter: '', ...state };
  const method = (name, args) => new Function('vm', 'NAMES', 'ANSWER_FORMATS', `return function(${args}){${fn(name, args)}}.bind(vm)`)(vm, NAMES, ANSWER_FORMATS);
  vm.modName = (k) => NAMES[k] || k;
  vm.tagName = method('tagName', 'm');
  vm.groupKey = method('groupKey', 'm');
  vm.fineType = method('fineType', 'm');
  vm.redoTypeQuery = method('redoTypeQuery', '');
  Object.defineProperty(vm, 'todoItems', { get: () => vm.items.filter((m) => !m.mastered) });
  Object.defineProperty(vm, 'doneItems', { get: () => vm.items.filter((m) => m.mastered) });
  Object.defineProperty(vm, 'fineTypes', { get: () => new Function('vm', `return (function(){${fn('fineTypes')}}).call(vm)`)(vm) });
  return vm;
};
const items = [
  { id: 1, module: 'shuliang', question_id: 11, question_type: '排列组合', type_group: '排列组合与概率' },
  { id: 2, module: 'shuliang', question_id: 12, question_type: '概率问题', type_group: '排列组合与概率' },
  { id: 3, module: 'shuliang', question_id: 13, question_type: '数量关系-排列组合与概率', type_group: '排列组合与概率' },
  { id: 4, module: 'shuliang', question_id: 14, question_type: '不定方程', type_group: '计算问题' },
  { id: 5, module: 'shuliang', question_id: null, question_type: '手录题型', type_group: null },
  { id: 6, module: 'yanyu', question_id: null, question_type: '', type_group: null },
  { id: 7, module: 'shuliang', question_id: 17, question_type: '概率问题', type_group: '排列组合与概率', mastered: 1 },
];

describe('R545 主标签 / 题型组聚合', () => {
  it('groupKey：有 type_group 用组名；手录回退细题型；无题型回退模块名', () => {
    const vm = mkVm({ items });
    expect(items.slice(0, 3).map((m) => vm.groupKey(m))).toEqual(['排列组合与概率', '排列组合与概率', '排列组合与概率']);
    expect(vm.groupKey(items[3])).toBe('计算问题');
    expect(vm.groupKey(items[4])).toBe('手录题型');
    expect(vm.groupKey(items[5])).toBe('言语理解');
  });
  it('fineType：细题型与组名不同才展示，前缀去掉后同名不重复', () => {
    const vm = mkVm({ items });
    expect(vm.fineType(items[0])).toBe('排列组合');
    expect(vm.fineType(items[2])).toBe('');
    expect(vm.fineType(items[4])).toBe('');
  });
  it('卡片头：主 tag 用 groupKey，细题型 tag 条件展示', () => {
    expect(book).toMatch(/<kg-tag tone="brand">\{\{ groupKey\(m\) \}\}<\/kg-tag>\s*<kg-tag v-if="fineType\(m\)" tone="neutral" class="finetag">\{\{ fineType\(m\) \}\}<\/kg-tag>/);
  });
});

describe('R545 细分 chips', () => {
  it('选中组内 ≥2 种细题型时出细分 chips（按数量排），已掌握行不计', () => {
    const vm = mkVm({ items, kpFilter: '排列组合与概率' });
    expect(vm.fineTypes).toEqual([
      { name: '排列组合', n: 1 },
      { name: '概率问题', n: 1 },
    ]);
  });
  it('未选组 / 组内单一细题型不出细分行', () => {
    expect(mkVm({ items }).fineTypes).toEqual([]);
    expect(mkVm({ items, kpFilter: '计算问题' }).fineTypes).toEqual([]);
  });
  it('模板：细分行随 fineTypes 出现，点 chip 切 qtFilter；切组/切模块/清筛选都清 qtFilter', () => {
    expect(book).toMatch(/<template v-if="fineTypes\.length">\s*<text class="sheet-k">\{\{ kpFilter \}\} · 细分<\/text>/);
    expect(book).toMatch(/@click="qtFilter = qtFilter === g\.name \? '' : g\.name"/);
    expect(book).toMatch(/@click="kpFilter = kpFilter === g\.name \? '' : g\.name; qtFilter = ''; kp3Filter = ''"/);
    expect(book).toMatch(/filterMod = ''; kpFilter = ''; qtFilter = ''; kp3Filter = ''/);
  });
});

describe('R545 重练查询串', () => {
  it('题型组 → sub=（覆盖组内全部细题型）；带模块与细分', () => {
    expect(mkVm({ items, kpFilter: '排列组合与概率' }).redoTypeQuery()).toBe('&sub=' + encodeURIComponent('排列组合与概率'));
    expect(mkVm({ items, kpFilter: '排列组合与概率', filterMod: 'shuliang', qtFilter: '概率问题' }).redoTypeQuery()).toBe(
      '&sub=' + encodeURIComponent('排列组合与概率') + '&module=shuliang&qtype=' + encodeURIComponent('概率问题'),
    );
  });
  it('手录细题型 → qtype=；模块名兜底 → module+noqt', () => {
    expect(mkVm({ items, kpFilter: '手录题型' }).redoTypeQuery()).toBe('&qtype=' + encodeURIComponent('手录题型'));
    expect(mkVm({ items, kpFilter: '言语理解' }).redoTypeQuery()).toBe('&module=yanyu&noqt=1');
  });
  it('redoAll 走 redoTypeQuery', () => {
    expect(book).toMatch(/if \(this\.kpFilter\) \{\s*q \+= this\.redoTypeQuery\(\);\s*\} else if \(this\.filterMod\)/);
  });
});

describe('R545 URL qt', () => {
  it('qt 只随 kp 序列化 / 解析', () => {
    expect(buildBookUrl({ kp: '排列组合与概率', qt: '概率问题' })).toBe(BOOK_PATH + '?kp=' + encodeURIComponent('排列组合与概率') + '&qt=' + encodeURIComponent('概率问题'));
    expect(buildBookUrl({ qt: '概率问题' })).toBe(BOOK_PATH);
    expect(parseBookOpts({ kp: encodeURIComponent('排列组合与概率'), qt: encodeURIComponent('概率问题') })).toMatchObject({ kp: '排列组合与概率', qt: '概率问题' });
    expect(parseBookOpts({ qt: '概率问题' })).toMatchObject({ kp: '', qt: '' });
    expect(parseBookOpts({ kp: 'a', qt: 'x'.repeat(41) })).toMatchObject({ kp: 'a', qt: '' });
  });
  it('book.vue 同步 qt 并在 applyPendingKp 校验后恢复', () => {
    expect(book).toMatch(/kp: this\.kpFilter, qt: this\.qtFilter, kp3: this\.kp3Filter/);
    expect(book).toMatch(/if \(p\.qt\) this\._pendingQt = p\.qt;/);
    expect(book).toMatch(/this\.qtFilter = qt && this\.items\.some\(\(m\) => this\.groupKey\(m\) === kp && this\.tagName\(m\) === qt\) \? qt : '';/);
  });
});
