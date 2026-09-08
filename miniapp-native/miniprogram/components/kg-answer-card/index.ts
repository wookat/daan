// KgAnswerCard 小程序版：答题卡（底部 sheet 或内嵌 grid）
// cells: [{ no, state }]  state: '' | 'done' | 'marked' | 'right' | 'wrong' | 'skip'
// 事件：jump{index} / close / primary / secondary
export interface AnswerCell {
  no: number;
  state: '' | 'done' | 'marked' | 'right' | 'wrong' | 'skip';
  /** 可选模块名，用于分模块分组 */
  module?: string;
}

interface CellGroup {
  key: string;
  module: string;
  cells: Array<AnswerCell & { i: number }>;
}

/** grouped=false 时全部题号归为一组（不按 module 断行）；grouped=true 才按相邻 module 分段 */
export function groupCells(cells: AnswerCell[], grouped = true): CellGroup[] {
  const list = cells || [];
  if (!grouped) return list.length ? [{ key: 'all', module: '', cells: list.map((c, i) => ({ ...c, i })) }] : [];
  const groups: CellGroup[] = [];
  list.forEach((c, i) => {
    const m = c.module || '';
    const last = groups[groups.length - 1];
    if (last && last.module === m) last.cells.push({ ...c, i });
    else groups.push({ key: m + '#' + i, module: m, cells: [{ ...c, i }] });
  });
  return groups;
}

Component({
  properties: {
    /** sheet 模式：visible 控制弹层；inline 模式：直接渲染 grid */
    inline: { type: Boolean, value: false },
    visible: { type: Boolean, value: false },
    title: { type: String, value: '答题卡' },
    cells: { type: Array, value: [] },
    current: { type: Number, value: -1 },
    /** 底部统计文案（sheet 模式） */
    footText: { type: String, value: '' },
    primaryText: { type: String, value: '' },
    secondaryText: { type: String, value: '' },
    loading: { type: Boolean, value: false },
    /** 判分模式图例（报告） */
    graded: { type: Boolean, value: false },
    /** 是否按模块分组显示 */
    grouped: { type: Boolean, value: false },
  },
  data: { groups: [] as CellGroup[] },
  observers: {
    'cells, grouped'(cells: AnswerCell[], grouped: boolean) {
      this.setData({ groups: groupCells(cells, grouped) });
    },
  },
  methods: {
    onJump(e: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('jump', { index: Number(e.currentTarget.dataset.i) });
    },
    onClose() {
      this.triggerEvent('close');
    },
    onVisible(e: WechatMiniprogram.CustomEvent<{ visible: boolean }>) {
      if (!e.detail.visible) this.triggerEvent('close');
    },
    onPrimary() {
      this.triggerEvent('primary');
    },
    onSecondary() {
      this.triggerEvent('secondary');
    },
  },
});
