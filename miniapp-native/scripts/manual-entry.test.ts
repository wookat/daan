// R550：错题本「手录错题」自由录入（免 AI / 不对回题库，与 H5 book-manual-entry.js 同口径）
// + 复习清零小结与强化建议合为一层、「回错题本」直接回列表。
// 运行：cd miniapp-native && ../frontend-uni/node_modules/.bin/vitest run --config scripts/vitest.config.mts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  emptyManualEntry,
  letterRow,
  MANUAL_LETTERS,
  MANUAL_MODULES,
  manualEntryBody,
  manualEntryError,
  manualSavedToast,
  toggleLetter,
} from '../miniprogram/utils/manual-entry';

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('manual-entry 表单口径（与 H5 同）', () => {
  it('模块 6 项与后端 MANUAL_MODULES 一致；字母 A-D', () => {
    expect(MANUAL_MODULES.map((m) => m.value)).toEqual(['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', '时政']);
    expect(MANUAL_LETTERS).toEqual(['A', 'B', 'C', 'D']);
  });
  it('toggleLetter 升序去重、再点取消；letterRow 点亮态', () => {
    expect(toggleLetter('', 'B')).toBe('B');
    expect(toggleLetter('B', 'A')).toBe('AB');
    expect(toggleLetter('AB', 'B')).toBe('A');
    expect(toggleLetter('x', 'C')).toBe('C');
    expect(letterRow('AC').map((r) => r.on)).toEqual([true, false, true, false]);
  });
  it('manualEntryError：模块→题干≥2→正确答案→我的答案≠正确答案', () => {
    const f = emptyManualEntry();
    expect(manualEntryError(f)).toBe('请选择模块');
    f.module = 'yanyu';
    expect(manualEntryError(f)).toBe('请填写题干（可连选项一起粘贴）');
    f.question = ' 题 ';
    expect(manualEntryError(f)).toBe('请填写题干（可连选项一起粘贴）');
    f.question = '题干';
    expect(manualEntryError(f)).toBe('请选择正确答案');
    f.correct = 'B';
    f.picked = 'B';
    expect(manualEntryError(f)).toBe('我的答案与正确答案相同，不算错题');
    f.picked = 'A';
    expect(manualEntryError(f)).toBe('');
    f.picked = '';
    expect(manualEntryError(f)).toBe('');
    expect(manualEntryError(null)).toBe('请选择模块');
  });
  it('manualEntryBody：source=manual、trim、选填为 null、2000 截断', () => {
    const f = { ...emptyManualEntry(), module: 'ziliao', question: '  Q\nA. 1\nB. 2 ', correct: 'B', picked: 'A', reason: '', explanation: '  ' };
    expect(manualEntryBody(f)).toEqual({
      source: 'manual',
      module: 'ziliao',
      question_text: 'Q\nA. 1\nB. 2',
      correct_answer: 'B',
      user_answer: 'A',
      error_reason: null,
      explanation: null,
    });
    const long = { ...f, picked: '', reason: '粗心大意', question: 'x'.repeat(2500), explanation: 'y'.repeat(2500) };
    const b = manualEntryBody(long);
    expect(b.question_text.length).toBe(2000);
    expect(b.explanation && b.explanation.length).toBe(2000);
    expect(b.user_answer).toBeNull();
    expect(b.error_reason).toBe('粗心大意');
  });
  it('manualSavedToast：回包 id 已在列表 → 记为再错一次', () => {
    expect(manualSavedToast(7, [{ id: 7 }])).toBe('该题已在错题本，已记为再错一次');
    expect(manualSavedToast(8, [{ id: 7 }])).toBe('已加入错题本，之后会安排复习');
  });
});

