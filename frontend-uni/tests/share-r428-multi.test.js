import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { optionState } from '../src/option-state.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('R428 分享作答页多选（源文件锁）', () => {
  const src = read('../src/pkgA/share/share-q.vue');
  it('多选题点选只切换字母（复用 togglePickLetter，与服务端 normalize_answer 同序），确认后才提交；单选保持点选即提交', () => {
    expect(src).toMatch(/import \{ togglePickLetter \} from '\.\.\/\.\.\/exam-excl\.js'/);
    expect(src).toMatch(/pick\(k\)\s*\{[\s\S]*?if \(this\.isMulti\) \{\s*this\.multiSel = togglePickLetter\(this\.multiSel, k\);\s*return;\s*\}\s*this\.submit\(k\);/);
    expect(src).toMatch(/confirmMulti\(\)\s*\{[\s\S]*?this\.submit\(this\.multiSel\);/);
    expect(src).toMatch(/isMulti\(\)\s*\{\s*return !!\(this\.d && this\.d\.question && this\.d\.question\.multi\);/);
  });
  it('多选确认条只在未揭晓时出现，按钮无选择时置灰', () => {
    expect(src).toMatch(/<view v-if="isMulti && !revealed" class="multi-bar">/);
    // W5 起确认按钮走 kg-button size="lg"（--btn-h-lg 44px），disabled 口径不变
    expect(src).toMatch(/<kg-button variant="primary" size="lg" :disabled="!multiSel\.length \|\| submitting" @click="confirmMulti">/);
  });
  it('揭晓后正确项/错选项按字母包含标记（不再 k === answer）', () => {
    // W5 起选项走 kg-option-group：揭晓后 answer 拆字母数组、modelValue=optPicked（己选拆字母），right/wrong 由 option-state.js 按包含判定
    expect(src).toMatch(/<kg-option-group[\s\S]*?:model-value="optPicked"[\s\S]*?:answer="revealed \? String\(d\.question\.answer \|\| ''\)\.split\(''\) : \[\]"[\s\S]*?:revealed="revealed"/);
    expect(src).toMatch(/optPicked\(\)\s*\{[\s\S]*?return String\(v \|\| ''\)\.split\(''\);/);
    const ctx = { picked: ['A', 'B'], answer: ['B', 'D'], revealed: true };
    expect(optionState('B', ctx)).toBe('right');
    expect(optionState('D', ctx)).toBe('right');
    expect(optionState('A', ctx)).toBe('wrong');
    expect(src).not.toMatch(/right: k === right/);
  });
});
