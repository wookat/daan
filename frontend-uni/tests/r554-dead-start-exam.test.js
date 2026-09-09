// R554：practice.vue `startExam(full)` 自 60402715（2026-08-03 全真模考 v1）起入口改为 goMini → /pkgA/exam/exam?mini=1 与
// goExamList → /pkgA/exam/list，源码再无调用方；R553 复验也确认生产不可达（UNTESTED）。此处删除死码并锁：
// ① practice.vue 不再定义/调用 startExam；② 模考仍由 exam 分包承接（goMini/goExamList 保留）；③ 按卷计时模考（startPaper→examMode）不受影响。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const PRACTICE = readFileSync(join(SRC, 'pages/practice/practice.vue'), 'utf8');

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(vue|js|ts)$/.test(f)) out.push(p);
  }
  return out;
}

describe('R554 startExam 死码清理', () => {
  it('practice.vue 不再定义 startExam；src/ 全树无调用方', () => {
    expect(PRACTICE).not.toMatch(/startExam\s*\(/);
    const hits = walk(SRC).filter((p) => /startExam\s*\(/.test(readFileSync(p, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('模考入口仍走 exam 分包：goMini → exam?mini=1，goExamList → exam/list', () => {
    expect(PRACTICE).toMatch(/goMini\(\) \{\n\s+uni\.navigateTo\(\{ url: '\/pkgA\/exam\/exam\?mini=1' \}\);/);
    expect(PRACTICE).toMatch(/goExamList\(\) \{\n\s+uni\.navigateTo\(\{ url: '\/pkgA\/exam\/list' \}\);/);
  });
  it('按卷计时模考态（examMode/examLeft/finishExam/confirmFinishExam）保留，由 startPaper 驱动', () => {
    const i = PRACTICE.indexOf('async startPaper(p, untimed = false, wantWrong = false) {');
    const j = PRACTICE.indexOf('confirmFinishExam() {', i);
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    const fn = PRACTICE.slice(i, j);
    expect(fn).toMatch(/if \(untimed\) \{\n\s+this\.examMode = false;/);
    expect(fn).toMatch(/\} else \{\n\s+this\.examMode = true;\n\s+this\.examLeft = 120 \* 60;/);
    expect(fn).toMatch(/this\.examTimer = setInterval/);
    expect(PRACTICE).toMatch(/\n {4}finishExam\(\) \{/);
    expect(PRACTICE).toMatch(/\n {4}confirmFinishExam\(\) \{/);
  });
});
