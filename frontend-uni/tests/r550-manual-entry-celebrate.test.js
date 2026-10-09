// R550：① 错题本「手录错题」免 AI 自由录入（模块/题干/正确答案/我的答案/错因/解析 → POST /api/mistakes source='manual'，
// 服务端归一，question_id=NULL 走复习与 PDF 路径、不参与重练）；② 复习清零小结与同考点强化建议合为一屏：
// 「回错题本」始终直接回列表，强化建议随小结预取展示，不再「先弹推荐层、点下次再说才到列表」。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MANUAL_MODULES, MANUAL_LETTERS, emptyManualEntry, toggleLetter, manualEntryError, manualEntryBody, manualSavedToast,
} from '../src/book-manual-entry.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
const BOOK = read('../src/pages/book/book.vue')+read('../src/pages/book/review-ops.js');

describe('book-manual-entry 纯函数', () => {
  it('模块六选一（行测五模块 + 时政），字母 A-D', () => {
    expect(MANUAL_MODULES.map((m) => m.value)).toEqual(['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi', '时政']);
    expect(MANUAL_LETTERS).toEqual(['A', 'B', 'C', 'D']);
    expect(emptyManualEntry()).toEqual({ module: '', question: '', correct: '', picked: '', reason: '', explanation: '' });
  });

  it('toggleLetter 点亮/熄灭，升序去重（多选题可选多个）', () => {
    expect(toggleLetter('', 'B')).toBe('B');
    expect(toggleLetter('B', 'B')).toBe('');
    expect(toggleLetter('C', 'A')).toBe('AC');
    expect(toggleLetter('AC', 'C')).toBe('A');
    expect(toggleLetter('xyz', 'D')).toBe('D');
  });

  it('manualEntryError 按填写顺序给可读原因；正确/我的答案相同不算错题', () => {
    const f = emptyManualEntry();
    expect(manualEntryError(f)).toBe('请选择模块');
    f.module = 'yanyu';
    expect(manualEntryError(f)).toContain('请填写题干');
    f.question = ' x ';
    expect(manualEntryError(f)).toContain('请填写题干');
    f.question = '题干足够长';
    expect(manualEntryError(f)).toBe('请选择正确答案');
    f.correct = 'B';
    expect(manualEntryError(f)).toBe('');
    f.picked = 'B';
    expect(manualEntryError(f)).toContain('相同');
    f.picked = 'A';
    expect(manualEntryError(f)).toBe('');
    expect(manualEntryError(null)).toBe('请选择模块');
  });

  it('manualEntryBody 固定 source=manual、选填为 null、文本 trim 截断', () => {
    const body = manualEntryBody(
      { module: 'shuliang', question: '  1,3,6,10 第 5 项？\nA.13 B.14 C.15 D.16  ', correct: 'C', picked: '', reason: '', explanation: '   ' },
      'u-test',
    );
    expect(body).toEqual({
      uid: 'u-test',
      source: 'manual',
      module: 'shuliang',
      question_text: '1,3,6,10 第 5 项？\nA.13 B.14 C.15 D.16',
      correct_answer: 'C',
      user_answer: null,
      error_reason: null,
      explanation: null,
    });
    const long = manualEntryBody({ module: 'yanyu', question: '题'.repeat(3000), correct: 'A', picked: 'B', reason: '粗心大意', explanation: '解'.repeat(3000) }, 'u');
    expect(long.question_text.length).toBe(2000);
    expect(long.explanation.length).toBe(2000);
    expect(long.user_answer).toBe('B');
    expect(long.error_reason).toBe('粗心大意');
  });

  it('manualSavedToast 回包 id 已在列表 → 去重累计错次文案', () => {
    expect(manualSavedToast(7, [{ id: 7 }])).toContain('再错一次');
    expect(manualSavedToast(8, [{ id: 7 }])).toContain('已加入错题本');
    expect(manualSavedToast(8, null)).toContain('已加入错题本');
  });
});