describe('book 页接入', () => {
  const ts = read('../miniprogram/pages/book/book.ts');
  const wxml = read('../miniprogram/pages/book/book.wxml');
  const api = read('../miniprogram/api/index.ts');

  it('工具格「手录错题」开自由录入 sheet；卷码录入改为次级入口', () => {
    expect(ts).toContain("{ key: 'manual', icon: 'pencil-line', label: '手录错题' }");
    expect(ts).toContain("else if (k === 'manual') this.onEntryOpen();");
    expect(wxml).toContain('<kg-sheet visible="{{entryOpen}}" title="手录错题" bind:close="onEntryClose">');
    expect(wxml).toContain('<kg-sheet visible="{{manualOpen}}" title="按卷码录入答案" bind:close="onManualClose">');
    expect(wxml).toContain('bind:click="onEntryToPaper">有纸质试卷？按卷码录入答题卡 ›</kg-button>');
    expect(ts).toContain("import { emptyManualEntry, letterRow, MANUAL_MODULES, manualEntryBody, manualEntryError, manualSavedToast, toggleLetter } from '../../utils/manual-entry';");
  });
  it('表单：模块 chips / 题干 textarea / 正确答案+我的答案 A-D / 错因 chips / 解析 textarea / 错误提示 / 提交', () => {
    expect(wxml).toContain('options="{{manualModOpts}}" value="{{entry.module}}" bind:change="onEntryModule"');
    expect(wxml).toContain('<t-textarea value="{{entry.question}}"');
    expect(wxml).toContain('maxlength="{{2000}}" indicator autosize="{{entryTaSize}}"');
    expect(wxml).toContain('wx:for="{{entryCorrectRow}}" wx:key="L" class="manual-opt num {{item.on ? \'on\' : \'\'}}" data-l="{{item.L}}" bind:tap="onEntryCorrect"');
    expect(wxml).toContain('wx:for="{{entryPickedRow}}" wx:key="L" class="manual-opt num bad {{item.on ? \'on\' : \'\'}}" data-l="{{item.L}}" bind:tap="onEntryPicked"');
    expect(wxml).toContain('options="{{reasonOpts}}" value="{{entry.reason}}" bind:change="onEntryReason"');
    expect(wxml).toContain('<t-textarea value="{{entry.explanation}}"');
    expect(wxml).toContain('<text wx:if="{{entryErr}}" class="entry-err">{{entryErr}}</text>');
    expect(wxml).toContain('loading="{{entrySaving}}" bind:click="onEntrySubmit">');
    expect(wxml).toContain('不用 AI、不消耗额度；手录题参与复习计划与 PDF 导出，不参与「错题重练」');
  });
  it('提交：前置校验→postManualMistake→toast→打点→重拉列表；失败留在 sheet 显示原因', () => {
    expect(api).toContain('export function postManualMistake(m: {');
    expect(api).toContain("  source: 'manual';");
    expect(ts).toContain('const err = manualEntryError(this.data.entry);');
    expect(ts).toContain('const d = await postManualMistake(manualEntryBody(this.data.entry));');
    expect(ts).toContain('const tip = manualSavedToast(d && d.id, this.data.all);');
    expect(ts).toContain("trackEvent('manual_entry_open');");
    expect(ts).toContain("trackEvent('manual_entry_save');");
    expect(ts).toContain("this.setData({ entryErr: (e instanceof Error && e.message) || '保存失败，请重试' });");
    expect(ts).not.toContain('mistakeAnalysis(manualEntryBody');
  });
  it('列表卡 source=manual 显「手录」标签', () => {
    expect(wxml).toContain('<text wx:if="{{item.source === \'manual\'}}">手录</text>');
    expect(read('../miniprogram/api/types.ts')).toContain('source?: string | null;');
  });
});

describe('复习清零小结 × 强化建议合层（与 H5 同）', () => {
  const ts = read('../miniprogram/pages/book/book.ts');
  const wxml = read('../miniprogram/pages/book/book.wxml');

  it('清零即开小结并预取强化建议；不再有独立强化 sheet 与「下次再说」', () => {
    expect(ts).toContain("trackEvent('review_done_celebrate', 'book');\n      this.fetchReinforce();");
    expect(wxml).not.toContain('本轮复习完成！趁热打铁强化一下？');
    expect(wxml).not.toContain('下次再说');
    expect(ts).not.toContain('onReinforceClose');
    expect(ts).not.toContain("wx.showToast({ title: '本轮复习完成！', icon: 'success' });");
  });
  it('建议随小结同层展示；有建议主按钮「强化 5 道新题」+ 次级「换个考点 / 回错题本」；无建议单一「回错题本」', () => {
    expect(wxml).toContain('<view wx:if="{{reinforce}}" class="rf rf-inline">');
    expect(wxml).toContain('bind:click="onStartReinforce">强化 5 道新题（未做过）›</kg-button>');
    expect(wxml).toContain('<kg-button wx:if="{{reinforceItems.length > 1}}" variant="text" size="md" bind:click="onSwapReinforce">换个考点</kg-button>');
    expect(wxml).toContain('<kg-button variant="text" size="md" bind:click="onCloseCelebrate">回错题本</kg-button>');
    expect(wxml).toContain('<kg-button wx:else variant="primary" size="lg" block bind:click="onCloseCelebrate">回错题本</kg-button>');
  });
  it('fetchReinforce 小结已关则丢弃回包；回错题本直接关闭清建议；开始强化同时关小结', () => {
    expect(ts).toContain('if (!this.data.celebrate) return;\n      this.setData({ reinforceItems: d.items || [], reinforce: d.picked || null');
    expect(ts).toContain("onCloseCelebrate() {\n    if (!this.data.celebrate) return;\n    this.setData({ celebrate: false, reinforce: null });\n  },");
    expect(ts).toContain('this.setData({ reinforce: null, celebrate: false });');
  });
});
