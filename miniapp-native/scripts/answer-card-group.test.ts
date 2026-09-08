// kg-answer-card groupCells（W15-M1）：grouped=false 时全部题号单组渲染（不再按 module 断行/留组间距），
// grouped=true 时按相邻 module 分段，序号 i 为全局下标。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { describe, expect, it } from 'vitest';

let registered: Record<string, unknown> | null = null;
(globalThis as Record<string, unknown>).Component = (cfg: Record<string, unknown>) => {
  registered = cfg;
};

const { groupCells } = await import('../miniprogram/components/kg-answer-card/index');

const cells = [
  { no: 1, state: 'done' as const, module: '言语' },
  { no: 2, state: '' as const, module: '言语' },
  { no: 3, state: 'marked' as const, module: '数量' },
  { no: 4, state: '' as const, module: '判断' },
  { no: 5, state: 'done' as const, module: '判断' },
  { no: 6, state: '' as const, module: '资料' },
  { no: 7, state: '' as const, module: '常识' },
];

describe('groupCells', () => {
  it('组件已注册且 observers 同时监听 cells 与 grouped', () => {
    expect(registered).not.toBeNull();
    const obs = (registered as { observers: Record<string, unknown> }).observers;
    expect(Object.keys(obs)).toContain('cells, grouped');
  });

  it('grouped=false：7 题（5 个模块）只有 1 组、无模块名、下标连续', () => {
    const g = groupCells(cells, false);
    expect(g).toHaveLength(1);
    expect(g[0].module).toBe('');
    expect(g[0].cells.map((c) => c.i)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(g[0].cells.map((c) => c.no)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('grouped=true：按相邻 module 分 5 段，i 为全局下标', () => {
    const g = groupCells(cells, true);
    expect(g.map((x) => x.module)).toEqual(['言语', '数量', '判断', '资料', '常识']);
    expect(g.map((x) => x.cells.length)).toEqual([2, 1, 2, 1, 1]);
    expect(g[2].cells.map((c) => c.i)).toEqual([3, 4]);
  });

  it('默认参数保持分组（兼容旧调用）；空数组两种模式均为空', () => {
    expect(groupCells(cells)).toHaveLength(5);
    expect(groupCells([], false)).toEqual([]);
    expect(groupCells([], true)).toEqual([]);
  });
});