describe('book.vue 源锁：手录错题 sheet 与 FAB 三入口', () => {
  it('FAB 顺序：手录错题 → 扫描答题卡 → 按卷码录入答案；旧「手动录入答案」文案不再出现在 FAB', () => {
    const fab = BOOK.slice(BOOK.indexOf('class="fabmenu"'), BOOK.indexOf('class="fab-main"'));
    const i1 = fab.indexOf('entryOpenSheet()">手录错题');
    const i2 = fab.indexOf('scanSheetPick()');
    const i3 = fab.indexOf('manualOpenSheet()">按卷码录入答案');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
    expect(fab).not.toContain('手动录入答案');
  });

  it('sheet 字段齐全：模块 chips / 题干 textarea / 正确答案与我的答案 A-D / 错因 chips / 解析 textarea / 错误提示 role=alert', () => {
    const sheet = BOOK.slice(BOOK.indexOf('v-model="entryOpen" title="手录错题"'), BOOK.indexOf('class="fabmenu"'));
    expect(sheet).toContain(':options="MANUAL_MODULES"');
    expect(sheet).toContain('v-model="entry.question"');
    expect(sheet).toContain('entry.correct = toggleLetter(entry.correct, L)');
    expect(sheet).toContain('entry.picked = toggleLetter(entry.picked, L)');
    expect(sheet).toContain(':model-value="entry.reason"');
    expect(sheet).toContain('v-model="entry.explanation"');
    expect(sheet).toContain('role="alert">{{ entryErr }}');
    expect(sheet).toContain('@click="entrySubmit"');
    expect(sheet).toContain('不参与「错题重练」');
  });

  it('提交：前置校验 → POST /api/mistakes（manualEntryBody）→ toast → 清表单关 sheet → load()；失败落 entryErr', () => {
    const m = /async entrySubmit\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK);
    expect(m).not.toBeNull();
    const body = m[1];
    expect(body).toContain('manualEntryError(this.entry)');
    expect(body).toContain("request('/api/mistakes', { method: 'POST', data: manualEntryBody(this.entry, anonUid()) })");
    expect(body).toContain('manualSavedToast(d && d.id, this.items)');
    expect(body).toContain('this.entry = emptyManualEntry()');
    expect(body).toContain('this.entryOpen = false');
    expect(body).toContain('await this.load()');
    expect(body).toContain('this.entryErr = (e && e.message)');
  });

  it('列表卡：source=manual 显「手录」标签（与「模考」互斥）；键盘导航在 entryOpen 时不抢键', () => {
    expect(BOOK).toContain(`<kg-tag v-else-if="m.source === 'manual'" tone="info">手录</kg-tag>`);
    expect(BOOK).toContain('this.manualOpen || this.entryOpen || this.celebrate');
  });
});

describe('book.vue 源锁：清零小结 × 强化建议合并', () => {
  it('不再有独立强化 sheet；强化卡内联在小结 sheet 内', () => {
    expect(BOOK).not.toContain('title="本轮复习完成！趁热打铁强化一下？"');
    expect(BOOK).not.toContain('>下次再说</kg-button>');
    const cb = BOOK.slice(BOOK.indexOf(':title="doneCopy.title"'), BOOK.indexOf('<!-- 列表模式 -->'));
    expect(cb).toContain('<view v-if="reinforce" class="rf rf-inline">');
    expect(cb).toContain('@click="startReinforce(reinforce)">练同考点：5 道没做过的题 ›');
    expect(cb).toContain('@click="closeCelebrate">回错题本</kg-button>');
    expect(cb).toContain('<kg-button v-else variant="primary" size="lg" block @click="closeCelebrate">回错题本 ›</kg-button>');
  });

  it('nextReview 末题：清旧建议 → 开小结 → 预取强化；closeCelebrate 只关层不再拉推荐/不弹 toast', () => {
    const nr = /nextReview\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK)[1];
    expect(nr.indexOf('this.reinforce = null')).toBeLessThan(nr.indexOf('this.celebrate = true'));
    expect(nr.indexOf('this.celebrate = true')).toBeLessThan(nr.indexOf('this.fetchReinforce()'));
    const cc = /closeCelebrate\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK)[1];
    expect(cc).toContain('this.celebrate = false');
    expect(cc).toContain('this.reinforce = null');
    expect(cc).not.toContain('fetchReinforce');
    const fr = /async fetchReinforce\(\) \{([\s\S]*?)\n {4}\},/.exec(BOOK)[1];
    expect(fr).toContain('if (!this.celebrate) return;');
    expect(fr).toContain('this.reinforce = d.picked || null;');
    expect(fr).not.toContain('showToast');
    expect(/startReinforce\(item\) \{[\s\S]*?this\.celebrate = false;/.test(BOOK)).toBe(true);
  });
});
