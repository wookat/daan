import { describe, it, expect } from 'vitest';
import { OPTION_STATES, optionState, nextPicked } from '../src/option-state';

describe('KgOptionGroup 7 态（COMPONENTS §2.1）', () => {
  it('状态集合', () => {
    expect(OPTION_STATES).toEqual(['idle', 'selected', 'right', 'wrong', 'dim', 'excluded', 'disabled']);
  });

  it('作答中：idle / selected / excluded', () => {
    expect(optionState('A', { picked: '' })).toBe('idle');
    expect(optionState('A', { picked: 'A' })).toBe('selected');
    expect(optionState('B', { picked: 'A', excluded: ['B'] })).toBe('excluded');
  });

  it('揭晓后：答案 right、选错 wrong、其余 dim；只读未揭晓 disabled', () => {
    const ctx = { picked: 'B', answer: 'A', revealed: true };
    expect(optionState('A', ctx)).toBe('right');
    expect(optionState('B', ctx)).toBe('wrong');
    expect(optionState('C', ctx)).toBe('dim');
    expect(optionState('A', { readonly: true })).toBe('disabled');
    expect(optionState('A', { readonly: true, revealed: true, answer: 'A' })).toBe('right');
  });

  it('多选：答案数组、picked 数组，toggle 后有序', () => {
    expect(optionState('B', { picked: ['A', 'B'], answer: ['A', 'B'], revealed: true })).toBe('right');
    expect(nextPicked('C', { picked: ['A'], multiple: true })).toEqual(['A', 'C']);
    expect(nextPicked('A', { picked: ['A', 'C'], multiple: true })).toEqual(['C']);
    expect(nextPicked('B', { picked: 'A' })).toBe('B');
  });

  it('锁定或已排除的选项点击无效', () => {
    expect(nextPicked('A', { revealed: true })).toBeNull();
    expect(nextPicked('A', { readonly: true })).toBeNull();
    expect(nextPicked('A', { excluded: ['A'] })).toBeNull();
  });
});
