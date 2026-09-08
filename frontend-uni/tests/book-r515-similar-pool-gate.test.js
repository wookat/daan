// R515：无题库同类题池的错题（时政 /api/shizheng/daily、手录）不再露出「练 3 道同类题」入口 / 不再自动加练请求
// 改前生产一手：时政复习答错 → 「还不稳？练 3 道同类题巩固 ›」→ 练习页 practicePreset {module:'时政'} → /api/questions?module=时政 items 0 → 「题目加载失败 该模块暂无题目」死路
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { hasSimilarPool } from '../src/review-similar.js';
import { MODULE_KEYS } from '../src/module-meta.js';

const BOOK = readFileSync(new URL('../src/pages/book/book.vue', import.meta.url), 'utf8');

describe('hasSimilarPool', () => {
  it('行测五模块（题库 module 键）有池', () => {
    expect(MODULE_KEYS).toEqual(['ziliao', 'shuliang', 'yanyu', 'panduan', 'changshi']);
    for (const k of MODULE_KEYS) expect(hasSimilarPool({ module: k })).toBe(true);
    expect(hasSimilarPool({ module: 'panduan', submodule: '定义判断', question_id: 149164 })).toBe(true);
  });
  it('时政 / 手录 / 空 module / 非对象 → 无池（fail-closed）', () => {
    expect(hasSimilarPool({ module: '时政', submodule: null, question_id: null })).toBe(false);
    expect(hasSimilarPool({ module: '手录' })).toBe(false);
    expect(hasSimilarPool({ module: '判断推理' })).toBe(false);
    expect(hasSimilarPool({ module: '' })).toBe(false);
    expect(hasSimilarPool({ module: null })).toBe(false);
    expect(hasSimilarPool({})).toBe(false);
    expect(hasSimilarPool(null)).toBe(false);
    expect(hasSimilarPool('panduan')).toBe(false);
  });
});

describe('book.vue 源锁', () => {
  it('复习卡 CTA / 列表「练3道同类」/ appendSimilar 三处都按 hasSimilarPool 门控，不再只看 m.module 真值', () => {
    expect(BOOK).toMatch(/import \{[^}]*\bhasSimilarPool\b[^}]*\} from '\.\.\/\.\.\/review-similar\.js'/);
    expect(BOOK).toContain('v-if="!wasCorrect && similarableReview && !cur._extra"');
    expect(BOOK).toContain('similarableReview() {\n      return hasSimilarPool(this.cur);\n    },');
    expect(BOOK).toContain('if (m._simFetched || m._requeued || !hasSimilarPool(m)) return;');
    expect(BOOK).toContain("if (hasSimilarPool(m)) acts.push({ t: '练3道同类', f: () => this.practiceSimilar(m) });");
    expect(BOOK).not.toContain('v-if="!wasCorrect && cur.module && !cur._extra"');
    expect(BOOK).not.toContain("if (m.module) acts.push({ t: '练3道同类'");
  });
  it('AI 详解入口不受影响（时政题仍可问 AI）', () => {
    expect(BOOK).toContain('v-if="askableReview"');
  });
});
