import { describe, it, expect } from 'vitest';
import { isExplanationCovered, normalizeExplanation } from '../src/exp-dup.js';

const EXPL = '第一步，本题考查增长率计算。第二步，根据材料 2019 年同比增长 12.5%，故选 A。';

describe('isExplanationCovered', () => {
  it('hs 全文包含 ≥20 字解析 → true（含首尾空白）', () => {
    expect(isExplanationCovered('【方法】' + EXPL + '【总结】速算即可。', EXPL)).toBe(true);
    expect(isExplanationCovered('前言 ' + EXPL, '  ' + EXPL + '\n')).toBe(true);
  });

  it('hs 不包含 → false', () => {
    expect(isExplanationCovered('花生十三：直接看选项差值即可。', EXPL)).toBe(false);
    expect(isExplanationCovered('', EXPL)).toBe(false);
  });

  it('短文本边界：trim 后 <20 字一律 false，恰 20 字 true', () => {
    const s19 = '一二三四五六七八九十一二三四五六七八九';
    const s20 = s19 + '十';
    expect(isExplanationCovered('前缀' + s19 + '后缀', s19)).toBe(false);
    expect(isExplanationCovered('前缀' + s20 + '后缀', s20)).toBe(true);
    expect(isExplanationCovered('前缀' + s20 + '后缀', '   ')).toBe(false);
  });

  it('非字符串入参 fail-closed', () => {
    expect(isExplanationCovered(null, EXPL)).toBe(false);
    expect(isExplanationCovered(EXPL, undefined)).toBe(false);
    expect(isExplanationCovered(EXPL, 123)).toBe(false);
  });
});

describe('isExplanationCovered 近重复（归一化 + 句级覆盖）', () => {
  const HS = '【方法】截位直除。第一步，本题考查增长率计算。第二步，根据材料 2019 年同比增长 12.5%，2018 年为 8%，差值 4.5 个百分点。第三步，直除首位商 1。故选 A。';

  it('仅空白/全半角标点/大小写不同 → true', () => {
    const e = '第一步，本题考查增长率计算。\n第二步， 根据材料 2019 年同比增长 12.5%，2018 年为 8%，差值 4.5 个百分点。第三步，直除首位商 1。';
    expect(isExplanationCovered(HS, e.replace(/，/g, ',').replace(/。/g, '.').replace(/\s+/g, ''))).toBe(true);
    expect(isExplanationCovered(HS, e.replace(/2019/, '２０１９').replace(/%/g, '％'))).toBe(true);
  });

  it('结尾收束句不同（故选 A / 确认答案为 A / 因此本题选 A. / 无收束句）→ 仍视为覆盖', () => {
    const body = '第一步，本题考查增长率计算。第二步，根据材料 2019 年同比增长 12.5%，2018 年为 8%，差值 4.5 个百分点。第三步，直除首位商 1。';
    for (const tail of ['故选 A。', '确认答案为 A', '因此，本题选 A。', '综上所述，答案为A项。', '']) {
      expect(isExplanationCovered(HS, body + tail), tail).toBe(true);
    }
    expect(normalizeExplanation('……差值 4.5 个百分点。故选 A。')).toBe('……差值4.5个百分点.');
    expect(normalizeExplanation('故选 B')).toBe('');
  });

  it('句级覆盖率 ≥0.8 → true；官方解析多出一整段独有内容 → false', () => {
    const shared = '第一步，本题考查增长率计算。第二步，根据材料 2019 年同比增长 12.5%，2018 年为 8%，差值 4.5 个百分点。第三步，直除首位商 1。';
    expect(isExplanationCovered(HS, shared + '故选 A。')).toBe(true);
    // 多出一句 9 字：覆盖 64/73 ≈ 0.88 → true；下面多出 61 字：64/125 ≈ 0.51 → false
    expect(isExplanationCovered(HS, shared + '注意基期需先折算。')).toBe(true);
    const extra = '此外还需排除 B、C 两项：B 项把现期误作基期，C 项将百分数与百分点混用，D 项数据来源不明，均不符合题意，逐项验证后方可确定。';
    expect(isExplanationCovered(HS, shared + extra)).toBe(false);
  });

  it('句序不同但每句都在 hs 中 → true；完全不同内容 → false', () => {
    expect(isExplanationCovered(HS, '第三步，直除首位商 1。第一步，本题考查增长率计算。第二步，根据材料 2019 年同比增长 12.5%，2018 年为 8%，差值 4.5 个百分点。')).toBe(true);
    expect(isExplanationCovered(HS, '本题考查言语理解中的主旨概括，文段首句提出观点，后文举例论证，故选 B。')).toBe(false);
  });

  it('hs 归一化后为空 → false', () => {
    expect(isExplanationCovered('故选 A。', EXPL)).toBe(false);
  });
});
