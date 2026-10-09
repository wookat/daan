// R568：① 错题本更多操作层标题与卡面同口径（组名 · 展示简称），不再显示 raw「法律-个税 · 更多操作」（R567-1）；
// ② 统计页 hero「总正确率」0 题作答时显示「—」而非「0%」（生产 375 截图：只有错题无作答时 by_module 非空 → 满页仪表盘，hero 却 0%）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fineTypeLabel, qtypeName } from '../src/type-label.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8')+readFileSync(new URL('../src/pages/book/review-ops.js', import.meta.url), 'utf8');
const STATS = readFileSync(new URL('../src/pages/stats/stats.vue', import.meta.url), 'utf8');

// 从 book.vue 抠出 moreTitle 方法体，用与页面同口径的 groupKey/fineType/fineLabel/tagName 上下文求值
function moreTitleOf(m) {
  const src = BOOK.match(/moreTitle\(m\) \{\n([\s\S]*?)\n {4}\},/)[1];
  const ANSWER_FORMATS = ['单选', '多选', '判断', '不定项'];
  const ctx = {
    modName: (mod) => ({ changshi: '常识判断', yanyu: '言语理解' })[mod] || mod || '',
    tagName(x) {
      const qt = x.question_type || '';
      if (!qt || ANSWER_FORMATS.includes(qt)) return this.modName(x.module);
      return qtypeName(qt);
    },
    groupKey(x) {
      return x.type_group || this.tagName(x) || '其他';
    },
    fineType(x) {
      if (!x.type_group || !x.question_type) return '';
      const t = this.tagName(x);
      return t && t !== x.type_group ? t : '';
    },
    fineLabel(x) {
      return fineTypeLabel(x.type_group, this.fineType(x));
    },
  };
  return new Function('m', src).call(ctx, m);
}

describe('更多操作层标题（moreTitle）', () => {
  it('细分题型：组名 · 简称（与卡面双标签、筛选 tag 同口径）', () => {
    expect(moreTitleOf({ type_group: '法律', question_type: '法律-个税', module: 'changshi' })).toBe('法律 · 个税');
    expect(moreTitleOf({ type_group: '逻辑判断', question_type: '逻辑判断(加强削弱)', module: 'panduan' })).toBe('逻辑判断 · 加强削弱');
    expect(moreTitleOf({ type_group: '政治', question_type: '政治常识', module: 'changshi' })).toBe('政治 · 政治常识');
  });
  it('无细分（题型即组名 / 无 type_group / 答题格式 / 手录空值）回落到 tagName，不出现「· 」孤儿', () => {
    expect(moreTitleOf({ type_group: '翻译推理', question_type: '翻译推理', module: 'panduan' })).toBe('翻译推理');
    expect(moreTitleOf({ question_type: '成语填空', module: 'yanyu' })).toBe('成语填空');
    expect(moreTitleOf({ type_group: '常识判断', question_type: '单选', module: 'changshi' })).toBe('常识判断');
    expect(moreTitleOf({ module: 'changshi', source: 'manual' })).toBe('常识判断');
    expect(moreTitleOf({ module: 'zzz' })).toBe('zzz');
  });
  it('接线：sheet 标题走 moreTitle；筛选比较 / redo qtype 仍是原值', () => {
    expect(BOOK).toContain(`:title="moreSheet ? moreTitle(moreSheet.m) + ' · 更多操作' : ''"`);
    expect(BOOK).not.toContain("tagName(moreSheet.m) + ' · 更多操作'");
    expect(BOOK).toContain("if (this.kpFilter && this.qtFilter) base = base.filter((m) => this.tagName(m) === this.qtFilter);");
    expect(BOOK).toContain("if (this.qtFilter) q += '&qtype=' + encodeURIComponent(this.qtFilter);");
  });
});

describe('统计页 hero 总正确率', () => {
  it('0 题作答显示「—」，有作答显示百分比', () => {
    expect(STATS).toContain("{ label: '总正确率', value: this.totalDone ? this.accPct + '%' : '—', tone: 'ok' },");
  });
});
