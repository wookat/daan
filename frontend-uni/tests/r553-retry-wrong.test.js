// R553：H5 普通练习完成页补「只重练本组错题（N 题）」——此前仅按卷完成页有「重练本卷错题」，
// 普通练习（生产 30 天 answer_log 302/309 行来自普通/直达练习）答错后只能「再来一组」换新题；小程序早有 onRedoWrong。
// 统一入口 wrongRetryPlan(items, ptitle)：无答错题 → null；文案随归卷态；就地重开会话并落 pendingSession（R548 口径）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { wrongRetryPlan, paperWrongItems } from '../src/paper-continue.js';

const PRACTICE = readFileSync(fileURLToPath(new URL('../src/pages/practice/practice.vue', import.meta.url)), 'utf8');

const items = [
  { id: 1, answer: 'A', _picked: 'A' },
  { id: 2, answer: 'B', _picked: 'C', _saved: true, _mid: 9, _logged: true },
  { id: 3, answer: 'D', _picked: 'A' },
  { id: 4, answer: 'C' },
];

describe('R553 wrongRetryPlan 完成页错题重练入口', () => {
  it('普通练习：有答错题 → 「只重练本组错题（N 题）」', () => {
    expect(wrongRetryPlan(items, null)).toEqual({ n: 2, label: '只重练本组错题（2 题）', toast: '只重练本组错题' });
    expect(wrongRetryPlan(items, '')).toEqual({ n: 2, label: '只重练本组错题（2 题）', toast: '只重练本组错题' });
  });
  it('按卷练习：文案保持「重练本卷错题（N 题）」', () => {
    expect(wrongRetryPlan(items, '2015年新疆卷')).toEqual({ n: 2, label: '重练本卷错题（2 题）', toast: '只重练本卷错题' });
  });
  it('全对 / 未作答 / 非数组 → null（不显示）', () => {
    expect(wrongRetryPlan([{ id: 1, answer: 'A', _picked: 'A' }], null)).toBeNull();
    expect(wrongRetryPlan([{ id: 1, answer: 'A' }], '卷')).toBeNull();
    for (const v of [null, undefined, {}, 'x', 0]) expect(wrongRetryPlan(v, null)).toBeNull();
  });
  it('n 与 paperWrongItems 题集一致（重练题集清除 _picked/_saved/_mid/_logged）', () => {
    const wrong = paperWrongItems(items);
    expect(wrong.length).toBe(wrongRetryPlan(items, null).n);
    expect(wrong.map((q) => q.id)).toEqual([2, 3]);
    for (const q of wrong) {
      expect(q._picked).toBeUndefined();
      expect(q._saved).toBeUndefined();
      expect(q._mid).toBeUndefined();
      expect(q._logged).toBeUndefined();
    }
  });
});

describe('R553 practice.vue 完成页接线', () => {
  it('引入 wrongRetryPlan，模板方法 wrongRetry() 规避非响应式 _ptitle', () => {
    expect(PRACTICE).toMatch(/import \{[^}]*wrongRetryPlan[^}]*\} from '\.\.\/\.\.\/paper-continue\.js'/);
    expect(PRACTICE).toContain('wrongRetry() {\n      return wrongRetryPlan(this.items, this._ptitle);');
  });
  it('普通与按卷完成页共用一个重练入口：R565 起走固定底栏 doneBar()，主位文案取 wrongRetryPlan().label（不再是行内 kg-button）', () => {
    expect(PRACTICE).toContain(':primary-text="doneBar().primary"');
    expect(PRACTICE).toContain('@primary="doneAct(doneBar().primaryAct)"');
    expect(PRACTICE).toContain("if (act === 'redo') this.retryWrong();");
    expect(PRACTICE).not.toContain('@click="retryWrong"');
    expect(PRACTICE).not.toContain('retryPaperWrong');
    expect(PRACTICE).not.toContain('paperWrongN()');
  });
  it('有错题时「再来一组」/「回卷库」降为底栏 ghost 次位，避免与重练按钮双主按钮（doneBarPlan 单测见 r565-done-bar）', () => {
    expect(PRACTICE).toContain(':secondary-text="doneBar().secondary"');
    expect(PRACTICE).toContain("else if (act === 'retry') this.retryGroup();");
    expect(PRACTICE).toContain("else if (act === 'list') this.goExamList();");
    expect(PRACTICE).not.toContain('@click="retryGroup"');
    expect(PRACTICE).not.toContain('@click="goExamList"');
  });
  it('retryWrong 就地重开会话：保留 lastModule/_source/_ptitle，重置计数，落 pendingSession，toast 随归卷态', () => {
    const i = PRACTICE.indexOf('    retryWrong() {');
    expect(i).toBeGreaterThan(0);
    const body = PRACTICE.slice(i, PRACTICE.indexOf('    // 完成页「再来一组」', i));
    expect(body).toContain('const plan = wrongRetryPlan(this.items, this._ptitle);');
    expect(body).toContain('const wrong = paperWrongItems(this.items);');
    expect(body).toContain('if (!plan || !wrong.length) return;');
    expect(body).toContain('this.items = wrong;');
    expect(body).toContain('this.resultSent = false;');
    expect(body).toContain('this.autoSaved = false;');
    expect(body).toContain('this.session = true;');
    expect(body).toContain('this.saveSession();');
    expect(body).toContain("uni.showToast({ title: plan.toast, icon: 'none' });");
    expect(body).not.toMatch(/this\.lastModule\s*=/);
    expect(body).not.toMatch(/this\._ptitle\s*=/);
    expect(body).not.toMatch(/this\._source\s*=/);
    expect(body).not.toMatch(/this\._redoItems\s*=/);
  });
});
