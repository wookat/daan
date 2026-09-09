// 练习结算态底部操作栏文案/动作（与 H5 practice.vue R553 完成页同层级：有错题时「只重练本组错题（N 题）」为主按钮、
// 「再来一组」降为次级；无错题或背题模式维持「再来一组 / 返回…」，返回文案按实际落点 back-label）。WXML 不能调函数，在页面层算好下发。

export type DoneAct = 'redo' | 'retry' | 'quit';

export interface DoneBar {
  primary: string;
  primaryAct: DoneAct;
  secondary: string;
  secondaryAct: DoneAct;
}

export function doneBarPlan(wrongCount: number | undefined, beiMode: boolean, back = '返回'): DoneBar {
  const n = Number(wrongCount) || 0;
  if (!beiMode && n > 0) {
    return { primary: `只重练本组错题（${n} 题）`, primaryAct: 'redo', secondary: '再来一组', secondaryAct: 'retry' };
  }
  return { primary: '再来一组', primaryAct: 'retry', secondary: back || '返回', secondaryAct: 'quit' };
}
