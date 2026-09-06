import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    expect(src).toMatch(/class="multi-ok" :class="\{ dis: !multiSel\.length \|\| submitting \}"/);
  });
  it('揭晓后正确项/错选项按字母包含标记（不再 k === answer）', () => {
    expect(src).toMatch(/right: right\.includes\(k\), wrong: myPick\.includes\(k\) && !right\.includes\(k\)/);
    expect(src).not.toMatch(/right: k === right/);
  });
});
