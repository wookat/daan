import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toggleExcl, togglePickLetter } from '../src/exam-excl.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

describe('togglePickLetter（R414 模考多选题点选）', () => {
  it('切换字母并按升序拼接，与服务端 normalize_answer 同序', () => {
    expect(togglePickLetter('', 'D')).toBe('D');
    expect(togglePickLetter('D', 'B')).toBe('BD');
    expect(togglePickLetter('BD', 'A')).toBe('ABD');
    expect(togglePickLetter('ABD', 'B')).toBe('AD');
    expect(togglePickLetter('A', 'A')).toBe('');
  });
  it('非法入参 fail-closed', () => {
    expect(togglePickLetter(undefined, 'A')).toBe('A');
    expect(togglePickLetter('BD', '')).toBe('BD');
    expect(togglePickLetter('BD', null)).toBe('BD');
    expect(togglePickLetter(3, 'A')).toBe('A');
  });
  it('长按排除多选已选中的某一项只去掉该字母', () => {
    expect(toggleExcl([], 'B', 'BD')).toEqual({ excl: ['B'], picked: 'D' });
    expect(toggleExcl([], 'A', 'A')).toEqual({ excl: ['A'], picked: '' });
  });
});

describe('R414 模考页/报告页多选（源文件锁）', () => {
  const exam = read('../src/pkgA/exam/exam.vue');
  const report = read('../src/pkgA/exam/report.vue');
  it('多选题点选只切换、不自动跳题；单选保持点选即跳', () => {
    expect(exam).toMatch(/pick\(k\)\s*\{[\s\S]*?if \(this\.cur\.multi\) \{\s*this\.cur\._picked = togglePickLetter\(this\.cur\._picked, k\);\s*this\.saveProgress\(\);\s*return;/);
    expect(exam).toMatch(/this\.cur\._picked = this\.cur\._picked === k \? '' : k;[\s\S]*?setTimeout\(\(\) => this\.next\(\), 180\)/);
    expect(exam).toMatch(/sel: \(cur\._picked \|\| ''\)\.indexOf\(k\) !== -1/);
    expect(exam).toMatch(/v-if="cur\.multi" class="multi-tip"/);
  });
  it('报告页正确项/错选项按字母包含标记', () => {
    expect(report).toMatch(/right: \(detail\.answer \|\| ''\)\.indexOf\(k\) !== -1/);
    expect(report).toMatch(/wrong: \(detail\.picked \|\| ''\)\.indexOf\(k\) !== -1 && \(detail\.answer \|\| ''\)\.indexOf\(k\) === -1/);
    expect(report).not.toMatch(/right: k === detail\.answer/);
  });
});
