// R567：错题卡「题型组 + 细分题型」双标签重复前缀。生产题库只读核实（09d664a4，H5 tagName 口径）：
// 细分名以「组名+分隔符」开头 10702 行（常识-法律-xx → 「法律」+「法律-xx」；逻辑判断(加强削弱)），
// 非测试错题 4/287；无分隔符前缀（政治常识 / 增长率比较）2222 行不切。只改展示，筛选值与 redo qtype 不变。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fineTypeLabel, qtypeName } from '../src/type-label.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');
const MP_BOOK = readFileSync(new URL('../../miniapp-native/miniprogram/pages/book/book.ts', import.meta.url), 'utf8');

// R567 生产复验 FAIL（P1，R545 起既有）：库内 question_type 已被后端 norm_qtype 去过「常识判断-」成「法律-个税」，
// H5 tagName 再无条件去首段成「个税」→ 细分 chip 筛选值 / redo qtype=个税 与库内不等 → /api/mistakes/redo 回 0 题「未能匹配到题库原题」。
// 生产只读：mistakes 含「-」的 question_type 全部不以模块名开头（模块前缀行 0），非测试 4 行（政治-理论 / 法律-民法典 / 法律-劳动）。
describe('qtypeName 与后端 norm_qtype 同口径', () => {
  it('只去「模块名-」前缀', () => {
    expect(qtypeName('常识判断-法律-个税')).toBe('法律-个税');
    expect(qtypeName('常识-法律-个税')).toBe('法律-个税');
    expect(qtypeName('言语理解-逻辑填空')).toBe('逻辑填空');
    expect(qtypeName('时政-单选')).toBe('单选');
  });
  it('细分名自带的「-」不切；空/只剩前缀原样', () => {
    expect(qtypeName('法律-个税')).toBe('法律-个税');
    expect(qtypeName('政治-理论')).toBe('政治-理论');
    expect(qtypeName('图形推理-空间类')).toBe('图形推理-空间类');
    expect(qtypeName('综合题组-年均增长率')).toBe('综合题组-年均增长率');
    expect(qtypeName('逻辑判断(加强削弱)')).toBe('逻辑判断(加强削弱)');
    expect(qtypeName('常识判断-')).toBe('常识判断-');
    expect(qtypeName('')).toBe('');
    expect(qtypeName(null)).toBe('');
  });
  it('H5 tagName 与小程序 tagName 均走该口径（redo qtype = 库内 question_type）', () => {
    expect(BOOK).toContain("if (!qt || ANSWER_FORMATS.includes(qt)) return this.modName(m.module);\n      return qtypeName(qt);");
    expect(BOOK).not.toContain("qt.split('-').slice(1).join('-') : qt;\n    },");
    expect(MP_BOOK).toContain("const QTYPE_MOD_PREFIXES = ['资料分析', '数量关系', '言语理解', '判断推理', '常识判断', '常识', '时政'];");
    expect(MP_BOOK).toContain('return QTYPE_MOD_PREFIXES.includes(qt.slice(0, i)) && rest ? rest : qt;');
  });
});

describe('fineTypeLabel', () => {
  it('组名 + 分隔符前缀去掉组名（- · / : （ ( ），括号包裹去尾括号', () => {
    expect(fineTypeLabel('法律', '法律-个税')).toBe('个税');
    expect(fineTypeLabel('政治', '政治-党史')).toBe('党史');
    expect(fineTypeLabel('逻辑判断', '逻辑判断(加强削弱)')).toBe('加强削弱');
    expect(fineTypeLabel('逻辑判断', '逻辑判断（真假话与分析推理）')).toBe('真假话与分析推理');
    expect(fineTypeLabel('图形推理', '图形推理·空间类')).toBe('空间类');
    expect(fineTypeLabel('资料分析', '资料分析/比重')).toBe('比重');
  });
  it('无分隔符的前缀不切（切掉失义）；不以组名开头 / 同名 / 空值原样', () => {
    expect(fineTypeLabel('政治', '政治常识')).toBe('政治常识');
    expect(fineTypeLabel('增长率', '增长率比较')).toBe('增长率比较');
    expect(fineTypeLabel('比重', '比重反算')).toBe('比重反算');
    expect(fineTypeLabel('增长率', '综合题组-年均增长率')).toBe('综合题组-年均增长率');
    expect(fineTypeLabel('法律', '法律')).toBe('法律');
    expect(fineTypeLabel('法律', '')).toBe('');
    expect(fineTypeLabel('', '法律-个税')).toBe('法律-个税');
    expect(fineTypeLabel(null, undefined)).toBe('');
  });
  it('只剩分隔符时回原文', () => {
    expect(fineTypeLabel('法律', '法律-')).toBe('法律-');
    expect(fineTypeLabel('逻辑判断', '逻辑判断()')).toBe('逻辑判断()');
  });
});

describe('book.vue 接线：展示走 label，筛选值仍是完整细分名', () => {
  it('卡面细分标签 / 细分 chips / 当前筛选 tag / 重练入口标题四处用 fineTypeLabel', () => {
    expect(BOOK).toContain("import { fineTypeLabel, qtypeName } from '../../type-label.js';");
    expect(BOOK).toContain('<kg-tag v-if="fineType(m)" tone="neutral" class="finetag">{{ fineLabel(m) }}</kg-tag>');
    expect(BOOK).toContain(`@click="qtFilter = qtFilter === g.name ? '' : g.name">{{ fineTypeLabel(kpFilter, g.name) }} ×{{ g.n }}</kg-tag>`);
    expect(BOOK).toContain("kpFilter + ' · ' + fineTypeLabel(kpFilter, qtFilter) : kpFilter) || modName(filterMod)");
    expect(BOOK).toContain("(qtFilter ? kpFilter + ' · ' + fineTypeLabel(kpFilter, qtFilter) : kpFilter) : rzFilter");
    expect(BOOK).toContain('fineLabel(m) {\n      return fineTypeLabel(m.type_group, this.fineType(m));\n    },');
  });
  it('筛选比较与 redo qtype 仍用 tagName / qtFilter 原值（未被 label 替换）', () => {
    expect(BOOK).toContain("if (this.kpFilter && this.qtFilter) base = base.filter((m) => this.tagName(m) === this.qtFilter);");
    expect(BOOK).toContain("if (this.qtFilter) q += '&qtype=' + encodeURIComponent(this.qtFilter);");
    expect(BOOK).toContain('const t = this.fineType(m);\n        if (!t) continue;\n        map[t] = (map[t] || 0) + 1;');
  });
});
